// قبل الهوا — لقطة واحدة. السكرول بيزق الكاميرا على قضبان الدوللي من أول الاستوديو لآخره.
import * as THREE from './vendor/three.module.min.js';

const root = document.documentElement;
root.classList.add('js');
const $ = (s, el = document) => el.querySelector(s);
const shots = [...document.querySelectorAll('.shot')];
const N = shots.length;
const AIR = shots.findIndex(s => s.id === 'onair');
const POST = shots.findIndex(s => s.id === 'bts');
const mqNarrow = matchMedia('(max-aspect-ratio:9/10),(max-width:820px)');
const mqCalm = matchMedia('(prefers-reduced-motion:reduce)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);

/* ---------- واجهة الصفحة: تشتغل حتى من غير WebGL ---------- */
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.parentElement.classList.add('seen')), { threshold: .12 });
shots.forEach(s => io.observe($('.copy', s)));

const runDlg = $('#runDlg'), reelDlg = $('#reelDlg'), reel = $('#reel');
$('#runBtn').addEventListener('click', () => runDlg.showModal());
runDlg.addEventListener('click', e => { if (e.target === runDlg || e.target.closest('a')) runDlg.close(); });
$('#reelBtn').addEventListener('click', () => { reelDlg.showModal(); reel.play().catch(() => {}); });
reelDlg.addEventListener('close', () => reel.pause());
reelDlg.addEventListener('click', e => { if (e.target === reelDlg) reelDlg.close(); });

// خريطة السكرول: كل لقطة ليها "وقفة" الكاميرا بتثبت فيها، وبين الوقفتين حركة.
let hs = [], he = [], vh = innerHeight, narrow = mqNarrow.matches;
function measure() {
  vh = innerHeight; narrow = mqNarrow.matches;
  const T = shots.map(s => s.getBoundingClientRect().top + scrollY), H = shots.map(s => s.offsetHeight);
  hs = T.map((t, i) => i ? t - (narrow ? .12 : .3) * vh : -1e9);
  he = T.map((t, i) => i === N - 1 ? 1e9 : Math.max(hs[i], narrow ? T[i + 1] - vh : t + H[i] - .8 * vh));
}
function mapScroll(y) {
  for (let i = N - 1; i >= 0; i--) if (y >= hs[i]) {
    if (y <= he[i]) return i;
    return i + smooth(clamp((y - he[i]) / (hs[i + 1] - he[i])));
  }
  return 0;
}

const stateTxt = $('#stateTxt'), tc = $('#tc'), cue = $('#cue'), cueTxt = $('#cueTxt');
const runLinks = [...runDlg.querySelectorAll('a')];
let active = -1, act = '', lastTc = '', airMs = 0;
const two = n => String(n).padStart(2, '0');
function hud(u, y, dt) {
  const idx = clamp(Math.round(u), 0, N - 1);
  const a = idx < AIR ? 'pre' : idx < POST ? 'air' : 'post';
  if (a !== act) {
    act = a; root.dataset.act = a;
    stateTxt.textContent = a === 'pre' ? 'قبل الهوا' : a === 'air' ? 'على الهوا' : 'بعد الهوا';
  }
  if (a === 'air') airMs += dt;
  const s = Math.floor(airMs / 1000);
  const t = a === 'pre' ? '00:' + two(Math.max(1, Math.ceil(10 * (1 - clamp(y / hs[AIR])))))
    : a === 'air' ? two(Math.floor(s / 60)) + ':' + two(s % 60) : '';
  if (t !== lastTc) tc.textContent = lastTc = t;
  if (idx !== active) {
    active = idx;
    const last = idx === N - 1;
    cueTxt.textContent = last ? 'من الأول' : shots[idx + 1].dataset.name;
    cue.hidden = false;
    runLinks.forEach((l, i) => i === idx ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current'));
  }
}
function goTo(i) {
  const top = i <= 0 ? 0 : shots[i].getBoundingClientRect().top + scrollY;
  scrollTo({ top, behavior: mqCalm.matches ? 'auto' : 'smooth' });
}
cue.addEventListener('click', () => goTo(active === N - 1 ? 0 : active + 1));

measure();
new ResizeObserver(measure).observe(document.body);
addEventListener('resize', measure);

/* ---------- الاستوديو ---------- */
let gl = null;
try { gl = initStage(); } catch (e) { console.warn('3D off:', e); }
if (!gl) {
  root.classList.add('no-gl');
  const tick = () => { hud(mapScroll(scrollY), scrollY, 16); };
  addEventListener('scroll', tick, { passive: true }); tick();
  requestAnimationFrame(measure);
}

function initStage() {
  const canvas = $('#stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const BG = new THREE.Color(0x070606);
  renderer.setClearColor(BG);
  const scene = new THREE.Scene();
  const FOG = [7, 28];
  scene.fog = new THREE.Fog(BG, FOG[0], FOG[1]);
  const FOV = 42, CAMY = 1.55, D = 16, SW = 3.4;
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 90);
  const VIS = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  // مسار الدوللي
  const base = i => new THREE.Vector3(Math.sin(i * 1.1) * .9, 0, -i * D);
  const pts = []; for (let i = -1; i <= N; i++) pts.push(base(i));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .5);
  const at = (u, v = new THREE.Vector3()) => curve.getPoint(clamp((u + 1) / (N + 1)), v);

  const dark = new THREE.MeshBasicMaterial({ color: 0x1d1a17 });
  const tieM = new THREE.MeshBasicMaterial({ color: 0x14110f });
  const steel = new THREE.MeshBasicMaterial({ color: 0x4b453d });

  // القضبان والفلنكات
  {
    const SEG = N * 22, L = [], R = [], up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), tg = new THREE.Vector3(), nx = new THREE.Vector3();
    const dummy = new THREE.Object3D();
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, .04, .2), tieM, SEG);
    for (let k = 0; k < SEG; k++) {
      const t = k / (SEG - 1);
      curve.getPoint(t, p); curve.getTangent(t, tg); nx.crossVectors(tg, up).normalize();
      L.push(p.clone().addScaledVector(nx, -.6).setY(.07)); R.push(p.clone().addScaledVector(nx, .6).setY(.07));
      dummy.position.copy(p).setY(.02); dummy.rotation.y = Math.atan2(tg.x, tg.z); dummy.updateMatrix();
      ties.setMatrixAt(k, dummy.matrix);
    }
    scene.add(ties);
    for (const side of [L, R]) scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side), SEG, .028, 5), steel));
  }

  // خامة الشاشة: صورة + حواف مدورة + ضباب + انعكاس على الأرض
  const blank = new THREE.DataTexture(new Uint8Array([10, 9, 9, 255]), 1, 1); blank.needsUpdate = true;
  const VS = 'varying vec2 vUv;varying float vD;void main(){vUv=uv;vec4 m=modelViewMatrix*vec4(position,1.);vD=-m.z;gl_Position=projectionMatrix*m;}';
  const FS = `uniform sampler2D map;uniform float uGain,uRefl,uAsp;uniform vec2 uRep,uOff,uFog;uniform vec3 uBg;varying vec2 vUv;varying float vD;
void main(){vec2 h=vec2(uAsp,1.)*.5;vec2 p=(vUv-.5)*vec2(uAsp,1.);float r=length(max(abs(p)-h+.04,0.))-.04;if(r>0.)discard;
vec3 c=texture2D(map,vUv*uRep+uOff).rgb*uGain;float f=smoothstep(uFog.x,uFog.y,vD);float a=1.;
if(uRefl>.5){a=pow(1.-vUv.y,2.6)*.34*(1.-f);}
gl_FragColor=vec4(mix(c,uBg,f),a);
#include <colorspace_fragment>
}`;
  const mats = [];
  function screenMat(asp, refl) {
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: blank }, uGain: { value: 0 }, uRefl: { value: refl ? 1 : 0 }, uAsp: { value: asp }, uRep: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uFog: { value: new THREE.Vector2(...FOG) }, uBg: { value: BG } },
      vertexShader: VS, fragmentShader: FS, transparent: !!refl, depthWrite: !refl, side: refl ? THREE.DoubleSide : THREE.FrontSide,
    });
    m.userData = { ready: 0, loaded: false, asp };
    mats.push(m); return m;
  }
  const loader = new THREE.TextureLoader();
  function cover(m, imgAsp) {
    const a = m.userData.asp, rep = m.uniforms.uRep.value, off = m.uniforms.uOff.value;
    if (imgAsp > a) { rep.set(a / imgAsp, 1); off.set((1 - rep.x) / 2, 0); } else { rep.set(1, imgAsp / a); off.set(0, (1 - rep.y) / 2); }
  }
  function feed(url, ...ms) {
    loader.load(url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      ms.forEach(m => { m.uniforms.map.value = tex; cover(m, tex.image.width / tex.image.height); m.userData.loaded = true; });
    });
  }

  const plane = new THREE.PlaneGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const poleG = new THREE.CylinderGeometry(.03, .03, 1, 8);
  const footG = new THREE.CylinderGeometry(.36, .4, .04, 28);
  const lampG = new THREE.SphereGeometry(.055, 14, 10);
  const poolG = new THREE.CircleGeometry(2.1, 40);
  const poolTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#fff'); g.addColorStop(.5, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();

  // حيطة الكواليس: 8 صور من ورا الكاميرا والريل في النص
  const WALL = ['img/sm/crew.webp', 'img/sm/multiview-night.webp', 'img/sm/desert-crew.webp', 'img/sm/operator.webp', null, 'img/sm/painter-wide.webp', 'img/sm/piano.webp', 'img/sm/night-desert.webp', 'img/sm/library-set.webp'];
  let video = null, videoMat = null, videoIdx = -1;

  const stations = shots.map((el, i) => {
    const kind = el.dataset.kind, side = el.classList.contains('flip') ? 1 : -1;
    const w = kind === 'portrait' ? 1.9 : SW, h = kind === 'portrait' ? 2.375 : SW * 9 / 16;
    const g = new THREE.Group(), own = [];
    const bez = new THREE.Mesh(box, dark); bez.scale.set(w + .12, h + .12, .07); bez.position.z = -.045; g.add(bez);
    if (kind === 'wall') {
      const tw = (w - .1) / 3, th = (h - .1) / 3;
      WALL.forEach((src, k) => {
        const m = screenMat(tw / th), t = new THREE.Mesh(plane, m);
        t.scale.set(tw, th, 1); t.position.set((k % 3 - 1) * (tw + .05), (1 - Math.floor(k / 3)) * (th + .05), 0);
        g.add(t); own.push(m);
        if (src) feed(src, m); else { videoMat = m; videoIdx = i; feed(el.dataset.img, m); }
      });
    } else {
      const m = screenMat(w / h), r = screenMat(w / h, true);
      const face = new THREE.Mesh(plane, m); face.scale.set(w, h, 1); g.add(face);
      const refl = new THREE.Mesh(plane, r); refl.scale.set(w, -h, 1); refl.renderOrder = 1; g.add(refl);
      own.push(m, r); feed(el.dataset.img, m, r);
      g.userData.refl = refl;
    }
    const pole = new THREE.Mesh(poleG, dark), foot = new THREE.Mesh(footG, dark);
    const lampM = new THREE.MeshBasicMaterial({ color: 0x3a342e, fog: false }), lamp = new THREE.Mesh(lampG, lampM);
    lamp.position.set(0, h / 2 + .13, 0);
    const poolM = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffdcae, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const pool = new THREE.Mesh(poolG, poolM); pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2;
    g.add(pole, foot, lamp, pool);
    let extra = null;
    if (el.dataset.extra) {
      const em = screenMat(.75); extra = new THREE.Mesh(plane, em); extra.scale.set(1.5, 2, 1);
      own.push(em); feed(el.dataset.extra, em); scene.add(extra);
    }
    scene.add(g);
    return { g, w, h, side, own, pole, foot, lampM, poolM, pool, extra, kind, k: 0 };
  });

  function layout() {
    const W = canvas.clientWidth || innerWidth, Hh = canvas.clientHeight || innerHeight, asp = W / Hh;
    renderer.setSize(W, Hh, false); camera.aspect = asp; camera.updateProjectionMatrix();
    const bar = parseFloat(getComputedStyle(root).getPropertyValue('--bar')) || 56;
    stations.forEach((s, i) => {
      const b = base(i);
      let d, x, cy, sc;
      if (narrow) {
        const win = $('.win', shots[i]).offsetHeight || Hh * .56;
        d = Math.max(6.5, (SW / .88) / (VIS * asp));
        const visH = VIS * d, winH = (win - bar) / Hh * visH;
        sc = Math.min(1, winH * .84 / s.h, VIS * d * asp * .9 / s.w);
        x = 0; cy = CAMY + (.5 - (win - bar) / 2 / Hh) * visH;
      } else {
        d = 6.5; const visW = VIS * d * asp;
        sc = Math.min(1, visW * .41 / s.w, VIS * d * .62 / s.h);
        x = s.side * visW * .25; cy = CAMY + .08;
      }
      s.g.position.set(b.x + x, cy, b.z - d); s.g.scale.setScalar(sc);
      s.g.rotation.y = narrow ? 0 : -s.side * .2;
      const inv = 1 / sc, floor = -cy * inv;       // مستوى الأرض جوه المجموعة
      const len = Math.max(.01, -floor - s.h / 2);
      s.pole.scale.y = len; s.pole.position.y = -s.h / 2 - len / 2;
      s.foot.position.y = floor + .02;
      s.pool.position.set(0, floor + .012, .5);
      if (s.g.userData.refl) s.g.userData.refl.position.y = 2 * floor;
      if (s.extra) {
        s.extra.visible = !narrow;
        s.extra.position.set(b.x + s.side * (VIS * d * asp * .25 + 3.1), CAMY + .55, b.z - d - 4.2);
        s.extra.rotation.y = -s.side * .32;
      }
    });
  }

  // ورق السكريبت: صفحات عليها جمل حقيقية من الشغل
  const LINES = ['الخبر مستعجل، والكلمة لازم تبقى في مكانها.', 'ليه المشاهد هيفضل معانا لحد الآخر؟', 'كل مرة بتتغير اللغة، بس الحكاية بتفضل هي اللي بتحدد إزاي تتقال.', 'مفيش زرار يعيد اللحظة لما الكلام يطلع على الهوا.', 'ضيف في الاستوديو، ومراسل في الميدان، وترند بيخبط على باب الحلقة من غير ميعاد.', 'حاولت أخلي الواقع هو اللي يتكلم.', 'اللي قدام الكاميرا بيبان.. واللي وراها بيسند الحكاية.', 'يقولون أو ما يقولون، عيالنا ذخرنا ورايتنا.'];
  function pageTex(k) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 362; const x = c.getContext('2d');
    x.fillStyle = '#e4dccd'; x.fillRect(0, 0, 256, 362);
    x.fillStyle = '#ff3b2f'; x.beginPath(); x.arc(226, 30, 6, 0, 7); x.fill();
    x.fillStyle = '#2b2622'; x.direction = 'rtl'; x.textAlign = 'right'; x.font = '500 15px "Readex Pro",sans-serif';
    let y = 72;
    for (let j = 0; j < 4; j++) {
      const words = LINES[(k * 2 + j) % LINES.length].split(' '); let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 200 && line) { x.fillText(line, 232, y); y += 25; line = w; } else line = t; }
      x.fillText(line, 232, y); y += 44;
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const papers = [], PER = 42, sheetG = new THREE.PlaneGeometry(.44, .62);
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const paperMeshes = [0, 1, 2, 3].map(k => {
    const mat = new THREE.MeshBasicMaterial({ color: 0x6e6961, side: THREE.DoubleSide });
    const m = new THREE.InstancedMesh(sheetG, mat, PER); m.frustumCulled = false; scene.add(m);
    for (let j = 0; j < PER; j++) {
      const seg = Math.floor(rnd() * (N - 1)), sd = stations[seg].side;
      let rx = (rnd() * 2 - 1) * 5.2; if (Math.abs(rx) < .75) rx = Math.sign(rx || 1) * (.75 + rnd());
      // الناحية اللي فيها الكلام: الورق يبعد لورا عشان ما يغطيش على القراية
      const uu = seg + (Math.sign(rx) === sd ? .5 + rnd() * .48 : .74 + rnd() * .24), p = at(uu);
      papers.push({ mesh: m, j, pos: new THREE.Vector3(p.x + rx, .35 + rnd() * 3.4, p.z), rot: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), sp: .15 + rnd() * .5, ph: rnd() * 6 });
    }
    return m;
  });
  (document.fonts?.load('500 15px "Readex Pro"', 'حكاية') || Promise.resolve()).then(() => paperMeshes.forEach((m, k) => { m.material.map = pageTex(k); m.material.needsUpdate = true; }));

  // تراب في النور
  {
    const n = 700, a = new Float32Array(n * 3), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) { at(rnd() * N - .5, p); a.set([p.x + (rnd() * 2 - 1) * 6, rnd() * 4.5, p.z + (rnd() * 2 - 1) * 3], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcdbfa6, size: .035, transparent: true, opacity: .55, depthWrite: false })));
  }

  layout();
  addEventListener('resize', () => { measure(); layout(); });
  mqNarrow.addEventListener('change', () => { measure(); layout(); });

  let px = 0, py = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; } }, { passive: true });

  const dummy = new THREE.Object3D(), P = new THREE.Vector3(), P2 = new THREE.Vector3(), RED = new THREE.Color(0xff3b2f), IDLE = new THREE.Color(0x3a342e);
  let u = mapScroll(scrollY), last = performance.now(), time = 0, shown = false, running = true;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(64, now - last); last = now; time += dt / 1000;
    const calm = mqCalm.matches, y = scrollY, target = mapScroll(y);
    u = calm ? target : u + (target - u) * (1 - Math.exp(-dt / 1000 * 4.2));
    const vel = target - u;
    px += (tx - px) * .05; py += (ty - py) * .05;
    hud(u, y, dt);

    at(u, P); at(u + .3, P2);
    const sway = calm ? 0 : Math.sin(time * .7) * .012;
    camera.position.set(P.x + px * .22, CAMY + sway - py * .08, P.z);
    camera.lookAt(P.x + (P2.x - P.x) * .6 + px * .7, CAMY - py * .35, P.z - 10);
    camera.rotation.z += clamp(vel, -1, 1) * -.035;

    const air = act === 'air';
    stations.forEach((s, i) => {
      const near = Math.abs(i - u);
      s.g.visible = near < 2.4; if (s.extra) s.extra.visible = !narrow && near < 2.4;
      if (!s.g.visible) return;
      const k = smooth(1 - clamp(near / .85));
      s.k = k;
      s.own.forEach(m => {
        if (m.userData.loaded && m.userData.ready < 1) m.userData.ready = Math.min(1, m.userData.ready + dt / 700);
        m.uniforms.uGain.value = (.3 + .7 * k) * m.userData.ready;
      });
      s.poolM.opacity = .04 + .22 * k;
      s.lampM.color.copy(IDLE).lerp(RED, air ? k : 0);
      if (!narrow && !calm) { s.g.rotation.y = -s.side * .2 + px * .05; s.g.rotation.x = py * -.03; }
    });
    if (!shown && stations[clamp(Math.round(u), 0, N - 1)].own[0].userData.loaded) { shown = true; root.classList.add('gl'); }

    // الريل الصامت على حيطة الكواليس
    if (videoMat && Math.abs(u - videoIdx) < 1.1 && !video && !calm) {
      video = document.createElement('video'); Object.assign(video, { src: 'vid/showreel.mp4', muted: true, loop: true, playsInline: true, preload: 'auto' });
      video.addEventListener('playing', () => { const t = new THREE.VideoTexture(video); t.colorSpace = THREE.SRGBColorSpace; videoMat.uniforms.map.value = t; cover(videoMat, 16 / 9); }, { once: true });
    }
    if (video) { const want = Math.abs(u - videoIdx) < .7 && !reelDlg.open; if (want && video.paused) video.play().catch(() => {}); else if (!want && !video.paused) video.pause(); }

    const flutter = calm ? 0 : time, camZ = camera.position.z;
    for (const p of papers) {
      if (Math.abs(p.pos.z - camZ) > 40) continue;
      dummy.position.set(p.pos.x, p.pos.y + Math.sin(flutter * p.sp + p.ph) * .16, p.pos.z);
      dummy.rotation.set(p.rot.x + flutter * p.sp * .5, p.rot.y + flutter * p.sp * .35, p.rot.z);
      dummy.updateMatrix(); p.mesh.setMatrixAt(p.j, dummy.matrix);
    }
    paperMeshes.forEach(m => m.instanceMatrix.needsUpdate = true);
    renderer.render(scene, camera);
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; root.classList.remove('gl'); root.classList.add('no-gl'); });
  requestAnimationFrame(frame);
  return true;
}
