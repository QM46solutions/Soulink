// Soul DNA v7: 8 fixed categories, each with a bank of short, playful activities (docs/SOUL-DNA-V7.md).
// Every activity measures named traits; no answer is the "right" one. Everyone plays the same categories but not
// always the same activities, so results stay comparable: every activity feeds the SAME traits for its category,
// and 4 anchors are the same for everyone. A category score always comes from several answers.
//
// Activity kinds (what the app shows, and what an answer looks like). All but habits / needs may also be answered
// { skip: true } ("It depends" or Skip; { skip: true, d: 1 } for "It depends"): kept, moves nothing, so that trait
// simply stays less sure.
//   react    choose what you'd do / reaction / conversation cards / choose what fits   { o }
//   more     pick what matters more (2 cards); `firm`: a firmness dial too             { o, f? }
//   slider   a point between two ends, 5 stops (0-4)                                   { v }
//   rank     put 4 in order                                                            { r: [4 indices, first = most] }
//   day      build your ideal day: one per slot                                        { s: [i, i, i] }
//   tiles    pick up to 3 from a visual set (drawn icons, not photos)                  { s: [indices] }
//   habits   quick taps about you, one per group (-1 = prefer not to say)              { food, drinks, smoke, pets, faith }
//   needs    what you need in a partner: Must / Nice to have / Never per chip          { key: 'must' | 'nice' | 'never' }
// Any answer may also carry ms (time to answer) and ch (times changed).
// Traits are the v6 ones (0-100), so a Soul DNA made with the v6 games still matches against a v7 one.

export const LAYERS = [
  { key: 'social', title: 'Social style' },
  { key: 'comm', title: 'Communication' },
  { key: 'conflict', title: 'Conflict' },
  { key: 'trust', title: 'Trust and boundaries' },
  { key: 'values', title: 'Values' },
  { key: 'lifestyle', title: 'Lifestyle' },
  { key: 'interests', title: 'Interests' },
  { key: 'expect', title: 'Relationship expectations' },
];

/** trait → the category it belongs to (for "how sure we are" per category) */
export const TRAITS = {
  b_E: 'social', energy: 'social', gt_social: 'social', b_O: 'social',
  r_seek: 'comm', read_sense: 'comm', depth: 'comm', humor: 'comm', curiosity: 'comm',
  r_fight: 'conflict', r_fix: 'conflict', r_withdraw: 'conflict', r_heat: 'conflict', rec_apology: 'conflict', rec_forgive: 'conflict', rec_speed: 'conflict', b_S: 'conflict',
  att_anx: 'trust', att_avo: 'trust', integ: 'trust', boundary: 'trust', jealousy: 'trust', read_trust: 'trust', loyal: 'trust',
  v_family: 'values', v_freedom: 'values', v_security: 'values', v_ambition: 'values', v_love: 'values', v_honesty: 'values', v_tradition: 'values',
  gt_money: 'values', gt_family: 'values', gt_home: 'values', gt_career: 'values', home_dir: 'values', b_A: 'values', dec_head: 'values', dec_lead: 'values', dec_risk: 'values',
  chrono: 'lifestyle', adventure: 'lifestyle', b_C: 'lifestyle',
  intent_serious: 'expect', intent_pace: 'expect', intent_family: 'expect', pref_similar: 'expect',
};

/** The firmness dial → how firmly an area is held (give and take), and how much the answer counts. */
export const FIRM = { level: [25, 60, 90], weight: [0.9, 1.1, 1.35], labels: ['Flexible', 'Firm', 'Non-negotiable'] };
/** How much each pick counts by position: tiles (1st, 2nd, 3rd) and rank (1st … 4th). */
export const RANK_WEIGHT = [1.25, 1.0, 0.8];
export const ORDER_WEIGHT = [1.2, 0.8, 0.4, 0.2];
/** A ranked value (va0 / va2): 1st → 90 … 4th → 30. */
export const ORDER_VALUE = [90, 70, 50, 30];
/** Answer weights by kind: picture picks are preference data and never decide a trait alone; anchors count a bit more. */
export const KIND_WEIGHT = { tiles: 0.6, day: 0.8 };
export const ANCHOR_WEIGHT = 1.2;

// ---------- lifestyle quick taps (li5) and partner needs (re5) ----------
export const HABITS = [
  { key: 'food', label: 'Food', options: ['Vegetarian', 'Eggetarian', 'Non-veg', 'Vegan'] },
  { key: 'drinks', label: 'Drinks', options: ['Never', 'Socially', 'Often'] },
  { key: 'smoke', label: 'Smoking', options: ['Never', 'Socially', 'Regularly'] },
  { key: 'pets', label: 'Pets', options: ['Have one', 'Love them', 'Not for me'] },
  { key: 'faith', label: 'Faith', options: ['Practise it', 'Spiritual', 'Not really'] },
];
export const HABIT_KEYS = HABITS.map((h) => h.key);
/** Quick taps → the lifestyle keys a partner's Must / Never is checked against (v6's chip keys, plus drink_often). */
export function habitKeys(h = {}) {
  const out = [];
  if (h.food === 0 || h.food === 3) out.push('veg');
  if (h.drinks === 1 || h.drinks === 2) out.push('drink');
  if (h.drinks === 2) out.push('drink_often');
  if (h.smoke === 1 || h.smoke === 2) out.push('smoke');
  if (h.pets === 0 || h.pets === 1) out.push('pets');
  if (h.faith === 0) out.push('faith');
  return out;
}

/** What you need in a partner. treat: how they treat you (checked against the other person's traits: [trait,
 *  threshold, 'low' when lower is what's wanted]); life: life together (checked against their quick taps and
 *  answers). Only life chips can be a Never. */
export const NEEDS = [
  { key: 'word', group: 'treat', label: 'Keeps their word', trait: ['integ', 62] },
  { key: 'time', group: 'treat', label: 'Makes time for me', trait: ['att_avo', 45, 'low'] },
  { key: 'family', group: 'treat', label: 'Respects my family', trait: ['v_family', 55] },
  { key: 'career', group: 'treat', label: 'Backs my career', trait: ['v_ambition', 50] },
  { key: 'space', group: 'treat', label: 'Gives me space', trait: ['att_avo', 45] },
  { key: 'chores', group: 'treat', label: 'Shares the housework', trait: ['b_C', 50] },
  { key: 'talk', group: 'treat', label: 'Talks things through', trait: ['r_fix', 55] },
  { key: 'laugh', group: 'treat', label: 'Makes me laugh', trait: ['humor', 55] },
  { key: 'near_family', group: 'life', label: 'Lives near my family' },
  { key: 'relocate', group: 'life', label: 'Open to moving cities' },
  { key: 'faith', group: 'life', label: 'Shares my faith' },
  { key: 'same_food', group: 'life', label: 'Same food habits' },
  { key: 'no_smoke', group: 'life', label: 'Doesn’t smoke' },
  { key: 'light_drink', group: 'life', label: 'Drinks socially or not at all' },
  { key: 'pets', group: 'life', label: 'Loves pets' },
  { key: 'kids', group: 'life', label: 'Wants kids' },
];
export const NEED_MAP = Object.fromEntries(NEEDS.map((n) => [n.key, n]));
export const NEED_LEVELS = ['must', 'nice', 'never'];

/** Interest tiles (in1): a drawn icon each (the app draws it in Soulink's colours; no stock photos). */
export const INTEREST_TILES = [
  ['Music', 'music'], ['Movies', 'movie-open'], ['Cricket', 'cricket'], ['Football', 'soccer'], ['Gym', 'dumbbell'], ['Running', 'run'],
  ['Yoga', 'yoga'], ['Trekking', 'hiking'], ['Travel', 'airplane'], ['Cooking', 'chef-hat'], ['Food hunting', 'food'], ['Reading', 'book-open-variant'],
  ['Gaming', 'controller'], ['Photography', 'camera'], ['Art and design', 'palette'], ['Dance', 'human-female-dance'], ['Tech and startups', 'rocket-launch'], ['Fashion', 'hanger'],
  ['Spirituality', 'meditation'], ['Volunteering', 'hand-heart'], ['Pets', 'paw'], ['Anime', 'star-four-points'], ['Stand-up comedy', 'microphone-variant'], ['Cars and bikes', 'motorbike'],
];

// ---------- the bank ----------
// o(label, set, extra): extra { tag } an interest tag, { s } how strict a trust line is (0 relaxed → 3 strict),
// { key } a value kept as is (kids, life stage), { t } the one value a ranked card stands for, { icon } a tile icon
const o = (label, set = {}, extra = {}) => ({ label, set, ...extra });
const it = (id, layer, kind, text, options, more = {}) => ({ id, layer, kind, text, options, ...more });
const ends = (left, lset, right, rset) => [o(left, lset), o(right, rset)];

export const SCENARIOS = [
  // ---------- 1. social style ----------
  it('so1', 'social', 'react', 'A friend invites you to a party where you only know them.', [
    o('Go and meet new people', { b_E: 85, energy: 80 }), o('Go, and mostly stay with my friend', { b_E: 50 }),
    o('Go for an hour, then head home', { b_E: 35, energy: 40 }), o('Suggest something smaller instead', { b_E: 25, gt_social: 30 })], { look: 'scenario' }),
  it('so2', 'social', 'slider', 'My ideal Saturday evening', ends('A big group out', { b_E: 90, energy: 85 }, 'One or two people, in', { b_E: 15, energy: 25 })),
  it('so3', 'social', 'more', 'Which suits you?', [o('Lots of friends I see now and then', { gt_social: 80 }), o('A few friends I see all the time', { gt_social: 25 })]),
  it('so4', 'social', 'react', 'You walk into a wedding full of people you don’t know.', [
    o('Start chatting with whoever’s nearby', { b_E: 85 }), o('Find the food, then chat', { b_E: 55 }),
    o('Wait for someone to come over', { b_E: 30 }), o('Stay with the people I came with', { b_E: 40, gt_social: 30 })], { look: 'reaction' }),
  it('so5', 'social', 'rank', 'Best way to recharge after a long week', [
    o('A night out with friends', { b_E: 85, energy: 85 }), o('A quiet night alone', { b_E: 20, energy: 25 }),
    o('Dinner with family', { v_family: 70 }), o('A movie with one close friend', { b_E: 45 })]),

  // ---------- 2. communication ----------
  it('co1', 'comm', 'react', 'Which would you most enjoy talking about over chai?', [
    o('Big dreams and plans', { depth: 80 }), o('Funny stories from the week', { humor: 80 }),
    o('What’s happening in the world', { depth: 60, curiosity: 70 }), o('How we’re really feeling', { read_sense: 80, depth: 75 })], { look: 'cards' }),
  it('co2', 'comm', 'more', 'When something’s on my mind', [o('I say it straight away', { r_seek: 80 }), o('I wait for the right moment', { r_seek: 35 })]),
  it('co3', 'comm', 'slider', 'My texting style', ends('Short and quick', { depth: 30 }, 'Long and detailed', { depth: 80 })),
  it('co4', 'comm', 'react', 'A friend seems quiet today but says they’re fine.', [
    o('Gently ask again later', { read_sense: 85 }), o('Take them at their word', { read_sense: 35, read_trust: 70 }),
    o('Try to cheer them up', { humor: 70, read_sense: 60 }), o('Give them some space', { att_avo: 55, read_sense: 55 })], { look: 'scenario' }),
  it('co5', 'comm', 'react', 'Someone makes a joke about you in a group.', [
    o('Laugh along', { humor: 80 }), o('Joke back', { humor: 85, r_fight: 40 }),
    o('Tell them later it wasn’t okay', { r_fix: 75 }), o('Let it pass', { rec_forgive: 70, r_fight: 15 })], { look: 'reaction' }),

  // ---------- 3. conflict ----------
  it('cf1', 'conflict', 'more', 'After an argument, I’d rather', [
    o('Talk it through now', { r_fix: 85, rec_speed: 70, r_withdraw: 20 }), o('Take time to cool down first', { r_withdraw: 60, rec_speed: 40, r_heat: 30, r_fix: 35 })], { anchor: true }),
  it('cf2', 'conflict', 'react', 'A friend cancels on you for the third time.', [
    o('Tell them it hurts', { r_fix: 80, r_heat: 40 }), o('Let it go, people get busy', { rec_forgive: 80, r_fight: 15, r_fix: 40 }),
    o('Make fewer plans with them', { r_withdraw: 75, rec_forgive: 30, r_fix: 25 }), o('Joke about it, but make the point', { humor: 70, r_fix: 60 })], { look: 'scenario' }),
  it('cf3', 'conflict', 'slider', 'In a disagreement, I usually', ends('Speak up straight away', { r_fight: 85 }, 'Keep the peace', { r_fight: 15 })),
  it('cf4', 'conflict', 'rank', 'What fixes things after a fight?', [
    o('A sincere sorry', { rec_apology: 85 }), o('A hug or a small gesture', { v_love: 75, rec_forgive: 70 }),
    o('Talking about what went wrong', { r_fix: 85 }), o('Some time apart first', { r_withdraw: 65, r_fix: 30 })]),
  it('cf5', 'conflict', 'react', 'Your partner spends a lot of money without telling you.', [
    o('Ask calmly what happened', { r_fix: 85, r_heat: 20 }), o('Tell them I’m upset', { r_fight: 70, r_heat: 60 }),
    o('Leave it, it’s their money', { r_withdraw: 45, dec_lead: 30, r_fix: 30 }), o('Agree how we’ll handle it next time', { r_fix: 75, dec_head: 70 })], { look: 'scenario' }),

  // ---------- 4. trust and boundaries (fits a friend or a partner) ----------
  it('tb1', 'trust', 'react', 'Someone close hasn’t replied in 6 hours.', [
    o('They’re busy, I’ll hear later', { att_anx: 20, read_trust: 75 }), o('Send one more message to check', { att_anx: 55 }),
    o('Call to make sure all is fine', { att_anx: 70, r_seek: 70 }), o('Get on with my day, I hardly notice', { att_avo: 65, att_anx: 15 })], { look: 'scenario', anchor: true }),
  it('tb2', 'trust', 'slider', 'In a close relationship, I like', ends('Most free evenings together', { att_avo: 15 }, 'Plenty of time apart', { att_avo: 85 })),
  it('tb3', 'trust', 'more', 'Phones in a relationship', [o('Open, nothing to hide', { boundary: 20 }), o('Private, even when we’re close', { boundary: 80 })]),
  it('tb4', 'trust', 'react', 'Someone you’re close to suddenly has a new best friend.', [
    o('Happy for them', { jealousy: 15, read_trust: 80 }), o('Curious, I’d ask about them', { jealousy: 40 }),
    o('I’d want to meet them', { jealousy: 55 }), o('I’d say if I feel left out', { r_seek: 70, jealousy: 50 })], { look: 'scenario' }),
  it('tb5', 'trust', 'rank', 'Loyalty means most when someone', [
    o('Keeps their promises', { integ: 85 }), o('Is there in hard times', { loyal: 85 }),
    o('Is honest even when it’s hard', { v_honesty: 85 }), o('Keeps what we share private', { integ: 80, loyal: 70 })]),
  // id lp3: the same trust line as v6, so older and newer Soul DNA compare on it
  it('lp3', 'trust', 'react', 'You’re seeing someone, and a person you find attractive flirts with you.', [
    o('Make it clear I’m taken', { integ: 90, boundary: 15 }, { s: 3 }), o('Stay friendly, nothing more', { integ: 65, boundary: 55 }, { s: 1 }),
    o('Mention it to my partner', { v_honesty: 80, integ: 80 }, { s: 2 }), o('Depends on the situation', { integ: 50, boundary: 60 }, { s: 1 })], { look: 'scenario', line: 'flirting' }),

  // ---------- 5. values ----------
  it('va0', 'values', 'rank', 'What matters most to you right now?', [
    o('Family', {}, { t: 'v_family' }), o('Career and growth', {}, { t: 'v_ambition' }),
    o('Freedom and travel', {}, { t: 'v_freedom' }), o('Love and partnership', {}, { t: 'v_love' })], { anchor: true }),
  it('va2', 'values', 'rank', 'And these?', [
    o('Faith and tradition', {}, { t: 'v_tradition' }), o('Money and security', {}, { t: 'v_security' }),
    o('Honesty', {}, { t: 'v_honesty' }), o('Helping others', {}, { t: 'b_A' })]),
  // ids va1 / va6 / va5: the same cards as v6, so older and newer Soul DNA compare on them
  it('va1', 'values', 'more', 'Which matters more?', [
    o('A dream job abroad', { v_ambition: 80, home_dir: 85, v_freedom: 65 }), o('Staying close to family', { v_family: 85, home_dir: 15 })], { firm: 'gt_home' }),
  it('va6', 'values', 'more', 'Which matters more?', [
    o('My family’s approval of my partner', { v_tradition: 80, v_family: 80 }), o('My own choice', { v_freedom: 85, v_tradition: 25 })], { firm: 'gt_family' }),
  it('va5', 'values', 'more', 'With money, I’m more likely to', [
    o('Enjoy it now on experiences', { v_security: 30, gt_money: 40 }), o('Save for later', { v_security: 85, gt_money: 70 })]),
  it('va7', 'values', 'react', 'A friend asks what you think of their business idea. You think it’s weak.', [
    o('Tell them honestly', { v_honesty: 85 }), o('Strong parts first, then the weak ones', { v_honesty: 70, read_sense: 70 }),
    o('Ask questions so they spot it', { read_sense: 75, curiosity: 60 }), o('Back them, they’ll learn by doing', { b_A: 70, v_honesty: 40 })], { look: 'scenario' }),

  // ---------- 6. lifestyle ----------
  it('li1', 'lifestyle', 'slider', 'My body clock', ends('Early bird', { chrono: 10 }, 'Night owl', { chrono: 90 }), { anchor: true }),
  it('li2', 'lifestyle', 'day', 'Build your ideal day', [], { slots: [
    { name: 'Morning', options: [o('Sunrise run', { chrono: 15, energy: 75 }), o('Slow breakfast', { chrono: 45 }), o('Sleep in', { chrono: 85 })] },
    { name: 'Afternoon', options: [o('Work on something', { v_ambition: 70 }), o('Explore somewhere new', { adventure: 80 }), o('Rest at home', { energy: 25 })] },
    { name: 'Evening', options: [o('Friends out', { energy: 85, b_E: 75 }), o('Family dinner', { v_family: 75 }), o('Movie in', { energy: 30 })] },
  ] }),
  it('li3', 'lifestyle', 'more', 'My weekends are', [o('Planned ahead', { b_C: 80, adventure: 35 }), o('Decided on the day', { b_C: 30, adventure: 75 })]),
  it('li4', 'lifestyle', 'slider', 'My room right now', ends('Neat and organised', { b_C: 85 }, 'Relaxed about mess', { b_C: 25 })),
  it('li5', 'lifestyle', 'habits', 'Quick taps about you', []),

  // ---------- 7. interests (preference data only: a shared-interests bonus, never a personality trait) ----------
  it('in1', 'interests', 'tiles', 'Pick 3 you’d happily spend a Sunday on', INTEREST_TILES.map(([label, icon]) => o(label, {}, { tag: label, icon })), { max: 3 }),
  it('in2', 'interests', 'react', 'Pick one you could talk about for an hour', [
    o('A film that changed how you think', { depth: 65 }, { tag: 'Movies' }), o('The best trip you’ve taken', { adventure: 70 }, { tag: 'Travel' }),
    o('An idea you’d build one day', { v_ambition: 65 }, { tag: 'Tech and startups' }), o('Your favourite food spot in the city', {}, { tag: 'Food hunting' })], { look: 'cards' }),
  it('in3', 'interests', 'rank', 'A free Sunday afternoon', [
    o('Watch a match', {}, { tag: 'Cricket' }), o('Try a new café', {}, { tag: 'Food hunting' }),
    o('Learn something new', { curiosity: 75 }), o('A road trip', { adventure: 75 }, { tag: 'Travel' })]),

  // ---------- 8. relationship expectations ----------
  it('re1', 'expect', 'slider', 'When I like someone, I prefer to', ends('Take it slow and get to know them', { intent_pace: 20 }, 'Know quickly where it’s going', { intent_pace: 85 })),
  it('re2', 'expect', 'react', 'In the next couple of years, I see myself', [
    o('Focused on my career first', { v_ambition: 75, intent_serious: 40 }, { key: 'career' }), o('In a steady relationship', { intent_serious: 75 }, { key: 'steady' }),
    o('Married or close to it', { intent_serious: 90, intent_family: 75 }, { key: 'married' }), o('Open, seeing where life goes', { intent_serious: 35 }, { key: 'open' })], { look: 'fits' }),
  it('re3', 'expect', 'react', 'Kids someday?', [
    o('Want kids', { intent_family: 92, v_family: 70 }, { key: 'want' }), o('Don’t want kids', { intent_family: 8 }, { key: 'no' }),
    o('Open to it', { intent_family: 50 }, { key: 'open' }), o('Prefer not to say', {}, { key: 'private' })], { look: 'fits', noSkip: true }),
  it('re4', 'expect', 'more', 'I click more with someone who is', [o('Similar to me', { pref_similar: 80 }), o('Different, and balances me out', { pref_similar: 20 })]),
  it('re5', 'expect', 'needs', 'What do you need in a partner?', []),
];
export const SCENARIO_MAP = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
export const ANCHORS = SCENARIOS.filter((s) => s.anchor).map((s) => s.id);
export const NO_SKIP = new Set(['habits', 'needs']);

// ---------- who plays what ----------
// The first session: 11 activities, about 3 minutes. One slot after another; where a slot offers several
// activities, which one a person gets comes from a hash of their id (stable for them, varied across people).
const FIRST = [
  ['so1', 'so4'], ['so2'], ['co1', 'co2', 'co3', 'co4', 'co5'],
  ['cf1'], ['cf2', 'cf3', 'cf4', 'cf5'],
  ['tb1'], ['tb2', 'tb3', 'tb4', 'tb5', 'lp3'],
  ['va0'], ['li1'], ['in1'], ['re5'],
];
export const FIRST_SIZE = FIRST.length;
/** Asked the first time someone sends a dating / life-partner Connect request (and in later check-ins). */
export const COUPLE_FIRST = ['re2', 're3'];
function hash(s) { let h = 2166136261; for (const c of String(s || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** The first session for a person (ids, in order). seed: their user id. */
export function planFor(seed = '') {
  const h = hash(typeof seed === 'string' ? seed : '');
  return FIRST.map((slot, k) => slot[((h >>> ((k % 8) * 4)) + k) % slot.length]);
}
