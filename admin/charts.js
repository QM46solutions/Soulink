// Small SVG charts drawn to scale, coloured from the theme. No chart library needed.
(function () {
  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
  const short = (v) => (v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // several series over the same x points; labels: [[index, text], ...]
  function line(series, { w = 640, h = 190, cols = ['var(--accent)', 'var(--accent2)', 'var(--accent3)'], labels = [], fill = true, zero = false } = {}) {
    const all = series.flat(); if (!all.length) return '<div class="empty">No data yet</div>';
    let mx = Math.max(...all, 1); let mn = zero ? 0 : Math.min(...all);
    if (mx === mn) { mx += 1; mn = Math.max(0, mn - 1); }
    mx = mx + (mx - mn) * 0.08;
    const len = series[0].length; const X = (i) => 40 + (len === 1 ? (w - 52) / 2 : i * (w - 52) / (len - 1)); const Y = (v) => h - 22 - ((v - mn) / (mx - mn)) * (h - 34);
    let g = ''; for (let k = 0; k < 4; k++) { const v = mn + ((mx - mn) * k) / 3; g += `<line x1="40" x2="${w - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="35" y="${Y(v) + 3}" text-anchor="end">${short(v)}</text>`; }
    const p = series.map((s, j) => { const pts = s.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
      return (fill && j === 0 ? `<polygon points="${X(0)},${h - 22} ${pts} ${X(len - 1)},${h - 22}" fill="${cols[j]}" opacity=".10"/>` : '') +
        `<polyline points="${pts}" fill="none" stroke="${cols[j]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(len - 1)}" cy="${Y(s[len - 1])}" r="4" fill="${cols[j]}"/>`; }).join('');
    const xl = labels.map(([i, t]) => `<text x="${X(i)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : i === len - 1 ? 'end' : 'middle'}">${esc(t)}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${g}${p}${xl}</svg>`;
  }
  // vertical columns; items: [{label, value, color?, stack?:[{value,color}]}]
  function columns(items, { w = 640, h = 190, col = 'var(--accent)', every = 1 } = {}) {
    if (!items.length) return '<div class="empty">No data yet</div>';
    const mx = Math.max(1, ...items.map((x) => (x.stack ? x.stack.reduce((s, y) => s + y.value, 0) : x.value))) * 1.12;
    const bw = (w - 50) / items.length; const Y = (v) => (v / mx) * (h - 40);
    let g = ''; for (let k = 0; k < 4; k++) { const v = (mx * k) / 3; g += `<line x1="40" x2="${w - 6}" y1="${h - 22 - Y(v)}" y2="${h - 22 - Y(v)}" stroke="var(--line)"/><text x="35" y="${h - 19 - Y(v)}" text-anchor="end">${short(v)}</text>`; }
    const b = items.map((x, i) => { const x0 = 44 + i * bw + (bw - Math.min(44, Math.max(2, bw * 0.7))) / 2; const ww = Math.min(44, Math.max(2, bw * 0.7)); let y = h - 22; let s = '';
      for (const part of x.stack || [{ value: x.value, color: x.color || col }]) { const hh = Y(part.value); y -= hh; s += `<rect x="${x0}" y="${y}" width="${ww}" height="${Math.max(0, hh)}" rx="2" fill="${part.color}"><title>${esc(x.label)}: ${fmt(part.value)}</title></rect>`; }
      return s + (i % every === 0 ? `<text x="${x0 + ww / 2}" y="${h - 6}" text-anchor="middle">${esc(x.label)}</text>` : ''); }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${g}${b}</svg>`;
  }
  function bars(rows, { max, col } = {}) {
    if (!rows.length) return '<div class="empty">No data yet</div>';
    max = max || Math.max(1, ...rows.map((r) => r[1]));
    return `<div class="bars">${rows.map(([l, v, c, shown]) => `<div class="row"><span>${esc(l)}</span><div class="t"><i style="width:${(v / max) * 100}%;${c || col ? `background:${c || col}` : ''}"></i></div><span class="v">${shown ?? fmt(v)}</span></div>`).join('')}</div>`;
  }
  function donut(parts, { size = 130, label = 'users' } = {}) {
    const tot = parts.reduce((a, p) => a + p[1], 0); let a = 0; const r = 46; const C = 2 * Math.PI * r;
    const segs = tot ? parts.map(([l, v, c]) => { const len = (v / tot) * C; const s = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${c}" stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-a}" transform="rotate(-90 60 60)"><title>${esc(l)}: ${fmt(v)}</title></circle>`; a += len; return s; }).join('') : '';
    return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" role="img"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--panel2)" stroke-width="16"/>${segs}<text x="60" y="58" text-anchor="middle" style="font-size:15px;font-family:var(--display);font-weight:700;fill:var(--fg)">${short(tot)}</text><text x="60" y="73" text-anchor="middle">${esc(label)}</text></svg>`;
  }
  function spark(values, col = 'var(--accent)') {
    if (!values || values.length < 2) return '';
    const mx = Math.max(...values, 1); const mn = Math.min(...values); const W = 90; const H = 34;
    const pts = values.map((v, i) => `${(i * W) / (values.length - 1)},${H - 3 - ((v - mn) / Math.max(1, mx - mn)) * (H - 6)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }
  function heat(cells, { rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] } = {}) {
    const mx = Math.max(1, ...cells.map((c) => c.users)); const at = {}; cells.forEach((c) => { at[`${c.wd}|${c.hour}`] = c.users; });
    let h = '<div></div>' + Array.from({ length: 24 }, (_, i) => `<div style="text-align:center">${i % 3 === 0 ? i : ''}</div>`).join('');
    rows.forEach((d, wd) => { h += `<div>${d}</div>` + Array.from({ length: 24 }, (_, hr) => { const v = at[`${wd}|${hr}`] || 0; return `<div title="${d} ${hr}:00 · about ${fmt(Math.round(v))} people" style="height:24px;border-radius:3px;background:color-mix(in srgb,var(--accent) ${Math.round(6 + (v / mx) * 94)}%,var(--panel2))"></div>`; }).join(''); });
    return `<div class="tw"><div class="hours" style="min-width:620px">${h}</div></div>`;
  }
  window.Charts = { line, columns, bars, donut, spark, heat, fmt, short, esc };
})();
