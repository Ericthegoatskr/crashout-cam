import { translations } from './i18n.js';
import { SETTINGS_KEY, restoreSettings } from './settings.js';
const $ = id => document.getElementById(id);
const video = $('camera'), button = $('camera-toggle');
let detector;
let defaults, config, stream, worker, running = false, starting = false, busy = false;
let epoch = 0, raf = 0, lastSent = 0, lastVideoTime = -1, current = 'neutral';
let initTimer, frameTimer, rejectInit;
let language = 'en', statusKey = 'preparing', lastError = null;
try { if (localStorage.getItem('red-bird-language') === 'zh-TW') language = 'zh-TW'; } catch {}
const t = key => translations[language][key] ?? translations.en[key] ?? key;

function status(key, live = false) {
  statusKey = key;
  $('status').textContent = t(key);
  $('status-dot').classList.toggle('live', live);
}
function show(state) {
  current = state;
  const item = config.states.find(s => s.id === state);
  $('meme').src = item.image;
  $('meme').alt = t(`state_${state}`);
  document.querySelectorAll('.reaction').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === state)));
}
function errorMessage(error) {
  if (error.name === 'NotAllowedError') return t('permissionError');
  if (error.name === 'NotFoundError') return t('notFoundError');
  if (error.name === 'NotReadableError') return t('busyError');
  return t(error.messageKey || 'genericError');
}
function showError(error) { lastError = error; $('error').textContent = errorMessage(error); $('error').hidden = false; }
function fail(error) {
  console.error('Crashout Cam:', error);
  stop();
  showError(error);
  status('failed');
}
function updateButton() {
  button.disabled = !config;
  button.classList.toggle('is-running', running || starting);
  button.querySelector('span').textContent = t(starting ? 'cancel' : running ? 'stop' : 'start');
  $('preview-hint').textContent = t(running ? 'liveHint' : 'previewHint');
  document.querySelectorAll('.reaction').forEach(b => b.disabled = running || starting);
}
function stop() {
  epoch++;
  running = false; starting = false; busy = false;
  cancelAnimationFrame(raf);
  clearTimeout(initTimer); clearTimeout(frameTimer);
  if (rejectInit) { rejectInit(new DOMException('Cancelled', 'AbortError')); rejectInit = null; }
  worker?.terminate(); worker = null;
  detector?.close(); detector = null;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  video.pause(); video.srcObject = null;
  video.classList.remove('active');
  $('camera-placeholder').hidden = false;
  lastSent = 0; lastVideoTime = -1;
  if (config) show('neutral');
  updateButton(); status('idle');
}
async function start() {
  if (starting || running) { stop(); return; }
  const token = ++epoch;
  starting = true; updateButton(); $('error').hidden = true;
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw { messageKey: 'secureError' };
    }
    status('permission');
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
    if (token !== epoch) { acquired.getTracks().forEach(t => t.stop()); return; }
    stream = acquired;
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (running || starting) fail({ messageKey: 'disconnectedError' }); });
    video.srcObject = stream;
    await video.play();
    if (token !== epoch) return;
    video.classList.add('active'); $('camera-placeholder').hidden = true;
    status('loading');
    const { createDetector, preferMainThread } = await import('./vision-runtime.js');
    if (token !== epoch) return;
    let useMain = preferMainThread() || typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined';
    if (!useMain) {
      try {
        worker = new Worker(new URL('./vision-worker.js', import.meta.url), { type: 'module' });
        await new Promise((resolve, reject) => {
          rejectInit = reject;
          initTimer = setTimeout(() => reject({ messageKey: 'loadingError' }), 90000);
          worker.onerror = event => reject(new Error(event.message));
          worker.onmessage = ({ data }) => {
            if (data.type === 'ready') resolve();
            if (data.type === 'error') reject(new Error(data.message));
          };
          worker.postMessage({ type: 'init', config });
        });
        clearTimeout(initTimer); rejectInit = null;
        if (token !== epoch) return;
      } catch (error) {
        clearTimeout(initTimer); rejectInit = null;
        if (token !== epoch) return;
        console.warn('Background detection unavailable; using camera compatibility mode.', error);
        worker?.terminate(); worker = null;
        useMain = true;
      }
    }
    if (useMain) {
      const acquiredDetector = await createDetector(config);
      if (token !== epoch) { acquiredDetector.close(); return; }
      detector = acquiredDetector;
      detector.configure(config);
    } else {
      worker.postMessage({ type: 'config', config });
      worker.onerror = event => { if (token === epoch) fail(new Error(event.message)); };
      worker.onmessage = ({ data }) => {
        if (token !== epoch) return;
        if (data.type === 'error') { fail(new Error(data.message)); return; }
        if (data.type === 'result') {
          clearTimeout(frameTimer); busy = false;
          if (data.state !== current) show(data.state);
          status(data.faceFound ? 'live' : 'noFace', data.faceFound);
        }
      };
    }
    starting = false; running = true; show('neutral'); updateButton();
    status('live', true);
    raf = requestAnimationFrame(frame);
  } catch (error) { if (token === epoch) fail(error); }
}
async function frame(now) {
  if (!running) return;
  raf = requestAnimationFrame(frame);
  if (busy || video.readyState < 2 || video.currentTime === lastVideoTime || now - lastSent < 1000 / config.maxFps) return;
  const token = epoch;
  busy = true; lastSent = now; lastVideoTime = video.currentTime;
  try {
    if (detector) {
      const result = detector.detect(video, Math.round(now), video.videoWidth / video.videoHeight);
      busy = false;
      if (result.state !== current) show(result.state);
      status(result.faceFound ? 'live' : 'noFace', result.faceFound);
      return;
    }
    const bitmap = await createImageBitmap(video);
    if (!running || token !== epoch) { bitmap.close(); return; }
    frameTimer = setTimeout(() => fail({ messageKey: 'frameError' }), 15000);
    worker.postMessage({ type: 'frame', bitmap, timestamp: Math.round(now), aspect: video.videoWidth / video.videoHeight }, [bitmap]);
  } catch (error) { if (token === epoch) fail(error); }
}
function preview(state) {
  if (running || starting) return;
  show(state); status('preview');
}
function applySettings() {
  config.smileThreshold = (100 - Number($('smile').value)) / 100;
  config.jawThreshold = (100 - Number($('jaw').value)) / 100;
  config.holdMs = Number($('hold').value);
  $('smile-value').value = $('smile').value; $('jaw-value').value = $('jaw').value;
  if (running) {
    if (detector) detector.configure(config);
    else worker.postMessage({ type: 'config', config });
  }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ smileThreshold: config.smileThreshold, jawThreshold: config.jawThreshold, holdMs: config.holdMs })); } catch {}
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('stage').requestFullscreen) await $('stage').requestFullscreen();
    else showError({ messageKey: 'fullscreenUnsupported' });
  } catch { showError({ messageKey: 'fullscreenError' }); }
}
function applyLanguage() {
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant';
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $('language').textContent = language === 'en' ? '繁中' : 'EN';
  $('language').setAttribute('aria-label', language === 'en' ? '切換為繁體中文' : 'Switch to English');
  $('language').lang = language === 'en' ? 'zh-Hant' : 'en';
  $('fullscreen').title = t('fullTitle');
  $('fullscreen').setAttribute('aria-label', t(document.fullscreenElement ? 'fullExit' : 'fullEnter'));
  $('hold').querySelectorAll('option').forEach(option => option.textContent = Number(option.value) === 0 ? t('instant') : `${(Number(option.value) / 1000).toFixed(2)} ${t('seconds')}`);
  $('status').textContent = t(statusKey);
  if (lastError && !$('error').hidden) $('error').textContent = errorMessage(lastError);
  document.querySelectorAll('.reaction').forEach(b => {
    const id = b.dataset.state;
    b.querySelector('strong').textContent = t(`state_${id}`);
    b.querySelector('small').textContent = t(`gesture_${id}`);
    b.setAttribute('aria-label', `${t('previewAction')} ${t(`state_${id}`)}: ${t(`gesture_${id}`)}`);
  });
  if (config) show(current);
  updateButton();
}
$('language').addEventListener('click', () => {
  language = language === 'en' ? 'zh-TW' : 'en';
  try { localStorage.setItem('red-bird-language', language); } catch {}
  applyLanguage();
});
applyLanguage();
button.addEventListener('click', start);
$('fullscreen').addEventListener('click', fullscreen);
document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', t(document.fullscreenElement ? 'fullExit' : 'fullEnter')));
document.addEventListener('keydown', e => {
  if (!config || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
  if (e.code === 'Space' && !/BUTTON|SUMMARY/.test(e.target.tagName)) { e.preventDefault(); start(); }
  if (/^[1-5]$/.test(e.key)) preview(config.states[Number(e.key) - 1].id);
  if (e.key.toLowerCase() === 'f') fullscreen();
});
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden && (running || starting)) stop(); });

try {
  const response = await fetch('./config.json');
  if (!response.ok) throw new Error('Could not load configuration');
  defaults = await response.json(); config = structuredClone(defaults);
  try {
    const readPreferences = key => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } };
    config = restoreSettings(defaults, readPreferences(SETTINGS_KEY), readPreferences('red-bird-settings-v1'));
  } catch {}
  for (const [i, state] of config.states.entries()) {
    const b = document.createElement('button'); b.className = 'reaction'; b.dataset.state = state.id;
    b.setAttribute('aria-pressed', String(i === 0));
    const img = document.createElement('img'); img.src = state.image; img.alt = ''; img.draggable = false;
    const text = document.createElement('span');
    const name = document.createElement('strong');
    const gesture = document.createElement('small');
    const number = document.createElement('span'); number.className = 'number'; number.textContent = `0${i + 1}`;
    text.append(name, gesture); b.append(img, text, number); b.addEventListener('click', () => preview(state.id));
    $('reaction-list').append(b);
    const preload = new Image(); preload.src = state.image;
  }
  const syncControls = () => {
    $('smile').value = Math.round((1 - config.smileThreshold) * 100); $('jaw').value = Math.round((1 - config.jawThreshold) * 100);
    $('hold').value = config.holdMs; $('smile-value').value = $('smile').value; $('jaw-value').value = $('jaw').value;
  };
  syncControls();
  ['smile', 'jaw', 'hold'].forEach(id => $(id).addEventListener('input', applySettings));
  $('reset').addEventListener('click', () => { config = structuredClone(defaults); syncControls(); applySettings(); });
  status('idle'); applyLanguage();
} catch (error) { fail(error); }
