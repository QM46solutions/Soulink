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
export const ALL_CAT = { key: null, label: 'All', mci: 'movie-open-star', colors: ['#7c5cfc', '#ff6b9d'] };
export const catOf = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[0];

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
export async function postSpark({ videoUri, videoType, music, category, caption, place, details, oneTake, musicTitle, castingId, stage }) {
  const form = new FormData();
  if (castingId) form.append('castingId', castingId);
  if (stage) form.append('stage', '1');
  form.append('category', category);
  form.append('caption', caption || '');
  if (place) form.append('place', place);
  form.append('details', JSON.stringify(details || {}));
  form.append('oneTake', oneTake ? '1' : '0');
  if (musicTitle) form.append('musicTitle', musicTitle);
  // a song from JioSaavn / Deezer / free music is just a reference; only a song from the phone is uploaded
  if (music?.ref) { form.append('musicRef', music.ref); music = null; }
  if (Platform.OS === 'web') {
    const v = await blobOf(videoUri);
    const type = videoType || v.type || 'video/mp4';
    form.append('video', new File([v], `spark.${type.includes('webm') ? 'webm' : type.includes('quicktime') ? 'mov' : 'mp4'}`, { type }));
    if (music) form.append('music', new File([await blobOf(music.uri)], music.name || 'music.mp3', { type: music.type || 'audio/mpeg' }));
  } else {
    form.append('video', { uri: videoUri, name: 'spark.mp4', type: videoType || 'video/mp4' });
    if (music) form.append('music', { uri: music.uri, name: music.name || 'music.mp3', type: music.type || 'audio/mpeg' });
  }
  return api('/sparks', { method: 'POST', form, timeoutMs: 300000 });
}
