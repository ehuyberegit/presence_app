/* ─────────────────────────────────────────────
   Présence — app.js
   Journal de soi : pings aléatoires, mood, tags, analyse
───────────────────────────────────────────── */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

const INTENSITY_LABELS = [
  '', 'À peine perceptible', 'Légère', 'Modérée', 'Forte', 'Très intense'
];

const VALENCE_LABELS = { pos: 'Positif', neu: 'Neutre', neg: 'Négatif' };

const DEFAULT_TAGS = [
  'Travail', 'Projets perso', 'Relationnel',
  'Corps & santé', 'Finances', 'Futur', 'Passé', 'Rêverie'
];

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// ── State ──────────────────────────────────────────────────────────────────

let tags     = load('presence_tags')  || [...DEFAULT_TAGS];
let pings    = (load('presence_pings') || []).map(p => ({ ...p, ts: new Date(p.ts) }));
let nextId   = pings.length ? Math.max(...pings.map(p => p.id)) + 1 : 1;

let selectedTag       = null;
let selectedValence   = null;
let selectedIntensity = null;

const summaryCache = {};

// ── Ping timer state ───────────────────────────────────────────────────────

let timerActive   = false;
let timerTimeout  = null;
let timerNextTime = null;

// ── Persistence ────────────────────────────────────────────────────────────

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function persist() {
  localStorage.setItem('presence_pings', JSON.stringify(pings));
  localStorage.setItem('presence_tags',  JSON.stringify(tags));
}

// ── Utilities ──────────────────────────────────────────────────────────────

function fmtTime(ts) {
  return ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDayLabel(ts) {
  return ts.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

function fmtDayKey(ts) { return ts.toDateString(); }

function isoDate() { return new Date().toISOString().split('T')[0]; }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2300);
}

function updateDatetime() {
  const el = document.getElementById('current-datetime');
  if (el) el.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function updateSidebar() {
  const days = new Set(pings.map(p => fmtDayKey(p.ts))).size;
  const el   = document.getElementById('sidebar-stats');
  if (el) el.innerHTML =
    `${pings.length} ping${pings.length !== 1 ? 's' : ''}<br>` +
    `${days} jour${days !== 1 ? 's' : ''}<br>` +
    `${tags.length} tags`;
}

// ── Navigation ─────────────────────────────────────────────────────────────

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const view = document.getElementById('view-' + viewId);
  if (view) view.classList.add('active');

  const btn = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (btn) btn.classList.add('active');

  if (viewId === 'ping')    renderTagSelector();
  if (viewId === 'journal') renderJournal();
  if (viewId === 'analyse') renderAnalyse();
  if (viewId === 'tags')    renderTags();

  updateSidebar();
}

// ── Random ping timer ──────────────────────────────────────────────────────

function scheduleNextPing() {
  const base    = parseInt(document.getElementById('timer-interval').value, 10);
  // Random between 50% and 150% of base interval
  const minutes = base * (0.5 + Math.random());
  const ms      = Math.round(minutes * 60 * 1000);
  timerNextTime = new Date(Date.now() + ms);

  updateTimerUI();

  timerTimeout = setTimeout(() => {
    triggerPingAlert();
  }, ms);
}

function triggerPingAlert() {
  // Show overlay
  document.getElementById('ping-alert').classList.add('show');

  // Play a soft beep using Web Audio API
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch(e) { /* silently ignore if audio not available */ }

  // Vibrate on mobile
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  // Schedule next ping (timer stays active)
  if (timerActive) scheduleNextPing();
}

function dismissPingAlert(goToForm) {
  document.getElementById('ping-alert').classList.remove('show');
  if (goToForm) showView('ping');
}

function toggleTimer() {
  timerActive = !timerActive;

  if (timerActive) {
    scheduleNextPing();
    document.getElementById('timer-toggle').textContent = 'Arrêter';
    document.getElementById('timer-toggle').classList.add('active');
    document.getElementById('timer-status').textContent = 'Actif';
    document.getElementById('timer-status').classList.add('active');
  } else {
    clearTimeout(timerTimeout);
    timerTimeout  = null;
    timerNextTime = null;
    document.getElementById('timer-toggle').textContent = 'Démarrer';
    document.getElementById('timer-toggle').classList.remove('active');
    document.getElementById('timer-status').textContent = 'Inactif';
    document.getElementById('timer-status').classList.remove('active');
    document.getElementById('timer-next').textContent = '';
  }
}

function updateTimerUI() {
  const el = document.getElementById('timer-next');
  if (!el || !timerNextTime) return;
  const diff = Math.max(0, Math.round((timerNextTime - Date.now()) / 60000));
  el.textContent = `Prochain ping dans ~${diff} min`;
}

// ── Mood selection ─────────────────────────────────────────────────────────

function selectValence(v) {
  // Toggle off if already selected
  selectedValence = selectedValence === v ? null : v;

  document.querySelectorAll('.valence-btn').forEach(b => b.classList.remove('selected'));

  const lbl = document.getElementById('valence-label');
  if (selectedValence) {
    document.getElementById('vbtn-' + selectedValence).classList.add('selected');
    if (lbl) lbl.textContent = VALENCE_LABELS[selectedValence];
  } else {
    if (lbl) lbl.textContent = '';
  }
}

function selectIntensity(i) {
  selectedIntensity = selectedIntensity === i ? null : i;

  document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('selected'));

  const lbl = document.getElementById('intensity-label');
  if (selectedIntensity) {
    document.getElementById('ibtn-' + selectedIntensity).classList.add('selected');
    if (lbl) lbl.textContent = INTENSITY_LABELS[selectedIntensity];
  } else {
    if (lbl) lbl.textContent = '— pas encore sélectionné';
  }
}

// ── Tag selector ───────────────────────────────────────────────────────────

function renderTagSelector() {
  const container = document.getElementById('tag-selector');
  if (!container) return;
  container.innerHTML =
    tags.map(t =>
      `<button class="tag-btn${selectedTag === t ? ' selected' : ''}" data-tag="${t}">${t}</button>`
    ).join('') +
    `<button class="tag-btn add-tag" data-view="tags">+ gérer</button>`;
}

function selectTag(t) {
  selectedTag = selectedTag === t ? null : t;
  renderTagSelector();
}

// ── Add ping ───────────────────────────────────────────────────────────────

function addPing() {
  const note     = document.getElementById('noteInput').value.trim();
  const lieu     = document.getElementById('lieuInput').value.trim();
  const personne = document.getElementById('personneInput').value.trim();

  const ping = {
    id:        nextId++,
    ts:        new Date(),
    note:      note     || null,
    tag:       selectedTag,
    valence:   selectedValence,
    intensity: selectedIntensity,
    lieu:      lieu     || null,
    personne:  personne || null,
  };

  pings.unshift(ping);
  persist();
  resetForm();
  updateSidebar();
  toast('Ping enregistré ✓');
}

function resetForm() {
  document.getElementById('noteInput').value     = '';
  document.getElementById('lieuInput').value     = '';
  document.getElementById('personneInput').value = '';

  selectedTag = null;
  selectedValence   = null;
  selectedIntensity = null;

  document.querySelectorAll('.valence-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('selected'));

  const vLbl = document.getElementById('valence-label');
  const iLbl = document.getElementById('intensity-label');
  if (vLbl) vLbl.textContent = '';
  if (iLbl) iLbl.textContent = '— pas encore sélectionné';

  renderTagSelector();
}

// ── Delete ping ────────────────────────────────────────────────────────────

function deletePing(id) {
  pings = pings.filter(p => p.id !== id);
  persist();
  renderJournal();
  updateSidebar();
}

// ── Ping card HTML ─────────────────────────────────────────────────────────

function pipsHTML(intensity) {
  return `<span class="intensity-pips">` +
    Array.from({ length: 5 }, (_, i) =>
      `<span class="pip${i < intensity ? ' filled' : ''}"></span>`
    ).join('') +
    `</span>`;
}

function pingCardHTML(p) {
  const tagHtml = p.tag ? `<span class="ping-tag">${p.tag}</span>` : '';
  const valHtml = p.valence
    ? `<span class="mood-badge"><span class="mood-dot ${p.valence}"></span>${VALENCE_LABELS[p.valence]}</span>`
    : '';
  const intHtml = p.intensity
    ? `<span class="mood-badge">${pipsHTML(p.intensity)}&thinsp;${p.intensity}/5</span>`
    : '';
  const ctxHtml = [
    p.lieu     ? `<span class="ctx-item">${p.lieu}</span>`     : '',
    p.personne ? `<span class="ctx-item">${p.personne}</span>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="ping-card">
      <span class="ping-time">${fmtTime(p.ts)}</span>
      <div class="ping-content">
        <div class="ping-meta">${tagHtml}${valHtml}${intHtml}</div>
        ${p.note ? `<div class="ping-note">&ldquo;${p.note}&rdquo;</div>` : ''}
        ${ctxHtml ? `<div class="ping-context">${ctxHtml}</div>` : ''}
      </div>
      <button class="ping-del" data-id="${p.id}">×</button>
    </div>`;
}

// ── Journal ────────────────────────────────────────────────────────────────

function renderJournal() {
  const feed    = document.getElementById('journal-feed');
  const countEl = document.getElementById('journal-count');
  if (!feed) return;

  if (countEl) countEl.textContent = `${pings.length} ping${pings.length !== 1 ? 's' : ''}`;

  if (!pings.length) {
    feed.innerHTML = `<div class="empty-state">Aucun ping encore.<br>Démarre le timer ou ajoute un ping manuellement.</div>`;
    return;
  }

  const groups = {};
  pings.forEach(p => {
    const k = fmtDayKey(p.ts);
    if (!groups[k]) groups[k] = { label: fmtDayLabel(p.ts), key: k, pings: [] };
    groups[k].pings.push(p);
  });

  feed.innerHTML = Object.values(groups).map(g => {
    const safeKey  = g.key.replace(/\s/g, '_');
    const cached   = summaryCache[g.key];
    const summaryBox = cached ? `<div class="day-summary-box">${cached}</div>` : '';
    return `
      <div class="day-group" id="group-${safeKey}">
        <div class="day-heading">
          <span>${g.label}</span>
          <button class="summary-btn" data-daykey="${g.key}" id="sumBtn-${safeKey}">
            ${cached ? 'Regénérer' : 'Résumé du jour'}
          </button>
        </div>
        ${summaryBox}
        ${g.pings.map(pingCardHTML).join('')}
      </div>`;
  }).join('');
}

// ── AI daily summary ───────────────────────────────────────────────────────

async function generateSummary(dayKey) {
  const safeKey = dayKey.replace(/\s/g, '_');
  const btn = document.getElementById(`sumBtn-${safeKey}`);
  if (btn) { btn.textContent = '...'; btn.classList.add('loading'); }

  const dayPings = pings.filter(p => fmtDayKey(p.ts) === dayKey);
  const formatted = dayPings.map(p =>
    [
      fmtTime(p.ts),
      `Tag: ${p.tag || '—'}`,
      `Valence: ${p.valence ? VALENCE_LABELS[p.valence] : '—'}`,
      `Intensité: ${p.intensity ? p.intensity + '/5' : '—'}`,
      p.lieu     ? `Lieu: ${p.lieu}`         : null,
      p.personne ? `Personne: ${p.personne}` : null,
      p.note     ? `"${p.note}"`             : null,
    ].filter(Boolean).join(' · ')
  ).join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        system: `Tu es un miroir bienveillant et honnête. Tu lis les pings d'une journée d'un journal de présence et tu rédiges un résumé narratif court (4 à 6 phrases). Ton ton est sobre, intime, direct — pas de compliments, pas de morale. Tu observes ce qui domine, ce qui contraste, ce qui revient. Tu écris à la deuxième personne du singulier, en français.`,
        messages: [{ role: 'user', content: `Voici mes pings du jour :\n\n${formatted}\n\nFais un résumé de cette journée.` }]
      })
    });
    const data = await res.json();
    const text = data.content?.find(b => b.type === 'text')?.text || 'Impossible de générer le résumé.';
    summaryCache[dayKey] = text;
    renderJournal();
  } catch (err) {
    console.error('Summary error:', err);
    if (btn) { btn.textContent = 'Erreur — réessayer'; btn.classList.remove('loading'); }
  }
}

// ── Analyse ────────────────────────────────────────────────────────────────

function renderAnalyse() {
  const el = document.getElementById('analyse-content');
  if (!el) return;

  if (pings.length < 2) {
    el.innerHTML = `<div class="empty-state">Pas assez de données encore.<br>Continue à pinger pour voir l'analyse.</div>`;
    return;
  }

  const total = pings.length;
  const days  = new Set(pings.map(p => fmtDayKey(p.ts))).size;
  const avg   = (total / days).toFixed(1);

  const tagCounts = {};
  tags.forEach(t => { tagCounts[t] = 0; });
  pings.forEach(p => { if (p.tag) tagCounts[p.tag] = (tagCounts[p.tag] || 0) + 1; });
  const sortedTags = Object.entries(tagCounts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);

  const valCounts = { pos: 0, neu: 0, neg: 0 };
  const pingsWithVal = pings.filter(p => p.valence);
  pingsWithVal.forEach(p => { valCounts[p.valence]++; });

  const pingsWithInt = pings.filter(p => p.intensity);
  const avgInt = pingsWithInt.length
    ? (pingsWithInt.reduce((s, p) => s + p.intensity, 0) / pingsWithInt.length).toFixed(1)
    : '—';

  const hourCounts = new Array(24).fill(0);
  pings.forEach(p => { hourCounts[p.ts.getHours()]++; });
  const maxHour = Math.max(...hourCounts, 1);

  const tagMood = {};
  sortedTags.forEach(([t]) => {
    const tp  = pings.filter(p => p.tag === t && p.valence);
    if (!tp.length) return;
    const pos = tp.filter(p => p.valence === 'pos').length;
    const neg = tp.filter(p => p.valence === 'neg').length;
    tagMood[t] = pos > neg ? 'pos' : neg > pos ? 'neg' : 'neu';
  });

  const lieuCounts = {};
  pings.filter(p => p.lieu).forEach(p => { lieuCounts[p.lieu] = (lieuCounts[p.lieu] || 0) + 1; });
  const sortedLieux = Object.entries(lieuCounts).sort((a, b) => b[1] - a[1]);

  const personneCounts = {};
  pings.filter(p => p.personne).forEach(p => { personneCounts[p.personne] = (personneCounts[p.personne] || 0) + 1; });
  const sortedPersonnes = Object.entries(personneCounts).sort((a, b) => b[1] - a[1]);

  const valTotal = pingsWithVal.length || 1;

  function barRow(label, count, total, cls = '') {
    return `<div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.round(count / total * 100)}%"></div></div>
      <span class="bar-val">${count}</span>
    </div>`;
  }

  const tagBars = sortedTags.slice(0, 8).map(([t, c]) => barRow(t, c, total)).join('');

  const valBars = [
    ['Positif', valCounts.pos, 'pos'],
    ['Neutre',  valCounts.neu, 'neu'],
    ['Négatif', valCounts.neg, 'neg'],
  ].map(([l, c, cls]) => barRow(l, c, valTotal, cls)).join('');

  const hourBars = hourCounts.map((c, h) =>
    `<div class="hour-col">
      <div class="hour-bar" style="height:${Math.round(c / maxHour * 100)}%"></div>
      ${h % 3 === 0 ? `<span class="hour-lbl">${h}h</span>` : '<span class="hour-lbl"></span>'}
    </div>`
  ).join('');

  const corrCells = Object.entries(tagMood).map(([t, mood]) =>
    `<div class="corr-cell">
      <div class="corr-tag">${t}</div>
      <div class="corr-val ${mood}">${mood === 'pos' ? '+ bien' : mood === 'neg' ? '− pesant' : '≈ neutre'}</div>
    </div>`
  ).join('');

  const lieuBars    = sortedLieux.slice(0, 5).map(([l, c]) => barRow(l, c, total)).join('');
  const personneBars = sortedPersonnes.slice(0, 5).map(([p, c]) => barRow(p, c, total)).join('');

  el.innerHTML = `
    <div class="analyse-grid">

      <div class="analyse-card">
        <div class="analyse-title">Vue d'ensemble</div>
        <div class="stat-row"><div class="stat-big">${total}</div><div class="stat-label">pings au total</div></div>
        <div class="stat-row"><div class="stat-big" style="font-size:1.4rem">${avg}</div><div class="stat-label">pings par jour</div></div>
        <div class="stat-row"><div class="stat-big" style="font-size:1.4rem">${avgInt}</div><div class="stat-label">intensité moyenne</div></div>
      </div>

      <div class="analyse-card">
        <div class="analyse-title">Valence globale</div>
        ${valBars}
        <div style="margin-top:0.75rem;font-family:var(--font-mono);font-size:0.6rem;color:var(--ink-faint)">${pingsWithVal.length} pings avec valence sur ${total}</div>
      </div>

      <div class="analyse-card full">
        <div class="analyse-title">Tags — répartition</div>
        ${tagBars || '<div class="empty-state" style="padding:0.5rem 0">Aucun tag utilisé.</div>'}
      </div>

      <div class="analyse-card full">
        <div class="analyse-title">Mood dominant par tag</div>
        ${corrCells ? `<div class="corr-grid">${corrCells}</div>` : '<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--ink-faint)">Pas assez de données avec valence.</div>'}
      </div>

      <div class="analyse-card full">
        <div class="analyse-title">Distribution horaire</div>
        <div class="hour-chart">${hourBars}</div>
      </div>

      ${sortedLieux.length ? `<div class="analyse-card"><div class="analyse-title">Lieux</div>${lieuBars}</div>` : ''}
      ${sortedPersonnes.length ? `<div class="analyse-card"><div class="analyse-title">Personnes & contexte</div>${personneBars}</div>` : ''}

    </div>
    <div class="export-row">
      <button class="export-btn" id="exportJSON">Exporter JSON</button>
      <button class="export-btn" id="exportCSV">Exporter CSV</button>
    </div>`;

  document.getElementById('exportJSON')?.addEventListener('click', exportJSON);
  document.getElementById('exportCSV')?.addEventListener('click', exportCSV);
}

// ── Tags management ────────────────────────────────────────────────────────

function renderTags() {
  const list = document.getElementById('tags-list');
  if (!list) return;
  const tagCounts = {};
  pings.forEach(p => { if (p.tag) tagCounts[p.tag] = (tagCounts[p.tag] || 0) + 1; });
  list.innerHTML = tags.map(t =>
    `<div class="tag-row">
      <span class="tag-row-name">${t}</span>
      <span class="tag-row-count">${tagCounts[t] || 0} ping${(tagCounts[t] || 0) !== 1 ? 's' : ''}</span>
      <button class="del-btn" data-tag="${t}">Supprimer</button>
    </div>`
  ).join('');
}

function createTag() {
  const input = document.getElementById('newTagInput');
  if (!input) return;
  const name = input.value.trim();
  if (!name || tags.includes(name)) return;
  tags.push(name);
  persist();
  input.value = '';
  renderTags();
  toast(`Tag "${name}" créé`);
}

function deleteTag(t) {
  if (!confirm(`Supprimer le tag "${t}" ? Il sera retiré de tous les pings existants.`)) return;
  tags = tags.filter(x => x !== t);
  pings.forEach(p => { if (p.tag === t) p.tag = null; });
  persist();
  renderTags();
  toast(`Tag "${t}" supprimé`);
}

// ── Export ─────────────────────────────────────────────────────────────────

function exportJSON() {
  const blob = new Blob([JSON.stringify(pings, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `presence_${isoDate()}.json`);
}

function exportCSV() {
  const header = 'datetime,tag,valence,intensity,lieu,personne,note';
  const rows   = pings.map(p => [
    p.ts.toISOString(), p.tag || '', p.valence || '', p.intensity || '',
    p.lieu || '', p.personne || '', `"${(p.note || '').replace(/"/g, '""')}"`
  ].join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  triggerDownload(blob, `presence_${isoDate()}.csv`);
}

function triggerDownload(blob, filename) {
  const a  = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Event delegation ───────────────────────────────────────────────────────

document.addEventListener('click', e => {
  const t = e.target;

  if (t.matches('.nav-item[data-view]'))             { showView(t.dataset.view); return; }
  if (t.matches('#tag-selector .tag-btn[data-tag]')) { selectTag(t.dataset.tag); return; }
  if (t.matches('#tag-selector .add-tag'))           { showView('tags'); return; }
  if (t.matches('.valence-btn[data-v]'))             { selectValence(t.dataset.v); return; }
  if (t.matches('.intensity-btn[data-i]'))           { selectIntensity(parseInt(t.dataset.i, 10)); return; }
  if (t.matches('#submitPing'))                      { addPing(); return; }
  if (t.matches('.ping-del[data-id]'))               { deletePing(parseInt(t.dataset.id, 10)); return; }
  if (t.matches('.summary-btn[data-daykey]'))        { generateSummary(t.dataset.daykey); return; }
  if (t.matches('.del-btn[data-tag]'))               { deleteTag(t.dataset.tag); return; }
  if (t.matches('#createTagBtn'))                    { createTag(); return; }
  if (t.matches('#timer-toggle'))                    { toggleTimer(); return; }
  if (t.matches('#ping-alert-btn'))                  { dismissPingAlert(true); return; }
  if (t.matches('#ping-alert'))                      { dismissPingAlert(false); return; }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('#newTagInput')) createTag();
  if (e.key === 'Escape') dismissPingAlert(false);
});

// ── Init ───────────────────────────────────────────────────────────────────

function init() {
  updateDatetime();
  setInterval(updateDatetime, 30_000);
  setInterval(updateTimerUI, 60_000);
  updateSidebar();
  renderTagSelector();
}

init();
