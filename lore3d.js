/* ==========================================================================
   GILDSPINE — Stay Gold
   js/lore3d.js  ·  Интерактивные 3D-артефакты страницы Вселенной (lore.html)

   1. Многоярусная 3D-диорама мироздания вместо заглушки карты мира (#world-map):
      сквозная вертикальная ось — Золотой Стержень (нить частот) — и 8 зон:
        1 Верхний Мир · 2 Каменный Свод и Неоновые Кварталы · 3 Пустоши ·
        4 Город Астры · 5 Храм Ритма · 6 Бункер Они · 7 Ядро · 8 Цифровой мир Матрицы
      Вращение мышью / пальцем, подсветка выбранной локации, панель из 8 кнопок.
      Клик по локации (или кнопке) — камера плавно подлетает, открывается карточка
      с описанием на RU / EN.
   2. Компактный 3D-компас «Четыре Бездны» в блоке #abysses: 4 энергетических
      полюса в цветах Бездн из js/data.js. Клик по полюсу поворачивает компас
      нужной гранью, включает Бездну в блоке карточек и подсвечивает персонажей
      этой Бездны в галерее ниже. Работает и в обратную сторону — компас следует
      за выбором в карточках и чипах.

   ПОДКЛЮЧЕНИЕ (после js/data.js):
     <script src="js/lore3d.js" defer></script>

   • Three.js (r149) подгружается динамически с jsDelivr, если ещё не загружен.
   • WebGLRenderer: alpha + antialias: true; setPixelRatio(min(devicePixelRatio, 2)).
   • Рендер на паузе вне экрана и в фоновой вкладке; prefers-reduced-motion —
     без автоповорота. Если нет WebGL — остаётся прежняя заглушка карты.
   • Колесо мыши страницу не перехватывает: масштаб — Ctrl + колесо / щипок пальцами.
   ========================================================================== */

(function () {
  'use strict';

  if (window.GildspineLore3D) return;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';

  var doc = document;
  var html = doc.documentElement;

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
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function smoother(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
  function noop() {}

  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

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
    return (html.getAttribute('lang') || '').toLowerCase().slice(0, 2) === 'en' ? 'en' : 'ru';
  }

  function D() { return window.GildspineData || null; }

  function tr(field) {
    var d = D();
    if (d && typeof d.tr === 'function') return d.tr(field);
    if (typeof field === 'string') return field;
    return (field && (field[getLang()] || field.ru)) || '';
  }

  function safe(name, fn) {
    try {
      return fn();
    } catch (err) {
      if (window.console && console.warn) console.warn('[lore3d] ' + name + ':', err);
      return null;
    }
  }

  function buildProfile() {
    var mobile = isMobile();
    var conn = navigator.connection || {};
    var saver = !!conn.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2);
    return {
      mobile: mobile,
      fps: saver ? 30 : 60,
      rings: mobile ? 56 : 80,
      segs: mobile ? 128 : 192,
      towers: mobile ? 52 : 78,
      ruins: mobile ? 16 : 28,
      coreN: mobile ? 1800 : 3200,
      shards: mobile ? 12 : 16,
      cables: mobile ? 30 : 46,
      dust: mobile ? 70 : 140,
      fireflies: mobile ? 30 : 50
    };
  }

  /* ------------------------------------------------------------------------
     ТЕКСТЫ (RU / EN)
     ------------------------------------------------------------------------ */
  var STR = {
    ru: {
      hint: 'Тяните, чтобы вращать · Ctrl + колесо / щипок — масштаб · нажмите на локацию',
      overview: 'Обзор',
      zones: 'Локации мироздания',
      residents: 'Обитатели',
      close: 'К обзору',
      mapAria: 'Интерактивная 3D-карта мироздания GILDSPINE. Стрелки — вращение, цифры 1–8 — выбор локации',
      overviewTitle: 'Мироздание GILDSPINE',
      compassTitle: 'Компас Четырёх Бездн',
      compassHint: 'Нажмите на полюс или на название Бездны',
      compassAria: '3D-компас Четырёх Бездн. Нажмите на полюс, чтобы выбрать Бездну',
      selected: 'Выбрана',
      toGallery: 'К галерее персонажей',
      all: 'Все Бездны',
      none: 'Бездна не выбрана'
    },
    en: {
      hint: 'Drag to rotate · Ctrl + wheel / pinch to zoom · tap a location',
      overview: 'Overview',
      zones: 'Locations of the world',
      residents: 'Residents',
      close: 'Back to overview',
      mapAria: 'Interactive 3D map of the GILDSPINE universe. Arrow keys rotate, digits 1–8 pick a location',
      overviewTitle: 'The GILDSPINE Universe',
      compassTitle: 'Compass of the Four Abysses',
      compassHint: 'Tap a pole or an Abyss name',
      compassAria: '3D compass of the Four Abysses. Tap a pole to choose an Abyss',
      selected: 'Selected',
      toGallery: 'Go to the character gallery',
      all: 'All Abysses',
      none: 'No Abyss selected'
    }
  };

  function S(key) {
    var pack = STR[getLang()] || STR.ru;
    return pack[key] !== undefined ? pack[key] : key;
  }

  var OVERVIEW = {
    ru: [
      'Золотой Стержень — вертикальная нить частот — пронизывает все ярусы: от Верхнего Мира над Расколом через Каменный Свод и Пустоши до Ядра в сердце мира. Снаружи всё охвачено цифровой сферой Матрицы.',
      'Выберите локацию на карте или на панели ниже — камера подлетит к ней.'
    ],
    en: [
      'The Golden Rod — a vertical thread of frequencies — runs through every tier: from the Upper World above the Rift, through the Stone Vault and the Wastelands, down to the Core at the heart of the world. The digital sphere of the Matrix encloses it all.',
      'Pick a location on the map or on the panel below — the camera will fly to it.'
    ]
  };

  var ZONES = [
    {
      id: 'upper', color: '#f3e7bf',
      title: { ru: 'Верхний Мир', en: 'The Upper World' },
      tier: { ru: 'Ярус I · над Расколом', en: 'Tier I · Above the Rift' },
      who: null,
      text: {
        ru: [
          'Самый верхний ярус мироздания — над Расколом. Здесь парят золотисто-белые осколки архитектуры и руины идеального мира, окутанные холодным рассеянным светом.',
          'Это мир таким, каким он был до Раскола: ни гула Нижнего мира, ни его огней — только тишина, золото и застывший свет.'
        ],
        en: [
          'The highest tier of creation, above the Rift. Golden-white shards of architecture and the ruins of a perfect world float here, wrapped in cold, diffused light.',
          'This is the world as it was before the Rift: no hum of the Lower World, none of its lights — only silence, gold and frozen light.'
        ]
      }
    },
    {
      id: 'neon', color: '#7b2cbf',
      title: { ru: 'Каменный Свод и Неоновые Кварталы', en: 'The Stone Vault & the Neon Quarters' },
      tier: { ru: 'Ярус II · центр Нижнего Мира', en: 'Tier II · Centre of the Lower World' },
      who: { ru: ['Синт'], en: ['Synth'] },
      text: {
        ru: [
          'Над центром Нижнего мира нависает Каменный Свод — тёмный массивный потолок, с которого вниз тянутся светящиеся провода и кабели.',
          'Прямо под ним лежат Неоновые Кварталы: плотный хаотичный кластер кривых башен, многоуровневых трущоб, голографических вывесок и антенн в фиолетово-малиновом и кислотном свечении. Перенаселённый, душный и громкий техногенный муравейник, где нет настоящего неба.'
        ],
        en: [
          'Above the centre of the Lower World looms the Stone Vault — a dark, massive ceiling from which glowing wires and cables hang down.',
          'Right beneath it lie the Neon Quarters: a dense, chaotic cluster of crooked towers, multi-level slums, holographic signs and antennas in violet-magenta and acid light. An overcrowded, stifling, loud techno anthill with no real sky.'
        ]
      }
    },
    {
      id: 'wastes', color: '#8b0000',
      title: { ru: 'Пустоши', en: 'The Wastelands' },
      tier: { ru: 'Ярус II · ландшафт Нижнего Мира', en: 'Tier II · Landscape of the Lower World' },
      who: null,
      text: {
        ru: [
          'Бескрайний волнистый ландшафт Нижнего мира вокруг Кварталов: пустыня из смеси чёрного и золотого песка, усыпанная древними развалинами, под багрово-красным туманным небом.',
          'Опасная безжизненная зона с редкими ресурсами и жёсткими условиями — именно в её складках прячутся Город Астры, Храм Ритма и Бункер Они.'
        ],
        en: [
          'The boundless, rolling landscape of the Lower World around the Quarters: a desert of black and golden sand strewn with ancient ruins beneath a crimson, misty sky.',
          'A dangerous, lifeless zone with scarce resources and harsh conditions — and in its folds hide the City of Astra, the Temple of Rhythm and Oni’s Bunker.'
        ]
      }
    },
    {
      id: 'astra', color: '#2ecc71',
      title: { ru: 'Город Астры', en: 'The City of Astra' },
      tier: { ru: 'Ярус II · тихая долина Пустошей', en: 'Tier II · A quiet valley of the Wastelands' },
      who: { ru: ['Астра', 'Элис'], en: ['Astra', 'Elis'] },
      text: {
        ru: [
          'Древний полуразрушенный город, скрытый среди скал и холмов в тихой долине Пустошей. Руины оплетены светящимся изумрудным мхом и корнями с мягким золотисто-зелёным свечением.',
          'Загадочное, тихое и мудрое место силы, где природа слилась с руинами.'
        ],
        en: [
          'An ancient, half-ruined city hidden among cliffs and hills in a quiet valley of the Wastelands. The ruins are entwined with glowing emerald moss and roots shining a soft golden-green.',
          'A mysterious, quiet and wise place of power, where nature has merged with the ruins.'
        ]
      }
    },
    {
      id: 'temple', color: '#ff1e1e',
      title: { ru: 'Храм Ритма', en: 'The Temple of Rhythm' },
      tier: { ru: 'Ярус II · окраина Пустошей', en: 'Tier II · Edge of the Wastelands' },
      who: { ru: ['Вектор'], en: ['Vector'] },
      text: {
        ru: [
          'Агрессивная остроконечная готическая конструкция из тёмного металла и шипов на окраине Пустошей. Её окружают пульсирующие алые звуковые волны, бьющие в такт басу.',
          'Индустриальное логово музыки, вибраций и энергии.'
        ],
        en: [
          'An aggressive, spiked gothic structure of dark metal and thorns on the edge of the Wastelands. Pulsing crimson sound waves surround it, striking in time with the bass.',
          'An industrial lair of music, vibration and energy.'
        ]
      }
    },
    {
      id: 'bunker', color: '#f39c12',
      title: { ru: 'Бункер Они', en: 'Oni’s Bunker' },
      tier: { ru: 'Ярус II · скалистая расщелина Пустошей', en: 'Tier II · A rocky crevice of the Wastelands' },
      who: { ru: ['Они'], en: ['Oni'] },
      text: {
        ru: [
          'Бронированный металлический вход, скрытый в глубине скалистой расщелины Пустошей. Тёплый янтарный маяк и антенны выдают убежище лишь тем, кто знает, куда смотреть.',
          'Изолированное, надёжное убежище, хранящее технологии и тайны прошлого.'
        ],
        en: [
          'An armoured metal entrance hidden deep in a rocky crevice of the Wastelands. A warm amber beacon and antennas give the shelter away only to those who know where to look.',
          'An isolated, secure refuge that keeps the technologies and secrets of the past.'
        ]
      }
    },
    {
      id: 'core', color: '#ffd700',
      title: { ru: 'Ядро', en: 'The Core' },
      tier: { ru: 'Ярус III · сердце мира', en: 'Tier III · Heart of the world' },
      who: { ru: ['Тень', 'Эхо — здесь она родилась'], en: ['Shadow', 'Echo — born here'] },
      text: {
        ru: [
          'Самый нижний, глубинный уровень в сердце мира. Под слоем Пустошей, в самом центре воронки, вращается гигантская затягивающая спираль из слепящего чистого золота и энергетических потоков.',
          'Источник всей энергии и частот вселенной. Обитель Тени и место, где родилась Эхо.'
        ],
        en: [
          'The lowest, deepest level, at the heart of the world. Beneath the layer of the Wastelands, in the very centre of the funnel, a gigantic, all-consuming spiral of blinding pure gold and streams of energy turns.',
          'The source of all energy and frequencies in the universe. The dwelling of Shadow and the place where Echo was born.'
        ]
      }
    },
    {
      id: 'matrix', color: '#38bdf8',
      title: { ru: 'Цифровой мир Матрицы', en: 'The Digital World of the Matrix' },
      tier: { ru: 'Внешнее параллельное измерение', en: 'The outer parallel dimension' },
      who: null,
      text: {
        ru: [
          'Внешнее параллельное измерение за пределами физической карты. Огромная полупрозрачная голографическая сфера из тонких сине-белых линий кода и геометрических узлов окружает всю сцену.',
          'Холодное, стерильное пространство за гранью материального мира.'
        ],
        en: [
          'The outer parallel dimension beyond the physical map. A huge translucent holographic sphere of thin blue-white lines of code and geometric nodes surrounds the entire scene.',
          'A cold, sterile space beyond the edge of the material world.'
        ]
      }
    }
  ];

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
      threePromise = null;
      throw err;
    });

    return threePromise;
  }

  /* ------------------------------------------------------------------------
     СТИЛИ
     ------------------------------------------------------------------------ */
  var CSS = [
    /* --- карта --- */
    '.l3d-map{display:flex;flex-direction:column;gap:.9rem;min-width:0}',
    '.l3d-stage{position:relative;overflow:hidden;height:clamp(380px,118vw,540px);',
    'background:radial-gradient(70% 55% at 50% 100%,rgba(139,0,0,.3),transparent 70%),#07060b;',
    'border:1px solid rgba(201,162,39,.5);border-radius:3px;box-shadow:0 0 28px rgba(201,162,39,.12);',
    'touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}',
    '@media (min-width:640px){.l3d-stage{height:clamp(440px,56vw,560px)}}',
    '.l3d-stage.is-grabbing{cursor:grabbing}',
    '.l3d-stage.is-hover{cursor:pointer}',
    '.l3d-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none}',
    '.l3d-stage canvas:focus-visible{outline:2px solid #e6c457;outline-offset:-3px}',
    '.l3d-hint{position:absolute;left:50%;top:.7rem;transform:translateX(-50%);max-width:calc(100% - 1.4rem);',
    "font:500 .66rem/1.4 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.06em;text-align:center;color:rgba(230,196,87,.95);",
    'background:rgba(10,10,15,.72);border:1px solid rgba(201,162,39,.35);padding:.4rem .7rem;border-radius:2px;',
    'pointer-events:none;transition:opacity .6s}',
    '.l3d-hint.is-hidden{opacity:0}',
    '.l3d-tip{position:absolute;z-index:3;pointer-events:none;padding:.3rem .6rem;white-space:nowrap;',
    "font:500 .7rem/1.3 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.04em;color:#0a0a0f;background:#c9a227;",
    'border-radius:2px;opacity:0;transition:opacity .15s;transform:translate(12px,12px)}',
    '.l3d-tip.is-visible{opacity:1}',
    '.l3d-loading{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;',
    "font:500 .72rem/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.1em;color:rgba(201,162,39,.8)}",

    /* карточка локации: на широких экранах поверх сцены, на узких — под ней */
    '.l3d-card{position:relative;padding:1.1rem 1.2rem 1.15rem;background:linear-gradient(180deg,rgba(24,24,36,.96),rgba(13,13,20,.98));',
    'border:1px solid var(--zone,rgba(201,162,39,.5));border-radius:3px;box-shadow:0 0 22px rgba(0,0,0,.5),0 0 18px var(--zone-glow,rgba(201,162,39,.12))}',
    '@media (min-width:900px){.l3d-card{position:absolute;left:.8rem;bottom:.8rem;z-index:2;width:min(390px,calc(100% - 1.6rem));',
    'max-height:calc(100% - 3.4rem);overflow:auto;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}}',
    '.l3d-card__tier{margin:0 0 .35rem;font:500 .68rem/1.4 \'JetBrains Mono\',ui-monospace,monospace;letter-spacing:.06em;color:var(--zone,#c9a227)}',
    ".l3d-card__title{margin:0 0 .6rem;font-family:'Cinzel','Cormorant SC',Georgia,serif;font-size:1.05rem;font-weight:700;",
    'letter-spacing:.1em;text-transform:uppercase;line-height:1.3;color:#e9e6df;overflow-wrap:anywhere;padding-right:2rem}',
    '.l3d-card__text{margin:0 0 .6rem;font-size:.86rem;line-height:1.65;color:#a09eae}',
    '.l3d-card__who{margin:.2rem 0 0;font:500 .72rem/1.5 \'JetBrains Mono\',ui-monospace,monospace;letter-spacing:.03em;color:#e6c457}',
    '.l3d-card__who b{color:#a09eae;font-weight:500}',
    '.l3d-card__close{position:absolute;top:.5rem;right:.5rem;display:grid;place-items:center;width:32px;height:32px;padding:0;',
    'font-size:1.15rem;line-height:1;color:#c9a227;background:transparent;border:1px solid rgba(201,162,39,.35);',
    'border-radius:2px;cursor:pointer}',
    '.l3d-card__close:hover{color:#e6c457;border-color:#c9a227}',
    '.l3d-card__close:focus-visible{outline:2px solid #e6c457;outline-offset:2px}',

    /* панель кнопок */
    '.l3d-zones{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem}',
    '@media (min-width:640px){.l3d-zones{grid-template-columns:repeat(3,1fr)}}',
    '@media (min-width:1200px){.l3d-zones{grid-template-columns:repeat(4,1fr)}}',
    '.l3d-zone{display:flex;align-items:center;gap:.55rem;min-height:44px;padding:.4rem .65rem;text-align:left;',
    "font:500 .72rem/1.25 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.02em;color:#a09eae;background:rgba(18,18,26,.9);",
    'border:1px solid rgba(201,162,39,.22);border-radius:2px;cursor:pointer;transition:color .2s,border-color .2s,box-shadow .3s,background-color .2s}',
    '.l3d-zone:hover{color:#e6c457;border-color:rgba(201,162,39,.6)}',
    '.l3d-zone:focus-visible{outline:2px solid #e6c457;outline-offset:2px}',
    '.l3d-zone[aria-pressed="true"]{color:#e9e6df;border-color:var(--zone);background:rgba(201,162,39,.08);box-shadow:0 0 16px var(--zone-glow)}',
    '.l3d-zone__dot{flex:0 0 10px;width:10px;height:10px;border-radius:50%;background:var(--zone);box-shadow:0 0 8px var(--zone)}',
    '.l3d-zone__num{flex:0 0 auto;color:#706e7e}',
    '.l3d-zone[aria-pressed="true"] .l3d-zone__num{color:var(--zone)}',

    /* --- компас --- */
    '.l3d-compass{display:flex;flex-direction:column;align-items:center;gap:.7rem;margin:0 auto 2rem;max-width:420px}',
    '.l3d-compass__title{margin:0;font:500 .72rem/1.4 \'JetBrains Mono\',ui-monospace,monospace;letter-spacing:.1em;color:#c9a227;text-align:center}',
    '.l3d-compass__stage{position:relative;width:min(100%,300px);height:240px;touch-action:none;cursor:grab;',
    'background:radial-gradient(60% 60% at 50% 50%,rgba(201,162,39,.1),transparent 70%);user-select:none;-webkit-user-select:none}',
    '.l3d-compass__stage.is-grabbing{cursor:grabbing}',
    '.l3d-compass__stage.is-hover{cursor:pointer}',
    '.l3d-compass__stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none}',
    '.l3d-compass__stage canvas:focus-visible{outline:2px solid #e6c457;outline-offset:2px}',
    '.l3d-compass__btns{display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem}',
    '.l3d-compass__sub{margin:0;min-height:1.3em;font:500 .72rem/1.5 \'JetBrains Mono\',ui-monospace,monospace;color:#a09eae;text-align:center}',
    '.l3d-compass__sub a{color:#e6c457;border-bottom:1px dashed rgba(201,162,39,.6)}',

    /* подсветка персонажей выбранной Бездны в галерее */
    '.char-card.l3d-hl{box-shadow:0 0 0 1px var(--abyss,#c9a227),0 0 30px var(--abyss-glow,rgba(201,162,39,.4));',
    'animation:l3d-pop .7s cubic-bezier(.22,.61,.36,1) both}',
    '@keyframes l3d-pop{from{transform:translateY(10px) scale(.97);opacity:.4}to{transform:none;opacity:1}}',
    '@media print{.l3d-map,.l3d-compass{display:none!important}}'
  ].join('');

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var style = doc.createElement('style');
    style.id = 'l3d-style';
    style.textContent = CSS;
    (doc.head || html).appendChild(style);
  }

  /* ========================================================================
     ПРОЦЕДУРНЫЕ ТЕКСТУРЫ
     ======================================================================== */
  function glowTexture(THREE, rgb, size) {
    var s = size || 256;
    var c = doc.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(' + rgb + ',0.95)');
    gr.addColorStop(0.35, 'rgba(' + rgb + ',0.32)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }

  function skyTexture(THREE) {
    var c = doc.createElement('canvas');
    c.width = 4;
    c.height = 256;
    var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#06050c');
    gr.addColorStop(0.3, '#0d0610');
    gr.addColorStop(0.44, '#3a0709');
    gr.addColorStop(0.5, '#6e0c0e');
    gr.addColorStop(0.56, '#2a0508');
    gr.addColorStop(0.75, '#08040a');
    gr.addColorStop(1, '#030206');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  }

  function windowsTexture(THREE, rnd) {
    var c = doc.createElement('canvas');
    c.width = 128;
    c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#0c0812';
    g.fillRect(0, 0, 128, 256);
    for (var y = 6; y < 250; y += 14) {
      for (var x = 8; x < 120; x += 16) {
        if (rnd() < 0.55) {
          g.fillStyle = rnd() < 0.2 ? '#ffffff' : 'rgba(255,255,255,' + (0.45 + rnd() * 0.5).toFixed(2) + ')';
          g.fillRect(x, y, 9, 7);
        }
      }
    }
    // горизонтальные неоновые полосы этажей
    for (var b = 0; b < 5; b++) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(0, 20 + b * 48 + rnd() * 10, 128, 2);
    }
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function signTexture(THREE, rnd, text) {
    var c = doc.createElement('canvas');
    c.width = 256;
    c.height = 96;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 256, 96);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 4;
    g.strokeRect(6, 6, 244, 84);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.font = "700 44px 'JetBrains Mono',ui-monospace,monospace";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 50);
    for (var i = 0; i < 6; i++) g.fillRect(14 + rnd() * 220, 80 + rnd() * 4, 12 + rnd() * 30, 2);
    return new THREE.CanvasTexture(c);
  }

  /* ========================================================================
     РЕЛЬЕФ ПУСТОШЕЙ
     ======================================================================== */
  var TERRAIN_R = 11.6;
  var A_POS = { x: -6.2, z: -4.4 };   // Город Астры (долина)
  var T_POS = { x: -0.84, z: 9.56 };  // Храм Ритма (холм)
  var B_ANGLE = 335 * Math.PI / 180;  // Бункер Они (расщелина)
  var B_UX = Math.cos(B_ANGLE);
  var B_UZ = Math.sin(B_ANGLE);

  function gauss(dx, dz, s) { return Math.exp(-(dx * dx + dz * dz) / (2 * s * s)); }

  function canyon(x, z) {
    var along = x * B_UX + z * B_UZ;
    var perp = -x * B_UZ + z * B_UX;
    var m = smooth(6.4, 7.6, along) * (1 - smooth(11.0, 12.0, along));
    return m * (-1.5 * Math.exp(-perp * perp / 0.5) + 0.55 * Math.exp(-Math.pow(Math.abs(perp) - 1.1, 2) / 0.18));
  }

  function heightAt(x, z) {
    var r = Math.sqrt(x * x + z * z);
    var dunes = 0.34 * Math.sin(x * 0.5 + 1.3) * Math.cos(z * 0.42) +
      0.22 * Math.sin(x * 0.95 + z * 0.7) + 0.1 * Math.sin(x * 1.9 - z * 1.5 + 2.0);
    var h = dunes * smooth(2.6, 4.2, r);
    h -= 1.15 * gauss(x - A_POS.x, z - A_POS.z, 1.9);
    h += 1.0 * gauss(x - T_POS.x, z - T_POS.z, 1.5);
    h += canyon(x, z);
    h -= 2.5 * smooth(10.2, 11.6, r);
    return h;
  }

  function sandMix(x, z) {
    var n = 0.5 + 0.5 * Math.sin(x * 1.1 + Math.sin(z * 0.7) * 1.6) * Math.cos(z * 0.9 + Math.sin(x * 0.6) * 1.4);
    n = n * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin((x + z) * 2.3));
    return smooth(0.35, 0.75, n);
  }

  function buildTerrain(THREE, P) {
    var rings = P.rings;
    var segs = P.segs;
    var pos = [];
    var col = [];
    var idx = [];
    var BLACK = [0.045, 0.04, 0.05];
    var SAND = [0.5, 0.39, 0.11];
    var i, j;

    for (i = 0; i <= rings; i++) {
      var r = (i / rings) * TERRAIN_R;
      for (j = 0; j <= segs; j++) {
        var a = (j / segs) * Math.PI * 2;
        var x = Math.cos(a) * r;
        var z = Math.sin(a) * r;
        pos.push(x, heightAt(x, z), z);

        var m = sandMix(x, z);
        var cr = lerp(BLACK[0], SAND[0], m);
        var cg = lerp(BLACK[1], SAND[1], m);
        var cb = lerp(BLACK[2], SAND[2], m);
        var gA = gauss(x - A_POS.x, z - A_POS.z, 2.3);          // долина Астры — зеленоватая
        cr = lerp(cr, 0.07, gA * 0.8); cg = lerp(cg, 0.22, gA * 0.8); cb = lerp(cb, 0.11, gA * 0.8);
        var gT = gauss(x - T_POS.x, z - T_POS.z, 1.8);          // холм храма — багровый, закопчённый
        cr = lerp(cr, 0.2, gT * 0.7); cg = lerp(cg, 0.02, gT * 0.7); cb = lerp(cb, 0.03, gT * 0.7);
        var cn = Math.min(1, Math.abs(canyon(x, z)) * 0.9);     // расщелина — тёмная порода
        cr = lerp(cr, 0.06, cn); cg = lerp(cg, 0.05, cn); cb = lerp(cb, 0.06, cn);
        col.push(cr, cg, cb);
      }
    }
    var row = segs + 1;
    for (i = 0; i < rings; i++) {
      for (j = 0; j < segs; j++) {
        var a0 = i * row + j;
        var b0 = a0 + 1;
        var c0 = a0 + row;
        var d0 = c0 + 1;
        idx.push(a0, b0, c0, b0, d0, c0);
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.userData.zone = 'wastes';
    return mesh;
  }

  /* ========================================================================
     ЗОНЫ ДИОРАМЫ
     Каждый построитель возвращает { group, update(t, dt, selected), hits: [Mesh] }
     ======================================================================== */
  function hitSphere(THREE, zone, x, y, z, r) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial());
    m.position.set(x, y, z);
    m.visible = false;
    m.userData.zone = zone;
    return m;
  }

  /* ---------- 1. Верхний Мир ---------- */
  function buildUpper(THREE, P, rnd) {
    var g = new THREE.Group();
    g.position.set(0, 8.6, 0);

    var mat = new THREE.MeshStandardMaterial({
      color: 0xf3e7bf, emissive: 0xc9a227, emissiveIntensity: 0.5, metalness: 0.45, roughness: 0.4,
      flatShading: true, fog: false
    });
    var geos = [
      new THREE.OctahedronGeometry(1, 0),
      new THREE.BoxGeometry(1, 0.18, 0.7),
      new THREE.CylinderGeometry(0.22, 0.26, 1, 8),
      new THREE.TorusGeometry(1, 0.14, 10, 24, Math.PI),
      new THREE.TetrahedronGeometry(1, 0)
    ];

    var shards = [];
    var i;
    for (i = 0; i < P.shards; i++) {
      var mesh = new THREE.Mesh(geos[i % geos.length], mat);
      var a = rnd() * Math.PI * 2;
      var rad = 0.8 + rnd() * 2.6;
      var s = 0.25 + rnd() * 0.65;
      mesh.position.set(Math.cos(a) * rad, (rnd() - 0.5) * 3.2, Math.sin(a) * rad);
      mesh.scale.set(s * (0.6 + rnd() * 0.8), s * (0.8 + rnd()), s * (0.6 + rnd() * 0.8));
      mesh.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      mesh.userData.fx = { y0: mesh.position.y, ph: rnd() * 6.28, sp: 0.12 + rnd() * 0.25, rs: (rnd() - 0.5) * 0.3 };
      g.add(mesh);
      shards.push(mesh);
    }

    // колоннада идеального мира: сломанные колонны по кругу и обломок плиты
    var colGeo = new THREE.CylinderGeometry(0.12, 0.14, 1, 10);
    for (i = 0; i < 8; i++) {
      var ang = (i / 8) * Math.PI * 2;
      var col = new THREE.Mesh(colGeo, mat);
      var h = 0.6 + rnd() * 0.9;
      col.scale.y = h;
      col.position.set(Math.cos(ang) * 1.5, -0.7 + h / 2 - 0.5, Math.sin(ang) * 1.5);
      col.rotation.z = (rnd() - 0.5) * 0.18;
      g.add(col);
    }
    var floor = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.5, 0.14, 40, 1, false, 0.4, 4.4), mat);
    floor.position.y = -1.2;
    g.add(floor);

    var auraTex = glowTexture(THREE, '243,231,191', 256);
    var aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: auraTex, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    }));
    aura.scale.set(8, 8, 1);
    g.add(aura);

    var light = new THREE.PointLight(0xbfd9ff, 1.1, 11);
    light.position.set(0, 1, 0);
    g.add(light);

    // пылинки света
    var dPos = new Float32Array(60 * 3);
    for (i = 0; i < 60; i++) {
      dPos[i * 3] = (rnd() - 0.5) * 7;
      dPos[i * 3 + 1] = (rnd() - 0.5) * 4;
      dPos[i * 3 + 2] = (rnd() - 0.5) * 7;
    }
    var dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    var dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
      size: 0.07, color: 0xfff3cf, transparent: true, opacity: 0.8, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    }));
    g.add(dust);

    // Раскол: зазубренное кольцо тёмной энергии между мирами
    var rift = new THREE.Group();
    rift.position.y = 5.7;
    var rp = [];
    for (i = 0; i < 90; i++) {
      var ra = (i / 90) * Math.PI * 2;
      var rr = 4.2 + (rnd() - 0.5) * 1.3 + Math.sin(ra * 5) * 0.4;
      rp.push(new THREE.Vector3(Math.cos(ra) * rr, (rnd() - 0.5) * 0.35, Math.sin(ra) * rr));
    }
    var riftLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(rp),
      new THREE.LineBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    rift.add(riftLine);

    var hit = hitSphere(THREE, 'upper', 0, 8.6, 0, 3.8);

    function update(t, dt, sel) {
      for (var k = 0; k < shards.length; k++) {
        var m = shards[k];
        var f = m.userData.fx;
        m.position.y = f.y0 + Math.sin(t * f.sp * 3 + f.ph) * 0.18;
        m.rotation.y += dt * f.rs;
      }
      dust.rotation.y += dt * 0.03;
      mat.emissiveIntensity = (sel ? 0.85 : 0.5) + Math.sin(t * 1.3) * 0.08;
      riftLine.material.opacity = 0.35 + 0.25 * Math.sin(t * 3.1) * Math.sin(t * 1.7);
    }

    return { group: g, extra: [rift], update: update, hits: [hit] };
  }

  /* ---------- 2. Каменный Свод и Неоновые Кварталы ---------- */
  function buildNeon(THREE, P, rnd) {
    var g = new THREE.Group();
    var i;

    /* башни: один InstancedMesh с окнами и цветом на каждый экземпляр */
    var winTex = windowsTexture(THREE, rnd);
    var boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);
    var towerMat = new THREE.MeshBasicMaterial({ map: winTex });
    var towers = new THREE.InstancedMesh(boxGeo, towerMat, P.towers);
    var palette = [0x7b2cbf, 0xff2bd6, 0xb6ff00, 0x1ee6ff, 0xa04cff, 0xff4d9a];
    var dummy = new THREE.Object3D();
    var color = new THREE.Color();
    var tops = [];

    for (i = 0; i < P.towers; i++) {
      var a = rnd() * Math.PI * 2;
      var rad = Math.pow(rnd(), 0.75) * 2.5;
      var slum = rnd() < 0.24;
      var w = slum ? 0.9 + rnd() * 0.5 : 0.26 + rnd() * 0.3;
      var d = slum ? 0.55 + rnd() * 0.4 : 0.26 + rnd() * 0.3;
      var h = slum ? 0.07 + rnd() * 0.06 : 0.5 + (1 - rad / 2.7) * 1.9 * rnd() + rnd() * 0.7;
      var y = slum ? 0.45 + rnd() * 1.4 : 0;
      dummy.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      dummy.rotation.set((rnd() - 0.5) * 0.18, rnd() * 3, (rnd() - 0.5) * 0.2);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);
      color.setHex(palette[Math.floor(rnd() * palette.length)]);
      towers.setColorAt(i, color);
      if (!slum && h > 1.2) tops.push({ x: dummy.position.x, y: h, z: dummy.position.z });
    }
    towers.instanceMatrix.needsUpdate = true;
    if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
    g.add(towers);

    /* голографические вывески */
    var words = ['NEON', 'ΣΥΝΤ', '0xFF', 'ВХОД', '▓▓▓▓', 'LIVE'];
    var signMats = [];
    var signs = [];
    var signColors = [0xff2bd6, 0x1ee6ff, 0xb6ff00, 0xa04cff];
    for (i = 0; i < 4; i++) {
      signMats.push(new THREE.MeshBasicMaterial({
        map: signTexture(THREE, rnd, words[i]), color: signColors[i], transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }));
    }
    var signGeo = new THREE.PlaneGeometry(0.9, 0.34);
    for (i = 0; i < 10; i++) {
      var sg = new THREE.Mesh(signGeo, signMats[i % 4]);
      var sa = rnd() * Math.PI * 2;
      var sr = 0.6 + rnd() * 1.8;
      sg.position.set(Math.cos(sa) * sr, 0.7 + rnd() * 1.7, Math.sin(sa) * sr);
      sg.rotation.y = rnd() * Math.PI;
      sg.scale.setScalar(0.7 + rnd() * 0.7);
      g.add(sg);
      signs.push(sg);
    }

    /* антенны + красные огоньки */
    var antN = Math.min(tops.length, 16);
    var antGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
    antGeo.translate(0, 0.5, 0);
    var antMat = new THREE.MeshBasicMaterial({ color: 0x9a8fb0 });
    var tipPos = new Float32Array(antN * 3);
    for (i = 0; i < antN; i++) {
      var tp = tops[i];
      var ah = 0.35 + rnd() * 0.6;
      var ant = new THREE.Mesh(antGeo, antMat);
      ant.position.set(tp.x, tp.y, tp.z);
      ant.scale.y = ah;
      g.add(ant);
      tipPos[i * 3] = tp.x;
      tipPos[i * 3 + 1] = tp.y + ah;
      tipPos[i * 3 + 2] = tp.z;
    }
    var tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute('position', new THREE.BufferAttribute(tipPos, 3));
    var tipMat = new THREE.PointsMaterial({
      size: 0.1, color: 0xff3030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    g.add(new THREE.Points(tipGeo, tipMat));

    /* Каменный Свод: массивный потолок Нижнего мира */
    var vaultGeo = new THREE.CylinderGeometry(5.4, 4.6, 1.1, 64, 6, false);
    var vp = vaultGeo.attributes.position;
    for (i = 0; i < vp.count; i++) {
      var vx = vp.getX(i);
      var vy = vp.getY(i);
      var vz = vp.getZ(i);
      if (vy < 0) {
        var vr = Math.sqrt(vx * vx + vz * vz);
        var bulge = 0.9 * Math.max(0, 1 - Math.pow(vr / 5.2, 2));
        var rock = (Math.sin(vx * 2.1 + vz * 1.3) + Math.sin(vz * 2.7 - vx * 0.9)) * 0.14;
        vp.setY(i, vy - bulge - rock);
      }
    }
    vaultGeo.computeVertexNormals();
    var vault = new THREE.Mesh(vaultGeo, new THREE.MeshLambertMaterial({ color: 0x1a1620, flatShading: true }));
    vault.position.y = 4.0;
    g.add(vault);

    /* провода и кабели с Свода к башням */
    var cPos = [];
    var cCol = [];
    var cA = new THREE.Color(0x7b2cbf);
    var cB = new THREE.Color(0xff2bd6);
    var tmp = new THREE.Color();
    for (i = 0; i < P.cables; i++) {
      var ca = rnd() * Math.PI * 2;
      var cr = Math.pow(rnd(), 0.6) * 3.1;
      var sx = Math.cos(ca) * cr;
      var sz = Math.sin(ca) * cr;
      var sy = 4.0 - 0.9 * Math.max(0, 1 - Math.pow(cr / 5.2, 2)) - 0.3;
      var target = tops.length ? tops[i % tops.length] : { x: 0, y: 1.5, z: 0 };
      var ex = target.x + (rnd() - 0.5) * 0.6;
      var ez = target.z + (rnd() - 0.5) * 0.6;
      var ey = target.y + 0.3 + rnd() * 0.5;
      var steps = 8;
      var sag = 0.25 + rnd() * 0.4;
      tmp.copy(cA).lerp(cB, rnd());
      for (var k = 0; k < steps; k++) {
        var t0 = k / steps;
        var t1 = (k + 1) / steps;
        cPos.push(
          lerp(sx, ex, t0), lerp(sy, ey, t0) - Math.sin(Math.PI * t0) * sag, lerp(sz, ez, t0),
          lerp(sx, ex, t1), lerp(sy, ey, t1) - Math.sin(Math.PI * t1) * sag, lerp(sz, ez, t1)
        );
        cCol.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
      }
    }
    var cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cPos), 3));
    cGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cCol), 3));
    var cableMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    g.add(new THREE.LineSegments(cGeo, cableMat));

    var light = new THREE.PointLight(0x9b4dff, 1.5, 10);
    light.position.set(0, 2.2, 0);
    g.add(light);

    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(THREE, '160,76,255', 256), transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    }));
    glow.scale.set(7, 5, 1);
    glow.position.y = 1.4;
    g.add(glow);

    var hit = hitSphere(THREE, 'neon', 0, 2.2, 0, 4.2);

    function update(t, dt, sel) {
      // мерцание вывесок и антенн
      for (var k = 0; k < signs.length; k++) {
        signs[k].material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * (1.3 + k * 0.37) + k));
      }
      tipMat.opacity = 0.45 + 0.55 * (Math.sin(t * 3.2) > 0.2 ? 1 : 0.15);
      cableMat.opacity = 0.7 + 0.2 * Math.sin(t * 2.1);
      light.intensity = (sel ? 2.2 : 1.5) + Math.sin(t * 7.3) * 0.12 * Math.sin(t * 1.1);
      glow.material.opacity = sel ? 0.6 : 0.4;
    }

    return { group: g, update: update, hits: [hit] };
  }

  /* ---------- 3. Пустоши: развалины, песчаная пыль, багровая дымка ---------- */
  function buildWastes(THREE, P, rnd) {
    var g = new THREE.Group();
    var terrain = buildTerrain(THREE, P);
    g.add(terrain);

    var geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    var ruins = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), P.ruins);
    var dummy = new THREE.Object3D();
    var color = new THREE.Color();
    var placed = 0;
    var guard = 0;
    while (placed < P.ruins && guard < 400) {
      guard++;
      var a = rnd() * Math.PI * 2;
      var r = 4.4 + rnd() * 6;
      var x = Math.cos(a) * r;
      var z = Math.sin(a) * r;
      if (Math.hypot(x - A_POS.x, z - A_POS.z) < 3 || Math.hypot(x - T_POS.x, z - T_POS.z) < 3) continue;
      var along = x * B_UX + z * B_UZ;
      var perp = -x * B_UZ + z * B_UX;
      if (along > 6 && Math.abs(perp) < 2.2) continue;
      var h = 0.35 + rnd() * 1.1;
      dummy.position.set(x, heightAt(x, z) - 0.05, z);
      dummy.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.5);
      dummy.scale.set(0.2 + rnd() * 0.5, h, 0.2 + rnd() * 0.5);
      dummy.updateMatrix();
      ruins.setMatrixAt(placed, dummy.matrix);
      color.setHex(rnd() < 0.5 ? 0x4a4030 : 0x2a2622);
      ruins.setColorAt(placed, color);
      placed++;
    }
    ruins.count = placed;
    ruins.instanceMatrix.needsUpdate = true;
    if (ruins.instanceColor) ruins.instanceColor.needsUpdate = true;
    g.add(ruins);

    // песчаная пыль над пустыней
    var n = P.dust;
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var pa = rnd() * Math.PI * 2;
      var pr = 2 + rnd() * 9;
      pos[i * 3] = Math.cos(pa) * pr;
      pos[i * 3 + 1] = 0.2 + rnd() * 2.2;
      pos[i * 3 + 2] = Math.sin(pa) * pr;
    }
    var dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
      size: 0.06, color: 0xe0a84a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    g.add(dust);

    // багровая дымка слоями
    var hazeTex = glowTexture(THREE, '160,20,22', 256);
    var hazes = [];
    [0.5, 1.3, 2.2].forEach(function (y, k) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({
        map: hazeTex, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide
      }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.userData.ph = k * 1.7;
      g.add(m);
      hazes.push(m);
    });

    function update(t, dt, sel) {
      dust.rotation.y += dt * 0.02;
      for (var k = 0; k < hazes.length; k++) {
        hazes[k].material.opacity = (sel ? 0.22 : 0.14) + 0.03 * Math.sin(t * 0.5 + hazes[k].userData.ph);
      }
    }

    return { group: g, update: update, hits: [terrain] };
  }

  /* ---------- 4. Город Астры ---------- */
  function buildAstra(THREE, P, rnd) {
    var g = new THREE.Group();
    var baseY = heightAt(A_POS.x, A_POS.z);
    g.position.set(A_POS.x, baseY, A_POS.z);

    var stone = new THREE.MeshLambertMaterial({ color: 0x33423a, flatShading: true });
    var i;

    // полуразрушенные здания, колонны и арки
    for (i = 0; i < 12; i++) {
      var a = rnd() * Math.PI * 2;
      var r = 0.3 + rnd() * 1.9;
      var x = Math.cos(a) * r;
      var z = Math.sin(a) * r;
      var type = i % 3;
      var m;
      if (type === 0) {
        var h = 0.5 + rnd() * 1.1;
        m = new THREE.Mesh(new THREE.BoxGeometry(0.4 + rnd() * 0.4, h, 0.4 + rnd() * 0.4), stone);
        m.position.set(x, h / 2 - 0.1, z);
        m.rotation.set((rnd() - 0.5) * 0.25, rnd() * 3, (rnd() - 0.5) * 0.3);
      } else if (type === 1) {
        var ch = 0.5 + rnd() * 0.9;
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, ch, 12), stone);
        m.position.set(x, ch / 2 - 0.1, z);
        m.rotation.z = (rnd() - 0.5) * 0.35;
      } else {
        m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 10, 24, Math.PI), stone);
        m.position.set(x, 0.55, z);
        m.rotation.y = rnd() * 3;
      }
      g.add(m);
    }

    // светящийся изумрудный мох
    var mossGeo = new THREE.IcosahedronGeometry(1, 1);
    var mossMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
    var moss = new THREE.InstancedMesh(mossGeo, mossMat, 70);
    var dummy = new THREE.Object3D();
    for (i = 0; i < 70; i++) {
      var ma = rnd() * Math.PI * 2;
      var mr = 0.2 + rnd() * 2.1;
      var s = 0.05 + rnd() * 0.12;
      dummy.position.set(Math.cos(ma) * mr, rnd() * 1.1 - 0.05, Math.sin(ma) * mr);
      dummy.scale.set(s * 1.4, s * 0.6, s * 1.4);
      dummy.updateMatrix();
      moss.setMatrixAt(i, dummy.matrix);
    }
    moss.instanceMatrix.needsUpdate = true;
    g.add(moss);

    // корни с золотисто-зелёным свечением
    var rootMats = [
      new THREE.MeshBasicMaterial({ color: 0x2ecc71 }),
      new THREE.MeshBasicMaterial({ color: 0xc9a227 })
    ];
    for (i = 0; i < 10; i++) {
      var pts = [];
      var ra = rnd() * Math.PI * 2;
      var px = Math.cos(ra) * (1.8 + rnd() * 0.6);
      var pz = Math.sin(ra) * (1.8 + rnd() * 0.6);
      var py = 0.02;
      for (var k = 0; k < 6; k++) {
        pts.push(new THREE.Vector3(px, py, pz));
        px *= 0.72 + rnd() * 0.12;
        pz *= 0.72 + rnd() * 0.12;
        px += (rnd() - 0.5) * 0.35;
        pz += (rnd() - 0.5) * 0.35;
        py += 0.1 + rnd() * 0.22;
      }
      var curve = new THREE.CatmullRomCurve3(pts);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.028 + rnd() * 0.02, 8, false), rootMats[i % 2]));
    }

    // светлячки
    var fn = P.fireflies;
    var fPos = new Float32Array(fn * 3);
    var fData = [];
    for (i = 0; i < fn; i++) {
      var fa = rnd() * Math.PI * 2;
      var fr = rnd() * 2.6;
      fData.push({ a: fa, r: fr, y: 0.3 + rnd() * 1.6, sp: 0.15 + rnd() * 0.3, ph: rnd() * 6.28 });
      fPos[i * 3] = Math.cos(fa) * fr;
      fPos[i * 3 + 1] = fData[i].y;
      fPos[i * 3 + 2] = Math.sin(fa) * fr;
    }
    var fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    var fMat = new THREE.PointsMaterial({
      size: 0.09, color: 0xb9f27a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending
    });
    g.add(new THREE.Points(fGeo, fMat));

    var lightG = new THREE.PointLight(0x2ecc71, 1.4, 7);
    lightG.position.set(0, 1.3, 0);
    g.add(lightG);
    var lightY = new THREE.PointLight(0xc9a227, 0.7, 5);
    lightY.position.set(0.6, 0.6, 0.4);
    g.add(lightY);

    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(THREE, '46,204,113', 256), transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    glow.scale.set(5, 3, 1);
    glow.position.y = 0.8;
    g.add(glow);

    var hit = hitSphere(THREE, 'astra', A_POS.x, baseY + 0.8, A_POS.z, 2.6);

    function update(t, dt, sel) {
      var p = fGeo.attributes.position;
      for (var k = 0; k < fn; k++) {
        var f = fData[k];
        var a2 = f.a + t * f.sp;
        p.setXYZ(k, Math.cos(a2) * f.r, f.y + Math.sin(t * 0.8 + f.ph) * 0.25, Math.sin(a2) * f.r);
      }
      p.needsUpdate = true;
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.2);
      lightG.intensity = (sel ? 2.1 : 1.4) + pulse * 0.3;
      glow.material.opacity = (sel ? 0.6 : 0.36) + pulse * 0.1;
    }

    return { group: g, update: update, hits: [hit] };
  }

  /* ---------- 5. Храм Ритма ---------- */
  function buildTemple(THREE, P, rnd) {
    var g = new THREE.Group();
    var baseY = heightAt(T_POS.x, T_POS.z);
    g.position.set(T_POS.x, baseY, T_POS.z);

    var metal = new THREE.MeshStandardMaterial({ color: 0x15151c, metalness: 0.85, roughness: 0.35, flatShading: true });
    var edgeMat = new THREE.LineBasicMaterial({
      color: 0xff1e1e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });

    function spire(radius, height, segs, x, z, lean) {
      var geo = new THREE.ConeGeometry(radius, height, segs);
      var m = new THREE.Mesh(geo, metal);
      m.position.set(x, height / 2, z);
      m.rotation.z = lean || 0;
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat);
      m.add(edges);
      g.add(m);
      return m;
    }

    // ступенчатое основание
    var base1 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.35, 8), metal);
    base1.position.y = 0.1;
    g.add(base1);
    var base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.35, 8), metal);
    base2.position.y = 0.45;
    g.add(base2);

    // главный шпиль и четыре боковых
    var main = spire(0.5, 3.6, 6, 0, 0, 0);
    main.position.y += 0.6;
    var flank = [];
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      var f = spire(0.26, 2.3, 5, Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
      f.position.y += 0.5;
      flank.push(f);
    }

    // острые шипы по кругу — наклонены наружу
    var thornGeo = new THREE.ConeGeometry(0.1, 0.95, 6);
    for (i = 0; i < 12; i++) {
      var ta = (i / 12) * Math.PI * 2;
      var thorn = new THREE.Mesh(thornGeo, metal);
      thorn.position.set(Math.cos(ta) * 1.75, 0.65, Math.sin(ta) * 1.75);
      thorn.rotation.set(Math.sin(ta) * 0.7, 0, -Math.cos(ta) * 0.7);
      g.add(thorn);
    }

    // контрфорсы: наклонные балки к главному шпилю
    var buttGeo = new THREE.BoxGeometry(0.12, 1.9, 0.12);
    for (i = 0; i < 4; i++) {
      var ba = (i / 4) * Math.PI * 2;
      var bt = new THREE.Mesh(buttGeo, metal);
      bt.position.set(Math.cos(ba) * 0.75, 1.3, Math.sin(ba) * 0.75);
      bt.rotation.set(Math.sin(ba) * 0.38, 0, -Math.cos(ba) * 0.38);
      g.add(bt);
    }

    // пульсирующие алые звуковые кольца
    var ringGeo = new THREE.TorusGeometry(1, 0.035, 8, 96);
    var rings = [];
    for (i = 0; i < 4; i++) {
      var ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xff1e1e, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      g.add(ring);
      rings.push(ring);
    }

    var light = new THREE.PointLight(0xff1e1e, 1.6, 9);
    light.position.set(0, 1.2, 0);
    g.add(light);

    var hit = hitSphere(THREE, 'temple', T_POS.x, baseY + 1.6, T_POS.z, 2.7);

    var BPS = 2; // 120 BPM

    function update(t, dt, sel) {
      var beat = (t * BPS) % 1;
      for (var k = 0; k < rings.length; k++) {
        var s = (beat + k / rings.length) % 1;
        rings[k].scale.setScalar(1.3 + s * 2.8);
        rings[k].material.opacity = (1 - s) * (sel ? 0.95 : 0.75);
      }
      var kick = Math.exp(-beat * 6);
      light.intensity = (sel ? 2.2 : 1.4) + kick * 1.6;
      edgeMat.opacity = 0.55 + 0.45 * kick;
    }

    return { group: g, update: update, hits: [hit] };
  }

  /* ---------- 6. Бункер Они ---------- */
  function buildBunker(THREE, P, rnd) {
    var g = new THREE.Group();
    var along = 9.9;
    var bx = B_UX * along;
    var bz = B_UZ * along;
    var baseY = heightAt(bx, bz);
    g.position.set(bx, baseY, bz);
    g.rotation.y = Math.atan2(-B_UX, -B_UZ); // вход смотрит к центру карты

    var steel = new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.85, roughness: 0.4, flatShading: true });
    var dark = new THREE.MeshStandardMaterial({ color: 0x1c1e23, metalness: 0.8, roughness: 0.5, flatShading: true });
    var i;

    var frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 0.6), dark);
    frame.position.y = 0.75;
    g.add(frame);
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.05, 0.3), steel);
    door.position.set(0, 0.55, 0.28);
    g.add(door);
    for (i = 0; i < 3; i++) {
      var rib = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.34), dark);
      rib.position.set(0, 0.25 + i * 0.32, 0.3);
      g.add(rib);
    }
    var rivetGeo = new THREE.SphereGeometry(0.04, 12, 8);
    for (i = 0; i < 12; i++) {
      var rv = new THREE.Mesh(rivetGeo, steel);
      rv.position.set(-0.55 + (i % 4) * 0.37, 0.2 + Math.floor(i / 4) * 0.34, 0.46);
      g.add(rv);
    }

    // антенны и тарелка
    var antHeights = [1.5, 1.1, 0.75];
    antHeights.forEach(function (h, k) {
      var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, h, 8), steel);
      ant.position.set(-0.7 + k * 0.5, 1.5 + h / 2, -0.1);
      g.add(ant);
    });
    var dish = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    dish.position.set(0.65, 1.62, -0.05);
    dish.rotation.x = Math.PI / 2 - 0.35;
    g.add(dish);

    // янтарный маяк
    var beaconGroup = new THREE.Group();
    beaconGroup.position.set(0, 3.15, -0.1);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf39c12 }));
    beaconGroup.add(bulb);
    var beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(THREE, '243,156,18', 256), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    }));
    beaconGlow.scale.set(1.8, 1.8, 1);
    beaconGroup.add(beaconGlow);
    var beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 3.4, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf39c12, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false
      })
    );
    beam.rotation.z = -Math.PI / 2;
    beam.position.x = 1.7;
    var beamPivot = new THREE.Group();
    beamPivot.add(beam);
    beaconGroup.add(beamPivot);
    g.add(beaconGroup);

    var light = new THREE.PointLight(0xf39c12, 1.5, 7);
    light.position.set(0, 2.8, 0.6);
    g.add(light);

    var hit = hitSphere(THREE, 'bunker', bx, baseY + 1.4, bz, 2.4);

    function update(t, dt, sel) {
      beamPivot.rotation.y += dt * 0.9;
      var blink = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.4));
      bulb.scale.setScalar(0.9 + blink * 0.3);
      beaconGlow.material.opacity = (sel ? 0.95 : 0.7) * blink;
      light.intensity = (sel ? 2.1 : 1.5) * (0.7 + 0.3 * blink);
    }

    return { group: g, update: update, hits: [hit] };
  }

  /* ---------- 7. Ядро: золотая воронка ---------- */
  var CORE_VERT = [
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'attribute float aT;',
    'attribute float aArm;',
    'attribute float aSeed;',
    'varying float vT;',
    'void main() {',
    '  float t = aT;',
    '  float R = 4.3 * pow(1.0 - t, 1.5) + 0.12;',
    '  float ang = aArm * 2.0943951 + t * 14.0 + uTime * (0.35 + (1.0 - t) * 2.0);',
    '  float wob = 1.0 + 0.07 * sin(aSeed * 40.0 + uTime * 1.3);',
    '  vec3 p = vec3(cos(ang) * R * wob, 2.2 - t * 4.8, sin(ang) * R * wob);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = (1.6 + (1.0 - t) * 3.4 + aSeed * 1.2) * uPixelRatio * (9.0 / -mv.z);',
    '  vT = t;',
    '}'
  ].join('\n');

  var CORE_FRAG = [
    'varying float vT;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  if (d > 1.0) discard;',
    '  float a = pow(1.0 - d, 1.5);',
    '  vec3 gold = vec3(1.0, 0.84, 0.0);',
    '  vec3 hot = vec3(1.0, 0.97, 0.8);',
    '  gl_FragColor = vec4(mix(gold, hot, smoothstep(0.55, 1.0, vT)) * (0.9 + vT), a);',
    '}'
  ].join('\n');

  function buildCore(THREE, P, rnd, shared) {
    var g = new THREE.Group();
    g.position.y = -6.3;
    var n = P.coreN;
    var i;

    var pos = new Float32Array(n * 3); // служебный буфер (позиции считаются в шейдере)
    var aT = new Float32Array(n);
    var aArm = new Float32Array(n);
    var aSeed = new Float32Array(n);
    for (i = 0; i < n; i++) {
      aT[i] = Math.pow(rnd(), 0.8);
      aArm[i] = Math.floor(rnd() * 3);
      aSeed[i] = rnd();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    geo.setAttribute('aArm', new THREE.BufferAttribute(aArm, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uPixelRatio: shared.uPixelRatio },
      vertexShader: CORE_VERT, fragmentShader: CORE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var spiral = new THREE.Points(geo, mat);
    spiral.frustumCulled = false;
    g.add(spiral);

    // каркас воронки
    var prof = [];
    for (i = 0; i <= 24; i++) {
      var t = i / 24;
      prof.push(new THREE.Vector2(4.3 * Math.pow(1 - t, 1.5) + 0.12, 2.2 - t * 4.8));
    }
    var funnel = new THREE.Mesh(
      new THREE.LatheGeometry(prof, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffd700, wireframe: true, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    g.add(funnel);

    // вращающиеся кольца потока
    var ringGeo = new THREE.TorusGeometry(1, 0.025, 8, 128);
    var rings = [];
    for (i = 0; i < 9; i++) {
      var tt = (i + 0.5) / 9;
      var ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffd700, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      ring.scale.setScalar(4.3 * Math.pow(1 - tt, 1.5) + 0.12);
      ring.position.y = 2.2 - tt * 4.8;
      ring.rotation.x = Math.PI / 2;
      ring.userData.sp = 0.4 + (1 - tt) * 1.8;
      g.add(ring);
      rings.push(ring);
    }

    // слепящее сердце
    var heart = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 20), new THREE.MeshBasicMaterial({ color: 0xfff4c2, fog: false }));
    heart.position.y = -2.7;
    g.add(heart);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(THREE, '255,215,0', 256), transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    }));
    halo.scale.set(6, 6, 1);
    halo.position.y = -2.6;
    g.add(halo);

    var light = new THREE.PointLight(0xffd700, 2.0, 12);
    light.position.y = -1.5;
    g.add(light);

    var hit = hitSphere(THREE, 'core', 0, -6.0, 0, 4.4);

    function update(t, dt, sel) {
      for (var k = 0; k < rings.length; k++) rings[k].rotation.z += dt * rings[k].userData.sp;
      var pulse = 0.5 + 0.5 * Math.sin(t * 2.0);
      heart.scale.setScalar(1 + pulse * 0.25);
      halo.material.opacity = (sel ? 1 : 0.8) * (0.7 + 0.3 * pulse);
      light.intensity = (sel ? 3 : 2) + pulse * 0.6;
    }

    return { group: g, update: update, hits: [hit] };
  }

  /* ---------- 8. Цифровой мир Матрицы ---------- */
  var MX_VERT = [
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'uniform float uPoint;',
    'varying float vY;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vY = wp.y;',
    '  vec4 mv = viewMatrix * wp;',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = uPoint * uPixelRatio * (24.0 / -mv.z);',
    '}'
  ].join('\n');

  var MX_FRAG_LINE = [
    'uniform float uTime;',
    'uniform float uHi;',
    'varying float vY;',
    'void main() {',
    '  float band = 0.5 + 0.5 * sin(vY * 0.55 - uTime * 1.4);',
    '  float a = 0.16 + 0.24 * band + uHi * 0.4;',
    '  vec3 c = mix(vec3(0.22, 0.74, 0.97), vec3(0.85, 0.96, 1.0), band * 0.6 + uHi * 0.4);',
    '  gl_FragColor = vec4(c, a);',
    '}'
  ].join('\n');

  var MX_FRAG_POINT = [
    'uniform float uTime;',
    'uniform float uHi;',
    'varying float vY;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  if (d > 1.0) discard;',
    '  float band = 0.5 + 0.5 * sin(vY * 0.55 - uTime * 1.4);',
    '  float a = (0.5 + 0.5 * band + uHi * 0.5) * pow(1.0 - d, 1.2);',
    '  gl_FragColor = vec4(vec3(0.6, 0.9, 1.0), a);',
    '}'
  ].join('\n');

  function buildMatrix(THREE, P, rnd, shared) {
    var g = new THREE.Group();
    var ico = new THREE.IcosahedronGeometry(14.5, 3);
    var uniforms = {
      uTime: shared.uTime, uPixelRatio: shared.uPixelRatio, uHi: { value: 0 }, uPoint: { value: 2.6 }
    };
    var lineMat = new THREE.ShaderMaterial({
      uniforms: uniforms, vertexShader: MX_VERT, fragmentShader: MX_FRAG_LINE,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var pointMat = new THREE.ShaderMaterial({
      uniforms: uniforms, vertexShader: MX_VERT, fragmentShader: MX_FRAG_POINT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(ico, 1), lineMat));
    g.add(new THREE.Points(ico, pointMat));

    var hit = new THREE.Mesh(new THREE.SphereGeometry(14.6, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    hit.visible = false;
    hit.userData.zone = 'matrix';

    var hiTarget = 0;
    function update(t, dt, sel) {
      g.rotation.y += dt * 0.02;
      hiTarget = sel ? 1 : 0;
      uniforms.uHi.value += (hiTarget - uniforms.uHi.value) * (1 - Math.exp(-dt * 4));
    }

    return { group: g, update: update, hits: [hit], hitExtra: hit };
  }

  /* ---------- Золотой Стержень — сквозная ось ---------- */
  function buildRod(THREE, rnd) {
    var g = new THREE.Group();
    var yMin = -8.6;
    var yMax = 10.4;
    var len = yMax - yMin;

    var core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, len, 16, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false })
    );
    core.position.y = (yMax + yMin) / 2;
    g.add(core);

    var glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, len, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xc9a227, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    glow.position.y = core.position.y;
    g.add(glow);

    // импульсы частот бегут вдоль оси
    var pulseGeo = new THREE.SphereGeometry(0.14, 16, 12);
    var pulses = [];
    for (var i = 0; i < 8; i++) {
      var m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({
        color: 0xfff1b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      m.userData = { ph: i / 8, sp: 0.05 + rnd() * 0.04, dir: i % 2 ? 1 : -1 };
      g.add(m);
      pulses.push(m);
    }

    function update(t) {
      for (var k = 0; k < pulses.length; k++) {
        var p = pulses[k];
        var u = ((p.userData.ph + t * p.userData.sp * p.userData.dir) % 1 + 1) % 1;
        p.position.y = yMin + u * len;
        p.scale.setScalar(0.8 + 0.5 * Math.sin(u * 20 + t * 3));
      }
      glow.material.opacity = 0.16 + 0.06 * Math.sin(t * 1.7);
    }

    return { group: g, update: update };
  }

  /* ========================================================================
     МИР: сцена, камера, перелёты, выбор
     ======================================================================== */
  function outwardYaw(x, z) { return Math.atan2(x, z); }
  function inwardYaw(x, z) { return Math.atan2(-x, -z); }

  function buildViews() {
    var bAlong = 9.9;
    var bx = B_UX * bAlong;
    var bz = B_UZ * bAlong;
    return {
      overview: { t: [0, 0.4, 0], dist: 31, yaw: 0.55, pitch: 0.42 },
      upper: { t: [0, 8.6, 0], dist: 9.5, yaw: 0.6, pitch: 0.22 },
      neon: { t: [0, 2.2, 0], dist: 9.6, yaw: 0.7, pitch: 0.36 },
      wastes: { t: [0, -0.3, 0], dist: 19, yaw: 2.2, pitch: 0.72 },
      astra: { t: [A_POS.x, heightAt(A_POS.x, A_POS.z) + 0.6, A_POS.z], dist: 6.4, yaw: outwardYaw(A_POS.x, A_POS.z), pitch: 0.45 },
      temple: { t: [T_POS.x, heightAt(T_POS.x, T_POS.z) + 1.4, T_POS.z], dist: 8.2, yaw: outwardYaw(T_POS.x, T_POS.z), pitch: 0.3 },
      bunker: { t: [bx, heightAt(bx, bz) + 1.1, bz], dist: 6.2, yaw: inwardYaw(bx, bz), pitch: 0.28 },
      core: { t: [0, -6.0, 0], dist: 9.6, yaw: 0.5, pitch: 0.42 },
      matrix: { t: [0, 0, 0], dist: 33, yaw: -0.6, pitch: 0.28 }
    };
  }

  // маркеры выбора: кольцо на земле/ярусе + луч света
  var MARKERS = {
    upper: { y: 8.6, r: 3.9, beam: 3 },
    neon: { y: 0.05, r: 3.3, beam: 5 },
    wastes: { y: -0.2, r: 11, beam: 0 },
    astra: { pos: A_POS, r: 2.7, beam: 3.5 },
    temple: { pos: T_POS, r: 2.6, beam: 4.5 },
    bunker: { pos: { x: B_UX * 9.9, z: B_UZ * 9.9 }, r: 2.0, beam: 3.8 },
    core: { y: -6.3, r: 4.8, beam: 4 },
    matrix: null
  };

  function createWorld(THREE, canvas, stage, callbacks) {
    var P = buildProfile();

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x3a0709, 0.012);
    var camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);

    var shared = { uTime: { value: 0 }, uPixelRatio: { value: 1 } };
    var rnd = seeded(20260);

    /* ---- свет ---- */
    scene.add(new THREE.AmbientLight(0x30203a, 0.8));
    var cold = new THREE.DirectionalLight(0x9fb8ff, 0.45);
    cold.position.set(-4, 12, 5);
    scene.add(cold);

    /* ---- небо ---- */
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(13.8, 48, 32),
      new THREE.MeshBasicMaterial({ map: skyTexture(THREE), side: THREE.BackSide, depthWrite: false, fog: false })
    );
    sky.renderOrder = -10;
    scene.add(sky);

    /* ---- зоны ---- */
    var modules = {
      upper: buildUpper(THREE, P, rnd),
      neon: buildNeon(THREE, P, rnd),
      wastes: buildWastes(THREE, P, rnd),
      astra: buildAstra(THREE, P, rnd),
      temple: buildTemple(THREE, P, rnd),
      bunker: buildBunker(THREE, P, rnd),
      core: buildCore(THREE, P, rnd, shared),
      matrix: buildMatrix(THREE, P, rnd, shared)
    };
    var rod = buildRod(THREE, rnd);
    scene.add(rod.group);

    var pickables = [];
    Object.keys(modules).forEach(function (id) {
      var m = modules[id];
      scene.add(m.group);
      if (m.extra) m.extra.forEach(function (x) { scene.add(x); });
      m.hits.forEach(function (h) {
        if (!h.userData.zone) h.userData.zone = id;
        if (h.parent !== m.group) scene.add(h);
        pickables.push(h);
      });
    });

    /* ---- маркер выбранной локации ---- */
    var marker = new THREE.Group();
    marker.visible = false;
    var mRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.035, 10, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    mRing.rotation.x = Math.PI / 2;
    var mRing2 = new THREE.Mesh(mRing.geometry, mRing.material.clone());
    mRing2.rotation.x = Math.PI / 2;
    var mBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    marker.add(mRing, mRing2, mBeam);
    scene.add(marker);
    var markerRadius = 1;

    var zoneColors = {};
    ZONES.forEach(function (z) { zoneColors[z.id] = new THREE.Color(z.color); });

    function placeMarker(id) {
      var cfg = MARKERS[id];
      if (!cfg) { marker.visible = false; return; }
      var x = cfg.pos ? cfg.pos.x : 0;
      var z = cfg.pos ? cfg.pos.z : 0;
      var y = cfg.pos ? heightAt(cfg.pos.x, cfg.pos.z) + 0.08 : cfg.y;
      marker.position.set(x, y, z);
      markerRadius = cfg.r;
      var col = zoneColors[id];
      mRing.material.color.copy(col);
      mRing2.material.color.copy(col);
      mBeam.material.color.copy(col);
      if (cfg.beam > 0) {
        mBeam.visible = true;
        mBeam.scale.set(cfg.r * 0.18, cfg.beam, cfg.r * 0.18);
        mBeam.position.y = cfg.beam / 2;
      } else {
        mBeam.visible = false;
      }
      marker.visible = true;
    }

    /* ---- камера ---- */
    var VIEWS = buildViews();
    var cam = { t: new THREE.Vector3(0, 0.4, 0), dist: 31, yaw: 0.55, pitch: 0.42 };
    var tween = null;
    var selected = null;
    var idleAt = performance.now();

    function applyCamera() {
      var cp = Math.cos(cam.pitch);
      camera.position.set(
        cam.t.x + cam.dist * cp * Math.sin(cam.yaw),
        cam.t.y + cam.dist * Math.sin(cam.pitch),
        cam.t.z + cam.dist * cp * Math.cos(cam.yaw)
      );
      camera.lookAt(cam.t);
    }

    function flyTo(view, duration) {
      var from = { x: cam.t.x, y: cam.t.y, z: cam.t.z, dist: cam.dist, yaw: cam.yaw, pitch: cam.pitch };
      var dyaw = view.yaw - from.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); // кратчайший путь по азимуту
      tween = {
        from: from,
        to: { x: view.t[0], y: view.t[1], z: view.t[2], dist: view.dist, pitch: view.pitch, dyaw: dyaw },
        start: performance.now(),
        dur: (reduced() ? 0.01 : duration) * 1000
      };
    }

    function stepTween(now) {
      if (!tween) return;
      var k = clamp((now - tween.start) / tween.dur, 0, 1);
      var e = smoother(k);
      var f = tween.from;
      var to = tween.to;
      cam.t.set(lerp(f.x, to.x, e), lerp(f.y, to.y, e), lerp(f.z, to.z, e));
      var swoop = Math.sin(Math.PI * e) * Math.min(7, Math.abs(to.dist - f.dist) * 0.18 + 2.2);
      cam.dist = lerp(f.dist, to.dist, e) + swoop;
      cam.yaw = f.yaw + to.dyaw * e;
      cam.pitch = lerp(f.pitch, to.pitch, e);
      if (k >= 1) tween = null;
    }

    function select(id, silent) {
      selected = id && VIEWS[id] ? id : null;
      if (selected) {
        placeMarker(selected);
        flyTo(VIEWS[selected], 1.6);
      } else {
        marker.visible = false;
        flyTo(VIEWS.overview, 1.5);
      }
      idleAt = performance.now();
      if (!silent && callbacks.onSelect) callbacks.onSelect(selected);
    }

    /* ---- ввод: вращение, масштаб, клик ---- */
    var pointers = {};
    var pinchDist = 0;
    var down = null;
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var hoverZone = null;
    var lastHoverAt = 0;

    function pointerCount() { return Object.keys(pointers).length; }

    function pick(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -(((clientY - r.top) / Math.max(1, r.height)) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(pickables, false);
      // «воздушные» объёмы локаций приоритетнее рельефа и сферы Матрицы
      var best = null;
      for (var i = 0; i < hits.length; i++) {
        var z = hits[i].object.userData.zone;
        if (z === 'matrix' || z === 'wastes') { if (!best) best = hits[i]; continue; }
        return z;
      }
      return best ? best.object.userData.zone : null;
    }

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      if (pointerCount() === 1) {
        down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
        stage.classList.add('is-grabbing');
      } else if (pointerCount() === 2) {
        var ids = Object.keys(pointers);
        pinchDist = Math.hypot(pointers[ids[0]].x - pointers[ids[1]].x, pointers[ids[0]].y - pointers[ids[1]].y);
        down = null;
      }
      if (callbacks.onInteract) callbacks.onInteract();
    }

    function onMove(e) {
      var p = pointers[e.pointerId];
      if (p) {
        var dx = e.clientX - p.x;
        var dy = e.clientY - p.y;
        p.x = e.clientX;
        p.y = e.clientY;
        idleAt = performance.now();
        if (pointerCount() === 1) {
          tween = null;
          cam.yaw -= dx * 0.0065;
          cam.pitch = clamp(cam.pitch + dy * 0.005, -0.3, 1.38);
          if (down) down.moved += Math.abs(dx) + Math.abs(dy);
        } else if (pointerCount() === 2) {
          var ids = Object.keys(pointers);
          var d = Math.hypot(pointers[ids[0]].x - pointers[ids[1]].x, pointers[ids[0]].y - pointers[ids[1]].y);
          if (pinchDist > 0) {
            tween = null;
            cam.dist = clamp(cam.dist * (pinchDist / Math.max(1, d)), 4, 36);
          }
          pinchDist = d;
        }
        return;
      }
      // наведение (только мышь)
      if (e.pointerType === 'mouse') {
        var now = performance.now();
        if (now - lastHoverAt < 90) return;
        lastHoverAt = now;
        var z = pick(e.clientX, e.clientY);
        if (z !== hoverZone) {
          hoverZone = z;
          stage.classList.toggle('is-hover', !!z);
        }
        if (callbacks.onHover) callbacks.onHover(z, e.clientX, e.clientY);
      }
    }

    function onUp(e) {
      var had = pointers[e.pointerId];
      delete pointers[e.pointerId];
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      if (pointerCount() < 2) pinchDist = 0;
      if (pointerCount() === 0) stage.classList.remove('is-grabbing');
      idleAt = performance.now();
      // короткий неподвижный клик — выбор локации
      if (had && down && e.type === 'pointerup' && down.moved < 7 && performance.now() - down.t < 600) {
        var z = pick(e.clientX, e.clientY);
        if (z) select(z);
      }
      if (pointerCount() === 0) down = null;
    }

    function onLeave() {
      hoverZone = null;
      stage.classList.remove('is-hover');
      if (callbacks.onHover) callbacks.onHover(null, 0, 0);
    }

    function onWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return; // обычное колесо листает страницу
      e.preventDefault();
      tween = null;
      cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0015), 4, 36);
      idleAt = performance.now();
    }

    function onKey(e) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= ZONES.length) { select(ZONES[n - 1].id); e.preventDefault(); return; }
      if (e.key === '0' || e.key === 'Escape') { select(null); e.preventDefault(); return; }
      tween = null;
      if (e.key === 'ArrowLeft') cam.yaw += 0.12;
      else if (e.key === 'ArrowRight') cam.yaw -= 0.12;
      else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch + 0.08, -0.3, 1.38);
      else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch - 0.08, -0.3, 1.38);
      else if (e.key === '+' || e.key === '=') cam.dist = clamp(cam.dist * 0.9, 4, 36);
      else if (e.key === '-') cam.dist = clamp(cam.dist * 1.1, 4, 36);
      else return;
      e.preventDefault();
      idleAt = performance.now();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('keydown', onKey);

    /* ---- размеры ---- */
    function fit() {
      var w = Math.max(1, stage.clientWidth);
      var h = Math.max(1, stage.clientHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      shared.uPixelRatio.value = dpr;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    /* ---- цикл ---- */
    var time = 0;
    var running = false;
    var rafId = 0;
    var last = 0;
    var inView = true;
    var docVisible = !doc.hidden;
    var paused = false;
    var ctxLost = false;
    var minInterval = P.fps >= 60 ? 0 : 1000 / P.fps - 2;
    var markerPulse = 0;

    function update(dt, now) {
      time += dt;
      shared.uTime.value = time;

      stepTween(now);
      if (!tween && !reduced() && now - idleAt > 4000 && pointerCount() === 0) cam.yaw += dt * 0.05; // плавный автооборот
      applyCamera();

      sky.position.copy(camera.position).multiplyScalar(0); // небо неподвижно относительно мира
      rod.update(time);
      var ids = Object.keys(modules);
      for (var i = 0; i < ids.length; i++) modules[ids[i]].update(time, dt, selected === ids[i]);

      if (marker.visible) {
        markerPulse = (markerPulse + dt * 0.9) % 1;
        mRing.scale.setScalar(markerRadius * (0.92 + 0.08 * Math.sin(time * 3)));
        mRing2.scale.setScalar(markerRadius * (1 + markerPulse * 0.35));
        mRing2.material.opacity = 0.7 * (1 - markerPulse);
        mBeam.material.opacity = 0.13 + 0.05 * Math.sin(time * 2.4);
      }
    }

    function renderOnce() { renderer.render(scene, camera); }

    function frame(now) {
      if (!running) return;
      rafId = window.requestAnimationFrame(frame);
      var elapsed = now - last;
      if (elapsed < minInterval) return;
      last = now;
      update(Math.min(elapsed / 1000, 0.1), now);
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
      if (!running) { update(0, performance.now()); renderOnce(); }
    }
    function onVis() { docVisible = !doc.hidden; sync(); }
    function onLost(e) { e.preventDefault(); ctxLost = true; sync(); }
    function onRestored() { ctxLost = false; sync(); }

    fit();
    if (typeof window.ResizeObserver === 'function') {
      ro = new window.ResizeObserver(onResize);
      ro.observe(stage);
    } else {
      window.addEventListener('resize', onResize);
    }
    if (typeof window.IntersectionObserver === 'function') {
      io = new window.IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0 });
      io.observe(stage);
    }
    doc.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    // стартовый вид
    var v0 = VIEWS.overview;
    cam.t.set(v0.t[0], v0.t[1], v0.t[2]);
    cam.dist = v0.dist;
    cam.yaw = v0.yaw;
    cam.pitch = v0.pitch;
    applyCamera();
    update(0, performance.now());
    renderOnce();
    sync();

    function dispose() {
      running = false;
      window.cancelAnimationFrame(rafId);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
      if (io) io.disconnect();
      doc.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
        mats.forEach(function (m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      });
      renderer.dispose();
    }

    return {
      select: select,
      resize: onResize,
      setPaused: function (v) { paused = !!v; sync(); },
      getSelected: function () { return selected; },
      dispose: dispose
    };
  }

  /* ========================================================================
     КОМПАС «ЧЕТЫРЕ БЕЗДНЫ»
     ======================================================================== */
  function createCompass(THREE, canvas, stage, abysses, callbacks) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);

    scene.add(new THREE.AmbientLight(0x2a2030, 0.8));
    var key = new THREE.PointLight(0xc9a227, 1.8, 0);
    key.position.set(3, 3.2, 4.5);
    var fill = new THREE.PointLight(0x7b2cbf, 1.0, 0);
    fill.position.set(-3.2, -1.5, 3);
    scene.add(key, fill);

    var root = new THREE.Group();
    scene.add(root);
    var tilt = new THREE.Group();
    tilt.rotation.x = 0.28; // легкий наклон к зрителю
    tilt.add(root);
    scene.add(tilt);

    var gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.25 });

    // алхимический кристалл в центре
    var crystalGeo = new THREE.OctahedronGeometry(0.62, 0);
    var crystal = new THREE.Mesh(crystalGeo, new THREE.MeshStandardMaterial({
      color: 0x14141f, metalness: 0.7, roughness: 0.3, flatShading: true
    }));
    crystal.scale.set(1, 1.55, 1);
    root.add(crystal);
    var crystalEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(crystalGeo),
      new THREE.LineBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.95 })
    );
    crystalEdges.scale.copy(crystal.scale);
    root.add(crystalEdges);

    // кольца компаса
    var eq = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.02, 12, 160), gold);
    eq.rotation.x = Math.PI / 2;
    root.add(eq);
    var mer = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.012, 10, 160),
      new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.45 }));
    root.add(mer);

    // вертикальные шпили
    var spireGeo = new THREE.ConeGeometry(0.12, 0.9, 24);
    var up = new THREE.Mesh(spireGeo, gold);
    up.position.y = 1.15;
    var down = new THREE.Mesh(spireGeo, gold);
    down.position.y = -1.15;
    down.rotation.x = Math.PI;
    root.add(up, down);

    // четыре энергетических полюса
    var glowTexCache = {};
    var poles = [];
    var hits = [];
    abysses.forEach(function (a, i) {
      var col = new THREE.Color(a.color);
      var pole = new THREE.Group();
      pole.rotation.y = i * Math.PI / 2;

      var coneMat = new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3
      });
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95, 28), coneMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.z = 0.98;
      pole.add(cone);

      var base = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.022, 10, 40), gold);
      base.position.z = 0.55;
      pole.add(base);

      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 18), new THREE.MeshBasicMaterial({ color: col }));
      orb.position.z = 1.55;
      pole.add(orb);

      var rgb = Math.round(col.r * 255) + ',' + Math.round(col.g * 255) + ',' + Math.round(col.b * 255);
      if (!glowTexCache[rgb]) glowTexCache[rgb] = glowTexture(THREE, rgb, 256);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexCache[rgb], transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      glow.scale.set(0.9, 0.9, 1);
      glow.position.z = 1.55;
      pole.add(glow);

      var hit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial());
      hit.position.z = 1.3;
      hit.visible = false;
      hit.userData.abyss = a.id;
      pole.add(hit);
      hits.push(hit);

      root.add(pole);
      poles.push({ id: a.id, cone: cone, coneMat: coneMat, orb: orb, glow: glow, index: i });
    });

    /* ---- состояние ---- */
    var selectedIndex = -1;
    var targetYaw = 0;
    var yaw = 0;
    var dragging = false;
    var lastX = 0;
    var downX = 0;
    var downY = 0;
    var downT = 0;
    var idleAt = performance.now();
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();

    function indexOf(id) {
      for (var i = 0; i < poles.length; i++) if (poles[i].id === id) return i;
      return -1;
    }

    function setActive(id) {
      selectedIndex = id ? indexOf(id) : -1;
      if (selectedIndex >= 0) {
        var raw = -(selectedIndex * Math.PI / 2);
        var diff = Math.atan2(Math.sin(raw - yaw), Math.cos(raw - yaw));
        targetYaw = yaw + diff; // кратчайший поворот к нужной грани
      }
      idleAt = performance.now();
    }

    function pick(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -(((clientY - r.top) / Math.max(1, r.height)) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      var found = raycaster.intersectObjects(hits, false);
      return found.length ? found[0].object.userData.abyss : null;
    }

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      lastX = downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      stage.classList.add('is-grabbing');
    }

    function onMove(e) {
      if (dragging) {
        var dx = e.clientX - lastX;
        lastX = e.clientX;
        yaw += dx * 0.012;
        targetYaw = yaw;
        idleAt = performance.now();
      } else if (e.pointerType === 'mouse') {
        stage.classList.toggle('is-hover', !!pick(e.clientX, e.clientY));
      }
    }

    function onUp(e) {
      var wasDrag = dragging;
      dragging = false;
      stage.classList.remove('is-grabbing');
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      idleAt = performance.now();
      if (wasDrag && e.type === 'pointerup' &&
        Math.hypot(e.clientX - downX, e.clientY - downY) < 7 && performance.now() - downT < 600) {
        var id = pick(e.clientX, e.clientY);
        if (id && callbacks.onPick) callbacks.onPick(id);
      } else if (selectedIndex >= 0) {
        setActive(poles[selectedIndex].id); // после ручного поворота возвращаемся к выбранной грани
      }
    }

    function onKey(e) {
      var step = selectedIndex < 0 ? 0 : selectedIndex;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step = (step + poles.length - 1) % poles.length;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step = (step + 1) % poles.length;
      else return;
      e.preventDefault();
      if (callbacks.onPick) callbacks.onPick(poles[step].id);
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);

    function fit() {
      var w = Math.max(1, stage.clientWidth);
      var h = Math.max(1, stage.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var vf = (camera.fov * Math.PI) / 180;
      var hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      camera.position.set(0, 0.3, (2.15 * 1.15) / Math.sin(Math.min(vf, hf) / 2));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    var time = 0;
    var running = false;
    var rafId = 0;
    var last = 0;
    var inView = true;
    var docVisible = !doc.hidden;
    var ctxLost = false;

    function update(dt, now) {
      time += dt;
      if (!dragging) {
        if (selectedIndex >= 0) {
          yaw += (targetYaw - yaw) * (1 - Math.exp(-dt * 5)); // плавный поворот нужной гранью к зрителю
        } else if (!reduced() && now - idleAt > 1500) {
          yaw += dt * 0.35;
          targetYaw = yaw;
        }
      }
      root.rotation.y = yaw;
      tilt.position.y = reduced() ? 0 : Math.sin(time * 0.9) * 0.05;

      for (var i = 0; i < poles.length; i++) {
        var p = poles[i];
        var sel = i === selectedIndex;
        var pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + i);
        var s = sel ? 1.55 + pulse * 0.2 : 1;
        p.orb.scale.setScalar(lerp(p.orb.scale.x, s, 0.18));
        p.glow.material.opacity = sel ? 0.9 : 0.4 + pulse * 0.1;
        p.glow.scale.setScalar(sel ? 1.5 : 0.9);
        p.coneMat.emissiveIntensity = sel ? 1.3 + pulse * 0.4 : 0.45;
      }
      crystalEdges.material.opacity = 0.7 + 0.25 * Math.sin(time * 1.6);
    }

    function render() { renderer.render(scene, camera); }

    function frame(now) {
      if (!running) return;
      rafId = window.requestAnimationFrame(frame);
      var elapsed = now - last;
      last = now;
      update(Math.min(elapsed / 1000, 0.1), now);
      render();
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

    var ro = null;
    var io = null;
    function onResize() { fit(); if (!running) { update(0, performance.now()); render(); } }
    function onVis() { docVisible = !doc.hidden; sync(); }
    function onLost(e) { e.preventDefault(); ctxLost = true; sync(); }
    function onRestored() { ctxLost = false; sync(); }

    fit();
    if (typeof window.ResizeObserver === 'function') {
      ro = new window.ResizeObserver(onResize);
      ro.observe(stage);
    } else {
      window.addEventListener('resize', onResize);
    }
    if (typeof window.IntersectionObserver === 'function') {
      io = new window.IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; sync(); }, { threshold: 0 });
      io.observe(stage);
    }
    doc.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    update(0, performance.now());
    render();
    sync();

    return {
      setActive: setActive,
      resize: onResize,
      dispose: function () {
        running = false;
        window.cancelAnimationFrame(rafId);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
        if (io) io.disconnect();
        doc.removeEventListener('visibilitychange', onVis);
        scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
          mats.forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
        });
        renderer.dispose();
      }
    };
  }

  /* ========================================================================
     ИНТЕГРАЦИЯ СО СТРАНИЦЕЙ lore.html
     ======================================================================== */

  /* ---------------- карта мира ---------------- */
  function setupMap(figure) {
    var d = D();
    var zoneById = {};
    ZONES.forEach(function (z) { zoneById[z.id] = z; });

    var root = el('div', 'l3d-map');
    root.hidden = true;

    var stage = el('div', 'l3d-stage');
    var canvas = doc.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    var hint = el('p', 'l3d-hint');
    var tip = el('div', 'l3d-tip');
    tip.setAttribute('aria-hidden', 'true');
    var card = el('div', 'l3d-card');
    card.setAttribute('aria-live', 'polite');
    stage.appendChild(canvas);
    stage.appendChild(hint);
    stage.appendChild(tip);
    stage.appendChild(card);

    var zonesWrap = el('div', 'l3d-zones');
    zonesWrap.setAttribute('role', 'group');
    var buttons = {};

    root.appendChild(stage);
    root.appendChild(zonesWrap);
    figure.parentNode.insertBefore(root, figure);

    var world = null;
    var current = null;

    function hexToRgba(hex, a) {
      var c = hex.replace('#', '');
      var n = parseInt(c, 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    function renderCard() {
      card.textContent = '';
      var z = current ? zoneById[current] : null;
      var color = z ? z.color : '#c9a227';
      card.style.setProperty('--zone', color);
      card.style.setProperty('--zone-glow', hexToRgba(color, 0.3));

      var lang = getLang();
      card.appendChild(el('p', 'l3d-card__tier', z ? z.tier[lang] : '8 + 1'));
      card.appendChild(el('h3', 'l3d-card__title', z ? z.title[lang] : S('overviewTitle')));
      (z ? z.text[lang] : OVERVIEW[lang]).forEach(function (p) {
        card.appendChild(el('p', 'l3d-card__text', p));
      });
      if (z && z.who) {
        var who = el('p', 'l3d-card__who');
        who.appendChild(el('b', null, S('residents') + ': '));
        who.appendChild(doc.createTextNode(z.who[lang].join(', ')));
        card.appendChild(who);
      }
      if (z) {
        var close = el('button', 'l3d-card__close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', S('close'));
        close.addEventListener('click', function () { if (world) world.select(null); });
        card.appendChild(close);
      }
    }

    function renderButtons() {
      var lang = getLang();
      zonesWrap.textContent = '';
      zonesWrap.setAttribute('aria-label', S('zones'));
      buttons = {};

      var overview = el('button', 'l3d-zone');
      overview.type = 'button';
      overview.style.setProperty('--zone', '#c9a227');
      overview.style.setProperty('--zone-glow', 'rgba(201,162,39,.3)');
      overview.setAttribute('aria-pressed', current ? 'false' : 'true');
      overview.appendChild(el('span', 'l3d-zone__dot'));
      overview.appendChild(el('span', 'l3d-zone__num', '0'));
      overview.appendChild(doc.createTextNode(S('overview')));
      overview.addEventListener('click', function () { if (world) world.select(null); });
      zonesWrap.appendChild(overview);
      buttons.__overview = overview;

      ZONES.forEach(function (z, i) {
        var b = el('button', 'l3d-zone');
        b.type = 'button';
        b.style.setProperty('--zone', z.color);
        b.style.setProperty('--zone-glow', hexToRgba(z.color, 0.35));
        b.setAttribute('aria-pressed', current === z.id ? 'true' : 'false');
        b.appendChild(el('span', 'l3d-zone__dot'));
        b.appendChild(el('span', 'l3d-zone__num', String(i + 1)));
        b.appendChild(doc.createTextNode(z.title[lang]));
        b.addEventListener('click', function () { if (world) world.select(z.id); });
        zonesWrap.appendChild(b);
        buttons[z.id] = b;
      });
    }

    function refreshText() {
      hint.textContent = S('hint');
      canvas.setAttribute('aria-label', S('mapAria'));
      renderCard();
      renderButtons();
    }

    function hideHint() { hint.classList.add('is-hidden'); }

    refreshText();
    doc.addEventListener('gildspine:languagechange', refreshText);

    loadThree().then(function (THREE) {
      root.hidden = false; // контейнер должен иметь размер до создания контекста
      world = createWorld(THREE, canvas, stage, {
        onSelect: function (id) {
          current = id;
          renderCard();
          Object.keys(buttons).forEach(function (k) {
            var active = k === '__overview' ? !id : k === id;
            buttons[k].setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          hideHint();
        },
        onInteract: hideHint,
        onHover: function (zoneId, x, y) {
          if (!zoneId) { tip.classList.remove('is-visible'); return; }
          var r = stage.getBoundingClientRect();
          tip.textContent = zoneById[zoneId].title[getLang()];
          tip.style.left = clamp(x - r.left, 8, r.width - 150) + 'px';
          tip.style.top = clamp(y - r.top, 8, r.height - 40) + 'px';
          tip.classList.add('is-visible');
        }
      });
      if (!world) throw new Error('WebGL недоступен');
      figure.style.display = 'none';
      figure.setAttribute('aria-hidden', 'true');
      GildspineLore3D.map = world;
    }).catch(function () {
      // нет WebGL / Three.js — прежняя заглушка карты остаётся на месте
      if (root.parentNode) root.parentNode.removeChild(root);
    });
  }

  /* ---------------- компас Четырёх Бездн ---------------- */
  function setupCompass(section) {
    var d = D();
    if (!d || !d.abysses || !d.abysses.length) return;
    var abysses = d.abysses.slice().sort(function (a, b) { return a.order - b.order; });

    var wrap = el('div', 'l3d-compass');
    var title = el('p', 'l3d-compass__title');
    var stage = el('div', 'l3d-compass__stage');
    var canvas = doc.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    stage.appendChild(canvas);
    var btns = el('div', 'l3d-compass__btns');
    var sub = el('p', 'l3d-compass__sub');
    sub.setAttribute('aria-live', 'polite');
    wrap.appendChild(title);
    wrap.appendChild(stage);
    wrap.appendChild(btns);
    wrap.appendChild(sub);

    var head = $('.section__head', section);
    if (head && head.parentNode) head.parentNode.insertBefore(wrap, head.nextSibling);
    else {
      var map = $('.abyss-map', section);
      if (map && map.parentNode) map.parentNode.insertBefore(wrap, map);
      else section.appendChild(wrap);
    }

    var compass = null;
    var active = null;
    var buttonEls = {};

    function abyssById(id) {
      for (var i = 0; i < abysses.length; i++) if (abysses[i].id === id) return abysses[i];
      return null;
    }

    // выбрать Бездну в основном интерфейсе lore.html (карточка включает фильтр галереи)
    function pickAbyss(id) {
      var card = $('.abyss-card[data-abyss="' + id + '"]');
      if (card && !card.classList.contains('is-active')) {
        var toggle = $('.abyss-card__toggle', card);
        if (toggle) { toggle.click(); return; }
      }
      syncFromPage(id); // карточек нет или Бездна уже выбрана
    }

    function resetAbyss() {
      var chip = $('.filter-chip[data-abyss=""]');
      if (chip) chip.click();
      else syncFromPage(null);
    }

    function render() {
      title.textContent = S('compassTitle');
      canvas.setAttribute('aria-label', S('compassAria'));
      btns.textContent = '';
      buttonEls = {};
      abysses.forEach(function (a) {
        var b = el('button', 'l3d-zone');
        b.type = 'button';
        b.style.setProperty('--zone', a.color);
        b.style.setProperty('--zone-glow', a.glow);
        b.setAttribute('aria-pressed', active === a.id ? 'true' : 'false');
        b.appendChild(el('span', 'l3d-zone__dot'));
        b.appendChild(doc.createTextNode(tr(a.name)));
        b.addEventListener('click', function () { pickAbyss(a.id); });
        btns.appendChild(b);
        buttonEls[a.id] = b;
      });
      renderSub();
    }

    function renderSub() {
      sub.textContent = '';
      var a = active ? abyssById(active) : null;
      if (!a) { sub.textContent = S('compassHint'); return; }
      var names = (d.getCharactersByAbyss ? d.getCharactersByAbyss(a.id) : []).map(function (c) { return tr(c.name); });
      sub.appendChild(doc.createTextNode(S('selected') + ': ' + tr(a.name) + (names.length ? ' — ' + names.join(', ') : '') + ' '));
      var go = el('a', null, '↓ ' + S('toGallery'));
      go.href = '#characters';
      sub.appendChild(go);
      var reset = el('button', 'l3d-card__close', '×');
      reset.type = 'button';
      reset.style.position = 'static';
      reset.style.display = 'inline-grid';
      reset.style.marginLeft = '.5rem';
      reset.style.verticalAlign = 'middle';
      reset.setAttribute('aria-label', S('all'));
      reset.addEventListener('click', resetAbyss);
      sub.appendChild(reset);
    }

    // состояние страницы → компас, кнопки и подсветка персонажей
    function applyHighlight() {
      var grid = $('#char-grid');
      if (!grid) return;
      Array.prototype.forEach.call(grid.children, function (c, i) {
        var on = !!active;
        if (c.classList.contains('l3d-hl') !== on) {
          c.classList.toggle('l3d-hl', on);
          c.style.animationDelay = on ? (i * 70) + 'ms' : '';
        }
      });
    }

    function syncFromPage(forcedId) {
      var id = forcedId;
      if (forcedId === undefined) {
        var card = $('.abyss-card.is-active');
        id = card ? card.getAttribute('data-abyss') : null;
      }
      if (id === active) { applyHighlight(); return; }
      active = id || null;
      if (compass) compass.setActive(active);
      Object.keys(buttonEls).forEach(function (k) {
        buttonEls[k].setAttribute('aria-pressed', k === active ? 'true' : 'false');
      });
      renderSub();
      applyHighlight();
    }

    render();

    if ('MutationObserver' in window) {
      var cards = $('#abyss-cards');
      if (cards) {
        new MutationObserver(function () { syncFromPage(); })
          .observe(cards, { attributes: true, subtree: true, childList: true, attributeFilter: ['class'] });
      }
      var grid = $('#char-grid');
      if (grid) new MutationObserver(applyHighlight).observe(grid, { childList: true });
    }
    doc.addEventListener('gildspine:languagechange', function () { render(); });

    loadThree().then(function (THREE) {
      compass = createCompass(THREE, canvas, stage, abysses, { onPick: pickAbyss });
      if (!compass) throw new Error('WebGL недоступен');
      compass.setActive(active);
      syncFromPage();
    }).catch(function () {
      // без 3D остаются кнопки: компас-канвас убираем
      if (stage.parentNode) stage.parentNode.removeChild(stage);
    });

    syncFromPage();
  }

  /* ========================================================================
     ЗАПУСК
     ======================================================================== */
  var api = { version: '1.0.0', zones: ZONES.map(function (z) { return z.id; }) };
  if (window.__L3D_TEST__) {
    api.__test = {
      heightAt: heightAt, buildViews: buildViews, createWorld: createWorld, createCompass: createCompass,
      buildTerrain: buildTerrain, ZONES: ZONES
    };
  }
  window.GildspineLore3D = api;

  function init() {
    if (!D()) return;
    injectStyle();
    var map = $('#world-map');
    var abyss = $('#abysses');
    if (map) safe('карта', function () { setupMap(map); });
    if (abyss) safe('компас', function () { setupCompass(abyss); });
  }

  // lore.html рисует карточки Бездн и галерею на DOMContentLoaded — стартуем после него
  var started = false;
  function go() {
    if (started) return;
    started = true;
    init();
  }
  if (doc.readyState === 'complete') {
    window.setTimeout(go, 0);
  } else {
    doc.addEventListener('DOMContentLoaded', function () { window.setTimeout(go, 0); });
    window.addEventListener('load', go);
  }
})();
