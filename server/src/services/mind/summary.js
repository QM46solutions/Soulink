// Soul DNA v7: a person's mind model in plain words ("how you think"), for their own Soul DNA page and profile.
// Results are tendencies with how sure Soul DNA is, never verdicts (categories()).
import { LAYERS, TRAITS } from './scenarios.js';
import { AREAS } from './match.js';
import { tensions } from './model.js';

const v = (P, t) => P.traits?.[t]?.m ?? 50;
const sure = (P, t) => (P.traits?.[t]?.c ?? 0) >= 0.3;
const VALUE_LABEL = { v_family: 'family', v_freedom: 'freedom', v_security: 'security', v_ambition: 'ambition', v_love: 'love', v_honesty: 'honesty', v_tradition: 'tradition' };
const MODE = [['r_fight', 'you say it straight away, sometimes heatedly', 'they say it straight away, sometimes heatedly'], ['r_withdraw', 'you go quiet and need space first', 'they go quiet and need space first'], ['r_fix', 'you look for a fix right away', 'they look for a fix right away'], ['r_seek', 'you need to talk it out and feel comforted', 'they need to talk it out and feel comforted']];

/** Up to ~8 short lines describing how this person thinks, acts and reacts. `you` = second person ("you") or third ("they"). */
export function howTheyThink(P, you = true) {
  const S = (yours, theirs) => (you ? yours : theirs);
  const out = [];
  const mode = MODE.map(([t, mine, theirs]) => [t, v(P, t), you ? mine : theirs]).sort((a, b) => b[1] - a[1])[0];
  if (sure(P, mode[0])) out.push(`When hurt or stressed, ${mode[2]}.`);
  if (sure(P, 'att_anx') && v(P, 'att_anx') >= 65) out.push(S('You like reassurance when things go quiet.', 'They like reassurance when things go quiet.'));
  else if (sure(P, 'att_avo') && v(P, 'att_avo') >= 65) out.push(S('You need your own space, even when you’re close to someone.', 'They need their own space, even when close to someone.'));
  if (sure(P, 'rec_speed')) out.push(v(P, 'rec_speed') >= 65 ? S('You bounce back from fights fast.', 'They bounce back from fights fast.') : v(P, 'rec_speed') <= 35 ? S('Fights stay with you for a while.', 'Fights stay with them for a while.') : S('You need a few hours to settle after a fight.', 'They need a few hours to settle after a fight.'));
  if (sure(P, 'rec_forgive')) out.push(v(P, 'rec_forgive') >= 65 ? S('You forgive easily and don’t bring old things up.', 'They forgive easily and don’t bring old things up.') : v(P, 'rec_forgive') <= 35 ? S('You forgive slowly and remember.', 'They forgive slowly and remember.') : S('You forgive, but you watch for it happening again.', 'They forgive, but watch for it happening again.'));
  if (sure(P, 'read_trust')) out.push(v(P, 'read_trust') >= 65 ? S('You assume the best about people.', 'They assume the best about people.') : v(P, 'read_trust') <= 35 ? S('You are careful who you trust, and notice when something feels off.', 'They are careful who they trust.') : S('You trust, but you verify.', 'They trust, but verify.'));
  if (sure(P, 'dec_head')) out.push(`${v(P, 'dec_head') >= 60 ? S('You decide with your head', 'They decide with their head') : v(P, 'dec_head') <= 40 ? S('You decide with your heart', 'They decide with their heart') : S('You mix head and heart', 'They mix head and heart')}${v(P, 'dec_lead') >= 62 ? S(' and like to lead.', ' and like to lead.') : v(P, 'dec_lead') <= 38 ? S(' and are happy to let others lead.', ' and are happy to let others lead.') : '.'}`);
  const vals = Object.keys(VALUE_LABEL).filter((t) => sure(P, t)).sort((a, b) => v(P, b) - v(P, a)).slice(0, 2);
  if (vals.length === 2) out.push(`${S('When things clash, ', 'When things clash, ')}${VALUE_LABEL[vals[0]]} and ${VALUE_LABEL[vals[1]]} win${S(' for you', ' for them')}.`);
  const lead = Object.entries(AREAS).filter(([, a]) => sure(P, a.firm) && v(P, a.firm) >= 62).map(([, a]) => a.label);
  const bend = Object.entries(AREAS).filter(([, a]) => sure(P, a.firm) && v(P, a.firm) <= 38).map(([, a]) => a.label);
  if (lead.length) out.push(`${S('You hold firm on ', 'They hold firm on ')}${lead.join(' and ')}${bend.length ? `${S('; you bend easily on ', '; they bend easily on ')}${bend.join(' and ')}` : ''}.`);
  else if (bend.length) out.push(`${S('You bend easily on ', 'They bend easily on ')}${bend.join(' and ')}.`);
  if (sure(P, 'integ') && v(P, 'integ') >= 75) out.push(S('Loyal under temptation: lines are lines.', 'Loyal under temptation: lines are lines.'));
  if (sure(P, 'intent_serious')) out.push(v(P, 'intent_serious') >= 70 ? S('Here for something real.', 'Here for something real.') : v(P, 'intent_serious') <= 35 ? S('Here to keep things light for now.', 'Here to keep things light for now.') : S('Open to see where things go.', 'Open to see where things go.'));
  if (sure(P, 'energy')) out.push(`${v(P, 'energy') >= 65 ? S('Social and outgoing', 'Social and outgoing') : v(P, 'energy') <= 35 ? S('Calm and inward', 'Calm and inward') : S('Social in small doses', 'Social in small doses')}, ${v(P, 'depth') >= 62 ? 'into deep talks' : v(P, 'humor') >= 62 ? 'always up for a laugh' : 'easy company'}.`);
  return out.slice(0, 8);
}

const SPECTRUM = [
  ['energy', 'Introvert', 'Extrovert'], ['dec_head', 'Heart-led', 'Head-led'], ['dec_risk', 'Careful', 'Risk-taker'], ['read_trust', 'Cautious', 'Trusting'],
  ['rec_speed', 'Takes time to settle', 'Bounces back fast'], ['curiosity', 'Routine', 'Always exploring'], ['depth', 'Light talk', 'Deep talk'], ['intent_serious', 'Keeping it light', 'Here for something real'],
  ['chrono', 'Early bird', 'Night owl'],
];

const VALUE_NAME = { v_family: 'Family', v_freedom: 'Freedom', v_security: 'Security', v_ambition: 'Career and growth', v_love: 'Love', v_honesty: 'Honesty', v_tradition: 'Faith and tradition' };
const layerConf = (P, key) => {
  const ts = Object.entries(TRAITS).filter(([, l]) => l === key).map(([t]) => P.traits?.[t]?.c ?? 0);
  return ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : 0;
};
/** One line per category: a tendency, never a judgement. */
function tendency(P, key) {
  const hi = (t, at = 62) => v(P, t) >= at; const lo = (t, at = 38) => v(P, t) <= at;
  switch (key) {
    case 'social': return hi('energy') || hi('b_E') ? 'You lean towards big groups and meeting new people.' : lo('energy') || lo('b_E') ? 'You lean towards small groups and quieter time.' : 'You enjoy a crowd now and then, and quiet time too.';
    case 'comm': return hi('r_seek') ? 'You tend to say what’s on your mind soon.' : lo('r_seek', 42) ? 'You tend to wait for the right moment to bring things up.' : hi('depth') ? 'You enjoy deep, unhurried conversations.' : hi('humor') ? 'You keep conversations light and fun.' : 'You adapt how you talk to the person and the moment.';
    case 'conflict': { // the same reading as "how you think" (your first move when things go wrong)
      const first = MODE.map(([t]) => [t, v(P, t)]).sort((a, b) => b[1] - a[1])[0][0];
      return first === 'r_withdraw' ? 'You lean towards taking time to cool down before talking.'
        : first === 'r_fight' ? 'You tend to speak up straight away when you disagree.'
          : 'You lean towards talking things through soon after a disagreement.';
    }
    case 'trust': return hi('att_anx') ? 'You like reassurance when someone close goes quiet.' : hi('att_avo') ? 'You value your own space, even when you’re close to someone.' : 'You feel secure without needing constant contact.';
    case 'values': {
      const top = Object.keys(VALUE_NAME).sort((a, b) => v(P, b) - v(P, a)).slice(0, 2).map((t) => VALUE_NAME[t].toLowerCase());
      return `Right now, ${top[0]} and ${top[1]} matter most to you.`;
    }
    case 'lifestyle': return `${lo('chrono', 40) ? 'More of an early bird' : hi('chrono', 60) ? 'More of a night owl' : 'Neither an early bird nor a night owl'}, ${hi('b_C', 60) ? 'and you like things planned.' : lo('b_C', 40) ? 'and you like to decide on the day.' : 'with a bit of plan and a bit of go-with-the-flow.'}`;
    case 'interests': return (P.interestsDna || []).length ? `You’re into ${list(P.interestsDna.slice(0, 3))}.` : null;
    case 'expect': return hi('intent_pace', 60) ? 'When you like someone, you like to know quickly where it’s going.' : lo('intent_pace', 40) ? 'When you like someone, you prefer to take it slow.' : 'You take closeness at a steady, natural pace.';
    default: return null;
  }
}
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`).toLowerCase();

/** Every category as a tendency with how sure Soul DNA is: early (1 answer), fairly (2-3), sure (4+);
 *  earlier: it still comes from an older Soul DNA. */
export function categories(P) {
  return LAYERS.map((l) => {
    const n = P.layers?.[l.key]?.n ?? 0; const earlier = !!P.layers?.[l.key]?.earlier || (P.v !== 7 && layerConf(P, l.key) > 0.2);
    const line = n || earlier ? tendency(P, l.key) : null;
    const level = n >= 4 ? 'sure' : n >= 2 ? 'fairly' : n === 1 ? 'early' : earlier ? 'fairly' : null;
    return { key: l.key, label: l.title, line, level, answered: n, earlier: !n && earlier };
  });
}

/** Your own Soul DNA page. */
export function selfView(P) {
  const layers = LAYERS.map((l) => {
    const ts = Object.entries(TRAITS).filter(([, layer]) => layer === l.key).map(([t]) => P.traits?.[t]?.c ?? 0);
    if (!ts.length) return { key: l.key, label: l.title, emoji: l.emoji, strength: null };
    return { key: l.key, label: l.title, emoji: l.emoji, strength: Math.round((ts.reduce((a, b) => a + b, 0) / ts.length) * 100) };
  });
  // only areas Soul DNA has actually asked about (otherwise every area would read "Depends")
  const giveTake = Object.entries(AREAS).filter(([, a]) => sure(P, a.firm)).map(([key, a]) => ({ key, label: a.label, stance: v(P, a.firm) >= 62 ? 'lead' : v(P, a.firm) <= 38 ? 'bend' : 'flexible' }));
  const priorities = Object.keys(VALUE_LABEL).sort((a, b) => v(P, b) - v(P, a)).slice(0, 3).map((t) => VALUE_LABEL[t]);
  return {
    summary: howTheyThink(P, true),
    dims: layers, // "how well Soul DNA knows you", per layer
    categories: categories(P),
    spectrum: SPECTRUM.filter(([k]) => (P.traits?.[k]?.c ?? 0) >= 0.25).map(([k, left, right]) => ({ key: k, left, right, value: v(P, k) })),
    giveTake, priorities, strengths: [], tensions: tensions(P), completeness: P.completeness ?? 0,
  };
}

/** The 8 classic traits (Soul type names, Discover personality filters). */
export function classicTraits(P) {
  const c = (x) => Math.max(5, Math.min(95, Math.round(x)));
  return {
    empathy: c(v(P, 'read_sense')), ambition: c(v(P, 'v_ambition')), humor: c(v(P, 'humor')), loyalty: c((v(P, 'loyal') + v(P, 'integ')) / 2),
    creativity: c(v(P, 'curiosity')), conflict_style: c(v(P, 'r_fight')), mentality: c(v(P, 'read_trust')), nature: c(v(P, 'energy')),
  };
}
