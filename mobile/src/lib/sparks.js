// Sparks 🎬: categories, their extras, and the creative prompts (all Soulink's own, no copyrighted lines).
import { Platform } from 'react-native';
import { api } from './api';

export const CATEGORIES = [
  { key: 'travel', label: 'Travel', emoji: '✈️', icon: 'airplane', mci: 'airplane-takeoff', colors: ['#3fa9f5', '#42e8c0'], react: { emoji: '😍', label: 'Wanderlust' },
    line: 'Pin the place, add its music or its real sound' },
  { key: 'cooking', label: 'Cooking', emoji: '🍳', icon: 'restaurant', mci: 'chef-hat', colors: ['#ff9a5a', '#f5c842'], react: { emoji: '😋', label: 'Yum' },
    line: 'Recipe card, time, veg / non-veg, "I tried it"' },
  { key: 'acting', label: 'Acting', emoji: '🎭', icon: 'film', mci: 'drama-masks', colors: ['#7c5cfc', '#ff6b9d'], react: { emoji: '👏', label: 'Bravo' },
    line: 'Improv Dice, Script of the week, scenes and dubs' },
  { key: 'fitness', label: 'Fitness', emoji: '💪', icon: 'barbell', mci: 'arm-flex', colors: ['#42e8c0', '#7cf57c'], react: { emoji: '💪', label: 'Strong' },
    line: 'Workouts, yoga, runs, transformations: workout card + "I did it"' },
  { key: 'news', label: 'News', emoji: '📰', icon: 'newspaper', mci: 'newspaper-variant', colors: ['#ff6b6b', '#ff9a5a'], react: { emoji: '💡', label: 'Useful' },
    line: 'What happened, where, with the headline and a source link' },
];
// Casting Call: auditions for Casting Board roles (their own section of the Sparks tab)
export const CASTING_CAT = { key: 'casting', label: 'Casting Call', emoji: '🎭', icon: 'film', mci: 'drama-masks', colors: ['#b08fff', '#ff6b9d'], section: true };
export const ALL_CAT = { key: null, label: 'All', mci: 'movie-open-star', colors: ['#7c5cfc', '#ff6b9d'] };
// Open Mic: speak your mind (its own tab, not in the category picker or the main feed)
export const OPENMIC_CAT = { key: 'openmic', label: 'Open Mic', emoji: '🎤', icon: 'mic', mci: 'microphone-variant', colors: ['#f5c842', '#ff6b9d'], react: { emoji: '🙌', label: 'I hear you' },
  line: 'Say what you want to say: a story, an incident, society, politics' };
export const MIC_TOPICS = [
  { key: 'story', label: 'My story', emoji: '📖' },
  { key: 'incident', label: 'Something that happened', emoji: '⚠️' },
  { key: 'society', label: 'Society', emoji: '🏙️' },
  { key: 'politics', label: 'Politics', emoji: '🗳️' },
  { key: 'voice', label: 'Raising my voice', emoji: '📣' },
  { key: 'other', label: 'Something else', emoji: '💬' },
];
export const micTopicOf = (k) => MIC_TOPICS.find((t) => t.key === k) || MIC_TOPICS[MIC_TOPICS.length - 1];
export const catOf = (k) => (k === 'openmic' ? OPENMIC_CAT : CATEGORIES.find((c) => c.key === k) || CATEGORIES[0]);

// ---- Acting: Improv Dice 🎲 (random emotion + situation + character) ----
const EMOTIONS = ['😡 Angry', '😭 Heartbroken', '😂 Can’t stop laughing', '😱 Terrified', '🥹 Proud', '😏 Sarcastic', '🤯 Shocked', '😴 Half asleep', '🥰 In love', '😤 Jealous', '😬 Nervous', '🤩 Over-excited'];
const SITUATIONS = ['at your best friend’s wedding', 'stuck in Hyderabad traffic', 'in a job interview', 'meeting your crush’s parents', 'when the exam results come out', 'at a biryani shop that ran out', 'when your phone falls in water', 'on your first day in a new city', 'at a surprise party', 'when the power goes off mid-match', 'in an auto that took the wrong route', 'when you see your ex'];
const CHARACTERS = ['as a grandmother', 'as a police officer', 'as a news reader', 'as a 5-year-old', 'as a film villain', 'as a strict teacher', 'as a cricket commentator', 'as a robot', 'as a king', 'as yourself'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const rollDice = () => ({ emotion: pick(EMOTIONS), situation: pick(SITUATIONS), character: pick(CHARACTERS) });

// ---- Acting: Script of the week 📜 (short originals written for Soulink) ----
export const SCRIPTS = [
  { title: 'The Last Train', lines: 'You think I came back for you? No. I came back because I left my umbrella here. …Okay. Maybe not just the umbrella.' },
  { title: 'Results Day', lines: 'Amma, before you open that envelope, remember: you always said marks don’t decide who I am. Please remember that in five seconds.' },
  { title: 'The Interview', lines: 'My biggest weakness? I care too much. About everything. About this chair. About that plant. Is that plant real? I need to know.' },
  { title: 'Goodbye Letter', lines: 'I’m not angry. I just wanted you to know that I waited. Every evening at six. Even when it rained. Especially when it rained.' },
  { title: 'Villain Entry', lines: 'You built this city on promises. Tonight, I collect. Every single one. Starting… with you.' },
];
export const scriptOfWeek = () => SCRIPTS[Math.floor(Date.now() / (7 * 86400000)) % SCRIPTS.length];

// ---- Fitness: challenge of the week 💪 (everyone can take the same one) ----
const FIT_CHALLENGES = [
  '50 squats, no breaks',
  '1-minute plank',
  '20 push-ups (knees are fine)',
  '10-minute morning stretch',
  '5,000 steps before breakfast',
  '30 jumping jacks + 30 high knees',
  'Sun salutation × 5',
  'Stairs only, all day',
];
export const fitChallengeOfWeek = () => FIT_CHALLENGES[Math.floor(Date.now() / (7 * 86400000)) % FIT_CHALLENGES.length];
export const FIT_TYPES = [['gym', '🏋️ Gym'], ['home', '🏠 Home workout'], ['yoga', '🧘 Yoga'], ['run', '🏃 Run / walk'], ['sport', '⚽ Sport'], ['dance', '💃 Dance fitness'], ['transformation', '✨ Transformation']];
export const FIT_LEVELS = [['beginner', '🟢 Beginner'], ['intermediate', '🟡 Intermediate'], ['advanced', '🔴 Advanced']];

// ---- News 📰 ----
export const NEWS_TOPICS = [['local', '📍 Local'], ['india', '🇮🇳 India'], ['world', '🌍 World'], ['tech', '💻 Tech'], ['sports', '🏏 Sports'], ['cinema', '🎬 Cinema'], ['business', '📈 Business'], ['good', '🌈 Good news']];
export const DIETS = [['veg', '🟢 Veg'], ['nonveg', '🔴 Non-veg'], ['egg', '🟡 Egg'], ['vegan', '🌱 Vegan']];

const blobOf = async (uri) => (await fetch(uri)).blob();

/** Upload a new Spark: { videoUri, videoType, musicFile?, category, caption, place, details, oneTake, musicTitle } */
export async function postSpark({ videoUri, videoType, music, voice, category, caption, place, details, oneTake, musicTitle, castingId, stage, mic }) {
  const form = new FormData();
  if (castingId) form.append('castingId', castingId);
  if (stage) form.append('stage', '1');
  if (mic) form.append('mic', mic);
  form.append('category', category);
  form.append('caption', caption || '');
  if (place) form.append('place', place);
  form.append('details', JSON.stringify(details || {}));
  form.append('oneTake', oneTake ? '1' : '0');
  if (musicTitle) form.append('musicTitle', musicTitle);
  // a song from JioSaavn / Deezer / free music is just a reference; only a song from the phone is uploaded
  if (music?.ref) { form.append('musicRef', music.ref); music = null; }
  if (music) form.append('rightsConfirmed', music.rightsConfirmed ? 'true' : 'false');
  if (Platform.OS === 'web') {
    const v = await blobOf(videoUri);
    const type = videoType || v.type || 'video/mp4';
    const ext = type.startsWith('audio/') ? (type.includes('webm') ? 'webm' : type.includes('mp4') || type.includes('m4a') ? 'm4a' : 'mp3') : type.includes('webm') ? 'webm' : type.includes('quicktime') ? 'mov' : 'mp4';
    form.append('video', new File([v], `spark.${ext}`, { type }));
    if (music) form.append('music', new File([await blobOf(music.uri)], music.name || 'music.mp3', { type: music.type || 'audio/mpeg' }));
    if (voice) form.append('voice', new File([await blobOf(voice.uri)], voice.name || 'voice.webm', { type: voice.type || 'audio/webm' }));
  } else {
    form.append('video', { uri: videoUri, name: (videoType || '').startsWith('audio/') ? 'spark.m4a' : 'spark.mp4', type: videoType || 'video/mp4' });
    if (music) form.append('music', { uri: music.uri, name: music.name || 'music.mp3', type: music.type || 'audio/mpeg' });
    if (voice) form.append('voice', { uri: voice.uri, name: voice.name || 'voice.m4a', type: voice.type || 'audio/m4a' });
  }
  return api('/sparks', { method: 'POST', form, timeoutMs: 300000 });
}

// ---------- Soulink Studio: Sparks the video builder puts together (several clips / photos, Soul Looks) ----------
/** is the video builder switched on? (cached for the session) */
let builderCache = null;
export async function builderOn() {
  if (builderCache != null) return builderCache;
  try { builderCache = !!(await api('/sparks/builder')).on; } catch { return false; }
  return builderCache;
}
async function sizeOf(uri) {
  if (Platform.OS === 'web') return (await blobOf(uri)).size;
  const FS = await import('expo-file-system/legacy');
  const info = await FS.getInfoAsync(uri, { size: true }).catch(() => null);
  return info?.size || 1;
}
async function putFile(url, uri, type) {
  const headers = { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': type };
  if (Platform.OS === 'web') {
    const res = await fetch(url, { method: 'PUT', body: await blobOf(uri), headers });
    if (!res.ok) throw new Error('A clip could not be uploaded. Check your connection and try again.');
    return;
  }
  const FS = await import('expo-file-system/legacy');
  const res = await FS.uploadAsync(url, uri, { httpMethod: 'PUT', uploadType: FS.FileSystemUploadType.BINARY_CONTENT, headers });
  if (res.status < 200 || res.status >= 300) throw new Error('A clip could not be uploaded. Check your connection and try again.');
}
/**
 * Uploads the Studio's clips (and a song from the phone / the voiceover) straight to storage, then posts the Spark
 * as a build job. The Spark appears when it's ready (a notification tells you). onProgress(0..1) while uploading.
 * recipe = lib/studio.js toRecipe(project); edit = the text / stickers / cover that stay live on top of the video.
 */
export async function postStudioSpark({ project, recipe, edit, category, caption, place, details, castingId, stage, mic, onProgress }) {
  const pieces = project.clips.map((c) => ({ uri: c.uri, type: c.type || (c.kind === 'photo' ? 'image/jpeg' : 'video/mp4') }));
  const song = project.music && !project.music.ref && project.music.uri ? { uri: project.music.uri, type: project.music.type || 'audio/mpeg' } : null;
  const voice = project.voice?.uri ? { uri: project.voice.uri, type: (project.voice.type || 'audio/m4a').split(';')[0] } : null;
  const all = [...pieces, ...(song ? [song] : []), ...(voice ? [voice] : [])];
  const sizes = await Promise.all(all.map((f) => sizeOf(f.uri)));
  const { uploads } = await api('/sparks/uploads', { method: 'POST', body: { files: all.map((f, i) => ({ type: f.type, size: Math.max(1, sizes[i]) })) } });
  let done = 0;
  for (let i = 0; i < all.length; i += 1) {
    await putFile(uploads[i].url, all[i].uri, all[i].type);
    done += sizes[i]; onProgress?.(Math.min(0.99, done / sizes.reduce((a, b) => a + b, 0)));
  }
  const names = uploads.map((u) => u.name);
  return api('/sparks/studio', { method: 'POST', timeoutMs: 60000, body: {
    category, caption: caption || '', ...(place ? { place } : {}), details: { ...(details || {}), ...(edit ? { edit } : {}) },
    ...(project.music?.ref ? { musicRef: project.music.ref } : {}), ...(project.music ? { musicTitle: (project.music.title || project.music.name || '').slice(0, 150) } : {}),
    ...(castingId ? { castingId } : {}), ...(stage ? { stage: true } : {}), ...(mic ? { mic } : {}),
    ...(song ? { rightsConfirmed: !!project.music.rightsConfirmed } : {}),
    recipe, files: { clips: names.slice(0, pieces.length), ...(song ? { music: names[pieces.length] } : {}), ...(voice ? { voice: names[names.length - 1] } : {}) },
  } });
}
