// ── STATE ──
const TAGS = [
  'Travail', 'Relations', 'Futur', 'Passé',
  'Corps', 'Inquiétude', 'Rêverie', 'Vide',
  'Créativité', 'Ennui', 'Faim', 'Fatigue'
];

let state = {
  running: false,
  intervalMin: 20,
  variance: true,
  nextPingAt: null,
  pingTimer: null,
  countdownTimer: null,
  entries: [],
  selectedTags: [],
  currentPingTime: null,
  filter: 'day', // 'day' | 'week' | 'month'
};

// ── SAFE STORAGE (fallback si localStorage bloqué sur iOS file://) ──
const _memStore = {};
const store = {
  get(k) {
    try { return localStorage.getItem(k); } catch(e) { return _memStore[k] ?? null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch(e) { _memStore[k] = v; }
  }
};

function loadState() {
  try {
    const saved = store.get('presence_entries');
    if (saved) state.entries = JSON.parse(saved);
    const conf = store.get('presence_config');
    if (conf) {
      const c = JSON.parse(conf);
      state.intervalMin = c.intervalMin || 20;
      state.variance = c.variance !== undefined ? c.variance : true;
    }
  } catch(e) {}
}

function saveEntries() {
  try {
    store.set('presence_entries', JSON.stringify(state.entries));
  } catch(e) {}
}

function saveConfig() {
  try {
    store.set('presence_config', JSON.stringify({
      intervalMin: state.intervalMin,
      variance: state.variance
    }));
  } catch(e) {}
}

// ── CLOCK ──
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

// ── INTERVAL CONFIG ──
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

// ── SESSION ──
function toggleSession() {
  if (state.running) stopSession();
  else startSession();
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
  if (state.variance) {
    const factor = 0.5 + Math.random(); // 0.5x to 1.5x
    ms = Math.round(ms * factor);
  }
  state.nextPingAt = Date.now() + ms;
  state.pingTimer = setTimeout(triggerPing, ms);
  startCountdown();
}

function startCountdown() {
  clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(() => {
    if (!state.nextPingAt) return;
    const remaining = state.nextPingAt - Date.now();
    if (remaining <= 0) { clearInterval(state.countdownTimer); return; }
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    document.getElementById('nextPingCountdown').textContent =
      (m > 0 ? m + ' min ' : '') + s + ' s';
  }, 1000);
}

// ── PING ──
function triggerPing() {
  saveEntries();
  state.currentPingTime = new Date();

  // Try notification — desktop: works great. iOS: silently ignored.
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notif = new Notification('🔔 Présence — Moment de conscience', {
        body: "Qu'est-ce qui occupait ton esprit à cet instant ?",
        requireInteraction: false,
        silent: false,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
        // If overlay already closed (user was on page), re-open it
        if (!document.getElementById('ping-overlay').classList.contains('show')) {
          document.getElementById('ping-overlay').classList.add('show');
        }
      };
      setTimeout(() => { try { notif.close(); } catch(e){} }, 8000);
    }
  } catch(e) {}

  // Vibrate (Android + some browsers)
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e) {}

  // Visual flash
  try { flashScreen(); } catch(e) {}

  // Tab title blink (visible quand l'onglet est en arrière-plan)
  try { blinkTitle(); } catch(e) {}

  // Audio ping (works on iOS when tab is active)
  try { playPingSound(); } catch(e) {}

  // Show overlay
  document.getElementById('ping-overlay').classList.add('show');
  updateJournal();
}

function flashScreen() {
  const el = document.getElementById('flash-overlay');
  el.classList.remove('flashing');
  // Force reflow
  void el.offsetWidth;
  el.classList.add('flashing');
  el.addEventListener('animationend', () => el.classList.remove('flashing'), { once: true });
}

let _blinkInterval = null;
function blinkTitle() {
  clearInterval(_blinkInterval);
  const original = 'Présence';
  let on = true;
  document.title = '🔔 PING !';
  _blinkInterval = setInterval(() => {
    document.title = on ? original : '🔔 PING !';
    on = !on;
  }, 800);
  // Stop blinking when user interacts with the overlay
  const stop = () => { clearInterval(_blinkInterval); document.title = original; };
  document.getElementById('ping-overlay').addEventListener('click', stop, { once: true });
}

function playPingSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.6);
}

function respondToPing() {
  document.getElementById('ping-overlay').classList.remove('show');
  openCapture();
}

function dismissPing() {
  document.getElementById('ping-overlay').classList.remove('show');
  // Log as skipped
  state.entries.unshift({
    time: state.currentPingTime.toISOString(),
    tags: [],
    text: '',
    skipped: true,
  });
  saveEntries();
  updateJournal();
  if (state.running) schedulePing();
}

// ── CAPTURE ──
function openCapture() {
  // Build tags
  const grid = document.getElementById('tagsGrid');
  grid.innerHTML = '';
  state.selectedTags = [];
  TAGS.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.textContent = t;
    el.onclick = () => {
      el.classList.toggle('selected');
      if (el.classList.contains('selected')) state.selectedTags.push(t);
      else state.selectedTags = state.selectedTags.filter(x => x !== t);
    };
    grid.appendChild(el);
  });

  document.getElementById('freeText').value = '';

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
  if (state.selectedTags.length === 0 && !text) {
    skipEntry(); return;
  }
  state.entries.unshift({
    time: state.currentPingTime.toISOString(),
    tags: [...state.selectedTags],
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
    tags: [],
    text: '',
    skipped: true,
  });
  saveEntries();
  updateJournal();
  showView('home');
  if (state.running) schedulePing();
}

// ── JOURNAL ──
function getFilteredEntries() {
  const now = new Date();
  return state.entries
    .map((e, i) => ({ ...e, _idx: i }))
    .filter(e => {
      const d = new Date(e.time);
      if (state.filter === 'day') {
        return d.toDateString() === now.toDateString();
      } else if (state.filter === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 6);
        weekAgo.setHours(0,0,0,0);
        return d >= weekAgo;
      } else { // month
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
    });
}

function setFilter(f) {
  state.filter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + f).classList.add('active');
  const labels = { day: 'Aujourd\'hui', week: '7 derniers jours', month: 'Ce mois-ci' };
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

  if (filtered.length === 0) {
    const labels = { day: 'aujourd\'hui', week: 'cette semaine', month: 'ce mois-ci' };
    list.innerHTML = `<div class="empty-journal">Aucune entrée ${labels[state.filter]}.<br><em>Démarre une session pour commencer.</em></div>`;
    return;
  }

  // Group by date if week/month view
  const showDate = state.filter !== 'day';
  let html = '';
  let lastDate = '';

  filtered.forEach(e => {
    const d = new Date(e.time);
    const dateStr = d.toDateString();
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

    if (showDate && dateStr !== lastDate) {
      lastDate = dateStr;
      const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
      const months = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
      const label = days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
      html += `<div class="date-separator">${label}</div>`;
    }

    const actions = `
      <div class="entry-actions">
        ${!e.skipped ? `<button class="entry-action-btn edit" onclick="openEdit(${e._idx})">Éditer</button>` : ''}
        <button class="entry-action-btn del" onclick="deleteEntry(${e._idx})">Suppr.</button>
      </div>`;

    if (e.skipped) {
      html += `<div class="entry">${actions}<div class="entry-time">${timeStr}</div><div class="entry-skipped">— Ping ignoré</div></div>`;
    } else {
      html += `<div class="entry">${actions}
        <div class="entry-time">${timeStr}</div>
        ${e.tags && e.tags.length ? `<div class="entry-tags">${e.tags.map(t => `<div class="entry-tag">${t}</div>`).join('')}</div>` : ''}
        ${e.text ? `<div class="entry-text">${e.text}</div>` : ''}
      </div>`;
    }
  });

  list.innerHTML = html;
}

// ── EDIT / DELETE ──
let _editIdx = null;
let _editSelectedTags = [];

function openEdit(idx) {
  _editIdx = idx;
  const e = state.entries[idx];
  _editSelectedTags = [...(e.tags || [])];

  const grid = document.getElementById('editTagsGrid');
  grid.innerHTML = '';
  TAGS.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tag' + (_editSelectedTags.includes(t) ? ' selected' : '');
    el.textContent = t;
    el.onclick = () => {
      el.classList.toggle('selected');
      if (el.classList.contains('selected')) _editSelectedTags.push(t);
      else _editSelectedTags = _editSelectedTags.filter(x => x !== t);
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
  state.entries[_editIdx] = {
    ...state.entries[_editIdx],
    tags: [..._editSelectedTags],
    text,
    skipped: false,
  };
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

// ── CUSTOM CONFIRM (confirm() bloqué sur iOS file://) ──
function showConfirm(message, onOk) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:700;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:#111;border:1px solid #333;border-radius:2px;padding:28px 24px;margin:24px;max-width:320px;width:100%;text-align:center">
      <div style="font-size:16px;color:#e8e4dc;margin-bottom:24px;line-height:1.5">${message}</div>
      <div style="display:flex;gap:10px">
        <button id="confirmNo" style="flex:1;padding:12px;background:transparent;border:1px solid #333;color:#666;font-family:DM Sans,sans-serif;font-size:15px;cursor:pointer;border-radius:2px">Annuler</button>
        <button id="confirmYes" style="flex:1;padding:12px;background:#5a2020;border:1px solid #8b3a3a;color:#e8e4dc;font-family:DM Sans,sans-serif;font-size:15px;cursor:pointer;border-radius:2px">Supprimer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmNo').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#confirmYes').onclick = () => { document.body.removeChild(overlay); onOk(); };
}

// ── EXPORT ──
function exportData() {
  try {
    const lines = ['Heure,Tags,Note,Ignoré'];
    state.entries.forEach(e => {
      const d = new Date(e.time);
      const time = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
      lines.push(`"${time}","${(e.tags||[]).join('; ')}","${(e.text||'').replace(/"/g,'""')}","${e.skipped ? 'oui' : 'non'}"`);
    });
    const csv = lines.join('\n');
    try {
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'presence_' + new Date().toISOString().slice(0,10) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch(e2) {
      // Fallback iOS : ouvre dans une nouvelle fenêtre
      const w = window.open();
      if (w) { w.document.write('<pre>' + csv + '</pre>'); }
    }
  } catch(e) {}
}

// ── NAVIGATION ──
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
  }
}

// ── NOTIFICATIONS ──
function checkNotifPermission() {
  const container = document.getElementById('notifBannerContainer');
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { container.innerHTML = ''; return; }
  if (Notification.permission === 'denied') {
    container.innerHTML = `<div class="notif-banner"><span>🔕</span> Notifications bloquées — active-les dans les réglages du navigateur pour recevoir les pings même quand l'app est en arrière-plan.</div>`;
    return;
  }
  container.innerHTML = `<div class="notif-banner" onclick="requestNotif()"><span>🔔</span> Autoriser les notifications pour être pingé en arrière-plan</div>`;
}

function requestNotif() {
  Notification.requestPermission().then(() => checkNotifPermission());
}

// ── THEME ──
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  document.getElementById('themeIcon').textContent = isLight ? '☾' : '☀';
  try { store.set('presence_theme', isLight ? 'light' : 'dark'); } catch(e) {}
}

function loadTheme() {
  const saved = store.get('presence_theme');
  if (saved === 'light') {
    document.documentElement.classList.add('light');
    document.getElementById('themeIcon').textContent = '☾';
  }
}

// ── INIT ──
loadState();
loadTheme();
document.getElementById('intervalDisplay').textContent = state.intervalMin;
document.getElementById('varianceToggle').classList.toggle('on', state.variance);
updateJournal();
checkNotifPermission();
