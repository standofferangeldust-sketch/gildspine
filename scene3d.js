/* ==========================================================================
   GILDSPINE — Stay Gold
   js/scene3d.js  ·  3D-фон Hero-блока на Three.js (r149, UMD-сборка)

   Что внутри сцены
     • золотые искры (#c9a227) летят из глубины на камеру;
     • багровые угли и тёмно-красный туман (#8b0000);
     • в центре — тёмный кристалл с золотыми гранями, оболочка-икосаэдр,
       орбитальные осколки и «кольцо частот» (эквалайзер из 64 столбиков);
     • реакция на мышь, гироскоп (Android) и скролл.

   Оптимизация
     • анимация частиц считается в вершинном шейдере (CPU почти не нагружен);
     • на мобильных меньше частиц, DPR ≤ 1.25, без антиалиасинга, 30 fps;
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

  var COLOR = {
    gold: 0xc9a227,
    goldHot: 0xf6dd86,
    blood: 0x8b0000,
    bloodBright: 0xb31212,
    ember: 0xe03a1e,
    neon: 0x7b2cbf,
    body: 0x14141f
  };

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
      ? { sparks: 220, embers: 90, haze: 9, bars: 32, shards: 4, maxDpr: 1.25, fps: 30, antialias: false }
      : { sparks: 650, embers: 260, haze: 20, bars: 64, shards: 6, maxDpr: 2, fps: 60, antialias: true };

    profile.mobile = mobile;
    profile.coarse = coarse;

    if (saver) {
      profile.sparks = Math.round(profile.sparks * 0.5);
      profile.embers = Math.round(profile.embers * 0.5);
      profile.haze = Math.max(4, Math.round(profile.haze * 0.5));
      profile.bars = Math.max(24, Math.round(profile.bars * 0.6));
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
     ТЕКСТУРА ГАЛО (радиальный градиент, рисуется на canvas)
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

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function fallback(canvas) {
    if (!canvas) return;
    canvas.style.display = 'none';
    if (canvas.parentElement) canvas.parentElement.classList.add('no-webgl');
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

    /* ---- частицы ---- */
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

    /* ---- освещение (неподвижное — грани кристалла «бегают» бликами) ---- */
    scene.add(new THREE.AmbientLight(0x222233, 0.9));

    var goldLight = new THREE.PointLight(COLOR.gold, 1.6, 0);
    goldLight.position.set(3.5, 3, 5);
    var bloodLight = new THREE.PointLight(COLOR.bloodBright, 1.8, 0);
    bloodLight.position.set(-4, -2, 3);
    var neonLight = new THREE.PointLight(COLOR.neon, 1.6, 0);
    neonLight.position.set(0, 4, -2);
    scene.add(goldLight, bloodLight, neonLight);

    /* ---- кристалл ---- */
    var crystal = new THREE.Group();
    scene.add(crystal);

    var coreGeo = new THREE.OctahedronGeometry(1, 0);
    var coreMat = new THREE.MeshStandardMaterial({
      color: COLOR.body,
      metalness: 0.55,
      roughness: 0.3,
      flatShading: true,
      emissive: 0x1a0000,
      emissiveIntensity: 0.6
    });
    var goldLineMat = new THREE.LineBasicMaterial({ color: COLOR.gold, transparent: true, opacity: 0.95 });

    var core = new THREE.Group();
    core.scale.set(0.85, 1.6, 0.85);
    core.add(new THREE.Mesh(coreGeo, coreMat));
    var coreEdgesGeo = new THREE.EdgesGeometry(coreGeo);
    core.add(new THREE.LineSegments(coreEdgesGeo, goldLineMat));
    crystal.add(core);

    // оболочка-икосаэдр (золотой каркас)
    var shellGeo = new THREE.IcosahedronGeometry(1.75, 0);
    var shellEdgesGeo = new THREE.EdgesGeometry(shellGeo);
    var shellMat = new THREE.LineBasicMaterial({ color: COLOR.gold, transparent: true, opacity: 0.22 });
    var shell = new THREE.LineSegments(shellEdgesGeo, shellMat);
    crystal.add(shell);

    // орбитальные осколки
    var shardGeo = new THREE.OctahedronGeometry(0.17, 0);
    var shardEdgesGeo = new THREE.EdgesGeometry(shardGeo);
    var shards = [];
    var shardOrbit = new THREE.Group();
    crystal.add(shardOrbit);
    for (var s = 0; s < profile.shards; s++) {
      var shard = new THREE.Group();
      shard.scale.set(1, 1.9, 1);
      shard.add(new THREE.Mesh(shardGeo, coreMat));
      shard.add(new THREE.LineSegments(shardEdgesGeo, goldLineMat));
      shardOrbit.add(shard);
      shards.push({
        obj: shard,
        angle: (s / profile.shards) * Math.PI * 2,
        radius: 2.25 + (s % 3) * 0.22,
        speed: 0.22 + (s % 3) * 0.07,
        y: (s % 2 === 0 ? 1 : -1) * (0.35 + (s % 3) * 0.3),
        phase: s * 1.3
      });
    }

    // гало за кристаллом
    var haloTex = createHaloTexture(THREE);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    halo.scale.set(10, 10, 1);
    halo.position.z = -1.5;
    crystal.add(halo);

    /* ---- кольцо частот ---- */
    var RING_R = 2.9;
    var ringTilt = new THREE.Group();
    ringTilt.rotation.set(1.1, 0, 0.25);
    crystal.add(ringTilt);
    var ringSpin = new THREE.Group();
    ringTilt.add(ringSpin);

    var torusGeo = new THREE.TorusGeometry(RING_R, 0.012, 6, 128);
    var torus = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: COLOR.gold, transparent: true, opacity: 0.75 }));
    torus.rotation.x = Math.PI / 2;
    ringSpin.add(torus);

    var torusOuterGeo = new THREE.TorusGeometry(RING_R * 1.18, 0.008, 6, 128);
    var torusOuter = new THREE.Mesh(torusOuterGeo, new THREE.MeshBasicMaterial({ color: COLOR.bloodBright, transparent: true, opacity: 0.5 }));
    torusOuter.rotation.x = Math.PI / 2;
    ringSpin.add(torusOuter);

    var barGeo = new THREE.BoxGeometry(0.035, 1, 0.035);
    var barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    var bars = new THREE.InstancedMesh(barGeo, barMat, profile.bars);
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

    var dummy = new THREE.Object3D();

    function updateBars(t) {
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
    function layout() {
      var w = Math.max(1, host.clientWidth);
      var h = Math.max(1, host.clientHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      shared.uPixelRatio.value = dpr;

      var aspect = w / h;
      camera.aspect = aspect;

      // масштаб кристалла и расстояние камеры: в портретной ориентации всё меньше и выше
      var s = aspect < 1 ? clamp(aspect * 1.25, 0.5, 1) : 1;
      var dist = Math.max(7, (3.0 * s) / (FOV_TAN * aspect));
      camera.position.z = dist;
      camera.updateProjectionMatrix();

      crystal.scale.setScalar(s);
      var halfH = FOV_TAN * dist;
      crystal.position.y = aspect < 1 ? 0.42 * halfH : 0.04 * halfH;

      shared.uSpreadX.value = clamp(aspect / 1.2, 0.45, 1);

      heroHeight = Math.max(1, host.offsetHeight);
      onScroll();
    }

    /* ---- кадр ---- */
    var time = 0;
    var tmpLookY = 0;

    function update(dt) {
      time += dt;
      shared.uTime.value = time;

      // плавное следование за курсором / гироскопом (не зависит от FPS)
      var k = 1 - Math.exp(-dt * 3.2);
      input.x += (input.tx - input.x) * k;
      input.y += (input.ty - input.y) * k;

      var pulse = 1 + 0.03 * Math.sin(time * 2.0);
      core.scale.set(0.85 * pulse, 1.6 * pulse, 0.85 * pulse);
      core.rotation.y += dt * 0.35;
      core.rotation.x = Math.sin(time * 0.3) * 0.12 + input.y * 0.3;

      crystal.rotation.y = input.x * 0.55 + input.scroll * 1.2;
      crystal.rotation.x = -input.y * 0.12;

      shell.rotation.y -= dt * 0.18;
      shell.rotation.x += dt * 0.07;

      ringSpin.rotation.y += dt * 0.16;
      ringTilt.rotation.x = 1.1 + input.y * 0.22;
      ringTilt.rotation.z = 0.25 + input.x * 0.12;

      shardOrbit.rotation.y += dt * 0.1;
      for (var i = 0; i < shards.length; i++) {
        var sh = shards[i];
        sh.angle += dt * sh.speed;
        sh.obj.position.set(
          Math.cos(sh.angle) * sh.radius,
          sh.y + Math.sin(time * 0.8 + sh.phase) * 0.15,
          Math.sin(sh.angle) * sh.radius
        );
        sh.obj.rotation.y += dt * 0.9;
        sh.obj.rotation.z += dt * 0.4;
      }

      halo.material.opacity = 0.5 + 0.1 * Math.sin(time * 1.3);

      updateBars(time);

      // параллакс камеры + уход вглубь при скролле
      var baseZ = camera.position.z;
      camera.position.x += (input.x * 0.7 - camera.position.x) * k;
      camera.position.y += (input.y * 0.45 - camera.position.y) * k;
      tmpLookY = crystal.position.y * 0.6;
      camera.lookAt(0, tmpLookY, 0);
      camera.position.z = baseZ;

      crystal.position.z = -input.scroll * 3.5;
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
