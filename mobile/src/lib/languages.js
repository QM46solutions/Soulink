// Chat translator languages (same keys as the server: server/src/services/soulmojiAi.js TRANSLATE_LANGS).
// voice: false = text translation only (no speaking voice for it yet).
export const CHAT_LANGS = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { key: 'te', label: 'Telugu', native: 'తెలుగు' },
  { key: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { key: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { key: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { key: 'mr', label: 'Marathi', native: 'मराठी' },
  { key: 'bn', label: 'Bengali', native: 'বাংলা' },
  { key: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { key: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { key: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { key: 'as', label: 'Assamese', native: 'অসমীয়া' },
  { key: 'ur', label: 'Urdu', native: 'اردو' },
  { key: 'ks', label: 'Kashmiri', native: 'کٲشُر', voice: false },
];
export const langName = (k) => CHAT_LANGS.find((l) => l.key === k)?.label || k;
export const hasVoice = (k) => CHAT_LANGS.find((l) => l.key === k)?.voice !== false;

// Unicode blocks of each script. Shared scripts are told apart by letters only one language uses:
// Marathi ळ ऱ (Devanagari), Assamese ৰ ৱ (Bengali script), Kashmiri ٲ ٳ ۄ ؠ ێ (Arabic script).
const BLOCKS = [
  ['hi', 0x0900, 0x097f], ['bn', 0x0980, 0x09ff], ['pa', 0x0a00, 0x0a7f], ['gu', 0x0a80, 0x0aff], ['or', 0x0b00, 0x0b7f],
  ['ta', 0x0b80, 0x0bff], ['te', 0x0c00, 0x0c7f], ['kn', 0x0c80, 0x0cff], ['ml', 0x0d00, 0x0d7f], ['ur', 0x0600, 0x06ff],
];
const MARATHI = /[ळऱ]/;
const ASSAMESE = /[ৰৱ]/;
const KASHMIRI = /[ٲٳۄؠێ]/;

/** Which of our languages a message is written in, from its script. */
export function detectLanguage(text = '') {
  const counts = { en: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0);
    const b = BLOCKS.find(([, lo, hi]) => c >= lo && c <= hi);
    if (b) counts[b[0]] = (counts[b[0]] || 0) + 1;
    else if (/[a-z]/i.test(ch)) counts.en += 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  if (top === 'hi' && MARATHI.test(text)) return 'mr';
  if (top === 'bn' && ASSAMESE.test(text)) return 'as';
  if (top === 'ur' && KASHMIRI.test(text)) return 'ks';
  return top;
}
