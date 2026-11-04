// Soul DNA v6: 7 categories × 3 = 21 taps. Each category opens with ONE photo grid ("which of these is you?",
// 8 to 12 real photos, pick up to 3, the order you tap is your ranking), then two quick questions.
// Each category is built on a published psychology instrument (see docs/SOUL-DNA-GAMES.md); the item wording is
// our own. Every option quietly moves the person's mind model on one or more TRAITS (0-100). Nobody sees these
// numbers: the app only gets the text, the photos and the kind of each item.
//
// Item kinds (what the app shows, and what an answer looks like)
//   photos     a photo grid, pick 1 to `max` (in order)  { s: [indices] }   first pick counts most
//   pick       one of a few answers (what you want)       { o }
//   react      one of 3-5 answers (gut-reaction time noted) { o }
//   vs         two cards + a firmness dial                { o, f }          f: 0 flexible, 1 firm, 2 non-negotiable
//   loyal      one of 4 answers + the firmness dial       { o, f }          (partner or friend version)
//   me         lifestyle photos: tap all that are you     { s: [keys] }
//   boxes      chips for a partner: Must / Never          { must: [keys], never: [keys] }   (the rest = flexible)
// Any single answer may also carry ms (time to answer) and ch (times changed).
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
  { key: 'personality', title: 'Your nature', game: '1' },
  { key: 'emotion', title: 'Your feelings', game: '2' },
  { key: 'values', title: 'What matters most', game: '3' },
  { key: 'loyalty', title: 'Love and loyalty', game: '4' },
  { key: 'flex', title: 'Your lifestyle', game: '5' },
  { key: 'rhythm', title: 'Your day', game: '6' },
  { key: 'conflict', title: 'After a disagreement', game: '7' },
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
/** How much each pick in a photo grid counts: 1st, 2nd, 3rd. */
export const RANK_WEIGHT = [1.25, 1.0, 0.8];

/** Lifestyle chips (game 5). `me` = the caption on the "which of these are you?" photo; `photo` = an Unsplash id.
 *  "Wants kids" isn't shown as a photo: the kids question right after answers it. */
export const CHIPS = [
  { key: 'smoke', label: 'Smokes', me: 'I smoke', photo: '1556575082-d2fe8144347d' },
  { key: 'drink', label: 'Drinks', me: 'I drink', photo: '1764510376019-39d305752e9d' },
  { key: 'pets', label: 'Has pets', me: 'Pet lover', photo: '1522276498395-f4f68f7f8454' },
  { key: 'kids', label: 'Wants kids' },
  { key: 'family_home', label: 'Lives with family after marriage', me: 'Living with family after marriage', photo: '1578496780896-7081cc23c111' },
  { key: 'relocate', label: 'Willing to move cities', me: 'Happy to move cities', photo: '1714647211902-bb711d643a17' },
  { key: 'veg', label: 'Vegetarian', me: 'Vegetarian', photo: '1742281257687-092746ad6021' },
  { key: 'faith', label: 'Practises a faith', me: 'Practise my faith', photo: '1764078680838-7bc41044286a' },
  { key: 'nightlife', label: 'Loves night-outs', me: 'Love night-outs', photo: '1545128485-c400e7702796' },
];
export const CHIP_KEYS = CHIPS.map((c) => c.key);
export const ME_CHIP_KEYS = CHIPS.filter((c) => c.photo).map((c) => c.key);
/** What describing yourself with a chip says about you. */
export const CHIP_SET = { relocate: { home_dir: 80 }, family_home: { v_family: 72, home_dir: 20 }, faith: { v_tradition: 66 }, nightlife: { energy: 78, chrono: 70 }, pets: { b_A: 60 } };

// ---------- the items ----------
// o(label, set, extra)  extra: { key } for "what you want" picks, { s } strictness 0-3 for loyalty, { tag } for
//   analysis, { photo } an Unsplash photo id (free for commercial use: unsplash.com/license)
const o = (label, set, extra = {}) => ({ label, set, ...extra });
const p = (label, photo, set) => ({ label, photo, set });
const it = (id, layer, kind, text, options, more = {}) => ({ id, layer, kind, text, options, ...more });

export const SCENARIOS = [
  // ---------- 1. your nature (Big Five, IPIP) ----------
  it('g_nature', 'personality', 'photos', 'Which of these are you?', [
    p('Life of the party', '1655459765544-39065b741a9e', { b_E: 88, energy: 85 }),
    p('Lost in a good book', '1587210489914-6992e0797d55', { b_E: 28, depth: 72, b_O: 62 }),
    p('The planner', '1524850011238-e3d235c7d4c9', { b_C: 88, dec_head: 70, dec_risk: 30 }),
    p('Always up for an adventure', '1627894485200-b92fb4353967', { b_O: 78, adventure: 88, curiosity: 75 }),
    p('The shoulder to lean on', '1539541417736-3d44c90da315', { b_A: 88, read_sense: 80 }),
    p('Takes the lead', '1776039230119-6e69e241512d', { b_E: 72, dec_lead: 88 }),
    p('Calm in any storm', '1506126613408-eca07ce68773', { b_S: 88, r_heat: 15, rec_speed: 70 }),
    p('The creative one', '1595351298020-038700609878', { b_O: 88, curiosity: 78 }),
    p('Always the joker', '1573496546038-82f9c39f6365', { humor: 90, b_E: 65 }),
    p('Deep talks over chai', '1604881988758-f76ad2f7aac1', { depth: 88, b_O: 70 }),
    p('Gets things done', '1768055105012-4c53791b2877', { b_C: 85, v_ambition: 65 }),
    p('Fitness first', '1761839258420-5c3e2f2e2a74', { b_C: 70, energy: 72 })], { max: 3 }),
  it('pe_cancel', 'personality', 'react', 'Friends cancel your plans at the last minute. You…', [
    o('Feel relieved: a quiet night in', { b_E: 22, energy: 28 }, { tag: 'introvert' }),
    o('Call someone else and go out anyway', { b_E: 85, energy: 82 }, { tag: 'extravert' }),
    o('Stay annoyed for a while', { b_S: 22, r_heat: 70, rec_speed: 25 }, { tag: 'reactive' }),
    o('Make a new plan for myself', { b_S: 72, b_C: 62, rec_speed: 80 }, { tag: 'steady' })]),
  it('pe_team', 'personality', 'react', 'In a group project, you’re the one who…', [
    o('Leads and divides the work', { dec_lead: 88, b_E: 70, b_C: 65 }, { tag: 'lead' }),
    o('Brings the new ideas', { b_O: 85, curiosity: 78 }, { tag: 'ideas' }),
    o('Quietly does most of the work', { b_C: 85, b_E: 30 }, { tag: 'doer' }),
    o('Keeps everyone getting along', { b_A: 88, rec_forgive: 65, r_fight: 20 }, { tag: 'peace' }),
    o('Finishes it at the last minute', { b_C: 15, dec_risk: 62 }, { tag: 'late' })]),

  // ---------- 2. your feelings (attachment, emotion regulation) ----------
  it('g_feel', 'emotion', 'photos', 'When something upsets you, which of these is you?', [
    p('Call a friend right away', '1663743629961-c6134ef1afc9', { r_seek: 85, att_avo: 20, b_E: 65 }),
    p('Headphones on, world off', '1625786682948-2168238883d2', { r_withdraw: 75, att_avo: 60 }),
    p('Let the tears out', '1521075486433-bf4052bb37bc', { b_S: 32, rec_speed: 55, att_avo: 25 }),
    p('A hug, not advice', '1722385036849-76f0d7b97f0b', { r_seek: 72, att_avo: 15, att_anx: 55 }),
    p('Write it all down', '1517971071642-34a2d3ecc9cd', { depth: 70, rec_speed: 60, r_heat: 30 }),
    p('Overthink it all night', '1718986786855-4d2dcee21cb7', { att_anx: 78, b_S: 25 }),
    p('Want to be left alone', '1620578077783-33e254311182', { att_avo: 80, r_withdraw: 85 }),
    p('A long walk alone', '1592903204858-e288251ad9cc', { r_withdraw: 55, rec_speed: 65, r_heat: 25 }),
    p('Talk it through', '1573497491208-6b1acb260507', { r_fix: 75, att_avo: 20, read_sense: 65 }),
    p('Laugh it off', '1760032058836-f9ecf82b9926', { humor: 85, rec_speed: 82 }),
    p('Sleep on it', '1758273239813-cecda76c6c19', { rec_speed: 70, r_heat: 20, b_S: 65 }),
    p('Cook or clean to calm down', '1556911073-a517e752729c', { rec_speed: 65, b_C: 60 })], { max: 3 }),
  it('em1', 'emotion', 'react', 'Someone close hasn’t replied in 6 hours.', [
    o('They’re busy, no worries', { att_anx: 18, att_avo: 30, read_trust: 72 }, { tag: 'secure' }),
    o('Something feels wrong…', { att_anx: 80, r_seek: 65 }, { tag: 'anxious' }),
    o('Text again… and again', { att_anx: 92, r_seek: 85, r_heat: 60 }, { tag: 'anxious' }),
    o('Fine, I won’t reply either', { att_avo: 70, r_withdraw: 70, r_heat: 55 }, { tag: 'avoidant' }),
    o('Didn’t even notice', { att_avo: 75, att_anx: 10 }, { tag: 'avoidant' })]),
  it('em5', 'emotion', 'react', 'Someone close wants to spend every evening with you.', [
    o('Love it', { att_avo: 10, att_anx: 55, energy: 60 }, { tag: 'close' }),
    o('Nice, but I need me-time too', { att_avo: 45, att_anx: 20 }, { tag: 'secure' }),
    o('Feels suffocating', { att_avo: 90, v_freedom: 80 }, { tag: 'avoidant' }),
    o('Finally, someone who wants me', { att_anx: 88, r_seek: 75 }, { tag: 'anxious' }),
    o('Let’s plan it together', { att_avo: 30, att_anx: 25, r_fix: 60 }, { tag: 'secure' })]),

  // ---------- 3. what matters most (Schwartz values) ----------
  it('g_values', 'values', 'photos', 'Pick the 3 that matter most to you', [
    p('Family', '1576089073624-b5751a8f4de9', { v_family: 90 }),
    p('Career and success', '1577962917302-cd874c4e31d2', { v_ambition: 90, gt_career: 65 }),
    p('Freedom to travel', '1694932845880-d8ad94f23ea6', { v_freedom: 88, adventure: 70 }),
    p('Traditions and festivals', '1577083753695-e010191bacb5', { v_tradition: 90 }),
    p('Faith', '1689586543311-7ec56db0ebd9', { v_tradition: 80 }),
    p('Love', '1748176952054-db738247a927', { v_love: 90 }),
    p('Money in the bank', '1633158829556-6ea20ad39b4f', { v_security: 90, gt_money: 65, dec_risk: 25 }),
    p('Learning and growing', '1741699428220-65f37f3fbbcb', { curiosity: 85, b_O: 70 }),
    p('Health and fitness', '1517836357463-d25dfeac3438', { b_C: 65, energy: 65 }),
    p('Friends', '1672135620913-2e8dae4b46e2', { energy: 65, b_E: 65 }),
    p('Helping others', '1599059813005-11265ba4b4ce', { b_A: 85, read_sense: 65 })], { max: 3, exact: true }),
  it('va1', 'values', 'vs', 'Which matters more to you?', [
    o('A dream job abroad', { v_ambition: 80, home_dir: 85, v_freedom: 65 }),
    o('Staying close to family', { v_family: 85, home_dir: 15 })], { firm: 'gt_home' }),
  it('va6', 'values', 'vs', 'Which matters more to you?', [
    o('My family’s approval of my partner', { v_tradition: 80, v_family: 80 }),
    o('My choice, my life', { v_freedom: 85, v_tradition: 25 })], { firm: 'gt_family' }),

  // ---------- 4. love and loyalty (Investment Model, jealousy research) ----------
  it('it_look', 'loyalty', 'pick', 'What are you looking for on Soulink?', [
    o('Marriage', { intent_serious: 95, intent_family: 78, intent_pace: 70 }, { key: 'marriage' }),
    o('A serious relationship', { intent_serious: 80, intent_pace: 55 }, { key: 'serious' }),
    o('Friendship', { intent_serious: 40, intent_pace: 40 }, { key: 'friendship' }),
    o('Still exploring', { intent_serious: 25, intent_pace: 30 }, { key: 'exploring' })]),
  it('g_loyal', 'loyalty', 'photos', 'What does loyalty mean to you?', [
    p('Growing old together', '1625690987114-86f5af994b49', { loyal: 90, intent_serious: 75 }),
    p('There in the hard times', '1714640693995-43e8852ab6b5', { loyal: 88, rec_forgive: 65 }),
    p('Keeping my word', '1659352790996-871ea0804eec', { integ: 88, v_honesty: 80 }),
    p('No one else comes first', '1779475559689-a19f9c339352', { integ: 90, boundary: 15, jealousy: 60 }),
    p('The family’s blessing', '1621801306185-8c0ccf9c8eb8', { v_tradition: 80, v_family: 75 }),
    p('Talking every day', '1522125670776-3c7abb882bc2', { att_anx: 65, r_seek: 70 }),
    p('Space to be myself', '1522075782449-e45a34f1ddfb', { v_freedom: 85, att_avo: 60, boundary: 70 }),
    p('Little surprises', '1526047932273-341f2a7631f9', { v_love: 85, read_sense: 65 }),
    p('Having each other’s back', '1511632765486-a01980e01a18', { loyal: 85 }),
    p('Celebrating every win', '1680459520309-189cf5b22212', { v_love: 70, energy: 65 })], { max: 3 }),
  // s = how strict the line is (0 relaxed → 3 strict). Two people's lines are matched, never judged.
  it('lp3', 'loyalty', 'loyal', 'Someone attractive at work flirts with you.', [
    o('Shut it down', { integ: 92, boundary: 10 }, { s: 3 }),
    o('Harmless fun', { integ: 30, boundary: 90 }, { s: 0 }),
    o('Tell my partner', { integ: 80, boundary: 30, v_honesty: 75 }, { s: 2 }),
    o('Depends on the person', { integ: 50, boundary: 60 }, { s: 1 })], { variant: 'partner', line: 'flirting' }),
  it('lf2', 'loyalty', 'loyal', 'A friend tells you a secret. Others push you to share it.', [
    o('Never share', { integ: 90, loyal: 80 }, { s: 3 }),
    o('Drop a hint', { integ: 45 }, { s: 1 }),
    o('Share if it’s harmless', { integ: 40 }, { s: 1 }),
    o('Share it', { integ: 15 }, { s: 0 })], { variant: 'friend', line: 'keeping secrets' }),

  // ---------- 5. your lifestyle (deal-breakers research) ----------
  it('fx_me', 'flex', 'me', 'Which of these are you?', []),
  it('fx_box', 'flex', 'boxes', 'For a partner: tap to mark Must or Never', []),
  it('it_kids', 'flex', 'pick', 'Kids someday?', [
    o('Want kids', { intent_family: 92, v_family: 70 }, { key: 'want' }),
    o('Don’t want kids', { intent_family: 8 }, { key: 'no' }),
    o('Open to it', { intent_family: 50 }, { key: 'open' })]),

  // ---------- 6. your day (morning–evening type) ----------
  it('g_day', 'rhythm', 'photos', 'Build your perfect day', [
    p('Up with the sunrise', '1522506209496-4536d9020ec4', { chrono: 10 }),
    p('Slow morning coffee', '1518057111178-44a106bad636', { chrono: 42, energy: 35 }),
    p('Sleeping in', '1531353826977-0941b4779a1c', { chrono: 85 }),
    p('Long hours at work', '1758598307046-22f11e2a6917', { v_ambition: 85, gt_career: 70 }),
    p('Cooking together', '1556911073-38141963c9e0', { v_family: 60, energy: 40 }),
    p('Reading in a hammock', '1598958288736-97eab7acfa91', { energy: 20, depth: 60 }),
    p('Gaming night', '1493711662062-fa541adb3fc8', { energy: 35, chrono: 72 }),
    p('Out with friends', '1639744212655-448c4d874493', { energy: 85, chrono: 65 }),
    p('Dancing till late', '1708449530105-ea7d453a6f89', { energy: 92, chrono: 88 }),
    p('Dinner with family', '1533777419517-3e4017e2e15a', { v_family: 80 }),
    p('A trip somewhere new', '1645111529167-7ed14ce1ae28', { adventure: 85, energy: 65 })], { max: 3 }),
  it('dy4', 'rhythm', 'react', 'When do you usually fall asleep?', [
    o('Before 10:30 pm', { chrono: 10 }), o('Around midnight', { chrono: 55 }),
    o('After 1 am', { chrono: 90 }), o('Late-night calls, then sleep', { chrono: 75, r_seek: 60 })]),
  it('dy5', 'rhythm', 'react', 'Your ideal weekend?', [
    o('A trip or an adventure', { adventure: 85, energy: 65 }), o('Recharge at home', { energy: 20 }),
    o('Time with family', { v_family: 85 }), o('Parties and events', { energy: 90 })]),

  // ---------- 7. after a disagreement (Gottman, dual-concern model) ----------
  it('g_fight', 'conflict', 'photos', 'After a disagreement, which of these is you?', [
    p('Say it right then', '1626447269096-f8665509589c', { r_fight: 80, r_heat: 75 }),
    p('Go quiet for a while', '1758524944637-a515455f95ec', { r_withdraw: 85, rec_speed: 30 }),
    p('Sit down and talk it out', '1713942590288-1468a2d88ee4', { r_fix: 88, r_heat: 25 }),
    p('Hold hands and make up', '1604881990409-b9f246db39da', { rec_forgive: 85, rec_speed: 78 }),
    p('Cool off alone first', '1621011563377-38ae7ac65701', { rec_speed: 55, r_withdraw: 55, r_heat: 30 }),
    p('Say sorry first', '1625690988276-0a7b0cdf3d5d', { rec_apology: 88, rec_forgive: 80, rec_speed: 80 }),
    p('Text it instead of talking', '1570101945621-945409a6370f', { r_withdraw: 50, r_fix: 50 }),
    p('Make up with a gesture', '1589095181425-c038b3871b6a', { rec_apology: 70, v_love: 70 }),
    p('Take time to forgive', '1667053508464-eb11b394df83', { rec_forgive: 20, rec_speed: 18 })], { max: 3 }),
  it('cf1', 'conflict', 'react', 'They spent a lot of money without telling you.', [
    o('“Let’s talk about it calmly.”', { r_fix: 85, r_heat: 20 }, { tag: 'solve' }),
    o('“You never think before you spend!”', { r_fight: 90, r_heat: 75 }, { tag: 'criticise' }),
    o('“Whatever. Do what you want.”', { r_withdraw: 85, rec_speed: 30 }, { tag: 'stonewall' }),
    o('“Fine, it’s your money.”', { r_withdraw: 50, dec_lead: 20 }, { tag: 'yield' })]),
  it('cf3', 'conflict', 'react', 'After a fight, who makes the first move?', [
    o('Me, with a joke or a hug', { rec_apology: 80, rec_forgive: 80, rec_speed: 85, humor: 65 }, { tag: 'repair' }),
    o('Whoever was wrong', { rec_apology: 40, rec_forgive: 35 }, { tag: 'score' }),
    o('I wait for them', { rec_apology: 20, r_withdraw: 60 }, { tag: 'wait' }),
    o('We both cool off, then talk', { rec_speed: 55, rec_forgive: 70, r_fix: 65 }, { tag: 'repair' })]),
];
export const SCENARIO_MAP = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/** Which loyalty version a person gets: friendship seekers get the friend version, everyone else the partner one. */
export const loyaltyVariant = (answers) => {
  const a = answers?.it_look; const oi = a && typeof a === 'object' ? a.o : a;
  return SCENARIO_MAP.it_look.options[oi]?.key === 'friendship' ? 'friend' : 'partner';
};
/** The items a person plays, in order (the loyalty version follows their answer to "What are you looking for?"). */
export const planFor = (answers) => {
  const v = loyaltyVariant(answers);
  return SCENARIOS.filter((s) => !s.variant || s.variant === v).map((s) => s.id);
};
