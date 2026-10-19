const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const MAX_HP = 300, DAMAGE = 10, COOLDOWN = 1500;
function initial() {
  return { players: { lula: { name: 'Lula', hp: MAX_HP, maxHp: MAX_HP }, flavio: { name: 'Flávio Bolsonaro', hp: MAX_HP, maxHp: MAX_HP } }, round: 1, status: 'playing', hits: 0, lastAction: 'ROUND 1 — FIGHT!', updatedAt: Date.now() };
}
async function createServer({ port = 3002 } = {}) {
  const app = express(), server = http.createServer(app), io = new Server(server), last = new Map();
  let state = initial(), nextRound;
  app.disable('x-powered-by'); app.use(express.json({ limit: '10kb' })); app.use(express.static(path.join(__dirname, 'public')));
  app.get('/api/state', (_q, r) => r.json(state));
  app.get('/api/health', (_q, r) => r.json({ ok: true }));
  function publish() { state.updatedAt = Date.now(); io.emit('state', state); }
  function hit(target, userId = 'test-' + Date.now()) {
    if (!['lula', 'flavio'].includes(target)) return { status: 400, error: 'Alvo inválido' };
    if (state.status !== 'playing') return { status: 409, error: 'Nocaute! Aguarde a próxima rodada.' };
    const now = Date.now();
    if (now - (last.get(userId) || 0) < COOLDOWN) return { status: 429, error: 'Aguarde antes de enviar outro golpe.' };
    last.set(userId, now); state.players[target].hp = Math.max(0, state.players[target].hp - DAMAGE); state.hits++;
    state.lastAction = target === 'flavio' ? '🌹 Rosa vermelha → golpe no Flávio' : '🤍 Rosa branca → golpe no Lula';
    io.emit('hit', { target, damage: DAMAGE });
    if (state.players[target].hp === 0) { state.status = 'finished'; state.lastAction = 'K.O.! FIM DA RODADA'; clearTimeout(nextRound); nextRound = setTimeout(() => { state = initial(); state.round++; publish(); }, 6000); }
    publish(); return { ok: true, state };
  }
  app.post('/api/test/hit', (q, r) => { const out = hit(q.body?.target, 'manual-' + Math.random()); r.status(out.status || 200).json(out); });
  app.post('/api/test/reset', (_q, r) => { clearTimeout(nextRound); const round = state.round; state = initial(); state.round = round; last.clear(); publish(); r.json({ ok: true, state }); });
  app.post('/api/event', (q, r) => {
    const gift = String(q.body?.gift || q.body?.type || '').toLowerCase();
    const target = ['rose_red', 'red_rose', 'rosa vermelha'].includes(gift) ? 'flavio' : ['rose_white', 'white_rose', 'rosa branca'].includes(gift) ? 'lula' : null;
    const out = hit(target, q.body?.userId || q.body?.uniqueId || 'visitante'); r.status(out.status || 200).json(out);
  });
  io.on('connection', s => s.emit('state', state));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
if (require.main === module) createServer().then(s => console.log(`Brasília Fighter: http://127.0.0.1:${s.address().port}`)).catch(e => { console.error(e); process.exit(1); });
module.exports = { createServer };
