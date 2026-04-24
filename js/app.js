'use strict';

// ── DEFAULT DATA ──────────────────────────────────────────────────────────

const DEFAULT_THOUGHTS = [
  { emoji: '💼', name: 'Travail' },
  { emoji: '❤️', name: 'Relations' },
  { emoji: '🔮', name: 'Futur' },
  { emoji: '📦', name: 'Passé' },
  { emoji: '🫀', name: 'Corps' },
  { emoji: '😰', name: 'Inquiétude' },
  { emoji: '☁️', name: 'Rêverie' },
  { emoji: '🫥', name: 'Vide' },
  { emoji: '✨', name: 'Créativité' },
  { emoji: '😒', name: 'Ennui' },
  { emoji: '🍕', name: 'Faim' },
  { emoji: '🛋️', name: 'Fatigue' },
];

const DEFAULT_MOODS = [
  { emoji: '😌', name: 'Calme' },
  { emoji: '😊', name: 'Bien' },
  { emoji: '🤩', name: 'Enthousiaste' },
  { emoji: '🤔', name: 'Perdu' },
  { emoji: '😑', name: 'Ennuyé' },
  { emoji: '😴', name: 'Fatigué' },
  { emoji: '😤', name: 'Frustré' },
  { emoji: '😟', name: 'Anxieux' },
  { emoji: '😔', name: 'Triste' },
  { emoji: '🤯', name: 'Overwhelmé' },
];

const EMOJI_MOODS = [
  '😌','😊','🙂','😀','😁','🤩','😎','🥰','😇','🤗',
  '😑','😒','🙄','😤','😠','😡','🤬','😾','💢','🫠',
  '😟','😧','😨','😰','😱','😭','😢','😔','😞','😿',
  '😴','🥱','😪','🤔','🤯','😵','🥴','😶','🫥','😐',
  '🥳','😏','😈','🤑','😬','🫤','😮','😲','🫡','😇',
];

const EMOJI_THOUGHTS = [
  '💼','💻','📊','📋','📝','✉️','📞','🗂️','🖊️','🔧',
  '❤️','👥','💬','🤝','🫂','👯','🗣️','💌','💑','🧑‍🤝‍🧑',
  '🔮','📦','⏰','🕰️','📅','⌛','🔄','🗓️','🌅','🌄',
  '🫀','🏃','🧘','💪','🍽️','😴','🤒','🛁','🧠','👁️',
  '🏠','☕','✈️','🚗','🌍','🏙️','🌿','🏖️','🏔️','🚶',
  '✨','🎵','🎨','📚','🎮','🍕','🍺','🎬','⚽','🎯',
  '☁️','🌊','🔥','⚡','🌙','☀️','🌱','💡','🎲','🔑',
];

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// ── STATE ─────────────────────────────────────────────────────────────────

let currentUser = null;
let state = {
  running: false,
  intervalMin: 20,
  variance: true,
  nextPingAt: null,
  pingTimer: null,
  countdownTimer: null,
  entries: [],
  selectedTags: [],
  selectedMoods: [],
  currentPingTime: null,
  filter: 'day',
  analyseFilter: 'day',
};

let thoughtList = [];
let moodList = [];
const narrativeCache = {};

// ── STORAGE ───────────────────────────────────────────────────────────────

const _mem = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return _mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { _mem[k] = v; } },
};
function key(k) { return 'presence_' + (currentUser || 'default') + '_' + k; }

function loadState() {
  try {
    const saved = store.get(key('entries'));
    if (saved) state.entries = JSON.parse(saved);
    const conf = store.get(key('config'));
    if (conf) { const c = JSON.parse(conf); state.intervalMin = c.intervalMin || 20; state.variance = c.variance !== undefined ? c.variance : true; }
    thoughtList = JSON.parse(store.get(key('thoughts')) || 'null') || [...DEFAULT_THOUGHTS];
    moodList    = JSON.parse(store.get(key('moods'))    || 'null') || [...DEFAULT_MOODS];
  } catch {}
}
function saveEntries() { try { store.set(key('entries'), JSON.stringify(state.entries)); } catch {} }
function saveConfig()  { try { store.set(key('config'),  JSON.stringify({ intervalMin: state.intervalMin, variance: state.variance })); } catch {} }
function saveLists()   { try { store.set(key('thoughts'), JSON.stringify(thoughtList)); store.set(key('moods'), JSON.stringify(moodList)); } catch {} }

// ── CLOCK ─────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
  document.getElementById('dateDisplay').textContent =
    days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()];
}
setInterval(updateClock, 10000);
updateClock();

// ── STREAK ────────────────────────────────────────────────────────────────

function computeStreak() {
  const answered = state.entries.filter(e => !e.skipped);
  if (!answered.length) return 0;

  const uniqueDays = [...new Set(answered.map(e => new Date(e.time).toDateString()))];
  const sorted = uniqueDays.map(d => new Date(d)).sort((a,b) => b - a);

  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  let cursor = new Date(today);

  for (const day of sorted) {
    const d = new Date(day); d.setHours(0,0,0,0);
    if (d.getTime() === cursor.getTime()) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (d.getTime() < cursor.getTime()) {
      break;
    }
  }
  return streak;
}

// ── HOME META (streak + last ping) ───────────────────────────────────────

function updateHomeMeta() {
  const el = document.getElementById('home-meta');
  if (!el) return;

  const streak = computeStreak();
  const lastAnswered = state.entries.find(e => !e.skipped);

  let html = '';

  if (streak > 0) {
    html += `<div class="home-streak">
      <span class="streak-flame">🔥</span>
      <span class="streak-num">${streak}</span>
      <span class="streak-label">jour${streak > 1 ? 's' : ''} consécutif${streak > 1 ? 's' : ''}</span>
    </div>`;
  }

  if (lastAnswered) {
    const d = new Date(lastAnswered.time);
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    const moodsArr = (lastAnswered.moods && lastAnswered.moods.length) ? lastAnswered.moods : (lastAnswered.mood ? [lastAnswered.mood] : []);
    const tagsStr = (lastAnswered.tags || []).join(' · ');
    const moodStr = moodsArr.map(m => m.emoji + ' ' + m.name).join('  ');
    const preview = [tagsStr, moodStr].filter(Boolean).join('  ·  ') || lastAnswered.text || '—';

    html += `<div class="last-ping-preview">
      <span class="last-ping-time">${timeStr}</span>
      <span class="last-ping-content">${preview}</span>
    </div>`;
  }

  el.innerHTML = html;
  el.style.display = html ? 'flex' : 'none';
}

// ── INTERVAL CONFIG ───────────────────────────────────────────────────────

function changeInterval(delta) {
  state.intervalMin = Math.max(5, Math.min(120, state.intervalMin + delta));
  document.getElementById('intervalDisplay').textContent = state.intervalMin;
  saveConfig();
  if (state.running) restartTimer();
}

function toggleVariance() {
  state.variance = !state.variance;
  document.getElementById('varianceToggle').classList.toggle('on', state.variance);
  saveConfig();
  if (state.running) restartTimer();
}

// ── SESSION ───────────────────────────────────────────────────────────────

function toggleSession() { if (state.running) stopSession(); else startSession(); }

function startSession() {
  state.running = true;
  document.getElementById('mainBtn').className = 'btn-main btn-stop';
  document.getElementById('mainBtn').textContent = 'Arrêter la session';
  document.getElementById('statusDot').classList.add('active');
  document.getElementById('nextPingInfo').style.display = 'block';
  schedulePing();
}

function stopSession() {
  state.running = false;
  clearTimeout(state.pingTimer); clearInterval(state.countdownTimer);
  state.nextPingAt = null;
  document.getElementById('mainBtn').className = 'btn-main btn-start';
  document.getElementById('mainBtn').textContent = 'Commencer la session';
  document.getElementById('statusDot').classList.remove('active');
  document.getElementById('nextPingInfo').style.display = 'none';
}

function restartTimer() { clearTimeout(state.pingTimer); clearInterval(state.countdownTimer); schedulePing(); }

function schedulePing() {
  let ms = state.intervalMin * 60 * 1000;
  if (state.variance) ms = Math.round(ms * (0.5 + Math.random()));
  state.nextPingAt = Date.now() + ms;
  state.pingTimer = setTimeout(triggerPing, ms);
  startCountdown();
}

function startCountdown() {
  clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(() => {
    if (!state.nextPingAt) return;
    const rem = state.nextPingAt - Date.now();
    if (rem <= 0) { clearInterval(state.countdownTimer); return; }
    const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
    document.getElementById('nextPingCountdown').textContent = (m > 0 ? m + ' min ' : '') + s + ' s';
  }, 1000);
}

// ── PING ──────────────────────────────────────────────────────────────────

function triggerPing() {
  saveEntries();
  state.currentPingTime = new Date();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notif = new Notification('🔔 Présence — Moment de conscience', { body: "Qu'est-ce qui occupait ton esprit à cet instant ?", requireInteraction: false });
      notif.onclick = () => { window.focus(); notif.close(); document.getElementById('ping-overlay').classList.add('show'); };
      setTimeout(() => { try { notif.close(); } catch {} }, 8000);
    }
  } catch {}
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {}
  try { flashScreen(); } catch {}
  try { blinkTitle(); } catch {}
  try { playPingSound(); } catch {}
  document.getElementById('ping-overlay').classList.add('show');
  updateJournal();
}

function flashScreen() {
  const el = document.getElementById('flash-overlay');
  el.classList.remove('flashing'); void el.offsetWidth; el.classList.add('flashing');
  el.addEventListener('animationend', () => el.classList.remove('flashing'), { once: true });
}

let _blinkInterval = null;
function blinkTitle() {
  clearInterval(_blinkInterval);
  let on = true; document.title = '🔔 PING !';
  _blinkInterval = setInterval(() => { document.title = on ? 'Présence' : '🔔 PING !'; on = !on; }, 800);
  document.getElementById('ping-overlay').addEventListener('click', () => { clearInterval(_blinkInterval); document.title = 'Présence'; }, { once: true });
}

function playPingSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
}

function respondToPing() { document.getElementById('ping-overlay').classList.remove('show'); openCapture(); }

function dismissPing() {
  document.getElementById('ping-overlay').classList.remove('show');
  state.entries.unshift({ time: state.currentPingTime.toISOString(), tags: [], text: '', skipped: true });
  saveEntries(); updateJournal();
  if (state.running) schedulePing();
}

// ── CAPTURE ───────────────────────────────────────────────────────────────

function toggleDetails() {
  const section = document.getElementById('detailsSection');
  const label   = document.getElementById('detailsToggleLabel');
  const open    = section.style.display === 'none';
  section.style.display = open ? 'block' : 'none';
  label.textContent = open ? '− Masquer les détails' : '+ Ajouter des détails';
}

function openCapture() {
  state.selectedTags  = [];
  state.selectedMoods = [];

  // Reset details section
  document.getElementById('detailsSection').style.display = 'none';
  document.getElementById('detailsToggleLabel').textContent = '+ Ajouter des détails';
  document.getElementById('freeText').value    = '';
  document.getElementById('lieuInput').value   = '';
  document.getElementById('personneInput').value = '';

  // Thought tags
  const tagsGrid = document.getElementById('tagsGrid');
  tagsGrid.innerHTML = '';
  thoughtList.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.textContent = item.emoji + ' ' + item.name;
    el.onclick = () => {
      el.classList.toggle('selected');
      if (el.classList.contains('selected')) state.selectedTags.push(item.name);
      else state.selectedTags = state.selectedTags.filter(x => x !== item.name);
    };
    tagsGrid.appendChild(el);
  });

  // Mood tags
  const moodGrid = document.getElementById('moodGrid');
  moodGrid.innerHTML = '';
  const panel = document.getElementById('mood-intensity-panel');
  if (panel) panel.innerHTML = '';

  moodList.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.textContent = item.emoji + ' ' + item.name;
    el.onclick = () => {
      const idx = state.selectedMoods.findIndex(m => m.name === item.name);
      if (idx >= 0) {
        state.selectedMoods.splice(idx, 1);
        el.classList.remove('selected');
      } else {
        state.selectedMoods.push({ emoji: item.emoji, name: item.name, intensity: null });
        el.classList.add('selected');
      }
      renderMoodIntensityPanel();
    };
    moodGrid.appendChild(el);
  });

  const t = state.currentPingTime;
  document.getElementById('captureTime').textContent =
    String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0') + ' · ' +
    String(t.getDate()).padStart(2,'0') + '/' + String(t.getMonth()+1).padStart(2,'0');

  showView('capture');
}

function renderMoodIntensityPanel() {
  const panel = document.getElementById('mood-intensity-panel');
  if (!panel) return;
  if (state.selectedMoods.length === 0) { panel.innerHTML = ''; return; }
  panel.innerHTML = state.selectedMoods.map(m => `
    <div class="mood-int-row" id="mint-${m.name.replace(/\s/g,'_')}">
      <div class="mood-int-label">${m.emoji} ${m.name}</div>
      <div class="mood-int-btns">
        ${[1,2,3,4,5].map(i =>
          `<button class="intensity-btn${m.intensity === i ? ' selected' : ''}" onclick="setMoodIntensity('${m.name.replace(/'/g,"\\'")}',${i})">${i}</button>`
        ).join('')}
      </div>
    </div>`).join('');
}

function setMoodIntensity(moodName, i) {
  const m = state.selectedMoods.find(m => m.name === moodName);
  if (!m) return;
  m.intensity = m.intensity === i ? null : i;
  const row = document.getElementById('mint-' + moodName.replace(/\s/g,'_'));
  if (row) row.querySelectorAll('.intensity-btn').forEach((btn, idx) => {
    btn.classList.toggle('selected', m.intensity === idx + 1);
  });
}

function saveEntry() {
  const text     = document.getElementById('freeText').value.trim();
  const lieu     = document.getElementById('lieuInput').value.trim();
  const personne = document.getElementById('personneInput').value.trim();

  if (!state.selectedTags.length && !text && !state.selectedMoods.length) { skipEntry(); return; }

  const entry = {
    time: state.currentPingTime.toISOString(),
    tags: [...state.selectedTags],
    moods: state.selectedMoods.map(m => ({ ...m })),
    lieu: lieu || null,
    personne: personne || null,
    text,
    skipped: false,
  };

  state.entries.unshift(entry);
  saveEntries();
  updateJournal();
  updateHomeMeta();
  showView('home');
  if (state.running) schedulePing();
}

function skipEntry() {
  state.entries.unshift({ time: (state.currentPingTime || new Date()).toISOString(), tags: [], text: '', skipped: true });
  saveEntries(); updateJournal();
  showView('home');
  if (state.running) schedulePing();
}

// ── JOURNAL ───────────────────────────────────────────────────────────────

function getFilteredEntries() {
  const now = new Date();
  return state.entries.map((e, i) => ({ ...e, _idx: i })).filter(e => {
    const d = new Date(e.time);
    if (state.filter === 'day')   return d.toDateString() === now.toDateString();
    if (state.filter === 'week')  { const w = new Date(now); w.setDate(now.getDate()-6); w.setHours(0,0,0,0); return d >= w; }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function setFilter(f) {
  state.filter = f;
  document.querySelectorAll('#view-journal .filter-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + f).classList.add('active');
  document.getElementById('journalTitle').textContent = { day: "Aujourd'hui", week: '7 derniers jours', month: 'Ce mois-ci' }[f];
  updateJournal();
}

function entryDensity(e) {
  if (e.skipped) return 'skipped';
  const hasTags  = e.tags && e.tags.length;
  const hasMoods = e.moods && e.moods.length;
  const hasText  = !!e.text;
  const hasCtx   = !!(e.lieu || e.personne);
  if (!hasTags && !hasMoods && !hasText && !hasCtx) return 'empty';
  if ((hasTags || hasMoods) && !hasText && !hasCtx) return 'light';
  return 'rich';
}

function updateJournal() {
  const list     = document.getElementById('entriesList');
  const filtered = getFilteredEntries();
  const total    = filtered.length;
  const answered = filtered.filter(e => !e.skipped).length;

  document.getElementById('statTotal').textContent    = total;
  document.getElementById('statAnswered').textContent = answered;
  document.getElementById('statRate').textContent     = total > 0 ? Math.round(answered/total*100)+'%' : '—';
  document.getElementById('journalCount').textContent = total + ' entrée' + (total !== 1 ? 's' : '');

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-journal">Aucune entrée ${{ day:"aujourd'hui", week:'cette semaine', month:'ce mois-ci' }[state.filter]}.<br><em>Démarre une session pour commencer.</em></div>`;
    return;
  }

  const showDate = state.filter !== 'day';
  let html = '', lastDate = '';

  filtered.forEach(e => {
    const d       = new Date(e.time);
    const dateStr = d.toDateString();
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    const density = entryDensity(e);

    if (showDate && dateStr !== lastDate) {
      lastDate = dateStr;
      const dNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
      const mNames = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
      html += `<div class="date-separator">${dNames[d.getDay()]} ${d.getDate()} ${mNames[d.getMonth()]}</div>`;
    }

    const actions = `<div class="entry-actions">
      ${!e.skipped ? `<button class="entry-action-btn edit" onclick="openEdit(${e._idx})">Éditer</button>` : ''}
      <button class="entry-action-btn del" onclick="deleteEntry(${e._idx})">Suppr.</button>
    </div>`;

    if (density === 'skipped') {
      html += `<div class="entry entry-skipped-row">${actions}<div class="entry-time entry-time-muted">${timeStr}</div><div class="entry-skipped">— ignoré</div></div>`;
      return;
    }

    const moodsArr = (e.moods && e.moods.length) ? e.moods : (e.mood ? [{ ...e.mood, intensity: e.intensity }] : []);
    const moodHtml = moodsArr.length
      ? `<div class="entry-moods">${moodsArr.map(m =>
          `<span class="entry-mood-badge">${m.emoji} ${m.name}${m.intensity ? `<span class="entry-mood-int"> ×${m.intensity}</span>` : ''}</span>`
        ).join('')}</div>` : '';
    const ctxHtml = [e.lieu, e.personne].filter(Boolean)
      .map(v => `<span class="entry-ctx">→ ${v}</span>`).join('');

    html += `<div class="entry entry-${density}">${actions}
      <div class="entry-time">${timeStr}</div>
      ${e.tags && e.tags.length ? `<div class="entry-tags">${e.tags.map(t=>`<div class="entry-tag">${t}</div>`).join('')}</div>` : ''}
      ${moodHtml}
      ${ctxHtml ? `<div class="entry-ctx-row">${ctxHtml}</div>` : ''}
      ${e.text ? `<div class="entry-text">${e.text}</div>` : ''}
    </div>`;
  });

  list.innerHTML = html;
}

// ── EDIT / DELETE ─────────────────────────────────────────────────────────

let _editIdx = null, _editSelectedTags = [];

function openEdit(idx) {
  _editIdx = idx;
  const e = state.entries[idx];
  _editSelectedTags = [...(e.tags || [])];
  const grid = document.getElementById('editTagsGrid');
  grid.innerHTML = '';
  thoughtList.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tag' + (_editSelectedTags.includes(item.name) ? ' selected' : '');
    el.textContent = item.emoji + ' ' + item.name;
    el.onclick = () => {
      el.classList.toggle('selected');
      if (el.classList.contains('selected')) _editSelectedTags.push(item.name);
      else _editSelectedTags = _editSelectedTags.filter(x => x !== item.name);
    };
    grid.appendChild(el);
  });
  document.getElementById('editText').value = e.text || '';
  document.getElementById('edit-modal').classList.add('show');
}

function closeEdit() { document.getElementById('edit-modal').classList.remove('show'); _editIdx = null; }

function saveEdit() {
  if (_editIdx === null) return;
  state.entries[_editIdx] = { ...state.entries[_editIdx], tags: [..._editSelectedTags], text: document.getElementById('editText').value.trim(), skipped: false };
  saveEntries(); updateJournal(); closeEdit();
}

function deleteEntry(idx) {
  showConfirm('Supprimer cette entrée ?', () => { state.entries.splice(idx, 1); saveEntries(); updateJournal(); });
}

// ── SETTINGS ─────────────────────────────────────────────────────────────

function renderSettings() { renderThoughtList(); renderMoodList(); }

function renderThoughtList() {
  const el = document.getElementById('thought-list');
  if (!el) return;
  el.innerHTML = thoughtList.map((item, i) => `
    <div class="settings-item">
      <span class="settings-item-emoji">${item.emoji}</span>
      <span class="settings-item-name">${item.name}</span>
      <div class="settings-item-actions">
        <button class="settings-item-btn edit" onclick="openEditItem('thought',${i})">Éditer</button>
        <button class="settings-item-btn del" onclick="deleteItem('thought',${i})">Suppr.</button>
      </div>
    </div>`).join('');
}

function renderMoodList() {
  const el = document.getElementById('mood-list');
  if (!el) return;
  el.innerHTML = moodList.map((item, i) => `
    <div class="settings-item">
      <span class="settings-item-emoji">${item.emoji}</span>
      <span class="settings-item-name">${item.name}</span>
      <div class="settings-item-actions">
        <button class="settings-item-btn edit" onclick="openEditItem('mood',${i})">Éditer</button>
        <button class="settings-item-btn del" onclick="deleteItem('mood',${i})">Suppr.</button>
      </div>
    </div>`).join('');
}

function deleteItem(listType, idx) {
  showConfirm('Supprimer cet élément ?', () => {
    if (listType === 'thought') thoughtList.splice(idx, 1); else moodList.splice(idx, 1);
    saveLists(); renderSettings();
  });
}

// ── ITEM MODAL ────────────────────────────────────────────────────────────

let _modalMode = null, _modalIdx = null, _modalEmoji = '';

function openAddItem(listType) {
  _modalMode = listType; _modalIdx = null; _modalEmoji = '';
  document.getElementById('item-modal-title').textContent = 'Ajouter — ' + (listType === 'thought' ? 'Catégorie de pensée' : 'Mood');
  document.getElementById('item-name-input').value = '';
  document.getElementById('custom-emoji-input').value = '';
  document.getElementById('selected-emoji-preview').textContent = '—';
  buildEmojiPicker('');
  document.getElementById('item-modal').classList.add('show');
}

function openEditItem(listType, idx) {
  _modalMode = listType; _modalIdx = idx;
  const item = listType === 'thought' ? thoughtList[idx] : moodList[idx];
  _modalEmoji = item.emoji;
  document.getElementById('item-modal-title').textContent = 'Modifier';
  document.getElementById('item-name-input').value = item.name;
  document.getElementById('custom-emoji-input').value = '';
  document.getElementById('selected-emoji-preview').textContent = item.emoji;
  buildEmojiPicker(item.emoji);
  document.getElementById('item-modal').classList.add('show');
}

function buildEmojiPicker(selected) {
  const picker   = document.getElementById('emoji-picker');
  const sections = _modalMode === 'mood' ? [
    { label: 'Positif',       emojis: EMOJI_MOODS.slice(0,10) },
    { label: 'Négatif actif', emojis: EMOJI_MOODS.slice(10,20) },
    { label: 'Négatif doux',  emojis: EMOJI_MOODS.slice(20,30) },
    { label: 'Neutre / autre',emojis: EMOJI_MOODS.slice(30,50) },
  ] : [
    { label: 'Travail',      emojis: EMOJI_THOUGHTS.slice(0,10) },
    { label: 'Relations',    emojis: EMOJI_THOUGHTS.slice(10,20) },
    { label: 'Temps',        emojis: EMOJI_THOUGHTS.slice(20,30) },
    { label: 'Corps',        emojis: EMOJI_THOUGHTS.slice(30,40) },
    { label: 'Lieu',         emojis: EMOJI_THOUGHTS.slice(40,50) },
    { label: 'Loisirs',      emojis: EMOJI_THOUGHTS.slice(50,60) },
    { label: 'Divers',       emojis: EMOJI_THOUGHTS.slice(60,70) },
  ];
  picker.innerHTML = sections.map(s => `
    <div class="emoji-section-label">${s.label}</div>
    <div class="emoji-section-grid">
      ${s.emojis.map(e => `<div class="emoji-option${e===selected?' selected':''}" data-emoji="${e}" onclick="pickEmoji('${e}')">${e}</div>`).join('')}
    </div>`).join('');
}

function pickEmoji(e) {
  _modalEmoji = e;
  document.getElementById('selected-emoji-preview').textContent = e;
  document.getElementById('custom-emoji-input').value = '';
  document.querySelectorAll('.emoji-option').forEach(el => el.classList.toggle('selected', el.dataset.emoji === e));
}

function closeItemModal() { document.getElementById('item-modal').classList.remove('show'); _modalMode = _modalIdx = null; _modalEmoji = ''; }

function saveItem() {
  const custom = document.getElementById('custom-emoji-input').value.trim();
  if (custom) _modalEmoji = custom;
  const name = document.getElementById('item-name-input').value.trim();
  if (!name) { document.getElementById('item-name-input').focus(); return; }
  if (!_modalEmoji) { alert('Choisis un emoji !'); return; }
  const list = _modalMode === 'thought' ? thoughtList : moodList;
  if (_modalIdx === null) list.push({ emoji: _modalEmoji, name }); else list[_modalIdx] = { emoji: _modalEmoji, name };
  saveLists(); renderSettings(); closeItemModal();
}

document.addEventListener('input', e => {
  if (e.target.id === 'custom-emoji-input') {
    const v = e.target.value.trim();
    if (v) { _modalEmoji = v; document.getElementById('selected-emoji-preview').textContent = v; document.querySelectorAll('.emoji-option').forEach(el => el.classList.remove('selected')); }
  }
});

// ── ANALYSE ───────────────────────────────────────────────────────────────

function setAnalyseFilter(f) {
  state.analyseFilter = f;
  document.querySelectorAll('#view-analyse .filter-tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById('atab-' + f);
  if (tab) tab.classList.add('active');
  renderAnalyse();
}

function getAnalyseEntries() {
  const now = new Date();
  return state.entries.filter(e => {
    if (e.skipped) return false;
    const d = new Date(e.time);
    if (state.analyseFilter === 'day')  return d.toDateString() === now.toDateString();
    if (state.analyseFilter === 'week') { const w = new Date(now); w.setDate(now.getDate()-6); w.setHours(0,0,0,0); return d >= w; }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function renderAnalyse() {
  const el = document.getElementById('analyse-content');
  if (!el) return;
  const entries = getAnalyseEntries();

  if (!entries.length) {
    el.innerHTML = `<div class="analyse-empty">Pas encore de données.<br><em>Continue à répondre aux pings.</em></div>`;
    return;
  }

  const total = entries.length;
  const allSkipped = state.entries.filter(e => {
    if (!e.skipped) return false;
    const d = new Date(e.time), now = new Date();
    if (state.analyseFilter === 'day')  return d.toDateString() === now.toDateString();
    if (state.analyseFilter === 'week') { const w = new Date(now); w.setDate(now.getDate()-6); w.setHours(0,0,0,0); return d >= w; }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const responseRate = (total + allSkipped) > 0 ? Math.round(total/(total+allSkipped)*100)+'%' : '—';
  const streak = computeStreak();

  const withMood = entries.filter(e => e.moods && e.moods.length).length;
  const allIntensities = entries.flatMap(e => {
    const ms = (e.moods && e.moods.length) ? e.moods : (e.mood ? [{ ...e.mood, intensity: e.intensity }] : []);
    return ms.filter(m => m.intensity).map(m => m.intensity);
  });
  const avgInt = allIntensities.length ? (allIntensities.reduce((s,i)=>s+i,0)/allIntensities.length).toFixed(1) : '—';

  // Tag counts
  const tagCounts = {};
  entries.forEach(e => (e.tags||[]).forEach(t => { tagCounts[t] = (tagCounts[t]||0)+1; }));
  const sortedTags = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);

  // Mood counts with avg intensity
  const moodData = {};
  entries.forEach(e => {
    const ms = (e.moods && e.moods.length) ? e.moods : (e.mood ? [{ ...e.mood, intensity: e.intensity }] : []);
    ms.forEach(m => {
      const k = m.emoji + ' ' + m.name;
      if (!moodData[k]) moodData[k] = { count:0, totalInt:0, countInt:0 };
      moodData[k].count++;
      if (m.intensity) { moodData[k].totalInt += m.intensity; moodData[k].countInt++; }
    });
  });
  const sortedMoods = Object.entries(moodData).sort((a,b)=>b[1].count-a[1].count).slice(0,10);

  // Hour distribution
  const hourCounts = new Array(24).fill(0);
  entries.forEach(e => hourCounts[new Date(e.time).getHours()]++);
  const maxH = Math.max(...hourCounts, 1);

  // Lieux / personnes
  const lieuC = {}, personneC = {};
  entries.filter(e=>e.lieu).forEach(e    => { lieuC[e.lieu]         = (lieuC[e.lieu]||0)+1; });
  entries.filter(e=>e.personne).forEach(e => { personneC[e.personne] = (personneC[e.personne]||0)+1; });
  const sortedLieux    = Object.entries(lieuC).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const sortedPersonnes = Object.entries(personneC).sort((a,b)=>b[1]-a[1]).slice(0,6);

  function barRow(label, count, max, showPct) {
    return `<div class="ar-row">
      <span class="ar-label">${label}</span>
      <div class="ar-track"><div class="ar-fill" style="width:${Math.round(count/max*100)}%"></div></div>
      <span class="ar-val">${showPct ? Math.round(count/total*100)+'%' : count}</span>
    </div>`;
  }

  const cacheKey = state.analyseFilter;

  el.innerHTML = `
    <div class="ar-stats">
      <div class="ar-stat"><div class="ar-stat-num">${total}</div><div class="ar-stat-lbl">Pings</div></div>
      <div class="ar-stat"><div class="ar-stat-num">${responseRate}</div><div class="ar-stat-lbl">Taux</div></div>
      <div class="ar-stat"><div class="ar-stat-num">${streak > 0 ? streak+'🔥' : '—'}</div><div class="ar-stat-lbl">Streak</div></div>
      <div class="ar-stat"><div class="ar-stat-num">${avgInt}</div><div class="ar-stat-lbl">Intensité</div></div>
    </div>

    <div class="ar-section ar-narrative-section">
      <div class="ar-title">RÉSUMÉ</div>
      <div id="narrative-content">
        ${narrativeCache[cacheKey]
          ? `<div class="narrative-text">${narrativeCache[cacheKey]}</div>`
          : `<button class="narrative-btn" onclick="generateNarrative()">✦ Générer le résumé IA</button>`}
      </div>
    </div>

    ${sortedTags.length ? `<div class="ar-section">
      <div class="ar-title">CATÉGORIES DE PENSÉE</div>
      ${sortedTags.map(([t,c]) => barRow(t, c, sortedTags[0][1], true)).join('')}
    </div>` : ''}

    ${sortedMoods.length ? `<div class="ar-section">
      <div class="ar-title">MOODS</div>
      ${sortedMoods.map(([m,d]) => {
        const avgI = d.countInt > 0 ? (d.totalInt/d.countInt).toFixed(1) : null;
        return `<div class="ar-row">
          <span class="ar-label">${m}</span>
          <div class="ar-track"><div class="ar-fill" style="width:${Math.round(d.count/sortedMoods[0][1].count*100)}%"></div></div>
          <span class="ar-val">${Math.round(d.count/total*100)}%</span>
          ${avgI ? `<span class="ar-intensity">×${avgI}</span>` : '<span class="ar-intensity"></span>'}
        </div>`;
      }).join('')}
    </div>` : ''}

    <div class="ar-section">
      <div class="ar-title">DISTRIBUTION HORAIRE</div>
      <div class="ah-chart">
        ${hourCounts.map((c,h) => `
          <div class="ah-col">
            <div class="ah-bar" style="height:${Math.round(c/maxH*100)}%"></div>
            <span class="ah-lbl">${h%6===0?h+'h':''}</span>
          </div>`).join('')}
      </div>
    </div>

    ${sortedLieux.length ? `<div class="ar-section">
      <div class="ar-title">LIEUX</div>
      ${sortedLieux.map(([l,c]) => barRow(l, c, sortedLieux[0][1], false)).join('')}
    </div>` : ''}

    ${sortedPersonnes.length ? `<div class="ar-section">
      <div class="ar-title">PERSONNES & CONTEXTE</div>
      ${sortedPersonnes.map(([p,c]) => barRow(p, c, sortedPersonnes[0][1], false)).join('')}
    </div>` : ''}
  `;
}

async function generateNarrative() {
  const btn = document.querySelector('.narrative-btn');
  if (btn) { btn.textContent = '...'; btn.disabled = true; }

  const entries = getAnalyseEntries();
  const label   = { day: "aujourd'hui", week: "cette semaine", month: "ce mois-ci" }[state.analyseFilter];

  const summary = entries.slice(0, 30).map(e => {
    const moodsStr = (e.moods||[]).map(m => m.emoji+' '+m.name+(m.intensity?' x'+m.intensity:'')).join(', ');
    const tagsStr  = (e.tags||[]).join(', ');
    return [new Date(e.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), tagsStr, moodsStr, e.text].filter(Boolean).join(' · ');
  }).join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        system: `Tu es un miroir sobre et honnête. Tu analyses les pings d'un journal de présence et tu rédiges un résumé de 3-4 phrases, direct, sans flatterie ni morale. Tu observes ce qui domine, les patterns, les contrastes. Tu écris à la 2e personne du singulier, en français. Jamais de liste à puces.`,
        messages: [{ role: 'user', content: `Pings ${label} :\n\n${summary}\n\nFais un résumé.` }]
      })
    });
    const data = await res.json();
    const text = data.content?.find(b => b.type==='text')?.text || 'Impossible de générer le résumé.';
    narrativeCache[state.analyseFilter] = text;

    const nc = document.getElementById('narrative-content');
    if (nc) nc.innerHTML = `<div class="narrative-text">${text}</div><button class="narrative-regen" onclick="regenerateNarrative()">↺ Regénérer</button>`;
  } catch {
    const nc = document.getElementById('narrative-content');
    if (nc) nc.innerHTML = `<button class="narrative-btn" onclick="generateNarrative()">✦ Générer le résumé IA</button>`;
  }
}

function regenerateNarrative() {
  delete narrativeCache[state.analyseFilter];
  const nc = document.getElementById('narrative-content');
  if (nc) nc.innerHTML = `<button class="narrative-btn" onclick="generateNarrative()">✦ Générer le résumé IA</button>`;
  generateNarrative();
}

// ── EXPORT ────────────────────────────────────────────────────────────────

function exportData() {
  try {
    const lines = ['Heure,Tags,Moods,Lieu,Personne,Note,Ignoré'];
    state.entries.forEach(e => {
      const d    = new Date(e.time);
      const time = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      const ms   = (e.moods&&e.moods.length) ? e.moods : (e.mood?[{...e.mood,intensity:e.intensity}]:[]);
      const mood = ms.map(m=>m.emoji+' '+m.name+(m.intensity?' x'+m.intensity:'')).join('; ');
      lines.push(`"${time}","${(e.tags||[]).join('; ')}","${mood}","${e.lieu||''}","${e.personne||''}","${(e.text||'').replace(/"/g,'""')}","${e.skipped?'oui':'non'}"`);
    });
    const csv  = lines.join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'presence_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch(err) {
    try { const w=window.open(); if(w) w.document.write('<pre>'+err+'</pre>'); } catch {}
  }
}

// ── NAVIGATION ────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBar = document.getElementById('mainNav');

  if (name === 'capture') {
    document.getElementById('view-capture').classList.add('active');
    navBar.style.display = 'none';
  } else if (name === 'settings') {
    navBar.style.display = 'none';
    document.getElementById('view-settings').classList.add('active');
    renderSettings();
  } else {
    navBar.style.display = 'flex';
    document.getElementById('view-' + name).classList.add('active');
    const btn = document.getElementById('nav-' + name);
    if (btn) btn.classList.add('active');
    if (name === 'analyse') renderAnalyse();
  }
}

// ── CONFIRM ───────────────────────────────────────────────────────────────

function showConfirm(message, onOk) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:700;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  ov.innerHTML = `<div style="background:#111;border:1px solid #333;border-radius:2px;padding:28px 24px;margin:24px;max-width:320px;width:100%;text-align:center">
    <div style="font-size:16px;color:#e8e4dc;margin-bottom:24px;line-height:1.5">${message}</div>
    <div style="display:flex;gap:10px">
      <button id="cNo" style="flex:1;padding:12px;background:transparent;border:1px solid #333;color:#666;font-family:'DM Sans',sans-serif;font-size:15px;cursor:pointer;border-radius:2px">Annuler</button>
      <button id="cYes" style="flex:1;padding:12px;background:#5a2020;border:1px solid #8b3a3a;color:#e8e4dc;font-family:'DM Sans',sans-serif;font-size:15px;cursor:pointer;border-radius:2px">Supprimer</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#cNo').onclick  = () => document.body.removeChild(ov);
  ov.querySelector('#cYes').onclick = () => { document.body.removeChild(ov); onOk(); };
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────

function checkNotifPermission() {
  const c = document.getElementById('notifBannerContainer');
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { c.innerHTML = ''; return; }
  if (Notification.permission === 'denied')  { c.innerHTML = `<div class="notif-banner"><span>🔕</span> Notifications bloquées.</div>`; return; }
  c.innerHTML = `<div class="notif-banner" onclick="requestNotif()"><span>🔔</span> Autoriser les notifications</div>`;
}
function requestNotif() { Notification.requestPermission().then(checkNotifPermission); }

// ── THEME ─────────────────────────────────────────────────────────────────

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  document.getElementById('themeIcon').textContent = isLight ? '☾' : '☀';
  try { store.set(key('theme'), isLight ? 'light' : 'dark'); } catch {}
}

function loadTheme() {
  const saved = store.get(key('theme'));
  if (saved === 'light') { document.documentElement.classList.add('light'); document.getElementById('themeIcon').textContent = '☾'; }
  else { document.documentElement.classList.remove('light'); document.getElementById('themeIcon').textContent = '☀'; }
}

// ── ONBOARDING ────────────────────────────────────────────────────────────

function checkUser() {
  const saved = store.get('presence_current_user');
  if (saved) { currentUser = saved; startApp(); }
  else { document.getElementById('view-onboarding').style.display = 'flex'; setTimeout(() => document.getElementById('nameInput').focus(), 100); }
}

function confirmName() {
  const input = document.getElementById('nameInput').value.trim();
  if (!input) return;
  currentUser = input.toLowerCase().replace(/\s+/g,'_');
  store.set('presence_current_user', currentUser);
  document.getElementById('view-onboarding').style.display = 'none';
  startApp();
}

function switchUser() {
  showConfirm("Changer d'utilisateur ?", () => {
    stopSession();
    store.set('presence_current_user','');
    currentUser = null; state.entries = [];
    document.getElementById('headerName').textContent = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('view-onboarding').style.display = 'flex';
    setTimeout(() => document.getElementById('nameInput').focus(), 100);
  });
}

function startApp() {
  const display = currentUser.replace(/_/g,' ');
  document.getElementById('headerName').textContent = display.charAt(0).toUpperCase() + display.slice(1) + ' ↩';
  loadState(); loadTheme();
  document.getElementById('intervalDisplay').textContent = state.intervalMin;
  document.getElementById('varianceToggle').classList.toggle('on', state.variance);
  updateJournal();
  updateHomeMeta();
  checkNotifPermission();
}

// ── INIT ──────────────────────────────────────────────────────────────────
checkUser();
