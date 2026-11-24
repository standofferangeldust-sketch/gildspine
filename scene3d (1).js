/* ==========================================================================
   GILDSPINE — Stay Gold
   js/scene3d.js  ·  3D-фон Hero-блока на Three.js (r149, UMD-сборка)

   Что внутри сцены
     • В центре — процедурная 3D-скульптура розы из античного золота (#c9a227):
       бутон из 20–26 лепестков по золотой спирали (филлотаксис), изогнутый
       стебель, чашелистики, два зазубренных листа и острые шипы (ConeGeometry).
       Металл (metalness 0.92 / roughness 0.22) переливается за счёт процедурной
       карты окружения (PMREM) и трёх точечных источников: золотого контрового
       света, багрового #8b0000 отблеска снизу и неонового рим-света.
     • Золотые искры (#c9a227) летят из глубины на камеру;
     • багровые угли и тёмно-красный туман (#8b0000);
     • тонкое «кольцо частот» вокруг бутона (отключается флагом SHOW_FREQUENCY_RING);
     • роза медленно вращается, покачивается и наклоняется за курсором мыши,
       гироскопом (Android) и скроллом.

   Оптимизация
     • анимация частиц считается в вершинном шейдере (CPU почти не нагружен);
     • весь бутон — одна геометрия (один draw call), лепестки запечены заранее;
     • на мобильных меньше частиц, лепестков и сегментов, DPR ≤ 1.25, 30 fps;
     • рендер ставится на паузу, когда Hero не виден или вкладка скрыта;
     • prefers-reduced-motion → один статичный кадр;
     • нет WebGL / не загрузился Three.js → остаётся CSS-фон Hero.

   Подключение (после three.min.js):
     <canvas id="hero-canvas" class="hero__canvas" data-scene="hero" aria-hidden="true"></canvas>
     <script src="https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js" defer></script>
     <script src="js/scene3d.js" defer></script>

   API: GildspineScene.init(canvas) → { destroy() }
   ========================================================================== */

(function () {
  'use strict';

  var SHOW_FREQUENCY_RING = true; // false — убрать кольцо-эквалайзер вокруг розы

  var COLOR = {
    gold: 0xc9a227,
    goldHot: 0xf6dd86,
    blood: 0x8b0000,
    bloodBright: 0xb31212,
    ember: 0xe03a1e,
    neon: 0x7b2cbf
  };

  var HEAD_Y = 1.0; // высота центра бутона относительно оси вращения розы

  /* ------------------------------------------------------------------------
     ПРОЦЕДУРНАЯ ГЕОМЕТРИЯ РОЗЫ (чистые функции, без Three.js)
     Лепесток — участок поверхности вращения вокруг оси розы: средняя линия
     интегрируется по углу наклона θ(u) (внутренние лепестки загибаются внутрь
     и закрывают бутон, внешние отгибаются наружу), ширина задаётся угловым
     размахом, края слегка отворачиваются и гофрируются.
     ------------------------------------------------------------------------ */
  /* @pure-start */
  var GOLDEN_ANGLE = 2.399963229728653;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  function addGrid(out, uSeg, vSeg, fn) {
    var base = out.positions.length / 3;
    var iu, iv;
    for (iu = 0; iu <= uSeg; iu++) {
      for (iv = 0; iv <= vSeg; iv++) {
        var p = fn(iu / uSeg, (iv / vSeg) * 2 - 1, iu);
        out.positions.push(p[0], p[1], p[2]);
      }
    }
    var row = vSeg + 1;
    for (iu = 0; iu < uSeg; iu++) {
      for (iv = 0; iv < vSeg; iv++) {
        var a = base + iu * row + iv;
        var b = a + 1;
        var c = a + row;
        var d = c + 1;
        out.indices.push(a, c, b, b, c, d);
      }
    }
  }

  function petalWidth(u, pointed) {
    if (pointed) return smooth(0, 0.18, u) * Math.pow(Math.max(0, 1 - u), 0.7) * 1.35;
    var base = 0.2 + 0.8 * smooth(0, 0.55, u);
    var tip = u <= 0.6 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.6) / 0.4, 2)));
    return base * tip;
  }

  function addPetal(out, o) {
    var mr = [o.r0];
    var my = [o.y0];
    var r = o.r0;
    var y = o.y0;
    var step = o.len / o.uSeg;
    for (var k = 1; k <= o.uSeg; k++) {
      var uu = (k - 0.5) / o.uSeg;
      var th = o.th0 + o.thc * Math.pow(uu, 1.6);
      r = Math.max(0.015, r + Math.sin(th) * step);
      y += Math.cos(th) * step;
      mr.push(r);
      my.push(y);
    }
    addGrid(out, o.uSeg, o.vSeg, function (u, v, iu) {
      var wp = petalWidth(u, o.pointed);
      var phi = o.az + v * o.omega * wp;
      var rr = mr[iu] + o.roll * v * v * Math.pow(u, 2.2) + o.ruffle * Math.sin(v * 7 + o.phase) * Math.pow(u, 3);
      var yy = my[iu] - o.roll * 0.6 * v * v * Math.pow(u, 2);
      return [rr * Math.sin(phi), yy, rr * Math.cos(phi)];
    });
  }

  function petalParams(i, N, uSeg, vSeg) {
    var t = N > 1 ? i / (N - 1) : 0;
    return {
      az: i * GOLDEN_ANGLE,
      r0: lerp(0.05, 0.4, Math.pow(t, 1.1)),
      y0: lerp(0.0, -0.2, t),
      len: lerp(0.95, 1.5, Math.pow(t, 0.8)),
      th0: lerp(0.06, 0.26, t),
      thc: lerp(-0.7, 0.95, smooth(0.2, 1, t)),
      omega: lerp(1.4, 0.85, t),
      roll: lerp(0.01, 0.16, smooth(0.35, 1, t)),
      ruffle: 0.03 * smooth(0.5, 1, t),
      phase: i * 1.7,
      pointed: false,
      uSeg: uSeg,
      vSeg: vSeg
    };
  }

  function roseHeadData(N, uSeg, vSeg) {
    var out = { positions: [], indices: [] };
    for (var i = 0; i < N; i++) addPetal(out, petalParams(i, N, uSeg, vSeg));
    // чашелистики: острые отогнутые вниз
    for (var s = 0; s < 5; s++) {
      addPetal(out, {
        az: s * (Math.PI * 2 / 5) + 0.3, r0: 0.28, y0: -0.2, len: 0.85,
        th0: 1.9, thc: 0.5, omega: 0.3, roll: 0, ruffle: 0, phase: s,
        pointed: true, uSeg: uSeg, vSeg: Math.max(4, vSeg >> 1)
      });
    }
    return out;
  }

  function leafData(uSeg, vSeg, o) {
    var out = { positions: [], indices: [] };
    addGrid(out, uSeg, vSeg, function (u, v) {
      var w = o.width * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.85);
      var saw = (u * o.teeth) % 1 - 0.5;
      w *= 1 + o.serr * saw * Math.abs(v);
      return [u * o.length, o.rise * u - o.droop * u * u + o.fold * Math.abs(v) * w, v * w];
    });
    return out;
  }
  /* @pure-end */

  /* ------------------------------------------------------------------------
     ПРОФИЛЬ ПРОИЗВОДИТЕЛЬНОСТИ
     ------------------------------------------------------------------------ */
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function buildProfile() {
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var mobile = coarse || window.innerWidth < 768;
    var conn = navigator.connection || {};
    var saver = !!conn.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2);

    var profile = mobile
      ? {
          sparks: 220, embers: 90, haze: 9, bars: 32, maxDpr: 1.25, fps: 30, antialias: false,
          petals: 20, uSeg: 12, vSeg: 8, thorns: 5, stemSeg: 28, stemRadial: 8, leafU: 20
        }
      : {
          sparks: 650, embers: 260, haze: 20, bars: 64, maxDpr: 2, fps: 60, antialias: true,
          petals: 26, uSeg: 18, vSeg: 12, thorns: 7, stemSeg: 48, stemRadial: 12, leafU: 32
        };

    profile.mobile = mobile;
    profile.coarse = coarse;

    if (saver) {
      profile.sparks = Math.round(profile.sparks * 0.5);
      profile.embers = Math.round(profile.embers * 0.5);
      profile.haze = Math.max(4, Math.round(profile.haze * 0.5));
      profile.bars = Math.max(24, Math.round(profile.bars * 0.6));
      profile.petals = Math.max(20, profile.petals - 4);
      profile.maxDpr = Math.min(profile.maxDpr, 1.25);
      profile.fps = Math.min(profile.fps, 30);
    }
    return profile;
  }

  /* ------------------------------------------------------------------------
     ШЕЙДЕРЫ ЧАСТИЦ
     Позиция каждой частицы вычисляется на GPU: полёт по оси Z с «заворачиванием»
     (mod), лёгкое покачивание, медленный подъём, мерцание и затухание по глубине.
     ------------------------------------------------------------------------ */
  var PARTICLE_VERT = [
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'uniform float uSize;',
    'uniform float uDepth;',
    'uniform float uRise;',
    'uniform float uHalfH;',
    'uniform float uSwing;',
    'uniform float uTwinkle;',
    'uniform float uAlpha;',
    'uniform float uHotChance;',
    'uniform float uSpreadX;',
    'uniform vec3 uColor;',
    'uniform vec3 uHot;',
    'attribute float aSpeed;',
    'attribute float aScale;',
    'attribute float aPhase;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main() {',
    '  vec3 p = position;',
    '  p.x *= uSpreadX;',
    '  float H = uHalfH;',
    '  p.y = mod(position.y + H + uTime * uRise * aScale, 2.0 * H) - H;',
    '  p.z = mod(position.z + uTime * aSpeed, uDepth) - uDepth + 4.0;',
    '  p.x += sin(uTime * 0.35 + aPhase) * uSwing;',
    '  p.y += cos(uTime * 0.28 + aPhase * 1.7) * uSwing;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  float dist = max(-mv.z, 0.001);',
    '  gl_PointSize = clamp(uSize * aScale * uPixelRatio * (12.0 / dist), 1.0, 256.0);',
    '  float nearFade = smoothstep(1.5, 5.0, dist);',
    '  float farFade = 1.0 - smoothstep(uDepth * 0.55, uDepth + 3.0, dist);',
    '  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + aPhase * 0.4) + aPhase * 6.0);',
    '  vAlpha = nearFade * farFade * mix(1.0, tw, uTwinkle) * uAlpha;',
    '  float hot = step(1.0 - uHotChance, fract(aPhase * 7.31));',
    '  vColor = mix(uColor, uHot, hot);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var PARTICLE_FRAG = [
    'uniform float uSoft;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  if (d > 1.0) discard;',
    '  float glow = pow(1.0 - d, mix(3.0, 1.2, uSoft));',
    '  gl_FragColor = vec4(vColor, glow * vAlpha);',
    '}'
  ].join('\n');

  function createParticles(THREE, cfg, shared) {
    var n = Math.max(1, cfg.count);
    var positions = new Float32Array(n * 3);
    var speeds = new Float32Array(n);
    var scales = new Float32Array(n);
    var phases = new Float32Array(n);

    for (var i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * cfg.spreadX;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * cfg.halfH;
      positions[i * 3 + 2] = Math.random() * cfg.depth;
      speeds[i] = cfg.speed[0] + Math.random() * (cfg.speed[1] - cfg.speed[0]);
      scales[i] = cfg.scale[0] + Math.random() * (cfg.scale[1] - cfg.scale[0]);
      phases[i] = Math.random() * 6.2831853;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    var material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: shared.uTime,
        uPixelRatio: shared.uPixelRatio,
        uSpreadX: shared.uSpreadX,
        uSize: { value: cfg.size },
        uDepth: { value: cfg.depth },
        uRise: { value: cfg.rise },
        uHalfH: { value: cfg.halfH },
        uSwing: { value: cfg.swing },
        uTwinkle: { value: cfg.twinkle },
        uAlpha: { value: cfg.alpha },
        uSoft: { value: cfg.soft },
        uHotChance: { value: cfg.hotChance || 0 },
        uColor: { value: new THREE.Color(cfg.color) },
        uHot: { value: new THREE.Color(cfg.hot || cfg.color) }
      },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var points = new THREE.Points(geometry, material);
    points.frustumCulled = false; // позиции меняются в шейдере — bounding sphere неверен
    return points;
  }

  /* ------------------------------------------------------------------------
     ТЕКСТУРЫ И ОКРУЖЕНИЕ
     ------------------------------------------------------------------------ */
  function createHaloTexture(THREE) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(201,162,39,0.55)');
    g.addColorStop(0.35, 'rgba(139,0,0,0.28)');
    g.addColorStop(0.7, 'rgba(123,44,191,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  /* Процедурная карта окружения для золота: тёмная студия с тёплыми софтбоксами,
     золотым и неоновым бликами и багровым светом снизу → PMREM */
  function createEnvironment(THREE, renderer, mobile) {
    try {
      var w = mobile ? 256 : 512;
      var h = w / 2;
      var c = document.createElement('canvas');
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
      spot(0.18, 0.28, 0.16, '255,236,190', 0.95); // тёплый софтбокс
      spot(0.62, 0.34, 0.2, '201,162,39', 0.8);    // золотой отсвет
      spot(0.88, 0.22, 0.14, '123,44,191', 0.7);   // неон
      spot(0.45, 0.92, 0.3, '139,0,0', 0.9);       // багровый снизу
      spot(0.05, 0.85, 0.18, '178,18,18', 0.5);

      var strip = function (x, sw, y0, sh, a) {
        var gr = g.createLinearGradient(0, y0 * h, 0, (y0 + sh) * h);
        gr.addColorStop(0, 'rgba(255,244,214,0)');
        gr.addColorStop(0.5, 'rgba(255,244,214,' + a + ')');
        gr.addColorStop(1, 'rgba(255,244,214,0)');
        g.fillStyle = gr;
        g.fillRect(x * w, y0 * h, sw * w, sh * h);
      };
      strip(0.32, 0.012, 0.18, 0.4, 0.9); // узкие «лампы» дают чёткие блики на гранях
      strip(0.74, 0.02, 0.2, 0.36, 0.75);

      var tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      var pmrem = new THREE.PMREMGenerator(renderer);
      var rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      pmrem.dispose();
      return rt;
    } catch (err) {
      return null; // без карты роза освещается только точечными источниками
    }
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function fallback(canvas) {
    if (!canvas) return;
    canvas.style.display = 'none';
    if (canvas.parentElement) canvas.parentElement.classList.add('no-webgl');
  }

  /* ------------------------------------------------------------------------
     РОЗА: сборка мешей
     ------------------------------------------------------------------------ */
  function geometryFromData(THREE, data) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    geo.setIndex(data.indices);
    geo.computeVertexNormals();
    return geo;
  }

  // изогнутый стебель с утолщением к основанию; нормали считаются явно (без шва)
  function createStem(THREE, curve, seg, radial, rTop, rBottom) {
    var frames = curve.computeFrenetFrames(seg, false);
    var pos = [];
    var nor = [];
    var idx = [];
    var i, j;

    for (i = 0; i <= seg; i++) {
      var p = curve.getPointAt(i / seg);
      var rad = lerp(rTop, rBottom, smooth(0, 1, i / seg));
      var N = frames.normals[i];
      var B = frames.binormals[i];
      for (j = 0; j <= radial; j++) {
        var a = (j / radial) * Math.PI * 2;
        var cx = Math.cos(a);
        var sx = Math.sin(a);
        var nx = N.x * cx + B.x * sx;
        var ny = N.y * cx + B.y * sx;
        var nz = N.z * cx + B.z * sx;
        pos.push(p.x + nx * rad, p.y + ny * rad, p.z + nz * rad);
        nor.push(nx, ny, nz);
      }
    }
    var row = radial + 1;
    for (i = 0; i < seg; i++) {
      for (j = 0; j < radial; j++) {
        var a0 = i * row + j;
        var b0 = a0 + 1;
        var c0 = a0 + row;
        var d0 = c0 + 1;
        idx.push(a0, c0, b0, b0, c0, d0);
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
    geo.setIndex(idx);
    return { geometry: geo, frames: frames };
  }

  function createRose(THREE, profile, envMap) {
    var goldMat = new THREE.MeshStandardMaterial({
      color: COLOR.gold,
      metalness: 0.92,
      roughness: 0.22,
      side: THREE.DoubleSide,
      envMap: envMap || null,
      envMapIntensity: 1.0
    });

    var plant = new THREE.Group();
    plant.position.y = HEAD_Y;

    /* ---- бутон: лепестки + чашелистики одной геометрией ---- */
    var head = new THREE.Mesh(
      geometryFromData(THREE, roseHeadData(profile.petals, profile.uSeg, profile.vSeg)),
      goldMat
    );
    plant.add(head);

    /* ---- завязь под бутоном ---- */
    var hipGeo = new THREE.SphereGeometry(0.3, profile.mobile ? 14 : 22, profile.mobile ? 10 : 16);
    var hip = new THREE.Mesh(hipGeo, goldMat);
    hip.scale.set(1, 0.85, 1);
    hip.position.y = -0.28;
    plant.add(hip);

    /* ---- стебель ---- */
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.28, 0),
      new THREE.Vector3(0.05, -0.8, 0.04),
      new THREE.Vector3(-0.09, -1.5, -0.05),
      new THREE.Vector3(0.12, -2.2, 0.06),
      new THREE.Vector3(0.04, -2.8, -0.03),
      new THREE.Vector3(0, -3.2, 0)
    ]);
    var R_TOP = 0.05;
    var R_BOTTOM = 0.085;
    var stem = createStem(THREE, curve, profile.stemSeg, profile.stemRadial, R_TOP, R_BOTTOM);
    plant.add(new THREE.Mesh(stem.geometry, goldMat));

    function outward(s, angle) {
      var f = stem.frames;
      var i = Math.round(s * profile.stemSeg);
      return new THREE.Vector3()
        .addScaledVector(f.normals[i], Math.cos(angle))
        .addScaledVector(f.binormals[i], Math.sin(angle))
        .normalize();
    }

    /* ---- шипы: ConeGeometry, острые, загнуты вниз ---- */
    var coneGeo = new THREE.ConeGeometry(1, 1, 10, 1);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var thornCount = profile.thorns;
    for (var k = 0; k < thornCount; k++) {
      var s = lerp(0.14, 0.9, thornCount > 1 ? k / (thornCount - 1) : 0);
      var angle = k * 2.399963229728653 + 0.4;
      var P = curve.getPointAt(s);
      var out = outward(s, angle);
      var T = stem.frames.tangents[Math.round(s * profile.stemSeg)]; // направлен вниз по стеблю
      var dir = out.clone().multiplyScalar(0.95).addScaledVector(T, 0.55).normalize();

      var rs = lerp(R_TOP, R_BOTTOM, smooth(0, 1, s));
      var len = lerp(0.28, 0.46, s);
      var baseR = lerp(0.055, 0.09, s);

      var thorn = new THREE.Mesh(coneGeo, goldMat);
      thorn.scale.set(baseR, len, baseR);
      thorn.quaternion.setFromUnitVectors(yAxis, dir);
      thorn.position.copy(P).addScaledVector(out, rs * 0.8).addScaledVector(dir, len * 0.5 - 0.02);
      plant.add(thorn);
    }

    /* ---- два заострённых зазубренных листа ---- */
    var leafPlacements = [{ s: 0.36, a: 0.6 }, { s: 0.58, a: 0.6 + Math.PI }];
    leafPlacements.forEach(function (lp) {
      var leaf = leafData(profile.leafU, 6, {
        width: 0.28, length: 1.15, teeth: 16, serr: 0.16, rise: 0.25, droop: 0.55, fold: 0.35
      });
      var geo = geometryFromData(THREE, leaf);

      var out = outward(lp.s, lp.a);
      var up = stem.frames.tangents[Math.round(lp.s * profile.stemSeg)].clone().negate();
      var X = out.clone().multiplyScalar(0.9).addScaledVector(up, 0.45).normalize();
      var Z = new THREE.Vector3().crossVectors(X, up).normalize();
      var Y = new THREE.Vector3().crossVectors(Z, X);
      var m = new THREE.Matrix4().makeBasis(X, Y, Z);
      var origin = curve.getPointAt(lp.s).addScaledVector(out, lerp(R_TOP, R_BOTTOM, smooth(0, 1, lp.s)) * 0.6);
      m.setPosition(origin);
      geo.applyMatrix4(m);
      plant.add(new THREE.Mesh(geo, goldMat));
    });

    return { plant: plant, material: goldMat };
  }

  /* ------------------------------------------------------------------------
     ИНИЦИАЛИЗАЦИЯ СЦЕНЫ
     ------------------------------------------------------------------------ */
  function init(canvas) {
    if (!canvas) return null;
    if (canvas.__gildspineScene) return canvas.__gildspineScene;

    var THREE = window.THREE;
    if (!THREE) {
      fallback(canvas);
      return null;
    }

    var profile = buildProfile();
    var reduced = prefersReducedMotion();
    var host = canvas.parentElement || document.body;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: profile.antialias,
        powerPreference: profile.mobile ? 'low-power' : 'high-performance'
      });
    } catch (err) {
      fallback(canvas);
      return null;
    }
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    camera.position.set(0, 0, 7);

    var FOV_TAN = Math.tan((55 * Math.PI / 180) / 2);

    /* ---- общие uniform-ы частиц ---- */
    var shared = {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSpreadX: { value: 1 }
    };

    /* ---- частицы (фон сохранён из прежней версии) ---- */
    var haze = createParticles(THREE, {
      count: profile.haze, color: COLOR.blood, size: 180, alpha: 0.3, soft: 1.0, twinkle: 0,
      speed: [0.25, 0.7], scale: [0.7, 1.6], depth: 60, spreadX: 26, halfH: 15, rise: 0.03, swing: 2.0
    }, shared);

    var embers = createParticles(THREE, {
      count: profile.embers, color: COLOR.bloodBright, hot: COLOR.ember, hotChance: 0.1,
      size: 7, alpha: 0.75, soft: 0.4, twinkle: 1,
      speed: [0.4, 1.2], scale: [0.5, 1.4], depth: 70, spreadX: 26, halfH: 15, rise: 0.25, swing: 1.0
    }, shared);

    var sparks = createParticles(THREE, {
      count: profile.sparks, color: COLOR.gold, hot: COLOR.goldHot, hotChance: 0.15,
      size: 5, alpha: 0.95, soft: 0.2, twinkle: 1,
      speed: [1.2, 3.2], scale: [0.5, 1.6], depth: 70, spreadX: 26, halfH: 15, rise: 0.06, swing: 0.5
    }, shared);

    scene.add(haze, embers, sparks);

    /* ---- освещение (неподвижное — блики «бегают» по лепесткам при вращении) ---- */
    scene.add(new THREE.AmbientLight(0x221a10, 0.5));

    var goldBack = new THREE.PointLight(COLOR.gold, 2.4, 0);       // золотой контровой свет
    goldBack.position.set(2.4, 3.8, -3.2);
    var goldFill = new THREE.PointLight(COLOR.gold, 0.9, 0);       // мягкий фронтальный подсвет
    goldFill.position.set(3.5, 2.2, 5);
    var bloodUnder = new THREE.PointLight(COLOR.blood, 2.4, 0);    // кроваво-красный отблеск снизу
    bloodUnder.position.set(-1.8, -3.0, 2.6);
    var neonRim = new THREE.PointLight(COLOR.neon, 1.1, 0);        // неоновый рим-свет
    neonRim.position.set(-3, 2.5, -2);
    scene.add(goldBack, goldFill, bloodUnder, neonRim);

    /* ---- карта окружения для металла ---- */
    var envRT = createEnvironment(THREE, renderer, profile.mobile);

    /* ---- роза ---- */
    var rose = new THREE.Group();        // позиция, масштаб, наклон за курсором
    scene.add(rose);
    var spin = new THREE.Group();        // медленное вращение вокруг оси
    rose.add(spin);
    var built = createRose(THREE, profile, envRT ? envRT.texture : null);
    spin.add(built.plant);

    // гало за бутоном
    var haloTex = createHaloTexture(THREE);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    halo.scale.set(10, 10, 1);
    halo.position.set(0, HEAD_Y, -1.6);
    rose.add(halo);

    /* ---- кольцо частот вокруг бутона (необязательно) ---- */
    var RING_R = 2.5;
    var ringSpin = new THREE.Group();
    var bars = null;
    var dummy = new THREE.Object3D();

    if (SHOW_FREQUENCY_RING) {
      var ringTilt = new THREE.Group();
      ringTilt.position.y = HEAD_Y;
      ringTilt.rotation.set(1.1, 0, 0.25);
      rose.add(ringTilt);
      ringTilt.add(ringSpin);

      var torus = new THREE.Mesh(
        new THREE.TorusGeometry(RING_R, 0.012, 6, 128),
        new THREE.MeshBasicMaterial({ color: COLOR.gold, transparent: true, opacity: 0.75 })
      );
      torus.rotation.x = Math.PI / 2;
      ringSpin.add(torus);

      var torusOuter = new THREE.Mesh(
        new THREE.TorusGeometry(RING_R * 1.18, 0.008, 6, 128),
        new THREE.MeshBasicMaterial({ color: COLOR.bloodBright, transparent: true, opacity: 0.5 })
      );
      torusOuter.rotation.x = Math.PI / 2;
      ringSpin.add(torusOuter);

      bars = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.035, 1, 0.035),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
        profile.bars
      );
      var colGold = new THREE.Color(COLOR.gold);
      var colBlood = new THREE.Color(COLOR.bloodBright);
      var tmpColor = new THREE.Color();
      for (var b = 0; b < profile.bars; b++) {
        var mixAmt = 0.5 + 0.5 * Math.sin((b / profile.bars) * Math.PI * 2 * 2);
        tmpColor.copy(colGold).lerp(colBlood, mixAmt * 0.85);
        bars.setColorAt(b, tmpColor);
      }
      bars.frustumCulled = false;
      ringSpin.add(bars);
    }

    function updateBars(t) {
      if (!bars) return;
      var n = profile.bars;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        var w1 = Math.sin(t * 1.7 + i * 0.55) * 0.5 + 0.5;
        var w2 = Math.sin(t * 0.8 - i * 0.23) * 0.5 + 0.5;
        var h = 0.12 + 0.75 * w1 * w2 + 0.1 * Math.sin(t * 3 + i);
        dummy.position.set(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R);
        dummy.rotation.set(0, -a, 0);
        dummy.scale.set(1, Math.max(0.05, h), 1);
        dummy.updateMatrix();
        bars.setMatrixAt(i, dummy.matrix);
      }
      bars.instanceMatrix.needsUpdate = true;
    }

    /* ---- состояние ввода ---- */
    var input = { tx: 0, ty: 0, x: 0, y: 0, scroll: 0 };
    var heroHeight = 1;
    var gyroActive = false;
    var gyroSupported = profile.coarse && 'DeviceOrientationEvent' in window &&
      typeof window.DeviceOrientationEvent.requestPermission !== 'function';
    // iOS требует системного запроса разрешения — не навязываем его, там работают касание и скролл.

    function onPointerMove(e) {
      if (gyroActive && e.pointerType === 'touch') return;
      input.tx = (e.clientX / window.innerWidth) * 2 - 1;
      input.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    }

    function onPointerLeave() {
      if (!gyroActive) {
        input.tx = 0;
        input.ty = 0;
      }
    }

    function onScroll() {
      input.scroll = clamp(window.pageYOffset / heroHeight, 0, 1);
    }

    function onOrientation(e) {
      if (e.gamma === null || e.beta === null || e.gamma === undefined) return;
      gyroActive = true;
      input.tx = clamp(e.gamma / 25, -1, 1);
      input.ty = clamp((50 - e.beta) / 25, -1, 1);
    }

    function toggleGyro(on) {
      if (!gyroSupported) return;
      if (on) window.addEventListener('deviceorientation', onOrientation, true);
      else window.removeEventListener('deviceorientation', onOrientation, true);
    }

    /* ---- размеры и адаптивная компоновка ---- */
    var baseY = 0;
    var baseScale = 1;

    function layout() {
      var w = Math.max(1, host.clientWidth);
      var h = Math.max(1, host.clientHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      shared.uPixelRatio.value = dpr;

      var aspect = w / h;
      camera.aspect = aspect;

      // масштаб розы и расстояние камеры: в портретной ориентации всё меньше и выше
      var s = aspect < 1 ? clamp(aspect * 1.25, 0.5, 1) : 1;
      var dist = Math.max(7, (2.9 * s) / (FOV_TAN * aspect));
      camera.position.z = dist;
      camera.updateProjectionMatrix();

      var halfH = FOV_TAN * dist;
      var headTarget = aspect < 1 ? 0.42 * halfH : 0.15 * halfH; // где на экране окажется бутон

      baseScale = s;
      baseY = headTarget - HEAD_Y * s;
      rose.scale.setScalar(s);
      rose.position.y = baseY;

      shared.uSpreadX.value = clamp(aspect / 1.2, 0.45, 1);

      heroHeight = Math.max(1, host.offsetHeight);
      onScroll();
    }

    /* ---- кадр ---- */
    var time = 0;

    function update(dt) {
      time += dt;
      shared.uTime.value = time;

      // плавное следование за курсором / гироскопом (не зависит от FPS)
      var k = 1 - Math.exp(-dt * 3.2);
      input.x += (input.tx - input.x) * k;
      input.y += (input.ty - input.y) * k;

      // роза: медленное вращение, покачивание и наклон за курсором
      spin.rotation.y += dt * 0.22;
      spin.rotation.z = Math.sin(time * 0.7) * 0.035;

      rose.rotation.y = input.x * 0.5 + input.scroll * 1.2;
      rose.rotation.z = -input.x * 0.24 + Math.sin(time * 0.6) * 0.045;
      rose.rotation.x = 0.14 - input.y * 0.26 + Math.sin(time * 0.5) * 0.03;
      rose.position.y = baseY + Math.sin(time * 0.9) * 0.07 * baseScale;
      rose.position.z = -input.scroll * 3.5;

      halo.material.opacity = 0.5 + 0.1 * Math.sin(time * 1.3);

      if (SHOW_FREQUENCY_RING) {
        ringSpin.rotation.y += dt * 0.16;
        updateBars(time);
      }

      // параллакс камеры
      var baseZ = camera.position.z;
      camera.position.x += (input.x * 0.7 - camera.position.x) * k;
      camera.position.y += (input.y * 0.45 - camera.position.y) * k;
      camera.lookAt(0, (baseY + HEAD_Y * baseScale) * 0.5, 0);
      camera.position.z = baseZ;

      canvas.style.opacity = String((1 - input.scroll * 0.85).toFixed(3));
    }

    function renderFrame() {
      renderer.render(scene, camera);
    }

    /* ---- цикл анимации ---- */
    var running = false;
    var rafId = 0;
    var last = 0;
    var inView = true;
    var docVisible = !document.hidden;
    var ctxLost = false;
    var minInterval = profile.fps >= 60 ? 0 : 1000 / profile.fps - 2;
    var firstFrame = true;

    function frame(now) {
      if (!running) return;
      rafId = window.requestAnimationFrame(frame);
      var elapsed = now - last;
      if (elapsed < minInterval) return;
      last = now;
      update(Math.min(elapsed / 1000, 0.1));
      renderFrame();
      if (firstFrame) {
        firstFrame = false;
        canvas.classList.add('is-ready');
      }
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      toggleGyro(true);
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      window.cancelAnimationFrame(rafId);
      toggleGyro(false);
    }

    function sync() {
      if (inView && docVisible && !ctxLost && !reduced) start();
      else stop();
    }

    /* ---- слушатели ---- */
    var ro = null;
    var io = null;

    function onResize() {
      layout();
      if (reduced || !running) {
        update(0);
        renderFrame();
      }
    }

    function onVisibility() {
      docVisible = !document.hidden;
      sync();
    }

    function onContextLost(e) {
      e.preventDefault();
      ctxLost = true;
      sync();
    }

    function onContextRestored() {
      ctxLost = false;
      sync();
    }

    layout();

    if (typeof window.ResizeObserver === 'function') {
      ro = new window.ResizeObserver(onResize);
      ro.observe(host);
    } else {
      window.addEventListener('resize', onResize);
    }

    if (typeof window.IntersectionObserver === 'function') {
      io = new window.IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0 });
      io.observe(host);
    }

    if (!reduced) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onPointerLeave);
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);

    canvas.style.opacity = '1';

    if (reduced) {
      // статичный кадр без анимации
      time = 2.5;
      spin.rotation.y = 0.6;
      update(0);
      renderFrame();
      canvas.classList.add('is-ready');
    } else {
      sync();
    }

    /* ---- завершение работы ---- */
    function destroy() {
      stop();
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onResize);
      if (io) io.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
      if (envRT) envRT.dispose();
      renderer.dispose();
      delete canvas.__gildspineScene;
    }

    var api = { destroy: destroy, renderer: renderer, scene: scene, camera: camera };
    canvas.__gildspineScene = api;
    return api;
  }

  /* ------------------------------------------------------------------------
     АВТОЗАПУСК
     ------------------------------------------------------------------------ */
  window.GildspineScene = { init: init };

  function autoInit() {
    var canvas = document.querySelector('canvas[data-scene="hero"]');
    if (canvas) init(canvas);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
