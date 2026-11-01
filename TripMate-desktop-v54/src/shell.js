'use strict';
for (const name of ['retry','reload','browser','pdf','zoom-in','zoom-out','zoom-reset']) {
  document.getElementById(name).addEventListener('click', () => window.desktop.action(name));
}
window.desktop.onState(state => {
  const ready = state.status === 'ready';
  const failed = state.status === 'error';
  document.querySelector('.connection').dataset.state = state.status;
  document.getElementById('connection-text').textContent = ready ? '已连接' : failed ? '连接中断' : '正在连接';
  document.getElementById('status-panel').hidden = ready;
  document.getElementById('status-title').textContent = failed ? '暂时没能打开工作台' : '正在打开旅行工作台';
  document.getElementById('status-message').textContent = state.message || '正在连接 TripMate，你的旅行安排即将就绪。';
  document.getElementById('recovery').hidden = !failed;
  document.getElementById('reload').disabled = !ready;
  document.getElementById('pdf').disabled = !ready;
  document.getElementById('zoom-reset').textContent = `${state.zoom || 100}%`;
  if (failed) document.getElementById('retry').focus();
});
