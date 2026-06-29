// DOM
const swDisplay = document.getElementById('stopwatch-display');
const swStartPauseBtn = document.getElementById('sw-start-pause');
const swResetBtn = document.getElementById('sw-reset');
const swLapBtn = document.getElementById('sw-lap');
const lapsList = document.getElementById('laps-list');
const tiHours = document.getElementById('ti-hours');
const tiMinutes = document.getElementById('ti-minutes');
const tiSeconds = document.getElementById('ti-seconds');
const tmInputMode = document.getElementById('timer-input-mode');
const tmDisplayMode = document.getElementById('timer-display');
const tmStartPauseBtn = document.getElementById('tm-start-pause');
const tmResetBtn = document.getElementById('tm-reset');
const alarmModal = document.getElementById('alarm-modal');
const stopAlarmBtn = document.getElementById('stop-alarm');
const pmDisplay = document.getElementById('pomodoro-display');
const pmStartPauseBtn = document.getElementById('pm-start-pause');
const pmResetBtn = document.getElementById('pm-reset');
const pmModeSwitch = document.getElementById('pomodoro-mode-switch');
const pmLabelUp = document.getElementById('label-count-up');
const pmLabelDown = document.getElementById('label-count-down');
const pmPresets = document.querySelectorAll('.pomodoro-presets .preset-btn');
const pmCustomBtn = document.getElementById('pm-custom-btn');
const pmCustomTime = document.getElementById('pm-custom-time');
const swRing = document.getElementById('sw-ring');
const tmRing = document.getElementById('tm-ring');
const pmRing = document.getElementById('pm-ring');

// Audio System
let globalVolume = 0.5;
let currentAmbient = 'none';
let currentAudioNode = null;
let currentSecondaryNode = null;

const soundPaths = {
  wind: 'assets/sounds/custom_ambient.m4a',
  rain_fire: 'assets/sounds/custom_ambient_2.m4a',
  snow_fire: 'assets/sounds/custom_ambient_3.m4a',
  river: 'assets/sounds/river.m4a',
  nature: 'assets/sounds/nature.m4a',
  ticktock: 'assets/sounds/ticktock.m4a',
  metronome: 'assets/sounds/metronome.m4a',
  countdown: 'assets/sounds/countdown.m4a'
};

const timeRanges = {
  wind: { start: 0, end: 33 },
  rain_fire: { start: 0, end: 40 },
  snow_fire: { start: 0, end: 40 },
  river: { start: 0, end: 20 },
  nature: { start: 0, end: 15 },
  ticktock: { start: 0, end: 10 },
  metronome: { start: 0, end: 10 },
  countdown: { start: 0, end: 3 }
};

function stopAmbient() {
  if (currentAudioNode) { try { currentAudioNode.pause(); } catch(e){} currentAudioNode = null; }
  if (currentSecondaryNode) { try { currentSecondaryNode.pause(); } catch(e){} currentSecondaryNode = null; }
  stopSynth();
}

// Shared AudioContext for Web Audio API fallback
let _webAudioCtx = null;
function getAudioCtx() {
  if (!_webAudioCtx || _webAudioCtx.state === 'closed') {
    _webAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_webAudioCtx.state === 'suspended') _webAudioCtx.resume();
  return _webAudioCtx;
}

// Synthesized ambient loop fallback using Web Audio API
let _synthNode = null;
function stopSynth() { if (_synthNode) { try { _synthNode.stop(); } catch(e){} _synthNode = null; } }

function playSynthAmbient(type) {
  stopSynth();
  const ctx = getAudioCtx();
  const bufLen = ctx.sampleRate * 4; // 4-second buffer looped
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);

  if (type === 'ticktock' || type === 'metronome') {
    // Simple tick-tock pattern
    for (let i = 0; i < bufLen; i++) {
      const t = i / ctx.sampleRate;
      const beat = t % 1; // 60 BPM
      data[i] = beat < 0.02 ? Math.sin(2 * Math.PI * (type === 'ticktock' ? 800 : 1000) * t) * (1 - beat / 0.02) * 0.5 : 0;
    }
  } else {
    // White noise for rain/wind/nature/river
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = globalVolume * 0.5;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  _synthNode = src;
  // Allow volume control
  currentAudioNode = { pause: () => { try { src.stop(); } catch(e){} }, _gainNode: gain };
  currentAudioNode.volume = undefined;  // volume controlled via gain
  // Patch volume control
  Object.defineProperty(currentAudioNode, 'volume', {
    set(v) { gain.gain.value = v * 0.5; },
    get() { return gain.gain.value / 0.5; }
  });
}

function playAudioFile(type) {
  stopAmbient();
  stopSynth();
  if (type === 'none') return;
  const path = soundPaths[type];
  if (!path) return;

  const a = new Audio(path);
  a.volume = globalVolume;
  const range = timeRanges[type];

  if (range) {
    a.currentTime = range.start;
    a.ontimeupdate = () => {
      if (a.currentTime >= range.end) a.currentTime = range.start;
    };
  } else {
    a.loop = true;
  }

  a.play().catch(e => {
    console.log("Audio file failed, using synth fallback:", e);
    playSynthAmbient(type);
  });
  currentAudioNode = a;
}

function pauseRhythmicIfTimerStopped() {
  if (['ticktock', 'metronome', 'countdown'].includes(currentAmbient)) {
    if (!swRunning && !tmRunning && !pmRunning && currentAudioNode) {
      currentAudioNode.pause();
    }
  }
}

function resumeRhythmicIfTimerStarted() {
  if (['ticktock', 'metronome', 'countdown'].includes(currentAmbient)) {
    if (currentAudioNode && currentAudioNode.paused) {
      currentAudioNode.play().catch(() => { });
    } else if (!currentAudioNode) {
      playAudioFile(currentAmbient);
    }
  }
}

function playAlarmSound() {
  const type = document.getElementById('alarm-sound-select').value;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);

  if (type === 'rapid') {
    o.type = 'sine'; o.frequency.value = 1200;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    o.start(); o.stop(ctx.currentTime + 0.12);
  } else if (type === 'chime') {
    o.type = 'sine'; o.frequency.setValueAtTime(800, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 1);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    o.start(); o.stop(ctx.currentTime + 1.1);
  } else {
    o.type = 'square'; o.frequency.setValueAtTime(440, ctx.currentTime);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  }
}

// UI Event Listeners for Audio
const soundPanelOverlay = document.getElementById('sound-panel-overlay');
const soundPanelBtn = document.getElementById('sound-panel-btn');
const soundPanelClose = document.getElementById('sound-panel-close');
const fsSoundBtn = document.getElementById('fs-sound-btn');
const volumeSlider = document.getElementById('volume-slider');
const soundItems = document.querySelectorAll('.sound-item');

soundPanelBtn.addEventListener('click', () => soundPanelOverlay.classList.remove('hidden'));
if (fsSoundBtn) fsSoundBtn.addEventListener('click', () => soundPanelOverlay.classList.remove('hidden'));
soundPanelClose.addEventListener('click', () => soundPanelOverlay.classList.add('hidden'));
soundPanelOverlay.addEventListener('click', (e) => { if (e.target === soundPanelOverlay) soundPanelOverlay.classList.add('hidden'); });

soundItems.forEach(item => {
  item.addEventListener('click', () => {
    currentAmbient = item.dataset.sound;
    soundItems.forEach(i => i.classList.toggle('active', i.dataset.sound === currentAmbient));
    playAudioFile(currentAmbient);
  });
});

volumeSlider.addEventListener('input', () => {
  globalVolume = volumeSlider.value / 100;
  if (currentAudioNode) currentAudioNode.volume = globalVolume;
});

// Navigation - unified function
function navigateTo(targetId, skipHistory = false) {
  const views = document.querySelectorAll('.view');
  const targetView = document.getElementById(targetId);
  if (!targetView) return;
  views.forEach(v => v.classList.remove('active'));
  targetView.classList.add('active');
  // Sidebar items
  document.querySelectorAll('.nav-sidebar-item').forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  // Bottom nav items
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  // Close sidebar
  const navSidebar = document.getElementById('nav-sidebar');
  const navOverlay = document.getElementById('nav-sidebar-overlay');
  if (navSidebar) navSidebar.classList.add('hidden');
  if (navOverlay) navOverlay.classList.add('hidden');

  // UI Back button toggle
  const uiBackBtn = document.getElementById('ui-back-btn');
  if (uiBackBtn) {
    if (targetId === 'home-view') uiBackBtn.classList.add('hidden');
    else uiBackBtn.classList.remove('hidden');
  }

  if (!skipHistory) {
    history.pushState({ viewId: targetId }, '', '');
  }
}

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.viewId) {
    navigateTo(e.state.viewId, true);
  } else {
    navigateTo('home-view', true);
  }
});

// push initial state
history.replaceState({ viewId: 'home-view' }, '', '');

const uiBackBtn = document.getElementById('ui-back-btn');
if (uiBackBtn) {
  uiBackBtn.addEventListener('click', () => {
    history.back();
  });
}

// Global Backspace handling
document.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace') {
    const tag = e.target.tagName.toLowerCase();
    const contentEditable = e.target.getAttribute('contenteditable') === 'true';
    if (tag !== 'input' && tag !== 'textarea' && !contentEditable) {
      e.preventDefault(); // Prevent default backspace action (some browsers navigate back anyway)

      // Check if we are not on home view, then go back
      const activeView = document.querySelector('.view.active');
      if (activeView && activeView.id !== 'home-view') {
        history.back();
      }
    }
  }
});

// Hamburger sidebar
const navSidebar = document.getElementById('nav-sidebar');
const navOverlay = document.getElementById('nav-sidebar-overlay');
document.getElementById('nav-hamburger').addEventListener('click', () => { navSidebar.classList.remove('hidden'); navOverlay.classList.remove('hidden'); });
document.getElementById('nav-sidebar-close').addEventListener('click', () => { navSidebar.classList.add('hidden'); navOverlay.classList.add('hidden'); });
navOverlay.addEventListener('click', () => { navSidebar.classList.add('hidden'); navOverlay.classList.add('hidden'); });

// Sidebar nav items
document.querySelectorAll('.nav-sidebar-item').forEach(btn => { btn.addEventListener('click', () => navigateTo(btn.dataset.target)); });
// Bottom nav items
document.querySelectorAll('.nav-btn').forEach(btn => { btn.addEventListener('click', () => navigateTo(btn.dataset.target)); });
// Home shortcuts
document.querySelectorAll('.home-shortcut').forEach(btn => { btn.addEventListener('click', () => navigateTo(btn.dataset.target)); });


// Timer Helpers
function formatTime(ms, showMs) {
  const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  if (showMs) {
    const mm = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${h}:${m}:${s}<span class="milliseconds">.${mm}</span>`;
  }
  return `${h}:${m}:${s}`;
}

// Stopwatch
let swStart = 0, swElapsed = 0, swInterval, swRunning = false, lapCount = 0, lastLap = 0;
swStartPauseBtn.addEventListener('click', () => {
  if (swRunning) {
    clearInterval(swInterval); swRunning = false;
    swStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    swStartPauseBtn.classList.remove('running'); swRing.classList.remove('active');
    pauseRhythmicIfTimerStopped();
  } else {
    swStart = Date.now() - swElapsed;
    swInterval = setInterval(() => { swElapsed = Date.now() - swStart; swDisplay.innerHTML = formatTime(swElapsed, true); saveWorkTime(10); }, 10);
    swRunning = true;
    swStartPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    swStartPauseBtn.classList.add('running'); swRing.classList.add('active');
    resumeRhythmicIfTimerStarted();
  }
});
swResetBtn.addEventListener('click', () => {
  if (swElapsed > 10000) { // save only if more than 10 seconds
    const name = (document.getElementById('sw-session-name')?.value.trim()) || 'Genel Çalışma';
    saveSession({ name, ms: swElapsed, type: 'Kronometre' });
    if (document.getElementById('sw-session-name')) document.getElementById('sw-session-name').value = '';
  }
  clearInterval(swInterval); swRunning = false; swElapsed = 0; lapCount = 0; lastLap = 0;
  swDisplay.innerHTML = formatTime(0, true); lapsList.innerHTML = '';
  swStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  swStartPauseBtn.classList.remove('running'); swRing.classList.remove('active');
  pauseRhythmicIfTimerStopped();
});
swLapBtn.addEventListener('click', () => {
  if (!swRunning) return;
  lapCount++; const d = swElapsed - lastLap; lastLap = swElapsed;
  const li = document.createElement('li'); li.className = 'lap-item';
  li.innerHTML = `<span class="lap-index">Tur ${lapCount}</span><span class="lap-diff">+${formatTime(d, false)}</span><span class="lap-total">${formatTime(swElapsed, false)}</span>`;
  lapsList.prepend(li);
});

// Timer
let tmRemaining = 0, tmInitial = 0, tmInterval, tmRunning = false, alarmInterval;
tmStartPauseBtn.addEventListener('click', () => {
  if (tmRunning) {
    clearInterval(tmInterval); tmRunning = false;
    tmStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    tmStartPauseBtn.classList.remove('running'); tmRing.classList.remove('active');
    pauseRhythmicIfTimerStopped();
  } else {
    if (tmRemaining === 0) {
      const h = parseInt(tiHours.value) || 0, m = parseInt(tiMinutes.value) || 0, s = parseInt(tiSeconds.value) || 0;
      tmRemaining = (h * 3600 + m * 60 + s) * 1000;
      tmInitial = tmRemaining;
    }
    if (!tmRemaining) return;
    tmInputMode.classList.add('hidden'); tmDisplayMode.classList.remove('hidden'); tmResetBtn.disabled = false;
    let last = Date.now();
    tmInterval = setInterval(() => {
      const d = Date.now() - last; last = Date.now();
      tmRemaining -= d; saveWorkTime(d);
      if (tmRemaining <= 0) { 
        tmRemaining = 0; 
        tmDisplayMode.innerHTML = formatTime(0, false); 
        stopTimer(true); // completed
        triggerAlarm(); 
      }
      else tmDisplayMode.innerHTML = formatTime(tmRemaining, false);
    }, 100);
    tmRunning = true; tmStartPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    tmStartPauseBtn.classList.add('running'); tmRing.classList.add('active');
    resumeRhythmicIfTimerStarted();
  }
});
function stopTimer(completed = false) { 
  if (completed) {
    const elapsed = tmInitial;
    if (elapsed > 10000) {
      const name = (document.getElementById('tm-session-name')?.value.trim()) || 'Genel Çalışma';
      saveSession({ name, ms: elapsed, type: 'Geri Sayım' });
      if (document.getElementById('tm-session-name')) document.getElementById('tm-session-name').value = '';
    }
    tmInitial = 0;
  }
  clearInterval(tmInterval); tmRunning = false; tmStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>'; tmStartPauseBtn.classList.remove('running'); tmRing.classList.remove('active'); 
}
function triggerAlarm() { alarmModal.classList.add('active'); playAlarmSound(); alarmInterval = setInterval(playAlarmSound, 2000); }
stopAlarmBtn.addEventListener('click', () => { alarmModal.classList.remove('active'); clearInterval(alarmInterval); });
tmResetBtn.addEventListener('click', () => { 
  const elapsed = tmInitial - tmRemaining;
  if (elapsed > 10000) {
    const name = (document.getElementById('tm-session-name')?.value.trim()) || 'Genel Çalışma';
    saveSession({ name, ms: elapsed, type: 'Geri Sayım' });
    if (document.getElementById('tm-session-name')) document.getElementById('tm-session-name').value = '';
  }
  tmRemaining = 0; tmInitial = 0; tmDisplayMode.classList.add('hidden'); tmInputMode.classList.remove('hidden'); tmResetBtn.disabled = true; stopTimer(false); pauseRhythmicIfTimerStopped(); 
});

// Pomodoro
let pmTarget = 25 * 60000, pmCurrent = 25 * 60000, pmInterval, pmRunning = false, pmCountDown = true;
function updatePm() {
  const m = Math.floor(pmCurrent / 60000).toString().padStart(2, '0');
  const s = Math.floor((pmCurrent % 60000) / 1000).toString().padStart(2, '0');
  pmDisplay.textContent = `${m}:${s}`;
}
function initPm() { pmCurrent = pmCountDown ? pmTarget : 0; updatePm(); }

pmPresets.forEach(b => b.addEventListener('click', () => { if (pmRunning) return; pmPresets.forEach(x => x.classList.remove('active')); b.classList.add('active'); pmTarget = parseInt(b.dataset.time) * 60000; initPm(); }));
pmCustomBtn.addEventListener('click', () => { if (pmRunning) return; const v = parseInt(pmCustomTime.value); if (!v) return; pmTarget = v * 60000; initPm(); });

function togglePmMode() {
  if (pmRunning) return;
  pmCountDown = !pmCountDown;
  pmModeSwitch.checked = pmCountDown;
  pmLabelUp.classList.toggle('active', !pmCountDown);
  pmLabelDown.classList.toggle('active', pmCountDown);
  initPm();
}
pmDisplay.addEventListener('click', togglePmMode);
pmRing.addEventListener('click', togglePmMode);
pmLabelUp.addEventListener('click', () => { if (pmCountDown) togglePmMode(); });
pmLabelDown.addEventListener('click', () => { if (!pmCountDown) togglePmMode(); });
pmModeSwitch.addEventListener('change', () => { if (pmModeSwitch.checked !== pmCountDown) togglePmMode(); });

pmStartPauseBtn.addEventListener('click', () => {
  if (pmRunning) {
    clearInterval(pmInterval); pmRunning = false;
    pmStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    pmStartPauseBtn.classList.remove('running'); pmRing.classList.remove('active');
    pauseRhythmicIfTimerStopped();
  } else {
    let last = Date.now();
    pmInterval = setInterval(() => {
      const d = Date.now() - last; last = Date.now();
      if (pmCountDown) { pmCurrent -= d; if (pmCurrent <= 0) { pmCurrent = 0; finishPm(); } }
      else { pmCurrent += d; if (pmCurrent >= pmTarget) { pmCurrent = pmTarget; finishPm(); } }
      saveWorkTime(d); updatePm();
    }, 100);
    pmRunning = true; pmStartPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    pmStartPauseBtn.classList.add('running'); pmRing.classList.add('active');
    resumeRhythmicIfTimerStarted();
  }
});
function finishPm() {
  const elapsed = pmCountDown ? (pmTarget - pmCurrent) : pmCurrent;
  const name = (document.getElementById('pm-session-name')?.value.trim()) || 'Genel Çalışma';
  saveSession({ name, ms: elapsed, type: 'Pomodoro' });
  if (document.getElementById('pm-session-name')) document.getElementById('pm-session-name').value = '';
  clearInterval(pmInterval); pmRunning = false;
  pmStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  pmRing.classList.remove('active'); triggerAlarm(); initPm(); pauseRhythmicIfTimerStopped();
}
pmResetBtn.addEventListener('click', () => { clearInterval(pmInterval); pmRunning = false; pmStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>'; pmRing.classList.remove('active'); initPm(); pauseRhythmicIfTimerStopped(); });

// Worklog
function getTodayKey() { return new Date().toISOString().slice(0, 10); }
function msToHM(ms) {
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}sa ${m}dk` : `${m}dk`;
}
function msToH(ms) {
  const h = ms / 3600000;
  return h.toFixed(1) + 'sa';
}
function saveWorkTime(d) {
  const k = 'worklog_' + getTodayKey();
  const v = parseInt(localStorage.getItem(k) || '0') + d;
  localStorage.setItem(k, v);
  renderWorkLog();
}

const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_DAYS_FULL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_MONTHS_FULL = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

let currentWlTab = 'today';
let sessionHistory = JSON.parse(localStorage.getItem('session_history') || '[]');

function renderWorkLog() {
  const todayMs = parseInt(localStorage.getItem('worklog_' + getTodayKey()) || '0');
  document.getElementById('wl-today').textContent = msToHM(todayMs);

  // --- Week ---
  let weekMs = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = 'worklog_' + d.toISOString().slice(0, 10);
    const v = parseInt(localStorage.getItem(k) || '0');
    weekMs += v;
  }
  const weekStr = msToHM(weekMs);
  document.getElementById('wl-week').textContent = weekStr;

  // --- Annual (12 months) sum for month card ---
  let yearMs = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const v = parseInt(localStorage.getItem('worklog_' + d.toISOString().slice(0, 10)) || '0');
    yearMs += v;
  }
  document.getElementById('wl-month').textContent = msToHM(yearMs);

  // Render tab content based on currentWlTab
  const container = document.getElementById('wl-tab-content');
  if (!container) return;
  container.innerHTML = '';
  
  if (currentWlTab === 'today') {
    const todayStr = getTodayKey();
    const todaySessions = sessionHistory.filter(s => s.date === todayStr);
    if (todaySessions.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;font-size:13px;">Bugün kayıtlı çalışma yok.</div>';
    } else {
      const cats = {};
      todaySessions.forEach(s => { cats[s.name] = (cats[s.name] || 0) + s.ms; });
      const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]);
      const maxMs = sorted.length ? sorted[0][1] : 1;
      container.innerHTML = `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Bugün Dağılımı</div>` + 
        sorted.map(([name, ms]) => {
          const pct = Math.round((ms / maxMs) * 100);
          return `<div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
              <span style="color:var(--text-primary);font-weight:500;">${name}</span>
              <span style="color:var(--neon-green);">${msToHM(ms)}</span>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:6px;">
              <div style="background:var(--neon-green);width:${pct}%;height:100%;border-radius:4px;"></div>
            </div>
          </div>`;
        }).join('');
    }
  } else if (currentWlTab === 'week') {
    container.innerHTML = `<div class="wl-chart-window">
      <h3 style="font-size:14px;color:var(--text-primary);margin-bottom:15px;text-align:center;">Haftalık Grafik (Bu Hafta)</h3>
      <div class="wl-week-chart" id="wl-week-chart-container"></div>
    </div>`;
    
    let chartHtml = '';
    const daysData = [];
    let maxW = 1;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const jsDayToMonSun = (dayOfWeek + 6) % 7; // 0=Mon, 6=Sun
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - jsDayToMonSun);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      const label = `${d.getDate()} ${TR_MONTHS_FULL[d.getMonth()]} ${TR_DAYS_FULL[d.getDay()]}`;
      const daySessions = sessionHistory.filter(s => s.date === dStr);
      const totalMs = daySessions.reduce((a, s) => a + s.ms, 0);
      if (totalMs > maxW) maxW = totalMs;
      daysData.push({ id: `wd-${i}`, label, sessions: daySessions, totalMs });
    }

    daysData.forEach(day => {
      const pct = Math.round((day.totalMs / maxW) * 100);
      chartHtml += `<div class="wl-day-bar" onclick="toggleWlDetail('${day.id}')" style="cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex; justify-content:space-between; width:100%;">
          <span class="wl-day-name" style="font-size:13px;">${day.label}</span>
          <span class="wl-day-time">${msToHM(day.totalMs)}</span>
        </div>
        <div class="wl-bar-wrap" style="width:100%; height:8px;"><div class="wl-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
      
      chartHtml += `<div id="${day.id}" class="wl-detail-box" style="display:none; margin: 4px 0 12px 0; background:rgba(0,0,0,0.4); border:none;">`;
      if (day.sessions.length === 0) {
        chartHtml += `<div class="wl-detail-row"><span>Kayıt Yok</span></div>`;
      } else {
        const cats = {};
        day.sessions.forEach(s => { cats[s.name] = (cats[s.name] || 0) + s.ms; });
        const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]);
        chartHtml += sorted.map(([name, ms]) => `<div class="wl-detail-row"><span>${name}</span><span style="color:var(--neon-green);">${msToHM(ms)}</span></div>`).join('');
      }
      chartHtml += `</div>`;
    });
    document.getElementById('wl-week-chart-container').innerHTML = chartHtml;

  } else if (currentWlTab === 'month') {
    container.innerHTML = `<div class="wl-chart-window">
      <h3 style="font-size:14px;color:var(--text-primary);margin-bottom:15px;text-align:center;">Aylık Grafik (Son 12 Ay)</h3>
      <div class="wl-month-chart" id="wl-month-chart-container"></div>
    </div>`;
    
    let chartHtml = '';
    const yr = 2026;
    for (let i = 0; i < 12; i++) {
      const moStr = String(i + 1).padStart(2, '0');
      const label = `${TR_MONTHS_FULL[i]} ${yr}`;
      
      const monthSessions = sessionHistory.filter(s => s.date.startsWith(`${yr}-${moStr}`));
      const totalMs = monthSessions.reduce((a, s) => a + s.ms, 0);
      const id = `mo-${i}`;

      chartHtml += `<div class="wl-month-row" style="display:block; cursor:default; padding: 12px 10px; margin-bottom: 12px; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(57,255,20,0.1);">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="wl-month-name" style="font-size:14px; font-weight:700; color:var(--neon-green);">${label}</span>
          <span class="wl-day-time" style="font-size:13px;">${msToHM(totalMs)}</span>
        </div>`;

      chartHtml += `<div id="${id}" class="wl-detail-box" style="display:block; margin:0; padding:0; background:transparent; border:none; animation:none;">`;
      if (monthSessions.length === 0) {
        chartHtml += `<div class="wl-detail-row"><span>Kayıt Yok</span></div>`;
      } else {
        const cats = {};
        monthSessions.forEach(s => { cats[s.name] = (cats[s.name] || 0) + s.ms; });
        const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]);
        chartHtml += sorted.map(([name, ms]) => `<div class="wl-detail-row"><span>${name}</span><span style="color:var(--neon-green);">${msToHM(ms)}</span></div>`).join('');
      }
      chartHtml += `</div></div>`;
    }
    document.getElementById('wl-month-chart-container').innerHTML = chartHtml;
  }
}

window.toggleWlDetail = function(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

document.querySelectorAll('.worklog-card').forEach(tab => {
  tab.addEventListener('click', () => {
    if (!tab.dataset.tab) return;
    document.querySelectorAll('.worklog-card').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentWlTab = tab.dataset.tab;
    renderWorkLog();
  });
});

renderWorkLog();

// Habits
let habits = JSON.parse(localStorage.getItem('habits') || '[]');
let selectedHabitCat = 'Rutin Olan Alışkanlıklar';
const HABIT_SUGGESTIONS = {
  'Sünnet Olan Alışkanlıklar': ['Misvak kullanmak', 'Teheccüd kılmak', 'Dua ile uyumak', 'Selamlaşmak', 'Sadaka vermek'],
  'Rutin Olan Alışkanlıklar': ['Kitap okumak', 'Erken kalkmak', 'Günlük yazı yazmak'],
  'Her Gün Yapılması Gereken Alışkanlıklar': ['10.000 adım', 'Bol su içmek', 'Spor yapmak', 'Medya süresini sınırla'],
  'Haftalık Yapılması Gereken Alışkanlıklar': ['Aile ziyareti', 'Haftalık plan yapmak', 'Büyükleri aramak']
};

function saveHabits() { localStorage.setItem('habits', JSON.stringify(habits)); }

function renderHabitSuggestions() {
  const container = document.getElementById('habit-suggestions'); if (!container) return;
  container.innerHTML = '';
  const suggs = HABIT_SUGGESTIONS[selectedHabitCat] || [];
  suggs.forEach(s => {
    const chip = document.createElement('div');
    chip.style.cssText = 'background:rgba(57,255,20,0.1); border:1px solid var(--neon-green); color:var(--neon-green); padding:3px 10px; border-radius:12px; font-size:12px; cursor:pointer;';
    chip.textContent = '+ ' + s;
    chip.onclick = () => { document.getElementById('habit-name-input').value = s; };
    container.appendChild(chip);
  });
}

function renderHabits() {
  const list = document.getElementById('habit-list'); if (!list) return;
  list.innerHTML = '';
  const filtered = habits.filter(h => h.category === selectedHabitCat);
  if (filtered.length === 0) list.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding:20px;">Bu kategoride henüz alışkanlık yok.</div>`;

  filtered.forEach(h => {
    const card = document.createElement('div'); card.className = 'habit-card';
    const now = new Date();

    // -- Last 7 days row --
    let checksHtml = '<div class="habit-daily-checks">';
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const done = (h.checks || []).includes(ds);
      checksHtml += `<div class="check-day"><div class="check-num${done ? ' done' : ''}" onclick="toggleHabit('${h.name}','${ds}')">${d.getDate()}</div><span>${TR_DAYS[d.getDay()]}</span></div>`;
    }
    checksHtml += '</div>';

    // -- Calendar month view (hidden by default) --
    const calId = 'hcal-' + h.name.replace(/\s/g,'_');
    const calViewMonth = now.getMonth();
    const calViewYear = now.getFullYear();
    const firstDay = new Date(calViewYear, calViewMonth, 1);
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    let calOffset = firstDay.getDay() - 1; if (calOffset < 0) calOffset = 6;
    const todayStr = now.toISOString().slice(0,10);

    let calHtml = `<div id="${calId}" class="habit-cal-wrap" style="display:none;margin-top:10px;">
      <div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-bottom:6px;">${TR_MONTHS_FULL[calViewMonth]} ${calViewYear} — Geçmiş günlere tıklayarak işaretleyebilirsiniz</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;">
        ${['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(d=>`<div style="font-size:9px;color:var(--text-secondary);padding:2px;">${d}</div>`).join('')}
        ${Array(calOffset).fill('<div></div>').join('')}`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(calViewYear, calViewMonth, d);
      const ds = dateObj.toISOString().slice(0,10);
      const isFuture = dateObj > now;
      const done = (h.checks || []).includes(ds);
      const isToday = ds === todayStr;
      calHtml += `<div onclick="${!isFuture ? `toggleHabit('${h.name}','${ds}')` : ''}" style="
        cursor:${isFuture ? 'default' : 'pointer'};
        background:${done ? '#27c93f' : (isFuture ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)')};
        border:1px solid ${done ? '#27c93f' : (isToday ? 'var(--neon-green)' : 'rgba(255,255,255,0.12)')};
        border-radius:5px;padding:3px 0;font-size:11px;
        color:${done ? '#000' : (isFuture ? 'rgba(255,255,255,0.2)' : (isToday ? 'var(--neon-green)' : 'var(--text-primary)'))};
        font-weight:${isToday ? 'bold' : 'normal'};
        transition:0.15s;">${d}</div>`;
    }
    calHtml += '</div></div>';

    card.innerHTML = `
      <div class="habit-card-top">
        <span>${h.name}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button onclick="toggleHabitCal('${calId}')" style="background:none;border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:var(--text-secondary);cursor:pointer;font-size:10px;padding:3px 8px;">📅 Geçmiş</button>
          <button onclick="deleteHabit('${h.name}')" style="background:none;border:none;color:rgba(255,80,80,0.7);cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      ${checksHtml}
      ${calHtml}
    `;
    list.appendChild(card);
  });
  renderHabitSuggestions();
}
window.toggleHabitCal = (calId) => {
  const el = document.getElementById(calId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};
window.toggleHabit = (name, date) => {
  const h = habits.find(x => x.name === name);
  if (!h.checks) h.checks = [];
  const idx = h.checks.indexOf(date);
  if (idx > -1) h.checks.splice(idx, 1); else h.checks.push(date);
  saveHabits(); renderHabits();
};
window.deleteHabit = (name) => { habits = habits.filter(x => x.name !== name); saveHabits(); renderHabits(); };

document.getElementById('habit-add-btn').addEventListener('click', () => {
  const name = document.getElementById('habit-name-input').value.trim();
  if (!name) return;
  habits.push({ name, category: selectedHabitCat, checks: [] });
  saveHabits(); renderHabits(); document.getElementById('habit-name-input').value = '';
});

// Sidebar
document.getElementById('habit-sidebar-toggle').addEventListener('click', () => { document.getElementById('habit-sidebar').classList.remove('hidden'); document.getElementById('habit-sidebar-overlay').classList.remove('hidden'); });
document.getElementById('habit-sidebar-close').addEventListener('click', () => { document.getElementById('habit-sidebar').classList.add('hidden'); document.getElementById('habit-sidebar-overlay').classList.add('hidden'); });
document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', () => {
    selectedHabitCat = item.dataset.category;
    document.getElementById('habit-view-title').textContent = item.innerText;
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active')); item.classList.add('active');
    document.getElementById('habit-sidebar').classList.add('hidden'); document.getElementById('habit-sidebar-overlay').classList.add('hidden');
    renderHabits();
  });
});

// Streaks
let streaks = JSON.parse(localStorage.getItem('streaks') || '[]');
function saveStreaks() { localStorage.setItem('streaks', JSON.stringify(streaks)); }

function getStreakStats(s) {
  const checks = s.days || [];
  const todayStr = getTodayKey();
  let current = 0, best = 0, streak = 0;
  // sort
  const sorted = [...checks].sort();
  // calculate current streak (consecutive days ending today or yesterday)
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (checks.includes(ds)) { current++; } else { break; }
  }
  // best streak
  let tmp = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { tmp = 1; }
    else {
      const prev = new Date(sorted[i - 1]); prev.setDate(prev.getDate() + 1);
      if (prev.toISOString().slice(0, 10) === sorted[i]) tmp++;
      else tmp = 1;
    }
    if (tmp > best) best = tmp;
  }
  return { current, best, todayDone: checks.includes(todayStr) };
}

function renderStreakCalendar(card, s) {
  const wrap = card.querySelector('.streak-calendar-wrap');
  if (!wrap) return;
  const calNav = card.querySelector('.streak-cal-month-lbl');
  const viewMonth = parseInt(card.dataset.viewMonth || new Date().getMonth());
  const viewYear = parseInt(card.dataset.viewYear || new Date().getFullYear());

  card.dataset.viewMonth = viewMonth;
  card.dataset.viewYear = viewYear;

  calNav.textContent = TR_MONTHS_FULL[viewMonth] + ' ' + viewYear;

  const calGrid = card.querySelector('.streak-calendar');
  calGrid.innerHTML = '';

  // Day headers (Mon-Sun reorder: Pzt..Paz)
  const hdrs = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  hdrs.forEach(h => {
    const el = document.createElement('div'); el.className = 'streak-cal-day-hdr'; el.textContent = h;
    calGrid.appendChild(el);
  });

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = getTodayKey();

  // First day of week offset (0=Mon)
  let startOffset = firstDay.getDay() - 1; // getDay: 0=Sun
  if (startOffset < 0) startOffset = 6;

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div'); empty.className = 'streak-day streak-day-empty';
    calGrid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewYear, viewMonth, d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    const isDone = (s.days || []).includes(dateStr);
    const isToday = dateStr === todayStr;
    const isFuture = dateObj > today;

    const el = document.createElement('div');
    let cls = 'streak-day';
    if (isDone) cls += ' done';
    else if (isFuture) cls += ' future';
    else cls += ' past';
    if (isToday) cls += ' today';
    el.className = cls;
    el.textContent = d;
    el.title = dateStr;

    if (!isFuture) {
      el.addEventListener('click', () => {
        const idx = (s.days || []).indexOf(dateStr);
        if (!s.days) s.days = [];
        if (idx > -1) s.days.splice(idx, 1); else s.days.push(dateStr);
        saveStreaks(); renderStreaks();
      });
    }
    calGrid.appendChild(el);
  }
}

function renderStreaks() {
  const list = document.getElementById('streak-list'); if (!list) return;
  list.innerHTML = '';
  if (streaks.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:20px;">Henüz hedef eklenmedi.</div>';
    return;
  }
  streaks.forEach((s, si) => {
    const stats = getStreakStats(s);
    const todayStr = getTodayKey();
    const card = document.createElement('div');
    card.className = 'streak-card';
    card.dataset.viewMonth = new Date().getMonth();
    card.dataset.viewYear = new Date().getFullYear();

    card.innerHTML = `
      <div class="streak-card-top">
        <span class="streak-goal-name"><i class="fas fa-fire" style="color:#ff6b35;"></i> ${s.name}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:11px; color:var(--text-secondary);">🔥 ${stats.current} gün</span>
          <button onclick="deleteStreak(${si})" style="background:none;border:none;color:rgba(255,80,80,0.6);cursor:pointer;font-size:15px;"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="streak-stats">
        <div class="streak-stat"><div class="streak-stat-val">${stats.current}</div><div class="streak-stat-lbl">Mevcut Seri</div></div>
        <div class="streak-stat"><div class="streak-stat-val" style="color:var(--neon-green); text-shadow:0 0 10px var(--neon-green-glow);">${stats.best}</div><div class="streak-stat-lbl">En İyi Seri</div></div>
        <div class="streak-stat"><div class="streak-stat-val" style="font-size:16px; color:var(--text-secondary);">${(s.days || []).length}</div><div class="streak-stat-lbl">Toplam Gün</div></div>
      </div>
      <div class="streak-today-section">
        <button class="streak-today-btn ${stats.todayDone ? 'done' : ''}" data-si="${si}">
          ${stats.todayDone ? '<i class="fas fa-check-circle"></i> Bugün Tamamlandı ✓' : '<i class="far fa-circle"></i> Bugünü Tamamla'}
        </button>
      </div>
      <div class="streak-calendar-wrap">
        <div class="streak-calendar-header">
          <button class="streak-cal-nav" data-si="${si}" data-dir="-1">&#8249;</button>
          <span class="streak-cal-month-lbl"></span>
          <button class="streak-cal-nav" data-si="${si}" data-dir="1">&#8250;</button>
        </div>
        <div class="streak-calendar"></div>
      </div>
    `;
    list.appendChild(card);

    // Today button
    card.querySelector('.streak-today-btn').addEventListener('click', () => {
      if (!s.days) s.days = [];
      const idx = s.days.indexOf(todayStr);
      if (idx > -1) s.days.splice(idx, 1); else s.days.push(todayStr);
      saveStreaks(); renderStreaks();
    });

    // Nav buttons
    card.querySelectorAll('.streak-cal-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir);
        let m = parseInt(card.dataset.viewMonth) + dir;
        let y = parseInt(card.dataset.viewYear);
        if (m > 11) { m = 0; y++; } else if (m < 0) { m = 11; y--; }
        card.dataset.viewMonth = m; card.dataset.viewYear = y;
        renderStreakCalendar(card, s);
      });
    });

    renderStreakCalendar(card, s);
  });
}

window.deleteStreak = (si) => { streaks.splice(si, 1); saveStreaks(); renderStreaks(); };
document.getElementById('streak-add-btn').addEventListener('click', () => {
  const name = document.getElementById('streak-goal-input').value.trim();
  if (!name) return;
  streaks.push({ name, days: [] });
  saveStreaks(); renderStreaks();
  document.getElementById('streak-goal-input').value = '';
});

// ===================== HATIM (30 Cüz, Sayfa Takibi) =====================
let hatims = JSON.parse(localStorage.getItem('hatims') || '[]');
function saveHatims() { localStorage.setItem('hatims', JSON.stringify(hatims)); }

// Migrate old format (juzs with read/total) to new format (pages array)
hatims = hatims.map(h => {
  if (h.cuzler) return h;
  const cuzler = [];
  for (let i = 1; i <= 30; i++) {
    const total = i === 30 ? 30 : 20;
    const oldRead = (h.juzs && h.juzs[i - 1]) ? h.juzs[i - 1].read : 0;
    const pages = [];
    for (let p = 1; p <= oldRead && p <= total; p++) pages.push(p);
    cuzler.push({ total, pages });
  }
  return { name: h.name, cuzler };
});
saveHatims();

function renderHatimList() {
  const list = document.getElementById('hatim-list'); if (!list) return;
  list.innerHTML = '';
  if (hatims.length === 0) { list.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:10px;">Henüz hatim başlatılmadı.</div>'; return; }
  hatims.forEach((h, hi) => {
    const totalPages = h.cuzler.reduce((s, c) => s + c.total, 0);
    const readPages = h.cuzler.reduce((s, c) => s + c.pages.length, 0);
    const pct = Math.round((readPages / totalPages) * 100);
    const card = document.createElement('div'); card.className = 'habit-card'; card.style.marginBottom = '12px';
    card.innerHTML = `
      <div class="habit-card-top">
        <strong style="font-size:14px;">${h.name}</strong>
        <button onclick="event.stopPropagation();deleteHatim(${hi})" style="background:none;border:none;color:rgba(255,80,80,0.6);cursor:pointer;"><i class="fas fa-trash"></i></button>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin:6px 0;">${readPages} / ${totalPages} sayfa — %${pct}</div>
      <div style="width:100%;background:rgba(255,255,255,0.1);height:5px;border-radius:3px;margin-bottom:10px;"><div style="width:${pct}%;background:var(--neon-green);height:100%;border-radius:3px;"></div></div>
      <div class="hatim-cuz-grid" id="hatim-cuz-grid-${hi}"></div>`;
    list.appendChild(card);
    // render cüz grid
    const grid = document.getElementById(`hatim-cuz-grid-${hi}`);
    h.cuzler.forEach((cuz, ci) => {
      const cp = Math.round((cuz.pages.length / cuz.total) * 100);
      const div = document.createElement('div');
      div.className = 'hatim-cuz-card' + (cuz.pages.length === cuz.total ? ' complete' : '');
      div.innerHTML = `<div class="hatim-cuz-num">${ci + 1}. Cüz</div><div class="hatim-cuz-pct">${cuz.pages.length}/${cuz.total}</div><div class="hatim-cuz-bar" style="width:${cp}%"></div>`;
      div.addEventListener('click', () => openHatimJuzModal(hi, ci));
      grid.appendChild(div);
    });
  });
}

window.deleteHatim = (i) => { if (confirm('Sil?')) { hatims.splice(i, 1); saveHatims(); renderHatimList(); } };
document.getElementById('hatim-create-btn')?.addEventListener('click', () => {
  const name = document.getElementById('hatim-name-input').value.trim();
  if (!name) return;
  const cuzler = [];
  for (let i = 1; i <= 30; i++) cuzler.push({ total: i === 30 ? 30 : 20, pages: [] });
  hatims.push({ name, cuzler }); saveHatims(); renderHatimList();
  document.getElementById('hatim-name-input').value = '';
});

// Hatim Juz Page Modal
let _hjHatimIdx = -1, _hjCuzIdx = -1;
function openHatimJuzModal(hi, ci) {
  _hjHatimIdx = hi; _hjCuzIdx = ci;
  const h = hatims[hi]; const cuz = h.cuzler[ci];
  document.getElementById('hatim-juz-modal-title').textContent = `${h.name} — ${ci + 1}. Cüz (${cuz.total} sayfa)`;
  renderHatimPageGrid();
  document.getElementById('hatim-juz-modal').classList.add('active');
}
function renderHatimPageGrid() {
  const cuz = hatims[_hjHatimIdx].cuzler[_hjCuzIdx];
  const grid = document.getElementById('hatim-page-grid'); grid.innerHTML = '';
  for (let p = 1; p <= cuz.total; p++) {
    const cell = document.createElement('div');
    cell.className = 'hatim-page-cell' + (cuz.pages.includes(p) ? ' read' : '');
    cell.textContent = p;
    cell.addEventListener('click', () => {
      const idx = cuz.pages.indexOf(p);
      if (idx > -1) cuz.pages.splice(idx, 1); else cuz.pages.push(p);
      saveHatims(); renderHatimPageGrid(); updateHatimJuzProgress();
    });
    grid.appendChild(cell);
  }
  updateHatimJuzProgress();
}
function updateHatimJuzProgress() {
  const cuz = hatims[_hjHatimIdx].cuzler[_hjCuzIdx];
  document.getElementById('hatim-juz-progress-text').textContent = `${cuz.pages.length} / ${cuz.total} sayfa okundu`;
}
document.getElementById('hatim-auto-mark-btn').addEventListener('click', () => {
  const n = parseInt(document.getElementById('hatim-auto-pages').value) || 0;
  const cuz = hatims[_hjHatimIdx].cuzler[_hjCuzIdx];
  cuz.pages = [];
  for (let p = 1; p <= Math.min(n, cuz.total); p++) cuz.pages.push(p);
  saveHatims(); renderHatimPageGrid();
  document.getElementById('hatim-auto-pages').value = '';
});
window.closeHatimJuzModal = () => { document.getElementById('hatim-juz-modal').classList.remove('active'); renderHatimList(); };
// keep backward compat
window.openHatimModal = (i) => openHatimJuzModal(i, 0);
window.closeHatimModal = () => closeHatimJuzModal();

// ===================== RIYAZU'S-SALİHİN =====================
const RIYAZU_TOTAL = 1896;
let riyazuReadHadiths = JSON.parse(localStorage.getItem('riyazu_read_hadiths') || '[]');

function renderRiyazu() {
  const readCount = riyazuReadHadiths.length;
  const pct = Math.round((readCount / RIYAZU_TOTAL) * 100);
  document.getElementById('riyazu-read').textContent = readCount;
  document.getElementById('riyazu-bar').style.width = pct + '%';
  document.getElementById('riyazu-pct').textContent = '%' + pct;
}
function saveRiyazu() { localStorage.setItem('riyazu_read_hadiths', JSON.stringify(riyazuReadHadiths)); }

function toggleRiyazuHadith(id) {
  const idx = riyazuReadHadiths.indexOf(id);
  if (idx > -1) riyazuReadHadiths.splice(idx, 1);
  else riyazuReadHadiths.push(id);
  saveRiyazu();
  renderRiyazu();
}

document.getElementById('riyazu-set-btn').addEventListener('click', () => {
  const val = document.getElementById('riyazu-set-val').value.trim();
  if (!val) return;
  const parts = val.split(',').map(s => s.trim());
  let added = false;
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= RIYAZU_TOTAL && !riyazuReadHadiths.includes(i)) { riyazuReadHadiths.push(i); added = true; }
        }
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num) && num >= 1 && num <= RIYAZU_TOTAL && !riyazuReadHadiths.includes(num)) { riyazuReadHadiths.push(num); added = true; }
    }
  });
  if (added) { saveRiyazu(); renderRiyazu(); if (document.getElementById('riyazu-modal').classList.contains('active')) renderRiyazuGrid(); }
  document.getElementById('riyazu-set-val').value = '';
});

let riyazuCurrentGroup = 0;
function openRiyazuModal() {
  renderRiyazuGroups();
  renderRiyazuGrid();
  document.getElementById('riyazu-modal').classList.add('active');
}
window.closeRiyazuModal = () => document.getElementById('riyazu-modal').classList.remove('active');
document.getElementById('riyazu-modal-btn').addEventListener('click', openRiyazuModal);

function renderRiyazuGroups() {
  const container = document.getElementById('riyazu-groups');
  container.innerHTML = '';
  const numGroups = Math.ceil(RIYAZU_TOTAL / 100);
  for (let i = 0; i < numGroups; i++) {
    const start = i * 100 + 1;
    const end = Math.min((i + 1) * 100, RIYAZU_TOTAL);
    const btn = document.createElement('button');
    btn.className = 'riyazu-group-btn' + (riyazuCurrentGroup === i ? ' active' : '');
    btn.textContent = `${start}-${end}`;
    btn.onclick = () => { riyazuCurrentGroup = i; renderRiyazuGroups(); renderRiyazuGrid(); };
    container.appendChild(btn);
  }
}

function renderRiyazuGrid() {
  const grid = document.getElementById('riyazu-grid');
  grid.innerHTML = '';
  const start = riyazuCurrentGroup * 100 + 1;
  const end = Math.min((riyazuCurrentGroup + 1) * 100, RIYAZU_TOTAL);
  for (let i = start; i <= end; i++) {
    const isRead = riyazuReadHadiths.includes(i);
    const cell = document.createElement('div');
    cell.className = 'riyazu-hadith-cell' + (isRead ? ' read' : '');
    cell.textContent = i;
    cell.onclick = () => {
      toggleRiyazuHadith(i);
      cell.classList.toggle('read', riyazuReadHadiths.includes(i));
    };
    grid.appendChild(cell);
  }
}
renderRiyazu();

// ===================== MULK SURESİ =====================
let mulkReads = JSON.parse(localStorage.getItem('mulk_reads') || '[]');
function saveMulkReads() { localStorage.setItem('mulk_reads', JSON.stringify(mulkReads)); }

function renderMulkCalendar() {
  const card = document.getElementById('mulk-card');
  const viewMonth = parseInt(card.dataset.viewMonth !== "" ? card.dataset.viewMonth : new Date().getMonth());
  const viewYear = parseInt(card.dataset.viewYear !== "" ? card.dataset.viewYear : new Date().getFullYear());

  card.dataset.viewMonth = viewMonth;
  card.dataset.viewYear = viewYear;
  document.getElementById('mulk-cal-lbl').textContent = TR_MONTHS_FULL[viewMonth] + ' ' + viewYear;

  const calGrid = document.getElementById('mulk-cal-grid');
  calGrid.innerHTML = '';
  const hdrs = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  hdrs.forEach(h => {
    const el = document.createElement('div'); el.className = 'streak-cal-day-hdr'; el.textContent = h;
    calGrid.appendChild(el);
  });

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = getTodayKey();

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div'); empty.className = 'streak-day streak-day-empty';
    calGrid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewYear, viewMonth, d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    const isDone = mulkReads.includes(dateStr);
    const isToday = dateStr === todayStr;
    const isFuture = dateObj > today;

    const el = document.createElement('div');
    let cls = 'streak-day';
    if (isDone) cls += ' done';
    else if (isFuture) cls += ' future';
    else cls += ' past';
    if (isToday) cls += ' today';
    el.className = cls;
    el.textContent = d;
    el.title = dateStr;

    if (!isFuture) {
      el.addEventListener('click', () => {
        const idx = mulkReads.indexOf(dateStr);
        if (idx > -1) mulkReads.splice(idx, 1); else mulkReads.push(dateStr);
        saveMulkReads(); renderMulkCalendar(); updateMulkTodayBtn();
      });
    }
    calGrid.appendChild(el);
  }
}

function updateMulkTodayBtn() {
  const btn = document.getElementById('mulk-today-btn');
  const todayStr = getTodayKey();
  if (mulkReads.includes(todayStr)) {
    btn.classList.add('done');
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Bugün Okudum ✓';
  } else {
    btn.classList.remove('done');
    btn.innerHTML = '<i class="far fa-circle"></i> Bugün Okudum';
  }
}

document.getElementById('mulk-today-btn').addEventListener('click', () => {
  const todayStr = getTodayKey();
  const idx = mulkReads.indexOf(todayStr);
  if (idx > -1) mulkReads.splice(idx, 1); else mulkReads.push(todayStr);
  saveMulkReads(); updateMulkTodayBtn(); renderMulkCalendar();
});

document.getElementById('mulk-cal-prev').addEventListener('click', () => {
  const card = document.getElementById('mulk-card');
  let m = parseInt(card.dataset.viewMonth) - 1;
  let y = parseInt(card.dataset.viewYear);
  if (m < 0) { m = 11; y--; }
  card.dataset.viewMonth = m; card.dataset.viewYear = y;
  renderMulkCalendar();
});
document.getElementById('mulk-cal-next').addEventListener('click', () => {
  const card = document.getElementById('mulk-card');
  let m = parseInt(card.dataset.viewMonth) + 1;
  let y = parseInt(card.dataset.viewYear);
  if (m > 11) { m = 0; y++; }
  card.dataset.viewMonth = m; card.dataset.viewYear = y;
  renderMulkCalendar();
});

updateMulkTodayBtn();
renderMulkCalendar();

// ===================== QURAN MEMORIZATION =====================
const QURAN_SURAHS = [
  { "name": "Fâtiha", "ayahs": 7 }, { "name": "Bakara", "ayahs": 286 }, { "name": "Âl-i İmrân", "ayahs": 200 }, { "name": "Nisâ", "ayahs": 176 },
  { "name": "Mâide", "ayahs": 120 }, { "name": "En'âm", "ayahs": 165 }, { "name": "A'râf", "ayahs": 206 }, { "name": "Enfâl", "ayahs": 75 },
  { "name": "Tevbe", "ayahs": 129 }, { "name": "Yûnus", "ayahs": 109 }, { "name": "Hûd", "ayahs": 123 }, { "name": "Yûsuf", "ayahs": 111 },
  { "name": "Ra'd", "ayahs": 43 }, { "name": "İbrâhîm", "ayahs": 52 }, { "name": "Hicr", "ayahs": 99 }, { "name": "Nahl", "ayahs": 128 },
  { "name": "İsrâ", "ayahs": 111 }, { "name": "Kehf", "ayahs": 110 }, { "name": "Meryem", "ayahs": 98 }, { "name": "Tâhâ", "ayahs": 135 },
  { "name": "Enbiyâ", "ayahs": 112 }, { "name": "Hac", "ayahs": 78 }, { "name": "Mü'minûn", "ayahs": 118 }, { "name": "Nûr", "ayahs": 64 },
  { "name": "Furkan", "ayahs": 77 }, { "name": "Şu'arâ", "ayahs": 227 }, { "name": "Neml", "ayahs": 93 }, { "name": "Kasas", "ayahs": 88 },
  { "name": "Ankebût", "ayahs": 69 }, { "name": "Rûm", "ayahs": 60 }, { "name": "Lokmân", "ayahs": 34 }, { "name": "Secde", "ayahs": 30 },
  { "name": "Ahzâb", "ayahs": 73 }, { "name": "Sebe'", "ayahs": 54 }, { "name": "Fâtır", "ayahs": 45 }, { "name": "Yâsîn", "ayahs": 83 },
  { "name": "Sâffât", "ayahs": 182 }, { "name": "Sâd", "ayahs": 88 }, { "name": "Zümer", "ayahs": 75 }, { "name": "Mü'min", "ayahs": 85 },
  { "name": "Fussilet", "ayahs": 54 }, { "name": "Şûrâ", "ayahs": 53 }, { "name": "Zuhruf", "ayahs": 89 }, { "name": "Duhân", "ayahs": 59 },
  { "name": "Câsiye", "ayahs": 37 }, { "name": "Ahkâf", "ayahs": 35 }, { "name": "Muhammed", "ayahs": 38 }, { "name": "Fetih", "ayahs": 29 },
  { "name": "Hucurât", "ayahs": 18 }, { "name": "Kâf", "ayahs": 45 }, { "name": "Zâriyât", "ayahs": 60 }, { "name": "Tûr", "ayahs": 49 },
  { "name": "Necm", "ayahs": 62 }, { "name": "Kamer", "ayahs": 55 }, { "name": "Rahmân", "ayahs": 78 }, { "name": "Vâkıa", "ayahs": 96 },
  { "name": "Hadîd", "ayahs": 29 }, { "name": "Mücâdele", "ayahs": 22 }, { "name": "Haşr", "ayahs": 24 }, { "name": "Mümtehine", "ayahs": 13 },
  { "name": "Saff", "ayahs": 14 }, { "name": "Cuma", "ayahs": 11 }, { "name": "Münâfikûn", "ayahs": 11 }, { "name": "Tegâbün", "ayahs": 18 },
  { "name": "Talâk", "ayahs": 12 }, { "name": "Tahrîm", "ayahs": 12 }, { "name": "Mülk", "ayahs": 30 }, { "name": "Kalem", "ayahs": 52 },
  { "name": "Hâkka", "ayahs": 52 }, { "name": "Meâric", "ayahs": 44 }, { "name": "Nûh", "ayahs": 28 }, { "name": "Cin", "ayahs": 28 },
  { "name": "Müzzemmil", "ayahs": 20 }, { "name": "Müddessir", "ayahs": 56 }, { "name": "Kıyâme", "ayahs": 40 }, { "name": "İnsân", "ayahs": 31 },
  { "name": "Mürselât", "ayahs": 50 }, { "name": "Nebe", "ayahs": 40 }, { "name": "Nâziât", "ayahs": 46 }, { "name": "Abese", "ayahs": 42 },
  { "name": "Tekvîr", "ayahs": 29 }, { "name": "İnfitâr", "ayahs": 19 }, { "name": "Mutaffifîn", "ayahs": 36 }, { "name": "İnşikâk", "ayahs": 25 },
  { "name": "Bürûc", "ayahs": 22 }, { "name": "Târık", "ayahs": 17 }, { "name": "A'lâ", "ayahs": 19 }, { "name": "Gâşiye", "ayahs": 26 },
  { "name": "Fecr", "ayahs": 30 }, { "name": "Beled", "ayahs": 20 }, { "name": "Şems", "ayahs": 15 }, { "name": "Leyl", "ayahs": 21 },
  { "name": "Duhâ", "ayahs": 11 }, { "name": "İnşirâh", "ayahs": 8 }, { "name": "Tîn", "ayahs": 8 }, { "name": "Alak", "ayahs": 19 },
  { "name": "Kadir", "ayahs": 5 }, { "name": "Beyyine", "ayahs": 8 }, { "name": "Zilzâl", "ayahs": 8 }, { "name": "Âdiyât", "ayahs": 11 },
  { "name": "Kâria", "ayahs": 11 }, { "name": "Tekâsür", "ayahs": 8 }, { "name": "Asr", "ayahs": 3 }, { "name": "Hümeze", "ayahs": 9 },
  { "name": "Fîl", "ayahs": 5 }, { "name": "Kureyş", "ayahs": 4 }, { "name": "Mâûn", "ayahs": 7 }, { "name": "Kevser", "ayahs": 3 },
  { "name": "Kâfirûn", "ayahs": 6 }, { "name": "Nasr", "ayahs": 3 }, { "name": "Tebbet", "ayahs": 5 }, { "name": "İhlâs", "ayahs": 4 },
  { "name": "Felak", "ayahs": 5 }, { "name": "Nâs", "ayahs": 6 }
];

let quranMemo = JSON.parse(localStorage.getItem('quran_memorization') || '{}');
function saveQuranMemo() { localStorage.setItem('quran_memorization', JSON.stringify(quranMemo)); updateQuranSummary(); }

function getSurahMemoPct(sIdx) {
  const ayahs = QURAN_SURAHS[sIdx].ayahs;
  const memoData = quranMemo[sIdx] || {};
  let ezberCount = 0;
  for (let i = 1; i <= ayahs; i++) {
    if (memoData[i] === 'ezberlendi') ezberCount++;
  }
  return Math.round((ezberCount / ayahs) * 100);
}

function updateQuranSummary() {
  let totalAyahs = 0, ezberCount = 0, tekrarCount = 0, azCount = 0;
  QURAN_SURAHS.forEach((s, idx) => {
    totalAyahs += s.ayahs;
    const memoData = quranMemo[idx] || {};
    for (let i = 1; i <= s.ayahs; i++) {
      const st = memoData[i];
      if (st === 'ezberlendi') ezberCount++;
      else if (st === 'tekrar') tekrarCount++;
      else if (st === 'az') azCount++;
    }
  });
  const pct = Math.round((ezberCount / totalAyahs) * 100);
  const el = document.getElementById('quran-memorize-summary');
  if (el) el.textContent = `Ezber: %${pct} ✅${ezberCount} 🟡${tekrarCount} 🔴${azCount} / ${totalAyahs} Ayet`;
}
updateQuranSummary();

document.getElementById('quran-memorize-btn').addEventListener('click', () => {
  renderQuranSurahList();
  document.getElementById('quran-surah-list-modal').classList.add('active');
});
window.closeSurahListModal = () => document.getElementById('quran-surah-list-modal').classList.remove('active');

function renderQuranSurahList() {
  const list = document.getElementById('quran-surah-list');
  list.innerHTML = '';
  QURAN_SURAHS.forEach((s, idx) => {
    const pct = getSurahMemoPct(idx);
    const item = document.createElement('div');
    item.className = 'quran-surah-item';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:15px;">
        <div style="width:30px;height:30px;background:rgba(255,255,255,0.1);border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:12px;">${idx + 1}</div>
        <div>
          <div style="font-weight:600;">${s.name}</div>
          <div style="font-size:11px;color:var(--text-secondary);">${s.ayahs} Ayet</div>
        </div>
      </div>
      <div style="color:${pct === 100 ? 'var(--neon-green)' : 'var(--text-secondary)'};font-size:13px;font-weight:600;">%${pct}</div>
    `;
    item.addEventListener('click', () => openQuranAyahGrid(idx));
    list.appendChild(item);
  });
}

let activeSurahIdx = -1;
window.openQuranAyahGrid = (idx) => {
  activeSurahIdx = idx;
  document.getElementById('quran-surah-list-modal').classList.remove('active');
  document.getElementById('quran-ayah-modal-title').textContent = `${QURAN_SURAHS[idx].name} Suresi`;
  renderQuranAyahGrid();
  document.getElementById('quran-ayah-grid-modal').classList.add('active');
};
window.closeAyahGridModal = () => document.getElementById('quran-ayah-grid-modal').classList.remove('active');
window.backToSurahList = () => {
  closeAyahGridModal();
  renderQuranSurahList();
  document.getElementById('quran-surah-list-modal').classList.add('active');
};

function renderQuranAyahGrid() {
  // Taze veriyi her seferinde localStorage'dan oku
  quranMemo = JSON.parse(localStorage.getItem('quran_memorization') || '{}');
  const grid = document.getElementById('quran-ayah-grid');
  grid.innerHTML = '';
  const s = QURAN_SURAHS[activeSurahIdx];
  const memoData = quranMemo[activeSurahIdx] || {};

  // Döngü sırası: bos -> ezberlendi -> tekrar -> az -> bos
  const CYCLE = [null, 'ezberlendi', 'tekrar', 'az'];

  for (let i = 1; i <= s.ayahs; i++) {
    const status = memoData[i] || null;
    const cell = document.createElement('div');
    let cls = 'quran-ayah-cell';
    if (status === 'ezberlendi') cls += ' status-ezberlendi';
    else if (status === 'tekrar') cls += ' status-tekrar';
    else if (status === 'az') cls += ' status-az';
    cell.className = cls;
    cell.textContent = i;

    cell.onclick = () => {
      const cur = quranMemo[activeSurahIdx]?.[i] || null;
      const curIdx = CYCLE.indexOf(cur);
      const nextStatus = CYCLE[(curIdx + 1) % CYCLE.length];

      if (!quranMemo[activeSurahIdx]) quranMemo[activeSurahIdx] = {};
      if (nextStatus === null) delete quranMemo[activeSurahIdx][i];
      else quranMemo[activeSurahIdx][i] = nextStatus;

      saveQuranMemo();
      renderQuranAyahGrid();
    };

    grid.appendChild(cell);
  }
}

// ===================== AGENDA =====================
const TR_DAYS_LONG = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
let agendaWeekOffset = 0; // 0 = this week
let agendaOpenDate = null;

function getWeekDates(offset) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(d); }
  return days;
}
function agendaKey(date) { return 'agenda_' + date.toISOString().slice(0, 10); }
function getAgendaData(date) { return JSON.parse(localStorage.getItem(agendaKey(date)) || '{"note":"","tasks":[]}'); }
function saveAgendaData(date, data) { localStorage.setItem(agendaKey(date), JSON.stringify(data)); }

function renderAgenda() {
  const days = getWeekDates(agendaWeekOffset);
  const todayStr = new Date().toISOString().slice(0, 10);
  const first = days[0], last = days[6];
  document.getElementById('agenda-week-label').textContent =
    `${first.getDate()} ${TR_MONTHS_SHORT[first.getMonth()]} — ${last.getDate()} ${TR_MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  const container = document.getElementById('agenda-days'); container.innerHTML = '';
  days.forEach(d => {
    const ds = d.toISOString().slice(0, 10);
    const data = getAgendaData(d);
    const isToday = ds === todayStr;
    const tasksDone = data.tasks.filter(t => t.done).length;
    const tasksTotal = data.tasks.length;
    const preview = data.note ? data.note.slice(0, 40) : (tasksTotal ? `${tasksDone}/${tasksTotal} görev` : '');
    const card = document.createElement('div');
    card.className = 'agenda-day-card' + (isToday ? ' today' : '');
    card.innerHTML = `
      <div class="agenda-day-name">${TR_DAYS_LONG[d.getDay()].slice(0, 3)}</div>
      <div><div style="font-size:13px;font-weight:600;color:${isToday ? 'var(--neon-green)' : '#fff'};">${d.getDate()} ${TR_MONTHS_SHORT[d.getMonth()]}</div><div class="agenda-day-date">${d.getFullYear()}</div></div>
      <div class="agenda-day-preview">${preview}</div>
      ${tasksTotal > 0 ? `<div class="agenda-day-badge">${tasksDone}/${tasksTotal}</div>` : ''}`;
    card.addEventListener('click', () => openAgendaDay(d));
    container.appendChild(card);
  });
}

document.getElementById('agenda-prev').addEventListener('click', () => { agendaWeekOffset--; renderAgenda(); });
document.getElementById('agenda-next').addEventListener('click', () => { agendaWeekOffset++; renderAgenda(); });

let agendaGridMode = localStorage.getItem('agenda_grid_mode') === 'true';
const agendaDaysContainer = document.getElementById('agenda-days');
if (agendaGridMode && agendaDaysContainer) agendaDaysContainer.classList.add('grid-mode');

document.getElementById('agenda-grid-toggle')?.addEventListener('click', () => {
  agendaGridMode = !agendaGridMode;
  localStorage.setItem('agenda_grid_mode', agendaGridMode);
  if (agendaDaysContainer) {
    if (agendaGridMode) agendaDaysContainer.classList.add('grid-mode');
    else agendaDaysContainer.classList.remove('grid-mode');
  }
});

function openAgendaDay(date) {
  agendaOpenDate = date;
  const ds = date.toISOString().slice(0, 10);
  const dd = String(date.getDate()).padStart(2, '0'), mm = String(date.getMonth() + 1).padStart(2, '0');
  document.getElementById('agenda-modal-date').textContent = `${TR_DAYS_LONG[date.getDay()]}, ${dd}-${mm}-${date.getFullYear()}`;
  const data = getAgendaData(date);
  const editor = document.getElementById('agenda-note-editor');
  if (editor) editor.innerHTML = data.note || '';
  renderAgendaTasks(data.tasks);
  document.getElementById('agenda-day-modal').classList.add('active');
}

let notebookMode = localStorage.getItem('agenda_notebook_mode') === 'true';
const notebookWrapper = document.getElementById('agenda-notebook-wrapper');
if (notebookMode && notebookWrapper) notebookWrapper.classList.add('notebook-mode');

document.getElementById('agenda-notebook-toggle')?.addEventListener('click', () => {
  notebookMode = !notebookMode;
  localStorage.setItem('agenda_notebook_mode', notebookMode);
  if (notebookWrapper) {
    if (notebookMode) notebookWrapper.classList.add('notebook-mode');
    else notebookWrapper.classList.remove('notebook-mode');
  }
});

function renderAgendaTasks(tasks) {
  const list = document.getElementById('agenda-task-list'); list.innerHTML = '';
  tasks.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'agenda-task-item';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '10px';
    item.style.marginBottom = '8px';

    let reminderHtml = '';
    if (t.reminder) {
      try {
        const rDate = new Date(t.reminder);
        if (!isNaN(rDate.getTime())) {
          const formattedReminder = `${rDate.getDate()} ${TR_MONTHS_SHORT[rDate.getMonth()]} ${String(rDate.getHours()).padStart(2, '0')}:${String(rDate.getMinutes()).padStart(2, '0')}`;
          reminderHtml = `<span style="font-size:10px; color:var(--neon-green); margin-left:8px; display:inline-flex; align-items:center; gap:3px; background:rgba(57,255,20,0.1); padding:2px 6px; border-radius:4px; border:1px solid rgba(57,255,20,0.25);" title="Hatırlatıcı"><i class="fas fa-bell"></i> ${formattedReminder}</span>`;
        }
      } catch (e) {
        console.error(e);
      }
    }

    item.innerHTML = `
      <div style="cursor:pointer; color:${t.done ? 'var(--neon-green)' : 'var(--text-secondary)'}; font-size:16px;" onclick="toggleAgendaTask(${i})">
          <i class="${t.done ? 'fas fa-check-square' : 'far fa-square'}"></i>
      </div>
      <span style="flex:1; font-size:14px; transition:0.3s; ${t.done ? 'text-decoration:line-through; color:var(--text-secondary); opacity:0.6;' : 'color:var(--text-primary);'}">
        ${t.text}
        ${reminderHtml}
      </span>
      <button class="agenda-task-del" style="background:none;border:none;color:#ff5050;cursor:pointer;" onclick="deleteAgendaTask(${i})"><i class="fas fa-times"></i></button>`;
    list.appendChild(item);
  });
}

window.toggleAgendaTask = (i) => { const d = getAgendaData(agendaOpenDate); d.tasks[i].done = !d.tasks[i].done; saveAgendaData(agendaOpenDate, d); renderAgendaTasks(d.tasks); renderAgenda(); };
window.deleteAgendaTask = (i) => { const d = getAgendaData(agendaOpenDate); d.tasks.splice(i, 1); saveAgendaData(agendaOpenDate, d); renderAgendaTasks(d.tasks); renderAgenda(); };

document.getElementById('agenda-task-add-btn').addEventListener('click', () => {
  const input = document.getElementById('agenda-task-input');
  const text = input.value.trim(); if (!text) return;
  const reminderInput = document.getElementById('agenda-task-reminder');
  const reminder = reminderInput ? reminderInput.value : '';
  const d = getAgendaData(agendaOpenDate);
  d.tasks.push({ text, done: false, reminder, notified: false });
  saveAgendaData(agendaOpenDate, d);
  renderAgendaTasks(d.tasks);
  input.value = '';
  if (reminderInput) reminderInput.value = '';
  if (reminder && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
});
document.getElementById('agenda-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('agenda-task-add-btn').click(); });

window.saveAgendaDay = () => {
  const d = getAgendaData(agendaOpenDate);
  const editor = document.getElementById('agenda-note-editor');
  if (editor) d.note = editor.innerHTML;
  saveAgendaData(agendaOpenDate, d);
  document.getElementById('agenda-day-modal').classList.remove('active');
  renderAgenda();
};
window.closeAgendaModal = () => { document.getElementById('agenda-day-modal').classList.remove('active'); };

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    o.start();
    o.stop(ctx.currentTime + 0.16);
    
    setTimeout(() => {
      try {
        const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx2.state === 'suspended') ctx2.resume();
        const o2 = ctx2.createOscillator();
        const g2 = ctx2.createGain();
        o2.connect(g2);
        g2.connect(ctx2.destination);
        o2.type = 'sine';
        o2.frequency.setValueAtTime(1046.50, ctx2.currentTime);
        g2.gain.setValueAtTime(0.15, ctx2.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.25);
        o2.start();
        o2.stop(ctx2.currentTime + 0.26);
      } catch (err) {}
    }, 150);
  } catch (e) {
    console.error("Audio synthesization error:", e);
  }
}

function triggerLocalNotification(taskText) {
  playNotificationSound();
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Sa'y Hatırlatıcı", {
        body: taskText,
        icon: 'logo.png'
      });
    } else {
      console.log("Notification permission not granted for reminder:", taskText);
    }
  }
}

function checkAgendaReminders() {
  const now = Date.now();
  let modified = false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('agenda_')) {
      let d;
      try {
        d = JSON.parse(localStorage.getItem(key) || '{"note":"","tasks":[]}');
      } catch (e) {
        continue;
      }
      if (!d || !d.tasks || !Array.isArray(d.tasks)) continue;
      
      let keyModified = false;
      d.tasks.forEach(task => {
        if (task.reminder && !task.done && !task.notified) {
          const rTime = new Date(task.reminder).getTime();
          if (!isNaN(rTime) && now >= rTime) {
            task.notified = true;
            keyModified = true;
            modified = true;
            triggerLocalNotification(task.text);
          }
        }
      });
      
      if (keyModified) {
        localStorage.setItem(key, JSON.stringify(d));
        if (agendaOpenDate && agendaKey(agendaOpenDate) === key) {
          renderAgendaTasks(d.tasks);
        }
      }
    }
  }
  if (modified) {
    renderAgenda();
  }
}
setInterval(checkAgendaReminders, 30000); // Check every 30 seconds

// Fullscreen
const fsOverlay = document.getElementById('fs-overlay');
const fsToggleBtn = document.getElementById('fs-toggle-btn');
const fsCloseBtn = document.getElementById('fs-close-btn');
const fsTimeContainer = document.getElementById('fs-time-container');
const fsThemeDisplay = document.getElementById('fs-theme-display');

const fsThemes = ['neon', 'dynamic', 'clean', 'glass', 'retro'];
let currentFsThemeIdx = 0;

if (fsThemeDisplay) {
  fsThemeDisplay.addEventListener('click', (e) => {
    if (e.target === fsThemeDisplay || e.target.classList.contains('fs-time') || e.target.parentElement.id === 'fs-time-container') {
      currentFsThemeIdx = (currentFsThemeIdx + 1) % fsThemes.length;
      const theme = fsThemes[currentFsThemeIdx];
      fsThemeDisplay.className = `fs-theme-${theme}`;
      fsThemeDisplay.dataset.theme = theme;
    }
  });
}

fsToggleBtn.addEventListener('click', () => {
  fsOverlay.classList.remove('hidden-overlay');
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { });
  setInterval(() => {
    const activeView = document.querySelector('.view.active');
    let ms = 0;
    if (activeView && activeView.id === 'stopwatch-view') ms = swElapsed;
    else if (activeView && activeView.id === 'timer-view') ms = tmRemaining;
    else if (activeView && activeView.id === 'pomodoro-view') ms = pmCurrent;
    fsTimeContainer.innerHTML = `<div class="fs-time">${formatTime(ms, false)}</div>`;
  }, 500);
});
fsCloseBtn.addEventListener('click', () => { fsOverlay.classList.add('hidden-overlay'); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); });

// Settings
const userSettings = JSON.parse(localStorage.getItem('app_settings') || '{"color":"#39ff14", "glow":"rgba(57,255,20,0.3)", "bg":"bg.png", "bgColor":"#0a0a0a", "bgType":"dark", "font":"\'Inter\', sans-serif", "fontSize":"16px", "logoData":""}');

function applySettings() {
  document.documentElement.style.setProperty('--neon-green', userSettings.color);
  document.documentElement.style.setProperty('--neon-green-glow', userSettings.glow);

  // Apply background
  if (userSettings.bg !== "none") {
    document.body.style.backgroundImage = `url('${userSettings.bg}')`;
    document.body.style.backgroundColor = userSettings.bgColor;
  } else {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = userSettings.bgColor;
  }

  // Light/dark mode
  if (userSettings.bgType === 'light') {
    document.body.classList.add('light-mode');
    // Also set --text-primary / --text-secondary for light mode readability
    document.documentElement.style.setProperty('--text-primary', '#111111');
    document.documentElement.style.setProperty('--text-secondary', 'rgba(0,0,0,0.6)');
    document.documentElement.style.setProperty('--surface-color', 'rgba(255,255,255,0.95)');
  } else {
    document.body.classList.remove('light-mode');
    document.documentElement.style.setProperty('--text-primary', '#ffffff');
    document.documentElement.style.setProperty('--text-secondary', 'rgba(255,255,255,0.6)');
    document.documentElement.style.setProperty('--surface-color', 'rgba(20,20,20,0.6)');
  }

  document.body.style.fontFamily = userSettings.font;
  // Apply font size to :root so rem/em cascade everywhere
  document.documentElement.style.fontSize = userSettings.fontSize || '16px';

  const appLogo = document.getElementById('app-logo-img');
  const settingsLogo = document.getElementById('settings-logo-preview');
  if (userSettings.logoData && userSettings.logoData.length > 0) {
    if (appLogo) { appLogo.src = userSettings.logoData; appLogo.style.display = 'block'; }
    if (settingsLogo) { settingsLogo.src = userSettings.logoData; settingsLogo.style.display = 'block'; }
  }
}
function saveSettings() { localStorage.setItem('app_settings', JSON.stringify(userSettings)); applySettings(); }
applySettings();

const logoUpload = document.getElementById('logo-upload');
if (logoUpload) {
  logoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      userSettings.logoData = ev.target.result;
      saveSettings();
    };
    reader.readAsDataURL(file);
  });
}

document.querySelectorAll('.color-swatch').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    userSettings.color = el.dataset.color;
    userSettings.glow = el.dataset.glow;
    saveSettings();
  });
  if (el.dataset.color === userSettings.color) { document.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('active')); el.classList.add('active'); }
});

document.querySelectorAll('.bg-swatch').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.bg-swatch').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    userSettings.bg = el.dataset.bg;
    userSettings.bgColor = el.dataset.color;
    userSettings.bgType = el.dataset.type;
    saveSettings();
  });
  if (el.dataset.bg === userSettings.bg && el.dataset.color === userSettings.bgColor) { document.querySelectorAll('.bg-swatch').forEach(x => x.classList.remove('active')); el.classList.add('active'); }
});

const fontSelect = document.getElementById('font-select');
if (fontSelect) {
  fontSelect.value = userSettings.font;
  fontSelect.addEventListener('change', () => { userSettings.font = fontSelect.value; saveSettings(); });
}

const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeVal = document.getElementById('font-size-val');
if (fontSizeSlider) {
  fontSizeSlider.value = parseInt(userSettings.fontSize) || 16;
  fontSizeVal.textContent = fontSizeSlider.value + "px";
  fontSizeSlider.addEventListener('input', () => {
    userSettings.fontSize = fontSizeSlider.value + "px";
    fontSizeVal.textContent = userSettings.fontSize;
    document.documentElement.style.fontSize = userSettings.fontSize;
    saveSettings();
  });
}

// ===================== 100 HADITH MEMORIZATION =====================
const HADITH_MEMORIZATION_POOL = [
  { id: 1, arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ أَمْرِهِ مَا نَوَى", turkish: "Ameller niyetlere göredir ve her kişi için niyet ettiği şey vardır.", source: "Buhari - Müslim" },
  { id: 2, arabic: "الْحَيَاءُ مِنَ الْإِيمَانِ", turkish: "Haya, imandandır.", source: "Buhari - Müslim" },
  { id: 3, arabic: "الْمَرْءُ مَعَ مَنْ أَحَبَّ", turkish: "Kişi, sevdiği ile beraberdir.", source: "Buhari - Müslim" },
  { id: 4, arabic: "لَا يَدْخُلُ الْجَنَّةَ نَمَّامٌ", turkish: "Söz taşıyan kişi, Cennet'e giremez.", source: "Müslim" },
  { id: 5, arabic: "مَنْ غَشَّنَا فَلَيْسَ مِنَّا", turkish: "Bizi aldatan, bizden değildir.", source: "Müslim" },
  { id: 6, arabic: "الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ", turkish: "Güzel söz, sadakadır.", source: "Buhari - Müslim" },
  { id: 7, arabic: "قُلْ آمَنْتُ بِاللَّهِ فَاسْتَقِمْ", turkish: "De ki; Allah'a iman ettim, sonra dosdoğru ol.", source: "Müslim" },
  { id: 8, arabic: "الْمُؤْمِنُ مِرْآةُ الْمُؤْمِنِ", turkish: "Mü'min, mü'minin aynasıdır.", source: "Ebu Davud" },
  { id: 9, arabic: "لَا ضَرَرَ وَلَا ضِرَارَ", turkish: "İslâm'da zarar vermek ve zarara zararla karşılık vermek yoktur.", source: "İbn Mace" },
  { id: 10, arabic: "أَنْزِلُوا النَّاسَ مَنَازِلَهُمْ", turkish: "İnsanlara konumlarına göre muamelede bulunun.", source: "Ebu Davud" },
  { id: 11, arabic: "إِنَّ مِنْ خِيَارِكُمْ أَحْسَنَكُمْ أَخْلَاقًا", turkish: "Şüphesiz en seçkininiz, ahlaken en iyi olanınızdır.", source: "Buhari" },
  { id: 12, arabic: "مَنْ تَشَبَّهَ بِقَوْمٍ فَهُوَ مِنْهُمْ", turkish: "Kim, kendini bir kavme benzetirse o, onlardandır.", source: "Ebu Davud" },
  { id: 13, arabic: "الْحَيَاءُ شُعْبَةٌ مِنَ الْإِيمَانِ", turkish: "Haya, imandan bir parçadır.", source: "Buhari - Müslim" },
  { id: 14, arabic: "لَا تُمَارِ أَخَاكَ وَلَا تُمَازِحْهُ", turkish: "Kardeşinle tartışma ve onunla -cedel açısından- şakalaşma.", source: "Ebu Davud" },
  { id: 15, arabic: "إِذَا لَمْ تَسْتَحِ فَاصْنَعْ مَا شِئْتَ", turkish: "Utanmadığın zaman dilediğini -günahı- yap.", source: "Buhari - Müslim" },
  { id: 16, arabic: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ", turkish: "Kardeşinin yüzüne gülmen, sadakadır.", source: "Tirmizi" },
  { id: 17, arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ", turkish: "En hayırlınız, Kur'ân'ı öğrenen ve öğreteninizdir.", source: "Buhari" },
  { id: 18, arabic: "الْيَدُ الْعُلْيَا خَيْرٌ مِنَ الْيَدِ السُّفْلَى", turkish: "Üstün el (veren el), alçak elden (alan elden) hayırlıdır.", source: "Buhari" },
  { id: 19, arabic: "تَسَحَّرُوا فَإِنَّ فِي السَّحُورِ بَرَكَةً", turkish: "Sahur yapınız, zira sahur yapmada bereket vardır.", source: "Buhari" },
  { id: 20, arabic: "مَنْ لَمْ يَشْكُرِ النَّاسَ لَمْ يَشْكُرِ اللَّهَ", turkish: "(İyiliklerine karşın) insanlara teşekkür etmeyen kişi, (nimetinden ötürü) Allah'a da şükretmez.", source: "Tirmizi" },
  { id: 21, arabic: "مَنْ رَغِبَ عَنْ سُنَّتِي فَلَيْسَ مِنِّي", turkish: "Sünnetimden yüz çeviren, benden değildir.", source: "Müslim" },
  { id: 22, arabic: "الدُّنْيَا سِجْنُ الْمُؤْمِنِ وَجَنَّةُ الْكَافِرِ", turkish: "Dünya, müminin zindanı, kafirin ise cennetidir.", source: "Müslim" },
  { id: 23, arabic: "إِنَّمَا الصَّبْرُ عِنْدَ الصَّدْمَةِ الْأُولَى", turkish: "Sabır, musibetin ilk demlerinde gösterilir.", source: "Buhari - Müslim" },
  { id: 24, arabic: "لَا يُلْدَغُ الْمُؤْمِنُ مِنْ جُحْرٍ وَاحِدٍ مَرَّتَيْنِ", turkish: "Mü'min, aynı delikten iki defa ısırılmaz.", source: "Buhari - Müslim" },
  { id: 25, arabic: "مَنْ لَمْ يَرْحَمِ النَّاسَ لَا يَرْحَمْهُ اللَّهُ", turkish: "İnsanlara merhamet etmeyen kişiye Allah da merhamet etmez.", source: "Buhari - Müslim" },
  { id: 26, arabic: "التَّائِبُ مِنَ الذَّنْبِ كَمَنْ لَا ذَنْبَ لَهُ", turkish: "Günahından tevbe eden kişi, günahı olmayan kişi gibidir.", source: "Ebu Davud" },
  { id: 27, arabic: "إِنَّ لِكُلِّ أُمَّةٍ فِتْنَةً، وَفِتْنَةُ أُمَّتِي الْمَالُ", turkish: "Her ümmetin bir fitnesi vardır. Benim ümmetimin fitnesi ise dünya malıdır.", source: "Tirmizi" },
  { id: 28, arabic: "كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْؤُولٌ عَنْ رَعِيَّتِهِ", turkish: "Hepiniz çobansınız ve hepiniz güttüğünüzden mesulsunuz.", source: "Buhari - Müslim" },
  { id: 29, arabic: "الْمُهَاجِرُ مَنْ هَاجَرَ مَا نَهَى اللَّهُ عَنْهُ", turkish: "Mühacir, Allah'ın nehyettiği şeylerden hicret eden kişidir.", source: "Buhari - Müslim" },
  { id: 30, arabic: "مَا مَلَأَ ابْنُ آدَمَ وِعَاءً شَرًّا مِنْ بَطْنِهِ", turkish: "Ademoğlu, karnından daha şerli bir kabı doldurmuş değildir.", source: "Müsned, Ahmed" },
  { id: 31, arabic: "طُوبَى لِمَنْ طَالَ عُمْرُهُ وَحَسُنَ عَمَلُهُ", turkish: "Ömrü uzayıp ameli güzel olan kişiye müjdeler ola!", source: "Camiu's-sağîr" },
  { id: 32, arabic: "لَا طَاعَةَ فِي مَعْصِيَةِ اللَّهِ", turkish: "Allah'a karşı günaha sürükleyen şeylerde itaat yoktur.", source: "Müslim" },
  { id: 33, arabic: "كُلُّ خُطْوَةٍ تَمْشِيهَا إِلَى الصَّلَاةِ صَدَقَةٌ", turkish: "Kendisi ile yürüyüp namaz için attığın her adım bir sadakadır.", source: "Buhari - Müslim" },
  { id: 34, arabic: "مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ", turkish: "Her kim hayra teşvik ederse, o hayrı yapan kişinin kazanacağı ecrin aynısı, kendisi için de vardır.", source: "Müslim" },
  { id: 35, arabic: "إِيَّاكُمْ وَالظَّنَّ فَإِنَّ الظَّنَّ أَكْذَبُ الْحَدِيثِ", turkish: "Zandan sakınınız! Muhakkak ki zan, sözün en yalanıdır.", source: "Buhari - Müslim" },
  { id: 36, arabic: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ", turkish: "Allah'a amelin en sevimlisi, az da olsa devamlı olanıdır.", source: "Buhari - Müslim" },
  { id: 37, arabic: "يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا", turkish: "Kolaylaştırınız, zorlaştırmayınız; müjdeleyiniz, nefret ettirmeyiniz.", source: "Buhari - Müslim" },
  { id: 38, arabic: "لَا يَدْخُلُ الْجَنَّةَ مَنْ لَا يَأْمَنُ جَارُهُ بَوَائِقَهُ", turkish: "Komşusunun, şerrinden emin olmadığı kimse, Cennet'e girmez.", source: "Buhari - Müslim" },
  { id: 39, arabic: "الْمُسْلِمُ أَخُو الْمُسْلِمِ لَا يَظْلِمُهُ وَلَا يَخْذُلُهُ", turkish: "Müslüman, Müslümanın kardeşidir; ona zulmetmez ve onu rezil etmez.", source: "Müslim" },
  { id: 40, arabic: "مَنْ عَيَّرَ أَخَاهُ بِذَنْبٍ لَمْ يَمَتْ حَتَّى يَعْمَلَهُ", turkish: "Kim, kardeşini bir günahla ayıplarsa, o günahı işlemeden ölmez.", source: "Tirmizi" },
  { id: 41, arabic: "إِتَّقُوا فِرَاسَةَ الْمُؤْمِنِ فَإِنَّهُ يَنْظُرُ بِنُورِ اللَّهِ", turkish: "Mü'minin ferasetinden korkunuz! Muhakkak o, Allah'ın nuruyla nazar eder.", source: "Tirmizi" },
  { id: 42, arabic: "لَا يَحِلُّ لِلْمُسْلِمِ أَنْ يَهْجُرَ أَخَاهُ فَوْقَ ثَلَاثٍ", turkish: "Müslümanların, kardeşiyle üç günden fazla küs kalması helâl değildir.", source: "Buhari - Müslim" },
  { id: 43, arabic: "كَفَى بِالْمَرْءِ كَذِبًا أَنْ يُحَدِّثَ بِكُلِّ مَا سَمِعَ", turkish: "İşittiği her şeyi konuşması, kişiye yalan olarak yeter.", source: "Müslim" },
  { id: 44, arabic: "أَعْطُوا الْأَجِيرَ أَجْرَهُ قَبْلَ أَنْ يَجِفَّ عَرَقُهُ", turkish: "İşçinin teri kurumadan ona ücretini veriniz.", source: "Tirmizi" },
  { id: 45, arabic: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ", turkish: "Müslüman, diğer Müslümanların kendisinin elinden ve dilinden sağlam kaldığı kimsedir.", source: "Buhari - Müslim" },
  { id: 46, arabic: "مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ", turkish: "Kendisini alakadar etmeyen işleri terk etmesi, kişinin islâmının güzelliğindendir.", source: "Tirmizi" },
  { id: 47, arabic: "لَيْسَ شَيْءٌ أَكْرَمَ عَلَى اللَّهِ تَعَالَى مِنَ الدُّعَاءِ", turkish: "Allah için duadan daha değerli hiçbir şey yoktur.", source: "Tirmizi" },
  { id: 48, arabic: "مَنْ كَذَبَ عَلَيَّ مُتَعَمِّدًا فَلْيَتَبَوَّأْ مَقْعَدَهُ مِنَ النَّارِ", turkish: "Kim, benim adıma kasten yalan söylerse, mekanını Cehennem'de hazır etsin.", source: "Buhari - Müslim" },
  { id: 49, arabic: "الْمُؤْمِنُ لِلْمُؤْمِنِ كَالْبُنْيَانِ يَشُدُّ بَعْضُهُ بَعْضًا", turkish: "Mü'min, mü'min için birbirini sıkan binadaki tuğla gibidir.", source: "Buhari - Müslim" },
  { id: 50, arabic: "إِنَّ الشَّيْطَانَ يَجْرِي مِنِ ابْنِ آدَمَ مَجْرَى الدَّمِ", turkish: "Şeytan, insanın kan damarlarında dolaşır.", source: "Buhari - Müslim" },
  { id: 51, arabic: "أُذْكُرُوا مَحَاسِنَ مَوْتَاكُمْ وَكُفُّوا عَنْ مَسَاوِيهِمْ", turkish: "Ölülerinizin güzelliklerini anın, kötülüklerinden de el ve dil çekin.", source: "Ebu Davud" },
  { id: 52, arabic: "مَنْ صَلَّى عَلَيَّ صَلَاةً صَلَّى اللَّهُ عَلَيْهِ عَشْرًا", turkish: "Kim, bana bir salât getirirse, Allah da ona 10 salât (rahmet) getirir.", source: "Müslim" },
  { id: 53, arabic: "كُلُّ ابْنِ آدَمَ خَطَّاءٌ وَخَيْرُ الْخَطَّائِينَ التَّوَّابُونَ", turkish: "Tüm insanoğlu çokça hata yapandır. Hata yapanların en hayırlısı ise çokça tevbe edenlerdir.", source: "Tirmizi" },
  { id: 54, arabic: "إِذَا كَانُوا ثَلَاثَةً فَلَا يَتَنَاجَى اثْنَانِ دُونَ الثَّالِثِ", turkish: "Üç kişi oldukları zaman, iki kişi kendi aralarında sessizce fısıldaşmasın.", source: "Buhari - Müslim" },
  { id: 55, arabic: "لَيْسَ مِنَّا مَنْ لَمْ يَرْحَمْ صَغِيرَنَا وَيُوقِرْ كَبِيرَنَا", turkish: "Küçüklerimize merhamet, büyüklerimize saygı göstermeyen bizden değildir.", source: "Tirmizi" },
  { id: 56, arabic: "الدُّنْيَا مَتَاعٌ وَخَيْرُ مَتَاعِهَا الْمَرْأَةُ الصَّالِحَةُ", turkish: "Dünya bir metadır, onun en hayırlı meta'sı da saliha bir kadındır.", source: "Buhari - Müslim" },
  { id: 57, arabic: "لَا تُظْهِرِ الشَّمَاتَةَ لِأَخِيكَ فَيَرْحَمَهُ اللَّهُ وَيَبْتَلِيكَ", turkish: "Şamatayı kardeşin için izhar etme! Yoksa Allah, ona merhamet eder, seni de cezalandırır.", source: "Tirmizi" },
  { id: 58, arabic: "أَفْضَلُ الْأَعْمَالِ الْحُبُّ فِي اللَّهِ وَالْبُغْضُ فِي اللَّهِ", turkish: "Amellerin en faziletlisi Allah için sevmek ve Allah için buğzetmektir.", source: "Ebu Davud" },
  { id: 59, arabic: "الرَّجُلُ عَلَى دِينِ خَلِيلِهِ فَلْيَنْظُرْ أَحَدُكُمْ مَنْ يُخَالِلُ", turkish: "Kişi, dostunun dini üzeredir. Sizden biri, kiminle arkadaşlık ettiğine dikkat etsin.", source: "Ebu Davud" },
  { id: 60, arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ", turkish: "Sizden biri kendisi için istediğini kardeşi için de istemedikçe (kâmil anlamda) iman etmiş olmaz.", source: "Buhari - Müslim" },
  { id: 61, arabic: "مَا نَحَلَ وَالِدٌ وَلَدًا مِنْ نَحْلٍ أَفْضَلَ مِنْ أَدَبٍ حَسَنٍ", turkish: "Bir baba, evladına güzel edepten daha üstün bir hediye vermiş olamaz.", source: "Tirmizi" },
  { id: 62, arabic: "خَصْلَتَانِ لَا تَجْتَمِعَانِ فِي مُؤْمِنٍ: الْبُخْلُ وَسُوءُ الْخُلُقِ", turkish: "İki haslet var ki her ikisi beraber bir mü'minde toplanmaz; cimrilik ve kötü ahlak.", source: "Tirmizi" },
  { id: 63, arabic: "الَّذِي لَيْسَ فِي جَوْفِهِ شَيْءٌ مِنَ الْقُرْآنِ كَالْبَيْتِ الْخَرِبِ", turkish: "Karnında Kur'ân'dan bir demet âyet bulunmayan kişi, harap ev misalidir.", source: "Tirmizi" },
  { id: 64, arabic: "إِتَّقُوا دَعْوَةَ الْمَظْلُومِ فَإِنَّهَا لَيْسَ بَيْنَهَا وَبَيْنَ اللَّهِ حِجَابٌ", turkish: "Mazlumun duasından sakının! Zira onun duasıyla Allah'ın arasında hiçbir perde yoktur.", source: "Buhari - Müslim" },
  { id: 65, arabic: "نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ: الصِّحَّةُ وَالْفَرَاغُ", turkish: "İki nimet var ki insanların çoğu bu ikisinde aldanmıştır; sıhhat ve boş vakit.", source: "Buhari" },
  { id: 66, arabic: "لَا تَدْخُلُونَ الْجَنَّةَ حَتَّى تُؤْمِنُوا وَلَا تُؤْمِنُوا حَتَّى تَحَابُّوا", turkish: "İman etmedikçe Cennet'e giremezsiniz, birbirinizi sevmedikçe de iman etmiş sayılmazsınız.", source: "Buhari - Müslim" },
  { id: 67, arabic: "إِنْ قَامَتِ السَّاعَةُ وَفِي يَدِ أَحَدِكُمْ فَسِيلَةٌ فَلْيَغْرِسْهَا", turkish: "Sizden birinizin elinde bir fidan bulunduğu takdirde kıyamet kopacak olsa, (yine de) o fidanı diksin.", source: "Müsned-i Ahmed" },
  { id: 68, arabic: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ", turkish: "Kim, Allah'a ve ahiret gününe inanıyorsa hayır telakki etsin veyahut sükut etsin.", source: "Buhari - Müslim" },
  { id: 69, arabic: "صَلِّ صَلَاةَ مُوَدِّعٍ كَأَنَّكَ تَرَاهُ، فَإِنْ كُنْتَ لَا تَرَاهُ فَإِنَّهُ يَرَاكَ", turkish: "Son namazınmış gibi namaz kıl, bir nevi Allah'ı görüyormuşçasına; sen O'nu görmüyorsan da O, seni muhakkak görüyor.", source: "İbn Mace" },
  { id: 70, arabic: "يَهْرَمُ ابْنُ آدَمَ وَتَشِيبُ فِيهِ خَصْلَتَانِ: الْحِرْصُ وَطُولُ الْأَمَلِ", turkish: "İnsanoğlu tükenir ama iki özelliği gittikçe gençleşir; dünya hırsı ve uzun ömür isteği.", source: "Müslim" },
  { id: 71, arabic: "لَنْ يَشْبَعَ الْمُؤْمِنُ مِنْ خَيْرٍ يَسْمَعُهُ حَتَّى يَكُونَ مُنْتَهَاهُ الْجَنَّةُ", turkish: "Mü'min, işittiği hayırdan doymaz, ta ki nihayeti Cennet olana dek.", source: "Tirmizi" },
  { id: 72, arabic: "مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ", turkish: "Kim, inanarak ve sevabını Allah'tan bekleyerek Ramazan orucunu tutarsa, geçmiş tüm (küçük) günahları bağışlanır.", source: "Buhari - Müslim" },
  { id: 73, arabic: "إِنَّ أَحَدَكُمْ إِذَا قَامَ يُصَلِّي إِنَّمَا يُنَاجِي رَبَّهُ فَلْيَنْظُرْ كَيْفَ يُنَاجِي", turkish: "Sizden biri, namaza kalkacağı zaman, muhakkak Rabbine münacatta bulunur. Bu nedenle nasıl münacatta bulunduğuna dikkat etsin.", source: "Müslim" },
  { id: 74, arabic: "كَمَا تَدِينُ تُدَانُ", turkish: "Ne edersen onu bulursun.", source: "Buhari teracümü" },
  { id: 75, arabic: "لَا تَبَاغَضُوا وَلَا تَحَاسَدُوا وَلَا تَدَابَرُوا وَكُونُوا عِبَادَ اللَّهِ إِخْوَانًا", turkish: "Birbirinize buğz etmeyin, haset etmeyin, birbirinize sırt çevirmeyin ve ey Allah'ın kulları! Kardeş olun.", source: "Buhari - Müslim" },
  { id: 76, arabic: "إِيَّاكُمْ وَالْحَسَدَ فَإِنَّ الْحَسَدَ يَأْكُلُ الْحَسَنَاتِ كَمَا تَأْكُلُ النَّارُ الْخَطَبَ", turkish: "Hasetten sakın! Muhakkak haset, ateşin odunları yiyip tükettiği gibi hasenatınızı yiyip tüketir.", source: "Ebu Davud" },
  { id: 77, arabic: "لَيْسَ الشَّدِيدُ بِالصَّرَعَةِ، وَإِنَّمَا الشَّدِيدُ مَنْ يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ", turkish: "Güçlü olan, güreşte yenen kişi değil, sinir esnasında gazabına hakim olan kimsedir.", source: "Buhari - Müslim" },
  { id: 78, arabic: "إِنَّ اللَّهَ لَا يَقْبَلُ مِنَ الْعَمَلِ إِلَّا مَا كَانَ لَهُ خَالِصًا وَابْتُغِيَ بِهِ وَجْهُهُ", turkish: "Allah, ancak ihlasla ve kendi rızası için yapılan amelleri kabul eder.", source: "Tirmizi" },
  { id: 79, arabic: "مَنْ أَحَبَّ أَنْ يُبْسَطَ لَهُ فِي رِزْقِهِ وَيُنْسَأَ لَهُ فِي أَثَرِهِ فَلْيَصِلْ رَحْمَهُ", turkish: "Kim, rızkının bol olmasını ve ömrüne bereket katılmasını isterse sıla-i rahimde bulunsun.", source: "Buhari - Müslim" },
  { id: 80, arabic: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ", turkish: "Kim, ilim talep ederek bir yolda süluk ederse Allah, o ilim sebebiyle kendisine Cennete giden yolu kolaylaştırır.", source: "Tirmizi" },
  { id: 81, arabic: "مَنْ خَرَجَ فِي طَلَبِ الْعِلْمِ فَهُوَ فِي سَبِيلِ اللَّهِ حَتَّى يَرْجِعَ", turkish: "Kim, ilim talep etme adına evinden çıkarsa, evine dönene dek Allah'ın yolunda sayılır.", source: "Tirmizi" },
  { id: 82, arabic: "إِنَّ شَرَّ النَّاسِ عِنْدَ اللَّهِ مَنْزِلَةً يَوْمَ الْقِيَامَةِ مَنْ تَرَكَهُ النَّاسُ اتِّقَاءَ شَرِّهِ", turkish: "Konum olarak kıyamet gününde Allah'ın nezdinde en şerli insan, şerrinden korunmak için insanların kendisini terk ettiği kimsedir.", source: "Buhari" },
  { id: 83, arabic: "آيَةُ الْمُنَافِقِ ثَلَاثٌ: إِذَا حَدَّثَ كَذَبَ، وَإِذَا وَعَدَ أَخْلَفَ، وَإِذَا اؤْتُمِنَ خَانَ", turkish: "Münafığın alameti üçtür; konuştuğu zaman yalan konuşur, söz verdiği zaman yerine getirmez, kendisine emanet edildiği zaman ona ihanet eder.", source: "Buhari - Müslim" },
  { id: 84, arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى أَكُونَ أَحَبَّ إِلَيْهِ مِنْ وَالِدِهِ وَوَلَدِهِ وَالنَّاسِ أَجْمَعِينَ", turkish: "Sizden biri, beni babasından, çocuğundan ve tüm insanlardan daha fazla sevmedikçe iman etmiş olmaz.", source: "Buhari - Müslim" },
  { id: 85, arabic: "الْكَيِّسُ مَنْ دَانَ نَفْسَهُ وَعَمِلَ لِمَا بَعْدَ الْمَوْتِ، وَالْعَاجِزُ مَنْ أَتْبَعَ نَفْسَهُ هَوَاهَا", turkish: "Akıllı olan, nefsini hesap eden ve ölümden sonrası için çalışan kimsedir. Aciz olan ise, nefsini hevaya tabi kılan kimsedir.", source: "Tirmizi" },
  { id: 86, arabic: "إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ", turkish: "Allah, şeklinize, mallarınıza bakmaz. Bilakis O, sizin kalplerinize ve amellerinize bakar.", source: "Buhari - Müslim" },
  { id: 87, arabic: "إِتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ", turkish: "Nerede olursan ol Allah'tan kork! Her işlediğin kötülüğün ardına günahları silecek bir iyilik tabi kıl ve insanlara güzel ahlakla muamele et.", source: "Tirmizi" },
  { id: 88, arabic: "الْبِرُّ حُسْنُ الْخُلُقِ، وَالْإِثْمُ مَا حَاكَ فِي صَدْرِكَ وَكَرِهْتَ أَنْ يَطَّلِعَ عَلَيْهِ النَّاسُ", turkish: "İyilik, güzel ahlâktır. Kötülük ise göğüste bir sıkıntı bırakan ve insanların ondan haberdar olmasını istemediğin şeydir.", source: "Tirmizi" },
  { id: 89, arabic: "مَنْ فَرَّجَ عَنْ مُسْلِمٍ كُرْبَةً فَرَّجَ اللَّهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ", turkish: "Kim, bir müslümanın bir sıkıntısını giderirse, Allah da kıyamet gününde onun sıkıntılarından bir sıkıntısını giderir.", source: "Buhari - Müslim" },
  { id: 90, arabic: "إِنَّ فِي الْجَسَدِ مُضْغَةً إِذَا صَلَحَتْ صَلَحَ الْجَسَدُ كُلُّهُ، وَإِذَا فَسَدَتْ فَسَدَ الْجَسَدُ كُلُّهُ، أَلَا وَهِيَ الْقَلْبُ", turkish: "Bedende öyle bir parça et var ki, o ıslah olursa tüm beden ıslah olur ve yine o bozulursa tüm beden bozulur; işte o kalptir.", source: "Buhari - Müslim" },
  { id: 91, arabic: "يَتْبَعُ الْمَيِّتَ ثَلَاثَةٌ: أَهْلُهُ وَمَالُهُ وَعَمَلُهُ، فَيَرْجِعُ اثْنَانِ وَيَبْقَى وَاحِدٌ؛ يَرْجِعُ أَهْلُهُ وَمَالُهُ وَيَبْقَى عَمَلُهُ", turkish: "Ölüye üç şey tabi olur: ailesi, malı ve ameli. İki şey döner, biri kalır. Aile ve malı döner, ameli baki kalır.", source: "Buhari - Müslim" },
  { id: 92, arabic: "مَنْ رَأَى مِنْكُمْ مُنْكَرًا فَلْيُغَيِّرْهُ بِيَدِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِلِسَانِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِقَلْبِهِ، وَذَلِكَ أَضْعَفُ الْإِيمَانِ", turkish: "Sizden kim bir kötülük görürse eliyle onu düzeltsin, buna gücü yetmiyorsa diliyle düzeltsin, ona da takat getiremiyorsa kalbi ile düzeltsin; bu da imanın en zayıf noktasıdır.", source: "Buhari - Müslim" },
  { id: 93, arabic: "حَقُّ الْمُسْلِمِ عَلَى الْمُسْلِمِ خَمْسٌ: رَدُّ السَّلَامِ، وَعِيَادَةُ الْمَرِيضِ، وَاتِّبَاعُ الْجَنَائِزِ، وَإِجَابَةُ الدَّعْوَةِ، وَتَشْمِيتُ الْعَاطِسِ", turkish: "Müslümanın Müslüman üzerine hakkı beştir: selâma karşılık selâm vermek, hastayı ziyaret etmek, cenazeye tabi olmak, davete icabet etmek, hapşırana dua etmek.", source: "Buhari - Müslim" },
  { id: 94, arabic: "ثَلَاثَةٌ لَا يُكَلِّمُهُمُ اللَّهُ يَوْمَ الْقِيَامَةِ وَلَا يُزَكِّيهِمْ وَلَا يَنْظُرُ إِلَيْهِمْ وَلَهُمْ عَذَابٌ أَلِيمٌ: شَيْخٌ زَانٍ، وَمَلِكٌ كَذَّابٌ، وَعَائِلٌ مُسْتَكْبِرٌ", turkish: "Üç kişi vardır ki Allah, kıyamet gününde onlarla konuşmaz, onları tezkiye etmez ve onlara bakmaz. Ayrıca kendileri için elim bir azap vardır; zinakar yaşlı, yalancı yönetici ve kibirli fakir.", source: "Müslim" },
  { id: 95, arabic: "اِجْتَنِبُوا السَّبْعَ الْمُوبِقَاتِ: اَلشِّرْكُ بِاللَّهِ، وَالسِّحْرُ، وَقَتْلُ النَّفْسِ الَّتِي حَرَّمَ اللَّهُ إِلَّا بِالْحَقِّ، وَأَكْلُ الرِّبَا، وَأَكْلُ مَالِ الْيَتِيمِ، وَالتَّوَلِّي يَوْمَ الزَّحْفِ، وَقَذْفُ الْمُحْصَنَاتِ الْغَافِلَاتِ الْمُؤْمِنَاتِ", turkish: "Helaka götüren yedi şeyden sakınınız: Allah'a şirk koşmaktan, sihir yapmaktan, hak (kısas) dışında Allah'ın haram kıldığı bir cana kıymaktan, faiz yemekten, yetim malı yemekten, zor günde (savaş gününden) kaçmaktan, iffetli mümin kadınlara iftira atmaktan sakınınız.", source: "Buhari - Müslim" },
  { id: 96, arabic: "سَبْعَةٌ يُظِلُّهُمُ اللَّهُ فِي ظِلِّهِ يَوْمَ لَا ظِلَّ إِلَّا ظِلُّهُ: إِمَامٌ عَادِلٌ، وَشَابٌّ نَشَأَ فِي عِبَادَةِ اللَّهِ، وَرَجُلٌ قَلْبُهُ مُعَلَّقٌ بِالْمَسَاجِدِ، وَرَجُلَانِ تَحَابَّا فِي اللَّهِ اجْتَمَعَا عَلَيْهِ وَتَفَرَّقَا عَلَيْهِ، وَرَجُلٌ دَعَتْهُ امْرَأَةٌ ذَاتُ مَنْصِبٍ وَجَمَالٍ فَقَالَ إِنِّي أَخَافُ اللَّهَ، وَرَجُلٌ تَصَدَّقَ بِصَدَقَةٍ فَأَخْفَاهَا حَتَّى لَا تَعْلَمَ شِمَالُهُ مَا تُنْفِقُ يَمِينُهُ، وَرَجُلٌ ذَكَرَ اللَّهَ خَالِيًا فَفَاضَتْ عَيْنَاهُ", turkish: "Yedi sınıf var ki kıyamet gününde Allah onları kendi gölgesinde gölgelendirecektir: Adaletli yönetici, Allah'a ibadetle büyüyen genç, kalbi camiye bağlı olan adam, Allah için birbirini seven ve bu sevgiyle birleşip ayrılan iki kişi, makam ve güzellik sahibi bir kadının gayrimeşru davetine 'Ben Allah'tan korkarım' diyen adam, sağ elinin verdiğini sol eli bilmeyecek kadar gizli sadaka veren kişi ve yalnız başına iken Allah'ı anıp gözleri dolan kimse.", source: "Buhari - Müslim" },
  { id: 97, arabic: "الدُّعَاءُ مُخُّ الْعِبَادَةِ", turkish: "Dua, ibadetin özüdür.", source: "Tirmizi" },
  { id: 98, arabic: "الْعُلَمَاءُ وَرَثَةُ الْأَنْبِيَاءِ", turkish: "Alimler, peygamberlerin varisidir.", source: "Tirmizi" },
  { id: 99, arabic: "الدِّينُ حُسْنُ الْخُلُقِ", turkish: "Din, güzel ahlaktır.", source: "Tirmizi" },
  { id: 100, arabic: "إِحْفَظُوهُ وَأَخْبِرُوا مَنْ وَرَائِكُمْ", turkish: "(Hadisleri) ezberleyiniz ve ardınızdakilere bunları bildiriniz.", source: "Buhari" },

  // EFENDİMİZ'İN (S.A.V.) DUALARI
  { id: 101, arabic: "اللَّهُمَّ أَصْلِحْ لِي دِينِي، وَوَسِّعْ لِي فِي دَارِي، وَبَارِكْ لِي فِي رِزْقِي", turkish: "Allah'ım! Benim için dinimi ıslah et, evime huzur ver ve rızkıma bereket kat!", source: "Müsned-i Ahmed" },
  { id: 102, arabic: "اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا", turkish: "Allah'ım! Bana öğrettiklerini faydalı kıl ve bana fayda verecek ilmi de öğret. Bana, kendi nezdinden bir ilim de kat.", source: "İbn Mace" },
  { id: 103, arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ أَنْ تَرْفَعَ ذِكْرِي، وَتَضَعَ وِزْرِي، وَتُطَهِّرَ قَلْبِي، وَتَغْفِرَ لِي ذَنْبِي", turkish: "Allah'ım! Zikrimi yüceltmeni, günahlarımı alçaltmanı, kalbimi temizlemeni ve tüm günahlarımı bağışlamanı isterim.", source: "Heysemi" },
  { id: 104, arabic: "اللَّهُمَّ إِنَّا نَعُوذُ بِكَ مِنْ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ، وَنَعُوذُ بِكَ مِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ", turkish: "Allah'ım! Mesih Deccal'ın fitnesinden sana sığınırız ve yine hayatın ve ölümün fitnesinden sana sığınırız.", source: "Buhari - Müslim" },
  { id: 105, arabic: "اللَّهُمَّ إِنَّا نَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ، وَقَلْبٍ لَا يَخْشَعُ، وَنَفْسٍ لَا تَشْبَعُ، وَدَعْوَةٍ لَا يُسْتَجَابُ لَهَا", turkish: "Allah'ım! Fayda vermeyen ilimden, huşuya kapılmayan kalpten, doymayan nefisten ve kabul olunmayan duadan sana sığınırım.", source: "Buhari - Müslim" },
  { id: 106, arabic: "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ. اللَّهُمَّ تَقَبَّلْ تَوْبَتِي، وَاغْسِلْ حَوْبَتِي، وَأَجِبْ دَعْوَتِي، وَثَبِّتْ حُجَّتِي، وَسَدِّدْ لِسَانِي", turkish: "Allah'ım yüceliğinle beni haramından koru, fazlınla kendi dışındakilerden beni zengin (muhtaç kılma) kıl, tevbemi kabul et, günahlarımı yıka, dualarıma icabet buyur, delilimi sabit ve dilimi de muhafaza et.", source: "Sahih-i İbn Hibban" },
  { id: 107, arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الثَّبَاتَ فِي الْأَمْرِ، وَأَسْأَلُكَ عَزِيمَةَ الرُّشْدِ، وَأَسْأَلُكَ شُكْرَ نِعْمَتِكَ وَحُسْنَ عِبَادَتِكَ، وَأَسْأَلُكَ لِسَانًا صَادِقًا وَقَلْبًا سَلِيمًا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا تَعْلَمُ", turkish: "Allah'ım! İşlerde sebat etmeyi, doğrulukta kararlı olmayı senden isterim. Senden nimetinin şükrünü, ibadetin güzelliğini ister ve senden sadık bir lisan, temiz bir kalp isterim. Bildiklerinin şerrinden de sana sığınırım.", source: "Tirmizi" },
  { id: 108, arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَآخِرَتِي. اللَّهُمَّ عَافِنِي فِي بَدَنِي، وَعَافِنِي فِي سَمْعِي، وَعَافِنِي فِي بَصَرِي. اللَّهُمَّ إِنَّا نَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحُزَنِ، وَنَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ، وَنَعُوذُ بِكَ مِنَ الْجُبْنِ وَالْبُخْلِ، وَنَعُوذُ بِكَ مِنْ غَلَبَةِ الدِّينِ وَقَهْرِ الرِّجَالِ", turkish: "Allah'ım! Dinimde, dünyamda ve ahiretimde af ve afiyet/sağlık isterim. Allah'ım! Beni, bedenimde sıhhatlı kıl, kulaklarımda sıhhatlı kıl, gözlerimde sıhhatlı kıl. Allah'ım! Kederden, üzüntüden acizlikten, tembellikten, korkaklıktan, cimrilikten, borcun galebe çalmasından ve erkeklerin zorbalığından sana sığınırım", source: "Ebu Davud" },
  { id: 109, arabic: "اللَّهُمَّ إِنَّا نَسْأَلُكَ خَيْرَ الْمَسْأَلَةِ وَخَيْرَ الدَّعَاءِ وَخَيْرَ النَّجَاحِ وَخَيْرَ الثَّوَابِ، وَثَبِّتْ أَقْدَامَنَا وَثَقِّلْ مَوَازِينَنَا وَحَقِّقْ إِيمَانَنَا وَتَقَبَّلْ صَلَاتَنَا وَاغْفِرْ خَطَايَانَا، وَنَسْأَلُكَ الدَّرَجَاتِ الْعُلَى مِنَ الْجَنَّةِ", turkish: "Allah'ım! İsteğin, duanın, kurtuluşun, sevabın en hayırlısını senden isteriz. Ayaklarimizi sabit kıl, mizanlarımızı ağır kıl, imanımızda tahakkuk eyle, namazlarımızı kabul et, hatalarımızı bağışla. Allah'ım! Senden Cennet'in yüksek derecelerini isteriz.", source: "Heysemi" },
  { id: 110, arabic: "اللَّهُمَّ اقْسِمْ لَنَا مِنْ خَشْيَتِكَ مَا تَحُولُ بِهِ بَيْنَنَا وَبَيْنَ مَعَاصِيكَ، وَمِنْ طَاعَتِكَ مَا تُبَلِّغُنَا بِهِ جَنَّتَكَ، وَمِنَ الْيَقِينِ مَا تُهَوِّنُ بِهِ عَلَيْنَا مَصَائِبَ الدُّنْيَا، وَمَتِّعْنَا بِأَسْمَاعِنَا وَأَبْصَارِنَا وَقُوَّتِنَا مَا أَحْيَيْتَنَا، وَاجْعَلْ ثَأْرَنَا عَلَى مَنْ ظَلَمَنَا، وَانْصُرْنَا عَلَى مَنْ عَادَانَا، وَلَا تَجْعَلِ الدُّنْيَا أَكْبَرَ هَمِّنَا وَلَا مَبْلَغَ عِلْمِنَا، وَلَا تَجْعَلْ مُصِيبَتَنَا فِي دِينِنَا، وَلَا تُسَلِّطْ عَلَيْنَا بِذُنُوبِنَا مَنْ لَا يَخَافُكَ وَلَا يَرْحَمْنَا، يَا رَبَّ الْعَالَمِينَ", turkish: "Allah'ım! Bize haşyetinden, sana isyandan alıkoyacak, taatinden bizi Cennete ulaştıracak, bize yakinden (iman kuvvetinden) dünya musibetlerini kolaylaştıracak bir pay ihsan eyle! Bizleri hayatta tuttuğun sürece kulaklarımız, gözlerimiz ve gücümüzle bizi donat. Rabbimiz! Dünyayı en büyük derdimiz ve bilgimizin ulaştığı son nokta kılma. Bizi dinimizle sınama. Günahlarımız sebebiyle senden korkmayan ve bize acımayan kimseyi bize musallat etme, ey alemlerin Rabbi!", source: "Suyuti, Camiu's-Sağir" }
];

let hadithMemo = JSON.parse(localStorage.getItem('hadith_memorization') || '{}');
function saveHadithMemo() { localStorage.setItem('hadith_memorization', JSON.stringify(hadithMemo)); updateHadithSummary(); }

function updateHadithSummary() {
  let ezberCount = 0;
  let tekrarCount = 0;
  let azCount = 0;
  for (let i = 1; i <= HADITH_MEMORIZATION_POOL.length; i++) {
    const s = hadithMemo[i];
    if (s === 'ezberlendi') ezberCount++;
    else if (s === 'tekrar') tekrarCount++;
    else if (s === 'az') azCount++;
  }
  const hms = document.getElementById('hadith-memorize-summary');
  if (hms) {
    const total = HADITH_MEMORIZATION_POOL.length;
    const percent = Math.round((ezberCount / total) * 100);
    hms.textContent = `Ezber: %${percent} ✅${ezberCount} 🟡${tekrarCount} 🔴${azCount} / ${total}`;
  }
}

document.getElementById('hadith-memorize-btn')?.addEventListener('click', () => {
  renderHadithGrid();
  document.getElementById('hadith-grid-modal').classList.add('active');
});

function renderHadithGrid() {
  // Taze veriyi her seferinde localStorage'dan oku
  hadithMemo = JSON.parse(localStorage.getItem('hadith_memorization') || '{}');
  const grid = document.getElementById('hadith-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 1; i <= HADITH_MEMORIZATION_POOL.length; i++) {
    const status = hadithMemo[i] || '';
    const cell = document.createElement('div');
    let cls = 'quran-ayah-cell';
    if (status === 'ezberlendi') cls += ' status-ezberlendi';
    else if (status === 'tekrar') cls += ' status-tekrar';
    else if (status === 'az') cls += ' status-az';
    cell.className = cls;
    cell.textContent = i;
    cell.addEventListener('click', () => {
      openHadithDetail(i);
    });
    grid.appendChild(cell);
  }
}

function openHadithDetail(id) {
  const hadith = HADITH_MEMORIZATION_POOL.find(h => h.id === id);
  if (!hadith) return;

  const modal = document.getElementById('hadith-detail-modal');
  const titleEl = document.getElementById('hadith-detail-title');
  const arabicEl = document.getElementById('hadith-detail-arabic');
  const turkishEl = document.getElementById('hadith-detail-turkish');
  const sourceEl = document.getElementById('hadith-detail-source');
  if (!modal || !titleEl || !arabicEl || !turkishEl || !sourceEl) return;

  titleEl.textContent = `HADİS #${hadith.id}`;
  arabicEl.textContent = hadith.arabic || '';
  arabicEl.style.display = hadith.arabic ? 'block' : 'none';
  turkishEl.textContent = hadith.turkish || '';
  sourceEl.textContent = `— ${hadith.source || 'Kaynak Belirtilmemiş'}`;

  // Update button active states
  const currentStatus = hadithMemo[hadith.id] || '';
  ['az', 'tekrar', 'ezberlendi'].forEach(s => {
    const btn = document.getElementById('hadith-btn-' + s);
    if (btn) btn.classList.toggle('active', currentStatus === s);
  });

  // Button click handlers
  ['az', 'tekrar', 'ezberlendi'].forEach(s => {
    const btn = document.getElementById('hadith-btn-' + s);
    if (btn) {
      btn.onclick = () => {
        hadithMemo[hadith.id] = s;
        saveHadithMemo();
        renderHadithGrid();
        openHadithDetail(hadith.id);
      };
    }
  });

  const clearBtn = document.getElementById('hadith-btn-clear');
  if (clearBtn) {
    clearBtn.onclick = () => {
      delete hadithMemo[hadith.id];
      saveHadithMemo();
      renderHadithGrid();
      openHadithDetail(hadith.id);
    };
  }

  modal.classList.add('active');
}

window.closeHadithDetailModal = function() {
  const modal = document.getElementById('hadith-detail-modal');
  if (modal) modal.classList.remove('active');
};

// Sayfa yüklenince özet güncelle
updateHadithSummary();


// ===================== DAILY ZIKIR (EZKAR) =====================
const ZIKIR_LIST = [
  { id: 'istigfar', name: 'İstiğfar (100 defa)' },
  { id: 'hamd', name: 'Elhamdülillah (33 defa)' },
  { id: 'tahmid', name: 'Sübhanallahi ve bihamdihi (100 defa)' },
  { id: 'tekbir', name: 'Allahu Ekber (33 defa)' },
  { id: 'salavat', name: 'Salavat (100 defa)' }
];
let dailyZikir = JSON.parse(localStorage.getItem('daily_zikir') || '{}');
function saveZikir() { localStorage.setItem('daily_zikir', JSON.stringify(dailyZikir)); }

function renderZikirList() {
  const list = document.getElementById('zikir-list');
  if (!list) return;
  list.innerHTML = '';
  const today = getTodayKey();
  if (!dailyZikir[today]) dailyZikir[today] = {};

  ZIKIR_LIST.forEach(z => {
    const isDone = dailyZikir[today][z.id] === true;
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.background = 'rgba(255,255,255,0.05)';
    item.style.padding = '12px 15px';
    item.style.borderRadius = '8px';
    item.style.border = '1px solid rgba(255,255,255,0.1)';

    const left = document.createElement('div');
    left.style.fontSize = '14px';
    left.style.color = isDone ? 'var(--text-secondary)' : 'var(--text-primary)';
    left.style.textDecoration = isDone ? 'line-through' : 'none';
    left.textContent = z.name;

    const checkBtn = document.createElement('button');
    checkBtn.className = isDone ? 'btn btn-primary btn-small' : 'btn btn-secondary btn-small';
    checkBtn.style.width = '30px';
    checkBtn.style.height = '30px';
    checkBtn.style.padding = '0';
    checkBtn.innerHTML = isDone ? '<i class="fas fa-check"></i>' : '';

    item.onclick = () => {
      dailyZikir[today][z.id] = !isDone;
      saveZikir();
      renderZikirList();
    };

    item.appendChild(left);
    item.appendChild(checkBtn);
    list.appendChild(item);
  });
}
renderZikirList();

// ===================== DAILY REMINDER =====================
const DAILY_AYAH = "Allah (c.c) kuluna kâfi değil midir? (Zümer, 36)";
const DAILY_HADITH = "İki nimet vardır ki insanların çoğu onlarda aldanmıştır: Sağlık ve boş vakit. (Buhârî)";

function checkDailyReminder() {
  const today = getTodayKey();
  const lastSeen = localStorage.getItem('last_reminder_date');
  if (lastSeen !== today) {
    const modal = document.getElementById('daily-reminder-modal');
    if (modal) {
      document.getElementById('reminder-ayah-text').textContent = DAILY_AYAH;
      document.getElementById('reminder-hadith-text').textContent = DAILY_HADITH;
      modal.classList.add('active');
      localStorage.setItem('last_reminder_date', today);
    }
  }
}

// ===================== VOCABULARY MEMORIZATION =====================
let vocabData = JSON.parse(localStorage.getItem('vocab_data') || '{"target":10, "words":[]}');
function saveVocab() { localStorage.setItem('vocab_data', JSON.stringify(vocabData)); renderVocab(); }

document.getElementById('vocab-memorize-btn')?.addEventListener('click', () => {
  navigateTo('vocab-view');
  renderVocab();
});

document.getElementById('vocab-add-btn')?.addEventListener('click', () => {
  const wordInput = document.getElementById('vocab-word-input');
  const meaningInput = document.getElementById('vocab-meaning-input');
  const word = wordInput.value.trim();
  const meaning = meaningInput.value.trim();
  if (word && meaning) {
    vocabData.words.unshift({
      id: Date.now(),
      word: word,
      meaning: meaning,
      addedAt: Date.now(),
      lastReviewed: Date.now(),
      box: 0 // Spaced repetition box (0=new, 1=1day, 2=3days, 3=7days, 4=mastered)
    });
    wordInput.value = '';
    meaningInput.value = '';
    saveVocab();
  }
});

function renderVocab() {
  const todayStr = getTodayKey();
  let dailyCount = 0;
  let reviewCount = 0;
  const now = Date.now();
  const msInDay = 86400000;

  const list = document.getElementById('vocab-list');
  if (!list) return;
  list.innerHTML = '';

  vocabData.words.forEach(w => {
    let needsReview = false;
    const daysSinceReview = (now - w.lastReviewed) / msInDay;
    if (w.box === 0 && daysSinceReview >= 1) needsReview = true;
    if (w.box === 1 && daysSinceReview >= 3) needsReview = true;
    if (w.box === 2 && daysSinceReview >= 7) needsReview = true;
    if (w.box === 3 && daysSinceReview >= 15) needsReview = true;

    if (needsReview) reviewCount++;

    const addedDay = new Date(w.addedAt).toISOString().slice(0, 10);
    if (addedDay === todayStr) dailyCount++;

    const item = document.createElement('div');
    item.className = 'habit-card';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '10px 15px';

    let statusHtml = '';
    if (w.box >= 4) statusHtml = '<span style="color:var(--neon-green);font-size:12px;"><i class="fas fa-check-circle"></i> Öğrendim</span> <button class="btn btn-secondary btn-small" onclick="markVocabLearned(' + w.id + ', false)" style="padding:4px 8px;font-size:10px;margin-left:5px;">İptal</button>';
    else statusHtml = '<button class="btn btn-primary btn-small" onclick="markVocabLearned(' + w.id + ', true)" style="background:transparent;border:1px solid var(--neon-green);color:var(--neon-green);padding:5px 10px;font-size:11px;margin-right:5px;">Öğrendim</button> <button class="btn btn-secondary btn-small" onclick="markVocabLearned(' + w.id + ', false)" style="padding:5px 10px;font-size:11px;">Öğrenmedim</button>';

    item.innerHTML = `
            <div>
                <div style="font-size:16px;font-weight:bold;color:var(--text-primary);">${w.word}</div>
                <div style="font-size:13px;color:var(--text-secondary);">${w.meaning}</div>
            </div>
            <div style="display:flex;align-items:center;">
                ${statusHtml}
            </div>
        `;
    list.appendChild(item);
  });

  const dStat = document.getElementById('vocab-daily-stat');
  if (dStat) dStat.textContent = `${dailyCount}/${vocabData.target}`;
  const tStat = document.getElementById('vocab-total-stat');
  if (tStat) tStat.textContent = vocabData.words.length;

  const rBtn = document.getElementById('vocab-review-btn');
  if (rBtn) {
    if (reviewCount > 0) {
      rBtn.classList.remove('hidden');
      rBtn.textContent = `Tekrar Vakti! (${reviewCount})`;
    } else {
      rBtn.classList.add('hidden');
    }
  }
}

window.markVocabLearned = (id, learned) => {
  const w = vocabData.words.find(x => x.id === id);
  if (!w) return;
  if (learned) w.box = 4;
  else w.box = 0;
  w.lastReviewed = Date.now();
  saveVocab();
};

window.reviewVocab = (id, success) => { // Kept for backward compatibility if needed
  window.markVocabLearned(id, success);
};

// ===================== NUMERIC VOCAB TRACKING =====================
let vocabNumData = JSON.parse(localStorage.getItem('vocabNumData') || '{"days":{}}');
function saveVocabNum() { localStorage.setItem('vocabNumData', JSON.stringify(vocabNumData)); }

function renderVocabNum() {
  const card = document.getElementById('vocab-num-card');
  if (!card) return;
  const now = new Date();
  if (!card.dataset.viewMonth || card.dataset.viewMonth === '') card.dataset.viewMonth = now.getMonth();
  if (!card.dataset.viewYear || card.dataset.viewYear === '') card.dataset.viewYear = now.getFullYear();
  const viewMonth = parseInt(card.dataset.viewMonth);
  const viewYear = parseInt(card.dataset.viewYear);

  // Populate target input
  const tInput = document.getElementById('vocab-target-input');
  if (tInput && !tInput.value) tInput.value = vocabData.target || 10;

  const lbl = document.getElementById('vnum-cal-lbl');
  if (lbl) lbl.textContent = TR_MONTHS_FULL[viewMonth] + ' ' + viewYear;

  const calGrid = document.getElementById('vnum-cal-grid');
  if (!calGrid) return;
  calGrid.innerHTML = '';

  const hdrs = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  hdrs.forEach(h => {
    const el = document.createElement('div');
    el.style.cssText = 'font-size:9px;color:var(--text-secondary);text-align:center;padding:2px;';
    el.textContent = h;
    calGrid.appendChild(el);
  });

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = getTodayKey();

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    calGrid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewYear, viewMonth, d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    const num = vocabNumData.days[dateStr] || 0;
    const isToday = dateStr === todayStr;
    const isFuture = dateObj > today;

    const el = document.createElement('div');
    el.style.cssText = `
            position: relative;
            background: ${num > 0 ? 'rgba(39,201,63,0.2)' : (isFuture ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)')};
            border: 1px solid ${num > 0 ? '#27c93f' : (isToday ? 'var(--neon-green)' : 'rgba(255,255,255,0.1)')};
            border-radius: 6px;
            padding: 3px 2px;
            text-align: center;
            cursor: ${isFuture ? 'default' : 'pointer'};
            min-height: 36px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1px;
            transition: 0.15s;
        `;

    // Day number
    const daySpan = document.createElement('div');
    daySpan.style.cssText = `font-size: 10px; color: ${isToday ? 'var(--neon-green)' : (num > 0 ? '#27c93f' : 'var(--text-secondary)')};`;
    daySpan.textContent = d;
    el.appendChild(daySpan);

    // Word count badge
    if (num > 0) {
      const badge = document.createElement('div');
      badge.style.cssText = 'font-size:11px;font-weight:bold;color:#27c93f;line-height:1;';
      badge.textContent = num;
      el.appendChild(badge);
    }

    el.title = dateStr + (num > 0 ? ` — ${num} kelime` : '');

    if (!isFuture) {
      el.addEventListener('click', () => {
        if (num > 0) {
          // Toggle off (remove) on click
          delete vocabNumData.days[dateStr];
          saveVocabNum(); renderVocabNum();
        }
      });
    }

    calGrid.appendChild(el);
  }
}

// Target save button
document.getElementById('vocab-target-save-btn')?.addEventListener('click', () => {
  const v = parseInt(document.getElementById('vocab-target-input').value) || 10;
  vocabData.target = v;
  saveVocab();
  renderVocab();
  renderVocabNum();
  alert('Günlük hedef ' + v + ' olarak kaydedildi.');
});

document.getElementById('vocab-num-add-btn')?.addEventListener('click', () => {
  const num = parseInt(document.getElementById('vocab-num-input').value) || 0;
  if (num <= 0) return;
  const dateInput = document.getElementById('vocab-num-date').value;
  const dateStr = dateInput || getTodayKey();
  if (!vocabNumData.days) vocabNumData.days = {};
  vocabNumData.days[dateStr] = (vocabNumData.days[dateStr] || 0) + num;
  saveVocabNum(); renderVocabNum();
  document.getElementById('vocab-num-input').value = '';
  document.getElementById('vocab-num-date').value = '';
  alert(`${num} kelime ${dateStr} tarihine eklendi! Toplam: ${vocabNumData.days[dateStr]}`);
});

document.getElementById('vnum-cal-prev')?.addEventListener('click', () => {
  const card = document.getElementById('vocab-num-card');
  let m = parseInt(card.dataset.viewMonth) - 1; let y = parseInt(card.dataset.viewYear);
  if (m < 0) { m = 11; y--; }
  card.dataset.viewMonth = m; card.dataset.viewYear = y; renderVocabNum();
});
document.getElementById('vnum-cal-next')?.addEventListener('click', () => {
  const card = document.getElementById('vocab-num-card');
  let m = parseInt(card.dataset.viewMonth) + 1; let y = parseInt(card.dataset.viewYear);
  if (m > 11) { m = 0; y++; }
  card.dataset.viewMonth = m; card.dataset.viewYear = y; renderVocabNum();
});

// ===================== TIMER INPUT BLUR & RESIZE FIX =====================
[tiHours, tiMinutes, tiSeconds].forEach(input => {
  if (input) {
    input.addEventListener('input', () => {
      const len = input.value.length;
      if (len > 2) {
        input.style.width = `${len * 20 + 30}px`;
      } else {
        input.style.width = '70px';
      }
    });
    input.addEventListener('blur', () => {
      if (input.value.trim() === '') {
        input.value = '00';
        input.style.width = '70px';
      } else {
        input.value = String(parseInt(input.value) || 0).padStart(2, '0');
      }
    });
  }
});

// ===================== ZIKIR TAKIBI =====================
let zikirs = JSON.parse(localStorage.getItem('zikirs') || '[]');
function saveZikirs() { localStorage.setItem('zikirs', JSON.stringify(zikirs)); }

function renderZikirs() {
  const list = document.getElementById('zikir-list'); if (!list) return;
  list.innerHTML = '';
  if (zikirs.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:20px;">Henüz zikir eklenmedi.</div>';
    return;
  }
  zikirs.forEach((z, zi) => {
    const stats = getStreakStats(z);
    const todayStr = getTodayKey();
    const card = document.createElement('div');
    card.className = 'streak-card';
    card.dataset.viewMonth = new Date().getMonth();
    card.dataset.viewYear = new Date().getFullYear();

    card.innerHTML = `
      <div class="streak-card-top">
        <span class="streak-goal-name"><i class="fas fa-pray" style="color:var(--neon-green);"></i> ${z.name} <span style="color:var(--text-secondary);font-size:12px;">(${z.target})</span></span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:11px; color:var(--text-secondary);">🔥 ${stats.current} gün</span>
          <button onclick="deleteZikir(${zi})" style="background:none;border:none;color:rgba(255,80,80,0.6);cursor:pointer;font-size:15px;"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="streak-stats">
        <div class="streak-stat"><div class="streak-stat-val">${stats.current}</div><div class="streak-stat-lbl">Mevcut Seri</div></div>
        <div class="streak-stat"><div class="streak-stat-val" style="color:var(--neon-green); text-shadow:0 0 10px var(--neon-green-glow);">${stats.best}</div><div class="streak-stat-lbl">En İyi Seri</div></div>
        <div class="streak-stat"><div class="streak-stat-val" style="font-size:16px; color:var(--text-secondary);">${(z.days || []).length}</div><div class="streak-stat-lbl">Toplam Gün</div></div>
      </div>
      <div class="streak-today-section">
        <button class="streak-today-btn ${stats.todayDone ? 'done' : ''}">
          ${stats.todayDone ? '<i class="fas fa-check-circle"></i> Bugün Tamamlandı ✓' : '<i class="far fa-circle"></i> Bugünü Tamamla'}
        </button>
      </div>
      <div class="streak-calendar-wrap">
        <div class="streak-calendar-header">
          <button class="streak-cal-nav" data-dir="-1">&#8249;</button>
          <span class="streak-cal-month-lbl"></span>
          <button class="streak-cal-nav" data-dir="1">&#8250;</button>
        </div>
        <div class="streak-calendar"></div>
      </div>
    `;
    list.appendChild(card);

    card.querySelector('.streak-today-btn').addEventListener('click', () => {
      if (!z.days) z.days = [];
      const idx = z.days.indexOf(todayStr);
      if (idx > -1) z.days.splice(idx, 1); else z.days.push(todayStr);
      saveZikirs(); renderZikirs();
    });

    card.querySelectorAll('.streak-cal-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir);
        let m = parseInt(card.dataset.viewMonth) + dir;
        let y = parseInt(card.dataset.viewYear);
        if (m > 11) { m = 0; y++; } else if (m < 0) { m = 11; y--; }
        card.dataset.viewMonth = m; card.dataset.viewYear = y;
        renderStreakCalendar(card, z);
      });
    });

    renderStreakCalendar(card, z);
  });
}

window.deleteZikir = (zi) => { zikirs.splice(zi, 1); saveZikirs(); renderZikirs(); };
document.getElementById('zikir-add-btn')?.addEventListener('click', () => {
  const name = document.getElementById('zikir-name-input').value.trim();
  const target = document.getElementById('zikir-target-input').value.trim();
  if (!name || !target) return;
  zikirs.push({ name, target, days: [] });
  saveZikirs(); renderZikirs();
  document.getElementById('zikir-name-input').value = '';
  document.getElementById('zikir-target-input').value = '';
});

// ===================== QURAN CUSTOM TRACKER =====================
let quranCustoms = JSON.parse(localStorage.getItem('quranCustoms') || '[]');
function saveQuranCustoms() { localStorage.setItem('quranCustoms', JSON.stringify(quranCustoms)); }

function renderQuranCustoms() {
  const list = document.getElementById('quran-custom-list'); if (!list) return;
  list.innerHTML = '';
  if (quranCustoms.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:20px; font-size:12px;">Henüz özel okuma eklenmedi.</div>';
    return;
  }
  quranCustoms.forEach((q, qi) => {
    const stats = getStreakStats(q);
    const todayStr = getTodayKey();
    const card = document.createElement('div');
    card.className = 'streak-card';
    card.dataset.viewMonth = new Date().getMonth();
    card.dataset.viewYear = new Date().getFullYear();

    card.innerHTML = `
            <div class="streak-card-top">
                <span class="streak-goal-name"><i class="fas fa-book" style="color:var(--neon-green);"></i> ${q.name}</span>
                <div style="display:flex;gap:8px;align-items:center;">
                    <span style="font-size:11px; color:var(--text-secondary);">🔥 ${stats.current} gün</span>
                    <button onclick="deleteQuranCustom(${qi})" style="background:none;border:none;color:rgba(255,80,80,0.6);cursor:pointer;font-size:15px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="streak-today-section">
                <button class="streak-today-btn ${stats.todayDone ? 'done' : ''}">
                    ${stats.todayDone ? '<i class="fas fa-check-circle"></i> Bugün Okudum ✓' : '<i class="far fa-circle"></i> Bugün Okudum'}
                </button>
            </div>
            <div class="streak-calendar-wrap">
                <div class="streak-calendar-header">
                    <button class="streak-cal-nav" data-dir="-1">&#8249;</button>
                    <span class="streak-cal-month-lbl"></span>
                    <button class="streak-cal-nav" data-dir="1">&#8250;</button>
                </div>
                <div class="streak-calendar"></div>
            </div>
        `;
    list.appendChild(card);

    card.querySelector('.streak-today-btn').addEventListener('click', () => {
      if (!q.days) q.days = [];
      const idx = q.days.indexOf(todayStr);
      if (idx > -1) q.days.splice(idx, 1); else q.days.push(todayStr);
      saveQuranCustoms(); renderQuranCustoms();
    });

    card.querySelectorAll('.streak-cal-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir);
        let m = parseInt(card.dataset.viewMonth) + dir;
        let y = parseInt(card.dataset.viewYear);
        if (m > 11) { m = 0; y++; } else if (m < 0) { m = 11; y--; }
        card.dataset.viewMonth = m; card.dataset.viewYear = y;
        renderStreakCalendar(card, q);
      });
    });

    renderStreakCalendar(card, q);
  });
}

window.deleteQuranCustom = (qi) => { quranCustoms.splice(qi, 1); saveQuranCustoms(); renderQuranCustoms(); };
document.getElementById('quran-custom-add-btn')?.addEventListener('click', () => {
  const name = document.getElementById('quran-custom-name-input').value.trim();
  if (!name) return;
  quranCustoms.push({ name, days: [] });
  saveQuranCustoms(); renderQuranCustoms();
  document.getElementById('quran-custom-name-input').value = '';
});

// ===================== SESSION HISTORY =====================
// sessionHistory is declared at the top of the file
function saveSession(obj) {
  // obj: { name, ms, type }
  const now = new Date();
  sessionHistory.unshift({
    name: obj.name,
    ms: obj.ms,
    type: obj.type || 'Genel',
    date: now.toISOString().slice(0, 10),
    dateLabel: `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`,
    ts: now.getTime()
  });
  localStorage.setItem('session_history', JSON.stringify(sessionHistory));
}

let shCurrentFilter = 'all';

function renderSessionHistory() {
  const now = new Date();
  const todayStr = getTodayKey();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

  let filtered = sessionHistory;
  if (shCurrentFilter === 'today') filtered = sessionHistory.filter(s => s.date === todayStr);
  else if (shCurrentFilter === 'week') filtered = sessionHistory.filter(s => new Date(s.ts) >= weekAgo);
  else if (shCurrentFilter === 'month') filtered = sessionHistory.filter(s => new Date(s.ts) >= monthAgo);

  // Totals
  const totalMs = filtered.reduce((a, s) => a + (s.ms || 0), 0);
  const el = document.getElementById('sh-total-time');
  const ec = document.getElementById('sh-total-count');
  if (el) el.textContent = msToHM(totalMs) || '0dk';
  if (ec) ec.textContent = filtered.length;

  // Category breakdown
  const cats = {};
  filtered.forEach(s => { cats[s.name] = (cats[s.name] || 0) + s.ms; });
  const catEl = document.getElementById('sh-categories');
  if (catEl) {
    const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const maxMs = sorted.length ? sorted[0][1] : 1;
    if (sorted.length === 0) {
      catEl.innerHTML = '';
    } else {
      catEl.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">Kategori Dağılımı</div>` +
        sorted.map(([name, ms]) => {
          const pct = Math.round((ms / maxMs) * 100);
          return `<div style="margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
              <span style="color:var(--text-primary);font-weight:500;">${name}</span>
              <span style="color:var(--neon-green);">${msToHM(ms)}</span>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:5px;">
              <div style="background:var(--neon-green);width:${pct}%;height:100%;border-radius:4px;transition:width 0.3s;"></div>
            </div>
          </div>`;
        }).join('');
    }
  }

  // Session list
  const listEl = document.getElementById('sh-list');
  if (!listEl) return;
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;font-size:13px;">Bu dönemde kayıtlı seans yok.</div>';
    return;
  }
  listEl.innerHTML = '';
  filtered.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'streak-card';
    div.style.cssText = 'padding:10px 14px;display:flex;justify-content:space-between;align-items:center;';
    div.innerHTML = `
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${s.name}</div>
        <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">${s.dateLabel} · ${s.type}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:14px;font-weight:bold;color:var(--neon-green);">${msToHM(s.ms)}</span>
        <button onclick="deleteSession(${i})" style="background:none;border:none;color:rgba(255,80,80,0.6);cursor:pointer;font-size:13px;"><i class="fas fa-trash"></i></button>
      </div>`;
    listEl.appendChild(div);
  });
}

window.deleteSession = (idx) => {
  // idx is index in filtered array — rebuild from filter
  const now = new Date();
  const todayStr = getTodayKey();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
  let filtered = sessionHistory;
  if (shCurrentFilter === 'today') filtered = sessionHistory.filter(s => s.date === todayStr);
  else if (shCurrentFilter === 'week') filtered = sessionHistory.filter(s => new Date(s.ts) >= weekAgo);
  else if (shCurrentFilter === 'month') filtered = sessionHistory.filter(s => new Date(s.ts) >= monthAgo);
  const target = filtered[idx];
  if (!target) return;
  const globalIdx = sessionHistory.findIndex(s => s.ts === target.ts && s.name === target.name);
  if (globalIdx > -1) sessionHistory.splice(globalIdx, 1);
  localStorage.setItem('session_history', JSON.stringify(sessionHistory));
  renderSessionHistory();
};

// Filter button wiring
document.querySelectorAll('.sh-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    shCurrentFilter = btn.dataset.filter;
    document.querySelectorAll('.sh-filter-btn').forEach(b => {
      b.style.background = 'none';
      b.style.color = 'var(--text-secondary)';
      b.style.borderColor = 'rgba(255,255,255,0.2)';
    });
    btn.style.background = 'rgba(57,255,20,0.15)';
    btn.style.color = 'var(--neon-green)';
    btn.style.borderColor = 'var(--neon-green)';
    renderSessionHistory();
  });
});

// Re-render history when view is opened
document.querySelectorAll('.nav-sidebar-item').forEach(btn => {
  if (btn.dataset.target === 'worklog-view') {
    btn.addEventListener('click', () => { renderWorkLog(); renderSessionHistory(); });
  }
});

// ===================== DYNAMIC WELCOME CARD (AYET & HADIS) =====================
const DYNAMIC_QUOTES = [
  {
    turkish: `"İnsan için ancak çalıştığı vardır."`,
    arabic: `وَاَنْ لَيْسَ لِلْاِنْسَانِ اِلَّا مَا سَعٰىۙ`,
    ref: `— Necm Suresi, 39. Ayet`
  },
  {
    turkish: `"Öyleyse, bir işi bitirince diğerine koyul."`,
    arabic: `فَاِذَا فَرَغْتَ فَانْصَبْۙ`,
    ref: `— İnşirâh Suresi, 7. Ayet`
  },
  {
    turkish: `"Ölmeyecek olan o diri Allah'a güvenip dayan."`,
    arabic: `وَتَوَكَّلْ عَلَى الْحَيِّ الَّذِي لَا يَمُوتُ`,
    ref: `— Furkân Suresi, 58. Ayet`
  },
  {
    turkish: `"Şüphesiz güçlükle beraber bir kolaylık vardır."`,
    arabic: `اِنَّ مَعَ الْعُسْرِ يُسْرًاۜ`,
    ref: `— İnşirâh Suresi, 6. Ayet`
  },
  {
    turkish: `"Kim Allah'a tevekkül ederse, O ona yeter."`,
    arabic: `وَمَنْ يَتَوَكَّلْ عَلَى اللّٰهِ فَهُوَ حَسْبُهُۜ`,
    ref: `— Talâk Suresi, 3. Ayet`
  },
  {
    turkish: `"Hakkınızda hayırlı olduğu halde bir şeyi sevmeyebilirsiniz."`,
    arabic: `وَعَسٰٓى اَنْ تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَكُمْۚ`,
    ref: `— Bakara Suresi, 216. Ayet`
  },
  {
    turkish: `"Sabret! Zira Allah iyilik edenlerin mükâfatını zayi etmez."`,
    arabic: `وَاصْبِرْ فَاِنَّ اللّٰهَ لَا يُض۪يعُ اَجْرَ الْمُحْسِن۪ينَ`,
    ref: `— Hûd Suresi, 115. Ayet`
  },
  {
    turkish: `"De ki: Herkes kendi karakterine (niyetine) göre iş yapar."`,
    arabic: `قُلْ كُلٌّ يَعْمَلُ عَلٰى شَاكِلَتِه۪ۜ`,
    ref: `— İsrâ Suresi, 84. Ayet`
  },
  {
    turkish: `"Öyleyse güzel bir sabırla sabret."`,
    arabic: `فَاصْبِرْ صَبْرًا جَم۪يلًا`,
    ref: `— Meâric Suresi, 5. Ayet`
  },
  {
    turkish: `"De ki: Rabbim, benim ilmimi artır."`,
    arabic: `وَقُلْ رَبِّ زِدْنِي عِلْمًا`,
    ref: `— Tâhâ Suresi, 114. Ayet`
  },
  {
    turkish: `"Allah, sizden birinizin yaptığı işi en mükemmel şekilde yapmasını sever."`,
    arabic: `إِنَّ اللَّهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلًا أَنْ يُتْقِنَهُ`,
    ref: `— Taberânî, el-Mu’cemü’l-Evsat, 1/275`
  },
  {
    turkish: `"İki nimet vardır ki insanların çoğu bunları değerlendirmekte aldanmıştır: Sağlık ve boş vakit."`,
    arabic: `نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ: الصِّحَّةُ وَالْفَرَاغُ`,
    ref: `— Buhârî, Rikâk 1`
  },
  {
    turkish: `"Ameller ancak niyetlere göredir."`,
    arabic: `إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ`,
    ref: `— Buhârî, Bed'ü'l-Vahy 1`
  },
  {
    turkish: `"İnsanların en hayırlısı, insanlara en faydalı olanıdır."`,
    arabic: `خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ`,
    ref: `— Taberânî, el-Mu’cemü’l-Evsat, 6/58`
  },
  {
    turkish: `"Hayra vesile olan, hayrı yapan gibidir."`,
    arabic: `الدَّالُّ عَلَى الْخَيْرِ كَفَاعِلِهِ`,
    ref: `— Tirmizî, İlim 14`
  },
  {
    turkish: `"Sana fayda veren şeye karşı hırslı ol, Allah'tan yardım dile ve aciz kalma."`,
    arabic: `احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللَّهِ وَلَا تَعْجَزْ`,
    ref: `— Müslim, Kader 34`
  },
  {
    turkish: `"Amellerin en hayırlısı az da olsa devamlı olanıdır."`,
    arabic: `خَيْرُ الْعَمَلِ أَدْوَمُهُ وَإِنْ قَلَّ`,
    ref: `— Buhârî, Rikâk 18`
  },
  {
    turkish: `"Güzel söz sadakadır."`,
    arabic: `الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ`,
    ref: `— Buhârî, Cihâd 128`
  },
  {
    turkish: `"Kolaylaştırın, zorlaştırmayın; müjdeleyin, nefret ettirmeyin."`,
    arabic: `يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا`,
    ref: `— Buhârî, İlim 11`
  },
  {
    turkish: `"Güçlü kimse, güreşte üstün gelen değil; öfke anında kendine hâkim olan kimsedir."`,
    arabic: `لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ`,
    ref: `— Buhârî, Edeb 76`
  }
];

function initDynamicQuote() {
  const arabicEl = document.getElementById('welcome-quote-arabic');
  const turkishEl = document.getElementById('welcome-quote-turkish');
  const refEl = document.getElementById('welcome-quote-ref');
  const modalEl = document.getElementById('welcome-popup-modal');
  if (!turkishEl || !refEl || !modalEl) return;

  const randomIndex = Math.floor(Math.random() * DYNAMIC_QUOTES.length);
  const selected = DYNAMIC_QUOTES[randomIndex];

  if (arabicEl) {
    if (selected.arabic) {
      arabicEl.textContent = selected.arabic;
      arabicEl.style.display = 'block';
    } else {
      arabicEl.style.display = 'none';
    }
  }
  turkishEl.textContent = selected.turkish;
  refEl.textContent = selected.ref;

  // Show the welcome modal on app load
  modalEl.classList.add('active');
}

window.closeWelcomeModal = function() {
  const modalEl = document.getElementById('welcome-popup-modal');
  if (modalEl) {
    modalEl.classList.remove('active');
  }
};

// Init
initDynamicQuote(); renderHabits(); renderStreaks(); renderHatimList(); renderAgenda(); renderWorkLog(); renderZikirs(); renderVocabNum(); renderQuranCustoms(); renderSessionHistory();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) { registration.update(); }
  });
}
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}
checkDailyReminder();
localStorage.removeItem('global_streak_current');
localStorage.removeItem('global_streak_last_active');
localStorage.removeItem('global_streak_start');

// Mobil cihazlarda ve webview'lerde tıklanan/dokunulan giriş alanlarına programatik olarak odaklanarak klavyeyi tetikle
(function() {
  function forceFocusInput(e) {
    const target = e.target;
    if (!target) return;

    // input, textarea, select elementleri veya contenteditable=true olan alanları tespit et
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
    const isContentEditable = target.getAttribute('contenteditable') === 'true' || target.closest('[contenteditable="true"]');

    if (isInput || isContentEditable) {
      // Doğru odaklanılacak elementi belirle (contenteditable alt elemanları için parent contenteditable'a odaklan)
      const elementToFocus = isInput ? target : (target.getAttribute('contenteditable') === 'true' ? target : target.closest('[contenteditable="true"]'));
      
      if (elementToFocus && document.activeElement !== elementToFocus) {
        elementToFocus.focus();
      }
    }
  }

  // Hem touchstart hem de click olayları için bu davranışı zorla
  document.addEventListener('touchstart', forceFocusInput, { passive: true });
  document.addEventListener('click', forceFocusInput);
})();


