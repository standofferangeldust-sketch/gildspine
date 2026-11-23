/* ==========================================================================
   GILDSPINE — Stay Gold
   js/fx.js  ·  Премиальные эффекты одним автономным скриптом

   1. Золотой курсор со шлейфом (только устройства с мышью)
   2. Синтезированный саунд-дизайн на Web Audio API (без аудиофайлов)
   3. Cipher Reveal — «расшифровка» заголовков и заблокированных элементов
   4. Кинематографичные переходы между страницами

   ПОДКЛЮЧЕНИЕ — на каждой странице, в <head>, БЕЗ defer
   (скрипт должен выполниться до первой отрисовки, иначе при загрузке
   будет заметна вспышка контента перед затемнением):

     <script src="js/fx.js"></script>

   Скрипт сам внедряет свои стили и элементы; CSS-файл менять не нужно.
   Уважает prefers-reduced-motion: курсор без шлейфа и искр, без расшифровки
   и без переходов. Совместим с js/i18n.js (событие gildspine:languagechange).

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
    gold: '201,162,39',
    goldHot: '246,221,134',
    blood: '139,0,0',
    bloodBright: '178,18,18',
    storageKey: 'gildspine-sound',
    fadeInMs: 900,
    fadeOutMs: 460,
    masterLevel: 0.5
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

    /* --- курсор --- */
    'html.fx-cursor-on,html.fx-cursor-on *{cursor:none!important}',
    'html.fx-cursor-on input[type="text"],html.fx-cursor-on input[type="email"],html.fx-cursor-on input[type="search"],',
    'html.fx-cursor-on input[type="url"],html.fx-cursor-on input[type="tel"],html.fx-cursor-on textarea,',
    'html.fx-cursor-on [contenteditable="true"]{cursor:text!important}',

    '.fx-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',

    '.fx-dot,.fx-ring{position:absolute;left:0;top:0;pointer-events:none;opacity:0;will-change:transform;transition:opacity .25s}',
    '.fx-dot.is-visible,.fx-ring.is-visible{opacity:1}',
    '.fx-dot.is-text,.fx-ring.is-text{opacity:0}',

    '.fx-dot i{display:block;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#c9a227;',
    'box-shadow:0 0 8px 2px rgba(201,162,39,.8),0 0 22px 6px rgba(201,162,39,.35);',
    'transition:transform .25s cubic-bezier(.22,.61,.36,1),background-color .25s}',
    '.fx-dot.is-hover i{transform:scale(.55)}',
    '.fx-dot.is-down i{transform:scale(1.5)}',

    '.fx-ring i{display:block;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;',
    'border:1px solid rgba(201,162,39,.7);box-shadow:0 0 14px rgba(201,162,39,.16),inset 0 0 10px rgba(201,162,39,.06);',
    'transition:transform .35s cubic-bezier(.22,.61,.36,1),border-color .3s,background-color .3s,box-shadow .3s}',
    '.fx-ring.is-hover i{transform:scale(1.6);border-color:#8b0000;background:rgba(139,0,0,.2);',
    'box-shadow:0 0 22px rgba(139,0,0,.85),0 0 46px rgba(139,0,0,.35),inset 0 0 16px rgba(139,0,0,.5)}',
    '.fx-ring.is-down i{transform:scale(.8)}',
    '.fx-ring.is-hover.is-down i{transform:scale(1.25)}',

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

  /* ========================================================================
     2. ЗВУК
     ======================================================================== */
  function createSound(rootEl) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;

    var on = readPref() === '1';
    var ctx = null;
    var master = null;
    var ambientBus = null;
    var uiBus = null;
    var reverbIn = null;
    var built = false;
    var active = false;       // ambient сейчас звучит
    var pending = false;      // звук «включён» в настройках, но браузер ждёт первого жеста
    var hiddenPaused = false;
    var gestureArmed = false;
    var timers = [];
    var suspendTimer = 0;
    var lastHover = null;
    var lastHoverAt = 0;
    var btn;
    var labelEl;

    var SWELL_NOTES = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 329.63];
    var CHIME_FREQS = [1318.5, 1568, 1975.5, 2349.3, 2637];

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
      var ru = (html.getAttribute('lang') || '').toLowerCase().indexOf('ru') === 0;
      labelEl.textContent = on ? 'SOUND: ON' : 'SOUND: OFF';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', ru
        ? (on ? 'Звук включён. Нажмите, чтобы выключить' : 'Звук выключен. Нажмите, чтобы включить')
        : (on ? 'Sound is on. Press to turn off' : 'Sound is off. Press to turn on'));
    }

    /* ---------- генераторы буферов ---------- */
    function makeImpulse(c, seconds, decay) {
      var rate = c.sampleRate;
      var len = Math.floor(rate * seconds);
      var buf = c.createBuffer(2, len, rate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        for (var i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return buf;
    }

    function makeBrownNoise(c, seconds) {
      var rate = c.sampleRate;
      var len = Math.floor(rate * seconds);
      var buf = c.createBuffer(2, len, rate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        var last = 0;
        for (var i = 0; i < len; i++) {
          var w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
      return buf;
    }

    /* ---------- граф: ambient ---------- */
    function build() {
      if (built) return;
      ctx = new AC();

      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 24;
      comp.ratio.value = 3;
      comp.attack.value = 0.02;
      comp.release.value = 0.4;

      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(comp);
      comp.connect(ctx.destination);

      // реверберация
      var conv = ctx.createConvolver();
      conv.buffer = makeImpulse(ctx, 3.4, 2.4);
      var wet = ctx.createGain();
      wet.gain.value = 0.4;
      conv.connect(wet);
      wet.connect(master);
      reverbIn = conv;

      ambientBus = ctx.createGain();
      ambientBus.connect(master);
      var ambSend = ctx.createGain();
      ambSend.gain.value = 0.55;
      ambientBus.connect(ambSend);
      ambSend.connect(reverbIn);

      uiBus = ctx.createGain();
      uiBus.connect(master);
      var uiSend = ctx.createGain();
      uiSend.gain.value = 0.4;
      uiBus.connect(uiSend);
      uiSend.connect(reverbIn);

      /* --- саб-гул --- */
      function droneOsc(type, freq, detune, gainVal, lowpass) {
        var o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = lowpass;
        f.Q.value = 0.7;
        var g = ctx.createGain();
        g.gain.value = gainVal;
        o.connect(f);
        f.connect(g);
        g.connect(ambientBus);
        o.start();
      }
      droneOsc('sine', 55, 0, 0.30, 120);
      droneOsc('triangle', 55, 6, 0.14, 180);
      droneOsc('sine', 82.41, -4, 0.07, 220);

      /* --- тёмный pad с медленно «дышащим» фильтром --- */
      var padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 320;
      padFilter.Q.value = 2.5;
      var padGain = ctx.createGain();
      padGain.gain.value = 0.075;
      padFilter.connect(padGain);
      padGain.connect(ambientBus);

      [[110, -7], [130.81, 5], [164.81, -3], [220, 8]].forEach(function (n) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = n[0];
        o.detune.value = n[1];
        var g = ctx.createGain();
        g.gain.value = 0.35;
        o.connect(g);
        g.connect(padFilter);
        o.start();
      });

      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.055;
      var lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 170;
      lfo.connect(lfoDepth);
      lfoDepth.connect(padFilter.frequency);
      lfo.start();

      var lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.023;
      var lfo2Depth = ctx.createGain();
      lfo2Depth.gain.value = 0.03;
      lfo2.connect(lfo2Depth);
      lfo2Depth.connect(padGain.gain);
      lfo2.start();

      /* --- «дыхание» пустоты: коричневый шум --- */
      var noise = ctx.createBufferSource();
      noise.buffer = makeBrownNoise(ctx, 6);
      noise.loop = true;
      var nLow = ctx.createBiquadFilter();
      nLow.type = 'lowpass';
      nLow.frequency.value = 520;
      var nHigh = ctx.createBiquadFilter();
      nHigh.type = 'highpass';
      nHigh.frequency.value = 60;
      var nGain = ctx.createGain();
      nGain.gain.value = 0.09;
      noise.connect(nLow);
      nLow.connect(nHigh);
      nHigh.connect(nGain);
      nGain.connect(ambientBus);
      noise.start();

      var lfo3 = ctx.createOscillator();
      lfo3.frequency.value = 0.04;
      var lfo3Depth = ctx.createGain();
      lfo3Depth.gain.value = 0.035;
      lfo3.connect(lfo3Depth);
      lfo3Depth.connect(nGain.gain);
      lfo3.start();

      built = true;
    }

    /* ---------- генеративные события ---------- */
    function swell() {
      if (!audible()) return;
      var t = ctx.currentTime;
      var f = pick(SWELL_NOTES);
      var dur = 9 + Math.random() * 5;

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;

      var tail = g;
      if (ctx.createStereoPanner) {
        var pan = ctx.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * 0.6;
        g.connect(pan);
        tail = pan;
      }
      tail.connect(ambientBus);
      lp.connect(g);

      [['sine', f, 0], ['triangle', f * 2, 6]].forEach(function (p) {
        var o = ctx.createOscillator();
        o.type = p[0];
        o.frequency.value = p[1];
        o.detune.value = p[2];
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.2);
      });
    }

    function scheduleEvents() {
      clearTimers();
      (function next() {
        var id = window.setTimeout(function () {
          if (!active) return;
          if (Math.random() < 0.7) swell();
          else pulse(0.09);
          next();
        }, 5500 + Math.random() * 8000);
        timers.push(id);
      })();
    }

    function clearTimers() {
      timers.forEach(function (id) { window.clearTimeout(id); });
      timers = [];
    }

    /* ---------- UI-звуки ---------- */
    function audible() {
      return !!(active && ctx && ctx.state === 'running' && !hiddenPaused);
    }

    // еле слышный металлический звон золота (FM-синтез)
    function chime(vol, decay) {
      if (!audible()) return;
      var t = ctx.currentTime;
      var f = pick(CHIME_FREQS);

      var car = ctx.createOscillator();
      car.type = 'sine';
      car.frequency.value = f;

      var mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = f * 2.76;
      var modGain = ctx.createGain();
      modGain.gain.setValueAtTime(f * 1.4, t);
      modGain.gain.exponentialRampToValueAtTime(1, t + decay * 0.6);
      mod.connect(modGain);
      modGain.connect(car.frequency);

      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      car.connect(env);

      var partial = ctx.createOscillator();
      partial.type = 'sine';
      partial.frequency.value = f * 1.504;
      var pGain = ctx.createGain();
      pGain.gain.value = 0.35;
      partial.connect(pGain);
      pGain.connect(env);

      env.connect(uiBus);

      var end = t + decay + 0.05;
      car.start(t); mod.start(t); partial.start(t);
      car.stop(end); mod.stop(end); partial.stop(end);
    }

    // глубокий басовый импульс
    function pulse(vol) {
      if (!audible()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(118, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.34);

      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 280;

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

      o.connect(lp);
      lp.connect(g);
      g.connect(uiBus);
      o.start(t);
      o.stop(t + 0.65);
    }

    /* ---------- запуск / остановка ---------- */
    function fadeTo(level, timeConstant) {
      if (!master) return;
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.setTargetAtTime(level, now, timeConstant);
    }

    function start(withChime) {
      if (!ctx || !on) return;
      window.clearTimeout(suspendTimer);
      active = true;
      fadeTo(CFG.masterLevel, 1.4);
      scheduleEvents();
      if (withChime) chime(0.05, 1);
    }

    function stop() {
      active = false;
      clearTimers();
      if (!ctx) return;
      fadeTo(0, 0.25);
      window.clearTimeout(suspendTimer);
      suspendTimer = window.setTimeout(function () {
        if (!active && ctx && ctx.state === 'running') ctx.suspend();
      }, 1800);
    }

    // вызывается из жеста пользователя (клик, клавиша)
    function activate(withChime) {
      try {
        build();
        var p = ctx.resume();
        var go = function () { if (on) start(withChime); };
        if (p && typeof p.then === 'function') p.then(go, function () { pending = true; armGesture(); });
        else go();
      } catch (err) {
        pending = false;
      }
    }

    /* ---------- первый жест ---------- */
    var GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'];

    function onFirstGesture(e) {
      if (btn.contains(e.target)) return; // клик по самой кнопке обработает onToggle
      if (!pending) { disarmGesture(); return; }
      pending = false;
      disarmGesture();
      activate(false);
    }

    function armGesture() {
      if (gestureArmed) return;
      gestureArmed = true;
      GESTURES.forEach(function (ev) { doc.addEventListener(ev, onFirstGesture, true); });
    }

    function disarmGesture() {
      gestureArmed = false;
      GESTURES.forEach(function (ev) { doc.removeEventListener(ev, onFirstGesture, true); });
    }

    /* ---------- переключатель ---------- */
    function setOn(value) {
      on = !!value;
      savePref();
      render();
      if (on) {
        pending = false;
        activate(true);
      } else {
        pending = false;
        disarmGesture();
        stop();
      }
    }

    function onToggle() {
      if (pending) {          // звук уже «включён», ждали жеста — этот клик и есть жест
        pending = false;
        disarmGesture();
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
      if (now - lastHoverAt < 70) return;
      lastHoverAt = now;
      chime(0.03, 0.55);
    });

    doc.addEventListener('pointerdown', function (e) {
      if (!audible() || !interactiveOf(e.target)) return;
      pulse(0.22);
      chime(0.02, 0.4);
    });

    doc.addEventListener('visibilitychange', function () {
      if (!ctx || !built) return;
      if (doc.hidden) {
        if (active) {
          hiddenPaused = true;
          fadeTo(0, 0.1);
          window.setTimeout(function () { if (hiddenPaused && ctx.state === 'running') ctx.suspend(); }, 500);
        }
      } else if (hiddenPaused) {
        hiddenPaused = false;
        var p = ctx.resume();
        var back = function () { if (on && active) fadeTo(CFG.masterLevel, 1.2); };
        if (p && typeof p.then === 'function') p.then(back); else back();
      }
    });

    doc.addEventListener('gildspine:languagechange', render);

    /* ---------- старт ---------- */
    buildButton();
    render();

    if (on) {
      // пробуем стартовать сразу (если браузер разрешает); иначе ждём первый жест.
      // Promise от resume() без жеста может «висеть» — поэтому состояние проверяем по таймеру.
      try {
        build();
        var attempt = ctx.resume();
        if (attempt && typeof attempt.then === 'function') {
          attempt.then(function () {
            if (on && ctx.state === 'running' && !active) {
              pending = false;
              start(false);
            }
          }, function () { /* ждём жест */ });
        }
        window.setTimeout(function () {
          if (on && !active && ctx.state !== 'running') {
            pending = true;
            armGesture();
          } else if (on && !active && ctx.state === 'running') {
            start(false);
          }
        }, 300);
      } catch (err) {
        pending = true;
        armGesture();
      }
    }

    return {
      isOn: function () { return on; },
      set: setOn,
      // плавно приглушаем звук перед уходом со страницы
      duck: function () { if (active && ctx) fadeTo(0, 0.15); }
    };
  }

  /* ========================================================================
     1. КУРСОР
     ======================================================================== */
  function createCursor(rootEl) {
    var mq = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };

    var dotEl, ringEl, canvas, ctx2d;
    var enabled = false;
    var built = false;
    var visible = false;
    var hovering = false;
    var width = 0;
    var height = 0;
    var dpr = 1;
    var mouse = { x: -100, y: -100 };
    var ring = { x: -100, y: -100 };
    var prev = { x: 0, y: 0 };
    var trail = [];
    var sparks = [];
    var lastSparkAt = 0;
    var lastFrame = 0;
    var rafId = 0;

    var TRAIL_MS = 280;

    function build() {
      if (built) return;
      dotEl = doc.createElement('div');
      dotEl.className = 'fx-dot';
      dotEl.setAttribute('aria-hidden', 'true');
      dotEl.appendChild(doc.createElement('i'));

      ringEl = doc.createElement('div');
      ringEl.className = 'fx-ring';
      ringEl.setAttribute('aria-hidden', 'true');
      ringEl.appendChild(doc.createElement('i'));

      canvas = doc.createElement('canvas');
      canvas.className = 'fx-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      ctx2d = canvas.getContext('2d');

      rootEl.insertBefore(canvas, rootEl.firstChild);
      rootEl.appendChild(ringEl);
      rootEl.appendChild(dotEl);
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
      dotEl.classList.toggle('is-visible', v);
      ringEl.classList.toggle('is-visible', v);
    }

    function setState(cls, v) {
      dotEl.classList.toggle(cls, v);
      ringEl.classList.toggle(cls, v);
    }

    /* ---------- искры ---------- */
    function spawnSpark(x, y, dx, dy) {
      var angle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.6;
      var speed = 20 + Math.random() * 50;
      var r = Math.random();
      sparks.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        age: 0,
        life: 520 + Math.random() * 480,
        size: 0.7 + Math.random() * 1.2,
        color: hovering && r < 0.5 ? CFG.bloodBright : (r > 0.82 ? CFG.goldHot : CFG.gold)
      });
      if (sparks.length > 70) sparks.shift();
    }

    function burst(x, y) {
      var n = 9;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        var s = 40 + Math.random() * 70;
        sparks.push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          age: 0, life: 420 + Math.random() * 380,
          size: 0.8 + Math.random() * 1.3,
          color: hovering ? CFG.bloodBright : (Math.random() < 0.25 ? CFG.goldHot : CFG.gold)
        });
      }
      if (sparks.length > 70) sparks.splice(0, sparks.length - 70);
    }

    /* ---------- отрисовка ---------- */
    function draw(now, dt) {
      ctx2d.clearRect(0, 0, width, height);

      // шлейф
      while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
      if (trail.length > 1) {
        var rgb = hovering ? CFG.bloodBright : CFG.gold;
        ctx2d.lineCap = 'round';
        for (var i = 1; i < trail.length; i++) {
          var a = trail[i - 1];
          var b = trail[i];
          var life = 1 - (now - b.t) / TRAIL_MS;
          if (life <= 0) continue;
          ctx2d.strokeStyle = 'rgba(' + rgb + ',' + (life * 0.55).toFixed(3) + ')';
          ctx2d.lineWidth = 0.8 + life * 1.8;
          ctx2d.beginPath();
          ctx2d.moveTo(a.x, a.y);
          ctx2d.lineTo(b.x, b.y);
          ctx2d.stroke();
        }
      }

      // искры
      ctx2d.globalCompositeOperation = 'lighter';
      for (var s = sparks.length - 1; s >= 0; s--) {
        var p = sparks[s];
        p.age += dt * 1000;
        if (p.age >= p.life) { sparks.splice(s, 1); continue; }
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 4 * dt; // лёгкое «оседание»
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        var k = 1 - p.age / p.life;
        ctx2d.fillStyle = 'rgba(' + p.color + ',' + (k * 0.9).toFixed(3) + ')';
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.2832);
        ctx2d.fill();
        ctx2d.fillStyle = 'rgba(' + p.color + ',' + (k * 0.18).toFixed(3) + ')';
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.size * 3.2, 0, 6.2832);
        ctx2d.fill();
      }
      ctx2d.globalCompositeOperation = 'source-over';
    }

    function needsFrame() {
      return enabled && (
        Math.abs(mouse.x - ring.x) > 0.2 || Math.abs(mouse.y - ring.y) > 0.2 ||
        trail.length > 0 || sparks.length > 0
      );
    }

    function frame(now) {
      rafId = 0;
      var dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;

      var k = reduced() ? 1 : 1 - Math.exp(-dt * 11);
      ring.x += (mouse.x - ring.x) * k;
      ring.y += (mouse.y - ring.y) * k;
      ringEl.style.transform = 'translate3d(' + ring.x.toFixed(2) + 'px,' + ring.y.toFixed(2) + 'px,0)';

      draw(now, dt);

      if (needsFrame()) rafId = window.requestAnimationFrame(frame);
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
      mouse.x = x;
      mouse.y = y;
      dotEl.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';

      if (!visible) {
        ring.x = x;
        ring.y = y;
        prev.x = x;
        prev.y = y;
        setVisible(true);
      }

      if (!reduced()) {
        var now = performance.now();
        var dx = x - prev.x;
        var dy = y - prev.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        trail.push({ x: x, y: y, t: now });
        if (trail.length > 24) trail.shift();
        if (dist > 3 && now - lastSparkAt > 85 && Math.random() < 0.5) {
          spawnSpark(x, y, dx, dy);
          lastSparkAt = now;
        }
      }
      prev.x = x;
      prev.y = y;
      kick();
    }

    function onOver(e) {
      var target = e.target;
      if (target && target.closest && target.closest('iframe')) {
        setVisible(false);
        return;
      }
      var isText = !!(target && target.closest && target.closest(TEXT_FIELDS));
      setState('is-text', isText);
      hovering = !!interactiveOf(target);
      setState('is-hover', hovering);
    }

    function onDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      setState('is-down', true);
      if (!reduced()) { burst(e.clientX, e.clientY); kick(); }
    }

    function onUp() {
      setState('is-down', false);
    }

    function onLeave() {
      setVisible(false);
    }

    function onBlur() {
      setVisible(false);
      setState('is-down', false);
    }

    function enable() {
      if (enabled || !mq.matches) return;
      build();
      resize();
      enabled = true;
      html.classList.add('fx-cursor-on');
      window.addEventListener('pointermove', onMove, { passive: true });
      doc.addEventListener('pointerover', onOver, true);
      doc.addEventListener('pointerdown', onDown, true);
      doc.addEventListener('pointerup', onUp, true);
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
      doc.removeEventListener('pointerdown', onDown, true);
      doc.removeEventListener('pointerup', onUp, true);
      html.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
      if (built) {
        setVisible(false);
        trail.length = 0;
        sparks.length = 0;
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
