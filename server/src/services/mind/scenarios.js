// Soul DNA v5: the games. Seven short tap games (plus 3 taps about what you want) replace the long scenario quiz.
// Each game is built on a published psychology instrument (see docs/SOUL-DNA-GAMES.md); the item wording is our
// own unless the source is public domain (IPIP). Every option quietly moves the person's mind model on one or
// more TRAITS (0-100). Nobody sees these numbers: the app only gets the text, emoji and kind of each item.
//
// Item kinds (what the app shows, and what an answer looks like)
//   pick       one of a few chips                      { o }
//   mostleast  4 tiles: one "Most me", one "Least me"  { m, l }        (forced-choice Big Five)
//   react      one of 4-5 reactions                    { o }           (gut-reaction time noted)
//   vs         two cards + a firmness dial             { o, f }        f: 0 flexible, 1 firm, 2 non-negotiable
//   loyal      one of 4 answers + the firmness dial    { o, f }        (partner or friend version)
//   check      a reworded repeat of an earlier item    { o }           (consistency; no dial)
//   me         chips that describe you                 { s: [keys] }
//   boxes      chips for a partner: Must / Never       { must: [keys], never: [keys] }   (the rest = flexible)
//   day        one icon per time slot                  { o }
// Any choice answer may also carry ms (time to answer) and ch (times changed).
//
// TRAITS (what we model)
//  intent       intent_serious, intent_pace, intent_family
//  personality  b_E, b_A, b_C, b_O, b_S (Big Five) + energy, curiosity, depth, humor, dec_head, dec_lead
//  emotion      att_anx, att_avo (attachment), r_seek, r_withdraw, r_heat, read_sense, rec_speed
//  values       v_family, v_freedom, v_security, v_ambition, v_love, v_honesty, v_tradition,
//               gt_money, gt_family, gt_home, gt_career (how firmly they hold that area), home_dir, dec_risk
//  loyalty      integ, loyal, boundary, jealousy, read_trust
//  flex         gt_social
//  rhythm       chrono (early bird → night owl), adventure
//  conflict     r_fight, r_fix, rec_apology, rec_forgive

export const LAYERS = [
  { key: 'intent', title: 'What you want', emoji: '🎯', game: 'Before we start' },
  { key: 'personality', title: 'Which one is you?', emoji: '🪞', game: 'Game 1' },
  { key: 'emotion', title: 'React', emoji: '💗', game: 'Game 2' },
  { key: 'values', title: 'Which matters more?', emoji: '🛡️', game: 'Game 3' },
  { key: 'loyalty', title: 'Loyalty & commitment', emoji: '🔒', game: 'Game 4' },
  { key: 'flex', title: 'Three boxes', emoji: '📦', game: 'Game 5' },
  { key: 'rhythm', title: 'Build my day', emoji: '🗓️', game: 'Game 6' },
  { key: 'conflict', title: 'Your move', emoji: '⚡', game: 'Game 7' },
];

export const TRAITS = {
  intent_serious: 'intent', intent_pace: 'intent', intent_family: 'intent',
  b_E: 'personality', b_A: 'personality', b_C: 'personality', b_O: 'personality', b_S: 'personality',
  energy: 'personality', curiosity: 'personality', depth: 'personality', humor: 'personality', dec_head: 'personality', dec_lead: 'personality',
  att_anx: 'emotion', att_avo: 'emotion', r_seek: 'emotion', r_withdraw: 'emotion', r_heat: 'emotion', read_sense: 'emotion', rec_speed: 'emotion',
  v_family: 'values', v_freedom: 'values', v_security: 'values', v_ambition: 'values', v_love: 'values', v_honesty: 'values', v_tradition: 'values',
  gt_money: 'values', gt_family: 'values', gt_home: 'values', gt_career: 'values', home_dir: 'values', dec_risk: 'values',
  integ: 'loyalty', loyal: 'loyalty', boundary: 'loyalty', jealousy: 'loyalty', read_trust: 'loyalty',
  gt_social: 'flex',
  chrono: 'rhythm', adventure: 'rhythm',
  r_fight: 'conflict', r_fix: 'conflict', rec_apology: 'conflict', rec_forgive: 'conflict',
};

/** The firmness dial → how firmly an area is held (give and take), and how much the answer counts. */
export const FIRM = { level: [25, 60, 90], weight: [0.9, 1.1, 1.35], labels: ['Flexible', 'Firm', 'Non-negotiable'] };

/** Deal-breaker chips (game 5). */
export const CHIPS = [
  { key: 'smoke', label: 'Smokes' }, { key: 'drink', label: 'Drinks' }, { key: 'pets', label: 'Has pets' },
  { key: 'kids', label: 'Wants kids' }, { key: 'family_home', label: 'Lives with family after marriage' },
  { key: 'relocate', label: 'Willing to move cities' }, { key: 'veg', label: 'Vegetarian' },
  { key: 'faith', label: 'Practises a faith' }, { key: 'nightlife', label: 'Loves night-outs' },
];
export const CHIP_KEYS = CHIPS.map((c) => c.key);
/** What describing yourself with a chip says about you. */
export const CHIP_SET = { relocate: { home_dir: 80 }, family_home: { v_family: 72, home_dir: 20 }, faith: { v_tradition: 66 }, nightlife: { energy: 78 } };

// ---------- the items ----------
// o(emoji, label, set, extra)  extra: { key } for intent picks, { s } strictness 0-3 for loyalty, { tag } for analysis
const o = (emoji, label, set, extra = {}) => ({ emoji, label, set, ...extra });
const it = (id, layer, kind, text, options, more = {}) => ({ id, layer, kind, text, options, ...more });

export const SCENARIOS = [
  // ---------- before we start: intent (one screen, 3 picks) ----------
  it('it_look', 'intent', 'pick', 'What are you looking for?', [
    o('💍', 'Marriage', { intent_serious: 95, intent_family: 78, intent_pace: 70 }, { key: 'marriage' }),
    o('❤️', 'A serious relationship', { intent_serious: 80, intent_pace: 55 }, { key: 'serious' }),
    o('🤝', 'Friendship', { intent_serious: 40, intent_pace: 40 }, { key: 'friendship' }),
    o('🧭', 'Still exploring', { intent_serious: 25, intent_pace: 30 }, { key: 'exploring' })], { screen: 'intent' }),
  it('it_time', 'intent', 'pick', 'When would you like to settle down?', [
    o('⏱️', 'Within 1 year', { intent_pace: 90, intent_serious: 85 }, { key: 'soon' }),
    o('📅', 'In 1 to 3 years', { intent_pace: 55, intent_serious: 65 }, { key: 'later' }),
    o('🌊', 'No rush', { intent_pace: 25 }, { key: 'norush' }),
    o('🚫', 'Not for me', { intent_pace: 10, intent_family: 20, intent_serious: 30 }, { key: 'never' })], { screen: 'intent' }),
  it('it_kids', 'intent', 'pick', 'Kids someday?', [
    o('👶', 'Want kids', { intent_family: 92, v_family: 70 }, { key: 'want' }),
    o('🙅', "Don't want kids", { intent_family: 8 }, { key: 'no' }),
    o('🤔', 'Open', { intent_family: 50 }, { key: 'open' })], { screen: 'intent' }),

  // ---------- game 1: which one is you? (forced-choice Big Five; each trait 4 times) ----------
  it('pe1', 'personality', 'mostleast', 'At a party, which one is you?', [
    o('🕺', 'In the middle, the life of the party', { b_E: 85, energy: 82 }, { tag: 'E' }),
    o('🫶', 'Making sure the new person feels included', { b_A: 85, read_sense: 72 }, { tag: 'A' }),
    o('⏰', 'Arrived on time, left on time', { b_C: 85, dec_head: 68 }, { tag: 'C' }),
    o('💭', 'Deep talk about ideas with a stranger', { b_O: 85, depth: 80, curiosity: 70 }, { tag: 'O' })]),
  it('pe2', 'personality', 'mostleast', 'Planning a trip, which one is you?', [
    o('🗂️', 'Plan ready weeks ahead', { b_C: 85, dec_head: 72, dec_risk: 25 }, { tag: 'C' }),
    o('🧭', 'Somewhere new nobody has been', { b_O: 85, curiosity: 85, adventure: 78 }, { tag: 'O' }),
    o('👥', 'Whatever the group wants', { b_A: 85, dec_lead: 25 }, { tag: 'A' }),
    o('😌', 'Flight delayed? I stay calm', { b_S: 85, r_heat: 18, rec_speed: 72 }, { tag: 'S' })]),
  it('pe3', 'personality', 'mostleast', 'Bad news day, which one is you?', [
    o('🧘', 'Stay calm and handle it', { b_S: 85, r_heat: 20, rec_speed: 70 }, { tag: 'S' }),
    o('📞', 'Call friends right away', { b_E: 85, energy: 75, r_seek: 70 }, { tag: 'E' }),
    o('🤲', 'Still check on how others are', { b_A: 85, read_sense: 78 }, { tag: 'A' }),
    o('📝', 'Make a plan to fix it', { b_C: 85, r_fix: 75, dec_head: 70 }, { tag: 'C' })]),
  it('pe4', 'personality', 'mostleast', 'Free weekend, which one is you?', [
    o('🎨', 'Try something new: a class, a place, a cuisine', { b_O: 85, curiosity: 85, adventure: 65 }, { tag: 'O' }),
    o('🎉', 'Out with a big group', { b_E: 85, energy: 85 }, { tag: 'E' }),
    o('✅', 'Finish my to-do list first', { b_C: 85, v_ambition: 62 }, { tag: 'C' }),
    o('☀️', 'Enjoy it without overthinking Monday', { b_S: 85, r_heat: 25, humor: 65 }, { tag: 'S' })]),
  it('pe5', 'personality', 'mostleast', 'In a team, which one is you?', [
    o('📣', 'Speak up and lead', { b_E: 85, dec_lead: 85 }, { tag: 'E' }),
    o('🕊️', 'Keep the peace', { b_A: 85, rec_forgive: 70, r_fight: 20 }, { tag: 'A' }),
    o('💡', 'Bring the wild idea', { b_O: 85, curiosity: 80, dec_risk: 70 }, { tag: 'O' }),
    o('⚓', 'Steady under pressure', { b_S: 85, r_heat: 15, rec_speed: 68 }, { tag: 'S' })]),

  // ---------- game 2: react (attachment + emotion regulation; gut-reaction time) ----------
  it('em1', 'emotion', 'react', "Your partner hasn't replied in 6 hours.", [
    o('😌', "They're busy, no worries", { att_anx: 18, att_avo: 30, read_trust: 72 }, { tag: 'secure' }),
    o('😟', 'Something feels wrong…', { att_anx: 80, r_seek: 65 }, { tag: 'anxious' }),
    o('📱', 'Text again… and again', { att_anx: 92, r_seek: 85, r_heat: 60 }, { tag: 'anxious' }),
    o('🙄', "Fine, I won't reply either", { att_avo: 70, r_withdraw: 70, r_heat: 55 }, { tag: 'avoidant' }),
    o('🤷', "Didn't even notice", { att_avo: 75, att_anx: 10 }, { tag: 'avoidant' })]),
  it('em2', 'emotion', 'react', 'You had a terrible day. Your partner asks, “What’s wrong?”', [
    o('🗣️', 'Tell them everything', { att_avo: 15, r_seek: 80, read_sense: 60 }, { tag: 'expressive' }),
    o('🙂', '“I’m fine.”', { att_avo: 75, r_withdraw: 75 }, { tag: 'suppress' }),
    o('🤗', 'No talking, just a hug', { att_avo: 25, r_seek: 65 }, { tag: 'secure' }),
    o('🚪', 'I need some space first', { att_avo: 60, r_withdraw: 82 }, { tag: 'avoidant' }),
    o('😤', 'Snap at them', { r_heat: 85, r_fight: 70 }, { tag: 'reactive' })]),
  it('em3', 'emotion', 'react', 'Early on, your partner says “I love you” first.', [
    o('🥰', 'Say it back happily', { att_avo: 15, att_anx: 30, intent_pace: 70 }, { tag: 'secure' }),
    o('😳', 'Freeze', { att_avo: 65 }, { tag: 'avoidant' }),
    o('😬', 'Feel pressured and pull back', { att_avo: 90, r_withdraw: 75, intent_pace: 15 }, { tag: 'avoidant' }),
    o('🥺', '“Do you really mean it?”', { att_anx: 80 }, { tag: 'anxious' }),
    o('😊', 'Smile, say it when I’m ready', { att_avo: 40, att_anx: 20, intent_pace: 40 }, { tag: 'secure' })]),
  it('em4', 'emotion', 'react', 'Your weekend plans get cancelled last minute.', [
    o('🔁', 'Find a new plan', { rec_speed: 85, r_fix: 70, r_heat: 20 }, { tag: 'reappraise' }),
    o('😑', 'Hide that I’m upset', { att_avo: 60, r_withdraw: 65, rec_speed: 40 }, { tag: 'suppress' }),
    o('😢', 'Feel it, then move on', { rec_speed: 65, r_heat: 35 }, { tag: 'expressive' }),
    o('😠', 'Stay annoyed all day', { r_heat: 80, rec_speed: 15 }, { tag: 'reactive' }),
    o('🙃', 'Make a joke about it', { humor: 85, rec_speed: 80 }, { tag: 'reappraise' })]),
  it('em5', 'emotion', 'react', 'Your partner wants to spend every evening together.', [
    o('😍', 'Love it', { att_avo: 10, att_anx: 55, energy: 60 }, { tag: 'close' }),
    o('🙂', 'Nice, but I need me-time too', { att_avo: 45, att_anx: 20 }, { tag: 'secure' }),
    o('😰', 'Feels suffocating', { att_avo: 90, v_freedom: 80 }, { tag: 'avoidant' }),
    o('🥺', 'Finally, someone who wants me', { att_anx: 88, r_seek: 75 }, { tag: 'anxious' }),
    o('🤝', 'Let’s plan it together', { att_avo: 30, att_anx: 25, r_fix: 60 }, { tag: 'secure' })]),

  // ---------- game 3: which matters more? (Schwartz values, opposite poles) + firmness dial ----------
  it('va1', 'values', 'vs', 'Which matters more to you?', [
    o('✈️', 'A dream job abroad', { v_ambition: 80, home_dir: 85, v_freedom: 65 }),
    o('🏡', 'Staying close to family', { v_family: 85, home_dir: 15 })], { firm: 'gt_home' }),
  it('va2', 'values', 'vs', 'Which matters more to you?', [
    o('💰', 'Big pay, long hours', { v_ambition: 85, v_security: 60 }),
    o('🌿', 'Less pay, more life', { v_love: 72, v_ambition: 30 })], { firm: 'gt_career' }),
  it('va3', 'values', 'vs', 'Which matters more to you?', [
    o('🦋', 'Live by my own rules', { v_freedom: 88, v_tradition: 15 }),
    o('🪔', 'Respect how things have always been done', { v_tradition: 88, v_freedom: 30 })], { firm: 'gt_family' }),
  it('va4', 'values', 'vs', 'Which matters more to you?', [
    o('🪞', 'Tell a hard truth', { v_honesty: 90 }),
    o('🕊️', 'Keep the peace with a small white lie', { v_honesty: 30, read_sense: 60 })]),
  it('va5', 'values', 'vs', 'Which matters more to you?', [
    o('🎒', 'Spend on experiences', { curiosity: 70, adventure: 75, v_security: 30, dec_risk: 65 }),
    o('🏦', 'Save for security', { v_security: 88, dec_risk: 20 })], { firm: 'gt_money' }),
  it('va6', 'values', 'vs', 'Which matters more to you?', [
    o('👨‍👩‍👧', 'My family’s approval of my partner matters', { v_tradition: 80, v_family: 80 }),
    o('🙋', 'My choice, my life', { v_freedom: 85, v_tradition: 25 })], { firm: 'gt_family' }),
  it('va7', 'values', 'check', 'One more, quickly.', [
    o('🧳', 'Move cities for my partner’s career', { home_dir: 80, v_love: 65 }),
    o('🏠', 'Stay for my family', { v_family: 80, home_dir: 20 })], { checks: 'va1' }),

  // ---------- game 4: loyalty & commitment (Investment Model, jealousy research) + firmness dial ----------
  // s = how strict the line is (0 relaxed → 3 strict). Two people's lines are matched, never judged.
  it('lp1', 'loyalty', 'loyal', 'An ex texts: “Happy birthday, I miss talking to you.”', [
    o('', 'Reply warmly', { integ: 35, boundary: 80 }, { s: 0 }),
    o('', 'Reply politely and tell my partner', { integ: 85, boundary: 30, read_trust: 65 }, { s: 2 }),
    o('', 'Ignore it', { integ: 75, boundary: 25 }, { s: 2 }),
    o('', 'Block them', { integ: 90, boundary: 10, jealousy: 65 }, { s: 3 })], { variant: 'partner', line: 'an ex getting in touch' }),
  it('lp2', 'loyalty', 'loyal', 'Your partner asks to see your phone.', [
    o('', 'Hand it over', { read_trust: 80, jealousy: 40 }, { s: 3 }),
    o('', 'Okay, but I’d feel uneasy', { read_trust: 60 }, { s: 2 }),
    o('', 'No, privacy matters', { read_trust: 45, v_freedom: 70 }, { s: 0 }),
    o('', 'Ask why first', { read_trust: 50, dec_head: 60 }, { s: 1 })], { variant: 'partner', line: 'phone privacy' }),
  it('lp3', 'loyalty', 'loyal', 'Someone attractive at work flirts with you.', [
    o('', 'Shut it down', { integ: 92, boundary: 10 }, { s: 3 }),
    o('', 'Harmless fun', { integ: 30, boundary: 90 }, { s: 0 }),
    o('', 'Tell my partner', { integ: 80, boundary: 30, v_honesty: 75 }, { s: 2 }),
    o('', 'Depends on the person', { integ: 50, boundary: 60 }, { s: 1 })], { variant: 'partner', line: 'flirting' }),
  it('lp4', 'loyalty', 'loyal', 'Your partner chats daily with a close friend of the opposite gender.', [
    o('', 'Totally fine', { jealousy: 10, read_trust: 80 }, { s: 0 }),
    o('', 'Fine if I know them', { jealousy: 35, read_trust: 60 }, { s: 1 }),
    o('', 'Makes me uneasy', { jealousy: 70 }, { s: 2 }),
    o('', 'Not okay', { jealousy: 92, read_trust: 30 }, { s: 3 })], { variant: 'partner', line: 'close friends of the opposite gender' }),
  it('lp5', 'loyalty', 'loyal', 'Your relationship hits a rough patch for months.', [
    o('', 'Work through it together', { loyal: 92, rec_forgive: 70 }, { s: 3 }),
    o('', 'Take a break', { loyal: 60 }, { s: 2 }),
    o('', 'Start looking elsewhere', { loyal: 10, integ: 15 }, { s: 0 }),
    o('', 'End it cleanly', { loyal: 35, v_honesty: 70 }, { s: 1 })], { variant: 'partner', line: 'sticking together in hard times' }),
  it('lp6', 'loyalty', 'loyal', 'Someone badmouths your partner when they’re not around.', [
    o('', 'Defend them right away', { loyal: 88 }, { s: 3 }),
    o('', 'Stay quiet', { loyal: 45 }, { s: 1 }),
    o('', 'Agree a little', { loyal: 15 }, { s: 0 }),
    o('', 'Tell my partner later', { loyal: 60, v_honesty: 70 }, { s: 2 })], { variant: 'partner', line: 'standing up for each other' }),
  it('lp7', 'loyalty', 'loyal', 'You made a mistake your partner will never find out about.', [
    o('', 'Confess anyway', { v_honesty: 92, integ: 80, rec_apology: 85 }, { s: 3 }),
    o('', 'Confess if asked', { v_honesty: 65 }, { s: 2 }),
    o('', 'Keep it to myself', { v_honesty: 20, integ: 40 }, { s: 0 }),
    o('', 'Depends how big', { v_honesty: 50 }, { s: 1 })], { variant: 'partner', line: 'owning up to mistakes' }),
  it('lp8', 'loyalty', 'check', 'A stranger keeps complimenting you in your DMs.', [
    o('', 'Shut it down', { integ: 90, boundary: 12 }, { s: 3 }),
    o('', 'Enjoy it, it’s harmless', { integ: 35, boundary: 85 }, { s: 0 }),
    o('', 'Mention it to my partner', { integ: 80, boundary: 30 }, { s: 2 }),
    o('', 'Depends who it is', { integ: 50, boundary: 60 }, { s: 1 })], { variant: 'partner', checks: 'lp3' }),

  it('lf1', 'loyalty', 'loyal', 'Your best friend’s rival invites you to a big party.', [
    o('', 'Decline', { loyal: 85 }, { s: 3 }),
    o('', 'Go, but tell my friend', { loyal: 65, v_honesty: 75 }, { s: 2 }),
    o('', 'Go quietly', { loyal: 30, v_honesty: 30 }, { s: 0 }),
    o('', 'Ask my friend first', { loyal: 70, read_sense: 65 }, { s: 2 })], { variant: 'friend', line: 'taking sides' }),
  it('lf2', 'loyalty', 'loyal', 'A friend tells you a secret. Others push you to share.', [
    o('', 'Never share', { integ: 90, loyal: 80 }, { s: 3 }),
    o('', 'Drop a hint', { integ: 45 }, { s: 1 }),
    o('', 'Share if it’s harmless', { integ: 40 }, { s: 1 }),
    o('', 'Share it', { integ: 15 }, { s: 0 })], { variant: 'friend', line: 'keeping secrets' }),
  it('lf3', 'loyalty', 'loyal', 'A friend needs ₹20,000 urgently.', [
    o('', 'Give it', { loyal: 85, v_security: 30 }, { s: 3 }),
    o('', 'Lend it with a return date', { loyal: 70, v_security: 65 }, { s: 2 }),
    o('', 'Give part of it', { loyal: 55 }, { s: 1 }),
    o('', 'Say no', { loyal: 30, v_security: 85 }, { s: 0 })], { variant: 'friend', line: 'helping with money' }),
  it('lf4', 'loyalty', 'loyal', 'Your friend is criticised in a group chat.', [
    o('', 'Defend them there', { loyal: 90 }, { s: 3 }),
    o('', 'Message my friend privately', { loyal: 70 }, { s: 2 }),
    o('', 'Stay out of it', { loyal: 40, r_withdraw: 60 }, { s: 1 }),
    o('', 'Agree a little', { loyal: 10 }, { s: 0 })], { variant: 'friend', line: 'standing up for each other' }),
  it('lf5', 'loyalty', 'loyal', 'Your friend hasn’t replied for weeks.', [
    o('', 'Check on them', { loyal: 85, read_sense: 70 }, { s: 3 }),
    o('', 'Wait for them', { loyal: 55 }, { s: 1 }),
    o('', 'Let it drift', { loyal: 20 }, { s: 0 }),
    o('', 'Ask what’s going on', { loyal: 70, r_fix: 60 }, { s: 2 })], { variant: 'friend', line: 'staying in touch' }),
  it('lf6', 'loyalty', 'loyal', 'You get an opportunity your friend also wanted.', [
    o('', 'Tell them first', { v_honesty: 90 }, { s: 3 }),
    o('', 'Take it, tell them later', { v_honesty: 55 }, { s: 1 }),
    o('', 'Take it quietly', { v_honesty: 20 }, { s: 0 }),
    o('', 'Step aside for them', { loyal: 85, v_ambition: 25 }, { s: 2 })], { variant: 'friend', line: 'being upfront' }),
  it('lf7', 'loyalty', 'loyal', 'A friend’s mistake hurts you.', [
    o('', 'Talk it out', { rec_forgive: 70, r_fix: 75 }, { s: 3 }),
    o('', 'Forgive silently', { rec_forgive: 80, r_withdraw: 55 }, { s: 2 }),
    o('', 'Keep my distance', { rec_forgive: 35, r_withdraw: 70 }, { s: 1 }),
    o('', 'End the friendship', { rec_forgive: 10 }, { s: 0 })], { variant: 'friend', line: 'making up' }),
  it('lf8', 'loyalty', 'check', 'A friend shares something private in a voice note. Someone asks you to forward it.', [
    o('', 'Never', { integ: 90, loyal: 75 }, { s: 3 }),
    o('', 'Just a summary', { integ: 45 }, { s: 1 }),
    o('', 'Forward if it’s harmless', { integ: 40 }, { s: 1 }),
    o('', 'Forward it', { integ: 15 }, { s: 0 })], { variant: 'friend', checks: 'lf2' }),

  // ---------- game 5: three boxes (deal-breakers) ----------
  it('fx_me', 'flex', 'me', 'Tap everything that describes you.', []),
  it('fx_box', 'flex', 'boxes', 'For a partner: tap a chip to move it to Must, Never or Flexible.', []),

  // ---------- game 6: build my day (one screen, 5 slots) ----------
  it('dy1', 'rhythm', 'day', 'Morning', [
    o('🌅', 'Up before 6', { chrono: 10 }), o('☕', 'Easy 7–8 start', { chrono: 40 }),
    o('😴', 'Snooze till 9+', { chrono: 85 }), o('🏃', 'Workout first', { chrono: 20, adventure: 60 })], { screen: 'day' }),
  it('dy2', 'rhythm', 'day', 'Work style', [
    o('💼', 'Long hours, big goals', { v_ambition: 85, gt_career: 70 }), o('⚖️', '9 to 6, then off', { v_ambition: 45, v_love: 60 }),
    o('🏠', 'Remote, flexible', { v_freedom: 65 }), o('🎨', 'My own business', { dec_risk: 80, v_ambition: 75, dec_lead: 75 })], { screen: 'day' }),
  it('dy3', 'rhythm', 'day', 'Evening', [
    o('🍳', 'Cook at home', { energy: 35, v_family: 60 }), o('🍻', 'Out with friends', { energy: 85 }),
    o('📺', 'Shows or games', { energy: 30 }), o('📚', 'Learn something', { curiosity: 80, depth: 65 })], { screen: 'day' }),
  it('dy4', 'rhythm', 'day', 'Late night', [
    o('🛌', 'Asleep by 10:30', { chrono: 10 }), o('🌙', 'Around midnight', { chrono: 55 }),
    o('🦉', '2 am owl', { chrono: 92 }), o('📞', 'Late-night calls', { chrono: 75, r_seek: 60 })], { screen: 'day' }),
  it('dy5', 'rhythm', 'day', 'Weekend', [
    o('🏔️', 'Trip or adventure', { adventure: 85, energy: 65 }), o('🛋️', 'Recharge at home', { energy: 20 }),
    o('👨‍👩‍👧', 'Family time', { v_family: 85 }), o('🎉', 'Parties, events', { energy: 90 })], { screen: 'day' }),

  // ---------- game 7: your move (conflict style and repair) ----------
  it('cf1', 'conflict', 'react', 'They spent a lot of money without telling you.', [
    o('💬', '“Let’s talk about it calmly.”', { r_fix: 85, r_heat: 20 }, { tag: 'solve' }),
    o('👉', '“You never think before you spend!”', { r_fight: 90, r_heat: 75 }, { tag: 'criticise' }),
    o('🧱', '“Whatever. Do what you want.”', { r_withdraw: 85, rec_speed: 30 }, { tag: 'stonewall' }),
    o('🫥', '“Fine, it’s your money.”', { r_withdraw: 50, dec_lead: 20 }, { tag: 'yield' })]),
  it('cf2', 'conflict', 'react', 'They point out something you did wrong.', [
    o('🙏', '“You’re right, sorry.”', { rec_apology: 90 }, { tag: 'accept' }),
    o('🛡️', '“But you also…”', { r_fight: 75, rec_apology: 20 }, { tag: 'defend' }),
    o('🚶', 'Go quiet and walk away', { r_withdraw: 90 }, { tag: 'stonewall' }),
    o('⚖️', '“Let me explain my side, then I’ll hear yours.”', { r_fix: 85, read_sense: 65 }, { tag: 'solve' })]),
  it('cf3', 'conflict', 'react', 'After a fight, who makes the first move?', [
    o('🤗', 'Me, with a joke or a hug', { rec_apology: 80, rec_forgive: 80, rec_speed: 85, humor: 65 }, { tag: 'repair' }),
    o('☝️', 'Whoever was wrong', { rec_apology: 40, rec_forgive: 35 }, { tag: 'score' }),
    o('⏳', 'I wait for them', { rec_apology: 20, r_withdraw: 60 }, { tag: 'wait' }),
    o('🌬️', 'We both cool off, then talk', { rec_speed: 55, rec_forgive: 70, r_fix: 65 }, { tag: 'repair' })]),
];
export const SCENARIO_MAP = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/** Which loyalty version a person gets: friendship seekers get the friend version, everyone else the partner one. */
export const loyaltyVariant = (answers) => {
  const a = answers?.it_look; const oi = a && typeof a === 'object' ? a.o : a;
  return SCENARIO_MAP.it_look.options[oi]?.key === 'friendship' ? 'friend' : 'partner';
};
/** The items a person plays, in game order (the loyalty version follows their answer to "What are you looking for?"). */
export const planFor = (answers) => {
  const v = loyaltyVariant(answers);
  return SCENARIOS.filter((s) => !s.variant || s.variant === v).map((s) => s.id);
};
