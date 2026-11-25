/* ==========================================================================
   GILDSPINE — Stay Gold
   js/artifacts3d.js  ·  3D-артефакты: гримуары на book.html, визуализатор на track.html

   book.html
     1. Главный том «Первая частота» — плоская обложка заменяется интерактивной
        3D-моделью гримуара (Three.js): тёмный переплёт #0a0a0f, кремово-золотые
        страницы, золотые уголки #c9a227, тиснение GILDSPINE, текстура
        assets/images/book-cover.jpg (если файл есть). Вращение мышью или пальцем
        во все стороны, инерция, металлические блики.
     2. Все 10 карточек серии — плавный CSS 3D Tilt с золотым бликом за курсором
        (на телефонах — наклон от скролла и гироскопа, где он доступен).
     3. Тома 2–10 — по клику открывается модальное окно с 3D-фолиантом:
        тома 3–10 перетянуты золотыми/багровыми энергетическими замками
        (ACCESS DENIED // ARCHIVE SEALED), том 2 — тизер «Кровь и частота».

   track.html
     4. Рядом с плеером — 3D-артефакт: двойное кольцо и геодезическая сфера из
        золотых и багровых линий и частиц. При Play на плеере сниппета сфера
        пульсирует в такт басу и ритму (Web Audio API → AnalyserNode),
        на паузе — плавно «дышит».

   ПОДКЛЮЧЕНИЕ (в конце <body> или в <head> с defer — после js/data.js):
     <script src="js/artifacts3d.js" defer></script>

   • Three.js (r149) подгружается динамически с jsDelivr, если ещё не загружен.
   • Скрипт автономен: сам внедряет CSS и безопасно ничего не делает на других
     страницах. Если нет WebGL — остаются обычные плоские обложки.
   • Оптимизация для смартфонов: DPR ≤ 1.25, 30 fps, облегчённые текстуры и
     геометрия, пауза рендера вне экрана / в фоновой вкладке / под модальным окном.
   • Уважает prefers-reduced-motion.
   ========================================================================== */

(function () {
  'use strict';

  if (window.GildspineArtifacts3D) return;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';

  var doc = document;
  var html = doc.documentElement;

  var COLOR = {
    gold: 0xc9a227,
    goldHot: 0xf6dd86,
    blood: 0x8b0000,
    bloodBright: 0xb31212,
    neon: 0x7b2cbf
  };

  var FONT_DISPLAY = "'Cinzel','Cormorant SC',Georgia,serif";
  var FONT_MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

  /* ------------------------------------------------------------------------
     УТИЛИТЫ
     ------------------------------------------------------------------------ */
  function $(sel, root) { return (root || doc).querySelector(sel); }

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function noop() {}

  function isMobile() {
    var ua = navigator.userAgent || '';
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return !!(coarse || ios || /Android/i.test(ua) || window.innerWidth < 768);
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function getLang() {
    try {
      var api = window.GildspineI18n;
      if (api && typeof api.getLang === 'function') {
        var l = api.getLang();
        if (l === 'ru' || l === 'en') return l;
      }
    } catch (e) { /* дальше */ }
    var attr = (html.getAttribute('lang') || '').toLowerCase().slice(0, 2);
    return attr === 'en' ? 'en' : 'ru';
  }

  function D() { return window.GildspineData || null; }

  function tr(field) {
    var d = D();
    if (d && typeof d.tr === 'function') return d.tr(field);
    if (typeof field === 'string') return field;
    return (field && (field[getLang()] || field.ru)) || '';
  }

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function safe(name, fn) {
    try {
      return fn();
    } catch (err) {
      if (window.console && console.warn) console.warn('[artifacts3d] ' + name + ':', err);
      return null;
    }
  }

  var STR = {
    ru: {
      close: 'Закрыть',
      hint: 'Потяните, чтобы повернуть',
      book: 'КНИГА',
      denied: 'ACCESS DENIED // ARCHIVE SEALED',
      soon: 'Скоро',
      announced: 'Анонс',
      teaser: 'Тизер тома',
      sealedNote: 'Архив запечатан энергетическими замками. Печати падут по мере выхода предыдущих томов.',
      soonNote: 'Следующий том уже в работе. Первыми о нём узнают подписчики канала.',
      subscribe: 'Подписаться на новые главы',
      inspect: 'Осмотреть том {n}',
      toFirst: 'К первой книге',
      key: 'КЛЮЧ',
      heroAria: 'Интерактивная 3D-модель книги. Потяните, чтобы вращать, или используйте стрелки',
      modalAria: '3D-модель тома {n}. Потяните, чтобы вращать',
      loading: 'Загрузка 3D…',
      vizLabel: 'ВИЗУАЛИЗАТОР ЧАСТОТ',
      vizLive: 'ЭФИР',
      vizIdle: 'ОЖИДАНИЕ',
      vizNone: 'НЕТ СИГНАЛА',
      vizAria: '3D-визуализатор частот: сфера пульсирует в такт музыке'
    },
    en: {
      close: 'Close',
      hint: 'Drag to rotate',
      book: 'BOOK',
      denied: 'ACCESS DENIED // ARCHIVE SEALED',
      soon: 'Soon',
      announced: 'Announced',
      teaser: 'Volume teaser',
      sealedNote: 'The archive is sealed with energy locks. The seals will fall as earlier volumes are released.',
      soonNote: 'The next volume is already in the works. Channel subscribers will hear about it first.',
      subscribe: 'Subscribe to new chapters',
      inspect: 'Inspect volume {n}',
      toFirst: 'Go to the first book',
      key: 'KEY',
      heroAria: 'Interactive 3D model of the book. Drag to rotate, or use the arrow keys',
      modalAria: '3D model of volume {n}. Drag to rotate',
      loading: 'Loading 3D…',
      vizLabel: 'FREQUENCY VISUALIZER',
      vizLive: 'LIVE',
      vizIdle: 'IDLE',
      vizNone: 'NO SIGNAL',
      vizAria: '3D frequency visualizer: the sphere pulses to the music'
    }
  };

  function S(key) {
    var pack = STR[getLang()] || STR.ru;
    return pack[key] !== undefined ? pack[key] : key;
  }

  /* ------------------------------------------------------------------------
     ДИНАМИЧЕСКАЯ ЗАГРУЗКА THREE.JS
     ------------------------------------------------------------------------ */
  var threePromise = null;

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threePromise) return threePromise;

    threePromise = new Promise(function (resolve, reject) {
      var script = doc.querySelector('script[src*="three"][src*="three.min.js"]');
      if (!script) {
        script = doc.createElement('script');
        script.src = THREE_URL;
        script.async = true;
        script.crossOrigin = 'anonymous';
        doc.head.appendChild(script);
      }
      script.addEventListener('error', function () { reject(new Error('Three.js не загрузился')); });

      var tries = 0;
      (function poll() {
        if (window.THREE) { resolve(window.THREE); return; }
        if (++tries > 150) { reject(new Error('Three.js: таймаут загрузки')); return; }
        window.setTimeout(poll, 100);
      })();
    }).catch(function (err) {
      threePromise = null; // следующая попытка попробует снова
      throw err;
    });

    return threePromise;
  }

  /* ------------------------------------------------------------------------
     СТИЛИ (внедряются один раз)
     ------------------------------------------------------------------------ */
  var CSS = [
    /* --- 3D-вьюер (общие стили) --- */
    '.a3d-viewer{position:relative;width:100%;aspect-ratio:4/5;border-radius:4px;touch-action:none;cursor:grab;',
    'user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
    'background:radial-gradient(60% 55% at 50% 45%,rgba(201,162,39,.12),transparent 70%),',
    'radial-gradient(70% 60% at 88% 100%,rgba(139,0,0,.22),transparent 70%)}',
    '.a3d-viewer.is-grabbing{cursor:grabbing}',
    '.a3d-viewer canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none}',
    '.a3d-viewer canvas:focus-visible{outline:2px solid #e6c457;outline-offset:3px}',
    '.a3d-hint{position:absolute;left:50%;bottom:.6rem;transform:translateX(-50%);',
    "font:500 .68rem/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.08em;color:rgba(230,196,87,.95);",
    'background:rgba(10,10,15,.72);border:1px solid rgba(201,162,39,.35);padding:.45rem .7rem;border-radius:2px;',
    'pointer-events:none;white-space:nowrap;transition:opacity .6s}',
    '.a3d-hint.is-hidden{opacity:0}',
    '.a3d-loading{position:absolute;inset:0;display:grid;place-items:center;',
    "font:500 .72rem/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.1em;color:rgba(201,162,39,.8);pointer-events:none}",

    /* --- главный том: 3D вместо плоской обложки --- */
    '.a3d-hero{display:none;margin-inline:auto}',
    '.a3d-has-3d .a3d-hero{display:block}',
    '.a3d-has-3d .book-cover{display:none}',

    /* --- CSS 3D Tilt для карточек серии --- */
    '.series-card.a3d-tilt{position:relative;transform-style:preserve-3d;will-change:transform;',
    'transform:perspective(800px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));',
    'transition:transform .45s cubic-bezier(.22,.61,.36,1),border-color .3s,box-shadow .3s}',
    '.series-card.a3d-tilt.is-tilting{transition:transform .08s linear,border-color .3s,box-shadow .3s}',
    '.series-card.a3d-tilt .book-cover,.series-card.a3d-tilt .artifact{transform:translateZ(22px)}',
    '.series-card.a3d-tilt .series-card__title,.series-card.a3d-tilt .series-card__label{transform:translateZ(12px)}',
    '.series-card.a3d-tilt[role="button"]{cursor:pointer}',
    '.series-card.a3d-tilt:focus-visible{outline:2px solid #e6c457;outline-offset:3px}',
    '.a3d-glare{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;z-index:3;',
    'transition:opacity .35s;mix-blend-mode:screen;',
    'background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,230,150,.38),rgba(201,162,39,.14) 28%,transparent 58%)}',
    '.a3d-tilt.is-tilting .a3d-glare{opacity:1}',
    '.a3d-tilt.is-scroll .a3d-glare{opacity:.7}',

    /* --- модальное окно --- */
    'html.a3d-lock,html.a3d-lock body{overflow:hidden}',
    '.a3d-modal{position:fixed;inset:0;z-index:99000;display:flex;align-items:center;justify-content:center;',
    'padding:clamp(.5rem,2vw,2rem);opacity:0;visibility:hidden;transition:opacity .3s ease,visibility 0s linear .3s}',
    '.a3d-modal.is-open{opacity:1;visibility:visible;transition-delay:0s}',
    '.a3d-modal__backdrop{position:absolute;inset:0;background:rgba(5,5,8,.84);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
    '.a3d-modal__panel{position:relative;width:min(1000px,100%);max-height:min(92vh,760px);display:grid;grid-template-columns:1fr;',
    'background:linear-gradient(180deg,rgba(24,24,36,.98),rgba(13,13,20,.99));border:1px solid rgba(201,162,39,.42);',
    'border-radius:4px;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 40px rgba(201,162,39,.12);overflow:auto;',
    'overscroll-behavior:contain;transform:translateY(14px) scale(.98);transition:transform .35s cubic-bezier(.22,.61,.36,1)}',
    '.a3d-modal.is-open .a3d-modal__panel{transform:none}',
    '@media (min-width:820px){.a3d-modal__panel{grid-template-columns:1.05fr 1fr}}',
    '.a3d-modal__stage{position:relative;min-height:min(46vh,380px)}',
    '.a3d-modal__stage .a3d-viewer{height:100%;aspect-ratio:auto;min-height:min(46vh,380px)}',
    '.a3d-modal__flat{position:absolute;inset:0;display:grid;place-items:center;padding:1.25rem}',
    '.a3d-modal__flat>*{max-width:240px;width:100%}',
    '.a3d-modal__info{display:flex;flex-direction:column;justify-content:center;gap:.9rem;padding:clamp(1.25rem,1rem + 2vw,2.25rem)}',
    ".a3d-modal__label{margin:0;font:500 .75rem/1.4 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.08em;color:#c9a227}",
    ".a3d-modal__title{margin:0;font-family:'Cinzel','Cormorant SC',Georgia,serif;font-size:clamp(1.3rem,1rem + 1.6vw,2rem);",
    'font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:1.25;color:#e9e6df;overflow-wrap:anywhere}',
    ".a3d-modal__status{margin:0;font:700 .82rem/1.4 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.08em;color:#e25858;",
    'text-shadow:1px 0 rgba(123,44,191,.85),-1px 0 rgba(139,0,0,.9);animation:a3d-glitch 3.2s steps(1) infinite}',
    '.a3d-modal__status.is-gold{color:#e6c457;text-shadow:0 0 14px rgba(201,162,39,.5);animation:none}',
    '@keyframes a3d-glitch{0%,88%,100%{transform:none}90%{transform:translateX(-2px)}94%{transform:translateX(2px) skewX(-6deg)}}',
    '.a3d-modal__text{margin:0;color:#a09eae;font-size:.95rem;line-height:1.7}',
    '.a3d-modal__tags{display:flex;flex-wrap:wrap;gap:.5rem;margin:0;padding:0;list-style:none}',
    ".a3d-modal__tags span{display:inline-block;padding:.2rem .65rem;font:500 .72rem/1.5 'JetBrains Mono',ui-monospace,monospace;",
    'color:#c9a227;background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.25);border-radius:2px}',
    '.a3d-modal__actions{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:.4rem}',
    '.a3d-modal__close{position:absolute;top:.6rem;right:.6rem;z-index:5;display:grid;place-items:center;width:44px;height:44px;',
    'padding:0;font-size:1.5rem;line-height:1;color:#c9a227;background:rgba(10,10,15,.8);border:1px solid rgba(201,162,39,.45);',
    'border-radius:3px;cursor:pointer;transition:color .2s,border-color .2s,box-shadow .3s}',
    '.a3d-modal__close:hover{color:#e6c457;border-color:#c9a227;box-shadow:0 0 16px rgba(201,162,39,.35)}',
    '.a3d-modal__close:focus-visible{outline:2px solid #e6c457;outline-offset:3px}',

    /* --- 3D-визуализатор на странице трека --- */
    '.a3d-viz{position:relative;margin:1.75rem 0 0;height:clamp(230px,36vw,300px);overflow:hidden;',
    'background:radial-gradient(60% 80% at 50% 50%,rgba(123,44,191,.16),transparent 70%),#0c0c12;',
    'border:1px solid rgba(201,162,39,.25);border-radius:3px;transition:border-color .4s,box-shadow .4s}',
    '.a3d-viz.is-live{border-color:rgba(201,162,39,.55);box-shadow:0 0 26px rgba(201,162,39,.16)}',
    '.a3d-viz canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    ".a3d-viz__label,.a3d-viz__state{position:absolute;z-index:2;margin:0;font:500 .68rem/1 'JetBrains Mono',ui-monospace,monospace;",
    'letter-spacing:.1em;pointer-events:none}',
    '.a3d-viz__label{left:.9rem;top:.8rem;color:#c9a227}',
    '.a3d-viz__state{right:.9rem;bottom:.8rem;color:#a09eae}',
    '.a3d-viz.is-live .a3d-viz__state{color:#e6c457}',
    '@media print{.a3d-modal,.a3d-viz{display:none!important}}'
  ].join('');

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var style = doc.createElement('style');
    style.id = 'a3d-style';
    style.textContent = CSS;
    (doc.head || html).appendChild(style);
  }

  /* ------------------------------------------------------------------------
     ПРОЦЕДУРНАЯ КАРТА ОКРУЖЕНИЯ (для металлических бликов) → PMREM
     ------------------------------------------------------------------------ */
  function createEnvironment(THREE, renderer, small) {
    try {
      var w = small ? 256 : 512;
      var h = w / 2;
      var c = doc.createElement('canvas');
      c.width = w;
      c.height = h;
      var g = c.getContext('2d');

      var bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1b1233');
      bg.addColorStop(0.42, '#16120d');
      bg.addColorStop(0.58, '#2c1b09');
      bg.addColorStop(1, '#3d0909');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      var spot = function (x, y, r, rgb, a) {
        var rg = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
        rg.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
        rg.addColorStop(1, 'rgba(' + rgb + ',0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, w, h);
      };
      spot(0.18, 0.28, 0.16, '255,236,190', 0.95);
      spot(0.62, 0.34, 0.2, '201,162,39', 0.8);
      spot(0.88, 0.22, 0.14, '123,44,191', 0.7);
      spot(0.45, 0.92, 0.3, '139,0,0', 0.9);
      spot(0.05, 0.85, 0.18, '178,18,18', 0.5);

      var strip = function (x, sw, y0, sh, a) {
        var gr = g.createLinearGradient(0, y0 * h, 0, (y0 + sh) * h);
        gr.addColorStop(0, 'rgba(255,244,214,0)');
        gr.addColorStop(0.5, 'rgba(255,244,214,' + a + ')');
        gr.addColorStop(1, 'rgba(255,244,214,0)');
        g.fillStyle = gr;
        g.fillRect(x * w, y0 * h, sw * w, sh * h);
      };
      strip(0.32, 0.012, 0.18, 0.4, 0.9);
      strip(0.74, 0.02, 0.2, 0.36, 0.75);

      var tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      var pmrem = new THREE.PMREMGenerator(renderer);
      var rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      pmrem.dispose();
      return rt;
    } catch (err) {
      return null; // без карты — только точечные источники
    }
  }

  function createGlowTexture(THREE, rgb) {
    var size = 128;
    var c = doc.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(' + rgb + ',0.9)');
    g.addColorStop(0.4, 'rgba(' + rgb + ',0.3)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  /* ========================================================================
     ТЕКСТУРЫ КНИГИ (рисуются на canvas)
     ======================================================================== */
  function seeded(seedStr) {
    var seed = 0;
    for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function goldGrad(ctx, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#f6dd86');
    g.addColorStop(0.45, '#c9a227');
    g.addColorStop(1, '#8a6d12');
    return g;
  }

  function textWidth(ctx, text, spacing) {
    var w = 0;
    for (var i = 0; i < text.length; i++) w += ctx.measureText(text.charAt(i)).width + spacing;
    return Math.max(0, w - spacing);
  }

  function drawSpaced(ctx, text, x, y, spacing) {
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + spacing;
    }
  }

  // «тиснение»: тёмная тень, светлый блик и золотая заливка
  function embossText(ctx, text, cx, y, size, spacing, weight, family) {
    ctx.save();
    ctx.font = weight + ' ' + size + 'px ' + family;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    var x = cx - textWidth(ctx, text, spacing) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    drawSpaced(ctx, text, x + 3, y + 3, spacing);
    ctx.fillStyle = 'rgba(255,240,190,0.5)';
    drawSpaced(ctx, text, x - 1.5, y - 1.5, spacing);
    ctx.fillStyle = goldGrad(ctx, x, y - size / 2, x, y + size / 2);
    drawSpaced(ctx, text, x, y, spacing);
    ctx.restore();
  }

  function wrapLines(ctx, text, maxW, spacing) {
    var words = String(text).split(' ');
    var lines = [];
    var cur = '';
    words.forEach(function (word) {
      var test = cur ? cur + ' ' + word : word;
      if (cur && textWidth(ctx, test, spacing) > maxW) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function drawSigil(ctx, cx, cy, r, stroke, glow) {
    ctx.save();
    ctx.lineWidth = Math.max(2, r * 0.045);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.shadowColor = glow;
    ctx.shadowBlur = r * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.62, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.62, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.moveTo(cx - r * 0.62, cy);
    ctx.lineTo(cx + r * 0.62, cy);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.32, cy);
    ctx.lineTo(cx, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.32, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawLeather(ctx, W, H, glow, grain) {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    var g1 = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, W * 0.85);
    g1.addColorStop(0, glow);
    g1.addColorStop(1, 'rgba(10,10,15,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    var g2 = ctx.createRadialGradient(W * 0.88, H * 1.02, 0, W * 0.88, H * 1.02, W * 0.7);
    g2.addColorStop(0, 'rgba(139,0,0,0.28)');
    g2.addColorStop(1, 'rgba(139,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // зерно кожи
    for (var i = 0; i < grain; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.28)';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }

    var vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawFrame(ctx, W, H, dim) {
    ctx.save();
    ctx.globalAlpha = dim ? 0.45 : 1;
    ctx.strokeStyle = goldGrad(ctx, 0, 0, W, H);
    ctx.lineWidth = W * 0.007;
    ctx.strokeRect(W * 0.07, H * 0.05, W * 0.86, H * 0.9);
    ctx.lineWidth = W * 0.0026;
    ctx.strokeRect(W * 0.095, H * 0.0725, W * 0.81, H * 0.855);
    // ромбы в углах рамки
    var pts = [[0.07, 0.05], [0.93, 0.05], [0.07, 0.95], [0.93, 0.95]];
    ctx.fillStyle = goldGrad(ctx, 0, 0, W, H);
    pts.forEach(function (p) {
      var x = W * p[0];
      var y = H * p[1];
      var r = W * 0.016;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  function drawImageCover(ctx, img, W, H) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    var scale = Math.max(W / iw, H / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    // лёгкое затемнение сверху и снизу — тиснение лучше читается
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10,10,15,0.55)');
    g.addColorStop(0.25, 'rgba(10,10,15,0.05)');
    g.addColorStop(0.75, 'rgba(10,10,15,0.05)');
    g.addColorStop(1, 'rgba(10,10,15,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return true;
  }

  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  /* spec: { kind: 'hero' | 'soon' | 'locked', title, number, cipher, image, mobile } */
  function makeCoverCanvas(spec) {
    var W = spec.mobile ? 768 : 1024;
    var H = Math.round(W * 1.5);
    var c = doc.createElement('canvas');
    c.width = W;
    c.height = H;
    var ctx = c.getContext('2d');
    var kind = spec.kind;
    var grain = spec.mobile ? 2500 : 6000;

    var glow = kind === 'soon' ? 'rgba(139,0,0,0.42)'
      : (kind === 'locked' ? 'rgba(139,0,0,0.16)' : 'rgba(123,44,191,0.24)');
    drawLeather(ctx, W, H, glow, grain);

    var hasImage = false;
    if (spec.image) {
      try {
        hasImage = drawImageCover(ctx, spec.image, W, H);
        ctx.getImageData(0, 0, 1, 1); // бросит SecurityError, если canvas «испорчен» (file://)
      } catch (err) {
        spec.image = null;
        return makeCoverCanvas(spec);
      }
    }

    var numeral = ROMAN[spec.number - 1] || String(spec.number);

    if (kind === 'locked') {
      var rnd = seeded(spec.cipher || 'sealed');
      var runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ▓▒░◆◇✕01';
      ctx.font = '500 ' + Math.round(W * 0.034) + 'px ' + FONT_MONO;
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(201,162,39,0.11)';
      var rowH = W * 0.046;
      for (var y = H * 0.08; y < H * 0.92; y += rowH) {
        var line = '';
        for (var k = 0; k < 24; k++) line += runes.charAt(Math.floor(rnd() * runes.length));
        drawSpaced(ctx, line, W * 0.11, y, W * 0.012);
      }
      // полосы-помехи
      for (var b = 0; b < 12; b++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(139,0,0,0.18)' : 'rgba(123,44,191,0.14)';
        ctx.fillRect(0, rnd() * H, W, 2 + rnd() * 10);
      }
      // линии развёртки
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (var s = 0; s < H; s += 5) ctx.fillRect(0, s, W, 1.5);

      drawFrame(ctx, W, H, true);
      embossText(ctx, 'GILDSPINE', W / 2, H * 0.12, W * 0.062, W * 0.012, '700', FONT_DISPLAY);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '500 ' + Math.round(W * 0.052) + 'px ' + FONT_MONO;
      ctx.fillStyle = 'rgba(201,162,39,0.55)';
      ctx.fillText(String(spec.title || '▓▓▓▓▓▓'), W / 2, H * 0.62);
      ctx.font = '700 ' + Math.round(W * 0.04) + 'px ' + FONT_MONO;
      ctx.fillStyle = '#d63a3a';
      ctx.shadowColor = 'rgba(139,0,0,0.9)';
      ctx.shadowBlur = W * 0.03;
      ctx.fillText('ARCHIVE SEALED', W / 2, H * 0.76);
      ctx.font = '500 ' + Math.round(W * 0.032) + 'px ' + FONT_MONO;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(201,162,39,0.6)';
      ctx.fillText('№ ' + numeral + ' // ' + (spec.cipher || ''), W / 2, H * 0.84);
      ctx.restore();
      return c;
    }

    drawFrame(ctx, W, H, false);
    embossText(ctx, 'GILDSPINE', W / 2, H * 0.12, W * 0.075, W * 0.014, '700', FONT_DISPLAY);

    if (!hasImage) {
      var sigilColor = kind === 'soon' ? '#c9a227' : goldGrad(ctx, 0, H * 0.25, 0, H * 0.5);
      drawSigil(ctx, W / 2, H * 0.37, W * 0.17, sigilColor, kind === 'soon' ? 'rgba(139,0,0,0.9)' : 'rgba(201,162,39,0.65)');

      var titleSize = W * 0.062;
      var spacing = W * 0.01;
      ctx.font = '700 ' + titleSize + 'px ' + FONT_DISPLAY;
      var lines = wrapLines(ctx, String(spec.title || '').toUpperCase(), W * 0.7, spacing);
      var startY = H * 0.62 - ((lines.length - 1) * titleSize * 1.25) / 2;
      lines.forEach(function (ln, i) {
        embossText(ctx, ln, W / 2, startY + i * titleSize * 1.25, titleSize, spacing, '700', FONT_DISPLAY);
      });
    }

    embossText(ctx, numeral, W / 2, H * 0.875, W * 0.07, W * 0.014, '700', FONT_DISPLAY);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 ' + Math.round(W * 0.028) + 'px ' + FONT_MONO;
    ctx.fillStyle = kind === 'soon' ? 'rgba(226,88,88,0.95)' : 'rgba(201,162,39,0.75)';
    ctx.fillText(kind === 'soon' ? 'COMING SOON' : 'STAY GOLD', W / 2, H * 0.93);
    ctx.restore();

    return c;
  }

  function makeSpineCanvas(spec) {
    var W = spec.mobile ? 192 : 256;
    var H = Math.round(W * 4.67);
    var c = doc.createElement('canvas');
    c.width = W;
    c.height = H;
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.5, 'rgba(60,50,20,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < (spec.mobile ? 800 : 1800); i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 2);
    embossText(ctx, 'GILDSPINE', 0, 0, W * 0.3, W * 0.07, '700', FONT_DISPLAY);
    ctx.restore();

    var numeral = ROMAN[spec.number - 1] || String(spec.number);
    embossText(ctx, numeral, W / 2, H * 0.075, W * 0.26, W * 0.03, '700', FONT_DISPLAY);
    return c;
  }

  // страницы: тонкие полоски слоёв бумаги (vertical — полоски вдоль v, иначе вдоль u)
  function makeStripesCanvas(vertical) {
    var S = 256;
    var c = doc.createElement('canvas');
    c.width = c.height = S;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, vertical ? S : 0, vertical ? 0 : S);
    g.addColorStop(0, '#d9c88f');
    g.addColorStop(0.5, '#eadfbc');
    g.addColorStop(1, '#d4c183');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    for (var i = 0; i < S; i += 2) {
      ctx.fillStyle = 'rgba(120,90,30,' + (0.05 + Math.random() * 0.12).toFixed(3) + ')';
      if (vertical) ctx.fillRect(i, 0, 1, S);
      else ctx.fillRect(0, i, S, 1);
    }
    // золотой налёт на торце
    ctx.fillStyle = 'rgba(201,162,39,0.22)';
    ctx.fillRect(0, 0, S, S);
    return c;
  }

  function makeTexture(THREE, canvas, renderer) {
    var tex = new THREE.CanvasTexture(canvas);
    try {
      var max = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 1;
      tex.anisotropy = Math.min(max, isMobile() ? 2 : 8);
    } catch (e) { /* не критично */ }
    return tex;
  }

  /* ========================================================================
     МОДЕЛЬ КНИГИ
     ======================================================================== */
  /* opts: { kind: 'hero'|'soon'|'locked', coverTex, spineTex, sideTex, topTex, env, sealed, wax } */
  function buildBook(THREE, opts) {
    var W = 2.0;   // ширина (x)
    var H = 2.9;   // высота (y)
    var T = 0.62;  // толщина (z)
    var C = 0.07;  // толщина обложки
    var envMap = opts.env ? opts.env.texture : null;

    var group = new THREE.Group();

    var leather = new THREE.MeshStandardMaterial({
      color: 0x0d0d14, metalness: 0.35, roughness: 0.55, envMap: envMap, envMapIntensity: 0.8
    });
    var goldMat = new THREE.MeshStandardMaterial({
      color: COLOR.gold, metalness: 0.92, roughness: 0.24, envMap: envMap, envMapIntensity: 1.0
    });
    var coverMat = new THREE.MeshStandardMaterial({
      map: opts.coverTex, metalness: 0.3, roughness: 0.5, envMap: envMap, envMapIntensity: 0.75
    });
    var spineMat = new THREE.MeshStandardMaterial({
      map: opts.spineTex, metalness: 0.3, roughness: 0.5, envMap: envMap, envMapIntensity: 0.75
    });
    var sideMat = new THREE.MeshStandardMaterial({
      map: opts.sideTex, metalness: 0.35, roughness: 0.55, envMap: envMap, envMapIntensity: 0.6
    });
    var topMat = new THREE.MeshStandardMaterial({
      map: opts.topTex, metalness: 0.35, roughness: 0.55, envMap: envMap, envMapIntensity: 0.6
    });

    // порядок материалов BoxGeometry: +x, -x, +y, -y, +z, -z
    var front = new THREE.Mesh(
      new THREE.BoxGeometry(W - C, H, C),
      [leather, leather, leather, leather, coverMat, leather]
    );
    front.position.set(C / 2, 0, T / 2 - C / 2);
    group.add(front);

    var back = new THREE.Mesh(
      new THREE.BoxGeometry(W - C, H, C),
      [leather, leather, leather, leather, leather, leather]
    );
    back.position.set(C / 2, 0, -(T / 2 - C / 2));
    group.add(back);

    var spine = new THREE.Mesh(
      new THREE.BoxGeometry(C, H, T),
      [leather, spineMat, leather, leather, leather, leather]
    );
    spine.position.set(-W / 2 + C / 2, 0, 0);
    group.add(spine);

    // золотые нервюры на корешке
    [-1.05, -0.55, 0.55, 1.05].forEach(function (y) {
      var rib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, T + 0.02), goldMat);
      rib.position.set(-W / 2 - 0.012, y, 0);
      group.add(rib);
    });

    // блок страниц (кремово-золотой торец)
    var pagesW = W - C - 0.07;
    var pages = new THREE.Mesh(
      new THREE.BoxGeometry(pagesW, H - 0.16, T - 2 * C + 0.02),
      [sideMat, leather, topMat, topMat, sideMat, sideMat]
    );
    pages.position.set((-W / 2 + C + W / 2 - 0.07) / 2, 0, 0);
    group.add(pages);

    // золотые уголки на лицевой обложке
    var shape = new THREE.Shape();
    var L = 0.42;
    shape.moveTo(0, 0);
    shape.lineTo(L, 0);
    shape.quadraticCurveTo(L * 0.34, L * 0.34, 0, L);
    shape.lineTo(0, 0);
    var cornerGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1
    });
    var corners = [
      { x: -W / 2 + C, y: -H / 2, r: 0 },
      { x: W / 2, y: -H / 2, r: Math.PI / 2 },
      { x: W / 2, y: H / 2, r: Math.PI },
      { x: -W / 2 + C, y: H / 2, r: -Math.PI / 2 }
    ];
    corners.forEach(function (cn) {
      var m = new THREE.Mesh(cornerGeo, goldMat);
      m.position.set(cn.x, cn.y, T / 2);
      m.rotation.z = cn.r;
      group.add(m);
    });

    // закладка-лента
    var ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.55, 0.012),
      new THREE.MeshStandardMaterial({ color: COLOR.blood, metalness: 0.15, roughness: 0.4, envMap: envMap, envMapIntensity: 0.5 })
    );
    ribbon.position.set(-0.35, -H / 2 - 0.2, 0.05);
    group.add(ribbon);

    var anim = { sealed: null, wax: null };

    /* ---- запечатанный том: энергетические замки ---- */
    if (opts.sealed) {
      var rx = W / 2 + 0.08;
      var rz = T / 2 + 0.08;
      var bandCurve = function (y) {
        var pts = [];
        for (var i = 0; i < 56; i++) {
          var a = (i / 56) * Math.PI * 2;
          var cs = Math.cos(a);
          var sn = Math.sin(a);
          pts.push(new THREE.Vector3(
            Math.sign(cs) * Math.pow(Math.abs(cs), 0.25) * rx,
            y,
            Math.sign(sn) * Math.pow(Math.abs(sn), 0.25) * rz
          ));
        }
        return new THREE.CatmullRomCurve3(pts, true);
      };

      var glowMats = [];
      var addBand = function (y, metal) {
        var curve = bandCurve(y);
        if (metal) {
          group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.032, 8, true), goldMat));
        }
        var gm = new THREE.MeshBasicMaterial({
          color: metal ? COLOR.bloodBright : COLOR.blood,
          transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
        });
        glowMats.push(gm);
        group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, metal ? 0.06 : 0.026, 8, true), gm));
      };
      addBand(0.95, true);
      addBand(-0.95, true);
      addBand(0.0, false); // багровая «плазма» по центру

      // замок на лицевой стороне
      var lock = new THREE.Group();
      lock.position.set(0, 0, rz + 0.04);
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.14), goldMat);
      lock.add(body);
      var shackle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20, Math.PI), goldMat);
      shackle.position.y = 0.15;
      lock.add(shackle);
      var gemMat = new THREE.MeshStandardMaterial({
        color: COLOR.blood, emissive: COLOR.bloodBright, emissiveIntensity: 1.5, metalness: 0.2, roughness: 0.3
      });
      var gem = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), gemMat);
      gem.position.z = 0.075;
      lock.add(gem);
      group.add(lock);

      var glowTex = createGlowTexture(THREE, '178,18,18');
      var glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      glowSprite.scale.set(1.3, 1.3, 1);
      glowSprite.position.set(0, 0, rz + 0.16);
      group.add(glowSprite);

      anim.sealed = { glowMats: glowMats, gemMat: gemMat, glowSprite: glowSprite };
    }

    /* ---- том-анонс: багровая восковая печать ---- */
    if (opts.wax) {
      var wax = new THREE.Group();
      wax.position.set(0, -0.62, T / 2 + 0.05);
      var waxMat = new THREE.MeshStandardMaterial({
        color: COLOR.blood, emissive: 0x300000, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.35, envMap: envMap
      });
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.06, 28), waxMat);
      disc.rotation.x = Math.PI / 2;
      wax.add(disc);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 8, 32), goldMat);
      ring.position.z = 0.035;
      wax.add(ring);
      var diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), goldMat);
      diamond.scale.set(0.8, 1.2, 0.35);
      diamond.position.z = 0.05;
      wax.add(diamond);
      group.add(wax);
      anim.wax = { waxMat: waxMat };
    }

    function update(t) {
      var pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      if (anim.sealed) {
        anim.sealed.glowMats.forEach(function (m, i) {
          m.opacity = 0.32 + 0.32 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.3));
        });
        anim.sealed.gemMat.emissiveIntensity = 1.0 + 1.6 * pulse;
        anim.sealed.glowSprite.material.opacity = 0.3 + 0.35 * pulse;
      }
      if (anim.wax) anim.wax.waxMat.emissiveIntensity = 0.6 + 0.7 * pulse;
    }

    return { group: group, update: update };
  }

  function disposeModel(model) {
    if (!model) return;
    model.group.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      mats.forEach(function (m) {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
  }

  /* ========================================================================
     ВЬЮЕР: вращение мышью / пальцем, инерция, блики, пауза вне экрана
     ======================================================================== */
  function createViewer(THREE, canvas, wrap, opts) {
    opts = opts || {};
    var MOBILE = isMobile();

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: !MOBILE,
        powerPreference: MOBILE ? 'low-power' : 'high-performance'
      });
    } catch (err) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

    scene.add(new THREE.AmbientLight(0x221a10, 0.55));
    var key = new THREE.PointLight(COLOR.gold, 1.7, 0);
    key.position.set(3.2, 3.2, 4.5);
    var rim = new THREE.PointLight(COLOR.blood, 1.9, 0);
    rim.position.set(-3, -2.4, -2.2);
    var neon = new THREE.PointLight(COLOR.neon, 1.0, 0);
    neon.position.set(-2.8, 2.6, 2.2);
    var glint = new THREE.PointLight(0xfff0c8, 1.2, 0); // следует за курсором — металлические блики
    glint.position.set(0, 0, 4.5);
    scene.add(key, rim, neon, glint);
    var glintTarget = new THREE.Vector3(0, 0, 4.5);

    var env = createEnvironment(THREE, renderer, MOBILE);

    var holder = new THREE.Group();
    scene.add(holder);
    holder.rotation.set(0.12, -0.55, 0);
    var floater = new THREE.Group();
    holder.add(floater);

    var model = null;

    /* ---- вращение ---- */
    var qx = new THREE.Quaternion();
    var qy = new THREE.Quaternion();
    var AX = new THREE.Vector3(1, 0, 0);
    var AY = new THREE.Vector3(0, 1, 0);

    function rotateBy(dx, dy) {
      qy.setFromAxisAngle(AY, dx);
      qx.setFromAxisAngle(AX, dy);
      holder.quaternion.premultiply(qy).premultiply(qx);
      holder.quaternion.normalize();
    }

    var dragging = false;
    var lastX = 0;
    var lastY = 0;
    var lastT = 0;
    var velX = 0;
    var velY = 0;
    var idleAt = performance.now();

    function interacted() {
      if (opts.onInteract) opts.onInteract();
    }

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = performance.now();
      velX = 0;
      velY = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      wrap.classList.add('is-grabbing');
      interacted();
    }

    function onMove(e) {
      var now = performance.now();
      if (dragging) {
        var dx = e.clientX - lastX;
        var dy = e.clientY - lastY;
        var dt = Math.max(1, now - lastT) / 1000;
        rotateBy(dx * 0.011, dy * 0.011);
        velX = clamp((dx * 0.011) / dt, -8, 8);
        velY = clamp((dy * 0.011) / dt, -8, 8);
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
        idleAt = now;
      }
      if (e.pointerType !== 'touch') {
        var r = canvas.getBoundingClientRect();
        var nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
        var ny = -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1);
        glintTarget.set(nx * 3.6, ny * 3.6, 4.2);
      }
    }

    function onUp(e) {
      dragging = false;
      wrap.classList.remove('is-grabbing');
      idleAt = performance.now();
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* не критично */ }
    }

    function onKey(e) {
      var step = 2.4;
      if (e.key === 'ArrowLeft') velX = -step;
      else if (e.key === 'ArrowRight') velX = step;
      else if (e.key === 'ArrowUp') velY = -step;
      else if (e.key === 'ArrowDown') velY = step;
      else return;
      e.preventDefault();
      idleAt = performance.now();
      interacted();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);

    /* ---- размеры ---- */
    var RADIUS = opts.radius || 1.95;

    function fit() {
      var w = Math.max(1, wrap.clientWidth);
      var h = Math.max(1, wrap.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.25 : 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var vf = (camera.fov * Math.PI) / 180;
      var hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      var half = Math.min(vf, hf) / 2;
      camera.position.set(0, 0, (RADIUS * 1.12) / Math.sin(half));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    /* ---- кадр ---- */
    var time = 0;
    var running = false;
    var rafId = 0;
    var last = 0;
    var inView = true;
    var docVisible = !doc.hidden;
    var paused = false;
    var ctxLost = false;
    var minInterval = MOBILE ? 1000 / 30 - 2 : 0;

    function update(dt) {
      time += dt;
      if (!dragging) {
        rotateBy(velX * dt, velY * dt);
        var damp = Math.exp(-dt * 3);
        velX *= damp;
        velY *= damp;
        if (!reduced() && performance.now() - idleAt > 2500) rotateBy(dt * 0.32, 0); // медленный «поворотный стол»
      }
      floater.position.y = reduced() ? 0 : Math.sin(time * 0.9) * 0.06;
      glint.position.lerp(glintTarget, 1 - Math.exp(-dt * 6));
      if (model && model.update) model.update(time);
    }

    function renderOnce() {
      renderer.render(scene, camera);
    }

    function frame(now) {
      if (!running) return;
      rafId = window.requestAnimationFrame(frame);
      var elapsed = now - last;
      if (elapsed < minInterval) return;
      last = now;
      update(Math.min(elapsed / 1000, 0.1));
      renderOnce();
    }

    function sync() {
      var should = inView && docVisible && !paused && !ctxLost;
      if (should && !running) {
        running = true;
        last = performance.now();
        rafId = window.requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        window.cancelAnimationFrame(rafId);
      }
    }

    var ro = null;
    var io = null;

    function onResize() {
      fit();
      if (!running) { update(0); renderOnce(); }
    }

    function onVisibility() { docVisible = !doc.hidden; sync(); }
    function onLost(e) { e.preventDefault(); ctxLost = true; sync(); }
    function onRestored() { ctxLost = false; sync(); }

    fit();
    if (typeof window.ResizeObserver === 'function') {
      ro = new window.ResizeObserver(onResize);
      ro.observe(wrap);
    } else {
      window.addEventListener('resize', onResize);
    }
    if (typeof window.IntersectionObserver === 'function') {
      io = new window.IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0 });
      io.observe(wrap);
    }
    doc.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    function setModel(next) {
      if (model) {
        floater.remove(model.group);
        disposeModel(model);
      }
      model = next;
      if (model) floater.add(model.group);
      holder.rotation.set(0.12, -0.55, 0);
      velX = velY = 0;
      idleAt = performance.now();
      update(0);
      renderOnce();
      sync();
    }

    function dispose() {
      running = false;
      window.cancelAnimationFrame(rafId);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
      if (io) io.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (model) disposeModel(model);
      if (env) env.dispose();
      renderer.dispose();
    }

    return {
      renderer: renderer,
      env: env,
      setModel: setModel,
      setPaused: function (v) { paused = !!v; sync(); },
      resize: onResize,
      dispose: dispose
    };
  }

  /* ------------------------------------------------------------------------
     Сборка модели тома из данных js/data.js
     ------------------------------------------------------------------------ */
  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function fontsReady() {
    if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
    var timeout = new Promise(function (r) { window.setTimeout(r, 1200); });
    return Promise.race([
      Promise.all([doc.fonts.load("700 40px 'Cinzel'"), doc.fonts.load("500 20px 'JetBrains Mono'")]).catch(noop),
      timeout
    ]);
  }

  /* kind: 'hero' | 'soon' | 'locked' */
  function createBookModel(THREE, viewer, book, kind) {
    var wantsImage = kind !== 'locked' && book.cover;
    return Promise.all([fontsReady(), wantsImage ? loadImage(book.cover) : Promise.resolve(null)]).then(function (res) {
      var mobile = isMobile();
      var spec = {
        kind: kind,
        title: tr(book.title),
        number: book.number,
        cipher: book.cipher,
        image: res[1],
        mobile: mobile
      };
      var renderer = viewer.renderer;
      var coverTex = makeTexture(THREE, makeCoverCanvas(spec), renderer);
      var spineTex = makeTexture(THREE, makeSpineCanvas(spec), renderer);
      var sideTex = makeTexture(THREE, makeStripesCanvas(true), renderer);
      var topTex = makeTexture(THREE, makeStripesCanvas(false), renderer);

      return buildBook(THREE, {
        kind: kind,
        coverTex: coverTex,
        spineTex: spineTex,
        sideTex: sideTex,
        topTex: topTex,
        env: viewer.env,
        sealed: kind === 'locked',
        wax: kind === 'soon'
      });
    });
  }

  /* ========================================================================
     book.html
     ======================================================================== */
  function initBookPage() {
    var d = D();
    var main = $('#book-main');
    var grid = $('#series-grid');
    if (!d || (!main && !grid)) return;

    injectStyle();

    var mobile = isMobile();
    var motionOk = !reduced();
    var scheduled = false;

    /* ---------------- 1. Главный том ---------------- */
    var hero = { wrap: null, canvas: null, hint: null, viewer: null, ready: false, failed: false, building: false };

    function mountHero() {
      if (!main || hero.failed) return;
      var host = $('.book-hero__cover', main);
      if (!host) return;

      if (!hero.wrap) {
        hero.wrap = el('div', 'a3d-viewer a3d-hero');
        hero.canvas = doc.createElement('canvas');
        hero.canvas.tabIndex = 0;
        hero.canvas.setAttribute('role', 'img');
        hero.hint = el('p', 'a3d-hint', S('hint'));
        hero.wrap.appendChild(hero.canvas);
        hero.wrap.appendChild(hero.hint);
      }
      hero.canvas.setAttribute('aria-label', S('heroAria'));
      hero.hint.textContent = S('hint');

      if (hero.wrap.parentNode !== host) host.appendChild(hero.wrap);
      if (hero.ready) host.classList.add('a3d-has-3d');
    }

    function buildHeroModel() {
      var book = d.getBookById('book-1');
      if (!book || !hero.viewer || hero.building) return;
      hero.building = true;
      createBookModel(window.THREE, hero.viewer, book, 'hero').then(function (model) {
        hero.viewer.setModel(model);
        hero.building = false;
        if (!hero.ready) {
          hero.ready = true;
          mountHero();
        }
      }).catch(function () {
        hero.building = false;
        hero.failed = true;
      });
    }

    function startHero() {
      if (!main) return;
      mountHero();
      loadThree().then(function (THREE) {
        if (!hero.wrap) mountHero();
        if (!hero.wrap) return;
        // на время создания контекста wrap должен иметь размер → показываем контейнер
        hero.wrap.style.display = 'block';
        hero.viewer = createViewer(THREE, hero.canvas, hero.wrap, {
          onInteract: function () { hero.hint.classList.add('is-hidden'); }
        });
        hero.wrap.style.display = '';
        if (!hero.viewer) { hero.failed = true; return; }
        buildHeroModel();
      }).catch(function () { hero.failed = true; });
    }

    /* ---------------- 2. Tilt карточек ---------------- */
    var visibleCards = new Set();
    var scrollRaf = 0;
    var gyro = { x: 0, y: 0 };
    var cardObserver = null;

    function cardLabel(index) {
      return index === 0 ? S('toFirst') : S('inspect').replace('{n}', String(index + 1));
    }

    function applyScrollTilt() {
      scrollRaf = 0;
      var vh = window.innerHeight || 1;
      visibleCards.forEach(function (card) {
        if (!card.isConnected) { visibleCards.delete(card); return; }
        var r = card.getBoundingClientRect();
        var cy = (r.top + r.height / 2) / vh - 0.5;
        card.style.setProperty('--rx', (clamp(-cy * 16, -9, 9) + gyro.x).toFixed(2) + 'deg');
        card.style.setProperty('--ry', gyro.y.toFixed(2) + 'deg');
        card.style.setProperty('--gx', (50 + gyro.y * 3).toFixed(1) + '%');
        card.style.setProperty('--gy', ((cy + 0.5) * 100).toFixed(1) + '%');
        card.classList.add('is-scroll');
      });
    }

    function kickScroll() {
      if (!scrollRaf) scrollRaf = window.requestAnimationFrame(applyScrollTilt);
    }

    function setupMobileTilt() {
      if (!('IntersectionObserver' in window)) return;
      cardObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) visibleCards.add(en.target); else visibleCards.delete(en.target);
        });
        kickScroll();
      }, { threshold: 0 });

      window.addEventListener('scroll', kickScroll, { passive: true });

      // гироскоп (Android и браузеры без системного запроса); на iOS работает наклон от скролла
      var DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission !== 'function') {
        var lastGyro = 0;
        window.addEventListener('deviceorientation', function (e) {
          var now = performance.now();
          if (now - lastGyro < 50 || e.gamma === null || e.beta === null) return;
          lastGyro = now;
          gyro.y = clamp(e.gamma / 25, -1, 1) * 9;
          gyro.x = clamp((e.beta - 45) / 30, -1, 1) * -6;
          kickScroll();
        }, true);
      }
    }

    function enhanceCard(card, index) {
      if (card.__a3d) return;
      card.__a3d = true;
      card.classList.add('a3d-tilt');

      var glare = el('span', 'a3d-glare');
      glare.setAttribute('aria-hidden', 'true');
      card.appendChild(glare);

      if (index > 0) {
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.setAttribute('aria-label', cardLabel(index));
      }

      if (motionOk && !mobile) {
        var raf = 0;
        var next = null;
        var flush = function () {
          raf = 0;
          if (!next) return;
          card.style.setProperty('--rx', next.rx + 'deg');
          card.style.setProperty('--ry', next.ry + 'deg');
          card.style.setProperty('--gx', next.gx + '%');
          card.style.setProperty('--gy', next.gy + '%');
        };
        card.addEventListener('pointermove', function (e) {
          if (e.pointerType === 'touch') return;
          var r = card.getBoundingClientRect();
          var px = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
          var py = clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1);
          next = {
            rx: ((0.5 - py) * 14).toFixed(2),
            ry: ((px - 0.5) * 14).toFixed(2),
            gx: (px * 100).toFixed(1),
            gy: (py * 100).toFixed(1)
          };
          card.classList.add('is-tilting');
          if (!raf) raf = window.requestAnimationFrame(flush);
        });
        card.addEventListener('pointerleave', function () {
          next = null;
          card.classList.remove('is-tilting');
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
        });
      } else if (motionOk && cardObserver) {
        cardObserver.observe(card);
      }

      card.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a, button')) return;
        activateCard(card);
      });
      card.addEventListener('keydown', function (e) {
        if (e.target !== card) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateCard(card);
        }
      });
    }

    function activateCard(card) {
      var index = Array.prototype.indexOf.call(grid.children, card);
      if (index < 0) return;
      if (index === 0) {
        var target = $('#first-book');
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: motionOk ? 'smooth' : 'auto', block: 'start' });
        return;
      }
      openModal(index, card);
    }

    function enhanceCards() {
      if (!grid) return;
      Array.prototype.forEach.call(grid.children, function (card, index) {
        if (card.classList.contains('series-card')) enhanceCard(card, index);
      });
    }

    /* ---------------- 3. Модальное окно ---------------- */
    var modal = null;

    function buildModal() {
      var root = el('div', 'a3d-modal');
      root.setAttribute('aria-hidden', 'true');

      var backdrop = el('div', 'a3d-modal__backdrop');
      backdrop.addEventListener('click', closeModal);

      var panel = el('div', 'a3d-modal__panel');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');

      var closeBtn = el('button', 'a3d-modal__close', '×');
      closeBtn.type = 'button';
      closeBtn.addEventListener('click', closeModal);

      var stage = el('div', 'a3d-modal__stage');
      var viewerWrap = el('div', 'a3d-viewer');
      var canvas = doc.createElement('canvas');
      canvas.tabIndex = 0;
      canvas.setAttribute('role', 'img');
      var hint = el('p', 'a3d-hint');
      var loading = el('div', 'a3d-loading');
      viewerWrap.appendChild(canvas);
      viewerWrap.appendChild(hint);
      viewerWrap.appendChild(loading);
      stage.appendChild(viewerWrap);

      var info = el('div', 'a3d-modal__info');
      var label = el('p', 'a3d-modal__label');
      var title = el('h2', 'a3d-modal__title');
      title.id = 'a3d-modal-title';
      panel.setAttribute('aria-labelledby', title.id);
      var status = el('p', 'a3d-modal__status');
      var text = el('p', 'a3d-modal__text');
      var tags = el('ul', 'a3d-modal__tags');
      var actions = el('div', 'a3d-modal__actions');
      info.appendChild(label);
      info.appendChild(title);
      info.appendChild(tags);
      info.appendChild(status);
      info.appendChild(text);
      info.appendChild(actions);

      panel.appendChild(closeBtn);
      panel.appendChild(stage);
      panel.appendChild(info);
      root.appendChild(backdrop);
      root.appendChild(panel);
      doc.body.appendChild(root);

      return {
        root: root, panel: panel, closeBtn: closeBtn, stage: stage, viewerWrap: viewerWrap, canvas: canvas,
        hint: hint, loading: loading, label: label, title: title, status: status, text: text, tags: tags,
        actions: actions, viewer: null, viewerFailed: false, index: -1, lastFocus: null, flat: null, token: 0
      };
    }

    function fillModal(index) {
      var book = d.books[index];
      if (!book || !modal) return;
      var locked = book.status === 'locked';
      var num = book.number < 10 ? '0' + book.number : String(book.number);

      modal.label.textContent = S('book') + ' ' + num + (locked && book.cipher ? ' // ' + book.cipher : '');
      modal.title.textContent = tr(book.title);

      modal.tags.textContent = '';
      var tagList = locked
        ? ['LOCKED', S('key') + ': ' + (book.cipher || '????')]
        : [S('announced'), S('soon')];
      tagList.forEach(function (t) { modal.tags.appendChild(el('span', null, t)); });

      if (locked) {
        modal.status.textContent = S('denied');
        modal.status.classList.remove('is-gold');
        modal.text.textContent = (book.hint ? tr(book.hint) + ' ' : '') + S('sealedNote');
      } else {
        modal.status.textContent = S('teaser');
        modal.status.classList.add('is-gold');
        var paragraphs = tr(book.annotation) || [];
        modal.text.textContent = (paragraphs[0] ? paragraphs[0] + ' ' : '') + S('soonNote');
      }

      modal.actions.textContent = '';
      if (!locked) {
        var sub = el('a', 'btn btn--solid', S('subscribe'));
        sub.href = '#subscribe';
        sub.addEventListener('click', function () { closeModal(); });
        modal.actions.appendChild(sub);
      }

      modal.closeBtn.setAttribute('aria-label', S('close'));
      modal.hint.textContent = S('hint');
      modal.canvas.setAttribute('aria-label', S('modalAria').replace('{n}', String(book.number)));
    }

    function showFlatFallback(card) {
      if (modal.flat) { modal.flat.remove(); modal.flat = null; }
      var source = card ? card.querySelector('.book-cover, .artifact') : null;
      if (!source) return;
      modal.flat = el('div', 'a3d-modal__flat');
      modal.flat.appendChild(source.cloneNode(true));
      modal.stage.appendChild(modal.flat);
      modal.hint.classList.add('is-hidden');
    }

    function loadModalModel(index, card) {
      var token = ++modal.token;
      modal.loading.textContent = S('loading');
      loadThree().then(function (THREE) {
        if (!modal.viewer && !modal.viewerFailed) {
          modal.viewer = createViewer(THREE, modal.canvas, modal.viewerWrap, {
            onInteract: function () { modal.hint.classList.add('is-hidden'); }
          });
          if (!modal.viewer) modal.viewerFailed = true;
        }
        if (modal.viewerFailed) throw new Error('WebGL недоступен');
        var book = d.books[index];
        var kind = book.status === 'locked' ? 'locked' : 'soon';
        return createBookModel(THREE, modal.viewer, book, kind);
      }).then(function (model) {
        if (token !== modal.token || modal.index !== index) { disposeModel(model); return; }
        modal.viewer.setModel(model);
        modal.viewer.setPaused(false);
        modal.loading.textContent = '';
        modal.hint.classList.remove('is-hidden');
      }).catch(function () {
        if (token !== modal.token) return;
        modal.loading.textContent = '';
        modal.viewerWrap.querySelector('canvas').style.display = 'none';
        showFlatFallback(card);
      });
    }

    function openModal(index, card) {
      if (!modal) modal = buildModal();
      if (hero.viewer) hero.viewer.setPaused(true); // под окном главный том не рисуем

      modal.index = index;
      modal.lastFocus = doc.activeElement;
      if (modal.flat) { modal.flat.remove(); modal.flat = null; }
      modal.canvas.style.display = '';
      fillModal(index);

      modal.root.setAttribute('aria-hidden', 'false');
      html.classList.add('a3d-lock');
      window.requestAnimationFrame(function () {
        modal.root.classList.add('is-open');
        modal.closeBtn.focus();
        if (modal.viewer) modal.viewer.resize();
      });
      loadModalModel(index, card);
    }

    function closeModal() {
      if (!modal || !modal.root.classList.contains('is-open')) return;
      modal.token++;
      modal.index = -1;
      modal.root.classList.remove('is-open');
      modal.root.setAttribute('aria-hidden', 'true');
      html.classList.remove('a3d-lock');
      if (modal.viewer) modal.viewer.setPaused(true);
      if (hero.viewer) hero.viewer.setPaused(false);
      if (modal.lastFocus && modal.lastFocus.focus) modal.lastFocus.focus();
    }

    // Esc и «ловушка» фокуса внутри окна
    doc.addEventListener('keydown', function (e) {
      if (!modal || !modal.root.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = Array.prototype.filter.call(
        modal.panel.querySelectorAll('button, a[href], canvas[tabindex="0"]'),
        function (n) { return n.offsetParent !== null || n === modal.closeBtn; }
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && doc.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });

    /* ---------------- Наблюдение за перерисовкой страницы ---------------- */
    function refresh() {
      scheduled = false;
      enhanceCards();
      mountHero();
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(refresh);
    }

    if ('MutationObserver' in window) {
      if (main) new MutationObserver(schedule).observe(main, { childList: true });
      if (grid) new MutationObserver(schedule).observe(grid, { childList: true });
    }

    // смена языка: тексты на текстурах и в окне
    doc.addEventListener('gildspine:languagechange', function () {
      if (hero.viewer) buildHeroModel();
      if (modal && modal.index >= 0) {
        fillModal(modal.index);
        loadModalModel(modal.index, null);
      }
    });

    /* ---------------- Старт ---------------- */
    if (mobile && motionOk) setupMobileTilt();
    enhanceCards();

    // три.js и модель главного тома — сразу после первой отрисовки
    window.setTimeout(startHero, 30);
    // подгружаем библиотеку заранее и для окна (если главный том не стартовал)
    if (!main) loadThree().catch(noop);
  }

  /* ========================================================================
     track.html — 3D-визуализатор частот
     ======================================================================== */
  var VIZ_VERT = [
    'uniform float uTime;',
    'uniform float uBass;',
    'uniform float uMid;',
    'uniform float uTreble;',
    'uniform float uPulse;',
    'uniform float uPixelRatio;',
    'uniform float uPointSize;',
    'varying float vMix;',
    'varying float vGlow;',
    'void main() {',
    '  vec3 n = normalize(position);',
    '  float w1 = sin(n.x * 4.0 + n.y * 3.0 + uTime * 1.7);',
    '  float w2 = sin(n.y * 6.0 - n.z * 5.0 + uTime * 2.6);',
    '  float disp = uBass * 0.38 * (0.55 + 0.45 * w1) + uMid * 0.16 * w2 + uTreble * 0.07 * sin(n.z * 14.0 + uTime * 6.0);',
    '  vec3 p = position * (1.0 + uPulse * 0.16) + n * disp;',
    '  vMix = clamp(0.5 + 0.5 * sin(n.y * 3.0 + uTime * 0.8) + uBass * 0.6, 0.0, 1.0);',
    '  vGlow = 0.6 + uPulse * 0.9 + uBass * 0.7;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = uPointSize * uPixelRatio * (1.0 + uBass * 1.4) * (6.0 / -mv.z);',
    '}'
  ].join('\n');

  var VIZ_FRAG_LINE = [
    'uniform vec3 uGold;',
    'uniform vec3 uBlood;',
    'varying float vMix;',
    'varying float vGlow;',
    'void main() {',
    '  vec3 c = mix(uGold, uBlood, vMix) * vGlow;',
    '  gl_FragColor = vec4(c, 0.85 * clamp(vGlow, 0.0, 1.0));',
    '}'
  ].join('\n');

  var VIZ_FRAG_POINT = [
    'uniform vec3 uGold;',
    'uniform vec3 uBlood;',
    'varying float vMix;',
    'varying float vGlow;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  if (d > 1.0) discard;',
    '  float a = pow(1.0 - d, 1.6);',
    '  vec3 c = mix(uGold, uBlood, vMix) * (vGlow + 0.4);',
    '  gl_FragColor = vec4(c, a);',
    '}'
  ].join('\n');

  function initTrackPage() {
    var player = $('#player');
    var audio = $('#player-audio');
    if (!player || !audio || !player.parentNode) return;

    injectStyle();

    var MOBILE = isMobile();
    var motion = reduced() ? 0.35 : 1;

    // трек нужен только ради BPM (запасной «ритм», если анализ звука недоступен)
    var bpm = 128;
    (function findBpm() {
      var d = D();
      if (!d) return;
      var id = new URLSearchParams(location.search).get('id');
      var t = (id && d.getTrackById(id)) || d.getLatestTrack() || (d.tracks && d.tracks[0]);
      if (t && t.bpm) bpm = t.bpm;
    })();

    /* ---- DOM ---- */
    var wrap = el('div', 'a3d-viz');
    wrap.setAttribute('role', 'img');
    var canvas = doc.createElement('canvas');
    var labelEl = el('p', 'a3d-viz__label');
    var stateEl = el('p', 'a3d-viz__state');
    wrap.appendChild(canvas);
    wrap.appendChild(labelEl);
    wrap.appendChild(stateEl);
    player.parentNode.insertBefore(wrap, player);

    var live = false;
    function playerUnavailable() {
      return player.getAttribute('data-state') === 'unavailable';
    }

    function renderLabels() {
      labelEl.textContent = S('vizLabel');
      wrap.setAttribute('aria-label', S('vizAria'));
      stateEl.textContent = playerUnavailable() ? S('vizNone') : (live ? S('vizLive') : S('vizIdle'));
      wrap.classList.toggle('is-live', live);
    }
    renderLabels();
    doc.addEventListener('gildspine:languagechange', renderLabels);
    if ('MutationObserver' in window) {
      new MutationObserver(renderLabels).observe(player, { attributes: true, attributeFilter: ['data-state'] });
    }

    /* ---- аудио-анализ ---- */
    var A = { ctx: null, analyser: null, data: null, failed: false, silentFrames: 0, simulate: false };

    function connectAudio() {
      if (A.analyser || A.failed) {
        if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
        return;
      }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { A.failed = true; return; }
        A.ctx = MOBILE ? new AC({ latencyHint: 'playback' }) : new AC();
        var src = A.ctx.createMediaElementSource(audio);
        A.analyser = A.ctx.createAnalyser();
        A.analyser.fftSize = MOBILE ? 256 : 512;
        A.analyser.smoothingTimeConstant = 0.8;
        src.connect(A.analyser);
        A.analyser.connect(A.ctx.destination); // звук должен идти и через граф
        A.data = new Uint8Array(A.analyser.frequencyBinCount);
        if (A.ctx.state === 'suspended') A.ctx.resume();
      } catch (err) {
        A.failed = true;
        A.simulate = true;
      }
    }

    // подключаемся в жесте нажатия Play (нужно для политики автозапуска, особенно на iOS)
    var playBtn = $('#player-play');
    if (playBtn) playBtn.addEventListener('click', connectAudio, true);
    audio.addEventListener('play', function () {
      live = true;
      renderLabels();
      if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    });
    var stopLive = function () { live = false; renderLabels(); };
    audio.addEventListener('pause', stopLive);
    audio.addEventListener('ended', stopLive);
    if (!audio.paused) { live = true; renderLabels(); }

    /* ---- Three.js ---- */
    loadThree().then(function (THREE) {
      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvas, alpha: true, antialias: !MOBILE,
          powerPreference: MOBILE ? 'low-power' : 'high-performance'
        });
      } catch (err) {
        wrap.parentNode.removeChild(wrap);
        return;
      }
      renderer.setClearColor(0x000000, 0);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
      camera.position.set(0, 0, 6.2);

      var U = {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uPulse: { value: 0 },
        uPixelRatio: { value: 1 },
        uPointSize: { value: MOBILE ? 4.5 : 5.5 },
        uGold: { value: new THREE.Color(COLOR.gold) },
        uBlood: { value: new THREE.Color(COLOR.blood) }
      };

      var art = new THREE.Group();
      scene.add(art);

      // геодезическая сфера: линии + вершины
      var ico = new THREE.IcosahedronGeometry(1.15, MOBILE ? 1 : 2);
      var lineMat = new THREE.ShaderMaterial({
        uniforms: U, vertexShader: VIZ_VERT, fragmentShader: VIZ_FRAG_LINE,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var pointMat = new THREE.ShaderMaterial({
        uniforms: U, vertexShader: VIZ_VERT, fragmentShader: VIZ_FRAG_POINT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var sphere = new THREE.Group();
      sphere.add(new THREE.LineSegments(new THREE.EdgesGeometry(ico, 1), lineMat));
      sphere.add(new THREE.Points(ico, pointMat));
      art.add(sphere);

      // светящееся ядро и гало
      var coreMat = new THREE.MeshBasicMaterial({
        color: COLOR.gold, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), coreMat);
      art.add(core);

      var haloMat = new THREE.SpriteMaterial({
        map: createGlowTexture(THREE, '201,162,39'), transparent: true, opacity: 0.3,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      var halo = new THREE.Sprite(haloMat);
      halo.scale.set(4.2, 4.2, 1);
      art.add(halo);

      // парящее двойное кольцо
      var ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(1.75, 0.014, 6, 96),
        new THREE.MeshBasicMaterial({ color: COLOR.gold, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ring1.rotation.set(1.25, 0.2, 0);
      var ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.01, 6, 96),
        new THREE.MeshBasicMaterial({ color: COLOR.bloodBright, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ring2.rotation.set(0.55, -0.7, 0.3);
      art.add(ring1, ring2);

      // пылинки вокруг
      var dustN = MOBILE ? 50 : 120;
      var dustPos = new Float32Array(dustN * 3);
      var dustCol = new Float32Array(dustN * 3);
      for (var i = 0; i < dustN; i++) {
        var r = 1.6 + Math.random() * 1.1;
        var th = Math.random() * Math.PI * 2;
        var ph = Math.acos(2 * Math.random() - 1);
        dustPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        dustPos[i * 3 + 1] = r * Math.cos(ph);
        dustPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
        var gold = Math.random() < 0.6;
        dustCol[i * 3] = gold ? 0.79 : 0.7;
        dustCol[i * 3 + 1] = gold ? 0.64 : 0.05;
        dustCol[i * 3 + 2] = gold ? 0.15 : 0.05;
      }
      var dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
      var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
        size: 0.035, vertexColors: true, transparent: true, opacity: 0.7,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
      }));
      art.add(dust);

      /* ---- размеры ---- */
      function fit() {
        var w = Math.max(1, wrap.clientWidth);
        var h = Math.max(1, wrap.clientHeight);
        var dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.25 : 1.75);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        U.uPixelRatio.value = dpr;
        camera.aspect = w / h;
        // сфера с кольцами (радиус ≈ 2.3) должна помещаться и в узком блоке
        var vf = (camera.fov * Math.PI) / 180;
        var hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
        camera.position.z = (2.5 * 1.1) / Math.sin(Math.min(vf, hf) / 2);
        camera.updateProjectionMatrix();
      }

      /* ---- энергия звука ---- */
      var E = { bass: 0, mid: 0, treble: 0, kick: 0, bassAvg: 0, lastBeat: 0 };

      function readAudio(dt, now) {
        var bass = 0;
        var mid = 0;
        var treble = 0;
        var haveSignal = false;

        if (A.analyser && A.ctx && A.ctx.state === 'running') {
          A.analyser.getByteFrequencyData(A.data);
          var binHz = (A.ctx.sampleRate / 2) / A.data.length;
          var bassEnd = Math.max(2, Math.round(160 / binHz));
          var midEnd = Math.max(bassEnd + 2, Math.round(2000 / binHz));
          var trebEnd = Math.min(A.data.length, Math.max(midEnd + 2, Math.round(8000 / binHz)));
          var sum = function (from, to) {
            var s = 0;
            for (var k = from; k < to; k++) s += A.data[k];
            return s / Math.max(1, to - from) / 255;
          };
          bass = sum(0, bassEnd);
          mid = sum(bassEnd, midEnd);
          treble = sum(midEnd, trebEnd);
          haveSignal = bass + mid + treble > 0.003;
        }

        // анализ дал «тишину» при играющем звуке (CORS, iOS) — переходим на ритм по BPM
        if (live && !A.simulate) {
          A.silentFrames = haveSignal ? 0 : A.silentFrames + 1;
          if (A.silentFrames > 90) A.simulate = true;
        }
        if (live && A.simulate && !haveSignal) {
          var phase = ((audio.currentTime || now / 1000) * bpm / 60) % 1;
          var thump = Math.exp(-phase * 5);
          bass = 0.15 + 0.6 * thump;
          mid = 0.22 + 0.08 * Math.sin(now / 420);
          treble = 0.14 + 0.05 * Math.sin(now / 170);
          haveSignal = true;
        }

        if (live && haveSignal) {
          // удар по басу
          if (bass > E.bassAvg * 1.25 && bass > 0.25 && now - E.lastBeat > 180) {
            E.kick = 1;
            E.lastBeat = now;
          }
          E.bassAvg += (bass - E.bassAvg) * 0.05;
        } else {
          // пауза: плавное «дыхание»
          var breath = 0.5 + 0.5 * Math.sin(now / 900);
          bass = 0.1 + 0.07 * breath;
          mid = 0.05 + 0.03 * breath;
          treble = 0.03;
          E.bassAvg += (0 - E.bassAvg) * 0.05;
        }

        var attack = 1 - Math.exp(-dt * 18);
        var release = 1 - Math.exp(-dt * 6);
        E.bass += (bass - E.bass) * (bass > E.bass ? attack : release);
        E.mid += (mid - E.mid) * (mid > E.mid ? attack : release);
        E.treble += (treble - E.treble) * (treble > E.treble ? attack : release);
        E.kick *= Math.exp(-dt * 6);
      }

      /* ---- кадр ---- */
      var tiltX = 0;
      var tiltY = 0;
      var tiltTX = 0;
      var tiltTY = 0;
      var time = 0;
      var running = false;
      var rafId = 0;
      var last = 0;
      var inView = true;
      var docVisible = !doc.hidden;
      var ctxLost = false;
      var minInterval = MOBILE ? 1000 / 30 - 2 : 0;

      function update(dt, now) {
        time += dt;
        readAudio(dt, now);

        var breath = 0.5 + 0.5 * Math.sin(time * 1.1);
        var pulse = live ? Math.max(E.kick * 0.9, E.bass * 0.8) : 0.18 + 0.2 * breath;

        U.uTime.value = time;
        U.uBass.value = E.bass * motion;
        U.uMid.value = E.mid * motion;
        U.uTreble.value = E.treble * motion;
        U.uPulse.value = pulse * motion;

        var spin = 0.18 + E.treble * 1.6 + (live ? E.kick * 0.5 : 0);
        sphere.rotation.y += dt * spin * motion;
        sphere.rotation.x = Math.sin(time * 0.4) * 0.15 * motion;

        var scaleCore = 1 + E.bass * 0.9 + E.kick * 0.35 + (live ? 0 : 0.08 * breath);
        core.scale.setScalar(scaleCore);
        coreMat.opacity = 0.14 + E.bass * 0.5 + E.kick * 0.2;
        haloMat.opacity = 0.22 + E.bass * 0.55 + E.kick * 0.2;
        halo.scale.setScalar(4.2 + E.bass * 1.6);

        ring1.rotation.z += dt * (0.3 + E.treble * 1.4) * motion;
        ring2.rotation.z -= dt * (0.22 + E.mid * 1.1) * motion;
        var rs = 1 + E.kick * 0.1;
        ring1.scale.setScalar(rs);
        ring2.scale.setScalar(1 + E.kick * 0.06);

        dust.rotation.y += dt * 0.05 * motion;

        art.position.y = Math.sin(time * 0.9) * 0.08 * motion; // парение
        var k = 1 - Math.exp(-dt * 4);
        tiltX += (tiltTX - tiltX) * k;
        tiltY += (tiltTY - tiltY) * k;
        art.rotation.x = tiltX;
        art.rotation.y = tiltY;
      }

      function frame(now) {
        if (!running) return;
        rafId = window.requestAnimationFrame(frame);
        var elapsed = now - last;
        if (elapsed < minInterval) return;
        last = now;
        update(Math.min(elapsed / 1000, 0.1), now);
        renderer.render(scene, camera);
      }

      function sync() {
        var should = inView && docVisible && !ctxLost;
        if (should && !running) {
          running = true;
          last = performance.now();
          rafId = window.requestAnimationFrame(frame);
        } else if (!should && running) {
          running = false;
          window.cancelAnimationFrame(rafId);
        }
      }

      // лёгкий наклон за курсором (только мышь)
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || !inView) return;
        var r = wrap.getBoundingClientRect();
        var nx = clamp(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -1.5, 1.5);
        var ny = clamp(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1, -1.5, 1.5);
        tiltTY = nx * 0.3 * motion;
        tiltTX = ny * 0.2 * motion;
      }, { passive: true });

      fit();
      if (typeof window.ResizeObserver === 'function') {
        new window.ResizeObserver(function () {
          fit();
          if (!running) { update(0, performance.now()); renderer.render(scene, camera); }
        }).observe(wrap);
      } else {
        window.addEventListener('resize', fit);
      }
      if (typeof window.IntersectionObserver === 'function') {
        new window.IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          sync();
        }, { threshold: 0 }).observe(wrap);
      }
      doc.addEventListener('visibilitychange', function () { docVisible = !doc.hidden; sync(); });
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); ctxLost = true; sync(); }, false);
      canvas.addEventListener('webglcontextrestored', function () { ctxLost = false; sync(); }, false);

      update(0, performance.now());
      renderer.render(scene, camera);
      sync();
    }).catch(function () {
      // без Three.js блок визуализатора просто убираем — страница остаётся прежней
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    });
  }

  /* ========================================================================
     ЗАПУСК
     ======================================================================== */
  var api = { version: '1.0.0' };
  if (window.__A3D_TEST__) {
    api.__test = {
      makeCoverCanvas: makeCoverCanvas, makeSpineCanvas: makeSpineCanvas, makeStripesCanvas: makeStripesCanvas,
      buildBook: buildBook, createViewer: createViewer
    };
  }
  window.GildspineArtifacts3D = api;

  onReady(function () {
    safe('book', initBookPage);
    safe('track', initTrackPage);
  });
})();
