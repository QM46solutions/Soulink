// Soul DNA v4: the scenario bank. Each scenario is a real-life moment; each choice quietly moves the person's
// mind model on one or more TRAITS (0-100). Nobody sees these numbers: the app only gets the text of the choices.
// Every scenario also offers "Anything else…" (typed): kept for review, it adds no evidence to the model.
//
// TRAITS (what we model about how a person thinks, acts and reacts)
//  intention  intent_serious (casual → serious), intent_pace (slow → fast), intent_family (wants a family life)
//  values     v_family, v_freedom, v_security, v_ambition, v_love, v_honesty, v_tradition   (what wins when they clash)
//  reading    read_trust (assumes bad intent → good intent), read_sense (misses moods → reads people), jealousy
//  reaction   r_fight, r_withdraw, r_fix, r_seek (how they react when hurt or stressed), r_heat (calm → explosive)
//  recovery   rec_speed (stays upset long → recovers fast), rec_apology, rec_forgive
//  decide     dec_head (heart → head), dec_risk (careful → takes risks), dec_lead (follows → leads)
//  givetake   gt_money, gt_family, gt_home, gt_social, gt_career (flexible → never moves), home_dir (near family → anywhere)
//  loyalty    integ (gives in to temptation → never), loyal (moves on → sticks with people), boundary (strict → loose about flirting)
//  vibe       energy (introvert → extrovert), humor (serious → playful), curiosity (routine → new things), adventure (safe → thrills), depth (light talk → deep talk)

export const LAYERS = [
  { key: 'intention', title: 'What you want', emoji: '🎯' },
  { key: 'values', title: 'What wins for you', emoji: '🛡️' },
  { key: 'reading', title: 'How you read people', emoji: '👁️' },
  { key: 'reaction', title: 'How you react', emoji: '⚡' },
  { key: 'recovery', title: 'How you recover', emoji: '🩹' },
  { key: 'decide', title: 'How you decide', emoji: '🧭' },
  { key: 'givetake', title: 'Give and take', emoji: '⚖️' },
  { key: 'loyalty', title: 'Loyalty', emoji: '🔒' },
  { key: 'vibe', title: 'Your vibe', emoji: '✨' },
];

export const TRAITS = {
  intent_serious: 'intention', intent_pace: 'intention', intent_family: 'intention',
  v_family: 'values', v_freedom: 'values', v_security: 'values', v_ambition: 'values', v_love: 'values', v_honesty: 'values', v_tradition: 'values',
  read_trust: 'reading', read_sense: 'reading', jealousy: 'reading',
  r_fight: 'reaction', r_withdraw: 'reaction', r_fix: 'reaction', r_seek: 'reaction', r_heat: 'reaction',
  rec_speed: 'recovery', rec_apology: 'recovery', rec_forgive: 'recovery',
  dec_head: 'decide', dec_risk: 'decide', dec_lead: 'decide',
  gt_money: 'givetake', gt_family: 'givetake', gt_home: 'givetake', gt_social: 'givetake', gt_career: 'givetake', home_dir: 'givetake',
  integ: 'loyalty', loyal: 'loyalty', boundary: 'loyalty',
  energy: 'vibe', humor: 'vibe', curiosity: 'vibe', adventure: 'vibe', depth: 'vibe',
};

const sc = (id, layer, text, options) => ({ id, layer, text, options: options.map(([label, set]) => ({ label, set })) });

export const SCENARIOS = [
  // ---------- intention ----------
  sc('in1', 'intention', 'Three months of talking to someone you really like. They ask, "So what are we?" You…', [
    ['Feel relieved. I was waiting to make it official', { intent_serious: 90, intent_pace: 70 }],
    ['Say I like where it is, let’s not rush labels', { intent_serious: 50, intent_pace: 25 }],
    ['Feel a bit trapped. I liked it light', { intent_serious: 15, v_freedom: 80 }],
    ['Ask them what they want first', { intent_serious: 55, dec_lead: 25, read_sense: 65 }]]),
  sc('in2', 'intention', 'Picture yourself at 35. The picture that makes you happiest is…', [
    ['A home, a partner, kids running around', { intent_family: 92, v_family: 80 }],
    ['A partner and lots of travel, kids maybe later', { intent_family: 55, adventure: 75 }],
    ['A big career and my own space', { intent_family: 25, v_ambition: 85, v_freedom: 70 }],
    ['No fixed picture, I go where life takes me', { intent_family: 40, curiosity: 75, dec_risk: 65 }]]),
  sc('in3', 'intention', 'Someone you matched with wants to meet their family within two months. You think…', [
    ['That’s a good sign, they’re serious', { intent_pace: 85, intent_serious: 85, v_tradition: 70 }],
    ['Too soon, but I’d do it if it matters to them', { intent_pace: 50, gt_family: 30 }],
    ['Way too fast for me', { intent_pace: 15, v_freedom: 70 }],
    ['Only if I already feel sure', { intent_pace: 40, dec_head: 70 }]]),
  sc('in4', 'intention', 'Why are you really on Soulink right now?', [
    ['To find the person I’ll spend my life with', { intent_serious: 95, intent_family: 75 }],
    ['To date and see who clicks', { intent_serious: 50, curiosity: 65 }],
    ['Mostly for friends and good company', { intent_serious: 30, energy: 65 }],
    ['Honestly, curiosity and fun', { intent_serious: 12, adventure: 70 }]]),
  sc('in5', 'intention', 'Marriage, for you, is…', [
    ['Something I want in the next few years', { intent_serious: 85, intent_family: 85, intent_pace: 75 }],
    ['Something I want with the right person, no rush', { intent_serious: 70, intent_family: 65, intent_pace: 35 }],
    ['Not sure it’s for me', { intent_serious: 35, intent_family: 30, v_freedom: 70 }],
    ['A tradition I’ll follow when my family says it’s time', { intent_family: 75, v_tradition: 85, gt_family: 20 }]]),
  sc('in6', 'intention', 'A great first date. Next morning you…', [
    ['Text them first thing, I don’t play games', { intent_pace: 80, v_honesty: 75 }],
    ['Wait for them to text', { intent_pace: 30, dec_lead: 20 }],
    ['Text, but casually, to keep it cool', { intent_pace: 50, read_sense: 60 }],
    ['Plan the next date already', { intent_pace: 85, dec_lead: 85, intent_serious: 75 }]]),

  // ---------- values (trade-offs: what wins) ----------
  sc('va1', 'values', 'A dream job abroad, but your parents are getting older and want you nearby. You…', [
    ['Take it. I’ll visit often', { v_ambition: 85, v_family: 35, home_dir: 85 }],
    ['Stay. Family comes first', { v_family: 92, v_ambition: 35, home_dir: 15 }],
    ['Take it for two years, then come back', { v_ambition: 70, v_family: 65, dec_head: 70 }],
    ['Take it and bring them with me', { v_family: 80, v_ambition: 80, dec_lead: 75 }]]),
  sc('va2', 'values', 'You can have one: a ₹40L flat now with a big loan, or rent and travel the world for a year.', [
    ['The flat. Security first', { v_security: 90, adventure: 25, dec_risk: 20 }],
    ['The year of travel', { v_freedom: 85, adventure: 90, v_security: 25 }],
    ['Neither, I’d invest it', { v_security: 70, dec_head: 85 }],
    ['Whatever my partner wants more', { v_love: 80, gt_money: 15 }]]),
  sc('va3', 'values', 'Your best friend’s partner is cheating. Your friend hasn’t noticed. You…', [
    ['Tell them now. They deserve the truth', { v_honesty: 92, loyal: 80 }],
    ['Confront the partner first', { v_honesty: 75, dec_lead: 80, r_fight: 60 }],
    ['Stay out of it, not my business', { v_honesty: 25, r_withdraw: 60 }],
    ['Drop hints and hope they figure it out', { v_honesty: 45, r_withdraw: 55 }]]),
  sc('va4', 'values', 'Your partner’s family wants a traditional wedding with every ritual. You…', [
    ['Love it, traditions matter', { v_tradition: 90, gt_family: 25 }],
    ['Fine, it makes them happy', { v_tradition: 55, v_love: 75, gt_family: 15 }],
    ['I want a small simple one, I’ll push for it', { v_tradition: 20, gt_family: 75, dec_lead: 70 }],
    ['We decide, not the families', { v_freedom: 75, gt_family: 80, v_tradition: 30 }]]),
  sc('va5', 'values', 'You find ₹50,000 cash in an auto with the owner’s phone number in the bag. You…', [
    ['Call them right away', { v_honesty: 95, integ: 90 }],
    ['Give it to the police station', { v_honesty: 85, v_security: 60 }],
    ['Keep a little as a “reward”, return the rest', { v_honesty: 40, integ: 40 }],
    ['Finders keepers', { v_honesty: 8, integ: 10 }]]),
  sc('va6', 'values', 'Your partner earns much more than you and wants you to quit and travel with them. You…', [
    ['Never. My work is my identity', { v_ambition: 90, v_freedom: 75, gt_career: 85 }],
    ['Maybe for a few months', { v_love: 70, gt_career: 45, adventure: 70 }],
    ['Yes, life is short', { v_love: 80, adventure: 85, gt_career: 15 }],
    ['Only if we have a money plan for later', { v_security: 85, dec_head: 80 }]]),
  sc('va7', 'values', 'Which hurts more?', [
    ['Being lied to by someone I love', { v_honesty: 90, v_love: 60 }],
    ['Being controlled by someone I love', { v_freedom: 90 }],
    ['Being ignored by someone I love', { v_love: 85, r_seek: 70 }],
    ['Being embarrassed in front of my family', { v_family: 80, v_tradition: 75 }]]),
  sc('va8', 'values', 'A friend offers you a share in their startup: big if it works, your savings gone if not. You…', [
    ['In. Fortune favours the brave', { dec_risk: 90, v_ambition: 80, v_security: 20 }],
    ['A small amount only', { dec_risk: 50, dec_head: 70 }],
    ['No, I don’t gamble savings', { dec_risk: 10, v_security: 90 }],
    ['I’d ask my family first', { v_family: 75, dec_lead: 30, gt_family: 20 }]]),
  sc('va9', 'values', 'Weekend choice: your cousin’s engagement, or a once-in-a-lifetime concert with friends?', [
    ['The engagement, obviously', { v_family: 88, v_tradition: 75 }],
    ['The concert. Family will understand', { v_freedom: 75, adventure: 70, v_family: 35 }],
    ['Engagement first, concert if I can make it', { v_family: 70, rec_speed: 60, curiosity: 60 }],
    ['Whichever my partner is going to', { v_love: 80 }]]),

  // ---------- reading people ----------
  sc('re1', 'reading', 'Your partner replies “ok.” instead of their usual long message. You think…', [
    ['They’re busy, no big deal', { read_trust: 85, jealousy: 15 }],
    ['Something’s wrong. I’ll check in gently', { read_sense: 85, r_seek: 55 }],
    ['Did I do something? I replay the whole chat', { read_trust: 35, r_seek: 70, jealousy: 50 }],
    ['They’re being cold. Two can play that game', { read_trust: 20, r_withdraw: 70, r_heat: 55 }]]),
  sc('re2', 'reading', 'Your partner laughs a lot with a new colleague at a party. You…', [
    ['Happy they’re having fun', { jealousy: 10, read_trust: 85 }],
    ['Notice it, but say nothing', { jealousy: 50, r_withdraw: 55 }],
    ['Go and join the conversation', { jealousy: 50, dec_lead: 70, energy: 70 }],
    ['Bring it up later, it bothered me', { jealousy: 75, v_honesty: 65 }]]),
  sc('re3', 'reading', 'A friend cancels plans last minute for the third time. Your first thought:', [
    ['Something must be going on with them', { read_trust: 85, read_sense: 75 }],
    ['They don’t value me', { read_trust: 25, r_withdraw: 55 }],
    ['I’ll ask them straight what’s up', { v_honesty: 75, r_fix: 70 }],
    ['Fine, I’ll stop making plans with them', { rec_forgive: 25, r_withdraw: 70 }]]),
  sc('re4', 'reading', 'At a family dinner, your partner goes quiet. Nobody else notices. You…', [
    ['Notice right away and squeeze their hand', { read_sense: 92 }],
    ['Ask them about it on the way home', { read_sense: 75, r_fix: 65 }],
    ['Probably wouldn’t notice', { read_sense: 20 }],
    ['Notice, but wait for them to tell me', { read_sense: 70, r_withdraw: 45 }]]),
  sc('re5', 'reading', 'Your partner wants to keep their phone password private. You feel…', [
    ['Totally fine, everyone needs privacy', { jealousy: 10, read_trust: 85, boundary: 60 }],
    ['A bit uneasy, but I trust them', { jealousy: 45, read_trust: 65 }],
    ['Why hide it if there’s nothing to hide?', { jealousy: 80, read_trust: 30 }],
    ['I’d want the same privacy, so fair', { v_freedom: 75, jealousy: 20 }]]),
  sc('re6', 'reading', 'Someone gives you a compliment out of the blue. You think…', [
    ['That’s sweet', { read_trust: 85 }],
    ['What do they want?', { read_trust: 20 }],
    ['Nice, but I don’t really believe it', { read_trust: 45, depth: 60 }],
    ['I give one back right away', { energy: 70, humor: 60, read_trust: 70 }]]),
  sc('re7', 'reading', 'Your partner says “I’m fine” but slams the cupboard door. You…', [
    ['Give them space, they’ll talk when ready', { read_sense: 70, r_withdraw: 45 }],
    ['Sit with them: “You don’t seem fine”', { read_sense: 85, r_fix: 75 }],
    ['Take them at their word', { read_sense: 20 }],
    ['Get annoyed: just say what’s wrong', { r_heat: 70, r_fight: 65 }]]),

  // ---------- reaction under triggers ----------
  sc('ra1', 'reaction', 'Your partner forgets your birthday. Completely. You…', [
    ['Tell them how much it hurt', { r_seek: 70, v_honesty: 70 }],
    ['Go quiet and wait for them to notice', { r_withdraw: 85 }],
    ['Lose it. How could they?', { r_fight: 85, r_heat: 85 }],
    ['Plan something myself and move on', { r_fix: 80, rec_speed: 80 }]]),
  sc('ra2', 'reaction', 'A big argument starts at 11 pm. You…', [
    ['Need to sort it out tonight', { r_seek: 70, r_fix: 60, rec_speed: 60 }],
    ['Need to sleep on it', { r_withdraw: 70, rec_speed: 40, dec_head: 65 }],
    ['Keep arguing until I win', { r_fight: 90, r_heat: 70 }],
    ['Say sorry just to end it', { r_withdraw: 55, rec_apology: 70, v_honesty: 35 }]]),
  sc('ra3', 'reaction', 'Work stress is crushing you this week. You want your partner to…', [
    ['Hold me and listen', { r_seek: 85 }],
    ['Leave me alone until it passes', { r_withdraw: 85 }],
    ['Help me make a plan', { r_fix: 85, dec_head: 70 }],
    ['Take me out, distract me', { energy: 70, adventure: 60, r_seek: 50 }]]),
  sc('ra4', 'reaction', 'Someone cuts in front of you in a long queue. You…', [
    ['Tell them off loudly', { r_fight: 85, r_heat: 85 }],
    ['Politely ask them to go to the back', { r_fix: 80, dec_lead: 70, r_heat: 25 }],
    ['Grumble but let it go', { r_withdraw: 70, r_heat: 35 }],
    ['Make a joke about it', { humor: 85, r_heat: 15 }]]),
  sc('ra5', 'reaction', 'Your partner criticises your cooking in front of friends. You…', [
    ['Laugh it off there, talk later', { r_fix: 70, r_heat: 25, read_sense: 60 }],
    ['Snap back right there', { r_fight: 85, r_heat: 80 }],
    ['Go quiet for the rest of the night', { r_withdraw: 85 }],
    ['Tell them on the spot that it hurt', { r_seek: 60, v_honesty: 80 }]]),
  sc('ra6', 'reaction', 'Plans fall apart at the last minute: the trip is cancelled. You…', [
    ['Make a new plan right away', { r_fix: 85, rec_speed: 85, dec_lead: 70 }],
    ['Sulk for a day', { rec_speed: 25, r_withdraw: 60 }],
    ['Get angry at whoever caused it', { r_fight: 75, r_heat: 70 }],
    ['Call a friend to vent', { r_seek: 80, energy: 65 }]]),
  sc('ra7', 'reaction', 'In a fight, your partner says something really hurtful. You…', [
    ['Say something just as hurtful back', { r_fight: 85, r_heat: 85 }],
    ['Leave the room', { r_withdraw: 80, r_heat: 30 }],
    ['Stop and say: “That hurt. Can we pause?”', { r_seek: 60, r_fix: 75, r_heat: 15 }],
    ['Cry, and let them see it', { r_seek: 80, depth: 60 }]]),

  // ---------- recovery ----------
  sc('rc1', 'recovery', 'After a fight, how long until you feel normal again?', [
    ['A few minutes', { rec_speed: 92 }],
    ['A few hours', { rec_speed: 65 }],
    ['A day or two', { rec_speed: 35 }],
    ['Longer, I replay it a lot', { rec_speed: 12, depth: 65 }]]),
  sc('rc2', 'recovery', 'You realise you were wrong in yesterday’s argument. You…', [
    ['Say sorry first thing', { rec_apology: 92, v_honesty: 75 }],
    ['Show it by being extra nice, no words', { rec_apology: 50, r_withdraw: 45 }],
    ['Hope it blows over', { rec_apology: 20 }],
    ['Explain why I reacted that way', { rec_apology: 55, dec_head: 70 }]]),
  sc('rc3', 'recovery', 'A close friend betrayed your trust once, a year ago, and has apologised many times. Now…', [
    ['We’re close again, people make mistakes', { rec_forgive: 90, loyal: 75 }],
    ['Friendly, but never as close', { rec_forgive: 50, read_trust: 45 }],
    ['They’re out of my life', { rec_forgive: 10, loyal: 30 }],
    ['I forgave, but I watch them now', { rec_forgive: 60, read_trust: 35 }]]),
  sc('rc4', 'recovery', 'Your partner apologises with flowers after a big fight. You…', [
    ['Melt. All forgiven', { rec_forgive: 85, rec_speed: 80 }],
    ['Appreciate it, but we still need to talk', { r_fix: 75, rec_forgive: 65 }],
    ['Flowers don’t fix it, change does', { rec_forgive: 35, dec_head: 70 }],
    ['Stay cold a little longer so they learn', { rec_forgive: 25, r_withdraw: 60, r_heat: 45 }]]),
  sc('rc5', 'recovery', 'Old fights: do you bring them up again later?', [
    ['Never, once it’s done it’s done', { rec_forgive: 90, rec_speed: 75 }],
    ['Only if the same thing happens again', { rec_forgive: 65 }],
    ['Sometimes, when I’m angry', { rec_forgive: 40, r_heat: 60 }],
    ['Yes, I don’t forget', { rec_forgive: 15 }]]),
  sc('rc6', 'recovery', 'You snapped at someone because you were tired. Later you…', [
    ['Call and say sorry', { rec_apology: 90 }],
    ['Feel bad but say nothing', { rec_apology: 30, r_withdraw: 55 }],
    ['It’s fine, they know I was tired', { rec_apology: 20, read_trust: 65 }],
    ['Make it up with a treat', { rec_apology: 60, humor: 60 }]]),

  // ---------- decisions ----------
  sc('de1', 'decide', 'Buying a phone. You…', [
    ['Compare specs and reviews for a week', { dec_head: 90, dec_risk: 15 }],
    ['Pick the one that feels right', { dec_head: 20, dec_risk: 60 }],
    ['Ask friends and go with the majority', { dec_lead: 20, energy: 60 }],
    ['Get the newest one on launch day', { dec_risk: 80, curiosity: 85 }]]),
  sc('de2', 'decide', 'Group trip, nobody can decide where to go. You…', [
    ['Pick a place and book it', { dec_lead: 92, dec_risk: 65 }],
    ['Make a poll', { dec_lead: 55, dec_head: 70 }],
    ['Go with whatever they decide', { dec_lead: 10, gt_social: 15 }],
    ['Suggest two options and let them choose', { dec_lead: 65, read_sense: 60 }]]),
  sc('de3', 'decide', 'Your gut says no about a person everyone else loves. You…', [
    ['Trust my gut', { dec_head: 15, read_trust: 35 }],
    ['Give them a fair chance first', { dec_head: 70, read_trust: 70 }],
    ['Go with the group', { dec_lead: 20 }],
    ['Watch quietly and decide later', { dec_head: 80, read_sense: 70 }]]),
  sc('de4', 'decide', 'Two job offers: higher pay at a boring company, or less pay at an exciting startup.', [
    ['Higher pay, stability', { v_security: 85, dec_risk: 20 }],
    ['The startup, I want to grow', { dec_risk: 80, v_ambition: 80, curiosity: 75 }],
    ['Whichever my family advises', { v_family: 70, dec_lead: 20 }],
    ['I’d negotiate both and then decide', { dec_head: 90, dec_lead: 75 }]]),
  sc('de5', 'decide', 'A big decision for both of you (moving cities). How should it be made?', [
    ['I research and propose, we decide together', { dec_lead: 75, dec_head: 80 }],
    ['Whoever cares more decides', { gt_home: 25, read_sense: 60 }],
    ['We sit and talk until we agree', { r_fix: 75, gt_home: 50 }],
    ['I decide what’s best for us', { dec_lead: 92, gt_home: 85 }]]),
  sc('de6', 'decide', 'You have a free Sunday with no plans. You…', [
    ['Plan it hour by hour', { dec_head: 75, adventure: 35 }],
    ['Wake up and see what I feel like', { dec_head: 25, curiosity: 60 }],
    ['Try something I’ve never done', { curiosity: 90, adventure: 80, dec_risk: 70 }],
    ['Rest. Proper rest', { energy: 20, adventure: 15 }]]),

  // ---------- give and take (who leads, who bends) ----------
  sc('gt1', 'givetake', 'You want to save for a house; your partner wants a new bike now. You…', [
    ['Hold my ground: the house comes first', { gt_money: 85, v_security: 85 }],
    ['Meet halfway: a cheaper bike and a savings plan', { gt_money: 45, r_fix: 75 }],
    ['Let them get it, it makes them happy', { gt_money: 10, v_love: 80 }],
    ['Their money, their choice', { gt_money: 30, v_freedom: 75 }]]),
  sc('gt2', 'givetake', 'After marriage, your parents want you to live with them. Your partner wants your own place. You…', [
    ['Live with my parents, that’s non-negotiable', { gt_family: 92, v_family: 90, home_dir: 15 }],
    ['Our own place close to my parents', { gt_family: 50, home_dir: 35, r_fix: 70 }],
    ['Our own place, my partner matters more here', { gt_family: 15, v_love: 80, home_dir: 60 }],
    ['Try living together for a year, then decide', { gt_family: 40, dec_head: 70 }]]),
  sc('gt3', 'givetake', 'Your partner wants to move to another city for their career. You love where you live. You…', [
    ['I’m not moving. They should find work here', { gt_home: 90, home_dir: 15 }],
    ['I’d move, home is where they are', { gt_home: 10, v_love: 85, home_dir: 80 }],
    ['Long distance for a while, then see', { gt_home: 60, v_freedom: 60 }],
    ['Move if I can keep my own work', { gt_home: 45, gt_career: 70 }]]),
  sc('gt4', 'givetake', 'Your partner loves big weekend parties; you’d rather stay in. You…', [
    ['Go with them most weekends', { gt_social: 15, v_love: 75 }],
    ['Alternate: one weekend their way, one mine', { gt_social: 45, r_fix: 70 }],
    ['Stay home, they can go without me', { gt_social: 70, v_freedom: 75 }],
    ['Ask them to party less', { gt_social: 90, dec_lead: 75 }]]),
  sc('gt5', 'givetake', 'A promotion needs late nights for a year. Your partner says it’s too much. You…', [
    ['Take it, my career can’t wait', { gt_career: 90, v_ambition: 90 }],
    ['Take it, but protect two evenings a week for us', { gt_career: 50, r_fix: 80 }],
    ['Say no, the relationship matters more', { gt_career: 10, v_love: 85 }],
    ['Ask for a different role with fewer hours', { gt_career: 40, dec_head: 75 }]]),
  sc('gt6', 'givetake', 'Your family dislikes your partner’s habit of speaking their mind. You…', [
    ['Ask my partner to tone it down around them', { gt_family: 70, v_family: 75 }],
    ['Defend my partner to my family', { gt_family: 25, v_love: 80, dec_lead: 70 }],
    ['Stay out of it', { gt_family: 50, r_withdraw: 70 }],
    ['Get them talking directly', { r_fix: 80, dec_lead: 70 }]]),
  sc('gt7', 'givetake', 'Diwali this year: your family’s home or your partner’s? You…', [
    ['Mine, always. That’s fixed', { gt_family: 90, v_tradition: 80 }],
    ['Alternate every year', { gt_family: 40, r_fix: 70 }],
    ['Whichever matters more to them this year', { gt_family: 20, read_sense: 70 }],
    ['Our own celebration, just us', { v_freedom: 75, v_tradition: 25 }]]),
  sc('gt8', 'givetake', 'Your partner wants you to share all your passwords and finances. You…', [
    ['Sure, nothing to hide', { gt_money: 20, read_trust: 75, boundary: 30 }],
    ['Finances yes, phone no', { gt_money: 50, v_freedom: 60 }],
    ['No, some things stay mine', { gt_money: 80, v_freedom: 85 }],
    ['Only if they share theirs first', { read_trust: 35, gt_money: 60 }]]),
  sc('gt9', 'givetake', 'When you and your partner disagree on something small, who usually gives in?', [
    ['Me, most of the time', { gt_social: 20, gt_money: 25, dec_lead: 20 }],
    ['Them, I usually get my way', { gt_social: 75, gt_money: 70, dec_lead: 85 }],
    ['Whoever cares more that day', { gt_social: 40, gt_money: 40, read_sense: 70 }],
    ['Neither, we argue it out', { r_fight: 70, gt_social: 70, gt_money: 70 }]]),

  // ---------- loyalty & integrity ----------
  sc('lo1', 'loyalty', 'On a work trip, someone attractive flirts with you. Nobody would ever know. You…', [
    ['Shut it down immediately', { integ: 95, boundary: 10 }],
    ['Enjoy the attention, nothing more', { integ: 60, boundary: 65 }],
    ['Flirt back a little, it’s harmless', { integ: 35, boundary: 85 }],
    ['It depends how things are at home', { integ: 20, boundary: 75 }]]),
  sc('lo2', 'loyalty', 'Your ex messages “I miss you” while you’re in a relationship. You…', [
    ['Don’t reply, and tell my partner', { integ: 92, v_honesty: 85 }],
    ['Reply politely and end it there', { integ: 70, boundary: 40 }],
    ['Chat a bit, for old times’ sake', { integ: 30, boundary: 80 }],
    ['Don’t reply, and keep it to myself', { integ: 75, v_honesty: 40 }]]),
  sc('lo3', 'loyalty', 'A friend is going through a bad phase and has become hard to be around. You…', [
    ['Stick around, that’s what friends do', { loyal: 92 }],
    ['Check in now and then', { loyal: 60 }],
    ['Give them distance until they’re better', { loyal: 35, r_withdraw: 60 }],
    ['Move on, I need positive people', { loyal: 12, v_freedom: 60 }]]),
  sc('lo4', 'loyalty', 'Being on dating apps while in a new relationship that isn’t “official” yet is…', [
    ['Not okay. If I’m talking to you, I’m only talking to you', { boundary: 10, integ: 85, intent_serious: 80 }],
    ['Okay until we agree to be exclusive', { boundary: 55, dec_head: 65 }],
    ['Totally normal, keep options open', { boundary: 85, intent_serious: 25 }],
    ['Okay for them, not for me', { boundary: 30, jealousy: 40 }]]),
  sc('lo5', 'loyalty', 'Your manager asks you to quietly take credit for a colleague’s idea. You…', [
    ['Refuse and give the colleague credit', { integ: 92, v_honesty: 90 }],
    ['Do it this once, I need the promotion', { integ: 30, v_ambition: 80 }],
    ['Tell the colleague so they can speak up', { integ: 75, r_fix: 70 }],
    ['Stay quiet and avoid it', { integ: 50, r_withdraw: 70 }]]),
  sc('lo6', 'loyalty', 'Your partner’s friend tells you a secret about your partner. You…', [
    ['Tell my partner I know', { v_honesty: 85, loyal: 70 }],
    ['Keep it, and wait for my partner to tell me', { loyal: 70, read_trust: 70 }],
    ['Ask the friend for more details', { read_trust: 30, jealousy: 60 }],
    ['Use it in our next fight', { r_fight: 75, integ: 25 }]]),

  // ---------- vibe ----------
  sc('vi1', 'vibe', 'Friday night, no plans. You…', [
    ['Call the whole gang out', { energy: 92, adventure: 65 }],
    ['Biryani and a movie with one close friend', { energy: 45, depth: 65 }],
    ['Work on something I’m building', { v_ambition: 75, energy: 30, curiosity: 65 }],
    ['Headphones, journal, deep thoughts', { energy: 10, depth: 85 }]]),
  sc('vi2', 'vibe', 'Your sense of humour is mostly…', [
    ['Memes and silly jokes', { humor: 88 }],
    ['Dry and sarcastic', { humor: 65, depth: 60 }],
    ['Laughing at myself', { humor: 75, read_trust: 65 }],
    ['I’m more the serious one', { humor: 15, depth: 70 }]]),
  sc('vi3', 'vibe', 'At a party where you know nobody, you…', [
    ['Talk to everyone', { energy: 92, curiosity: 70 }],
    ['Find one person and talk all night', { energy: 45, depth: 80 }],
    ['Stay near the snacks and leave early', { energy: 12 }],
    ['Dance', { energy: 80, adventure: 75, humor: 60 }]]),
  sc('vi4', 'vibe', 'A perfect conversation is about…', [
    ['Life, purpose, the universe', { depth: 92, curiosity: 75 }],
    ['Gossip, movies, fun stuff', { depth: 20, humor: 75 }],
    ['Plans and ideas, business, the future', { v_ambition: 75, curiosity: 70, depth: 60 }],
    ['Anything, as long as we laugh', { humor: 85, energy: 65 }]]),
  sc('vi5', 'vibe', 'Holiday choice:', [
    ['Trekking in the Himalayas', { adventure: 90, curiosity: 75 }],
    ['A beach resort, do nothing', { adventure: 20, energy: 35 }],
    ['A new country, new food, new everything', { curiosity: 92, adventure: 75 }],
    ['Back home to family', { v_family: 80, adventure: 20 }]]),
  sc('vi6', 'vibe', 'Someone suggests skydiving this weekend. You…', [
    ['Already packing', { adventure: 95, dec_risk: 85 }],
    ['Scared, but I’d try it', { adventure: 70, curiosity: 70 }],
    ['I’ll cheer from the ground', { adventure: 25, humor: 55 }],
    ['Absolutely not', { adventure: 5, dec_risk: 10 }]]),
  sc('vi7', 'vibe', 'Your phone screen time is mostly…', [
    ['Reels and YouTube', { depth: 30, energy: 45 }],
    ['Chatting with people', { energy: 75 }],
    ['Reading, learning, podcasts', { curiosity: 85, depth: 75 }],
    ['I barely use my phone', { energy: 40, depth: 60, curiosity: 55 }]]),
  sc('vi8', 'vibe', 'You get a free evening in a new city. You…', [
    ['Explore the streets and street food', { curiosity: 90, adventure: 70 }],
    ['Find the best-rated restaurant', { dec_head: 70, curiosity: 55 }],
    ['Stay in and order room service', { energy: 15, adventure: 15 }],
    ['Find a local event or meetup', { energy: 85, curiosity: 80 }]]),
];

export const SCENARIO_MAP = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
