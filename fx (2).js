/* ==========================================================================
   GILDSPINE — Stay Gold
   js/fx.js  ·  Благородный звон золота при взаимодействии с кнопками и ссылками

   Единственная задача скрипта — короткие синтезированные звуки (Web Audio API,
   без аудиофайлов) на чистых синусоидах через мягкий lowpass 2600 Гц:

     • наведение мыши (ПК) на кнопки, ссылки и пункты меню —
       лёгкий золотой отклик: ~1480 Гц + обертон ~2220 Гц, затухание 0.1 с, gain 0.06;
     • клик / касание (pointerdown, ПК и телефон) — звон золотого артефакта:
       аккорд ~1175 Гц + ~1760 Гц + тёплый призвук ~587 Гц, затухание 0.22 с, gain 0.11.

   Телефоны (iOS / Android): AudioContext создаётся и «просыпается»
   (audioCtx.resume()) при первом же касании экрана; атака 5 мс и затухание
   через exponentialRampToValueAtTime — без щелчков и шипения.

   Подключение (на каждой странице, в <head>; defer не обязателен):
     <script src="js/fx.js"></script>

   Публичный API (необязательно): window.GildspineFX.hover() / .click()
   ========================================================================== */

(function () {
  'use strict';

  if (window.GildspineFX) return;

  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var doc = document;

  /* ------------------------------------------------------------------------
     ПАРАМЕТРЫ ЗВУКА
     ------------------------------------------------------------------------ */
  var LOWPASS_HZ = 2600;      // мягкий срез: никаких резких высоких писков
  var ATTACK = 0.005;         // плавная атака, сек
  var FLOOR = 0.0001;         // «ноль» для exponentialRampToValueAtTime
  var MAX_VOICES = 6;         // не больше одновременных звуков

  // partials: частота и доля громкости (в сумме 1.0, итоговый пик = peak)
  var HOVER = {
    peak: 0.06,
    decay: 0.1,
    partials: [
      { freq: 1480, level: 0.74 },
      { freq: 2220, level: 0.26 }
    ]
  };

  var CLICK = {
    peak: 0.11,
    decay: 0.22,
    partials: [
      { freq: 1175, level: 0.5 },
      { freq: 1760, level: 0.3 },
      { freq: 587, level: 0.2 }   // тёплый призвук для объёма
    ]
  };

  /* Интерактивные элементы: кнопки, ссылки, пункты меню */
  var INTERACTIVE = [
    'a[href]', 'button:not(:disabled)', '[role="button"]', '[role="tab"]', 'summary',
    'label[for]', 'input[type="submit"]', '.snippet', '[data-cursor="hover"]'
  ].join(',');

  function interactiveOf(target) {
    return target && target.closest ? target.closest(INTERACTIVE) : null;
  }

  /* ------------------------------------------------------------------------
     AUDIO CONTEXT
     ------------------------------------------------------------------------ */
  var ctx = null;
  var bus = null;
  var voices = 0;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      try { ctx = new AC(); } catch (err) { return null; }
    }

    // общий мягкий lowpass 2600 Гц → выход
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = LOWPASS_HZ;
    lp.Q.value = 0.7;
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(lp);
    lp.connect(ctx.destination);

    ctx.onstatechange = function () {
      if (ctx.state !== 'running') armWake(); // звонок, сворачивание, iOS «interrupted»
    };
    return ctx;
  }

  // iOS окончательно «разблокирует» звук, когда в момент касания проигран тихий буфер
  function playSilent() {
    try {
      var src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) { /* не критично */ }
  }

  /* ------------------------------------------------------------------------
     «ПРОБУЖДЕНИЕ» ПО ПЕРВОМУ КАСАНИЮ
     ------------------------------------------------------------------------ */
  var WAKE_EVENTS = ['touchstart', 'pointerdown', 'touchend', 'pointerup', 'click', 'keydown'];
  var wakeArmed = false;

  function wake() {
    if (!ensureContext()) return;
    if (ctx.state !== 'running') {
      try {
        var p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) { /* ждём следующего жеста */ }
      playSilent();
    }
    if (ctx.state === 'running') disarmWake();
  }

  function armWake() {
    if (wakeArmed) return;
    wakeArmed = true;
    WAKE_EVENTS.forEach(function (ev) {
      doc.addEventListener(ev, wake, { capture: true, passive: true });
    });
  }

  function disarmWake() {
    if (!wakeArmed) return;
    wakeArmed = false;
    WAKE_EVENTS.forEach(function (ev) {
      doc.removeEventListener(ev, wake, true);
    });
  }

  /* ------------------------------------------------------------------------
     СИНТЕЗ
     ------------------------------------------------------------------------ */
  function synth(spec) {
    if (!ctx || ctx.state !== 'running' || voices >= MAX_VOICES) return;

    var t = ctx.currentTime + 0.005;
    var end = t + spec.decay;

    // огибающая: плавная атака 5 мс → экспоненциальное затухание
    var env = ctx.createGain();
    env.gain.setValueAtTime(FLOOR, t);
    env.gain.linearRampToValueAtTime(spec.peak, t + ATTACK);
    env.gain.exponentialRampToValueAtTime(FLOOR, end);
    env.connect(bus);

    var stopAt = end + 0.03;
    var remaining = spec.partials.length;
    voices++;

    spec.partials.forEach(function (p) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = p.freq;

      var g = ctx.createGain();
      g.gain.value = p.level;

      osc.connect(g);
      g.connect(env);
      osc.onended = function () {
        osc.disconnect();
        g.disconnect();
        remaining--;
        if (remaining === 0) {
          env.disconnect();
          voices = Math.max(0, voices - 1);
        }
      };
      osc.start(t);
      osc.stop(stopAt);
    });
  }

  // звук, запрошенный в тот же момент, когда контекст ещё просыпается (первое касание)
  function play(spec) {
    if (!ensureContext()) return;
    if (ctx.state === 'running') {
      synth(spec);
      return;
    }
    var p;
    try { p = ctx.resume(); } catch (e) { return; }
    playSilent();
    if (p && typeof p.then === 'function') {
      p.then(function () { synth(spec); }, function () {});
    }
  }

  /* ------------------------------------------------------------------------
     СОБЫТИЯ
     ------------------------------------------------------------------------ */
  var lastHover = null;
  var lastHoverAt = 0;

  // наведение — только мышь (на телефонах hover-звука нет)
  doc.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var el = interactiveOf(e.target);
    if (el === lastHover) return;
    lastHover = el;
    if (!el) return;
    var now = performance.now();
    if (now - lastHoverAt < 70) return;
    lastHoverAt = now;
    play(HOVER);
  });

  doc.addEventListener('pointerout', function (e) {
    if (e.pointerType !== 'mouse') return;
    if (!e.relatedTarget) lastHover = null; // курсор ушёл из окна
  });

  // клик / касание
  doc.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!interactiveOf(e.target)) return;
    play(CLICK);
  });

  // первое же касание экрана пробуждает AudioContext
  armWake();

  window.GildspineFX = {
    version: '2.0.0',
    hover: function () { play(HOVER); },
    click: function () { play(CLICK); }
  };
})();
