// Soul DNA v1: a 10-question vibe quiz. Each answer nudges the 8 traits (Empathy, Ambition, Humor, Loyalty,
// Creativity, Conflict Style, Mentality, Nature). Behaviour signals refine it later (Build 7).
export const TRAITS = ['empathy', 'ambition', 'humor', 'loyalty', 'creativity', 'conflict_style', 'mentality', 'nature'];

export const QUIZ = [
  { id: 1, text: 'Friday night, no plans. You…', options: [
    { label: 'Call the whole gang out 🎉', w: { nature: 2, humor: 1 } },
    { label: 'Movie + biryani with one close friend 🍿', w: { loyalty: 1, nature: -1 } },
    { label: 'Finally start that side project 💻', w: { ambition: 2, creativity: 1 } },
    { label: 'Headphones, journal, deep thoughts 🌙', w: { nature: -2, creativity: 1, mentality: 1 } },
  ] },
  { id: 2, text: 'Your friend just went through a breakup. You…', options: [
    { label: 'Show up with snacks and just listen', w: { empathy: 2, loyalty: 1 } },
    { label: 'Plan a surprise trip to distract them', w: { humor: 1, nature: 1 } },
    { label: 'Give honest advice, even if it stings', w: { conflict_style: 2, mentality: -1 } },
    { label: 'Send memes until they laugh', w: { humor: 2 } },
  ] },
  { id: 3, text: "In a group project, you're the one who…", options: [
    { label: 'Takes charge and sets deadlines', w: { ambition: 2, conflict_style: 1 } },
    { label: 'Comes up with the wild ideas', w: { creativity: 2 } },
    { label: 'Keeps everyone calm and together', w: { empathy: 1, conflict_style: -1 } },
    { label: 'Quietly does the work and delivers', w: { loyalty: 1, nature: -1 } },
  ] },
  { id: 4, text: 'Someone cuts in front of you in a long queue.', options: [
    { label: 'Call it out right there', w: { conflict_style: 2 } },
    { label: 'Make a joke about it, loudly', w: { humor: 1, conflict_style: 1 } },
    { label: 'Let it go, not worth it', w: { conflict_style: -2, empathy: 1 } },
    { label: 'Give the look and stay silent', w: { conflict_style: -1 } },
  ] },
  { id: 5, text: 'Pick a dream weekend', options: [
    { label: 'Sunrise trek 🏔️', w: { nature: 1, ambition: 1 } },
    { label: 'Art gallery + café hopping ☕', w: { creativity: 2 } },
    { label: 'House party till 3 am 🪩', w: { nature: 2, humor: 1 } },
    { label: 'Home, family, home food 🏠', w: { loyalty: 2, nature: -1 } },
  ] },
  { id: 6, text: 'Your 5-year plan is…', options: [
    { label: 'A detailed spreadsheet ✅', w: { ambition: 2, mentality: -1 } },
    { label: 'A vibe, not a plan', w: { mentality: 1, creativity: 1, ambition: -1 } },
    { label: 'Change the world, somehow 🌍', w: { mentality: 2, ambition: 1 } },
    { label: 'Stable job, peace of mind', w: { mentality: -2, loyalty: 1 } },
  ] },
  { id: 7, text: 'A friend tells you a secret. You…', options: [
    { label: 'Take it to the grave 🤐', w: { loyalty: 2 } },
    { label: 'Ask how you can help', w: { empathy: 2 } },
    { label: 'Tell them what you really think', w: { conflict_style: 1, mentality: -1 } },
    { label: 'Share one of yours too', w: { empathy: 1, nature: 1 } },
  ] },
  { id: 8, text: 'Your texting style', options: [
    { label: 'Voice notes, always 🎙️', w: { nature: 1, empathy: 1 } },
    { label: 'Memes and reels only 😂', w: { humor: 2 } },
    { label: 'Long paragraphs at 2 am 📝', w: { mentality: 1, creativity: 1, nature: -1 } },
    { label: '"k" 👍', w: { mentality: -1, nature: -1 } },
  ] },
  { id: 9, text: 'When things go wrong, you think…', options: [
    { label: 'Everything happens for a reason ✨', w: { mentality: 2 } },
    { label: "What's the fix? Let's go", w: { ambition: 1, mentality: -1 } },
    { label: 'I need to talk it out with someone', w: { empathy: 1, nature: 1 } },
    { label: 'Laugh now, cry later 😅', w: { humor: 2 } },
  ] },
  { id: 10, text: 'What matters most in any connection?', options: [
    { label: 'Trust', w: { loyalty: 2 } },
    { label: 'Laughing together', w: { humor: 2 } },
    { label: 'Growing together', w: { ambition: 1, mentality: 1 } },
    { label: 'Really understanding each other', w: { empathy: 2 } },
  ] },
];

// The type shown to everyone (free). The full trait breakdown is Premium.
const TYPES = {
  empathy: ['The Healer', 'You feel what others feel, and people feel safe around you.', 'The Straight Shooter', 'Clear, direct, no drama. People always know where they stand.'],
  ambition: ['The Trailblazer', 'Big goals, bigger energy. You make things happen.', 'The Free Spirit', 'You follow the moment, not the plan, and life feels lighter for it.'],
  humor: ['The Spark', 'You light up every room and every group chat.', 'The Deep Diver', 'You skip small talk and go straight to what matters.'],
  loyalty: ['The Anchor', 'Ride or die. Your people can always count on you.', 'The Explorer', 'New people, new places, new stories. Always curious.'],
  creativity: ['The Dreamer', 'Your mind is a gallery of wild ideas.', 'The Builder', 'Practical and steady. You turn ideas into real things.'],
  conflict_style: ['The Truth-Teller', 'Honest to the core, even when it is hard to say.', 'The Peacemaker', 'You calm storms and keep people together.'],
  mentality: ['The Visionary', 'You see what could be, not just what is.', 'The Realist', 'Grounded and wise. You see things as they are.'],
  nature: ['The Firecracker', 'Loud laughs, big plans, main-character energy.', 'The Midnight Philosopher', 'Quiet, deep and thoughtful. Your best talks happen at 2 am.'],
};

export const SOUL_TYPES = Object.values(TYPES).flatMap(([hi, , lo]) => [hi, lo]);

/** Soul type + tagline from the 8 traits (the trait that stands out most). */
export function soulTypeOf(traits) {
  let best = TRAITS[0];
  for (const t of TRAITS) if (Math.abs(traits[t] - 50) > Math.abs(traits[best] - 50)) best = t;
  const [hiName, hiLine, loName, loLine] = TYPES[best];
  const high = traits[best] >= 50;
  return { type: high ? hiName : loName, tagline: high ? hiLine : loLine };
}

/** answers: [{ questionId, optionIndex }] (all 10) → { traits, type, tagline } */
export function scoreQuiz(answers) {
  const sums = Object.fromEntries(TRAITS.map((t) => [t, 0]));
  for (const a of answers) {
    const q = QUIZ.find((x) => x.id === a.questionId);
    const o = q?.options[a.optionIndex];
    if (!o) throw new Error(`Invalid answer for question ${a.questionId}`);
    for (const [t, v] of Object.entries(o.w)) sums[t] += v;
  }
  const traits = Object.fromEntries(TRAITS.map((t) => [t, Math.max(5, Math.min(95, Math.round(50 + 8 * sums[t])))]));
  // Type = the trait that stands out most (ties: order of TRAITS)
  let best = TRAITS[0];
  for (const t of TRAITS) if (Math.abs(traits[t] - 50) > Math.abs(traits[best] - 50)) best = t;
  const [hiName, hiLine, loName, loLine] = TYPES[best];
  const high = traits[best] >= 50;
  return { traits, type: high ? hiName : loName, tagline: high ? hiLine : loLine };
}

/** Soul Score (0-100) between two people from their traits and shared interests. */
export function soulScore(a, b, interestsA = [], interestsB = []) {
  const diff = TRAITS.reduce((s, t) => s + Math.abs((a[t] ?? 50) - (b[t] ?? 50)), 0) / TRAITS.length;
  const shared = interestsA.filter((i) => interestsB.includes(i)).length;
  return Math.max(30, Math.min(99, Math.round(100 - diff * 1.5 + Math.min(8, shared * 2))));
}

/** The quiz as sent to the app (no weights, so it can't be gamed). */
export const publicQuiz = () => QUIZ.map((q) => ({ id: q.id, text: q.text, options: q.options.map((o) => o.label) }));
