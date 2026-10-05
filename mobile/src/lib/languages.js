// Chat translator languages (same keys as the server).
export const CHAT_LANGS = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { key: 'te', label: 'Telugu', native: 'తెలుగు' },
  { key: 'bn', label: 'Bengali', native: 'বাংলা' },
];
export const langName = (k) => CHAT_LANGS.find((l) => l.key === k)?.label || k;

/** Which of our languages a message is written in, from its script. */
export function detectLanguage(text = '') {
  const counts = { hi: 0, te: 0, bn: 0, en: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= 0x0900 && c <= 0x097f) counts.hi += 1;
    else if (c >= 0x0c00 && c <= 0x0c7f) counts.te += 1;
    else if (c >= 0x0980 && c <= 0x09ff) counts.bn += 1;
    else if (/[a-z]/i.test(ch)) counts.en += 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
