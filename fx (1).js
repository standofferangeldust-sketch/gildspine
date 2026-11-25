/* ==========================================================================
   GILDSPINE — Stay Gold
   js/fx.js  ·  Премиальные эффекты одним автономным скриптом

   1. Золотой курсор-стрелка (22×22) с деликатным шлейфом из пылинок
      (только устройства с мышью)
   2. Мягкий саунд-дизайн на Web Audio API (без аудиофайлов):
      тёплый басовый пэд + бархатные суб-басовые отклики на hover и клики;
      кнопка звука двуязычная (ЗВУК: ВКЛ / SOUND: ON)
   3. Cipher Reveal — «расшифровка» заголовков и заблокированных элементов
   4. Кинематографичные переходы между страницами

   ПОДКЛЮЧЕНИЕ — на каждой странице, в <head>, БЕЗ defer
   (скрипт должен выполниться до первой отрисовки, иначе при загрузке
   будет заметна вспышка контента перед затемнением):

     <script src="js/fx.js"></script>

   Скрипт сам внедряет свои стили и элементы; CSS-файл менять не нужно.
   Язык кнопки звука берётся из js/i18n.js (GildspineI18n.getLang() →
   localStorage «gildspine-lang» → атрибут lang → язык браузера) и меняется
   мгновенно при клике по переключателю RU / EN.

   Уважает prefers-reduced-motion: без пылинок, расшифровки и переходов.

   Публичный API (необязательно): window.GildspineFX
     .sound.isOn() / .sound.set(true|false)
     .cipher.run(element)         — запустить расшифровку текста элемента
   ========================================================================== */

(function () {
  'use strict';

  if (window.GildspineFX) return;

  var doc = document;
  var html = doc.documentElement;
  var mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function reduced() {
    return !!mqReduced.matches;
  }

  /* ------------------------------------------------------------------------
     КОНФИГУРАЦИЯ
     ------------------------------------------------------------------------ */
  var CFG = {
    storageKey: 'gildspine-sound',
    langKey: 'gildspine-lang',      // тот же ключ, что использует js/i18n.js
    fadeInMs: 900,
    fadeOutMs: 460,
    ambientLevel: 0.06              // итоговый gain фонового пэда
  };

  /* Интерактивные элементы: общие для курсора и звука */
  var INTERACTIVE = [
    'a[href]', 'button:not(:disabled)', '[role="button"]', '[role="tab"]', 'summary', 'select',
    'input[type="range"]', 'input[type="checkbox"]', 'input[type="radio"]', 'input[type="submit"]',
    'label[for]', '.snippet', '[data-cursor="hover"]'
  ].join(',');

  var TEXT_FIELDS = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea, [contenteditable="true"]';

  function interactiveOf(target) {
    return target && target.closest ? target.closest(INTERACTIVE) : null;
  }

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function safe(name, fn) {
    try {
      return fn();
    } catch (err) {
      if (window.console && console.warn) console.warn('[fx] ' + name + ' отключён:', err);
      return null;
    }
  }

  /* ------------------------------------------------------------------------
     СТИЛИ (внедряются сразу — до первой отрисовки)
     ------------------------------------------------------------------------ */
  var CSS = [
    /* --- переходы между страницами --- */
    'html.fx-enter{background:#0a0a0f}',
    'html.fx-enter body{opacity:0}',
    'html.fx-anim body{transition:opacity ' + CFG.fadeInMs + 'ms cubic-bezier(.22,.61,.36,1)}',
    'html.fx-leave{background:#0a0a0f}',
    'html.fx-leave body{opacity:0;transition-duration:' + CFG.fadeOutMs + 'ms}',

    /* --- корневой слой эффектов (вне body, поэтому не гаснет при переходах) --- */
    '#fx-root{position:fixed;inset:0;z-index:100000;pointer-events:none}',

    '.fx-bar{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#8a6d12,#c9a227,#f6dd86);',
    'box-shadow:0 0 12px rgba(201,162,39,.8);transform:scaleX(0);transform-origin:left;opacity:0;',
    'transition:transform ' + CFG.fadeOutMs + 'ms cubic-bezier(.22,.61,.36,1),opacity .2s}',
    '.fx-bar.is-active{transform:scaleX(1);opacity:1}',

    /* --- курсор: компактная стрелка 22×22, тёмный центр + золотая обводка --- */
    'html.fx-cursor-on,html.fx-cursor-on *{cursor:none!important}',
    'html.fx-cursor-on input[type="text"],html.fx-cursor-on input[type="email"],html.fx-cursor-on input[type="search"],',
    'html.fx-cursor-on input[type="url"],html.fx-cursor-on input[type="tel"],html.fx-cursor-on textarea,',
    'html.fx-cursor-on [contenteditable="true"]{cursor:text!important}',

    '.fx-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',

    '.fx-arrow{position:absolute;left:0;top:0;width:22px;height:22px;margin:-1.6px 0 0 -1.6px;pointer-events:none;',
    'opacity:0;will-change:transform;transition:opacity .2s}',
    '.fx-arrow.is-visible{opacity:1}',
    '.fx-arrow.is-text{opacity:0}',
    '.fx-arrow svg{display:block;filter:drop-shadow(0 0 2px rgba(201,162,39,.85)) drop-shadow(0 0 7px rgba(201,162,39,.4));',
    'transition:filter .25s ease}',
    /* на кликабельных элементах меняется только оттенок свечения — размер прежний */
    '.fx-arrow.is-hover svg{filter:drop-shadow(0 0 2px rgba(139,0,0,.95)) drop-shadow(0 0 8px rgba(139,0,0,.75))}',

    /* --- кнопка звука --- */
    '.fx-sound{position:absolute;right:max(1rem,env(safe-area-inset-right,0px));bottom:max(1rem,env(safe-area-inset-bottom,0px));',
    'pointer-events:auto;display:inline-flex;align-items:center;gap:.65rem;min-height:40px;padding:.5rem .95rem;',
    "font:500 .72rem/1 'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.1em;",
    'color:#c9a227;background:rgba(10,10,15,.84);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
    'border:1px solid rgba(201,162,39,.55);border-radius:3px;cursor:pointer;-webkit-tap-highlight-color:transparent;',
    'transition:color .25s,border-color .25s,box-shadow .35s,background-color .25s}',
    '.fx-sound:hover{color:#e6c457;border-color:#c9a227;box-shadow:0 0 18px rgba(201,162,39,.35)}',
    '.fx-sound:focus-visible{outline:2px solid #e6c457;outline-offset:3px}',
    '.fx-sound[aria-pressed="true"]{border-color:#c9a227;box-shadow:0 0 16px rgba(201,162,39,.28),inset 0 0 12px rgba(201,162,39,.08)}',
    '.fx-sound__bars{display:inline-flex;align-items:flex-end;gap:2px;height:12px}',
    '.fx-sound__bars i{display:block;width:2px;height:30%;background:currentColor;border-radius:1px;transition:height .3s}',
    '.fx-sound[aria-pressed="true"] .fx-sound__bars i{animation:fx-eq .9s ease-in-out infinite alternate}',
    '.fx-sound[aria-pressed="true"] .fx-sound__bars i:nth-child(2){animation-delay:-.3s}',
    '.fx-sound[aria-pressed="true"] .fx-sound__bars i:nth-child(3){animation-delay:-.6s}',
    '@keyframes fx-eq{from{height:25%}to{height:100%}}',
    '@media (pointer:coarse){.fx-sound{min-height:44px}}',
    '@media print{#fx-root{display:none!important}}'
  ].join('');

  (function injectStyle() {
    var style = doc.createElement('style');
    style.id = 'fx-style';
    style.textContent = CSS;
    (doc.head || html).appendChild(style);
  })();

  /* ------------------------------------------------------------------------
     4. ПЕРЕХОДЫ — часть «до отрисовки»: страница стартует из чёрного
     ------------------------------------------------------------------------ */
  var transitionsOn = !reduced();
  var gateResolve;
  var gate = new Promise(function (resolve) { gateResolve = resolve; });

  if (transitionsOn) {
    html.classList.add('fx-enter');
    // страховка: если что-то пойдёт не так, страница не останется чёрной
    window.setTimeout(function () { html.classList.remove('fx-enter'); }, 3500);
  } else {
    gateResolve();
  }

  function isMobileDevice() {
    var ua = navigator.userAgent || '';
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return !!(coarse || ios || /Android/i.test(ua) || window.innerWidth < 768);
  }

  function noop() {}

  /* Текущий язык сайта — тем же способом, что и js/i18n.js:
     API i18n → localStorage → атрибут lang → язык браузера */
  function detectLang() {
    try {
      var api = window.GildspineI18n;
      if (api && typeof api.getLang === 'function') {
        var fromApi = api.getLang();
        if (fromApi === 'ru' || fromApi === 'en') return fromApi;
      }
    } catch (e) { /* продолжаем */ }

    try {
      var stored = window.localStorage.getItem(CFG.langKey);
      if (stored === 'ru' || stored === 'en') return stored;
    } catch (e) { /* localStorage недоступен */ }

    var attr = (html.getAttribute('lang') || '').toLowerCase().slice(0, 2);
    if (attr === 'ru' || attr === 'en') return attr;

    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ru'];
    return /^(ru|be|uk|kk)/.test(String(list[0] || '').toLowerCase()) ? 'ru' : 'en';
  }

  /* ========================================================================
     2. ЗВУК — мягкий, глубокий, без высоких частот и шума
     ------------------------------------------------------------------------
     • фон: тёплый басовый пэд — синус и треугольник на 55 Гц и 82.4 Гц через
       строгий lowpass 140 Гц (два каскада), нарастание ~2 с до gain 0.06;
     • hover / клик: короткий приглушённый суб-басовый импульс 65–110 Гц
       через lowpass 180 Гц, gain 0.03–0.05;
     • все изменения громкости — через setTargetAtTime (без щелчков);
     • на мобильных: без LFO и генеративных нот, latencyHint «playback»,
       audioCtx.resume() привязан к первому же касанию.
     ======================================================================== */
  var LABELS = {
    ru: {
      on: 'ЗВУК: ВКЛ',
      off: 'ЗВУК: ВЫКЛ',
      ariaOn: 'Звук включён. Нажмите, чтобы выключить',
      ariaOff: 'Звук выключен. Нажмите, чтобы включить'
    },
    en: {
      on: 'SOUND: ON',
      off: 'SOUND: OFF',
      ariaOn: 'Sound is on. Press to turn off',
      ariaOff: 'Sound is off. Press to turn on'
    }
  };

  function createSound(rootEl) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;

    var MOBILE = isMobileDevice();
    var HOVER_NOTES = [65.41, 73.42, 82.41, 98, 110];
    var CLICK_NOTES = [65.41, 73.42, 82.41];
    var SWELL_NOTES = [65.41, 73.42, 98, 110];

    var on = readPref() === '1';
    var lang = detectLang();
    var ctx = null;
    var master = null;
    var ambientGain = null;
    var voiceBus = null;
    var uiBus = null;
    var active = false;        // фон сейчас звучит
    var hiddenPaused = false;  // вкладка скрыта — звук приглушён
    var gestureArmed = false;
    var timers = [];
    var suspendTimer = 0;
    var hiddenTimer = 0;
    var lastHover = null;
    var lastHoverAt = 0;
    var voices = 0;
    var btn;
    var labelEl;

    /* ---------- хранение ---------- */
    function readPref() {
      try { return window.localStorage.getItem(CFG.storageKey); } catch (e) { return null; }
    }

    function savePref() {
      try { window.localStorage.setItem(CFG.storageKey, on ? '1' : '0'); } catch (e) { /* без сохранения */ }
    }

    /* ---------- кнопка ---------- */
    function buildButton() {
      btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'fx-sound';

      var bars = doc.createElement('span');
      bars.className = 'fx-sound__bars';
      bars.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 3; i++) bars.appendChild(doc.createElement('i'));

      labelEl = doc.createElement('span');
      labelEl.className = 'fx-sound__label';

      btn.appendChild(bars);
      btn.appendChild(labelEl);
      btn.addEventListener('click', onToggle);
      rootEl.appendChild(btn);
    }

    function render() {
      var L = LABELS[lang] || LABELS.ru;
      labelEl.textContent = on ? L.on : L.off;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? L.ariaOn : L.ariaOff);
      btn.setAttribute('lang', lang);
    }

    function refreshLang(forced) {
      var next = forced || detectLang();
      if (next === lang) return;
      lang = next;
      render();
    }

    /* ---------- плавная автоматизация параметров (без щелчков) ---------- */
    function smoothTo(param, value, timeConstant) {
      if (!ctx || !param) return;
      var now = ctx.currentTime;
      try {
        if (typeof param.cancelAndHoldAtTime === 'function') {
          param.cancelAndHoldAtTime(now);
        } else {
          param.cancelScheduledValues(now);
          param.setValueAtTime(param.value, now);
        }
      } catch (e) { /* продолжаем — setTargetAtTime всё равно сгладит */ }
      param.setTargetAtTime(value, now, timeConstant);
    }

    /* ---------- граф ---------- */
    function ensureCtx() {
      if (ctx) return ctx;
      try {
        ctx = MOBILE ? new AC({ latencyHint: 'playback' }) : new AC();
      } catch (e) {
        ctx = new AC();
      }
      try {
        // iOS: звук должен идти и при включённом беззвучном режиме
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch (e) { /* не поддерживается */ }
      ctx.onstatechange = handleState;
      buildGraph();
      return ctx;
    }

    function lowpass(freq, q) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    }

    function buildGraph() {
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);

      // фон: голоса → строгий lowpass 140 Гц (2 каскада, 24 дБ/окт) → ambientGain → master
      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0;
      ambientGain.connect(master);

      var lp1 = lowpass(140, 0.5);
      var lp2 = lowpass(140, 0.5);
      lp1.connect(lp2);
      lp2.connect(ambientGain);

      voiceBus = ctx.createGain();
      voiceBus.gain.value = 1;
      voiceBus.connect(lp1);

      var triBus = ctx.createGain();
      triBus.gain.value = 1;
      triBus.connect(voiceBus);

      function voice(type, freq, detune, level, dest) {
        var o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        var g = ctx.createGain();
        g.gain.value = level;
        o.connect(g);
        g.connect(dest);
        o.start();
      }

      // чистые синус и треугольник: 55 Гц и 82.4 Гц (сумма уровней = 1.0)
      voice('sine', 55, 0, 0.45, voiceBus);
      voice('triangle', 55, 5, 0.2, triBus);
      voice('sine', 82.4, 0, 0.25, voiceBus);
      voice('triangle', 82.4, -4, 0.1, triBus);

      // единственный лёгкий LFO — только на десктопе: едва заметное «дыхание» треугольных голосов
      if (!MOBILE) {
        triBus.gain.value = 0.65;
        var lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.045;
        var lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 0.35;
        lfo.connect(lfoDepth);
        lfoDepth.connect(triBus.gain);
        lfo.start();
      }

      uiBus = ctx.createGain();
      uiBus.gain.value = 1;
      uiBus.connect(master);
    }

    /* ---------- состояние ---------- */
    function audible() {
      return !!(active && ctx && ctx.state === 'running' && !hiddenPaused);
    }

    function clearTimers() {
      timers.forEach(function (id) { window.clearTimeout(id); });
      timers = [];
    }

    // редкие низкие ноты поверх пэда (только десктоп), тот же строгий lowpass
    function swell() {
      if (MOBILE || !audible()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = pick(SWELL_NOTES);
      var g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.35, t, 1.6);
      g.gain.setTargetAtTime(0, t + 5, 2.2);
      o.connect(g);
      g.connect(voiceBus);
      o.start(t);
      o.stop(t + 5 + 2.2 * 8);
    }

    function scheduleEvents() {
      clearTimers();
      if (MOBILE) return; // на телефонах — ровный пэд без дополнительных событий
      (function next() {
        var id = window.setTimeout(function () {
          if (!active) return;
          swell();
          next();
        }, 14000 + Math.random() * 10000);
        timers.push(id);
      })();
    }

    /* ---------- UI-звуки: бархатный суб-бас ---------- */
    function softPulse(freq, peak, hold, tail) {
      if (!audible() || voices >= 5) return;
      var t = ctx.currentTime;

      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 1.1, t);
      o.frequency.setTargetAtTime(freq, t, 0.03);

      var lp = lowpass(180, 0.5);

      var g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(peak, t, 0.012);       // мягкая атака
      g.gain.setTargetAtTime(0, t + hold, tail);    // мягкое затухание

      o.connect(lp);
      lp.connect(g);
      g.connect(uiBus);

      voices++;
      o.onended = function () { voices = Math.max(0, voices - 1); };
      o.start(t);
      o.stop(t + hold + tail * 8);
    }

    function hoverSound() { softPulse(pick(HOVER_NOTES), 0.03, 0.03, 0.07); }
    function clickSound() { softPulse(pick(CLICK_NOTES), 0.05, 0.05, 0.11); }

    /* ---------- запуск / остановка ---------- */
    function start(withPulse) {
      if (!ctx || !on) return;
      window.clearTimeout(suspendTimer);
      active = true;
      disarmGesture();
      smoothTo(ambientGain.gain, CFG.ambientLevel, 0.5); // ≈2 с до уровня 0.06
      scheduleEvents();
      if (withPulse) clickSound();
    }

    function stop() {
      active = false;
      clearTimers();
      if (!ctx) return;
      smoothTo(ambientGain.gain, 0, 0.25);
      window.clearTimeout(suspendTimer);
      suspendTimer = window.setTimeout(function () {
        if (!active && ctx && ctx.state === 'running') ctx.suspend();
      }, 2000);
    }

    // вызывается из жеста пользователя
    function activate(withPulse) {
      try {
        ensureCtx();
        playSilent();
        var p = ctx.resume();
        var go = function () { if (on) start(withPulse); };
        if (p && typeof p.then === 'function') p.then(go, armGesture);
        else go();
      } catch (err) {
        armGesture();
      }
    }

    // iOS: тихий буфер в момент жеста окончательно «разблокирует» аудио
    function playSilent() {
      try {
        var buf = ctx.createBuffer(1, 1, 22050);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (e) { /* не критично */ }
    }

    /* ---------- первое касание: resume() ---------- */
    var GESTURES = ['touchstart', 'pointerdown', 'touchend', 'pointerup', 'click', 'keydown'];

    function onGesture(e) {
      if (btn && btn.contains(e.target)) return;   // клик по самой кнопке обработает onToggle
      if (!ctx) {
        if (!on) return;
        ensureCtx();
      }
      if (ctx.state !== 'running') {
        try {
          var p = ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(noop);
        } catch (err) { /* ждём следующий жест */ }
        playSilent();
      }
      if (ctx.state === 'running') {
        disarmGesture();
        if (on && !active) start(false);
      }
    }

    function armGesture() {
      if (gestureArmed) return;
      gestureArmed = true;
      GESTURES.forEach(function (ev) {
        doc.addEventListener(ev, onGesture, { capture: true, passive: true });
      });
    }

    function disarmGesture() {
      if (!gestureArmed) return;
      gestureArmed = false;
      GESTURES.forEach(function (ev) {
        doc.removeEventListener(ev, onGesture, true);
      });
    }

    // контекст остановили извне (звонок, смена вкладки, iOS «interrupted») или он запустился
    function handleState() {
      if (!ctx) return;
      if (ctx.state === 'running') {
        disarmGesture();
        if (on && !hiddenPaused && !doc.hidden) start(false);
      } else if (on && active && !hiddenPaused && !doc.hidden) {
        active = false;
        clearTimers();
        armGesture();
      }
    }

    /* ---------- переключатель ---------- */
    function setOn(value) {
      on = !!value;
      savePref();
      render();
      if (on) {
        activate(true);
      } else {
        disarmGesture();
        stop();
      }
    }

    function onToggle() {
      if (on && !active) {   // звук «включён», но ждал жеста — этот клик и есть жест
        activate(true);
        return;
      }
      setOn(!on);
    }

    /* ---------- события страницы ---------- */
    doc.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      var el = interactiveOf(e.target);
      if (el === lastHover) return;
      lastHover = el;
      if (!el || !audible()) return;
      var now = performance.now();
      if (now - lastHoverAt < 90) return;
      lastHoverAt = now;
      hoverSound();
    });

    doc.addEventListener('pointerdown', function (e) {
      if (!audible() || !interactiveOf(e.target)) return;
      clickSound();
    });

    doc.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (doc.hidden) {
        if (active) {
          hiddenPaused = true;
          smoothTo(ambientGain.gain, 0, 0.08);
          window.clearTimeout(hiddenTimer);
          hiddenTimer = window.setTimeout(function () {
            if (hiddenPaused && ctx.state === 'running') ctx.suspend();
          }, 600);
        }
      } else if (hiddenPaused) {
        hiddenPaused = false;
        window.clearTimeout(hiddenTimer);
        var p = ctx.resume();
        armGesture(); // на iOS resume без касания может не сработать — подстрахуемся
        var back = function () { if (on && ctx.state === 'running') start(false); };
        if (p && typeof p.then === 'function') p.then(back, noop); else back();
      }
    });

    /* ---------- язык кнопки: RU / EN ---------- */
    doc.addEventListener('gildspine:languagechange', function () { refreshLang(); });

    // клик по переключателю языка в шапке — меняем подпись мгновенно
    doc.addEventListener('click', function (e) {
      var sw = e.target && e.target.closest ? e.target.closest('[data-set-lang]') : null;
      if (!sw) return;
      var picked = sw.getAttribute('data-set-lang');
      if (picked === 'ru' || picked === 'en') refreshLang(picked);
      window.setTimeout(function () { refreshLang(); }, 0); // сверяемся с i18n / localStorage
    }, true);

    // смена атрибута lang на <html> и изменение localStorage (в т.ч. из другой вкладки)
    if ('MutationObserver' in window) {
      new MutationObserver(function () { refreshLang(); })
        .observe(html, { attributes: true, attributeFilter: ['lang'] });
    }
    window.addEventListener('storage', function (e) {
      if (e.key === CFG.langKey) refreshLang();
    });

    /* ---------- старт ---------- */
    buildButton();
    render();

    if (on) {
      // пробуем стартовать сразу (если браузер разрешает); иначе ждём первое касание
      armGesture();
      try {
        ensureCtx();
        var attempt = ctx.resume();
        if (attempt && typeof attempt.then === 'function') {
          attempt.then(function () {
            if (on && !active && ctx.state === 'running') start(false);
          }, noop);
        }
      } catch (err) { /* остаёмся в ожидании жеста */ }
    }

    return {
      isOn: function () { return on; },
      set: setOn,
      // плавно приглушаем звук перед уходом со страницы
      duck: function () { if (active && ctx) smoothTo(ambientGain.gain, 0, 0.12); }
    };
  }

  /* ========================================================================
     1. КУРСОР — компактная стрелка 22×22 и деликатный шлейф из пылинок
     ======================================================================== */
  var ARROW_SVG =
    '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M1.6 1.6 V17.4 L5.9 13.5 L8.9 20.3 L11.8 19 L8.8 12.3 H14.6 Z" ' +
    'fill="#0a0a0f" stroke="#c9a227" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  function createCursor(rootEl) {
    var mq = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };

    var arrowEl, canvas, ctx2d;
    var enabled = false;
    var built = false;
    var visible = false;
    var width = 0;
    var height = 0;
    var dpr = 1;
    var prev = { x: 0, y: 0 };
    var dust = [];
    var lastDustAt = 0;
    var lastFrame = 0;
    var rafId = 0;

    function build() {
      if (built) return;
      arrowEl = doc.createElement('div');
      arrowEl.className = 'fx-arrow';
      arrowEl.setAttribute('aria-hidden', 'true');
      arrowEl.innerHTML = ARROW_SVG; // константная разметка

      canvas = doc.createElement('canvas');
      canvas.className = 'fx-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      ctx2d = canvas.getContext('2d');

      rootEl.insertBefore(canvas, rootEl.firstChild);
      rootEl.appendChild(arrowEl);
      built = true;
    }

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function setVisible(v) {
      visible = v;
      arrowEl.classList.toggle('is-visible', v);
    }

    /* ---------- пылинки: крошечные (2–3 px), короткоживущие, полупрозрачные ---------- */
    function spawnDust(x, y, dx, dy) {
      dust.push({
        x: x + 1 + (Math.random() - 0.5) * 4,
        y: y + 2 + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 9 - dx * 0.25,
        vy: (Math.random() - 0.5) * 9 - dy * 0.25 + 3,
        age: 0,
        life: 380 + Math.random() * 320,
        r: 0.9 + Math.random() * 0.7,
        a: 0.3 + Math.random() * 0.25
      });
      if (dust.length > 36) dust.shift();
    }

    function draw(dt) {
      ctx2d.clearRect(0, 0, width, height);
      for (var i = dust.length - 1; i >= 0; i--) {
        var p = dust[i];
        p.age += dt * 1000;
        if (p.age >= p.life) { dust.splice(i, 1); continue; }
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        var k = 1 - p.age / p.life;
        ctx2d.fillStyle = 'rgba(201,162,39,' + (p.a * k).toFixed(3) + ')';
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx2d.fill();
      }
    }

    function frame(now) {
      rafId = 0;
      var dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      draw(dt);
      if (enabled && dust.length) rafId = window.requestAnimationFrame(frame);
    }

    function kick() {
      if (rafId || !enabled) return;
      lastFrame = performance.now();
      rafId = window.requestAnimationFrame(frame);
    }

    /* ---------- события ---------- */
    function onMove(e) {
      if (e.pointerType === 'touch') { disable(true); return; }
      var x = e.clientX;
      var y = e.clientY;
      arrowEl.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';

      if (!visible) {
        prev.x = x;
        prev.y = y;
        setVisible(true);
      }

      if (!reduced()) {
        var now = performance.now();
        var dx = x - prev.x;
        var dy = y - prev.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2 && now - lastDustAt > 26) {
          spawnDust(x, y, dx, dy);
          if (dist > 18 && Math.random() < 0.4) spawnDust(x - dx * 0.5, y - dy * 0.5, dx, dy);
          lastDustAt = now;
          kick();
        }
      }
      prev.x = x;
      prev.y = y;
    }

    function onOver(e) {
      var target = e.target;
      if (target && target.closest && target.closest('iframe')) {
        setVisible(false);
        return;
      }
      var isText = !!(target && target.closest && target.closest(TEXT_FIELDS));
      arrowEl.classList.toggle('is-text', isText);
      // на кликабельных элементах меняется только оттенок свечения
      arrowEl.classList.toggle('is-hover', !!interactiveOf(target));
    }

    function onLeave() {
      setVisible(false);
    }

    function onBlur() {
      setVisible(false);
    }

    function enable() {
      if (enabled || !mq.matches) return;
      build();
      resize();
      enabled = true;
      html.classList.add('fx-cursor-on');
      window.addEventListener('pointermove', onMove, { passive: true });
      doc.addEventListener('pointerover', onOver, true);
      html.addEventListener('mouseleave', onLeave);
      window.addEventListener('blur', onBlur);
      window.addEventListener('resize', resize);
    }

    /* touched=true: пользователь коснулся экрана → курсор отключаем,
       но вернём, как только появится реальное движение мыши */
    function disable(touched) {
      if (!enabled) return;
      enabled = false;
      html.classList.remove('fx-cursor-on');
      window.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerover', onOver, true);
      html.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
      if (built) {
        setVisible(false);
        dust.length = 0;
        ctx2d.clearRect(0, 0, width, height);
      }
      if (touched) armReenable();
    }

    function armReenable() {
      function check(e) {
        if (e.pointerType === 'mouse' && mq.matches) {
          window.removeEventListener('pointermove', check);
          enable();
        }
      }
      window.addEventListener('pointermove', check, { passive: true });
    }

    function sync() {
      if (mq.matches) enable();
      else disable(false);
    }

    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
    sync();

    return { enable: enable, disable: disable };
  }

  /* ========================================================================
     3. CIPHER REVEAL
     ======================================================================== */
  var GLYPHS = '#∆Ω01✦ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ▓▒░◆◇✕/\\|<>{}[]=+*%$@&';
  var KEEP = /[\s.,:;!?()«»"'’“”—–\-/&+·|]/;
  var states = new Map(); // element → { final, raf, last, tick, minHeight, aria }

  function randomGlyph() {
    return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
  }

  function releaseState(el, st) {
    if (st.raf) window.cancelAnimationFrame(st.raf);
    el.style.minHeight = st.minHeight;
    if (st.hadAria) el.setAttribute('aria-label', st.aria);
    else el.removeAttribute('aria-label');
    states.delete(el);
  }

  /* Текст элемента пробегает через случайные символы и складывается в оригинал.
     Если за это время текст изменил кто-то другой (например, i18n.js) — анимация
     тихо прекращается и ничего не перезаписывает. */
  function runCipher(el, durationOverride) {
    if (!el || !el.isConnected || reduced()) return;

    var prevState = states.get(el);
    var finalText = prevState ? prevState.final : el.textContent;
    if (prevState) releaseState(el, prevState);
    if (!finalText || !finalText.trim()) return;

    var chars = Array.from(finalText);
    var n = chars.length;
    var duration = durationOverride || Math.min(1300, 520 + n * 30);
    var revealAt = chars.map(function (c, i) {
      return KEEP.test(c) ? 0 : (i / n) * duration * 0.72 + Math.random() * duration * 0.28;
    });

    var st = {
      final: finalText,
      raf: 0,
      last: el.textContent,
      tick: 0,
      minHeight: el.style.minHeight,
      hadAria: el.hasAttribute('aria-label'),
      aria: el.getAttribute('aria-label')
    };
    states.set(el, st);

    // фиксируем высоту, чтобы вёрстка не «прыгала» от символов разной ширины
    var h = el.offsetHeight;
    if (h) el.style.minHeight = h + 'px';
    el.setAttribute('aria-label', finalText.trim());

    var startedAt = performance.now();

    function step(now) {
      st.raf = 0;
      if (!el.isConnected || el.textContent !== st.last) {  // текст изменили снаружи
        releaseState(el, st);
        return;
      }
      if (now - st.tick < 42) {
        st.raf = window.requestAnimationFrame(step);
        return;
      }
      st.tick = now;

      var t = now - startedAt;
      var out = '';
      var done = true;
      for (var i = 0; i < n; i++) {
        if (t >= revealAt[i]) {
          out += chars[i];
        } else {
          done = false;
          out += KEEP.test(chars[i]) ? chars[i] : randomGlyph();
        }
      }

      if (done) {
        el.textContent = finalText;
        releaseState(el, st);
        return;
      }
      st.last = out;
      el.textContent = out;
      st.raf = window.requestAnimationFrame(step);
    }

    st.raf = window.requestAnimationFrame(step);
  }

  /* Смена языка: i18n уже подставил новый текст — просто прекращаем анимации */
  doc.addEventListener('gildspine:languagechange', function () {
    states.forEach(function (st, el) { releaseState(el, st); });
  });

  function initCipher() {
    if (reduced()) return;

    /* ---- заголовки h1 / h2 при появлении на экране ---- */
    var seen = new WeakSet();

    function eligible(h) {
      return !h.children.length &&
        !h.closest('footer, .site-footer, .sr-only') &&
        !h.hasAttribute('data-no-cipher') &&
        h.textContent.trim().length > 1;
    }

    var io = ('IntersectionObserver' in window)
      ? new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            io.unobserve(el);
            gate.then(function () {
              if (el.isConnected && eligible(el)) runCipher(el);
            });
          });
        }, { threshold: 0.4 })
      : null;

    function watch(h) {
      if (!io || seen.has(h) || !eligible(h)) return;
      seen.add(h);
      io.observe(h);
    }

    function scan(root) {
      if (root.nodeType !== 1) return;
      if (root.matches && root.matches('h1, h2')) watch(root);
      if (root.querySelectorAll) root.querySelectorAll('h1, h2').forEach(watch);
    }

    scan(doc.body);

    // заголовки, добавленные скриптами позже (вкладки, рендер из data.js)
    if ('MutationObserver' in window) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(scan);
        });
      }).observe(doc.body, { childList: true, subtree: true });
    }

    /* ---- заблокированные элементы и карточки при наведении ---- */
    var LOCKED = '.series-card--locked, .timeline__item, [data-cipher]';
    var lastRun = new WeakMap();

    function lockedTextNodes(container) {
      var list = [];
      container.querySelectorAll('*').forEach(function (node) {
        if (node.children.length) return;
        if (node.matches('script, style, button, svg, canvas')) return;
        var text = node.textContent.trim();
        if (text.length < 2 || text.length > 60) return;
        list.push(node);
      });
      return list.slice(0, 12);
    }

    function trigger(e) {
      var container = e.target && e.target.closest ? e.target.closest(LOCKED) : null;
      if (!container) return;
      if (e.relatedTarget && container.contains(e.relatedTarget)) return; // уже внутри
      var now = performance.now();
      if (now - (lastRun.get(container) || 0) < 1400) return;
      lastRun.set(container, now);
      lockedTextNodes(container).forEach(function (node) {
        runCipher(node, Math.min(700, 280 + node.textContent.length * 18));
      });
    }

    doc.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'touch') trigger(e);
    });
    doc.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') trigger(e); // на сенсорных экранах — по касанию
    });
  }

  /* ========================================================================
     4. ПЕРЕХОДЫ: плавное проявление и затухание
     ======================================================================== */
  function initTransitions(rootEl, soundApi) {
    var bar = doc.createElement('div');
    bar.className = 'fx-bar';
    bar.setAttribute('aria-hidden', 'true');
    rootEl.appendChild(bar);

    /* ---- проявление из чёрного ---- */
    var revealed = false;

    function reveal() {
      if (revealed) return;
      revealed = true;
      if (doc.body) void doc.body.offsetWidth; // фиксируем стартовое состояние (opacity: 0)
      html.classList.add('fx-anim');
      window.requestAnimationFrame(function () {
        html.classList.remove('fx-enter');
        window.setTimeout(gateResolve, 650);
      });
    }

    if (transitionsOn) {
      var fontsReady = (doc.fonts && doc.fonts.ready)
        ? Promise.race([doc.fonts.ready, new Promise(function (r) { window.setTimeout(r, 900); })])
        : Promise.resolve();
      fontsReady.then(function () { window.requestAnimationFrame(reveal); });
      window.setTimeout(reveal, 2200); // страховка
    } else {
      gateResolve();
    }

    if (!transitionsOn) return;

    /* ---- затухание при переходе по внутренним ссылкам ---- */
    var leaving = false;

    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduced()) return;

      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;

      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }

      if (url.protocol !== location.protocol || url.host !== location.host) return; // внешняя ссылка
      if (url.pathname === location.pathname && url.search === location.search) return; // якорь / та же страница
      if (!/(\.html?|\/)$/i.test(url.pathname)) return;                                  // только страницы сайта

      e.preventDefault();
      if (leaving) return;
      leaving = true;

      if (soundApi && soundApi.duck) soundApi.duck();
      html.classList.add('fx-leave');
      bar.classList.add('is-active');

      window.setTimeout(function () { window.location.href = url.href; }, CFG.fadeOutMs);

      // если переход почему-то не случился — возвращаем страницу
      window.setTimeout(function () {
        leaving = false;
        html.classList.remove('fx-leave');
        bar.classList.remove('is-active');
      }, 4000);
    });

    /* возврат кнопкой «Назад» (bfcache): страница не должна остаться чёрной */
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      leaving = false;
      html.classList.remove('fx-leave', 'fx-enter');
      bar.classList.remove('is-active');
    });
  }

  /* ========================================================================
     ЗАПУСК
     ======================================================================== */
  onReady(function () {
    var rootEl = doc.createElement('div');
    rootEl.id = 'fx-root';
    html.appendChild(rootEl); // вне <body>: курсор и кнопка звука не гаснут при переходах

    var sound = safe('звук', function () { return createSound(rootEl); });
    var cursor = safe('курсор', function () { return createCursor(rootEl); });
    safe('переходы', function () { initTransitions(rootEl, sound); });
    safe('cipher', initCipher);

    window.GildspineFX = {
      version: '1.0.0',
      sound: sound || { isOn: function () { return false; }, set: function () {} },
      cursor: cursor,
      cipher: { run: runCipher }
    };
  });
})();
