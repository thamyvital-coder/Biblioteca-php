(() => {
  const video = document.getElementById('character');
  const status = document.getElementById('status');
  const idleUrl = '/assets/happy_idle.webm';
  const waveUrl = '/assets/waving_gesture.webm';
  let waveTimer;
  let current = '';
  function playAnimation(name) {
    const next = name === 'wave' || name === 'react' ? waveUrl : idleUrl;
    if (current === next && !video.paused && name === 'idle') return;
    current = next;
    video.loop = next === idleUrl;
    video.src = next;
    video.currentTime = 0;
    video.play().catch(() => {});
    if (next === waveUrl) {
      clearTimeout(waveTimer);
      waveTimer = setTimeout(() => playAnimation('idle'), 1800);
    }
  }
  video.addEventListener('ended', () => playAnimation('idle'));
  playAnimation('idle');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(protocol + '//' + location.host);
  socket.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type !== 'animation') return;
    playAnimation(data.animation);
    if (data.username) {
      status.textContent = data.animation === 'wave' ? 'Salve, @' + data.username + '!' : 'Respondendo @' + data.username + '...';
      status.classList.add('visible');
      clearTimeout(status._timer);
      status._timer = setTimeout(() => status.classList.remove('visible'), 2200);
    }
  });
  socket.addEventListener('close', () => setTimeout(() => location.reload(), 3000));
})();