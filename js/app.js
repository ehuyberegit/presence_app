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

// Emoji palettes — distinct sets per context
const EMOJI_MOODS = [
  // Visages & émotions
  '😌','😊','🙂','😀','😁','🤩','😎','🥰','😇','🤗',
  '😑','😒','🙄','😤','😠','😡','🤬','😤','😾','💢',
  '😟','😧','😨','😰','😱','😭','😢','😔','😞','😿',
  '😴','🥱','😪','🤔','🤯','😵','🥴','😶','🫥','😐',
  '🥳','😏','😈','🤑','🤡','🫠','😬','🫤','😮','😲',
];

const EMOJI_THOUGHTS = [
  // Travail & productivité
  '💼','💻','📊','📋','📝','✉️','📞','🗂️','🖊️','🔧',
  // Relations & social
  '❤️','👥','💬','🤝','👨‍👩‍👧','💑','🫂','👯','🗣️','💌',
  // Temps & futur/passé
  '🔮','📦','⏰','🕰️','📅','⌛','🔄','🗓️','🌅','🌄',
  // Corps & santé
  '🫀','🏃','🧘','💪','🍽️','😴','🤒','🛁','🧠','👁️',
  // Lieu & déplacement
  '🏠','☕','✈️','🚗','🌍','🏙️','🌿','🏖️','🏔️','🚶',
  // Loisirs & créativité
  '✨','🎵','🎨','📚','🎮','🍕','🍺','🎬','⚽','🎯',
  // Nature & divers
  '☁️','🌊','🔥','⚡','🌙','☀️','🌱','💡','🎲','🔑',
];

const INTENSITY_LABELS = ['','À peine','Légère','Modérée','Forte','Très forte'];

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
  selectedMoods: [],      // [{ emoji, name }, ...]
  selectedIntensity: null,
  currentPingTime: null,
  filter: 'day',
  analyseFilter: 'day',
};

// Lists (editable)
let thoughtList = [];
let moodList = [];

// ── SAFE STORAGE ──────────────────────────────────────────────────────────

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
    if (conf) {
      const c = JSON.parse(conf);
      state.intervalMin = c.intervalMin || 20;
      state.variance = c.variance !== undefined ? c.variance : true;
    }
    const th = store.get(key('thoughts'));
    thoughtList = th ? JSON.parse(th) : [...DEFAULT_THOUGHTS];
    const mo = store.get(key('moods'));
    moodList = mo ? JSON.parse(mo) : [...DEFAULT_MOODS];
  } catch {}
}

function saveEntries() {
  try { store.set(key('entries'), JSON.stringify(state.entries)); } catch {}
}
function saveConfig() {
  try { store.set(key('config'), JSON.stringify({ intervalMin: state.intervalMin, variance: state.variance })); } catch {}
}
function saveLists() {
  try {
    store.set(key('thoughts'), JSON.stringify(thoughtList));
    store.set(key('moods'), JSON.stringify(moodList));
  } catch {}
}

// ── CLOCK ─────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('clock').textContent = h + ':' + m;
  const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
  document.getElementById('dateDisplay').textContent =
    days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()];
}
setInterval(updateClock, 10000);
updateClock();

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

function toggleSession() {
  if (state.running) stopSession(); else startSession();
}

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
  clearTimeout(state.pingTimer);
  clearInterval(state.countdownTimer);
  state.nextPingAt = null;
  document.getElementById('mainBtn').className = 'btn-main btn-start';
  document.getElementById('mainBtn').textContent = 'Commencer la session';
  document.getElementById('statusDot').classList.remove('active');
  document.getElementById('nextPingInfo').style.display = 'none';
}

function restartTimer() {
  clearTimeout(state.pingTimer);
  clearInterval(state.countdownTimer);
  schedulePing();
}

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
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    document.getElementById('nextPingCountdown').textContent =
      (m > 0 ? m + ' min ' : '') + s + ' s';
  }, 1000);
}

// ── PING ──────────────────────────────────────────────────────────────────

function triggerPing() {
  saveEntries();
  state.currentPingTime = new Date();

  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notif = new Notification('🔔 Présence — Moment de conscience', {
        body: "Qu'est-ce qui occupait ton esprit à cet instant ?",
        requireInteraction: false,
      });
      notif.onclick = () => {
        window.focus(); notif.close();
        if (!document.getElementById('ping-overlay').classList.contains('show'))
          document.getElementById('ping-overlay').classList.add('show');
      };
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
  el.classList.remove('flashing');
  void el.offsetWidth;
  el.classList.add('flashing');
  el.addEventListener('animationend', () => el.classList.remove('flashing'), { once: true });
}

let _blinkInterval = null;
function blinkTitle() {
  clearInterval(_blinkInterval);
  const orig = 'Présence';
  let on = true;
  document.title = '🔔 PING !';
  _blinkInterval = setInterval(() => { document.title = on ? orig : '🔔 PING !'; on = !on; }, 800);
  document.getElementById('ping-overlay').addEventListener('click',
    () => { clearInterval(_blinkInterval); document.title = orig; }, { once: true });
}

function playPingSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
}

function respondToPing() {
  document.getElementById('ping-overlay').classList.remove('show');
  openCapture();
}

function dismissPing() {
  document.getElementById('ping-overlay').classList.remove('show');
  state.entries.unshift({ time: state.currentPingTime.toISOString(), tags: [], text: '', skipped: true });
  saveEntries();
  updateJournal();
  if (state.running) schedulePing();
}

// ── CAPTURE ───────────────────────────────────────────────────────────────

function openCapture() {
  state.selectedTags = [];
  state.selectedMoods = [];
  state.selectedIntensity = null;

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
  const intensitySection = document.getElementById('intensity-section');
  intensitySection.style.display = 'none';

  moodList.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.textContent = item.emoji + ' ' + item.name;
    el.onclick = () => {
      const already = state.selectedMoods.findIndex(m => m.name === item.name);
      if (already >= 0) {
        // Toggle off
        state.selectedMoods.splice(already, 1);
        el.classList.remove('selected');
      } else {
        // Toggle on
        state.selectedMoods.push(item);
        el.classList.add('selected');
      }
      // Show/hide intensity based on whether any mood is selected
      if (state.selectedMoods.length > 0) {
        const label = state.selectedMoods.map(m => m.emoji + ' ' + m.name).join(', ');
        document.getElementById('intensity-label-text').textContent =
          'Intensité de ce moment — ' + label;
        intensitySection.style.display = 'block';
      } else {
        state.selectedIntensity = null;
        document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('selected'));
        intensitySection.style.display = 'none';
      }
    };
    moodGrid.appendChild(el);
  });

  // Intensity buttons
  document.querySelectorAll('.intensity-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      const i = parseInt(btn.dataset.i);
      state.selectedIntensity = state.selectedIntensity === i ? null : i;
      document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('selected'));
      if (state.selectedIntensity) btn.classList.add('selected');
    };
  });

  // Reset optional fields
  document.getElementById('freeText').value = '';
  document.getElementById('lieuInput').value = '';
  document.getElementById('personneInput').value = '';

  const t = state.currentPingTime;
  document.getElementById('captureTime').textContent =
    String(t.getHours()).padStart(2,'0') + ':' +
    String(t.getMinutes()).padStart(2,'0') + ' · ' +
    String(t.getDate()).padStart(2,'0') + '/' +
    String(t.getMonth()+1).padStart(2,'0');

  showView('capture');
}

function saveEntry() {
  const text = document.getElementById('freeText').value.trim();
  const lieu = document.getElementById('lieuInput').value.trim();
  const personne = document.getElementById('personneInput').value.trim();

  if (state.selectedTags.length === 0 && !text && state.selectedMoods.length === 0) { skipEntry(); return; }

  state.entries.unshift({
    time: state.currentPingTime.toISOString(),
    tags: [...state.selectedTags],
    moods: [...state.selectedMoods],
    intensity: state.selectedIntensity,
    lieu: lieu || null,
    personne: personne || null,
    text,
    skipped: false,
  });
  saveEntries();
  updateJournal();
  showView('home');
  if (state.running) schedulePing();
}

function skipEntry() {
  state.entries.unshift({
    time: state.currentPingTime || new Date(),
    tags: [], text: '', skipped: true,
  });
  saveEntries();
  updateJournal();
  showView('home');
  if (state.running) schedulePing();
}

// ── JOURNAL ───────────────────────────────────────────────────────────────

function getFilteredEntries() {
  const now = new Date();
  return state.entries.map((e, i) => ({ ...e, _idx: i })).filter(e => {
    const d = new Date(e.time);
    if (state.filter === 'day') return d.toDateString() === now.toDateString();
    if (state.filter === 'week') {
      const w = new Date(now); w.setDate(now.getDate() - 6); w.setHours(0,0,0,0);
      return d >= w;
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function setFilter(f) {
  state.filter = f;
  document.querySelectorAll('#view-journal .filter-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + f).classList.add('active');
  const labels = { day: "Aujourd'hui", week: '7 derniers jours', month: 'Ce mois-ci' };
  document.getElementById('journalTitle').textContent = labels[f];
  updateJournal();
}

function updateJournal() {
  const list = document.getElementById('entriesList');
  const filtered = getFilteredEntries();
  const total = filtered.length;
  const answered = filtered.filter(e => !e.skipped).length;
  const rate = total > 0 ? Math.round(answered / total * 100) + '%' : '—';

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAnswered').textContent = answered;
  document.getElementById('statRate').textContent = rate;
  document.getElementById('journalCount').textContent = total + ' entrée' + (total !== 1 ? 's' : '');

  if (!filtered.length) {
    const labels = { day: "aujourd'hui", week: 'cette semaine', month: 'ce mois-ci' };
    list.innerHTML = `<div class="empty-journal">Aucune entrée ${labels[state.filter]}.<br><em>Démarre une session pour commencer.</em></div>`;
    return;
  }

  const showDate = state.filter !== 'day';
  let html = '', lastDate = '';

  filtered.forEach(e => {
    const d = new Date(e.time);
    const dateStr = d.toDateString();
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

    if (showDate && dateStr !== lastDate) {
      lastDate = dateStr;
      const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
      const months = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
      html += `<div class="date-separator">${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}</div>`;
    }

    const actions = `<div class="entry-actions">
      ${!e.skipped ? `<button class="entry-action-btn edit" onclick="openEdit(${e._idx})">Éditer</button>` : ''}
      <button class="entry-action-btn del" onclick="deleteEntry(${e._idx})">Suppr.</button>
    </div>`;

    if (e.skipped) {
      html += `<div class="entry">${actions}<div class="entry-time">${timeStr}</div><div class="entry-skipped">— Ping ignoré</div></div>`;
    } else {
      const moodHtml = (e.moods && e.moods.length)
        ? `<span style="font-size:13px;font-family:'DM Mono',monospace;color:var(--accent)">${e.moods.map(m => m.emoji + ' ' + m.name).join('  ')}${e.intensity ? ' · ' + e.intensity + '/5' : ''}</span>`
        : (e.mood ? `<span style="font-size:13px;font-family:'DM Mono',monospace;color:var(--accent)">${e.mood.emoji} ${e.mood.name}${e.intensity ? ' · ' + e.intensity + '/5' : ''}</span>` : '');
      const ctxHtml = [e.lieu, e.personne].filter(Boolean)
        .map(v => `<span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted)">→ ${v}</span>`)
        .join(' ');
      html += `<div class="entry">${actions}
        <div class="entry-time">${timeStr}</div>
        ${e.tags && e.tags.length ? `<div class="entry-tags">${e.tags.map(t => `<div class="entry-tag">${t}</div>`).join('')}</div>` : ''}
        ${moodHtml ? `<div style="margin:4px 0">${moodHtml}</div>` : ''}
        ${ctxHtml ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">${ctxHtml}</div>` : ''}
        ${e.text ? `<div class="entry-text">${e.text}</div>` : ''}
      </div>`;
    }
  });

  list.innerHTML = html;
}

// ── EDIT / DELETE ─────────────────────────────────────────────────────────

let _editIdx = null;
let _editSelectedTags = [];

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

function closeEdit() {
  document.getElementById('edit-modal').classList.remove('show');
  _editIdx = null;
}

function saveEdit() {
  if (_editIdx === null) return;
  const text = document.getElementById('editText').value.trim();
  state.entries[_editIdx] = { ...state.entries[_editIdx], tags: [..._editSelectedTags], text, skipped: false };
  saveEntries();
  updateJournal();
  closeEdit();
}

function deleteEntry(idx) {
  showConfirm('Supprimer cette entrée ?', () => {
    state.entries.splice(idx, 1);
    saveEntries();
    updateJournal();
  });
}

// ── SETTINGS (list management) ────────────────────────────────────────────

function renderSettings() {
  renderThoughtList();
  renderMoodList();
}

function renderThoughtList() {
  const el = document.getElementById('thought-list');
  if (!el) return;
  el.innerHTML = thoughtList.map((item, i) => `
    <div class="settings-item">
      <span class="settings-item-emoji">${item.emoji}</span>
      <span class="settings-item-name">${item.name}</span>
      <div class="settings-item-actions">
        <button class="settings-item-btn edit" onclick="openEditItem('thought', ${i})">Éditer</button>
        <button class="settings-item-btn del" onclick="deleteItem('thought', ${i})">Suppr.</button>
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
        <button class="settings-item-btn edit" onclick="openEditItem('mood', ${i})">Éditer</button>
        <button class="settings-item-btn del" onclick="deleteItem('mood', ${i})">Suppr.</button>
      </div>
    </div>`).join('');
}

function deleteItem(listType, idx) {
  showConfirm('Supprimer cet élément ?', () => {
    if (listType === 'thought') thoughtList.splice(idx, 1);
    else moodList.splice(idx, 1);
    saveLists();
    renderSettings();
  });
}

// ── ITEM MODAL (add / edit) ───────────────────────────────────────────────

let _modalMode = null; // 'thought' | 'mood'
let _modalIdx = null;  // null = add, number = edit
let _modalEmoji = '';

function openAddItem(listType) {
  _modalMode = listType;
  _modalIdx = null;
  _modalEmoji = '';
  document.getElementById('item-modal-title').textContent =
    'Ajouter — ' + (listType === 'thought' ? 'Catégorie de pensée' : 'Mood');
  document.getElementById('item-name-input').value = '';
  document.getElementById('custom-emoji-input').value = '';
  document.getElementById('selected-emoji-preview').textContent = '—';
  buildEmojiPicker('');
  document.getElementById('item-modal').classList.add('show');
}

function openEditItem(listType, idx) {
  _modalMode = listType;
  _modalIdx = idx;
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
  const picker = document.getElementById('emoji-picker');
  const palette = _modalMode === 'mood' ? EMOJI_MOODS : EMOJI_THOUGHTS;

  // Build with category headings
  const sections = _modalMode === 'mood' ? [
    { label: 'Positif', emojis: EMOJI_MOODS.slice(0, 10) },
    { label: 'Négatif actif', emojis: EMOJI_MOODS.slice(10, 20) },
    { label: 'Négatif doux', emojis: EMOJI_MOODS.slice(20, 30) },
    { label: 'Neutre / autre', emojis: EMOJI_MOODS.slice(30, 50) },
  ] : [
    { label: 'Travail', emojis: EMOJI_THOUGHTS.slice(0, 10) },
    { label: 'Relations', emojis: EMOJI_THOUGHTS.slice(10, 20) },
    { label: 'Temps', emojis: EMOJI_THOUGHTS.slice(20, 30) },
    { label: 'Corps & santé', emojis: EMOJI_THOUGHTS.slice(30, 40) },
    { label: 'Lieu', emojis: EMOJI_THOUGHTS.slice(40, 50) },
    { label: 'Loisirs', emojis: EMOJI_THOUGHTS.slice(50, 60) },
    { label: 'Divers', emojis: EMOJI_THOUGHTS.slice(60, 70) },
  ];

  picker.innerHTML = sections.map(s => `
    <div class="emoji-section-label">${s.label}</div>
    <div class="emoji-section-grid">
      ${s.emojis.map(e =>
        `<div class="emoji-option${e === selected ? ' selected' : ''}" data-emoji="${e}" onclick="pickEmoji('${e}')">${e}</div>`
      ).join('')}
    </div>
  `).join('');
}

function pickEmoji(e) {
  _modalEmoji = e;
  document.getElementById('selected-emoji-preview').textContent = e;
  document.getElementById('custom-emoji-input').value = '';
  document.querySelectorAll('.emoji-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.emoji === e);
  });
}

function closeItemModal() {
  document.getElementById('item-modal').classList.remove('show');
  _modalMode = null; _modalIdx = null; _modalEmoji = '';
}

function saveItem() {
  // Check custom emoji input first
  const customEmoji = document.getElementById('custom-emoji-input').value.trim();
  if (customEmoji) _modalEmoji = customEmoji;

  const name = document.getElementById('item-name-input').value.trim();
  if (!name) { document.getElementById('item-name-input').focus(); return; }
  if (!_modalEmoji) { alert('Choisis un emoji !'); return; }

  const item = { emoji: _modalEmoji, name };
  const list = _modalMode === 'thought' ? thoughtList : moodList;

  if (_modalIdx === null) list.push(item);
  else list[_modalIdx] = item;

  saveLists();
  renderSettings();
  closeItemModal();
}

// Custom emoji input live preview
document.addEventListener('input', e => {
  if (e.target.id === 'custom-emoji-input') {
    const v = e.target.value.trim();
    if (v) {
      _modalEmoji = v;
      document.getElementById('selected-emoji-preview').textContent = v;
      document.querySelectorAll('.emoji-option').forEach(el => el.classList.remove('selected'));
    }
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
    if (state.analyseFilter === 'day') return d.toDateString() === now.toDateString();
    if (state.analyseFilter === 'week') {
      const w = new Date(now); w.setDate(now.getDate() - 6); w.setHours(0,0,0,0);
      return d >= w;
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function renderAnalyse() {
  const el = document.getElementById('analyse-content');
  if (!el) return;
  const entries = getAnalyseEntries();

  if (entries.length < 1) {
    el.innerHTML = `<div class="analyse-empty">Pas encore assez de données.<br><em>Continue à répondre aux pings.</em></div>`;
    return;
  }

  const total = entries.length;
  const skipped = state.entries.filter(e => {
    if (!e.skipped) return false;
    const d = new Date(e.time);
    if (state.analyseFilter === 'day') return d.toDateString() === new Date().toDateString();
    if (state.analyseFilter === 'week') {
      const w = new Date(); w.setDate(w.getDate()-6); w.setHours(0,0,0,0); return d >= w;
    }
    return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
  }).length;
  const responseRate = total + skipped > 0 ? Math.round(total / (total + skipped) * 100) + '%' : '—';

  const withMood = entries.filter(e => (e.moods && e.moods.length) || e.mood).length;
  const avgInt = entries.filter(e => e.intensity).length
    ? (entries.filter(e => e.intensity).reduce((s, e) => s + e.intensity, 0) / entries.filter(e => e.intensity).length).toFixed(1)
    : '—';

  // Tag counts
  const tagCounts = {};
  entries.forEach(e => (e.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Mood counts
  const moodCounts = {};
  entries.forEach(e => {
    const moods = e.moods && e.moods.length ? e.moods : (e.mood ? [e.mood] : []);
    moods.forEach(m => {
      const k = m.emoji + ' ' + m.name;
      moodCounts[k] = (moodCounts[k] || 0) + 1;
    });
  });
  const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Intensity distribution
  const intDist = [0,0,0,0,0];
  entries.filter(e => e.intensity).forEach(e => intDist[e.intensity - 1]++);
  const maxInt = Math.max(...intDist, 1);

  // Hour distribution
  const hourCounts = new Array(24).fill(0);
  entries.forEach(e => hourCounts[new Date(e.time).getHours()]++);
  const maxH = Math.max(...hourCounts, 1);

  // Lieux / personnes
  const lieuC = {}, personneC = {};
  entries.filter(e => e.lieu).forEach(e => { lieuC[e.lieu] = (lieuC[e.lieu] || 0) + 1; });
  entries.filter(e => e.personne).forEach(e => { personneC[e.personne] = (personneC[e.personne] || 0) + 1; });
  const sortedLieux = Object.entries(lieuC).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sortedPersonnes = Object.entries(personneC).sort((a, b) => b[1] - a[1]).slice(0, 6);

  function barRow(label, count, max, pct) {
    const w = Math.round(count / max * 100);
    const pctStr = pct ? Math.round(count / total * 100) + '%' : count;
    return `<div class="ar-row">
      <span class="ar-label">${label}</span>
      <div class="ar-track"><div class="ar-fill" style="width:${w}%"></div></div>
      <span class="ar-val">${pctStr}</span>
    </div>`;
  }

  // Hour chart bars
  const hourBar = (c, h) => {
    const pct = Math.round(c / maxH * 100);
    const showLabel = h % 6 === 0;
    return `<div class="ah-col">
      <div class="ah-bar" style="height:${pct}%"></div>
      <span class="ah-lbl">${showLabel ? h + 'h' : ''}</span>
    </div>`;
  };

  el.innerHTML = `
    <div class="ar-stats">
      <div class="ar-stat">
        <div class="ar-stat-num">${total}</div>
        <div class="ar-stat-lbl">Pings répondus</div>
      </div>
      <div class="ar-stat">
        <div class="ar-stat-num">${responseRate}</div>
        <div class="ar-stat-lbl">Taux de réponse</div>
      </div>
      <div class="ar-stat">
        <div class="ar-stat-num">${avgInt}</div>
        <div class="ar-stat-lbl">Intensité moy.</div>
      </div>
    </div>

    ${sortedTags.length ? `
    <div class="ar-section">
      <div class="ar-title">CATÉGORIES DE PENSÉE</div>
      ${sortedTags.map(([t, c]) => barRow(t, c, sortedTags[0][1], true)).join('')}
    </div>` : ''}

    ${sortedMoods.length ? `
    <div class="ar-section">
      <div class="ar-title">MOODS</div>
      ${sortedMoods.map(([m, c]) => barRow(m, c, sortedMoods[0][1], true)).join('')}
    </div>` : ''}

    ${withMood > 0 ? `
    <div class="ar-section">
      <div class="ar-title">DISTRIBUTION DE L'INTENSITÉ</div>
      <div class="ar-intensity-row">
        ${intDist.map((c, i) => `
          <div class="ar-int-col">
            <div class="ar-int-bar-wrap">
              <div class="ar-int-bar" style="height:${Math.round(c/maxInt*100)}%"></div>
            </div>
            <div class="ar-int-num">${c > 0 ? c : ''}</div>
            <div class="ar-int-lbl">${i+1}</div>
          </div>`).join('')}
        <div style="flex:1;padding-left:12px;font-family:'DM Mono',monospace;font-size:10px;color:var(--text-muted);line-height:2;align-self:center">
          1 — À peine<br>3 — Modérée<br>5 — Très forte
        </div>
      </div>
    </div>` : ''}

    <div class="ar-section">
      <div class="ar-title">DISTRIBUTION HORAIRE</div>
      <div class="ah-chart">
        ${hourCounts.map((c, h) => hourBar(c, h)).join('')}
      </div>
    </div>

    ${sortedLieux.length ? `
    <div class="ar-section">
      <div class="ar-title">LIEUX</div>
      ${sortedLieux.map(([l, c]) => barRow(l, c, sortedLieux[0][1], false)).join('')}
    </div>` : ''}

    ${sortedPersonnes.length ? `
    <div class="ar-section">
      <div class="ar-title">PERSONNES & CONTEXTE</div>
      ${sortedPersonnes.map(([p, c]) => barRow(p, c, sortedPersonnes[0][1], false)).join('')}
    </div>` : ''}
  `;
}

// ── EXPORT ────────────────────────────────────────────────────────────────

function exportData() {
  try {
    const lines = ['Heure,Tags,Mood,Intensité,Lieu,Personne,Note,Ignoré'];
    state.entries.forEach(e => {
      const d = new Date(e.time);
      const time = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      const moodsArr = e.moods && e.moods.length ? e.moods : (e.mood ? [e.mood] : []);
      const mood = moodsArr.map(m => m.emoji + ' ' + m.name).join('; ');
      lines.push(`"${time}","${(e.tags||[]).join('; ')}","${mood}","${e.intensity||''}","${e.lieu||''}","${e.personne||''}","${(e.text||'').replace(/"/g,'""')}","${e.skipped ? 'oui' : 'non'}"`);
    });
    const csv = lines.join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'presence_' + new Date().toISOString().slice(0,10) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {
      const w = window.open();
      if (w) w.document.write('<pre>' + csv + '</pre>');
    }
  } catch {}
}

// ── NAVIGATION ────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const navBar = document.getElementById('mainNav');

  if (name === 'capture') {
    document.getElementById('view-capture').classList.add('active');
    navBar.style.display = 'none';
  } else {
    navBar.style.display = 'flex';
    document.getElementById('view-' + name).classList.add('active');
    const navBtn = document.getElementById('nav-' + name);
    if (navBtn) navBtn.classList.add('active');
    if (name === 'analyse') renderAnalyse();
    if (name === 'settings') renderSettings();
  }
}

// ── CUSTOM CONFIRM ────────────────────────────────────────────────────────

function showConfirm(message, onOk) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:700;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:#111;border:1px solid #333;border-radius:2px;padding:28px 24px;margin:24px;max-width:320px;width:100%;text-align:center">
      <div style="font-size:16px;color:#e8e4dc;margin-bottom:24px;line-height:1.5">${message}</div>
      <div style="display:flex;gap:10px">
        <button id="confirmNo" style="flex:1;padding:12px;background:transparent;border:1px solid #333;color:#666;font-family:'DM Sans',sans-serif;font-size:15px;cursor:pointer;border-radius:2px">Annuler</button>
        <button id="confirmYes" style="flex:1;padding:12px;background:#5a2020;border:1px solid #8b3a3a;color:#e8e4dc;font-family:'DM Sans',sans-serif;font-size:15px;cursor:pointer;border-radius:2px">Supprimer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmNo').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#confirmYes').onclick = () => { document.body.removeChild(overlay); onOk(); };
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────

function checkNotifPermission() {
  const container = document.getElementById('notifBannerContainer');
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { container.innerHTML = ''; return; }
  if (Notification.permission === 'denied') {
    container.innerHTML = `<div class="notif-banner"><span>🔕</span> Notifications bloquées — active-les dans les réglages du navigateur.</div>`;
    return;
  }
  container.innerHTML = `<div class="notif-banner" onclick="requestNotif()"><span>🔔</span> Autoriser les notifications pour être pingé en arrière-plan</div>`;
}

function requestNotif() {
  Notification.requestPermission().then(() => checkNotifPermission());
}

// ── THEME ─────────────────────────────────────────────────────────────────

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  document.getElementById('themeIcon').textContent = isLight ? '☾' : '☀';
  try { store.set(key('theme'), isLight ? 'light' : 'dark'); } catch {}
}

function loadTheme() {
  const saved = store.get(key('theme'));
  if (saved === 'light') {
    document.documentElement.classList.add('light');
    document.getElementById('themeIcon').textContent = '☾';
  } else {
    document.documentElement.classList.remove('light');
    document.getElementById('themeIcon').textContent = '☀';
  }
}

// ── ONBOARDING / USER ─────────────────────────────────────────────────────

function checkUser() {
  const saved = store.get('presence_current_user');
  if (saved) { currentUser = saved; startApp(); }
  else {
    const ob = document.getElementById('view-onboarding');
    ob.style.display = 'flex';
    setTimeout(() => document.getElementById('nameInput').focus(), 100);
  }
}

function confirmName() {
  const input = document.getElementById('nameInput').value.trim();
  if (!input) return;
  currentUser = input.toLowerCase().replace(/\s+/g, '_');
  store.set('presence_current_user', currentUser);
  document.getElementById('view-onboarding').style.display = 'none';
  startApp();
}

function switchUser() {
  showConfirm("Changer d'utilisateur ? Ta session en cours sera arrêtée.", () => {
    stopSession();
    store.set('presence_current_user', '');
    currentUser = null;
    state.entries = [];
    document.getElementById('headerName').textContent = '';
    document.getElementById('nameInput').value = '';
    const ob = document.getElementById('view-onboarding');
    ob.style.display = 'flex';
    setTimeout(() => document.getElementById('nameInput').focus(), 100);
  });
}

function startApp() {
  const display = currentUser.replace(/_/g, ' ');
  document.getElementById('headerName').textContent =
    display.charAt(0).toUpperCase() + display.slice(1) + ' ↩';
  loadState();
  loadTheme();
  document.getElementById('intervalDisplay').textContent = state.intervalMin;
  document.getElementById('varianceToggle').classList.toggle('on', state.variance);
  updateJournal();
  checkNotifPermission();
}

// ── INIT ──────────────────────────────────────────────────────────────────
checkUser();
