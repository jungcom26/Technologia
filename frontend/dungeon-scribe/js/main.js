// Simple Start/Pause/Stop state machine for transcription controls
const stateEl = document.getElementById('tx-state');
const dotEl = document.getElementById('tx-dot');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const logEl = document.getElementById('log');

let txState = 'idle'; // 'idle' | 'recording' | 'paused'

const setState = (next) => {
  txState = next;
  if (next === 'recording'){
    stateEl.textContent = 'Recording';
    dotEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--success');
    btnStart.setAttribute('aria-pressed','true');
    btnPause.disabled = false;
    btnStop.disabled = false;
  } else if (next === 'paused'){
    stateEl.textContent = 'Paused';
    dotEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--warning');
    btnStart.setAttribute('aria-pressed','false');
    btnPause.disabled = false;
    btnStop.disabled = false;
  } else {
    stateEl.textContent = 'Idle';
    dotEl.style.background = '#6c6c6c';
    btnStart.setAttribute('aria-pressed','false');
    btnPause.disabled = true;
    btnStop.disabled = true;
  }
};

const addLog = (meta, text) => {
  const wrap = document.createElement('div');
  wrap.className = 'msg';
  wrap.innerHTML = `
    <div class="avatar">S</div>
    <div class="bubble">
      <div class="meta">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • ${meta}</div>
      ${text}
    </div>`;
  logEl.appendChild(wrap);
  logEl.scrollTop = logEl.scrollHeight;
};

btnStart.addEventListener('click', () => {
  if (txState === 'idle' || txState === 'paused'){
    setState('recording');
    addLog('System', '<em>Transcription started.</em>');
  }
});

btnPause.addEventListener('click', () => {
  if (txState === 'recording'){ setState('paused'); addLog('System', '<em>Transcription paused.</em>'); }
  else if (txState === 'paused'){ setState('recording'); addLog('System', '<em>Transcription resumed.</em>'); }
});

btnStop.addEventListener('click', () => {
  if (txState !== 'idle'){ setState('idle'); addLog('System', '<em>Transcription stopped.</em>'); }
});

// Keyboard shortcuts
window.addEventListener('keydown', (e)=>{
  if (e.key.toLowerCase() === 's') btnStart.click();
  if (e.key.toLowerCase() === 'p') btnPause.click();
  if (e.key.toLowerCase() === 'x') btnStop.click();
});
