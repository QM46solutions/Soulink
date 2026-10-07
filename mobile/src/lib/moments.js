// Moments: backgrounds for written Moments, and sending a new Moment.
import { Platform } from 'react-native';
import { api, uploadFile } from './api';

export const MOMENT_BGS = {
  aurora: ['#7c5cfc', '#ff6b9d'],
  sunset: ['#ff9a5a', '#ff6b9d'],
  ocean: ['#3fa9f5', '#42e8c0'],
  forest: ['#2bb673', '#1f6f5c'],
  night: ['#141221', '#5b46d6'],
  gold: ['#f5c842', '#ff6b9d'],
};
export const bgOf = (k) => MOMENT_BGS[k] || MOMENT_BGS.aurora;

/** photoUri (optional), text, bg, story (bool), conversationIds ([]) -> { moment, sent, failed } */
export async function sendMoment({ photoUri, text, bg, story, conversationIds }) {
  const fields = { story: story ? '1' : '0', conversationIds: JSON.stringify(conversationIds || []) };
  if (text?.trim()) fields.text = text.trim();
  if (!photoUri) {
    if (bg) fields.bg = bg;
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    return api('/moments', { method: 'POST', form, timeoutMs: 60000 });
  }
  const dataType = photoUri.startsWith('data:') ? photoUri.slice(5, photoUri.indexOf(';')) : null;
  const type = dataType || (/\.png$/i.test(photoUri) ? 'image/png' : 'image/jpeg');
  return uploadFile('/moments', { uri: photoUri, name: `moment.${type.split('/')[1].replace('jpeg', 'jpg')}`, type }, 'photo', fields, 120000);
}

export const isWeb = Platform.OS === 'web';
