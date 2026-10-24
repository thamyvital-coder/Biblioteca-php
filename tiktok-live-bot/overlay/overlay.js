(() => {
  const video = document.getElementById('character');
  const status = document.getElementById('status');
  const animations = {
    idle: '/assets/walk_sway.webm',
    wave: '/assets/waving_gesture.webm',
    react: '/assets/waving_gesture.webm',
  };
  let current = '';
  function playAnimation(name) {
    const animation = animations[name] ? name : 'idle';
    const next = animations[animation];
    if (current === next && !video.paused && animation === 'idle') return;
    current = next;
    video.loop = animation === 'idle';
    video.src = next;
    video.currentTime = 0;
    video.play().catch(() => {});
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
      status.textContent = data.animation === 'wave'
        ? 'Salve, @' + data.username + '!'
        : 'Respondendo @' + data.username + '...';
      status.classList.add('visible');
      clearTimeout(status._timer);
      status._timer = setTimeout(() => status.classList.remove('visible'), 2200);
    }
  });
  socket.addEventListener('close', () => setTimeout(() => location.reload(), 3000));
})();