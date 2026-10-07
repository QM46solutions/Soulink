// Connection intents (same keys as the server). Order = how they're shown.
export const INTENTS = [
  { key: 'life_partner', label: 'Life partner', emoji: '💍', icon: 'ring', line: 'Marriage, family, forever', colors: ['#f5c842', '#ff6b9d'] },
  { key: 'dating', label: 'Dating', emoji: '💘', icon: 'heart-multiple', line: 'Romance and chemistry', colors: ['#ff6b9d', '#d6336c'] },
  { key: 'friendship', label: 'Friendship', emoji: '🤝', icon: 'handshake', line: 'Good company, good times', colors: ['#42e8c0', '#3fa9f5'] },
  { key: 'situationship', label: 'Situationship', emoji: '🌗', icon: 'moon-waning-crescent', line: 'Something, no labels yet', colors: ['#b08fff', '#5b46d6'] },
  { key: 'buddy', label: 'Study / Work buddy', emoji: '📚', icon: 'book-open-page-variant', line: 'Focus together', colors: ['#58a0e6', '#42e8c0'] },
  { key: 'networking', label: 'Networking', emoji: '💼', icon: 'briefcase-variant', line: 'Career and business', colors: ['#9fb3d1', '#5c6b8a'] },
  { key: 'vibing', label: 'Just vibing', emoji: '✨', icon: 'creation', line: 'See where it goes', colors: ['#b08fff', '#ff6b9d'] },
  { key: 'unsure', label: 'Not sure yet', emoji: '🤔', icon: 'help-circle-outline', line: 'Let\'s talk first', colors: ['#8b88a0', '#4a4760'] },
];
export const intentOf = (key) => INTENTS.find((i) => i.key === key) || { key, label: key, emoji: '' };
export const HOLDS = [
  { days: 1, label: '1 day' }, { days: 3, label: '3 days' }, { days: 7, label: '1 week' }, { days: 14, label: '2 weeks' }, { days: 30, label: '1 month' },
];
export const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
