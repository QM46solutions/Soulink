import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SERVER_KEY = 'soulink.server';
const TOKEN_KEY = 'soulink.token';

// Default server: the laptop that is running Expo, on port 4000. Expo tells the app that laptop's
// Wi-Fi address, so the phone finds the server automatically. You can still override it from the
// ⚙️ button on the welcome screen.
function defaultServer() {
  // Opened through the phone link (START-SOULINK-PHONE): the API is on the same https address under /api
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.port !== '8081' && window.location.hostname !== 'localhost') {
    return `${window.location.origin}/api`;
  }
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri || '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:4000`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}
let baseUrl = defaultServer();
let token = null;

export async function loadSession() {
  const [s, t] = await Promise.all([
    AsyncStorage.getItem(SERVER_KEY),
    Platform.OS === 'web' ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY),
  ]);
  if (s) baseUrl = s;
  token = t || null;
  return { baseUrl, token };
}

export const getServer = () => baseUrl;
export const getToken = () => token;

export async function setServer(url) {
  baseUrl = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(baseUrl)) baseUrl = `http://${baseUrl}`;
  await AsyncStorage.setItem(SERVER_KEY, baseUrl);
  return baseUrl;
}

export async function setToken(t) {
  token = t;
  if (Platform.OS === 'web') {
    if (t) await AsyncStorage.setItem(TOKEN_KEY, t); else await AsyncStorage.removeItem(TOKEN_KEY);
  } else if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Full URL for images stored on the server (/uploads/...). */
export const mediaUrl = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${baseUrl}${p}`);

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, form, timeoutMs = 15000 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ApiError(0, `Can't reach the Soulink server at ${baseUrl}. Is it running, and is your phone on the same Wi-Fi?`, 'network');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data?.error?.message || `Request failed (${res.status})`, data?.error?.code);
  }
  return data;
}

/**
 * Upload a local file (uri from the image picker or the voice recorder) as multipart form data.
 * On the web the uri is a blob: URL, so it is fetched and sent as a real Blob.
 */
export async function uploadFile(path, { uri, name, type }, field = 'file', fields = {}) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, new File([blob], name, { type: type || blob.type }));
  } else {
    form.append(field, { uri, name, type });
  }
  return api(path, { method: 'POST', form, timeoutMs: 90000 });
}

/** Upload a local image (uri from the image picker or camera) as multipart form data. Works on phone and web. */
export function uploadImage(path, uri, field = 'photo') {
  // Web gives a data: or blob: URL (no file name), phone gives a file path
  const dataType = uri.startsWith('data:') ? uri.slice(5, uri.indexOf(';')) : null;
  const last = uri.startsWith('data:') || uri.startsWith('blob:') ? '' : uri.split('/').pop().split('?')[0];
  const ext = (dataType ? dataType.split('/')[1] : (last.split('.').pop() || 'jpg')).toLowerCase().replace('jpeg', 'jpg');
  const type = dataType || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' ? 'image/heic' : 'image/jpeg');
  const name = last && last.includes('.') ? last : `photo.${ext || 'jpg'}`;
  return uploadFile(path, { uri, name, type }, field);
}

/** New post: caption + 0-10 photos (uris from the picker/camera). Works on phone and web. */
export async function createPost({ caption, uris = [] }) {
  const form = new FormData();
  form.append('caption', caption || '');
  for (let i = 0; i < uris.length; i += 1) {
    const uri = uris[i];
    const dataType = uri.startsWith('data:') ? uri.slice(5, uri.indexOf(';')) : null;
    const type = dataType || (/\.png$/i.test(uri) ? 'image/png' : /\.webp$/i.test(uri) ? 'image/webp' : 'image/jpeg');
    const name = `photo${i + 1}.${type.split('/')[1].replace('jpeg', 'jpg')}`;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      form.append('photos', new File([blob], name, { type: blob.type || type }));
    } else {
      form.append('photos', { uri, name, type });
    }
  }
  return api('/posts', { method: 'POST', form, timeoutMs: 120000 });
}
