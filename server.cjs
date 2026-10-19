const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');

const MAX_HP = 300;
const HIT_DAMAGE = 10;
const USER_COOLDOWN_MS = 1500;
const ROUND_BREAK_MS = 6000;

function freshState() {
  return {
    players: {
      lula: { id: 'lula', name: 'Lula', hp: MAX_HP, maxHp: MAX_HP },
      flavio: { id: 'flavio', name: 'Flávio Bolsonaro', hp: MAX_HP, maxHp: MAX_HP }
    },
    round: 1, timer: 99, status: 'playing', lastAction: 'ROUND 1 — PREPARE-SE!', hits: 0, updatedAt: Date.now()
  };
}

async function createServer(options = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const port = options.port ?? Number(process.env.PORT || 3002);
  const userLastEvent = new Map();
  let state = freshState();
  let roundTimer = null;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'brasilia-fighter' }));
  app.get('/api/state', (_req, res) => res.json(state));

  function publish() {
    state.updatedAt = Date.now();
    io.emit('state', state);
  }
  function resetRound() {
    state.players.lula.hp = MAX_HP;
    state.players.flavio.hp = MAX_HP;
    state.timer = 99;
    state.status = 'playing';
    state.lastAction = `ROUND ${state.round} — FIGHT!`;
    state.hits = 0;
    publish();
  }
  function normalizeEvent(body) {
    const gift = String(body.gift ?? body.giftName ?? body.type ?? '').toLowerCase().trim();
    if (['rose_red', 'red_rose', 'rosa vermelha', 'rosa vermelha 🌹', 'red rose'].includes(gift))
      return { target: 'flavio', label: 'Rosa vermelha', icon: '🌹' };
    if (['rose_white', 'white_rose', 'rosa branca', 'rosa branca 🤍', 'white rose'].includes(gift))
      return { target: 'lula', label: 'Rosa branca', icon: '🤍' };
    return null;
  }
  function applyGift(body = {}) {
    const userId = String(body.userId ?? body.uniqueId ?? body.username ?? 'visitante').slice(0, 100).trim();
    const event = normalizeEvent(body);
    if (!event) return { ok: false, status: 400, error: 'Presente não mapeado. Use rose_red ou rose_white.' };
    if (state.status !== 'playing') return { ok: false, status: 409, error: 'A rodada está encerrada.' };
    const now = Date.now();
    const last = userLastEvent.get(userId) || 0;
    if (now - last < USER_COOLDOWN_MS) return { ok: false, status: 429, error: 'Evento ignorado pelo limite de frequência.' };
    userLastEvent.set(userId, now);
    const player = state.players[event.target];
    player.hp = Math.max(0, player.hp - HIT_DAMAGE);
    state.hits += 1;
    state.lastAction = `${event.icon} ${event.label}: golpe em ${player.name}!`;
    io.emit('hit', { target: event.target, damage: HIT_DAMAGE, gift: event.label, userId, at: now });
    if (player.hp <= 0) {
      state.status = 'finished';
      state.lastAction = `K.O.! ${state.players[event.target === 'lula' ? 'flavio' : 'lula'].name} venceu a rodada!`;
      const finishedRound = state.round;
      clearTimeout(roundTimer);
      roundTimer = setTimeout(() => {
        if (state.round === finishedRound && state.status === 'finished') {
          state.round = state.round >= 99 ? 1 : state.round + 1;
          resetRound();
        }
      }, ROUND_BREAK_MS);
    }
    publish();
    return { ok: true, state };
  }
  app.post('/api/event', (req, res) => {
    const result = applyGift(req.body);
    res.status(result.status || 200).json(result);
  });
  app.post('/api/test/reset', (_req, res) => {
    clearTimeout(roundTimer); state = freshState(); userLastEvent.clear(); publish(); res.json({ ok: true, state });
  });
  app.post('/api/test/hit', (req, res) => {
    const target = req.body?.target;
    if (!['lula', 'flavio'].includes(target)) return res.status(400).json({ ok: false, error: 'Alvo inválido.' });
    const result = applyGift({ gift: target === 'flavio' ? 'rose_red' : 'rose_white', userId: `teste-${Date.now()}-${Math.random()}` });
    res.status(result.status || 200).json(result);
  });
  io.on('connection', socket => socket.emit('state', state));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const originalClose = server.close.bind(server);
  server.close = callback => { clearTimeout(roundTimer); return originalClose(callback); };
  return server;
}
if (require.main === module) {
  createServer().then(server => console.log(`Brasília Fighter disponível em http://127.0.0.1:${server.address().port}`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { createServer };
