// Connection intents (same keys as the server). Order = how they're shown.
export const INTENTS = [
  { key: 'friendship', label: 'Friendship', emoji: '🤝' },
  { key: 'dating', label: 'Dating', emoji: '💘' },
  { key: 'situationship', label: 'Situationship', emoji: '🌗' },
  { key: 'buddy', label: 'Study / Work buddy', emoji: '📚' },
  { key: 'networking', label: 'Networking', emoji: '💼' },
  { key: 'vibing', label: 'Just vibing', emoji: '✨' },
  { key: 'unsure', label: 'Not sure yet', emoji: '🤔' },
];
export const intentOf = (key) => INTENTS.find((i) => i.key === key) || { key, label: key, emoji: '' };
export const HOLDS = [
  { days: 1, label: '1 day' }, { days: 3, label: '3 days' }, { days: 7, label: '1 week' }, { days: 14, label: '2 weeks' }, { days: 30, label: '1 month' },
];
export const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
