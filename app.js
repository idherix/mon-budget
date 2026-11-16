'use strict';
/* =========================================================
   Mon Budget — suivi de budget mensuel (PWA, 100 % local)
   Toutes les données restent dans le localStorage du téléphone.
   ========================================================= */

/* ---------- Constantes & utilitaires ---------- */
const STORAGE_KEY = 'mon-budget:v1';
const HINT_KEY = 'mon-budget:install-hint-dismissed';
const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const EUR0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const PALETTE = ['#4F46E5', '#0284C7', '#0D9488', '#16A34A', '#65A30D', '#D97706', '#EA580C', '#DC2626', '#DB2777', '#9333EA', '#7C3AED', '#475569'];
const TITLES = { home: 'Accueil', ops: 'Opérations', stats: 'Statistiques', settings: 'Réglages' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round2 = v => Math.round(v * 100) / 100;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const currentMonth = () => todayISO().slice(0, 7);
const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthsBetween = (a, b) => { const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number); return (by - ay) * 12 + (bm - am); };
const monthLabel = mk => { const [y, m] = mk.split('-').map(Number); return `${cap(MONTHS[m - 1])} ${y}`; };
const daysInMonth = mk => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const dateLong = iso => { const [y, m, d] = iso.split('-').map(Number); return `${cap(DAYS[new Date(y, m - 1, d).getDay()])} ${d} ${MONTHS[m - 1]}`; };
const parseAmount = s => { const n = parseFloat(String(s ?? '').replace(/[\s  €]/g, '').replace(',', '.')); return isFinite(n) ? round2(n) : NaN; };
const amountInput = v => (v === null || v === undefined || v === '') ? '' : String(v).replace('.', ',');
const tint = hex => hex + '1F';

/* ---------- Données par défaut ---------- */
function defaultState() {
  const cats = [
    ['Salaire', '💼', 'income', '#16A34A', null],
    ['Aides (APL, CAF…)', '🏛️', 'income', '#0D9488', null],
    ['Remboursements', '↩️', 'income', '#0284C7', null],
    ['Autres revenus', '💶', 'income', '#65A30D', null],
    ['Logement', '🏠', 'expense', '#4F46E5', 450],
    ['Courses', '🛒', 'expense', '#16A34A', 200],
    ['Restaurants & cafés', '🍽️', 'expense', '#EA580C', 80],
    ['Transport', '🚆', 'expense', '#0284C7', 60],
    ['Sorties & loisirs', '🎉', 'expense', '#DB2777', 80],
    ['Abonnements', '📱', 'expense', '#7C3AED', 40],
    ['Shopping', '🛍️', 'expense', '#D97706', 80],
    ['Santé', '💊', 'expense', '#DC2626', 30],
    ['Études', '📚', 'expense', '#0D9488', 30],
    ['Sport', '🏋️', 'expense', '#65A30D', 30],
    ['Voyages', '✈️', 'expense', '#9333EA', 100],
    ['Divers', '📦', 'expense', '#475569', 50],
  ];
  return {
    version: 1,
    savingsGoal: 300,
    categories: cats.map(([name, emoji, type, color, budget]) => ({ id: uid(), name, emoji, type, color, budget })),
    transactions: [],
  };
}

/* ---------- Stockage ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.categories) && Array.isArray(s.transactions)) return s;
    }
  } catch (e) { /* données illisibles → on repart de zéro */ }
  const s = defaultState();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { }
  return s;
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('⚠️ Impossible d’enregistrer'); }
}

let state = load();
const ui = { tab: 'home', month: currentMonth(), filter: { type: 'all', cat: '', q: '' } };

/* ---------- Calculs ---------- */
const catById = id => state.categories.find(c => c.id === id) ||
  { id, name: 'Catégorie supprimée', emoji: '❔', color: '#94A3B8', type: 'expense', budget: null };
const monthTx = mk => state.transactions.filter(t => t.date.startsWith(mk));
const sortTx = list => [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

function summary(mk) {
  let income = 0, expense = 0;
  const byCat = new Map();
  for (const t of monthTx(mk)) {
    if (t.type === 'income') income += t.amount;
    else { expense += t.amount; byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount); }
  }
  income = round2(income); expense = round2(expense);
  return { income, expense, balance: round2(income - expense), byCat };
}

function uniqueValues(field) {
  const seen = new Map();
  for (const t of sortTx(state.transactions)) {
    const v = (t[field] || '').trim();
    if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  }
  return [...seen.values()].slice(0, 80);
}

/* =========================================================
   Rendu
   ========================================================= */
function render(anim = 'enter') {
  $('#page-title').textContent = TITLES[ui.tab];
  $('#month-label').textContent = monthLabel(ui.month);
  $('#month-nav').classList.toggle('hidden', ui.tab === 'settings');
  $('#fab').classList.toggle('hidden', ui.tab === 'settings');
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));

  const view = $('#view');
  view.innerHTML = VIEWS[ui.tab]();
  view.classList.remove('enter', 'slide-left', 'slide-right');
  void view.offsetWidth;
  if (anim) view.classList.add(anim);
  runAnimations(view);
}

function runAnimations(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('[data-w]', root).forEach(el => { el.style.width = el.dataset.w; });
    $$('[data-h]', root).forEach(el => { el.style.height = el.dataset.h; });
    $$('[data-count]', root).forEach(el => countUp(el, parseFloat(el.dataset.count), el.dataset.fmt));
    Charts.animate(root);
  }));
}

function countUp(el, to, mode) {
  const f = mode === 'pct' ? v => `${Math.round(v)} %` : v => EUR.format(v);
  const dur = 750, t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = f(p < 1 ? to * e : to);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function emptyState(emoji, title, text) {
  return `<div class="empty"><span class="big-emoji">${emoji}</span><b>${title}</b><p>${text}</p></div>`;
}

function txRow(t, i = 0) {
  const c = catById(t.categoryId);
  const title = t.company || c.name;
  const sub = [t.company ? c.name : null, t.place].filter(Boolean).join(' · ') || t.note || dateLong(t.date);
  return `<button class="tx" data-edit="${t.id}" style="--i:${i}">
    <span class="tx-ico" style="background:${tint(c.color)}">${esc(c.emoji)}</span>
    <span class="tx-main"><span class="tx-title">${esc(title)}</span><span class="tx-sub">${esc(sub)}</span></span>
    <span class="tx-amt ${t.type}">${t.type === 'income' ? '+' : '−'}${EUR.format(t.amount)}</span>
  </button>`;
}

/* ---------- Onglet Accueil ---------- */
function viewHome() {
  const s = summary(ui.month);
  const goal = Number(state.savingsGoal) || 0;
  const tx = sortTx(monthTx(ui.month));
  const progress = goal > 0 ? clamp(s.balance / goal * 100, 0, 100) : 0;
  const margin = round2(s.balance - goal);

  let goalMsg;
  if (s.income === 0) goalMsg = 'Ajoute ton salaire du mois pour suivre ton objectif.';
  else if (margin > 0) goalMsg = `Tu peux encore dépenser <b>${EUR.format(margin)}</b> tout en tenant ton objectif.`;
  else if (margin === 0) goalMsg = `Pile sur ton objectif 🎯 — plus de marge ce mois-ci.`;
  else goalMsg = `Il te manque <b>${EUR.format(-margin)}</b> pour atteindre ton objectif.`;

  const ratio = r => r.c.budget > 0 ? r.spent / r.c.budget : (r.spent > 0 ? 0.0001 : 0);
  const rows = state.categories.filter(c => c.type === 'expense')
    .map(c => ({ c, spent: round2(s.byCat.get(c.id) || 0) }))
    .filter(r => r.c.budget > 0 || r.spent > 0)
    .sort((a, b) => ratio(b) - ratio(a));
  const used = rows.filter(r => r.spent > 0);
  const untouched = rows.length - used.length;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const showHint = isIOS && !standalone && !localStorage.getItem(HINT_KEY);

  return `
  ${showHint ? `<section class="card install"><span style="font-size:22px">📲</span>
    <p><b>Installe l’appli :</b> touche le bouton <b>Partager</b> de Safari puis <b>« Sur l’écran d’accueil »</b>.</p>
    <button data-action="dismiss-hint" aria-label="Fermer">✕</button></section>` : ''}

  <section class="card hero" style="--d:0">
    <div class="label">Solde du mois</div>
    <div class="big" data-count="${s.balance}">${EUR.format(0)}</div>
    <div class="pills">
      <div class="pill"><small>↓ Revenus</small><b>${EUR.format(s.income)}</b></div>
      <div class="pill"><small>↑ Dépenses</small><b>${EUR.format(s.expense)}</b></div>
    </div>
  </section>

  <section class="card" style="--d:1">
    <h3>Objectif d’épargne <button class="link" data-action="edit-goal">Modifier</button></h3>
    <div class="goal-top"><span class="v">${EUR.format(Math.max(0, s.balance))}</span><span class="of">sur ${EUR.format(goal)}</span></div>
    <div class="progress accent"><i data-w="${progress.toFixed(1)}%"></i></div>
    <div class="goal-msg">${goalMsg}</div>
  </section>

  <section class="card" style="--d:2">
    <h3>Budgets par catégorie <button class="link" data-goto="settings">Gérer</button></h3>
    ${used.length ? used.map(budgetRow).join('') : emptyState('🧮', 'Aucune dépense ce mois-ci', 'Tes budgets s’afficheront ici dès ta première dépense.')}
    ${used.length && untouched ? `<p class="hint" style="margin-top:8px">+ ${untouched} catégorie${untouched > 1 ? 's' : ''} pas encore entamée${untouched > 1 ? 's' : ''}</p>` : ''}
  </section>

  <section class="card" style="--d:3">
    <h3>Dernières opérations ${tx.length > 5 ? '<button class="link" data-goto="ops">Tout voir</button>' : ''}</h3>
    ${tx.length ? tx.slice(0, 5).map(txRow).join('') :
      emptyState('🪙', 'Rien pour l’instant', 'Touche le bouton <b style="display:inline">+</b> pour ajouter ton salaire ou ta première dépense.')}
  </section>`;
}

function budgetRow({ c, spent }, i) {
  const b = c.budget || 0;
  const pct = b ? spent / b * 100 : 0;
  const cls = !b ? 'none' : pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
  const right = b ? `<b>${EUR.format(spent)}</b> / ${EUR0.format(b)}` : `<b>${EUR.format(spent)}</b>`;
  const sub = !b ? 'Pas de budget défini'
    : spent <= b ? `Reste ${EUR.format(b - spent)}${pct >= 80 ? ' — attention' : ''}`
      : `Dépassé de ${EUR.format(spent - b)}`;
  return `<div class="budget-row" style="--i:${i}">
    <div class="br-top"><span class="br-name"><span class="br-emoji">${esc(c.emoji)}</span>${esc(c.name)}</span><span class="br-val">${right}</span></div>
    <div class="progress ${cls}"><i data-w="${Math.min(100, pct).toFixed(1)}%"></i></div>
    <div class="br-sub ${cls}">${sub}</div>
  </div>`;
}

/* ---------- Onglet Opérations ---------- */
function viewOps() {
  const f = ui.filter;
  return `
  <div class="search">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="ops-q" type="search" placeholder="Rechercher : entreprise, lieu, note…" value="${esc(f.q)}" autocomplete="off">
  </div>
  <div class="filters">
    ${[['all', 'Tout'], ['expense', 'Dépenses'], ['income', 'Revenus']].map(([v, l]) =>
      `<button class="chip ${f.type === v ? 'on' : ''}" data-ftype="${v}">${l}</button>`).join('')}
    <select id="ops-cat" class="chip-select">
      <option value="">Toutes catégories</option>
      ${state.categories.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.emoji + ' ' + c.name)}</option>`).join('')}
    </select>
  </div>
  <div id="ops-list">${opsList()}</div>`;
}

function opsList() {
  const f = ui.filter;
  const q = f.q.trim().toLowerCase();
  let tx = monthTx(ui.month).filter(t => (f.type === 'all' || t.type === f.type) && (!f.cat || t.categoryId === f.cat));
  if (q) tx = tx.filter(t => [t.company, t.place, t.note, catById(t.categoryId).name, amountInput(t.amount)]
    .some(v => String(v || '').toLowerCase().includes(q)));
  if (!tx.length) {
    return monthTx(ui.month).length
      ? emptyState('🔍', 'Aucun résultat', 'Essaie un autre filtre ou une autre recherche.')
      : emptyState('🗓️', 'Aucune opération ce mois-ci', 'Touche <b style="display:inline">+</b> pour en ajouter une.');
  }
  tx = sortTx(tx);
  let inc = 0, exp = 0;
  tx.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });

  const groups = [];
  for (const t of tx) {
    const last = groups[groups.length - 1];
    if (last && last[0] === t.date) last[1].push(t); else groups.push([t.date, [t]]);
  }
  let i = 0;
  return `<div class="ops-summary"><span>${tx.length} opération${tx.length > 1 ? 's' : ''}</span>
      <span class="neg">−${EUR.format(exp)}</span><span class="pos">+${EUR.format(inc)}</span></div>` +
    groups.map(([date, items]) => {
      const net = items.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0);
      return `<div class="day-head"><span>${dateLong(date)}</span><span>${net >= 0 ? '+' : '−'}${EUR.format(Math.abs(net))}</span></div>
        <div class="card tight" style="--d:${Math.min(i, 6)}">${items.map(t => txRow(t, i++)).join('')}</div>`;
    }).join('');
}

function refreshOpsList() {
  const list = $('#ops-list');
  if (!list) return;
  list.innerHTML = opsList();
  $$('[data-ftype]').forEach(b => b.classList.toggle('on', b.dataset.ftype === ui.filter.type));
}

/* ---------- Onglet Stats ---------- */
function viewStats() {
  const mk = ui.month, cm = currentMonth();
  const s = summary(mk);
  const tx = monthTx(mk);
  const exps = tx.filter(t => t.type === 'expense');
  const dim = daysInMonth(mk);
  const elapsed = mk === cm ? Number(todayISO().slice(8)) : (mk < cm ? dim : 0);
  const avg = elapsed ? s.expense / elapsed : 0;
  const rate = s.income > 0 ? s.balance / s.income * 100 : null;
  const biggest = [...exps].sort((a, b) => b.amount - a.amount)[0];

  const kpis = [
    { l: 'Taux d’épargne', v: rate === null ? '—' : null, count: rate, fmt: 'pct', cls: rate === null ? '' : rate >= 0 ? 'pos' : 'neg', e: s.income > 0 ? `${EUR.format(s.balance)} gardés` : 'Pas de revenu saisi' },
    { l: 'Moyenne / jour', count: avg, e: elapsed ? `sur ${elapsed} jour${elapsed > 1 ? 's' : ''}` : 'Mois à venir' },
    mk === cm
      ? { l: 'Projection fin de mois', count: avg * dim, e: 'au rythme actuel' }
      : { l: 'Total dépensé', count: s.expense, e: `${exps.length} dépense${exps.length > 1 ? 's' : ''}` },
    { l: 'Plus grosse dépense', count: biggest ? biggest.amount : 0, e: biggest ? (biggest.company || catById(biggest.categoryId).name) : '—' },
  ];
  const kpiHtml = `<div class="kpis">${kpis.map((k, i) => `<div class="kpi" style="--i:${i}"><small>${k.l}</small>
      <b class="${k.cls || ''}" ${k.v ? '' : `data-count="${k.count}" data-fmt="${k.fmt || ''}"`}>${k.v || (k.fmt === 'pct' ? '0 %' : EUR.format(0))}</b>
      <em>${esc(k.e)}</em></div>`).join('')}</div>`;

  /* Répartition */
  const items = [...s.byCat].map(([id, v]) => ({ c: catById(id), v })).sort((a, b) => b.v - a.v);
  const donutHtml = items.length ? `
    <div class="donut-box">${Charts.donut(items.map(it => ({ value: it.v, color: it.c.color })), 'Dépenses', EUR0.format(s.expense))}</div>
    ${items.map((it, i) => `<div class="ll-row" style="--i:${i}"><span class="ll-dot" style="background:${it.c.color}"></span>
      <span class="ll-name">${esc(it.c.emoji)} ${esc(it.c.name)}</span>
      <span class="ll-pct">${Math.round(it.v / s.expense * 100)} %</span><span class="ll-val">${EUR.format(it.v)}</span></div>`).join('')}`
    : emptyState('🍩', 'Pas encore de dépenses', 'La répartition apparaîtra ici.');

  /* Évolution sur plusieurs mois */
  const firstMonth = state.transactions.reduce((m, t) => t.date.slice(0, 7) < m ? t.date.slice(0, 7) : m, mk);
  const nMonths = clamp(monthsBetween(firstMonth, mk) + 1, 3, 12);
  const months = Array.from({ length: nMonths }, (_, i) => addMonths(mk, i - nMonths + 1));
  const sums = months.map(summary);
  const evoHtml = Charts.line({
    labels: months.map(m => MONTHS_SHORT[Number(m.slice(5)) - 1]),
    series: [
      { name: 'Revenus', color: '#10B981', values: sums.map(x => x.income) },
      { name: 'Dépenses', color: '#F43F5E', values: sums.map(x => x.expense) },
      { name: 'Épargne', color: '#4F46E5', values: sums.map(x => x.balance), area: true, width: 3 },
    ],
  });

  /* Dépenses cumulées vs mois précédent */
  const pm = addMonths(mk, -1), pdim = daysInMonth(pm);
  const cumul = (m, upTo) => {
    const daily = new Array(31).fill(0);
    monthTx(m).filter(t => t.type === 'expense').forEach(t => { daily[Number(t.date.slice(8)) - 1] += t.amount; });
    let acc = 0;
    return daily.map((v, i) => { acc += v; return i < upTo ? round2(acc) : null; });
  };
  const maxDays = Math.max(dim, pdim);
  const totalBudget = state.categories.filter(c => c.type === 'expense').reduce((a, c) => a + (c.budget || 0), 0);
  const cumSeries = [
    { name: monthLabel(pm), color: '#94A3B8', values: cumul(pm, pdim).slice(0, maxDays), width: 2, dot: false },
    { name: monthLabel(mk), color: '#4F46E5', values: cumul(mk, elapsed || 0).slice(0, maxDays), area: true, width: 3 },
  ];
  if (totalBudget > 0) cumSeries.push({
    name: 'Rythme budget', color: '#F59E0B', width: 1.5, opacity: .8, dot: false,
    values: Array.from({ length: maxDays }, (_, i) => i < dim ? round2(totalBudget * (i + 1) / dim) : null),
  });
  const cumHtml = Charts.line({ labels: Array.from({ length: maxDays }, (_, i) => String(i + 1)), series: cumSeries, height: 180 });

  /* Jour de la semaine */
  const wd = [0, 0, 0, 0, 0, 0, 0];
  exps.forEach(t => { const [y, m, d] = t.date.split('-').map(Number); wd[(new Date(y, m - 1, d).getDay() + 6) % 7] += t.amount; });
  const wdMax = Math.max(...wd);
  const wdHtml = exps.length ? `<div class="vbars">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) =>
    `<div class="vbar ${wd[i] === wdMax && wdMax > 0 ? 'max' : ''}"><span class="v">${wd[i] ? EUR0.format(wd[i]) : ''}</span>
      <i data-h="${wdMax ? Math.max(wd[i] ? 4 : 0, wd[i] / wdMax * 100).toFixed(1) : 0}%" style="transition-delay:${i * 50}ms"></i><small>${l}</small></div>`).join('')}</div>`
    : emptyState('📅', 'Pas de données', 'Ajoute des dépenses pour voir tes jours les plus dépensiers.');

  /* Top entreprises / lieux */
  const ranking = field => {
    const map = new Map();
    exps.forEach(t => {
      const v = (t[field] || '').trim(); if (!v) return;
      const k = v.toLowerCase();
      const cur = map.get(k) || { name: v, sum: 0, n: 0 };
      cur.sum += t.amount; cur.n++; map.set(k, cur);
    });
    const list = [...map.values()].sort((a, b) => b.sum - a.sum).slice(0, 5);
    if (!list.length) return emptyState(field === 'company' ? '🏪' : '📍', 'Rien à classer', `Renseigne ${field === 'company' ? 'l’entreprise' : 'le lieu'} dans tes opérations.`);
    const max = list[0].sum;
    return list.map((r, i) => `<div class="rank" style="--i:${i}"><span class="n">${i + 1}</span><div class="rk-main">
      <div class="rk-name"><span>${esc(r.name)}</span><span>${EUR.format(r.sum)}</span></div>
      <div class="rk-sub">${r.n} opération${r.n > 1 ? 's' : ''}</div>
      <div class="progress accent"><i data-w="${(r.sum / max * 100).toFixed(1)}%"></i></div></div></div>`).join('');
  };

  /* Variations vs mois précédent */
  const ps = summary(pm);
  const deltas = state.categories.filter(c => c.type === 'expense')
    .map(c => ({ c, now: s.byCat.get(c.id) || 0, before: ps.byCat.get(c.id) || 0 }))
    .filter(d => d.now || d.before)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before)).slice(0, 5);
  const deltaHtml = deltas.length ? deltas.map((d, i) => {
    const diff = round2(d.now - d.before);
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    return `<div class="rank" style="--i:${i}"><span class="n">${esc(d.c.emoji)}</span><div class="rk-main">
      <div class="rk-name"><span>${esc(d.c.name)}</span><span class="delta ${cls}">${diff > 0 ? '▲ +' : diff < 0 ? '▼ −' : ''}${EUR.format(Math.abs(diff))}</span></div>
      <div class="rk-sub" style="margin:0">${EUR.format(d.before)} → ${EUR.format(d.now)}</div></div></div>`;
  }).join('') : emptyState('↕️', 'Rien à comparer', 'Il faut des dépenses sur deux mois.');

  return `
    ${kpiHtml}
    <section class="card" style="--d:1"><h3>Répartition des dépenses</h3>${donutHtml}</section>
    <section class="card" style="--d:2"><h3>Évolution sur ${nMonths} mois</h3>${evoHtml}</section>
    <section class="card" style="--d:3"><h3>Dépenses cumulées</h3>${cumHtml}</section>
    <section class="card" style="--d:4"><h3>Par jour de la semaine</h3>${wdHtml}</section>
    <section class="card" style="--d:5"><h3>Vs ${monthLabel(pm).toLowerCase()}</h3>${deltaHtml}</section>
    <section class="card" style="--d:6"><h3>Top entreprises</h3>${ranking('company')}</section>
    <section class="card" style="--d:7"><h3>Top lieux</h3>${ranking('place')}</section>`;
}

/* ---------- Onglet Réglages ---------- */
function viewSettings() {
  const exp = state.categories.filter(c => c.type === 'expense');
  const inc = state.categories.filter(c => c.type === 'income');
  const totalBudget = exp.reduce((a, c) => a + (c.budget || 0), 0);
  const catRow = c => {
    const n = state.transactions.filter(t => t.categoryId === c.id).length;
    const sub = c.type === 'expense'
      ? (c.budget ? `Budget ${EUR0.format(c.budget)} / mois` : 'Pas de budget')
      : `${n} opération${n > 1 ? 's' : ''}`;
    return `<button class="list-row" data-cat="${c.id}">
      <span class="row-ico" style="background:${tint(c.color)}">${esc(c.emoji)}</span>
      <span class="row-main"><b>${esc(c.name)}</b><small>${sub}</small></span><span class="chev">›</span></button>`;
  };
  const dataRow = (action, ico, title, sub, danger) => `<button class="list-row" data-action="${action}">
    <span class="row-ico" style="background:${danger ? 'var(--red-soft)' : 'var(--bg)'}">${ico}</span>
    <span class="row-main ${danger ? 'danger' : ''}"><b>${title}</b><small>${sub}</small></span><span class="chev">›</span></button>`;

  return `
  <section class="card" style="--d:0">
    <h3>Objectif d’épargne</h3>
    <button class="list-row" data-action="edit-goal">
      <span class="row-ico" style="background:var(--accent-soft)">🎯</span>
      <span class="row-main"><b>Objectif mensuel</b><small>Ce que tu veux garder chaque mois</small></span>
      <span class="row-val">${EUR.format(state.savingsGoal || 0)}</span><span class="chev">›</span>
    </button>
  </section>
  <section class="card" style="--d:1">
    <h3>Dépenses & budgets <span class="muted">Total ${EUR0.format(totalBudget)} / mois</span></h3>
    ${exp.map(catRow).join('')}
    <button class="add-row" data-action="add-cat" data-type="expense">＋ Ajouter une catégorie</button>
  </section>
  <section class="card" style="--d:2">
    <h3>Revenus</h3>
    ${inc.map(catRow).join('')}
    <button class="add-row" data-action="add-cat" data-type="income">＋ Ajouter une catégorie</button>
  </section>
  <section class="card" style="--d:3">
    <h3>Données</h3>
    ${dataRow('export-json', '💾', 'Exporter une sauvegarde', 'Fichier .json à garder dans Fichiers / iCloud')}
    ${dataRow('import-json', '📥', 'Restaurer une sauvegarde', 'Remplace les données actuelles')}
    ${dataRow('export-csv', '📊', 'Exporter en CSV', 'Pour Excel / Numbers')}
    ${dataRow('reset', '🗑️', 'Tout effacer', 'Opérations, catégories et objectifs', true)}
    <p class="hint">🔒 Tes données restent uniquement sur ton iPhone, rien n’est envoyé sur Internet. Exporte une sauvegarde de temps en temps.</p>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
  </section>`;
}

const VIEWS = { home: viewHome, ops: viewOps, stats: viewStats, settings: viewSettings };

/* =========================================================
   Panneaux (sheets), dialogues, toast
   ========================================================= */
function openSheet(html, onMount) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="backdrop"></div><div class="sheet" role="dialog"><div class="grabber"></div>${html}</div>`;
  root.classList.add('open');
  void root.offsetWidth;
  root.classList.add('visible');
  root.querySelector('.backdrop').addEventListener('click', closeSheet);
  $$('[data-close]', root).forEach(b => b.addEventListener('click', closeSheet));
  onMount && onMount(root.querySelector('.sheet'));
}
function closeSheet() {
  const root = $('#sheet-root');
  root.classList.remove('visible');
  document.activeElement && document.activeElement.blur();
  setTimeout(() => { if (!root.classList.contains('visible')) { root.classList.remove('open'); root.innerHTML = ''; } }, 320);
}

function confirmDialog(title, message, okLabel = 'Confirmer', danger = true) {
  return new Promise(resolve => {
    const root = $('#dialog-root');
    root.innerHTML = `<div class="dlg-backdrop"></div><div class="dlg"><h3>${title}</h3><p>${message}</p>
      <div class="dlg-actions"><button class="btn ghost" data-r="0">Annuler</button>
      <button class="btn ${danger ? 'danger-solid' : 'primary'}" data-r="1">${okLabel}</button></div></div>`;
    root.classList.add('open');
    void root.offsetWidth;
    root.classList.add('visible');
    root.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (!b && !e.target.classList.contains('dlg-backdrop')) return;
      root.onclick = null;
      root.classList.remove('visible');
      setTimeout(() => { root.classList.remove('open'); root.innerHTML = ''; }, 250);
      resolve(!!b && b.dataset.r === '1');
    };
  });
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

/* ---------- Ajout / modification d'une opération ---------- */
function openTxSheet(existing) {
  const editing = !!existing;
  const t = existing ? { ...existing } : {
    type: 'expense', amount: '', categoryId: '', company: '', place: '', note: '',
    date: ui.month === currentMonth() ? todayISO() : `${ui.month}-01`,
  };
  let catTouched = editing;

  const html = `
    <div class="sheet-head"><h2>${editing ? 'Modifier l’opération' : 'Nouvelle opération'}</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <div class="seg" id="tx-type" data-v="${t.type}">
      <span class="seg-thumb"></span>
      <button data-v="expense">Dépense</button><button data-v="income">Revenu</button>
    </div>
    <label class="amount-field ${t.type}" id="amount-wrap">
      <input id="tx-amount" inputmode="decimal" placeholder="0,00" value="${amountInput(t.amount)}" autocomplete="off" enterkeyhint="done"><span>€</span>
    </label>
    <div class="field-label">Catégorie</div>
    <div class="cat-grid" id="tx-cats"></div>
    <label class="field"><span>Entreprise / commerce</span>
      <input id="tx-company" list="dl-company" placeholder="ex. Carrefour, SNCF, Netflix" value="${esc(t.company)}" autocomplete="off"></label>
    <label class="field"><span>Lieu</span>
      <input id="tx-place" list="dl-place" placeholder="ex. Grenoble, En ligne" value="${esc(t.place)}" autocomplete="off"></label>
    <label class="field"><span>Date</span><input id="tx-date" type="date" value="${t.date}"></label>
    <label class="field"><span>Note (facultatif)</span><input id="tx-note" placeholder="ex. Courses de la semaine" value="${esc(t.note)}" autocomplete="off"></label>
    <datalist id="dl-company">${uniqueValues('company').map(v => `<option value="${esc(v)}">`).join('')}</datalist>
    <datalist id="dl-place">${uniqueValues('place').map(v => `<option value="${esc(v)}">`).join('')}</datalist>
    <button class="btn primary" id="tx-save">${editing ? 'Enregistrer' : 'Ajouter'}</button>
    ${editing ? '<button class="btn danger" id="tx-del">Supprimer</button>' : ''}`;

  openSheet(html, sheet => {
    const seg = $('#tx-type', sheet), grid = $('#tx-cats', sheet), wrap = $('#amount-wrap', sheet);
    const amount = $('#tx-amount', sheet), company = $('#tx-company', sheet);

    const renderCats = () => {
      const cats = state.categories.filter(c => c.type === t.type);
      grid.innerHTML = cats.map(c => `<button class="cat-chip ${c.id === t.categoryId ? 'on' : ''}" data-id="${c.id}"
        style="--c:${c.color};--cbg:${tint(c.color)}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('');
    };
    const setType = type => {
      t.type = type;
      seg.dataset.v = type;
      $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.v === type));
      wrap.className = `amount-field ${type}`;
      if (t.categoryId && catById(t.categoryId).type !== type) t.categoryId = '';
      renderCats();
    };
    setType(t.type);

    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setType(b.dataset.v); });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.cat-chip'); if (!b) return;
      t.categoryId = b.dataset.id; catTouched = true; renderCats();
    });
    // Suggestion : si l'entreprise a déjà été utilisée, on pré-sélectionne sa catégorie (modifiable)
    company.addEventListener('change', () => {
      if (catTouched) return;
      const v = company.value.trim().toLowerCase(); if (!v) return;
      const prev = sortTx(state.transactions).find(x => (x.company || '').trim().toLowerCase() === v);
      if (prev && catById(prev.categoryId).type === prev.type) {
        if (prev.type !== t.type) setType(prev.type);
        t.categoryId = prev.categoryId; renderCats();
      }
    });

    if (!editing) amount.focus();

    $('#tx-save', sheet).addEventListener('click', () => {
      const val = parseAmount(amount.value);
      if (!(val > 0)) { shake(wrap); toast('Indique un montant'); return; }
      if (!t.categoryId) { shake(grid); toast('Choisis une catégorie'); return; }
      const date = $('#tx-date', sheet).value || todayISO();
      const data = {
        type: t.type, amount: val, categoryId: t.categoryId, date,
        company: company.value.trim(), place: $('#tx-place', sheet).value.trim(), note: $('#tx-note', sheet).value.trim(),
      };
      if (editing) Object.assign(state.transactions.find(x => x.id === existing.id), data);
      else state.transactions.push({ id: uid(), createdAt: Date.now(), ...data });
      save();
      closeSheet();
      ui.month = date.slice(0, 7);
      render(null);
      toast(editing ? '✓ Opération modifiée' : (t.type === 'income' ? '✓ Revenu ajouté' : '✓ Dépense ajoutée'));
    });

    editing && $('#tx-del', sheet).addEventListener('click', async () => {
      if (!await confirmDialog('Supprimer ?', 'Cette opération sera définitivement supprimée.', 'Supprimer')) return;
      state.transactions = state.transactions.filter(x => x.id !== existing.id);
      save(); closeSheet(); render(null); toast('Opération supprimée');
    });
  });
}

/* ---------- Catégories ---------- */
function openCatSheet(cat, type) {
  const editing = !!cat;
  const c = cat ? { ...cat } : {
    name: '', emoji: type === 'income' ? '💶' : '🏷️', type, budget: null,
    color: PALETTE[state.categories.length % PALETTE.length],
  };
  const html = `
    <div class="sheet-head"><h2>${editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <div class="cat-preview"><span id="cp" class="tx-ico big" style="background:${tint(c.color)}">${esc(c.emoji)}</span></div>
    <div class="row2">
      <label class="field" style="flex:0 0 84px"><span>Emoji</span><input id="c-emoji" value="${esc(c.emoji)}" style="text-align:center;font-size:22px"></label>
      <label class="field"><span>Nom</span><input id="c-name" value="${esc(c.name)}" placeholder="ex. Cadeaux" autocomplete="off"></label>
    </div>
    <div class="field-label">Couleur</div>
    <div class="swatches">${PALETTE.map(col => `<button class="sw ${col === c.color ? 'on' : ''}" data-col="${col}" style="background:${col}" aria-label="Couleur"></button>`).join('')}</div>
    ${c.type === 'expense' ? `<label class="field"><span>Budget max par mois (€) — vide = aucun budget</span>
      <input id="c-budget" inputmode="decimal" value="${amountInput(c.budget)}" placeholder="ex. 150" autocomplete="off"></label>` : ''}
    <button class="btn primary" id="c-save">Enregistrer</button>
    ${editing ? '<button class="btn danger" id="c-del">Supprimer la catégorie</button>' : ''}`;

  openSheet(html, sheet => {
    const prev = $('#cp', sheet), emoji = $('#c-emoji', sheet);
    emoji.addEventListener('input', () => {
      let v = emoji.value.trim();
      if (window.Intl && Intl.Segmenter && v) v = [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(v)].pop().segment;
      if (v) { emoji.value = v; prev.textContent = v; c.emoji = v; }
    });
    $('.swatches', sheet).addEventListener('click', e => {
      const b = e.target.closest('.sw'); if (!b) return;
      c.color = b.dataset.col;
      $$('.sw', sheet).forEach(x => x.classList.toggle('on', x === b));
      prev.style.background = tint(c.color);
    });
    if (!editing) $('#c-name', sheet).focus();

    $('#c-save', sheet).addEventListener('click', () => {
      const name = $('#c-name', sheet).value.trim();
      if (!name) { shake($('#c-name', sheet)); toast('Donne un nom à la catégorie'); return; }
      let budget = null;
      if (c.type === 'expense') {
        const raw = $('#c-budget', sheet).value.trim();
        if (raw) {
          budget = parseAmount(raw);
          if (!(budget >= 0)) { toast('Budget invalide'); return; }
          if (budget === 0) budget = null;
        }
      }
      const data = { name, emoji: c.emoji || '🏷️', color: c.color, budget };
      if (editing) Object.assign(state.categories.find(x => x.id === cat.id), data);
      else state.categories.push({ id: uid(), type: c.type, ...data });
      save(); closeSheet(); render(null);
      toast(editing ? '✓ Catégorie modifiée' : '✓ Catégorie ajoutée');
    });

    editing && $('#c-del', sheet).addEventListener('click', async () => {
      const others = state.categories.filter(x => x.type === cat.type && x.id !== cat.id);
      if (!others.length) { toast('Garde au moins une catégorie'); return; }
      const used = state.transactions.filter(t => t.categoryId === cat.id);
      const fallback = others.find(x => /^(divers|autres)/i.test(x.name)) || others[others.length - 1];
      const msg = used.length
        ? `${used.length} opération${used.length > 1 ? 's' : ''} ser${used.length > 1 ? 'ont' : 'a'} déplacée${used.length > 1 ? 's' : ''} vers « ${esc(fallback.name)} ».`
        : 'Cette catégorie n’est utilisée par aucune opération.';
      if (!await confirmDialog(`Supprimer « ${esc(cat.name)} » ?`, msg, 'Supprimer')) return;
      used.forEach(t => { t.categoryId = fallback.id; });
      state.categories = state.categories.filter(x => x.id !== cat.id);
      if (ui.filter.cat === cat.id) ui.filter.cat = '';
      save(); closeSheet(); render(null); toast('Catégorie supprimée');
    });
  });
}

/* ---------- Objectif d'épargne ---------- */
function openGoalSheet() {
  const html = `
    <div class="sheet-head"><h2>Objectif d’épargne</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <p class="hint" style="margin:0 0 6px">Montant que tu veux mettre de côté chaque mois (revenus − dépenses).</p>
    <label class="amount-field" id="g-wrap"><input id="g-amount" inputmode="decimal" value="${amountInput(state.savingsGoal)}" placeholder="0" autocomplete="off"><span>€</span></label>
    <button class="btn primary" id="g-save">Enregistrer</button>`;
  openSheet(html, sheet => {
    const input = $('#g-amount', sheet);
    input.focus();
    $('#g-save', sheet).addEventListener('click', () => {
      const v = input.value.trim() === '' ? 0 : parseAmount(input.value);
      if (!(v >= 0)) { shake($('#g-wrap', sheet)); return; }
      state.savingsGoal = v; save(); closeSheet(); render(null); toast('✓ Objectif mis à jour');
    });
  });
}

/* ---------- Export / import ---------- */
async function shareOrDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function exportJSON() {
  shareOrDownload(`budget-sauvegarde-${todayISO()}.json`, JSON.stringify(state, null, 2), 'application/json');
}

function exportCSV() {
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [['Date', 'Type', 'Catégorie', 'Montant', 'Entreprise', 'Lieu', 'Note']];
  [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    rows.push([t.date, t.type === 'income' ? 'Revenu' : 'Dépense', catById(t.categoryId).name,
      String(t.type === 'income' ? t.amount : -t.amount).replace('.', ','), t.company, t.place, t.note]);
  });
  shareOrDownload(`budget-${todayISO()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\n'), 'text/csv');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.categories) || !Array.isArray(data.transactions)) throw new Error('format');
      data.transactions = data.transactions.filter(t => t && t.date && isFinite(t.amount));
      const ok = await confirmDialog('Restaurer la sauvegarde ?',
        `${data.transactions.length} opérations et ${data.categories.length} catégories remplaceront tes données actuelles.`, 'Restaurer', false);
      if (!ok) return;
      state = { version: 1, savingsGoal: Number(data.savingsGoal) || 0, categories: data.categories, transactions: data.transactions };
      save(); render(); toast('✓ Sauvegarde restaurée');
    } catch (e) { toast('⚠️ Fichier de sauvegarde invalide'); }
  };
  reader.readAsText(file);
}

/* =========================================================
   Événements
   ========================================================= */
function goTab(tab) {
  if (tab === ui.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  ui.tab = tab;
  window.scrollTo(0, 0);
  render();
}
function changeMonth(delta) {
  ui.month = addMonths(ui.month, delta);
  render(delta > 0 ? 'slide-left' : 'slide-right');
}

$('.tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) goTab(b.dataset.tab); });
$('#prev-month').addEventListener('click', () => changeMonth(-1));
$('#next-month').addEventListener('click', () => changeMonth(1));
$('#fab').addEventListener('click', () => openTxSheet());

const view = $('#view');
view.addEventListener('click', async e => {
  const el = e.target.closest('[data-edit],[data-goto],[data-cat],[data-action],[data-ftype]');
  if (!el) return;
  if (el.dataset.edit) { const t = state.transactions.find(x => x.id === el.dataset.edit); t && openTxSheet(t); return; }
  if (el.dataset.goto) { goTab(el.dataset.goto); return; }
  if (el.dataset.cat) { openCatSheet(state.categories.find(c => c.id === el.dataset.cat)); return; }
  if (el.dataset.ftype) { ui.filter.type = el.dataset.ftype; refreshOpsList(); return; }
  switch (el.dataset.action) {
    case 'edit-goal': openGoalSheet(); break;
    case 'add-cat': openCatSheet(null, el.dataset.type); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'import-json': $('#import-file').click(); break;
    case 'dismiss-hint': localStorage.setItem(HINT_KEY, '1'); render(null); break;
    case 'reset':
      if (await confirmDialog('Tout effacer ?', 'Toutes tes opérations, catégories et objectifs seront supprimés. Pense à exporter une sauvegarde avant.', 'Tout effacer')) {
        state = defaultState(); save(); render(); toast('Données réinitialisées');
      }
      break;
  }
});
view.addEventListener('input', e => {
  if (e.target.id === 'ops-q') { ui.filter.q = e.target.value; refreshOpsList(); }
});
view.addEventListener('change', e => {
  if (e.target.id === 'ops-cat') { ui.filter.cat = e.target.value; refreshOpsList(); }
  if (e.target.id === 'import-file' && e.target.files[0]) { importJSON(e.target.files[0]); e.target.value = ''; }
});

// Glisser à gauche / droite pour changer de mois (Accueil et Stats)
let touch = null;
view.addEventListener('touchstart', e => {
  if (ui.tab !== 'home' && ui.tab !== 'stats') return;
  const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, time: Date.now() };
}, { passive: true });
view.addEventListener('touchend', e => {
  if (!touch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && Date.now() - touch.time < 600) changeMonth(dx < 0 ? 1 : -1);
  touch = null;
}, { passive: true });

// Revenir au mois courant quand on rouvre l'appli un autre mois
let lastMonth = currentMonth();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentMonth() !== lastMonth) {
    lastMonth = currentMonth(); ui.month = lastMonth; render();
  }
});

/* ---------- Démarrage ---------- */
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
