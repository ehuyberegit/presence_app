'use strict';

const express = require('express');
const webpush = require('web-push');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── VAPID KEYS ────────────────────────────────────────────────────────────────
// Clés persistées sur disque pour survivre aux redémarrages

const KEYS_FILE = path.join(__dirname, '.vapid-keys.json');

function loadOrGenerateVapidKeys() {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  } catch {
    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
    return keys;
  }
}

const vapid = loadOrGenerateVapidKeys();

webpush.setVapidDetails(
  'mailto:presence@localhost',
  vapid.publicKey,
  vapid.privateKey
);

// ── SESSION STORE ─────────────────────────────────────────────────────────────
// { [userId]: { subscription, intervalMin, variance, timer, running } }

const sessions = {};

function scheduleNextPing(userId) {
  const session = sessions[userId];
  if (!session || !session.running) return;

  let ms = session.intervalMin * 60 * 1000;
  if (session.variance) ms = Math.round(ms * (0.5 + Math.random()));

  session.nextPingAt = Date.now() + ms;
  session.timer = setTimeout(() => firePing(userId), ms);
}

async function firePing(userId) {
  const session = sessions[userId];
  if (!session || !session.running) return;

  const pingTime = Date.now();
  try {
    await webpush.sendNotification(
      session.subscription,
      JSON.stringify({
        title: '🔔 Présence — Moment de conscience',
        body: "Qu'est-ce qui occupait ton esprit à cet instant ?",
        time: pingTime,
      })
    );
    console.log(`[ping] ${userId} @ ${new Date(pingTime).toLocaleTimeString('fr-FR')}`);
  } catch (err) {
    console.error(`[push error] ${userId}:`, err.statusCode, err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Abonnement expiré — on nettoie
      delete sessions[userId];
      return;
    }
  }

  scheduleNextPing(userId);
}

// ── API ───────────────────────────────────────────────────────────────────────

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapid.publicKey });
});

app.post('/session/start', (req, res) => {
  const { userId, subscription, intervalMin, variance } = req.body;
  if (!userId || !subscription) return res.status(400).json({ ok: false, error: 'missing params' });

  // Annuler le timer précédent si existant
  if (sessions[userId]?.timer) clearTimeout(sessions[userId].timer);

  sessions[userId] = {
    subscription,
    intervalMin: intervalMin || 20,
    variance: variance !== undefined ? variance : true,
    running: true,
    timer: null,
    nextPingAt: null,
  };

  scheduleNextPing(userId);

  const nextIn = sessions[userId].nextPingAt
    ? Math.round((sessions[userId].nextPingAt - Date.now()) / 1000)
    : null;
  console.log(`[start] ${userId} — prochain ping dans ~${nextIn}s`);
  res.json({ ok: true, nextPingIn: nextIn });
});

app.post('/session/update', (req, res) => {
  const { userId, intervalMin, variance } = req.body;
  const session = sessions[userId];
  if (!session) return res.json({ ok: false, error: 'no session' });

  session.intervalMin = intervalMin;
  session.variance = variance;

  if (session.timer) clearTimeout(session.timer);
  if (session.running) scheduleNextPing(userId);

  console.log(`[update] ${userId} — intervalle ${intervalMin}min, variance: ${variance}`);
  res.json({ ok: true });
});

app.post('/session/stop', (req, res) => {
  const { userId } = req.body;
  const session = sessions[userId];
  if (session) {
    if (session.timer) clearTimeout(session.timer);
    session.running = false;
    session.timer = null;
  }
  console.log(`[stop] ${userId}`);
  res.json({ ok: true });
});

app.post('/ping-now', async (req, res) => {
  const { userId } = req.body;
  const session = sessions[userId];
  if (!session) return res.status(404).json({ ok: false, error: 'no session' });

  // Annuler le ping déjà planifié et en envoyer un immédiatement
  if (session.timer) clearTimeout(session.timer);
  await firePing(userId);
  res.json({ ok: true });
});

// ── DÉMARRAGE ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n🔔 Serveur Présence démarré');
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Ouvre cette URL sur ton iPhone (même réseau WiFi)`);
  console.log(`   → Ou accède via l'IP de ton Mac : http://[IP-de-ton-Mac]:${PORT}\n`);
});
