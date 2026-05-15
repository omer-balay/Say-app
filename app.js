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
  if (currentAudioNode) { currentAudioNode.pause(); currentAudioNode = null; }
  if (currentSecondaryNode) { currentSecondaryNode.pause(); currentSecondaryNode = null; }
}

function playAudioFile(type) {
  stopAmbient();
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

  a.play().catch(e => console.log("Audio play failed:", e));
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
  if(navSidebar) navSidebar.classList.add('hidden');
  if(navOverlay) navOverlay.classList.add('hidden');

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
let tmRemaining = 0, tmInterval, tmRunning = false, alarmInterval;
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
    }
    if (!tmRemaining) return;
    tmInputMode.classList.add('hidden'); tmDisplayMode.classList.remove('hidden'); tmResetBtn.disabled = false;
    let last = Date.now();
    tmInterval = setInterval(() => {
      const d = Date.now() - last; last = Date.now();
      tmRemaining -= d; saveWorkTime(d);
      if (tmRemaining <= 0) { tmRemaining = 0; tmDisplayMode.innerHTML = formatTime(0, false); stopTimer(); triggerAlarm(); }
      else tmDisplayMode.innerHTML = formatTime(tmRemaining, false);
    }, 100);
    tmRunning = true; tmStartPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    tmStartPauseBtn.classList.add('running'); tmRing.classList.add('active');
    resumeRhythmicIfTimerStarted();
  }
});
function stopTimer() { clearInterval(tmInterval); tmRunning = false; tmStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>'; tmStartPauseBtn.classList.remove('running'); tmRing.classList.remove('active'); }
function triggerAlarm() { alarmModal.classList.add('active'); playAlarmSound(); alarmInterval = setInterval(playAlarmSound, 2000); }
stopAlarmBtn.addEventListener('click', () => { alarmModal.classList.remove('active'); clearInterval(alarmInterval); });
tmResetBtn.addEventListener('click', () => { tmRemaining = 0; tmDisplayMode.classList.add('hidden'); tmInputMode.classList.remove('hidden'); tmResetBtn.disabled = true; stopTimer(); pauseRhythmicIfTimerStopped(); });

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
function finishPm() { clearInterval(pmInterval); pmRunning = false; pmStartPauseBtn.innerHTML = '<i class="fas fa-play"></i>'; pmRing.classList.remove('active'); triggerAlarm(); initPm(); pauseRhythmicIfTimerStopped(); }
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
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_MONTHS_FULL = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

let selectedMonthIdx = null; // which of the 12 months is expanded

function renderWorkLog() {
  const todayMs = parseInt(localStorage.getItem('worklog_' + getTodayKey()) || '0');
  document.getElementById('wl-today').textContent = msToHM(todayMs);

  // --- Week ---
  let weekMs = 0, weekData = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = 'worklog_' + d.toISOString().slice(0, 10);
    const v = parseInt(localStorage.getItem(k) || '0');
    weekMs += v;
    weekData.push({ day: TR_DAYS[d.getDay()], ms: v, date: d });
  }
  const weekStr = msToHM(weekMs);
  document.getElementById('wl-week').textContent = weekStr;
  const lbScore = document.getElementById('lb-user-score');
  if(lbScore) lbScore.textContent = weekStr;

  // --- Annual (12 months) sum for month card ---
  let yearMs = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const v = parseInt(localStorage.getItem('worklog_' + d.toISOString().slice(0, 10)) || '0');
    yearMs += v;
  }
  document.getElementById('wl-month').textContent = msToHM(yearMs);

  // --- Week list in modal ---
  const wList = document.getElementById('worklog-week-list');
  const wChart = document.getElementById('wl-week-detail');
  const maxW = Math.max(...weekData.map(r => r.ms), 1);
  if (wChart) {
    wChart.innerHTML = '';
    weekData.forEach(r => {
      const pct = Math.round((r.ms / maxW) * 100);
      const dd = String(r.date.getDate()).padStart(2, '0');
      const mm = String(r.date.getMonth() + 1).padStart(2, '0');
      const row = document.createElement('div'); row.className = 'wl-day-bar';
      row.innerHTML = `<span class="wl-day-name">${r.day} ${dd}-${mm}</span><div class="wl-bar-wrap"><div class="wl-bar-fill" style="width:${pct}%"></div></div><span class="wl-day-time">${msToHM(r.ms)}</span>`;
      wChart.appendChild(row);
    });
  }
  if (wList) {
    wList.innerHTML = '';
    weekData.forEach(r => {
      const dd = String(r.date.getDate()).padStart(2, '0');
      const mm = String(r.date.getMonth() + 1).padStart(2, '0');
      const row = document.createElement('div'); row.className = 'worklog-day-row';
      row.innerHTML = `<span>${r.day} ${dd}-${mm}</span><span>${msToHM(r.ms)}</span>`;
      wList.appendChild(row);
    });
  }
}

function renderMonthModal() {
  const container = document.getElementById('worklog-month-12'); if (!container) return;
  const detailEl = document.getElementById('worklog-month-detail');
  container.innerHTML = '';

  // Build 12 months (current month = index 0, going back)
  const now = new Date();
  const months = [];
  for (let m = 0; m < 12; m++) {
    const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const yr = ref.getFullYear(); const mo = ref.getMonth();
    let total = 0;
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `worklog_${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const v = parseInt(localStorage.getItem(key) || '0');
      total += v;
      days.push({ d, ms: v, dayOfWeek: TR_DAYS[new Date(yr, mo, d).getDay()] });
    }
    months.push({ yr, mo, total, days, label: TR_MONTHS[mo] + ' ' + yr });
  }

  const maxMs = Math.max(...months.map(x => x.total), 1);

  months.forEach((mdata, idx) => {
    const pct = Math.round((mdata.total / maxMs) * 100);
    const row = document.createElement('div');
    row.className = 'wl-month-row' + (selectedMonthIdx === idx ? ' selected' : '');
    row.innerHTML = `<span class="wl-month-name">${mdata.label}</span><div class="wl-bar-wrap"><div class="wl-bar-fill" style="width:${pct}%"></div></div><span class="wl-day-time">${msToHM(mdata.total)}</span>`;
    row.addEventListener('click', () => {
      selectedMonthIdx = selectedMonthIdx === idx ? null : idx;
      renderMonthModal();
    });
    container.appendChild(row);

    // If this month is selected, inject the day detail right below it
    if (selectedMonthIdx === idx) {
      const detail = document.createElement('div');
      detail.className = 'wl-month-detail';
      const maxDay = Math.max(...mdata.days.map(d => d.ms), 1);
      detail.innerHTML = `<div class="wl-month-detail-title"><i class="fas fa-calendar"></i> ${TR_MONTHS_FULL[mdata.mo]} ${mdata.yr} — Günlük</div>`;
      const dl = document.createElement('div'); dl.className = 'wl-month-days';
      mdata.days.forEach(day => {
        if (day.ms === 0) return; // only show days with data
        const pctD = Math.round((day.ms / maxDay) * 100);
        const r = document.createElement('div'); r.className = 'wl-month-day-row';
        r.innerHTML = `<span class="wl-month-day-name">${day.dayOfWeek} ${String(day.d).padStart(2, '0')}</span><div class="wl-bar-wrap"><div class="wl-bar-fill" style="width:${pctD}%"></div></div><span class="wl-day-time">${msToHM(day.ms)}</span>`;
        dl.appendChild(r);
      });
      if (dl.children.length === 0) dl.innerHTML = '<div style="color:var(--text-secondary); font-size:12px; text-align:center; padding:8px;">Bu ay kayıt yok.</div>';
      detail.appendChild(dl);
      container.appendChild(detail);
    }
  });
}

document.querySelector('.week-card').addEventListener('click', () => { renderWorkLog(); document.getElementById('wl-week-modal').classList.add('active'); });
document.querySelector('.month-card').addEventListener('click', () => { selectedMonthIdx = null; renderMonthModal(); document.getElementById('wl-month-modal').classList.add('active'); });
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
    let checksHtml = '<div class="habit-daily-checks">';
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10);
      const done = (h.checks || []).includes(ds);
      checksHtml += `<div class="check-day"><div class="check-num${done ? ' done' : ''}" onclick="toggleHabit('${h.name}','${ds}')">${d.getDate()}</div><span>${TR_DAYS[d.getDay()]}</span></div>`;
    }
    card.innerHTML = `<div class="habit-card-top"><span>${h.name}</span><button onclick="deleteHabit('${h.name}')"><i class="fas fa-trash"></i></button></div>${checksHtml += '</div>'}`;
    list.appendChild(card);
  });
  renderHabitSuggestions();
}
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
  if (added) { saveRiyazu(); renderRiyazu(); if(document.getElementById('riyazu-modal').classList.contains('active')) renderRiyazuGrid(); }
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
  {"name":"Fâtiha","ayahs":7}, {"name":"Bakara","ayahs":286}, {"name":"Âl-i İmrân","ayahs":200}, {"name":"Nisâ","ayahs":176},
  {"name":"Mâide","ayahs":120}, {"name":"En'âm","ayahs":165}, {"name":"A'râf","ayahs":206}, {"name":"Enfâl","ayahs":75},
  {"name":"Tevbe","ayahs":129}, {"name":"Yûnus","ayahs":109}, {"name":"Hûd","ayahs":123}, {"name":"Yûsuf","ayahs":111},
  {"name":"Ra'd","ayahs":43}, {"name":"İbrâhîm","ayahs":52}, {"name":"Hicr","ayahs":99}, {"name":"Nahl","ayahs":128},
  {"name":"İsrâ","ayahs":111}, {"name":"Kehf","ayahs":110}, {"name":"Meryem","ayahs":98}, {"name":"Tâhâ","ayahs":135},
  {"name":"Enbiyâ","ayahs":112}, {"name":"Hac","ayahs":78}, {"name":"Mü'minûn","ayahs":118}, {"name":"Nûr","ayahs":64},
  {"name":"Furkan","ayahs":77}, {"name":"Şu'arâ","ayahs":227}, {"name":"Neml","ayahs":93}, {"name":"Kasas","ayahs":88},
  {"name":"Ankebût","ayahs":69}, {"name":"Rûm","ayahs":60}, {"name":"Lokmân","ayahs":34}, {"name":"Secde","ayahs":30},
  {"name":"Ahzâb","ayahs":73}, {"name":"Sebe'","ayahs":54}, {"name":"Fâtır","ayahs":45}, {"name":"Yâsîn","ayahs":83},
  {"name":"Sâffât","ayahs":182}, {"name":"Sâd","ayahs":88}, {"name":"Zümer","ayahs":75}, {"name":"Mü'min","ayahs":85},
  {"name":"Fussilet","ayahs":54}, {"name":"Şûrâ","ayahs":53}, {"name":"Zuhruf","ayahs":89}, {"name":"Duhân","ayahs":59},
  {"name":"Câsiye","ayahs":37}, {"name":"Ahkâf","ayahs":35}, {"name":"Muhammed","ayahs":38}, {"name":"Fetih","ayahs":29},
  {"name":"Hucurât","ayahs":18}, {"name":"Kâf","ayahs":45}, {"name":"Zâriyât","ayahs":60}, {"name":"Tûr","ayahs":49},
  {"name":"Necm","ayahs":62}, {"name":"Kamer","ayahs":55}, {"name":"Rahmân","ayahs":78}, {"name":"Vâkıa","ayahs":96},
  {"name":"Hadîd","ayahs":29}, {"name":"Mücâdele","ayahs":22}, {"name":"Haşr","ayahs":24}, {"name":"Mümtehine","ayahs":13},
  {"name":"Saff","ayahs":14}, {"name":"Cuma","ayahs":11}, {"name":"Münâfikûn","ayahs":11}, {"name":"Tegâbün","ayahs":18},
  {"name":"Talâk","ayahs":12}, {"name":"Tahrîm","ayahs":12}, {"name":"Mülk","ayahs":30}, {"name":"Kalem","ayahs":52},
  {"name":"Hâkka","ayahs":52}, {"name":"Meâric","ayahs":44}, {"name":"Nûh","ayahs":28}, {"name":"Cin","ayahs":28},
  {"name":"Müzzemmil","ayahs":20}, {"name":"Müddessir","ayahs":56}, {"name":"Kıyâme","ayahs":40}, {"name":"İnsân","ayahs":31},
  {"name":"Mürselât","ayahs":50}, {"name":"Nebe","ayahs":40}, {"name":"Nâziât","ayahs":46}, {"name":"Abese","ayahs":42},
  {"name":"Tekvîr","ayahs":29}, {"name":"İnfitâr","ayahs":19}, {"name":"Mutaffifîn","ayahs":36}, {"name":"İnşikâk","ayahs":25},
  {"name":"Bürûc","ayahs":22}, {"name":"Târık","ayahs":17}, {"name":"A'lâ","ayahs":19}, {"name":"Gâşiye","ayahs":26},
  {"name":"Fecr","ayahs":30}, {"name":"Beled","ayahs":20}, {"name":"Şems","ayahs":15}, {"name":"Leyl","ayahs":21},
  {"name":"Duhâ","ayahs":11}, {"name":"İnşirâh","ayahs":8}, {"name":"Tîn","ayahs":8}, {"name":"Alak","ayahs":19},
  {"name":"Kadir","ayahs":5}, {"name":"Beyyine","ayahs":8}, {"name":"Zilzâl","ayahs":8}, {"name":"Âdiyât","ayahs":11},
  {"name":"Kâria","ayahs":11}, {"name":"Tekâsür","ayahs":8}, {"name":"Asr","ayahs":3}, {"name":"Hümeze","ayahs":9},
  {"name":"Fîl","ayahs":5}, {"name":"Kureyş","ayahs":4}, {"name":"Mâûn","ayahs":7}, {"name":"Kevser","ayahs":3},
  {"name":"Kâfirûn","ayahs":6}, {"name":"Nasr","ayahs":3}, {"name":"Tebbet","ayahs":5}, {"name":"İhlâs","ayahs":4},
  {"name":"Felak","ayahs":5}, {"name":"Nâs","ayahs":6}
];

let quranMemo = JSON.parse(localStorage.getItem('quran_memorization') || '{}');
function saveQuranMemo() { localStorage.setItem('quran_memorization', JSON.stringify(quranMemo)); updateQuranSummary(); }

function getSurahMemoPct(sIdx) {
  const ayahs = QURAN_SURAHS[sIdx].ayahs;
  const memoData = quranMemo[sIdx] || {};
  let greenCount = 0;
  for (let i = 1; i <= ayahs; i++) {
    if (memoData[i] === 1) greenCount++;
  }
  return Math.round((greenCount / ayahs) * 100);
}

function updateQuranSummary() {
  let totalAyahs = 0, totalGreen = 0;
  QURAN_SURAHS.forEach((s, idx) => {
    totalAyahs += s.ayahs;
    const memoData = quranMemo[idx] || {};
    for (let i = 1; i <= s.ayahs; i++) {
      if (memoData[i] === 1) totalGreen++;
    }
  });
  const pct = Math.round((totalGreen / totalAyahs) * 100);
  document.getElementById('quran-memorize-summary').textContent = `Toplam Ezber: %${pct} (${totalGreen}/${totalAyahs} Ayet)`;
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
        <div style="width:30px;height:30px;background:rgba(255,255,255,0.1);border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:12px;">${idx+1}</div>
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
  const grid = document.getElementById('quran-ayah-grid');
  grid.innerHTML = '';
  const s = QURAN_SURAHS[activeSurahIdx];
  const memoData = quranMemo[activeSurahIdx] || {};
  
  for (let i = 1; i <= s.ayahs; i++) {
    const status = memoData[i] || 0;
    const cell = document.createElement('div');
    cell.className = 'quran-ayah-cell' + (status > 0 ? ` status-${status}` : '');
    cell.textContent = i;
    cell.onclick = () => {
      let nextStatus = (memoData[i] || 0) + 1;
      if (nextStatus > 3) nextStatus = 0;
      
      if (!quranMemo[activeSurahIdx]) quranMemo[activeSurahIdx] = {};
      if (nextStatus === 0) delete quranMemo[activeSurahIdx][i];
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
if(agendaGridMode && agendaDaysContainer) agendaDaysContainer.classList.add('grid-mode');

document.getElementById('agenda-grid-toggle')?.addEventListener('click', () => {
    agendaGridMode = !agendaGridMode;
    localStorage.setItem('agenda_grid_mode', agendaGridMode);
    if(agendaDaysContainer) {
        if(agendaGridMode) agendaDaysContainer.classList.add('grid-mode');
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
  if(editor) editor.innerHTML = data.note || '';
  renderAgendaTasks(data.tasks);
  document.getElementById('agenda-day-modal').classList.add('active');
}

let notebookMode = localStorage.getItem('agenda_notebook_mode') === 'true';
const notebookWrapper = document.getElementById('agenda-notebook-wrapper');
if(notebookMode && notebookWrapper) notebookWrapper.classList.add('notebook-mode');

document.getElementById('agenda-notebook-toggle')?.addEventListener('click', () => {
    notebookMode = !notebookMode;
    localStorage.setItem('agenda_notebook_mode', notebookMode);
    if(notebookWrapper) {
        if(notebookMode) notebookWrapper.classList.add('notebook-mode');
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
    item.innerHTML = `
      <div style="cursor:pointer; color:${t.done ? 'var(--neon-green)' : 'var(--text-secondary)'}; font-size:16px;" onclick="toggleAgendaTask(${i})">
          <i class="${t.done ? 'fas fa-check-square' : 'far fa-square'}"></i>
      </div>
      <span style="flex:1; font-size:14px; transition:0.3s; ${t.done ? 'text-decoration:line-through; color:var(--text-secondary); opacity:0.6;' : 'color:var(--text-primary);'}">${t.text}</span>
      <button class="agenda-task-del" style="background:none;border:none;color:#ff5050;cursor:pointer;" onclick="deleteAgendaTask(${i})"><i class="fas fa-times"></i></button>`;
    list.appendChild(item);
  });
}

window.toggleAgendaTask = (i) => { const d = getAgendaData(agendaOpenDate); d.tasks[i].done = !d.tasks[i].done; saveAgendaData(agendaOpenDate, d); renderAgendaTasks(d.tasks); renderAgenda(); };
window.deleteAgendaTask = (i) => { const d = getAgendaData(agendaOpenDate); d.tasks.splice(i, 1); saveAgendaData(agendaOpenDate, d); renderAgendaTasks(d.tasks); renderAgenda(); };

document.getElementById('agenda-task-add-btn').addEventListener('click', () => {
  const input = document.getElementById('agenda-task-input');
  const text = input.value.trim(); if (!text) return;
  const d = getAgendaData(agendaOpenDate); d.tasks.push({ text, done: false });
  saveAgendaData(agendaOpenDate, d); renderAgendaTasks(d.tasks); input.value = '';
});
document.getElementById('agenda-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('agenda-task-add-btn').click(); });

window.saveAgendaDay = () => {
  const d = getAgendaData(agendaOpenDate);
  const editor = document.getElementById('agenda-note-editor');
  if(editor) d.note = editor.innerHTML;
  saveAgendaData(agendaOpenDate, d);
  document.getElementById('agenda-day-modal').classList.remove('active');
  renderAgenda();
};
window.closeAgendaModal = () => { document.getElementById('agenda-day-modal').classList.remove('active'); };

// Fullscreen
const fsOverlay = document.getElementById('fs-overlay');
const fsToggleBtn = document.getElementById('fs-toggle-btn');
const fsCloseBtn = document.getElementById('fs-close-btn');
const fsTimeContainer = document.getElementById('fs-time-container');
const fsThemeDisplay = document.getElementById('fs-theme-display');

const fsThemes = ['neon', 'dynamic', 'clean', 'glass', 'retro'];
let currentFsThemeIdx = 0;

if(fsThemeDisplay) {
    fsThemeDisplay.addEventListener('click', (e) => {
        if(e.target === fsThemeDisplay || e.target.classList.contains('fs-time') || e.target.parentElement.id === 'fs-time-container') {
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
    if(userSettings.bg !== "none") {
        document.body.style.backgroundImage = `url('${userSettings.bg}')`;
    } else {
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = userSettings.bgColor;
    }
    if(userSettings.bgType === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
    document.body.style.fontFamily = userSettings.font;
    document.body.style.fontSize = userSettings.fontSize;

    const appLogo = document.getElementById('app-logo-img');
    const settingsLogo = document.getElementById('settings-logo-preview');
    if(userSettings.logoData && userSettings.logoData.length > 0) {
        if(appLogo) { appLogo.src = userSettings.logoData; appLogo.style.display = 'block'; }
        if(settingsLogo) { settingsLogo.src = userSettings.logoData; settingsLogo.style.display = 'block'; }
    }
}
function saveSettings() { localStorage.setItem('app_settings', JSON.stringify(userSettings)); applySettings(); }
applySettings();

const logoUpload = document.getElementById('logo-upload');
if(logoUpload) {
    logoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
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
    if(el.dataset.color === userSettings.color) { document.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('active')); el.classList.add('active'); }
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
    if(el.dataset.bg === userSettings.bg && el.dataset.color === userSettings.bgColor) { document.querySelectorAll('.bg-swatch').forEach(x => x.classList.remove('active')); el.classList.add('active'); }
});

const fontSelect = document.getElementById('font-select');
if(fontSelect) {
    fontSelect.value = userSettings.font;
    fontSelect.addEventListener('change', () => { userSettings.font = fontSelect.value; saveSettings(); });
}

const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeVal = document.getElementById('font-size-val');
if(fontSizeSlider) {
    fontSizeSlider.value = parseInt(userSettings.fontSize);
    fontSizeVal.textContent = fontSizeSlider.value + "px";
    fontSizeSlider.addEventListener('input', () => {
        userSettings.fontSize = fontSizeSlider.value + "px";
        fontSizeVal.textContent = userSettings.fontSize;
        saveSettings();
    });
}

// ===================== 100 HADITH MEMORIZATION =====================
let hadithMemo = JSON.parse(localStorage.getItem('hadith_memorization') || '{}');
function saveHadithMemo() { localStorage.setItem('hadith_memorization', JSON.stringify(hadithMemo)); updateHadithSummary(); }

function updateHadithSummary() {
    let greenCount = 0;
    for (let i = 1; i <= 100; i++) {
        if (hadithMemo[i] === 1) greenCount++;
    }
    const hms = document.getElementById('hadith-memorize-summary');
    if(hms) hms.textContent = `Toplam Ezber: %${greenCount} (${greenCount}/100 Hadis)`;
}

document.getElementById('hadith-memorize-btn')?.addEventListener('click', () => {
    renderHadithGrid();
    document.getElementById('hadith-grid-modal').classList.add('active');
});

function renderHadithGrid() {
    const grid = document.getElementById('hadith-grid');
    if(!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 100; i++) {
        const status = hadithMemo[i] || 0;
        const cell = document.createElement('div');
        cell.className = 'quran-ayah-cell' + (status > 0 ? ` status-${status}` : '');
        cell.textContent = i;
        cell.onclick = () => {
            let nextStatus = (hadithMemo[i] || 0) + 1;
            if (nextStatus > 3) nextStatus = 0;
            if (nextStatus === 0) delete hadithMemo[i];
            else hadithMemo[i] = nextStatus;
            saveHadithMemo();
            renderHadithGrid();
        };
        grid.appendChild(cell);
    }
}
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
    if(!list) return;
    list.innerHTML = '';
    const today = getTodayKey();
    if(!dailyZikir[today]) dailyZikir[today] = {};

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
    if(lastSeen !== today) {
        const modal = document.getElementById('daily-reminder-modal');
        if(modal) {
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
    if(word && meaning) {
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
    if(!list) return;
    list.innerHTML = '';

    vocabData.words.forEach(w => {
        let needsReview = false;
        const daysSinceReview = (now - w.lastReviewed) / msInDay;
        if(w.box === 0 && daysSinceReview >= 1) needsReview = true;
        if(w.box === 1 && daysSinceReview >= 3) needsReview = true;
        if(w.box === 2 && daysSinceReview >= 7) needsReview = true;
        if(w.box === 3 && daysSinceReview >= 15) needsReview = true;
        
        if(needsReview) reviewCount++;
        
        const addedDay = new Date(w.addedAt).toISOString().slice(0, 10);
        if(addedDay === todayStr) dailyCount++;

        const item = document.createElement('div');
        item.className = 'habit-card';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '10px 15px';
        
        let statusHtml = '';
        if(w.box >= 4) statusHtml = '<span style="color:var(--neon-green);font-size:12px;"><i class="fas fa-check-circle"></i> Öğrendim</span> <button class="btn btn-secondary btn-small" onclick="markVocabLearned('+w.id+', false)" style="padding:4px 8px;font-size:10px;margin-left:5px;">İptal</button>';
        else statusHtml = '<button class="btn btn-primary btn-small" onclick="markVocabLearned('+w.id+', true)" style="background:transparent;border:1px solid var(--neon-green);color:var(--neon-green);padding:5px 10px;font-size:11px;margin-right:5px;">Öğrendim</button> <button class="btn btn-secondary btn-small" onclick="markVocabLearned('+w.id+', false)" style="padding:5px 10px;font-size:11px;">Öğrenmedim</button>';

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
    if(dStat) dStat.textContent = `${dailyCount}/${vocabData.target}`;
    const tStat = document.getElementById('vocab-total-stat');
    if(tStat) tStat.textContent = vocabData.words.length;
    
    const rBtn = document.getElementById('vocab-review-btn');
    if(rBtn) {
        if(reviewCount > 0) {
            rBtn.classList.remove('hidden');
            rBtn.textContent = `Tekrar Vakti! (${reviewCount})`;
        } else {
            rBtn.classList.add('hidden');
        }
    }
}

window.markVocabLearned = (id, learned) => {
    const w = vocabData.words.find(x => x.id === id);
    if(!w) return;
    if(learned) w.box = 4;
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
    const today = new Date(); today.setHours(0,0,0,0);
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
    if(input) {
        input.addEventListener('input', () => {
            const len = input.value.length;
            if(len > 2) {
                input.style.width = `${len * 20 + 30}px`;
            } else {
                input.style.width = '70px';
            }
        });
        input.addEventListener('blur', () => {
            if(input.value.trim() === '') {
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

// Init
renderHabits(); renderStreaks(); renderHatimList(); renderAgenda(); renderWorkLog(); renderZikirs(); renderVocabNum(); renderQuranCustoms();
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) { registration.update(); }
    });
}
checkDailyReminder();

document.getElementById('streak-notify-btn')?.addEventListener('click', async () => {
    if (!("Notification" in window)) {
        alert("Tarayıcınız bildirimleri desteklemiyor.");
        return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        alert("Bildirimler açıldı! Zincir hedeflerinizi unutmamak için her gün hatırlatma alacaksınız.");
        new Notification("Sa'y", { body: "Zinciri kırma hatırlatıcıları aktif edildi!" });
    } else {
        alert("Bildirim izni verilmedi.");
    }
});


