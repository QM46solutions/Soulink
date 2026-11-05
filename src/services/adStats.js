// Numbers for the ads dashboard. Money is kept in paise (₹1 = 100 paise) and shown in rupees.
//   spent  = views × price per 1,000 views ÷ 1,000, never more than the budget
//   left   = budget − spent          balance = paid − spent (minus = still to pay)
// Plus plain-language advice: top up, budget won't be used by the end date, picture not working, best placement.
const DAY = 86400000;
const inr = (p) => Math.round(p / 100);
const roundUp = (rupees, step = 100) => Math.max(step, Math.ceil(rupees / step) * step);
const rupee = (r) => `₹${Number(r).toLocaleString('en-IN')}`;

export function statusOf(a, now = Date.now()) {
  const billed = a.budget_paise != null && a.cpm_paise != null;
  if (!(a.active === true || a.active === 1)) return 'paused';
  if (new Date(a.starts_at).getTime() > now) return 'scheduled';
  if (new Date(a.ends_at).getTime() <= now) return 'ended';
  if (billed && spentPaise(a) >= a.budget_paise) return 'budget_used';
  return 'running';
}
export function spentPaise(a) {
  if (a.budget_paise == null || a.cpm_paise == null) return 0;
  return Math.min(a.budget_paise, Math.floor((Number(a.impressions || 0) * a.cpm_paise) / 1000));
}

/** Everything the dashboard shows for one ad. */
export function adStats(a, now = Date.now()) {
  const billed = a.budget_paise != null && a.cpm_paise != null;
  const views = Number(a.impressions || 0); const clicks = Number(a.clicks || 0);
  const spent = spentPaise(a);
  const left = billed ? Math.max(0, a.budget_paise - spent) : null;
  const start = new Date(a.starts_at).getTime(); const end = new Date(a.ends_at).getTime();
  const daysLive = Math.max(1, (Math.min(now, end) - start) / DAY);
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
  const perDaySpend = spent / daysLive; const perDayViews = views / daysLive;
  const status = statusOf(a, now);
  return {
    status, billed,
    budget: billed ? inr(a.budget_paise) : null,
    pricePer1000: billed ? inr(a.cpm_paise) : null,
    spent: inr(spent), left: left == null ? null : inr(left),
    paid: inr(a.paid_paise || 0), balance: inr((a.paid_paise || 0) - spent), // minus: the customer still has to pay this much
    usedPct: billed && a.budget_paise ? Math.round((spent / a.budget_paise) * 100) : null,
    views, reach: Number(a.reach || 0), clicks, ctr: views ? Math.round((clicks / views) * 1000) / 10 : 0,
    costPerClick: clicks && spent ? Math.round(spent / clicks) / 100 : null,
    viewsPerDay: Math.round(perDayViews), spendPerDay: inr(perDaySpend),
    daysLeft, budgetLastsDays: billed && perDaySpend > 0 ? Math.floor(left / perDaySpend) : null,
    viewsLeft: billed && a.cpm_paise ? Math.floor((left * 1000) / a.cpm_paise) : null,
  };
}

/** Advice for one ad, in plain words (most useful first). */
export function adTips(a, st, now = Date.now()) {
  const tips = [];
  const name = a.headline || a.argue_topic || a.brand;
  const perDay = st.spendPerDay || (st.pricePer1000 ? Math.max(1, st.viewsPerDay) * st.pricePer1000 / 1000 : 0);
  if (st.status === 'budget_used') {
    const add = roundUp(Math.max(500, perDay * 7));
    tips.push({ kind: 'topup', ad: a.id, text: `"${name}" used its whole budget. Add ${rupee(add)} to run it about 7 more days${st.pricePer1000 ? ` (about ${Math.floor((add * 1000) / st.pricePer1000).toLocaleString('en-IN')} more views)` : ''}.`, amount: add });
  } else if (st.status === 'running' && st.billed && st.budgetLastsDays != null && st.budgetLastsDays + 0.5 < st.daysLeft) {
    const add = roundUp(perDay * (st.daysLeft - st.budgetLastsDays));
    tips.push({ kind: 'topup', ad: a.id, text: `At this pace "${name}" runs out of budget in about ${st.budgetLastsDays} day${st.budgetLastsDays === 1 ? '' : 's'}, before its end date. Add about ${rupee(add)} to keep it showing till the end.`, amount: add });
  } else if (st.status === 'running' && st.billed && st.budgetLastsDays != null && st.daysLeft > 0 && st.budgetLastsDays > st.daysLeft * 1.5 && (now - new Date(a.starts_at).getTime()) > DAY) {
    const unused = Math.max(0, st.left - st.spendPerDay * st.daysLeft);
    tips.push({ kind: 'extend', ad: a.id, text: `"${name}" won't use all its budget by the end date: about ${rupee(Math.round(unused))} would be left. Run it longer, or show it in more cities.` });
  }
  if (st.views >= 1000 && st.ctr < 0.5) tips.push({ kind: 'creative', ad: a.id, text: `Few people tap "${name}" (${st.ctr}% of views). A brighter picture or a clearer headline usually helps.` });
  else if (st.views >= 500 && st.ctr >= 2) tips.push({ kind: 'winner', ad: a.id, text: `"${name}" works well: ${st.ctr}% of people who see it tap it. It's the best one to put more budget on.` });
  if (st.balance < 0) tips.push({ kind: 'payment', ad: a.id, text: `${rupee(-st.balance)} is still to be paid for "${name}".` });
  return tips;
}

/** Across several ads: which placement gets more taps. */
export function placementTip(ads) {
  const by = {};
  for (const a of ads) { const p = (by[a.placement] ||= { v: 0, c: 0 }); p.v += Number(a.impressions || 0); p.c += Number(a.clicks || 0); }
  const list = Object.entries(by).filter(([, x]) => x.v >= 300).map(([k, x]) => ({ k, ctr: x.c / x.v }));
  if (list.length < 2) return null;
  list.sort((x, y) => y.ctr - x.ctr);
  const [best, next] = list;
  if (!best.ctr || best.ctr < next.ctr * 1.3) return null;
  const label = { feed: 'the Home feed', sparks: 'between Sparks', argue: 'sponsored Argue' };
  return { kind: 'placement', text: `Ads ${label[best.k]} get ${Math.round((best.ctr / Math.max(next.ctr, 0.0001)) * 10) / 10}× more taps than ${label[next.k]}. Put new budget there first.` };
}

/** Last n days (India time) of views and clicks (missing days = 0), oldest first. */
export const IST = 5.5 * 3600000;
export function dailySeries(rows, n = 30, now = Date.now()) {
  const map = new Map();
  for (const r of rows) {
    const k = String(r.day).slice(0, 10); const x = map.get(k) || { impressions: 0, clicks: 0 };
    map.set(k, { impressions: x.impressions + Number(r.impressions || 0), clicks: x.clicks + Number(r.clicks || 0) });
  }
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now + IST - i * DAY).toISOString().slice(0, 10);
    const r = map.get(d);
    out.push({ day: d, views: Number(r?.impressions || 0), clicks: Number(r?.clicks || 0) });
  }
  return out;
}
