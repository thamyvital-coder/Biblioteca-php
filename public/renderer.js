const socket = io();
const $ = (id) => document.getElementById(id);
let audioContext;

function sound(kind) {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    osc.connect(gain); gain.connect(audioContext.destination);
    if (kind === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now); osc.stop(now + 0.17);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now); osc.stop(now + 0.21);
    }
  } catch (_) {}
}

function render(state) {
  $('round').textContent = state.round;
  $('last-action').textContent = state.lastAction;
  for (const id of ['lula', 'flavio']) {
    const player = state.players[id];
    $(id + '-hp-text').textContent = player.hp;
    $(id + '-hp').style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`;
    $(id + '-status').textContent = state.status === 'finished'
      ? (player.hp <= 0 ? 'Nocaute!' : 'Vencedor da rodada!')
      : player.hp <= 30 ? 'Em perigo!' : 'Pronto para lutar';
    $(id === 'lula' ? 'fighter-lula' : 'fighter-flavio').classList.toggle('winner', state.status === 'finished' && player.hp > 0);
  }
}
socket.on('connect', () => { $('connection-dot').classList.add('connected'); $('connection-text').textContent = 'Jogo conectado'; });
socket.on('disconnect', () => { $('connection-dot').classList.remove('connected'); $('connection-text').textContent = 'Reconectando…'; });
socket.on('state', render);
socket.on('hit', (event) => {
  const fighter = $(event.target === 'lula' ? 'fighter-lula' : 'fighter-flavio');
  fighter.classList.remove('hit'); void fighter.offsetWidth; fighter.classList.add('hit'); sound('hit');
  setTimeout(() => fighter.classList.remove('hit'), 450);
});
async function post(path, body = {}) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) $('last-action').textContent = result.error || 'Não foi possível executar a ação.';
  else sound('confirm');
}
$('red-button').addEventListener('click', () => post('/api/test/hit', { target: 'flavio' }));
$('white-button').addEventListener('click', () => post('/api/test/hit', { target: 'lula' }));
$('reset-button').addEventListener('click', () => post('/api/test/reset'));
fetch('/api/state').then(r => r.json()).then(render).catch(() => {});
