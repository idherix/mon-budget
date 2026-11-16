'use strict';
/* =========================================================
   Mini-librairie de graphiques SVG (sans dépendance,
   fonctionne hors connexion)
   ========================================================= */
const Charts = (() => {
  const W = 340;
  let gid = 0;

  const short = v => {
    const a = Math.abs(v);
    if (a >= 1000) return (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + 'k';
    return Math.round(v).toLocaleString('fr-FR');
  };

  function niceTicks(min, max, count) {
    const span = (max - min) || 1;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }

  /* Courbes : { labels, series:[{name,color,values,area,width,opacity,dot}], height } */
  function line({ labels, series, height = 190 }) {
    const H = height, pl = 36, pr = 8, pt = 10, pb = 22;
    const iw = W - pl - pr, ih = H - pt - pb;
    const vals = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
    const ticks = niceTicks(Math.min(0, ...vals), Math.max(1, ...vals), 4);
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const n = labels.length;
    const x = i => pl + (n <= 1 ? iw / 2 : i * iw / (n - 1));
    const y = v => pt + ih - (v - lo) / ((hi - lo) || 1) * ih;

    const ids = series.map(() => 'cg' + (++gid));
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs>`;
    series.forEach((s, k) => {
      if (s.area) svg += `<linearGradient id="${ids[k]}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".22"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
    });
    svg += '</defs>';

    ticks.forEach(t => {
      svg += `<line class="grid${t === 0 ? ' zero' : ''}" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/>`;
      svg += `<text class="axis" x="${pl - 6}" y="${y(t) + 3.5}" text-anchor="end">${short(t)}</text>`;
    });
    const step = Math.ceil(n / 7);
    labels.forEach((l, i) => {
      if (i % step === 0) svg += `<text class="axis" x="${x(i)}" y="${H - 5}" text-anchor="middle">${l}</text>`;
    });

    series.forEach((s, k) => {
      let d = '', started = false;
      const pts = [];
      s.values.forEach((v, i) => {
        if (v == null) { started = false; return; }
        d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
        started = true;
        pts.push([i, v]);
      });
      if (!pts.length) return;
      if (s.area && pts.length > 1) {
        const base = y(Math.max(lo, 0)).toFixed(1);
        const a = `M${x(pts[0][0]).toFixed(1)},${base} ` +
          pts.map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') +
          ` L${x(pts[pts.length - 1][0]).toFixed(1)},${base} Z`;
        svg += `<path class="area" d="${a}" fill="url(#${ids[k]})"/>`;
      }
      svg += `<path class="draw" d="${d}" stroke="${s.color}" style="stroke-width:${s.width || 2.5};opacity:${s.opacity ?? 1}"/>`;
      if (s.dot !== false) {
        const [i, v] = pts[pts.length - 1];
        svg += `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="4" fill="#fff" stroke="${s.color}" stroke-width="2.5"/>`;
      }
    });
    svg += '</svg>';
    const legend = `<div class="legend">${series.map(s => `<span><i style="background:${s.color};opacity:${s.opacity ?? 1}"></i>${s.name}</span>`).join('')}</div>`;
    return svg + legend;
  }

  /* Donut : items [{value,color}] */
  function donut(items, label, value) {
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    const r = 70, C = 2 * Math.PI * r;
    const gap = items.length > 1 ? 3 : 0;
    let off = 0;
    const segs = items.map((it, i) => {
      const L = Math.max(0, it.value / total * C - gap);
      const s = `<circle class="donut-seg" cx="100" cy="100" r="${r}" fill="none" stroke="${it.color}" stroke-width="26"
        style="stroke-dasharray:0 ${C};stroke-dashoffset:${-off};transition-delay:${i * 70}ms" data-dash="${L} ${C - L}"/>`;
      off += it.value / total * C;
      return s;
    }).join('');
    return `<svg class="donut" viewBox="0 0 200 200">
      <g transform="rotate(-90 100 100)">
        <circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--line)" stroke-width="26"/>${segs}
      </g>
      <text x="100" y="94" text-anchor="middle" class="donut-lbl">${label}</text>
      <text x="100" y="119" text-anchor="middle" class="donut-val">${value}</text>
    </svg>`;
  }

  /* Lance les animations après insertion dans le DOM */
  function animate(root) {
    root.querySelectorAll('.donut-seg').forEach(el => { el.style.strokeDasharray = el.dataset.dash; });
    root.querySelectorAll('path.draw').forEach(p => {
      const L = p.getTotalLength();
      p.style.transition = 'none';
      p.style.strokeDasharray = L;
      p.style.strokeDashoffset = L;
      p.getBoundingClientRect();
      p.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)';
      p.style.strokeDashoffset = '0';
    });
    root.querySelectorAll('.chart .area, .chart .dot').forEach(el => el.classList.add('show'));
  }

  return { line, donut, animate };
})();
