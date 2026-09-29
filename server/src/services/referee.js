// The Argue referee. Reads every side and returns a fair, neutral verdict.
// Uses Claude when ANTHROPIC_API_KEY is set (best quality); otherwise a simple free judge so the
// feature still works for testing. Output shape is the same either way.
import { config } from '../config.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const SYSTEM = `You are the Soulink Referee: a fair, warm, neutral judge of everyday disagreements between friends, couples, flatmates or colleagues in India (mostly 18-35).
Rules:
- Judge only what people wrote. Never invent facts. If sides contradict on facts, say so and judge on what is reasonable.
- Be kind and specific. No insults, no moralising, no therapy language. Light humour is fine.
- Consider: facts and fairness, who listened to the other side, respect, and what a reasonable person would do.
- A split verdict is allowed when truly balanced, but prefer a clear call when one side is more reasonable.
- Never take sides on protected traits (religion, caste, gender, etc.). If anyone mentions danger, abuse or self-harm, do not judge: set "safety" to a short caring note suggesting they talk to someone they trust.
Reply with ONLY a JSON object, no markdown:
{"winnerSeats":[seat numbers who are most right; several only for a split],"headline":"one short verdict line, max 12 words","summary":"2-3 sentences explaining the call","people":[{"seat":1,"fairness":0-100,"strength":"what they got right, one line","blindSpot":"what they missed, one line"}],"advice":"one practical next step for everyone","safety":null}`;

function userPrompt(topic, people) {
  const sides = people.map((p) => `Seat ${p.seat} (${p.name}):\n"""${p.statement}"""`).join('\n\n');
  return `Topic: ${topic || '(not given)'}\nNumber of people: ${people.length}\n\n${sides}\n\nGive your verdict as JSON.`;
}

function tidy(v, people) {
  const seats = people.map((p) => p.seat);
  const winners = (Array.isArray(v.winnerSeats) ? v.winnerSeats : []).map(Number).filter((s) => seats.includes(s));
  return {
    winnerSeats: winners.length ? [...new Set(winners)] : [],
    headline: String(v.headline || 'The Referee has spoken').slice(0, 120),
    summary: String(v.summary || '').slice(0, 800),
    people: people.map((p) => {
      const x = (v.people || []).find((q) => Number(q.seat) === p.seat) || {};
      return { seat: p.seat, name: p.name, fairness: clamp(Math.round(Number(x.fairness) || 50), 0, 100), strength: String(x.strength || '').slice(0, 200), blindSpot: String(x.blindSpot || '').slice(0, 200) };
    }),
    advice: String(v.advice || '').slice(0, 300),
    safety: v.safety ? String(v.safety).slice(0, 300) : null,
  };
}

async function claudeVerdict(topic, people) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: config.anthropicModel, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: userPrompt(topic, people) }] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return tidy(JSON.parse(json), people);
}

// ---- Free basic judge (no AI): rewards calm, fair, specific statements ----
const FAIR = /\b(i understand|i get (it|that)|you'?re right|fair point|my (bad|mistake)|sorry|i should have|both of us|we both|to be fair|i agree|i admit)\b/gi;
const HARSH = /\b(always|never|stupid|idiot|shut up|useless|pathetic|hate you|dumb|nonsense|whatever)\b/gi;
const SPECIFIC = /\b(\d+|yesterday|today|last (week|night|time)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|because|since|promised|agreed)\b/gi;

function basicVerdict(topic, people) {
  const scored = people.map((p) => {
    const t = p.statement || '';
    const words = t.split(/\s+/).filter(Boolean).length;
    const fair = (t.match(FAIR) || []).length;
    const harsh = (t.match(HARSH) || []).length;
    const specific = (t.match(SPECIFIC) || []).length;
    const shouting = (t.match(/[A-Z]{4,}|!!+/g) || []).length;
    const score = 50 + fair * 12 + Math.min(specific, 5) * 4 - harsh * 10 - shouting * 5 + (words >= 15 ? 5 : -5);
    return { ...p, score: clamp(score, 5, 95), fair, harsh, specific };
  });
  const best = Math.max(...scored.map((s) => s.score));
  const winners = scored.filter((s) => best - s.score <= 4).map((s) => s.seat);
  const names = (seats) => scored.filter((s) => seats.includes(s.seat)).map((s) => s.name).join(' & ');
  return {
    winnerSeats: winners,
    headline: winners.length > 1 ? `Too close to call: ${names(winners)}` : `${names(winners)} made the fairer case`,
    summary: 'Quick verdict from the basic judge: it rewards calm, specific and fair points and marks down harsh words. Add a Claude API key for a real AI verdict that understands the whole story.',
    people: scored.map((s) => ({
      seat: s.seat, name: s.name, fairness: s.score,
      strength: s.fair ? 'Showed they could see the other side.' : s.specific ? 'Gave specific details.' : 'Shared their side.',
      blindSpot: s.harsh ? 'Some harsh words made it sound less fair.' : s.fair ? '' : "Didn't acknowledge the other side.",
    })),
    advice: 'Each of you say one thing the other person got right, then decide together what happens next time.',
    safety: null,
  };
}

/** Returns { verdict, judge: 'claude' | 'basic' }. Falls back to the basic judge if Claude fails. */
export async function judge(topic, people) {
  if (config.anthropicKey) {
    try { return { verdict: await claudeVerdict(topic, people), judge: 'claude' }; } catch (e) { console.error('Referee: Claude failed, using basic judge:', e.message); }
  }
  return { verdict: basicVerdict(topic, people), judge: 'basic' };
}

export const _test = { basicVerdict, tidy };
