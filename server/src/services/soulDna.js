// Soul DNA v2: one quiz for everyone, in sections (values & loyalty, life goals, emotions, communication,
// conflict & repair, nature & mindset, lifestyle, family, money, love & affection, respect & growth).
// Questions are scenarios, forced choices, rankings and "how do you react when…" questions, not just self-ratings.
//
// Each answer places the person on one or more AXES (0-100). A pair is compared axis by axis:
//   similar    – closer is better; a partner's TOLERANCE (e.g. "comfortable giving space") softens a difference
//   complement – differences are fine (introvert + extrovert can work)
//   quality    – a relationship skill both should have (repairing after a fight, listening, respect)
//   deal       – a basic life choice; a big gap is a potential dealbreaker (kids, marriage) – dating only
//   cat        – same category (love language) – same is best, different is still okay
//   rank       – priorities ranking (how similar the order of what matters most is)
// Axes roll up into 12 DIMENSIONS, and each relation type weights the dimensions differently.
// The result is a PREDICTED compatibility; check-ins after real chats add an OBSERVED one.

export const DIMS = {
  values: { label: 'Core values', emoji: '🛡️', side: 'natural' },
  goals: { label: 'Life goals', emoji: '🎯', side: 'natural' },
  emotional: { label: 'Emotional connection', emoji: '❤️', side: 'relationship' },
  communication: { label: 'Communication', emoji: '🗣️', side: 'relationship' },
  conflict: { label: 'Conflict & repair', emoji: '🩹', side: 'relationship' },
  personality: { label: 'Nature & mindset', emoji: '🧠', side: 'natural' },
  lifestyle: { label: 'Lifestyle', emoji: '🏠', side: 'natural' },
  family: { label: 'Family', emoji: '👨‍👩‍👧', side: 'natural' },
  money: { label: 'Money', emoji: '💰', side: 'natural' },
  romance: { label: 'Love & affection', emoji: '🔥', side: 'natural' },
  respect: { label: 'Mutual respect', emoji: '🤝', side: 'relationship' },
  growth: { label: 'Compromise & growth', emoji: '🌱', side: 'relationship' },
};

// Relation types (from a request's intent) and how much each dimension counts (sums to 100)
export const RELATIONS = {
  dating: { label: 'Dating', emoji: '💘', pair: 'couple', weights: { values: 16, emotional: 13, communication: 11, conflict: 13, goals: 10, growth: 9, lifestyle: 5, family: 5, money: 5, romance: 6, respect: 4, personality: 3 } },
  friendship: { label: 'Friendship', emoji: '🤝', pair: 'friendship', weights: { values: 15, emotional: 14, communication: 10, conflict: 10, lifestyle: 15, personality: 12, respect: 10, growth: 8, goals: 3, money: 3 } },
  business: { label: 'Business', emoji: '💼', pair: 'partnership', weights: { values: 15, communication: 16, conflict: 14, goals: 20, money: 12, personality: 8, respect: 10, growth: 5 } },
  buddy: { label: 'Study / Work buddy', emoji: '📚', pair: 'duo', weights: { goals: 18, communication: 15, lifestyle: 15, personality: 15, conflict: 10, values: 10, respect: 10, growth: 7 } },
};
export const RELATION_KEYS = Object.keys(RELATIONS);
/** Request intent → relation type for scoring */
export const relationOf = (intent) => ({ dating: 'dating', situationship: 'dating', friendship: 'friendship', vibing: 'friendship', unsure: 'friendship', networking: 'business', buddy: 'buddy' }[intent] || 'friendship');

const D = ['dating'];
const DF = ['dating', 'friendship'];
export const AXES = {
  // values
  honesty: { dim: 'values', mode: 'similar', k: 1.1, label: 'honesty' },
  loyalty: { dim: 'values', mode: 'similar', k: 1.1, label: 'loyalty' },
  tradition: { dim: 'values', mode: 'similar', k: 0.9, label: 'tradition vs modern' },
  privacy: { dim: 'values', mode: 'similar', k: 0.8, label: 'privacy' },
  priorities: { dim: 'values', mode: 'rank', label: 'what matters most' },
  // goals
  marriage: { dim: 'goals', mode: 'deal', only: D, label: 'marriage' },
  kids: { dim: 'goals', mode: 'deal', only: D, label: 'children' },
  career: { dim: 'goals', mode: 'similar', k: 0.9, label: 'career drive' },
  pace: { dim: 'goals', mode: 'similar', k: 0.9, label: 'pace of life' },
  settle: { dim: 'goals', mode: 'similar', k: 0.7, only: ['dating', 'business'], label: 'where to live' },
  // emotional
  empathy: { dim: 'emotional', mode: 'quality', label: 'empathy' },
  reassurance: { dim: 'emotional', mode: 'similar', k: 0.9, tol: 'reassure', label: 'need for reassurance' },
  expressive: { dim: 'emotional', mode: 'complement', label: 'expressing feelings' },
  safety: { dim: 'emotional', mode: 'quality', label: 'making others feel safe' },
  // communication
  directness: { dim: 'communication', mode: 'similar', k: 0.8, label: 'directness' },
  voicing: { dim: 'communication', mode: 'quality', label: 'saying what hurts' },
  listening: { dim: 'communication', mode: 'quality', label: 'listening' },
  texting: { dim: 'communication', mode: 'similar', k: 0.6, only: DF, label: 'how often you talk' },
  defensive: { dim: 'communication', mode: 'inverse', label: 'defensiveness' },
  // conflict
  stressSpace: { dim: 'conflict', mode: 'similar', k: 1.0, tol: 'giveSpace', label: 'space vs talk when stressed' },
  repair: { dim: 'conflict', mode: 'quality', label: 'repairing after a fight' },
  apology: { dim: 'conflict', mode: 'quality', label: 'apologising' },
  cooldown: { dim: 'conflict', mode: 'similar', k: 0.8, label: 'time to cool down' },
  together: { dim: 'conflict', mode: 'similar', k: 0.9, tol: 'respectSpace', label: 'together-time vs personal space' },
  // tolerances (used to soften differences; also count a little as skills)
  giveSpace: { dim: 'conflict', mode: 'quality', w: 0.5, label: 'giving space' },
  reassure: { dim: 'emotional', mode: 'quality', w: 0.5, label: 'reassuring others' },
  respectSpace: { dim: 'respect', mode: 'quality', w: 0.5, label: 'respecting personal space' },
  // personality & mindset
  extrovert: { dim: 'personality', mode: 'complement', label: 'introvert vs extrovert' },
  logic: { dim: 'personality', mode: 'complement', label: 'head vs heart' },
  planner: { dim: 'personality', mode: 'similar', k: 0.6, tol: 'openMind', label: 'planner vs spontaneous' },
  independent: { dim: 'personality', mode: 'similar', k: 0.6, label: 'independence' },
  humor: { dim: 'personality', mode: 'similar', k: 0.5, label: 'sense of humour' },
  creativity: { dim: 'personality', mode: 'complement', label: 'dreamer vs builder' },
  idealism: { dim: 'personality', mode: 'similar', k: 0.6, label: 'optimist vs realist' },
  openMind: { dim: 'growth', mode: 'quality', label: 'open-mindedness' },
  // lifestyle
  social: { dim: 'lifestyle', mode: 'similar', k: 0.8, tol: 'respectSpace', label: 'social life' },
  travel: { dim: 'lifestyle', mode: 'similar', k: 0.6, label: 'travel' },
  chrono: { dim: 'lifestyle', mode: 'similar', k: 0.5, label: 'early bird vs night owl' },
  diet: { dim: 'lifestyle', mode: 'similar', k: 0.7, only: DF, label: 'food habits' },
  tidy: { dim: 'lifestyle', mode: 'similar', k: 0.6, label: 'tidiness' },
  screens: { dim: 'lifestyle', mode: 'similar', k: 0.4, only: D, label: 'phones at meals' },
  // family
  liveFamily: { dim: 'family', mode: 'deal', only: D, soft: true, label: 'living with family' },
  familySay: { dim: 'family', mode: 'similar', k: 1.0, only: D, label: "family's say in decisions" },
  boundaries: { dim: 'family', mode: 'similar', k: 0.8, only: D, label: 'boundaries with family' },
  // money
  spender: { dim: 'money', mode: 'similar', k: 0.9, label: 'spending vs saving' },
  pool: { dim: 'money', mode: 'similar', k: 0.8, only: D, label: 'shared vs separate money' },
  moneyPlan: { dim: 'money', mode: 'similar', k: 0.6, label: 'money planning' },
  // love & affection
  loveLang: { dim: 'romance', mode: 'cat', only: DF, label: 'how you show care' },
  pda: { dim: 'romance', mode: 'similar', k: 0.7, only: D, label: 'affection in public' },
  romance: { dim: 'romance', mode: 'similar', k: 0.8, only: D, label: 'romance and surprises' },
  attraction: { dim: 'romance', mode: 'similar', k: 0.6, only: D, label: 'feeling desired' },
  jealousy: { dim: 'romance', mode: 'similar', k: 0.8, only: D, label: 'jealousy' },
  // respect & growth
  supportDreams: { dim: 'respect', mode: 'quality', label: "supporting each other's dreams" },
  respectChoice: { dim: 'respect', mode: 'quality', label: "respecting each other's choices" },
  compromise: { dim: 'growth', mode: 'quality', label: 'compromise' },
  reflect: { dim: 'growth', mode: 'quality', label: 'self-reflection' },
  adapt: { dim: 'growth', mode: 'quality', label: 'adaptability' },
  commitment: { dim: 'growth', mode: 'quality', label: 'sticking together in hard times' },
};

export const PRIORITY_ITEMS = [
  { key: 'love', label: 'Love & partner' }, { key: 'family', label: 'Family' }, { key: 'career', label: 'Career' },
  { key: 'money', label: 'Money & security' }, { key: 'freedom', label: 'Freedom' }, { key: 'friends', label: 'Friends' },
  { key: 'health', label: 'Health' }, { key: 'peace', label: 'Peace of mind' }, { key: 'experiences', label: 'Travel & experiences' },
  { key: 'growth', label: 'Personal growth' },
];

export const SECTIONS = [
  { key: 'values', title: 'Values & loyalty', emoji: '🛡️' },
  { key: 'goals', title: 'Life goals', emoji: '🎯' },
  { key: 'emotions', title: 'Emotions', emoji: '❤️' },
  { key: 'communication', title: 'Communication', emoji: '🗣️' },
  { key: 'conflict', title: 'Conflict & repair', emoji: '🩹' },
  { key: 'nature', title: 'Nature & mindset', emoji: '🧠' },
  { key: 'lifestyle', title: 'Lifestyle', emoji: '🏠' },
  { key: 'family', title: 'Family', emoji: '👨‍👩‍👧' },
  { key: 'money', title: 'Money', emoji: '💰' },
  { key: 'love', title: 'Love & affection', emoji: '🔥' },
  { key: 'growth', title: 'Respect & growth', emoji: '🌱' },
];

// ---------- the questions ----------
// c = choice (scenario), f = forced choice (A or B), s = 0-4 scale between two ends, r = ranking
const c = (id, section, text, options, kind = 'choice') => ({ id, section, type: kind, text, options: options.map(([label, set]) => ({ label, set })) });
const f = (id, section, text, a, b) => c(id, section, text, [a, b], 'forced');
const s = (id, section, text, left, right, axes) => ({ id, section, type: 'scale', text, left, right, axes });
const r = (id, section, text) => ({ id, section, type: 'rank', text, items: PRIORITY_ITEMS, axis: 'priorities' });

const Q_VALUES = [
  c('v1', 'values', 'A close friend asks you to cover for them with a small lie to their parents. You…', [
    ['Say no, kindly but firmly', { honesty: 92 }], ['Cover once, and tell them never again', { honesty: 55, loyalty: 70 }],
    ['Cover for them, that is what friends do', { honesty: 30, loyalty: 85 }], ['Make up something even better', { honesty: 10 }]]),
  f('v2', 'values', 'Which would hurt you more?', ['Someone close lying to protect your feelings', { honesty: 88 }], ['Someone close telling you a harsh truth', { honesty: 35 }]),
  s('v3', 'values', '“Being loyal means no flirting with anyone else. Not even jokingly.”', 'Disagree', 'Totally agree', { loyalty: 1 }),
  c('v4', 'values', 'Traditions and customs, for you:', [
    ['Keep them all, they are who we are', { tradition: 92 }], ['Keep the meaningful ones', { tradition: 65 }],
    ['A mix of old and new', { tradition: 45 }], ['We make our own rules', { tradition: 12 }]]),
  f('v5', 'values', 'A partner going through your phone is…', ['Never okay, trust means privacy', { privacy: 90 }], ['Fine if there is nothing to hide', { privacy: 25 }]),
  c('v6', 'values', 'You find out a close friend has been talking behind your back. You…', [
    ['Cut them off. Done.', { loyalty: 90, repair: 20, compromise: 25 }], ['Talk to them directly about it', { directness: 85, repair: 75, voicing: 85 }],
    ['Give them one more chance, quietly', { repair: 65, directness: 30 }], ['Ignore it and keep distance', { voicing: 15, directness: 15 }]]),
  r('v7', 'values', 'Put these in order: what matters most to you right now?'),
  s('v8', 'values', 'If you made a promise, you keep it even when it costs you.', 'Not always', 'Always', { loyalty: 1, commitment: 1 }),
];

const Q_GOALS = [
  c('g1', 'goals', 'Marriage, for you, is…', [['Definitely, in the next few years', { marriage: 92 }], ['Someday, with the right person', { marriage: 72 }], ['Not sure yet', { marriage: 45 }], ['Not for me', { marriage: 5 }]]),
  c('g2', 'goals', 'Children?', [['Yes, I want kids', { kids: 92 }], ['Maybe, open to it', { kids: 55 }], ['Not sure', { kids: 45 }], ['No, I do not want kids', { kids: 5 }]]),
  f('g3', 'goals', 'Pick one life:', ['₹3L a month, high-pressure metro life', { pace: 85, career: 80 }], ['₹1.5L a month, peaceful smaller city', { pace: 25, career: 40 }]),
  c('g4', 'goals', 'In 10 years you want to live…', [['Close to my family, in my home city', { settle: 15 }], ['In any big Indian city', { settle: 50 }], ['Abroad', { settle: 90 }], ['Wherever life takes me', { settle: 60, adapt: 80 }]]),
  s('g5', 'goals', 'My career comes first for the next few years.', 'Not really', 'Absolutely', { career: 1 }),
  c('g6', 'goals', 'Your 5-year plan is…', [['A detailed plan with milestones', { planner: 90, career: 75 }], ['A rough direction, no fixed plan', { planner: 45 }], ['Change the world, somehow', { idealism: 90, career: 70 }], ['A stable job and peace of mind', { idealism: 25, pace: 30 }]]),
];

const Q_EMOTIONS = [
  c('e1', 'emotions', 'Your partner is upset but says “I don’t want to talk right now.” You most likely…', [
    ['Give them space, check in a bit later', { giveSpace: 85, empathy: 80 }], ['Keep asking what is wrong', { giveSpace: 15, reassurance: 80 }],
    ['Feel hurt and go quiet too', { defensive: 65, expressive: 20, safety: 35 }], ['Leave them alone until they come to you', { giveSpace: 95, empathy: 50 }]]),
  s('e2', 'emotions', 'I need regular reassurance that I matter to the people close to me.', 'Rarely', 'A lot', { reassurance: 1 }),
  c('e3', 'emotions', 'How do you most naturally show you care?', [['Saying it in words', { loveLang: 'words' }], ['Spending real time together', { loveLang: 'time' }], ['Doing things for them', { loveLang: 'acts' }], ['Hugs, touch, being close', { loveLang: 'touch' }], ['Little gifts and surprises', { loveLang: 'gifts' }]]),
  s('e4', 'emotions', 'I find it easy to tell people exactly how I feel.', 'Hard', 'Very easy', { expressive: 1, voicing: 1 }),
  c('e5', 'emotions', 'A friend suddenly starts crying in front of you. You…', [['Sit with them and just listen', { empathy: 92, listening: 85 }], ['Try to fix the problem for them', { empathy: 60, logic: 75 }], ['Crack a joke to lighten things up', { humor: 85, empathy: 45 }], ['Feel awkward and not know what to do', { empathy: 30, safety: 35 }]]),
  c('e6', 'emotions', 'When someone close gets emotional during an argument, you usually…', [['Stay calm and comfort them', { safety: 90, empathy: 80 }], ['Get emotional too', { safety: 40, expressive: 85 }], ['Suggest a pause and continue later', { safety: 70, giveSpace: 70 }], ['Tell them to calm down', { safety: 15, defensive: 60 }]]),
  s('e7', 'emotions', 'When people I love are happy, I feel it as if it were my own happiness.', 'Not really', 'Completely', { empathy: 1 }),
  s('e8', 'emotions', 'If someone close needs a lot of reassurance from you, it feels…', 'Draining', 'Natural, happy to', { reassure: 1 }),
];

const Q_COMMUNICATION = [
  f('c1', 'communication', 'If something bothers you, you…', ['Say it right away', { directness: 85, voicing: 80 }], ['Wait for the right moment', { directness: 45, voicing: 60 }]),
  c('c2', 'communication', 'Your plans get changed without anyone asking you. You…', [['Say clearly “that bothered me”', { voicing: 90, directness: 75 }], ['Drop hints and hope they notice', { voicing: 30, directness: 25 }], ['Say nothing, it is not worth it', { voicing: 10, directness: 10 }], ['Get angry and let it out', { directness: 90, defensive: 75 }]]),
  s('c3', 'communication', 'In a conversation, I listen more than I talk.', 'I talk more', 'I listen more', { listening: 1 }),
  c('c4', 'communication', 'With someone you are close to, you like to talk…', [['All day, little messages', { texting: 90 }], ['A few times a day', { texting: 65 }], ['When there is something to say', { texting: 30 }], ['Rarely text, prefer meeting', { texting: 15 }]]),
  c('c5', 'communication', 'Your partner says you hurt them, but you think you didn’t. You…', [['Listen first to understand why', { listening: 92, defensive: 15, empathy: 80 }], ['Explain your side first', { defensive: 55, directness: 70 }], ['Say sorry just to end it', { apology: 55, voicing: 25 }], ['Get defensive', { defensive: 92, listening: 20 }]]),
  s('c6', 'communication', 'I’d rather hear a hard truth than a soft lie.', 'Soft lie', 'Hard truth', { honesty: 1 }),
];

const Q_CONFLICT = [
  c('f1', 'conflict', 'When you are stressed, you need…', [['Time alone first', { stressSpace: 90 }], ['To talk it out right away', { stressSpace: 10 }], ['A distraction, go out, do something', { stressSpace: 50 }], ['Someone to just be there, quietly', { stressSpace: 35 }]]),
  s('f2', 'conflict', 'If someone close needs space when they are stressed, how comfortable are you giving it?', 'Very hard for me', 'Completely fine', { giveSpace: 1 }),
  c('f3', 'conflict', 'After a fight, who usually reaches out first?', [['Me, almost always', { repair: 92 }], ['Whoever cools down first', { repair: 78 }], ['Usually them', { repair: 35 }], ['Nobody, we just move on', { repair: 15 }]]),
  s('f4', 'conflict', '“I’m sorry, I was wrong” comes easily to me.', 'Hard to say', 'Easy', { apology: 1, reflect: 1 }),
  c('f5', 'conflict', 'How long until you are ready to sort out a disagreement?', [['Minutes', { cooldown: 10 }], ['A few hours', { cooldown: 35 }], ['About a day', { cooldown: 65 }], ['Several days', { cooldown: 92 }]]),
  c('f6', 'conflict', 'In your last close relationship or friendship, arguments were mostly about…', [['Time and attention', { reassurance: 75, together: 75 }], ['Jealousy or trust', { jealousy: 75 }], ['Misunderstandings', { voicing: 40 }], ['We rarely argued', { cooldown: 40, repair: 60 }]]),
  f('f7', 'conflict', 'Which would bother you more?', ['They don’t spend enough time with you', { together: 85 }], ['They don’t give you enough personal space', { together: 15 }]),
  c('f8', 'conflict', 'In the middle of a fight, you are more likely to…', [['Stay respectful even when angry', { respectChoice: 90, safety: 80 }], ['Raise your voice, then calm down', { safety: 45, defensive: 55 }], ['Walk away to cool off', { stressSpace: 75, safety: 60 }], ['Bring up old issues', { repair: 25, defensive: 75 }]]),
];

const Q_NATURE = [
  c('n1', 'nature', 'Friday night, no plans. You…', [['Call the whole gang out', { extrovert: 90, social: 90, humor: 70 }], ['Movie and biryani with one close friend', { extrovert: 45, loyalty: 70, social: 45 }], ['Work on a side project', { career: 80, creativity: 70, extrovert: 30 }], ['Headphones, journal, deep thoughts', { extrovert: 10, social: 15, idealism: 70 }]]),
  s('n2', 'nature', 'I make decisions with my head more than my heart.', 'Heart', 'Head', { logic: 1 }),
  f('n3', 'nature', 'Trip style:', ['Every day planned', { planner: 88 }], ['Book tickets, figure it out there', { planner: 15 }]),
  c('n4', 'nature', 'In a group project you are the one who…', [['Takes charge and sets deadlines', { career: 80, directness: 70, planner: 75 }], ['Comes up with the wild ideas', { creativity: 90 }], ['Keeps everyone calm and together', { empathy: 75, safety: 75 }], ['Quietly does the work and delivers', { loyalty: 70, extrovert: 30 }]]),
  c('n5', 'nature', 'When things go wrong, your first thought is…', [['Everything happens for a reason', { idealism: 88 }], ['What’s the fix? Let’s go', { logic: 75, idealism: 35 }], ['I need to talk this out with someone', { expressive: 80, stressSpace: 20 }], ['Laugh now, cry later', { humor: 88 }]]),
  s('n6', 'nature', 'I can happily spend a whole day alone.', 'Not at all', 'Love it', { independent: 1, extrovert: -1 }),
  c('n7', 'nature', 'Your sense of humour is…', [['Memes and silly jokes', { humor: 85 }], ['Dry and sarcastic', { humor: 65 }], ['Witty one-liners', { humor: 75 }], ['I’m more the serious one', { humor: 20 }]]),
  f('n8', 'nature', 'You are more of a…', ['Dreamer with big ideas', { creativity: 85, idealism: 70 }], ['Builder who makes things work', { creativity: 30, logic: 70 }]),
  s('n9', 'nature', 'I change my mind when someone gives me a good reason.', 'Rarely', 'Easily', { openMind: 1 }),
];

const Q_LIFESTYLE = [
  c('l1', 'lifestyle', 'Your ideal weekend balance:', [['Mostly out with people', { social: 90 }], ['Half out, half home', { social: 55 }], ['Mostly at home', { social: 20 }], ['Depends on my mood', { social: 50, adapt: 65 }]]),
  s('l2', 'lifestyle', 'I would happily spend my savings on travel.', 'No way', 'Absolutely', { travel: 1 }),
  c('l3', 'lifestyle', 'You are an…', [['Early bird', { chrono: 15 }], ['Night owl', { chrono: 88 }], ['Somewhere in between', { chrono: 50 }]]),
  c('l4', 'lifestyle', 'Your food habits:', [['Pure vegetarian', { diet: 5 }], ['Eggetarian', { diet: 35 }], ['Non-veg sometimes', { diet: 65 }], ['Non-veg lover', { diet: 92 }]]),
  s('l5', 'lifestyle', 'My space is always neat and organised.', 'Messy', 'Spotless', { tidy: 1 }),
  f('l6', 'lifestyle', 'Phones at the dinner table:', ['Totally fine', { screens: 80 }], ['Not okay, be present', { screens: 15 }]),
];

const Q_FAMILY = [
  c('fa1', 'family', 'After marriage or a serious commitment, the ideal home is…', [['With my parents', { liveFamily: 90 }], ['Near my parents', { liveFamily: 62 }], ['On our own', { liveFamily: 20 }], ['Wherever works for both', { liveFamily: 50, compromise: 80 }]]),
  s('fa2', 'family', 'My family’s opinion matters a lot in my big decisions.', 'A little', 'A lot', { familySay: 1 }),
  c('fa3', 'family', 'Your family and partner disagree on something big. You…', [['Side with my family', { familySay: 90, boundaries: 20 }], ['Find a middle path for everyone', { boundaries: 65, compromise: 85 }], ['Side with my partner', { familySay: 30, boundaries: 85 }], ['Stay out of it', { voicing: 20 }]]),
  s('fa4', 'family', 'A couple should keep some things private from their families.', 'Disagree', 'Agree', { boundaries: 1 }),
];

const Q_MONEY = [
  f('m1', 'money', 'Unexpected ₹10,000 bonus:', ['Weekend trip!', { spender: 85, travel: 75 }], ['Straight to savings', { spender: 20, moneyPlan: 75 }]),
  c('m2', 'money', 'Money in a couple should be…', [['Fully shared', { pool: 92 }], ['Shared for the home, rest personal', { pool: 60 }], ['Mostly separate', { pool: 22 }], ['Whoever earns more pays more', { pool: 50 }]]),
  s('m3', 'money', 'I know where every rupee I spend goes.', 'No idea', 'Every rupee', { moneyPlan: 1, spender: -1 }),
  c('m4', 'money', 'Your partner wants to buy something expensive you think is unnecessary. You…', [['It’s their money, their choice', { respectChoice: 88 }], ['Talk about a budget together', { moneyPlan: 75, compromise: 85 }], ['Try to stop them', { respectChoice: 25 }], ['Buy it with them anyway', { spender: 85 }]]),
];

const Q_LOVE = [
  c('a1', 'love', 'Holding hands in public is…', [['Love it', { pda: 90 }], ['Sometimes', { pda: 55 }], ['Private only', { pda: 15 }]]),
  s('a2', 'love', 'Romance and surprises matter a lot to me.', 'Not much', 'A lot', { romance: 1 }),
  s('a3', 'love', 'Feeling desired by my partner is very important to me.', 'Not much', 'Very', { attraction: 1 }),
  s('a4', 'love', 'I get jealous easily.', 'Never', 'Very easily', { jealousy: 1 }),
];

const Q_GROWTH = [
  c('r1', 'growth', 'Your partner gets a dream job in another city. You…', [['Support it, we’ll make it work', { supportDreams: 95, adapt: 85 }], ['Support it but feel hurt', { supportDreams: 60 }], ['Ask them to say no', { supportDreams: 15, respectChoice: 25 }], ['Move with them', { supportDreams: 88, adapt: 95 }]]),
  s('r2', 'growth', 'When someone points out my mistake, I work on it.', 'I get annoyed', 'I work on it', { reflect: 1, defensive: -1 }),
  f('r3', 'growth', 'When something matters more to the other person…', ['I adjust this time, they adjust next time', { compromise: 88 }], ['I usually stick to what I want', { compromise: 25 }]),
  c('r4', 'growth', 'Money troubles for 6 months, things get hard. You…', [['Face it together, no question', { commitment: 95 }], ['Stay, but feel stuck', { commitment: 62 }], ['Need a break to think', { commitment: 30 }]]),
  s('r5', 'growth', 'People change, and I’m okay growing in new directions together.', 'Unsettling', 'Exciting', { adapt: 1, openMind: 1 }),
  c('r6', 'growth', 'Your partner wants a night out with friends without you. You feel…', [['Happy for them, enjoy!', { respectSpace: 92, jealousy: 15 }], ['Okay, but I want details', { respectSpace: 60, jealousy: 45 }], ['I’d rather come along', { respectSpace: 35, together: 80 }], ['Not okay with it', { respectSpace: 10, jealousy: 85 }]]),
];

export const QUESTIONS = [...Q_VALUES, ...Q_GOALS, ...Q_EMOTIONS, ...Q_COMMUNICATION, ...Q_CONFLICT, ...Q_NATURE, ...Q_LIFESTYLE, ...Q_FAMILY, ...Q_MONEY, ...Q_LOVE, ...Q_GROWTH];
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);

// ---------- building a person's Soul DNA ----------
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Which answers are valid for a question (used when saving progress). */
export function validAnswer(q, v) {
  if (!q) return false;
  if (q.type === 'scale') return Number.isInteger(v) && v >= 0 && v <= 4;
  if (q.type === 'rank') return Array.isArray(v) && v.length === q.items.length && new Set(v).size === v.length && v.every((k) => q.items.some((i) => i.key === k));
  return Number.isInteger(v) && v >= 0 && v < q.options.length;
}

/**
 * answers: { [questionId]: optionIndex | scale 0-4 | [ranked keys] }
 * → { axes: { axis: 0-100 | category }, priorities: [keys], spread: { axis: max-min } }
 */
export function buildAxes(answers) {
  const contrib = {};
  const put = (axis, v) => { (contrib[axis] ||= []).push(v); };
  let priorities = null;
  for (const q of QUESTIONS) {
    const v = answers[q.id];
    if (v === undefined || v === null || !validAnswer(q, v)) continue;
    if (q.type === 'rank') { priorities = v; continue; }
    if (q.type === 'scale') {
      for (const [axis, dir] of Object.entries(q.axes)) put(axis, dir > 0 ? v * 25 : 100 - v * 25);
      continue;
    }
    for (const [axis, val] of Object.entries(q.options[v].set)) put(axis, val);
  }
  const axes = {}; const spread = {};
  for (const [axis, vals] of Object.entries(contrib)) {
    if (typeof vals[0] === 'string') { axes[axis] = vals[vals.length - 1]; continue; }
    axes[axis] = Math.round(avg(vals));
    if (vals.length > 1) spread[axis] = Math.max(...vals) - Math.min(...vals);
  }
  return { axes, priorities, spread };
}

// The 8 classic traits (kept for Soul type names and the Discover personality filters)
const TRAIT_FROM_AXIS = { empathy: 'empathy', ambition: 'career', humor: 'humor', loyalty: 'loyalty', creativity: 'creativity', conflict_style: 'directness', mentality: 'idealism', nature: 'extrovert' };
export const traitsFromAxes = (axes) => Object.fromEntries(Object.entries(TRAIT_FROM_AXIS).map(([t, a]) => [t, clamp(Math.round(axes[a] ?? 50), 5, 95)]));

/** Answers that pull against each other: shown gently as "tensions", never as "you lied". */
export function tensions(dna) {
  const a = dna.axes; const out = [];
  const T = (text) => out.push(text);
  if ((a.together ?? 50) >= 70 && (a.independent ?? 50) >= 70) T('You want lots of together-time and lots of independence. Tell people which one wins when they clash.');
  if ((a.jealousy ?? 0) >= 65 && (a.privacy ?? 0) >= 70) T('You value your own privacy a lot, and you also get jealous easily. Both are normal; naming it helps.');
  if ((a.honesty ?? 50) >= 75 && (a.loyalty ?? 50) >= 80 && (dna.spread.honesty ?? 0) >= 50) T('Honesty matters to you, but loyalty to friends sometimes wins over it.');
  if ((a.career ?? 50) >= 80 && (a.marriage ?? 0) >= 85 && (a.pace ?? 50) >= 75) T('Big career plans and settling down soon. Worth talking about timing early.');
  if ((a.voicing ?? 50) <= 35 && (a.reassurance ?? 50) >= 70) T('You need reassurance, but often keep what you feel to yourself. People may not know what you need.');
  for (const [axis, sp] of Object.entries(dna.spread)) {
    if (sp >= 70 && AXES[axis] && out.length < 5) T(`Your answers about ${AXES[axis].label} point in different directions. It may depend on the person or the situation.`);
  }
  return out.slice(0, 5);
}

/** Your own DNA, per dimension: where you sit, in plain words. */
const SPECTRUM = {
  extrovert: ['Introvert', 'Extrovert'], logic: ['Heart-led', 'Head-led'], planner: ['Spontaneous', 'Planner'], idealism: ['Realist', 'Optimist'],
  creativity: ['Builder', 'Dreamer'], tradition: ['Modern', 'Traditional'], spender: ['Saver', 'Spender'], social: ['Homebody', 'Social'],
  stressSpace: ['Stressed: talks it out', 'Stressed: goes quiet'], together: ['Independent', 'Together-time'], directness: ['Gentle', 'Direct'], career: ['Balanced life', 'Career-first'],
};
export function selfView(dna) {
  const a = dna.axes;
  const skills = ['empathy', 'listening', 'voicing', 'repair', 'apology', 'safety', 'compromise', 'reflect', 'adapt', 'commitment', 'respectChoice', 'supportDreams', 'openMind'];
  const strengths = skills.filter((k) => (a[k] ?? 0) >= 75).sort((x, y) => a[y] - a[x]).slice(0, 4).map((k) => AXES[k].label);
  const dims = Object.entries(DIMS).map(([key, d]) => {
    const own = Object.entries(AXES).filter(([, ax]) => ax.dim === key && ['quality', 'inverse'].includes(ax.mode)).map(([k, ax]) => (ax.mode === 'inverse' ? 100 - (a[k] ?? 50) : a[k] ?? 50));
    return { key, label: d.label, emoji: d.emoji, strength: own.length ? Math.round(avg(own)) : null };
  });
  const spectrum = Object.entries(SPECTRUM).filter(([k]) => a[k] != null).map(([k, [lo, hi]]) => ({ key: k, left: lo, right: hi, value: a[k] }));
  return { dims, spectrum, strengths, priorities: dna.priorities, tensions: tensions(dna) };
}

// ---------- comparing two people ----------
function priorityScore(pa, pb) {
  if (!pa || !pb) return null;
  // Spearman footrule on the top of the list matters most
  let dist = 0; let max = 0;
  pa.forEach((k, i) => { const j = pb.indexOf(k); const w = 1 / (1 + Math.min(i, j)); dist += Math.abs(i - j) * w; max += (pa.length - 1) * w; });
  return clamp(Math.round(100 - (dist / max) * 140));
}

function axisScore(key, ax, A, B) {
  const a = A.axes[key]; const b = B.axes[key];
  if (ax.mode === 'rank') return priorityScore(A.priorities, B.priorities);
  if (a == null || b == null) return null;
  if (ax.mode === 'cat') return a === b ? 100 : 68;
  if (ax.mode === 'quality') return Math.round(0.6 * Math.min(a, b) + 0.4 * ((a + b) / 2));
  if (ax.mode === 'inverse') { const x = 100 - a; const y = 100 - b; return Math.round(0.6 * Math.min(x, y) + 0.4 * ((x + y) / 2)); }
  const d = Math.abs(a - b);
  if (ax.mode === 'complement') return clamp(Math.round(100 - d * 0.35));
  if (ax.mode === 'deal') return d >= 60 ? (ax.soft ? 35 : 10) : clamp(Math.round(100 - d * 1.1));
  // similar: each person's tolerance for the other's way softens the gap
  const tol = ax.tol ? (avg([A.axes[ax.tol], B.axes[ax.tol]].filter((x) => x != null)) ?? 50) / 100 : 0;
  return clamp(Math.round(100 - d * (ax.k ?? 1) * (1 - 0.6 * tol)));
}

const TYPE_NAMES = {
  similar: { couple: 'Similarity-based couple', friendship: 'Two of a kind', partnership: 'Aligned partners', duo: 'In-sync duo' },
  complement: { couple: 'Complementary couple', friendship: 'Opposites that click', partnership: 'Complementary partners', duo: 'Complementary duo' },
  growth: { couple: 'Growth-oriented couple', friendship: 'Grow-together friends', partnership: 'Growth-minded partners', duo: 'Push-each-other duo' },
  friction: { couple: 'Some friction areas', friendship: 'Some friction areas', partnership: 'Some friction areas', duo: 'Some friction areas' },
  balanced: { couple: 'Balanced couple', friendship: 'Easy-going friendship', partnership: 'Balanced partners', duo: 'Balanced duo' },
  basics: { couple: 'Big differences on the basics', friendship: 'Different worlds', partnership: 'Different directions', duo: 'Different directions' },
};
const TYPE_LINES = {
  similar: 'You think alike and want similar things, so being together feels easy.',
  complement: "You're quite different, but you have what it takes to understand and accommodate each other.",
  growth: 'Several differences, but you are both willing to talk, adjust and grow.',
  friction: 'You may click in some ways, but differences could turn into friction if you don’t talk about them.',
  balanced: 'A steady mix of things in common and things to learn from each other.',
  basics: 'You want different things on something important. Talk about it early.',
};

/** Predicted compatibility for one relation type. */
export function compat(A, B, relation = 'friendship') {
  const rel = RELATIONS[relation] || RELATIONS.friendship;
  const perDim = {};
  const dealbreakers = [];
  for (const [key, ax] of Object.entries(AXES)) {
    if (ax.only && !ax.only.includes(relation)) continue;
    if (!rel.weights[ax.dim]) continue;
    const sc = axisScore(key, ax, A, B);
    if (sc == null) continue;
    (perDim[ax.dim] ||= []).push([sc, ax.w ?? 1]);
    if (ax.mode === 'deal' && sc <= 35) dealbreakers.push(ax.label);
  }
  const dims = {};
  for (const [dim, list] of Object.entries(perDim)) {
    const w = list.reduce((s2, [, x]) => s2 + x, 0);
    dims[dim] = Math.round(list.reduce((s2, [sc, x]) => s2 + sc * x, 0) / w);
  }
  const weighted = (keys) => {
    let tw = 0; let sum = 0;
    for (const k of keys) if (dims[k] != null) { tw += rel.weights[k]; sum += dims[k] * rel.weights[k]; }
    return tw ? Math.round(sum / tw) : null;
  };
  const dimKeys = Object.keys(dims);
  let overall = weighted(dimKeys);
  const natural = weighted(dimKeys.filter((k) => DIMS[k].side === 'natural'));
  const relationship = weighted(dimKeys.filter((k) => DIMS[k].side === 'relationship'));
  if (dealbreakers.length) overall = Math.min(overall, 55);

  const ranked = dimKeys.map((k) => ({ key: k, label: DIMS[k].label, emoji: DIMS[k].emoji, score: dims[k], weight: rel.weights[k] })).sort((x, y) => y.score - x.score);
  const strengths = ranked.filter((d) => d.score >= 78).slice(0, 3);
  const friction = ranked.filter((d) => d.score < 65).slice(-2).reverse();
  const growth = dims.growth ?? 50;
  let kind = 'balanced';
  if (dealbreakers.length) kind = 'basics';
  else if (natural >= 78 && relationship >= 68) kind = 'similar';
  else if (relationship >= 78 && natural < 72) kind = 'complement';
  else if (growth >= 75 && natural < 70) kind = 'growth';
  else if (overall < 75 && (relationship < 62 || friction.length >= 2)) kind = 'friction';
  return {
    relation, relationLabel: rel.label, emoji: rel.emoji,
    overall, natural, relationship,
    type: TYPE_NAMES[kind][rel.pair], typeKey: kind, typeLine: TYPE_LINES[kind],
    dims: ranked, strengths, friction, dealbreakers,
  };
}

/** Headline numbers for every relation type (free to see). */
export function compatAll(A, B) {
  return Object.fromEntries(RELATION_KEYS.map((k) => {
    const c2 = compat(A, B, k);
    return [k, { overall: c2.overall, natural: c2.natural, relationship: c2.relationship, type: c2.type, label: c2.relationLabel, emoji: c2.emoji }];
  }));
}

/** The quiz as sent to the app: no scoring weights, so it can't be gamed. */
export const publicQuestions = () => QUESTIONS.map((q) => ({
  id: q.id, section: q.section, type: q.type, text: q.text,
  ...(q.options ? { options: q.options.map((o) => o.label) } : {}),
  ...(q.type === 'scale' ? { left: q.left, right: q.right } : {}),
  ...(q.type === 'rank' ? { items: q.items } : {}),
}));

/** Deterministic full answer set (demo accounts and tests). Different k → a different person. */
export function sampleAnswers(k = 0) {
  const out = {};
  QUESTIONS.forEach((q, i) => {
    if (q.type === 'scale') out[q.id] = (i + k) % 5;
    else if (q.type === 'rank') { const keys = q.items.map((x) => x.key); const s = k % keys.length; out[q.id] = [...keys.slice(s), ...keys.slice(0, s)]; }
    else out[q.id] = (i + k) % q.options.length;
  });
  return out;
}
