const socket = io();
const $ = (id) => document.getElementById(id);
let audioContext;
let hitCount = 0;
let roundStartedAt = Date.now();
let timerInterval;
let currentRound = null;

function sound(kind) {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    osc.connect(gain); gain.connect(audioContext.destination);
    if (kind === 'hit') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(190, now); osc.frequency.exponentialRampToValueAtTime(48, now + 0.18);
      gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2); osc.start(now); osc.stop(now + 0.21);
    } else {
      osc.type = 'square'; osc.frequency.setValueAtTime(520, now); osc.frequency.exponentialRampToValueAtTime(820, now + 0.08);
      gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13); osc.start(now); osc.stop(now + 0.14);
    }
  } catch (_) {}
}
function render(state) {
  $('round-label').textContent = 'ROUND ' + state.round;
  $('last-action').textContent = state.lastAction || 'FIGHT!';
  $('hits-count').textContent = 'HITS ' + (state.hits || hitCount);
  if (state.timer !== undefined) $('timer').textContent = state.timer;
  for (const id of ['lula', 'flavio']) {
    const player = state.players[id];
    $(id + '-hp-text').textContent = player.hp;
    $(id + '-hp').style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
    const fighter = $('fighter-' + id);
    fighter.classList.toggle('winner', state.status === 'finished' && player.hp > 0);
    fighter.classList.toggle('ko', state.status === 'finished' && player.hp <= 0);
  }
  if (state.status === 'finished') $('fight-callout').textContent = 'K.O!';
  else $('fight-callout').textContent = 'FIGHT!';
}
function startTimer() {
  clearInterval(timerInterval); roundStartedAt = Date.now();
  timerInterval = setInterval(() => {
    $('timer').textContent = String(Math.max(0, 99 - Math.floor((Date.now() - roundStartedAt) / 1000))).padStart(2, '0');
  }, 250);
}
function onState(state) {
  render(state);
  if (currentRound !== state.round) { currentRound = state.round; startTimer(); }
}
function animateHit(event) {
  const target = event.target === 'lula' ? 'lula' : 'flavio';
  const fighter = $('fighter-' + target), arena = document.querySelector('.arena'), damage = $('damage-pop');
  fighter.classList.remove('hit'); void fighter.offsetWidth; fighter.classList.add('hit');
  arena.classList.remove('shake', 'hit-flash'); void arena.offsetWidth; arena.classList.add('shake', 'hit-flash');
  damage.textContent = '-' + (event.damage || 10); damage.style.left = target === 'lula' ? '28%' : '72%'; damage.style.top = '38%'; damage.style.opacity = '1';
  damage.animate([{ transform: 'translate(-50%,-20%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-80%) scale(1.25)', opacity: 1 }, { transform: 'translate(-50%,-150%) scale(1)', opacity: 0 }], { duration: 850, easing: 'ease-out' });
  sound('hit');
  setTimeout(() => { fighter.classList.remove('hit'); arena.classList.remove('shake', 'hit-flash'); damage.style.opacity = '0'; }, 450);
}
socket.on('connect', () => { $('connection-dot').classList.add('connected'); $('connection-text').textContent = 'JOGO CONECTADO'; });
socket.on('disconnect', () => { $('connection-dot').classList.remove('connected'); $('connection-text').textContent = 'RECONECTANDO…'; });
socket.on('state', onState);
socket.on('hit', (event) => { hitCount += 1; animateHit(event); });
async function post(path, body = {}) {
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) $('last-action').textContent = result.error || 'Não foi possível executar a ação.';
    else sound('confirm');
    if (result.state) onState(result.state);
  } catch (_) { $('last-action').textContent = 'Servidor desconectado. Inicie o jogo novamente.'; }
}
$('red-button').addEventListener('click', () => post('/api/test/hit', { target: 'flavio' }));
$('white-button').addEventListener('click', () => post('/api/test/hit', { target: 'lula' }));
$('reset-button').addEventListener('click', () => { hitCount = 0; currentRound = null; post('/api/test/reset'); });
fetch('/api/state').then(r => r.json()).then(onState).catch(() => {});
