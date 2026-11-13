// قبل الهوا — فيلم تفاعلي: غرفة كتابة، باب كنترول، ورق بيتقلب شاشات، وكاميرا واحدة بيحركها السكرول.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const shots = [...document.querySelectorAll('.shot')];
const N = shots.length;
const idOf = id => shots.findIndex(s => s.id === id);
const AIR = idOf('onair'), POST = idOf('bts');
const EGGS = JSON.parse(document.body.dataset.eggs || '{}');
const mqNarrow = matchMedia('(max-width:820px),(max-aspect-ratio:9/10)');
const mqCalm = matchMedia('(prefers-reduced-motion:reduce)');
const mqSide = matchMedia('(max-height:520px) and (min-aspect-ratio:13/10)');
const mqHover = matchMedia('(hover:hover) and (pointer:fine)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);

// ui = { mode:'cine'|'high', at, save, lock, toast, openReel, openSheet, isOpen, fail }
export async function start(ui) {
  const { toast, openReel, openSheet } = ui;
  const ac = new AbortController(), sig = { signal: ac.signal }, psig = { signal: ac.signal, passive: true };
  const canvas = $('#stage');
  const HIGH = ui.mode === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: HIGH ? 'high-performance' : 'default' });
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); throw new Error('webgl2'); }
  root.classList.add('gl', 'js3d');
  // الجودة بتبدأ على قد الجهاز (مش من فوق وتستنى الوقوع): 0 جودة أعلى · 1 متوازن · 2 متوازن خفيف · 3 من غير توهج · 4 جزيئات أقل
  const adaptive = !ui.lock;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 4;
  let quality = HIGH ? 0 : weak ? 2 : 1, alive = true;
  let narrow = mqNarrow.matches;
  const BG = new THREE.Color(0x060505);
  renderer.setClearColor(BG);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 14, 50);
  const FOV = 40, VIS = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 160);
  const uFog = { value: new THREE.Vector2(14, 50) }, uTime = { value: 0 };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let wakeT = performance.now(), running = false, last = wakeT, interacted = false;
  const wake = () => { wakeT = performance.now(); if (!running && alive && !document.hidden) { running = true; last = wakeT; requestAnimationFrame(frame); } };

  const loader = new THREE.TextureLoader(), texCache = new Map(), queue = []; let inflight = 0;
  function pump() {
    while (inflight < 3 && queue.length) {
      const e = queue.shift(); if (e.dead) { e.res(null); continue; }
      inflight++;
      loader.load(e.url, t => { inflight--; if (e.dead || !alive) { t.dispose(); e.res(null); } else { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = HIGH ? 4 : 2; e.tex = t; e.res(t); wake(); } pump(); },
        undefined, () => { inflight--; e.res(null); pump(); });
    }
  }
  const loadTex = url => {
    let e = texCache.get(url);
    if (!e) { e = { url, tex: null, dead: false }; e.p = new Promise(res => e.res = res); texCache.set(url, e); queue.push(e); pump(); }
    return e.p;
  };
  const dropTex = url => { const e = texCache.get(url); if (!e) return; e.dead = true; if (e.tex) e.tex.dispose(); texCache.delete(url); };
  const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  await Promise.all([document.fonts.load('700 100px "Aref Ruqaa"', 'قبل الهوا'), document.fonts.load('500 20px "Readex Pro"', 'قبل')]).catch(() => {});
  const face = await loadImg(shots[1].dataset.img);
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  /* ---------- نصوص على كانفس ---------- */
  function textTex(str, W, H, size, color, bg, font = '"Aref Ruqaa",serif', weight = 700) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
    x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    let s = size; do { x.font = `${weight} ${s}px ${font}`; s -= 6; } while (x.measureText(str).width > W * .92 && s > 24);
    x.fillText(str, W / 2, H * .54);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function wrap(x, str, maxW) {
    const out = []; let line = '';
    for (const w of str.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line); return out;
  }
  // صفحة السكريبت: هي ضهر كل شاشة.. بتتقلب وتبقى صورة
  function paperTex(head, body, asp, raw) {
    const W = 1024, H = Math.round(W / asp), c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#e9e1d2'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ff3b2f'; x.beginPath(); x.arc(W - 70, 74, 13, 0, 7); x.fill();
    x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = '#6f675b'; x.font = '500 30px "Readex Pro",sans-serif';
    x.fillText(raw ? head : 'مشهد · ' + head, W - 104, 85);
    x.fillStyle = '#1d1a16'; let size = 68; x.font = `700 ${size}px "Aref Ruqaa",serif`;
    let lines = wrap(x, body, W - 150);
    while (lines.length * size * 1.5 > H - 250 && size > 34) { size -= 6; x.font = `700 ${size}px "Aref Ruqaa",serif`; lines = wrap(x, body, W - 150); }
    let y = (H - lines.length * size * 1.5) / 2 + size * .9 + 20;
    for (const l of lines) { x.fillText(l, W - 75, y); y += size * 1.5; }
    x.fillStyle = '#8a8172'; x.font = '400 26px "Readex Pro",sans-serif'; x.textAlign = 'left'; x.fillText('إعداد وسيناريو: حجازي سعد', 70, H - 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function pageTex(k) {
    const LINES = ['الخبر مستعجل، والكلمة لازم تبقى في مكانها.', 'ليه المشاهد هيفضل معانا لحد الآخر؟', 'كل مرة بتتغير اللغة، بس الحكاية بتفضل هي اللي بتحدد إزاي تتقال.', 'مفيش زرار يعيد اللحظة لما الكلام يطلع على الهوا.', 'ضيف في الاستوديو، ومراسل في الميدان، وترند بيخبط على باب الحلقة من غير ميعاد.', 'حاولت فيها أخلي الواقع هو اللي يتكلم ويحكي للناس.', 'اللي قدام الكاميرا بيبان.. واللي وراها بيسند الحكاية.', 'يقولون أو ما يقولون، عيالنا ذخرنا ورايتنا.'];
    const c = document.createElement('canvas'); c.width = 256; c.height = 362; const x = c.getContext('2d');
    x.fillStyle = '#e6dfd0'; x.fillRect(0, 0, 256, 362);
    x.fillStyle = '#ff3b2f'; x.beginPath(); x.arc(228, 28, 5, 0, 7); x.fill();
    x.fillStyle = '#2b2622'; x.direction = 'rtl'; x.textAlign = 'right'; x.font = '500 15px "Readex Pro",sans-serif';
    let y = 70;
    for (let j = 0; j < 4; j++) { for (const l of wrap(x, LINES[(k * 3 + j) % LINES.length], 200)) { x.fillText(l, 232, y); y += 25; } y += 20; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  /* ---------- الجزيئات: «قبل الهوا» ← الوش ← تراب النور ← اللمبة الحمرا ---------- */
  const COUNT = HIGH ? 42000 : narrow ? 16000 : weak ? 18000 : 26000;
  const WA = narrow ? 2.3 : 3.5, PW = narrow ? 1.15 : 1.3, PH = PW * 1.25;
  const ORG = V(.05, 2.55, -1.15);                       // فوق المكتب، في نور الأباجورة
  const partU = { uTime, uAB: { value: 0 }, uDust: { value: 0 }, uEnd: { value: 0 }, uOff: { value: 0 }, uCam: { value: V(0, 0, 0) }, uPx: { value: 1 }, uCalm: { value: 0 }, uMouse: { value: V(99, 99, 0) }, uEndPos: { value: V(0, 0, 0) }, uOrg: { value: ORG.clone() } };
  let parts;
  {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 440; const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.direction = 'rtl'; x.font = '700 310px "Aref Ruqaa",serif'; x.fillText('قبل الهوا', 600, 300);
    const td = x.getImageData(0, 0, 1200, 440).data, pts = [];
    for (let yy = 0; yy < 440; yy += 2) for (let xx = 0; xx < 1200; xx += 2) if (td[(yy * 1200 + xx) * 4 + 3] > 130) pts.push(xx, yy);
    const fc = document.createElement('canvas'); fc.width = 160; fc.height = 200; const fx = fc.getContext('2d', { willReadFrequently: true });
    fx.drawImage(face, 0, 0, 160, 200); const fd = fx.getImageData(0, 0, 160, 200).data;
    const A = new Float32Array(COUNT * 3), B = new Float32Array(COUNT * 3), C = new Float32Array(COUNT * 3), R = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++) {
      const k = Math.floor(rnd() * (pts.length / 2)) * 2;
      A.set([(pts[k] + rnd() * 2 - 600) / 1200 * WA, -(pts[k + 1] + rnd() * 2 - 220) / 1200 * WA, (rnd() - .5) * .12], i * 3);
      let px = 0, py = 0, lum = 0, o = 0;
      for (let t = 0; t < 40; t++) { px = rnd() * 160; py = rnd() * 200; o = ((py | 0) * 160 + (px | 0)) * 4; lum = (fd[o] + fd[o + 1] + fd[o + 2]) / 765; if (rnd() < lum * 1.7 + .012) break; }
      B.set([(px / 160 - .5) * PW, -(py / 200 - .5) * PH, lum * .34 - .1], i * 3);
      C.set([fd[o] / 255 * 1.25 + .03, fd[o + 1] / 255 * 1.25 + .03, fd[o + 2] / 255 * 1.25 + .03], i * 3);
      R.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(A, 3)); g.setAttribute('aB', new THREE.BufferAttribute(B, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(C, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(R, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: partU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aB,aCol;attribute vec4 aRnd;uniform float uTime,uAB,uDust,uEnd,uOff,uPx,uCalm;uniform vec3 uMouse,uEndPos,uCam,uOrg;varying vec3 vCol;varying float vA;
float ez(float t){return t*t*(3.-2.*t);}
void main(){
float tAB=ez(clamp(uAB*1.5-aRnd.x*.5,0.,1.)),tD=ez(clamp(uDust*1.6-aRnd.y*.6,0.,1.)),tE=ez(clamp(uEnd*1.5-aRnd.z*.5,0.,1.));
vec3 w=vec3(sin(aRnd.w*40.+uTime*.9),cos(aRnd.x*37.+uTime*.7),sin(aRnd.y*29.+uTime*.8));
vec3 p=uOrg+mix(position,aB,tAB);
p+=w*sin(3.1416*tAB)*.55;p+=w*.006*(1.-uCalm);
vec2 dm=p.xy-uMouse.xy;float dl=length(dm);float push=smoothstep(.5,0.,dl)*(1.-tD);p.xy+=dm/(dl+.001)*push*.2;p.z+=push*.25;
float L=80.;vec3 d=vec3(uCam.x+(aRnd.x*2.-1.)*17.,uCam.y*.5+(aRnd.y*2.-1.)*7.+sin(uTime*.25+aRnd.w*30.)*.35*(1.-uCalm),0.);
d.x+=sin(uTime*.18+aRnd.z*50.)*.4*(1.-uCalm);d.z=uCam.z+mod(-aRnd.z*L-uCam.z,L)-L+7.;
p=mix(p,d,tD);p+=w*sin(3.1416*tD)*1.6;
vec3 s=normalize(aRnd.xyz-.5+.0001)*(.05+.1*aRnd.w*aRnd.w);
p=mix(p,uEndPos+s+w*.006,tE);
vec3 c=mix(vec3(1.,.9,.74),aCol,tAB);c=mix(c,vec3(.8,.72,.6),tD);c=mix(c,vec3(1.,.14,.08)*(1.-uOff*.94),tE);
float a=mix(.5,.07+.3*aRnd.w*aRnd.w,tD);a=mix(a,.5,tE);
float sz=mix(mix(.42,.5,tAB),.7+aRnd.w*1.6,tD);sz=mix(sz,.4,tE);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.,uPx*sz/-mv.z);
vCol=c;vA=a*smoothstep(.3,1.6,-mv.z)*(1.-smoothstep(46.,70.,-mv.z));}`,
      fragmentShader: 'varying vec3 vCol;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.08,d)*vA;gl_FragColor=vec4(vCol*a,a);}',
    });
    parts = new THREE.Points(g, m); parts.frustumCulled = false; parts.renderOrder = 10; scene.add(parts);
  }

  /* ---------- خامة الشاشة ---------- */
  const blank = new THREE.DataTexture(new Uint8Array([8, 7, 7, 255]), 1, 1); blank.needsUpdate = true;
  const VS = 'varying vec2 vUv;varying float vD;void main(){vUv=uv;vec4 m=modelViewMatrix*vec4(position,1.);vD=-m.z;gl_Position=projectionMatrix*m;}';
  const FS = `uniform sampler2D map;uniform float uOn,uAsp,uBoost,uHover,uTime;uniform vec2 uRep,uOff,uFog;uniform vec3 uBg;varying vec2 vUv;varying float vD;
void main(){vec2 h=vec2(uAsp,1.)*.5;vec2 p=(vUv-.5)*vec2(uAsp,1.);float r=length(max(abs(p)-h+.04,0.))-.04;if(r>0.)discard;
vec2 uv=vUv*uRep+uOff;float ca=.001+(1.-uOn)*.006;
vec3 t=vec3(texture2D(map,uv+vec2(ca,0.)).r,texture2D(map,uv).g,texture2D(map,uv-vec2(ca,0.)).b);
float scan=1.-.025*sin(vUv.y*480.+uTime*2.);
vec3 c=mix(t*.08,t*scan*uBoost*(1.+.15*uHover),smoothstep(0.,1.,uOn));
c*=1.-.12*smoothstep(.4,.8,length(vUv-.5));
float f=smoothstep(uFog.x,uFog.y,vD);gl_FragColor=vec4(mix(c,uBg,f),1.);
#include <colorspace_fragment>
}`;
  function screenMat(asp, boost = 1) {
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: blank }, uOn: { value: 0 }, uAsp: { value: asp }, uBoost: { value: boost }, uHover: { value: 0 }, uTime, uRep: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uFog, uBg: { value: BG } }, vertexShader: VS, fragmentShader: FS });
    m.userData.asp = asp; return m;
  }
  function cover(m, imgAsp) {
    const a = m.userData.asp, rep = m.uniforms.uRep.value, off = m.uniforms.uOff.value;
    if (imgAsp > a) { rep.set(a / imgAsp, 1); off.set((1 - rep.x) / 2, 0); } else { rep.set(1, imgAsp / a); off.set(0, (1 - rep.y) / 2); }
  }
  const setTex = (m, t) => { if (!t) return; m.uniforms.map.value = t; m.userData.t0 = performance.now(); cover(m, t.image.width / t.image.height); };
  const lit = m => m.uniforms.map.value === blank ? 0 : clamp((performance.now() - (m.userData.t0 || 0)) / 500);
  const plane = new THREE.PlaneGeometry(1, 1), box = new THREE.BoxGeometry(1, 1, 1);
  const bodyM = new THREE.MeshBasicMaterial({ color: 0x0e0c0b }), bodyFar = new THREE.MeshBasicMaterial({ color: 0x0a0908 });

  // فيديوهات قصيرة حقيقية من مواقع التصوير: بتتحمل لما تقرب منها وبتشتغل صامتة
  const vids = [], users = new Map();
  // need: المحطة بتسجل اللي محتاجاه.. والتحميل الفعلي بيحصل لما الكاميرا تقرب (ensure) وبيتشال لما تبعد (release)
  function need(s, m, src, fit, fail) {
    const isVid = src.startsWith('vid:'), url = isVid ? `vid/${src.slice(4)}.webp` : src;
    s.needs.push({ m, url, fit, fail });
    if (isVid) vids.push({ m, src: `vid/${src.slice(4)}.mp4`, poster: url, owner: () => s.i, st: s });
  }
  function ensure(s) {
    if (s.loaded || !s.needs) return; s.loaded = true;
    for (const n of s.needs) {
      if (!users.has(n.url)) users.set(n.url, new Set()); users.get(n.url).add(s.i);
      loadTex(n.url).then(t => { if (!s.loaded || !alive) return; if (t) { n.fit && n.fit(t); setTex(n.m, t); } else n.fail && n.fail(); });
    }
  }
  function release(s) {
    if (!s.loaded) return; s.loaded = false;
    for (const v of vids) if (v.st === s) killVid(v);
    for (const n of s.needs) { n.m.uniforms.map.value = blank; const us = users.get(n.url); if (us) { us.delete(s.i); if (!us.size) { users.delete(n.url); dropTex(n.url); } } }
  }
  function killVid(v) {
    if (!v.el) return;
    v.el.pause(); v.el.removeAttribute('src'); v.el.load(); v.el = null;
    if (v.tex) { v.tex.dispose(); v.tex = null; const p = v.poster && texCache.get(v.poster)?.tex; v.m.uniforms.map.value = p || blank; if (p) cover(v.m, p.image.width / p.image.height); }
  }
  let vidsOn = 0;
  function pumpVids(u, calm) {
    vidsOn = 0;
    const off = calm || ui.save || document.hidden || !interacted;   // من غير فيديو: تقليل حركة، توفير بيانات، تبويب مخفي، أو قبل أول تفاعل
    for (const v of vids) {
      const near = Math.abs(u - v.owner());
      if (v.el && (near > 2.4 || off && near > 1)) { killVid(v); continue; }
      if (!v.el && near < .9 && !off) {
        const el = v.el = document.createElement('video'); Object.assign(el, { src: v.src, muted: true, loop: true, playsInline: true, preload: 'auto' }); el.setAttribute('playsinline', '');
        el.addEventListener('playing', () => { if (v.el !== el) return; const t = v.tex = new THREE.VideoTexture(el); t.colorSpace = THREE.SRGBColorSpace; v.m.uniforms.map.value = t; v.m.userData.t0 = 0; cover(v.m, el.videoWidth / el.videoHeight); }, { once: true });
      }
      if (!v.el) continue;
      const want = near < .6 && !ui.isOpen() && !off;
      if (want && v.el.paused) v.el.play().catch(() => {}); else if (!want && !v.el.paused) v.el.pause();
      if (want) vidsOn++;
    }
  }

  /* ---------- غرفة الكتابة ---------- */
  const room = new THREE.Group(); scene.add(room);
  const hot = [];                                           // عناصر بتتداس: {mesh, key, act}
  const SM = (c, r = .85, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: .04, ...extra });
  const put = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = room) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };
  const cyl = (a, b, h, s = 16) => new THREE.CylinderGeometry(a, b, h, s);
  const wood = SM(0x3b2a1b, .55), dark = SM(0x15120f, .8), wallM = SM(0x1b1714, .95), metal = SM(0x2a2622, .4, { metalness: .6 });
  put(new THREE.PlaneGeometry(60, 30), SM(0x17130f, .72), 0, 0, 8, -Math.PI / 2);
  const WZ = -2.7, wallL = put(box, wallM, 0, 2.2, WZ), wallR = put(box, wallM, 0, 2.2, WZ), lintel = put(box, wallM, 0, 4, WZ);
  const doorGlow = put(plane, new THREE.MeshBasicMaterial({ color: 0xffb873, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0, 1.2, WZ - .25);
  const doorLeaf = new THREE.Group(); room.add(doorLeaf); put(box, SM(0x241c15, .6), .5, 1.15, 0, 0, 0, 0, doorLeaf).scale.set(1, 2.3, .05);
  const doorLight = new THREE.PointLight(0xffa35c, 22, 10, 1.7); room.add(doorLight);
  const signM = new THREE.MeshBasicMaterial({ map: textTex('على الهوا', 512, 160, 110, '#ff3b2f', '#170605'), fog: false, color: 0x4a2a26 });
  const sign = put(plane, signM, 0, 2.75, WZ + .08); sign.scale.set(.85, .27, 1);
  // المكتب
  put(box, wood, 0, .76, 0).scale.set(2.5, .07, 1.05);
  for (const [x, z] of [[-1.17, -.45], [1.17, -.45], [-1.17, .45], [1.17, .45]]) put(box, wood, x, .37, z).scale.set(.07, .74, .07);
  put(box, wood, 0, .47, -.48).scale.set(2.36, .5, .03);
  // الكرسي الفاضي
  put(box, dark, .1, .5, -1.05).scale.set(.52, .07, .5); put(box, dark, .1, .95, -1.3).scale.set(.52, .7, .07); put(cyl(.03, .03, .5), metal, .1, .25, -1.05); put(cyl(.26, .28, .04, 20), metal, .1, .02, -1.05);
  // الأباجورة
  put(cyl(.11, .13, .03, 24), metal, -.92, .81, -.22); put(cyl(.012, .012, .52), metal, -.84, 1.05, -.22, 0, 0, -.32); put(cyl(.012, .012, .36), metal, -.66, 1.34, -.22, 0, 0, -1.25);
  const lampHead = put(new THREE.ConeGeometry(.13, .19, 24, 1, true), SM(0x8a6a3a, .35, { metalness: .7, side: THREE.DoubleSide }), -.47, 1.36, -.22, 0, 0, .9);
  const bulbM = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }); put(new THREE.SphereGeometry(.04, 12, 10), bulbM, -.44, 1.33, -.22);
  const lamp = new THREE.PointLight(0xffc27a, 26, 11, 1.6); lamp.position.set(-.4, 1.3, -.2); room.add(lamp);
  room.add(new THREE.HemisphereLight(0x8fa3b8, 0x241a12, 1.1));
  // المونيتور: بيعرض لقطة حقيقية من موقع تصوير
  const monG = new THREE.Group(); monG.position.set(.66, .8, -.2); monG.rotation.y = -.38; room.add(monG);
  put(box, metal, 0, .04, 0, 0, 0, 0, monG).scale.set(.3, .03, .2); put(box, metal, 0, .12, -.02, 0, 0, 0, monG).scale.set(.05, .16, .04); put(box, dark, 0, .44, 0, 0, 0, 0, monG).scale.set(.9, .54, .05);
  const monM = screenMat(16 / 9, 1.25); monM.uniforms.uOn.value = 1; const monScr = put(plane, monM, 0, .44, .028, 0, 0, 0, monG); monScr.scale.set(.84, .4725, 1);
  let roomAt = 0;                                            // 0 = أول الحكاية، 1 = آخرها
  loadTex('vid/crane.webp').then(t => setTex(monM, t));
  vids.push({ m: monM, src: 'vid/crane.mp4', poster: 'vid/crane.webp', owner: () => roomAt ? 99 : 0 }, { m: monM, src: 'vid/walker.mp4', poster: 'vid/crane.webp', owner: () => roomAt ? N - 1 : 99 });
  const monLight = new THREE.PointLight(0x86b8ff, 6, 5, 1.6); monLight.position.set(.4, 1.2, .5); room.add(monLight);
  // ورق السكريبت على المكتب + ورق طاير بهدوء
  const pageG = new THREE.PlaneGeometry(.21, .297), pageMs = [0, 1, 2, 3].map(k => new THREE.MeshStandardMaterial({ map: pageTex(k), roughness: .9, side: THREE.DoubleSide }));
  let topPage = null;
  for (let i = 0; i < 6; i++) topPage = put(pageG, pageMs[i % 4], -.22 + (rnd() - .5) * .1, .8 + i * .002, .16 + (rnd() - .5) * .08, -Math.PI / 2, 0, (rnd() - .5) * .7);
  put(pageG, pageMs[2], .2, .797, .3, -Math.PI / 2, 0, .5); put(pageG, pageMs[3], -.62, .797, .3, -Math.PI / 2, 0, -.3);
  const floaters = [0, 1, 2, 3, 4].map(i => { const o = put(pageG, pageMs[i % 4], -1.7 + i * .85 + rnd() * .2, 1.45 + rnd() * .8, -1.6 + rnd() * .9); o.userData = { b: o.position.clone(), p: rnd() * 6, s: .25 + rnd() * .3 }; return o; });
  // القهوة
  const cup = put(cyl(.042, .034, .09, 20), SM(0xe7dfd0, .5), -.6, .84, .06); put(cyl(.036, .036, .005, 20), SM(0x1a0f08, .3), -.6, .886, .06); put(new THREE.TorusGeometry(.028, .007, 8, 16), SM(0xe7dfd0, .5), -.648, .84, .06);
  // كاميرا الاستوديو على الترايبود
  const camG = new THREE.Group(); camG.position.set(-2.35, 0, -1.2); camG.rotation.y = .6; room.add(camG);
  for (let i = 0; i < 3; i++) { const a = i * 2.094; put(cyl(.018, .018, 1.5, 8), metal, Math.sin(a) * .28, .7, Math.cos(a) * .28, Math.cos(a) * .38, 0, -Math.sin(a) * .38, camG); }
  const camHead = put(box, dark, 0, 1.55, 0, 0, 0, 0, camG); camHead.scale.set(.5, .3, .26);
  put(cyl(.085, .1, .26, 20), metal, .36, 1.55, 0, 0, 0, Math.PI / 2, camG); put(box, dark, -.12, 1.76, 0, 0, 0, 0, camG).scale.set(.2, .12, .12);
  const camTally = new THREE.MeshBasicMaterial({ color: 0xff3b2f, fog: false }); put(new THREE.SphereGeometry(.02, 10, 8), camTally, .2, 1.73, .1, 0, 0, 0, camG);
  // صور حقيقية متعلقة على الحيطة
  [['img/sm/crew.webp', -3.3, 1.95, 1.25, .94], ['img/sm/library-set.webp', -1.75, 2.1, 1.3, .73], ['img/sm/hegazy-floor.webp', -.55, 1.95, .62, 1.1]].forEach(([src, x, y, w, h]) => {
    put(box, dark, x, y, WZ + .07).scale.set(w + .07, h + .07, .04);
    const m = new THREE.MeshStandardMaterial({ roughness: .8, color: 0xb8b0a4 }); put(plane, m, x, y, WZ + .095).scale.set(w, h, 1);
    loadTex(src).then(t => { if (t && alive) { m.map = t; m.needsUpdate = true; } });
  });
  let lampOn = true;
  hot.push({ mesh: topPage, key: 'script', act: () => goTo(idOf('documentary')) }, { mesh: monScr, key: 'monitor', act: openReel }, { mesh: camHead, key: 'camera', act: () => goTo(POST) },
    { mesh: doorGlow, key: 'door', act: () => goTo(AIR) }, { mesh: cup, key: 'coffee', act: () => toast(EGGS.coffee) },
    { mesh: lampHead, key: 'lamp', act: () => { lampOn = !lampOn; if (!lampOn) toast(EGGS.lamp); } });
  function setDoor(x) {                                      // الباب بيتحط مكان ما الكاميرا هتعدي
    const W = 60, WH = 12, dw = 1.25, dh = 2.5, lw = x - dw / 2 + W / 2, rw = W / 2 - x - dw / 2;
    wallL.scale.set(lw, WH, .12); wallL.position.set(-W / 2 + lw / 2, WH / 2, WZ); wallR.scale.set(rw, WH, .12); wallR.position.set(x + dw / 2 + rw / 2, WH / 2, WZ);
    lintel.scale.set(dw, WH - dh, .12); lintel.position.set(x, dh + (WH - dh) / 2, WZ);
    doorGlow.scale.set(dw, dh, 1); doorGlow.position.set(x, dh / 2, WZ - .3); doorLeaf.position.set(x - dw / 2, 0, WZ + .05); doorLeaf.rotation.y = -1.25;
    doorLight.position.set(x, 1.5, WZ + .5); sign.position.x = x;
  }
  setDoor(2.3);

  /* ---------- المحطات ---------- */
  const beamG = new THREE.ConeGeometry(2.7, 12, 48, 1, true);
  const beamVS = 'varying vec3 vN,vV;varying float vH;void main(){vH=uv.y;vec4 m=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-m.xyz);gl_Position=projectionMatrix*m;}';
  const beamFS = 'uniform float uK;uniform vec3 uC;varying vec3 vN,vV;varying float vH;void main(){float e=pow(abs(dot(normalize(vN),normalize(vV))),2.2);float a=e*pow(vH,1.6)*uK;gl_FragColor=vec4(uC*a,a);}';
  const SATP = [[-3.6, 1.5, -3.2], [3.8, -.2, -4.4], [-4, -1.3, -6], [3.3, 2, -7.2]];
  const REPORTS = ['أيقونات', 'أكلة الأسبوع', 'نادي السينما', 'غرائب', 'بالأرقام', 'كل يوم سؤال', 'ترانا بنظهر أقوى'];
  const st = shots.map((el, i) => ({ el, i, kind: el.dataset.kind, mood: el.dataset.mood || '', k: 0, mats: [], sats: [], hits: [], needs: [], loaded: false, M: V(0, 0, 0), C: V(0, 0, 0), T: V(0, 0, 0) }));
  const progs = st.filter(s => s.i > AIR && s.i < POST && s.mood);
  const pic = el => (narrow && !HIGH && el.dataset.imgm) || el.dataset.img;   // الموبايل بياخد نسخة 640 من نفس الصورة     // ترتيب الحلقة: البرامج التسعة بعد حيطة الكنترول

  for (const s of st) {
    const { el, kind } = s;
    if (kind === 'room') { s.w = narrow ? 2.4 : 3.6; s.h = 3.1; continue; }
    if (kind === 'me') { s.w = PW * 1.15; s.h = PH * 1.1; continue; }
    if (kind === 'end') { s.w = narrow ? 2.4 : 3.4; s.h = 2.7; continue; }
    s.w = kind === 'control' ? 5.4 : kind === 'wall' ? 5 : 4.6; s.h = s.w * 9 / 16;
    s.tint = new THREE.Color(el.dataset.tint || '#ffdcae');
    s.g = new THREE.Group(); s.pivot = new THREE.Group(); s.g.add(s.pivot); scene.add(s.g);
    const body = new THREE.Mesh(box, bodyM); body.scale.set(s.w + .14, s.h + .14, .2); body.position.z = -.11; s.pivot.add(body); s.body = body;
    if (kind === 'control' || kind === 'wall') {
      const list = kind === 'wall' ? el.dataset.wall.split(',') : progs.map(p => p.el.dataset.imgm || p.el.dataset.img);
      const tw = (s.w - .12) / 3, th = (s.h - .12) / 3;
      list.forEach((src, k) => {
        const m = screenMat(tw / th), t = new THREE.Mesh(plane, m);
        t.scale.set(tw, th, 1); t.position.set((k % 3 - 1) * (tw + .06), (1 - Math.floor(k / 3)) * (th + .06), .001); s.pivot.add(t); s.mats.push(m);
        if (kind === 'control') { need(s, m, src); s.hits.push({ mesh: t, tip: progs[k].el.dataset.name, act: () => goTo(progs[k].i), m }); }
        else if (src === 'reel') { need(s, m, el.dataset.imgm || el.dataset.img); s.hits.push({ mesh: t, tip: EGGS.monitor, act: openReel, m }); }   // الريل اختيار صريح: بوستر بس، والفيديو بيتحمل لما يتطلب
        else need(s, m, src);
      });
    } else {
      s.m = screenMat(s.w / s.h); s.mats.push(s.m);
      s.scr = new THREE.Mesh(plane, s.m); s.scr.scale.set(s.w, s.h, 1); s.pivot.add(s.scr);
      need(s, s.m, pic(el), null, () => { s.failed = true; });
      // التوقيع (في لحظات مختارة بس): ضهر الشاشة صفحة سكريبت بتتقلب وتبقى صورة
      s.flip = !!el.dataset.flip;
      if (s.flip) {
        const pm = new THREE.MeshBasicMaterial({ map: paperTex(el.dataset.paperhead || el.dataset.name, el.dataset.paper || el.dataset.name, s.w / s.h, !!el.dataset.paperhead), color: 0xc9c1b2 });
        const paper = new THREE.Mesh(plane, pm); paper.scale.set(s.w + .14, s.h + .14, 1); paper.position.z = -.215; paper.rotation.y = Math.PI; s.pivot.add(paper);
      }
      const hasSheet = !!$('.sheet', el);
      s.hits.push({ mesh: s.scr, tip: hasSheet ? 'افتح الورقة' : '', act: hasSheet ? () => openSheet(s.i) : null, m: s.m });
      if (s.mood === 'tally') {                                  // إطار البث المباشر
        s.frameM = new THREE.MeshBasicMaterial({ color: 0xff3b2f, fog: false, transparent: true, opacity: 0 });
        for (const [x, y, w, h] of [[0, s.h / 2 + .1, s.w + .26, .035], [0, -s.h / 2 - .1, s.w + .26, .035], [s.w / 2 + .11, 0, .035, s.h + .2], [-s.w / 2 - .11, 0, .035, s.h + .2]]) { const f = new THREE.Mesh(box, s.frameM); f.scale.set(w, h, .02); f.position.set(x, y, .02); s.pivot.add(f); }
      }
    }
    (el.dataset.sats || '').split(',').filter(Boolean).forEach((src, k) => {
      const g = new THREE.Group(), m = screenMat(16 / 9), b = new THREE.Mesh(box, bodyFar), scr = new THREE.Mesh(plane, m);
      b.scale.set(1.1, 1.1, .14); b.position.z = -.08; g.add(b, scr); scene.add(g);
      const sm = { g, m, p: SATP[k % 4], ph: rnd() * 6, tilt: s.mood === 'paint' ? (rnd() - .5) * .3 : 0 }; s.sats.push(sm);
      const fit = a => { const hh = a < 1 ? 2.1 : 1.5; scr.scale.set(hh * a, hh, 1); b.scale.set(hh * a + .1, hh + .1, .14); m.uniforms.uAsp.value = m.userData.asp = a; };
      fit(16 / 9);
      need(s, m, src, src.startsWith('vid:') ? null : t => fit(t.image.width / t.image.height));
    });
    if (s.mood === 'rundown') s.cards = REPORTS.map((name, k) => {  // فقرات مساء أبوظبي الحقيقية كورق عايم
      const m = new THREE.MeshBasicMaterial({ map: textTex(name, 512, 150, 78, '#1d1a16', '#e9e1d2'), color: 0xc9c1b2, transparent: true, opacity: 0 });
      const c = new THREE.Mesh(plane, m); c.scale.set(1.25, .37, 1); scene.add(c);
      const a = k / REPORTS.length * 6.283; c.userData = { o: V(Math.cos(a) * 3.9, Math.sin(a) * 2.1 + .2, -1.2 - (k % 3) * .7), ph: k }; return c;
    });
    if (s.mood === 'wave') {                                    // موجات: خطوط صوت هادية
      s.waves = [0, 1, 2].map(j => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: s.tint, transparent: true, opacity: 0, fog: false })); l.frustumCulled = false; scene.add(l); return l; });
    }
    if (s.mood === 'speed') {                                   // خطوط حركة
      const n = 70, pos = new Float32Array(n * 6), sp = new Float32Array(n * 2);
      for (let j = 0; j < n; j++) { const x = (rnd() - .5) * 22, y = (rnd() - .5) * 7, z = -1 - rnd() * 7, len = .6 + rnd() * 1.8, v = 3 + rnd() * 7; pos.set([x, y, z, x + len, y, z], j * 6); sp.set([v, v], j * 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sp, 1));
      s.speedM = new THREE.ShaderMaterial({ uniforms: { uTime, uK: { value: 0 }, uC: { value: s.tint } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'attribute float aS;uniform float uTime;void main(){vec3 p=position;p.x=mod(p.x+uTime*aS+11.,22.)-11.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
        fragmentShader: 'uniform float uK;uniform vec3 uC;void main(){gl_FragColor=vec4(uC*uK,uK);}' });
      s.speed = new THREE.LineSegments(g, s.speedM); s.speed.frustumCulled = false; scene.add(s.speed);
    }
    s.titleM = new THREE.MeshBasicMaterial({ map: textTex(el.dataset.name, 1024, 300, 210, '#fff'), color: s.tint, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    s.title = new THREE.Mesh(plane, s.titleM); scene.add(s.title);
    s.beamM = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uC: { value: s.tint } }, vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    s.beam = new THREE.Mesh(beamG, s.beamM); s.beam.renderOrder = 4; scene.add(s.beam);
    if (el.dataset.year) {                                      // آلة الزمن: السنة بتعدي جنبك في الطريق
      s.yearM = new THREE.MeshBasicMaterial({ map: textTex(el.dataset.year, 1024, 300, 230, '#fff', null, '"Readex Pro",sans-serif', 500), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      s.yearP = new THREE.Mesh(plane, s.yearM); s.yearP.scale.set(5.2, 1.52, 1); scene.add(s.yearP);
    }
  }
  const END = st[N - 1];

  // علامات أرضية الاستوديو
  {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(260, 2000), new THREE.ShaderMaterial({
      uniforms: { uCam: partU.uCam }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: 'uniform vec3 uCam;varying vec3 vW;void main(){vec2 g=abs(fract(vW.xz/3.-.5)-.5)*3.;float c=max(step(g.x,.02)*step(g.y,.24),step(g.y,.02)*step(g.x,.24));float d=distance(vW.xz,uCam.xz);float a=c*.34*(1.-smoothstep(5.,30.,d))*smoothstep(-6.,-12.,vW.z);if(a<.003)discard;gl_FragColor=vec4(vec3(.85,.78,.66)*a,a);}',
    }));
    f.rotation.x = -Math.PI / 2; f.position.set(0, -3.6, -990); f.renderOrder = 1; scene.add(f);
  }

  /* ---------- المعالجة ---------- */
  const mkRT = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality === 0 ? 4 : quality === 1 ? 2 : 0 });
  const composer = new EffectComposer(renderer, mkRT());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .34, .6, .86); composer.addPass(bloom);
  const fin = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime, uVel: { value: 0 }, uGrain: { value: .012 }, uCut: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uVel,uGrain,uCut;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.)*43758.5453);}
void main(){vec2 d=vUv-.5;float r=length(d);float ca=(.0014+uVel*.016)*r*2.;
vec3 c=vec3(0.);for(int i=0;i<4;i++){float s=1.-float(i)*uVel*.03;vec2 u=.5+d*s;c+=vec3(texture2D(tDiffuse,u+d*ca).r,texture2D(tDiffuse,u).g,texture2D(tDiffuse,u-d*ca).b);}
c*=.25;c*=1.-smoothstep(.4,.98,r)*.6;c+=vec3(1.,.86,.7)*uCut;c+=(h(gl_FragCoord.xy)-.5)*uGrain*(.15+smoothstep(0.,.4,dot(c,vec3(.33))));gl_FragColor=vec4(max(c,0.),1.);}`,
  });
  composer.addPass(fin); composer.addPass(new OutputPass());
  // ميزانية بكسلات لكل درجة: الدقة بتتحسب من مساحة الشاشة مش من رقم ثابت
  const PIX = [3.4e6, 2.1e6, 1.4e6, 1.0e6, .8e6], CAP = [2, 1.5, 1.5, 1.25, 1];
  let rtQ = quality;
  function applyQuality() {
    if ((rtQ < 2) !== (quality < 2) || (rtQ === 0) !== (quality === 0)) { composer.reset(mkRT()); }
    rtQ = quality; bloom.enabled = quality < 3;
    parts.geometry.setDrawRange(0, quality >= 4 ? Math.floor(COUNT * .5) : COUNT);
    layout();
  }

  /* ---------- التخطيط ---------- */
  let posCurve, tgtCurve, SPAN = 1000, doorU = 1.5;
  const track = $('#track');
  function layout() {
    narrow = mqNarrow.matches;
    const W = innerWidth, H = innerHeight, asp = W / H, side = mqSide.matches;
    const dpr = Math.max(.75, Math.min(devicePixelRatio || 1, CAP[quality], Math.sqrt(PIX[quality] / (W * H))));
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); composer.setPixelRatio(dpr); composer.setSize(W, H);
    camera.aspect = asp; camera.updateProjectionMatrix();
    partU.uPx.value = (narrow ? .05 : .046) * H * dpr / VIS;
    const bar = parseFloat(getComputedStyle(root).getPropertyValue('--bar')) || 60;
    // بُعد الكاميرا لكل مشهد من المساحة الفاضية فوق الكلام، وبعدين المسافات بين المحطات
    let zPrev = null, dMax = 8;
    for (const s of st) {
      const capEl = $('.cap', s.el), padB = parseFloat(getComputedStyle(s.el).paddingBottom) || 0, roomy = s.kind === 'room' || s.kind === 'end';
      capEl.classList.toggle('scrolls', capEl.scrollHeight > capEl.clientHeight + 2);
      // المساحة الفاضية للشاشة: فوق الكلام عادة، وعلى الشمال في الموبايل بالعرض
      const topY = bar + (side ? 6 : 14), botY = side ? H - 58 : Math.max(topY + 120, H - padB - capEl.offsetHeight - 22), areaH = botY - topY;
      const ff = areaH * .96 / H, wf = side ? .45 : narrow ? .96 : roomy ? .9 : .66;
      s.dd = Math.max(s.h / (ff * VIS), s.w / (wf * VIS * asp)); s.off = .5 - (topY + botY) / 2 / H;
      s.offX = side ? .245 : narrow ? 0 : roomy ? .17 : s.g ? .03 : 0;
      if (roomy && !side) { s.dd = Math.max(s.h / (.74 * VIS), s.w / ((narrow ? 1.05 : .62) * VIS * asp)); s.off = narrow ? .17 : .11; }
      if (s.kind === 'room') s.M.set(0, 1.7, -.5);
      else if (s.kind === 'me') s.M.copy(ORG);
      else {
        if (s.g) s.M.set(Math.sin(s.i * .9) * 4.6, Math.sin(s.i * 1.7) * 1.3, 0);
        s.M.z = zPrev === null ? -Math.max(22, s.dd + 10) : zPrev - Math.max(18, s.dd + 10); zPrev = s.M.z;
        if (s.kind === 'end') { s.M.x = 0; s.M.y = 1.45; s.M.z -= 6; }
        dMax = Math.max(dMax, s.dd);
      }
    }
    END.R = V(0, 0, END.M.z + .5);                           // مكان الغرفة في آخر الرحلة
    for (const s of st) {
      const d = s.dd, vh = VIS * d, i = s.i;
      const side = s.kind === 'room' ? V(narrow ? -.3 : -1.1, .55, d) : s.kind === 'end' ? V(narrow ? .3 : 1.2, .5, d) : s.kind === 'me' ? V(narrow ? .15 : .5, .1, d) : V((i % 2 ? 1 : -1) * (narrow ? .3 : .9), .2, d);
      s.T.copy(s.M).add(V(s.offX * vh * asp, -s.off * vh, 0));
      s.C.copy(s.T).add(side);
      if (!s.g) continue;
      s.g.position.copy(s.M); s.g.lookAt(s.C); s.q = s.g.quaternion.clone();
      const tw = narrow ? s.w * 1.25 : s.w * 1.7;
      s.title.scale.set(tw, tw * 300 / 1024, 1); s.title.position.copy(s.M).add(V(0, s.h / 2 + tw * .11, -2.6)); s.title.lookAt(s.C);
      s.beam.position.copy(s.M).add(V(0, 4.2, -.4));
      s.sats.forEach(sm => { sm.b = V(sm.p[0] * (narrow ? .42 : 1), sm.p[1] * (narrow ? 1.5 : 1) + (narrow ? 1.2 : 0), sm.p[2]).add(s.M); sm.g.position.copy(sm.b); sm.g.lookAt(s.C); sm.g.rotateZ(sm.tilt); });
      if (s.cards) s.cards.forEach(c => { c.userData.b = V(c.userData.o.x * (narrow ? .42 : 1), c.userData.o.y * (narrow ? 1.25 : 1) + (narrow ? .8 : 0), c.userData.o.z).add(s.M); c.position.copy(c.userData.b); c.lookAt(s.C); });
      if (s.speed) { s.speed.position.copy(s.M); s.speed.quaternion.copy(s.q); }
      if (s.yearP) { const p = st[i - 1].C; s.yearP.position.set((p.x + s.C.x) / 2 + (i % 2 ? -3 : 3) * (narrow ? .3 : 1), (p.y + s.C.y) / 2 + .9, (p.z + s.C.z) / 2 - 4); s.yearP.lookAt(p.x, p.y, p.z + 6); }
    }
    scene.fog.near = dMax + 7; scene.fog.far = dMax + 44; uFog.value.set(dMax + 7, dMax + 44);
    posCurve = new THREE.CatmullRomCurve3(st.map(s => s.C), false, 'centripetal');
    tgtCurve = new THREE.CatmullRomCurve3(st.map(s => s.T), false, 'centripetal');
    // الباب بيتحط بالظبط مكان ما الكاميرا بتعدي من الحيطة
    const p = V(0, 0, 0);
    for (let k = 0; k <= 80; k++) { const uu = 1 + k / 80; posCurve.getPoint(uu / (N - 1), p); if (p.z < WZ) { setDoor(clamp(p.x, .9, 4.6)); doorU = uu; break; } }
    SPAN = Math.round(H * 1.4); track.style.height = SPAN * (N - 1) + H + 'px';
  }
  applyQuality();
  // شريط المتصفح في الموبايل بيغير الارتفاع بس: ما نعيدش الحساب عشان السكرول ما يتنططش
  let lw = innerWidth, lh = innerHeight;
  addEventListener('resize', () => { wake(); if (innerWidth === lw && Math.abs(innerHeight - lh) < 160) return; const keep = Math.round(u); lw = innerWidth; lh = innerHeight; layout(); scrollTo(0, keep * SPAN + (keep ? 2 : 0)); u = mapScroll(scrollY); }, sig);
  addEventListener('resize', () => { if (innerWidth === lw && Math.abs(innerHeight - lh) < 160) return; lw = innerWidth; lh = innerHeight; layout(); });

  const mapScroll = y => { const v = clamp(y / SPAN, 0, N - 1), i = Math.floor(v), q = clamp((v - i - .36) / .3); return i + q * q * q * (q * (q * 6 - 15) + 10); };
  const goTo = (i, instant) => scrollTo({ top: clamp(i, 0, N - 1) * SPAN + (i > 0 ? 2 : 0), behavior: instant || mqCalm.matches ? 'auto' : 'smooth' });

  /* ---------- الأزرار والروابط واللوحة ---------- */
  addEventListener('keydown', e => {
    wake();
    if (document.querySelector('dialog[open]') || e.target.closest('button,a,input,video,.cap.scrolls')) return;
    const fwd = e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === ' ', back = e.key === 'PageUp' || e.key === 'ArrowUp';
    if (fwd || back) { e.preventDefault(); goTo(clamp(Math.round(u) + (fwd ? 1 : -1), 0, N - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); } else if (e.key === 'End') { e.preventDefault(); goTo(N - 1); }
  }, sig);
  for (const ev of ['scroll', 'wheel', 'touchstart', 'pointerdown']) addEventListener(ev, () => { interacted = true; wake(); }, psig);

  const stateTxt = $('#stateTxt'), tc = $('#tc'), cue = $('#cue'), prev = $('#prev'), cueTxt = $('#cueTxt'), yearEl = $('#year'), yearN = $('#yearN'), runLinks = [...document.querySelectorAll('#runDlg a')];
  let active = -1, shown = -1, act = '', lastTc = '', stby = false;
  const two = n => String(n).padStart(2, '0');
  const RUN = 6 * 60 * 25;                                   // الرحلة كلها = 6 دقايق تايم كود على 25 إطار
  function hud(u) {
    const idx = clamp(Math.round(u), 0, N - 1), a = idx < AIR ? 'pre' : idx < POST ? 'air' : 'post';
    if (a !== act) { act = a; root.dataset.act = a; stateTxt.textContent = a === 'pre' ? 'قبل الهوا' : a === 'air' ? 'على الهوا' : 'بعد الهوا'; }
    if (!stby) { const f = Math.round(u / (N - 1) * RUN), s = Math.floor(f / 25), t = `00:${two(Math.floor(s / 60))}:${two(s % 60)}:${two(f % 25)}`; if (t !== lastTc) tc.textContent = lastTc = t; }
    if (idx !== active) {
      active = idx; cueTxt.textContent = idx === N - 1 ? 'من الأول' : shots[idx + 1].dataset.name; cue.hidden = false; prev.hidden = idx === 0;
      runLinks.forEach((l, i) => i === idx ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current'));
      if (!history.state?.sheet) history.replaceState(null, '', idx ? '#' + shots[idx].id : location.pathname + location.search);   // من غير خطوة سجل لكل سكرول
    }
    const vis = Math.abs(u - idx) < .3 ? idx : -1;
    if (vis !== shown) {
      if (shown >= 0) shots[shown].classList.remove('on'); if (vis >= 0) shots[vis].classList.add('on'); shown = vis;
      root.dataset.mood = vis >= 0 ? st[vis].mood : '';
      root.dataset.kind = vis >= 0 ? st[vis].kind : '';
      const y = vis >= 0 ? shots[vis].dataset.year : ''; if (y) yearN.textContent = y; yearEl.classList.toggle('show', !!y);
    }
  }
  cue.addEventListener('click', () => goTo(active === N - 1 ? 0 : active + 1), sig);
  prev.addEventListener('click', () => goTo(active - 1), sig);
  tc.addEventListener('click', () => { stby = !stby; tc.classList.toggle('stby', stby); if (stby) { tc.textContent = 'STBY'; lastTc = ''; toast('ستاند باي.. خد نفس.'); } wake(); }, sig);

  /* ---------- الماوس واللمس ---------- */
  let px = 0, py = 0, tx = 0, ty = 0, hoverHit = null, mx = 0, my = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9), tip = $('#tip');
  const setNdc = e => { mx = e.clientX; my = e.clientY; ndc.set(mx / innerWidth * 2 - 1, -(my / innerHeight) * 2 + 1); };
  addEventListener('pointermove', e => { setNdc(e); if (e.pointerType === 'mouse') { tx = ndc.x; ty = -ndc.y; wake(); } }, psig);
  function hitsNow() {
    const idx = clamp(Math.round(u), 0, N - 1), s = st[idx];
    if (Math.abs(u - idx) > .3) return [];
    if (s.kind === 'room' || s.kind === 'end') return hot.map(h => ({ ...h, tip: EGGS[h.key] }));
    return s.hits || [];
  }
  function pick() { ray.setFromCamera(ndc, camera); for (const h of hitsNow()) if (ray.intersectObject(h.mesh).length) return h; return null; }
  canvas.addEventListener('click', e => { setNdc(e); wake(); const h = pick(); if (!h) return; if (h.act) h.act(); else if (h.tip) toast(h.tip); }, sig);

  /* ---------- الحلقة ---------- */
  const P = V(0, 0, 0), T = V(0, 0, 0), perf = { t: 0, n: 0, slow: 0, dead: 0, skip: 40 }, lampC = new THREE.Color(0xffd9a0);
  let u = 0, time = 0, endT = 0, lampK = 1, frameN = 0, lastDraw = 0, calmWas = null;
  function frame(now) {
    if (!running || !alive) return;
    const calm = mqCalm.matches, v = clamp(scrollY / SPAN, 0, N - 1);
    const target = calm ? Math.floor(v + .5) : mapScroll(scrollY);          // تقليل الحركة: قطع مباشر بين المشاهد من غير سفر كاميرا
    const moving = Math.abs(target - u) > .0004 || now - wakeT < 1400;
    // وقف الرسم عند السكون: مع تقليل الحركة أو بعد 40 ثانية من غير تفاعل بيقف خالص، وغير كده الجو بيتحدث 24 مرة في الثانية
    if (!moving && !vidsOn && (calm || now - wakeT > 40000)) { running = false; return; }
    requestAnimationFrame(frame);
    if (!moving && now - lastDraw < (vidsOn ? 31 : 40)) return;
    const dt = Math.min(250, now - last); last = lastDraw = now; frameN++;
    if (!calm) time += dt / 1000; uTime.value = time;
    u = calm ? target : u + (target - u) * (1 - Math.exp(-dt / 1000 * 4.2));
    if (Math.abs(target - u) < .0004) u = target;
    const vel = clamp(Math.abs(target - u) * 1.6), sway = calm ? 0 : 1;
    if (calm) px = py = 0; else { px += (tx - px) * .05; py += (ty - py) * .05; }
    if (calm !== calmWas) { calmWas = calm; fin.uniforms.uGrain.value = calm ? 0 : .012; partU.uCalm.value = calm ? 1 : 0; }
    hud(u);

    // الغرفة: في أول الحكاية وفي آخرها
    const at = u > N / 2 ? 1 : 0;
    if (at !== roomAt) { roomAt = at; room.position.copy(at ? END.R : V(0, 0, 0)); partU.uEndPos.value.copy(END.R).add(V(.05, 2.5, -1.15)); }
    room.visible = u < 2.6 || u > N - 2.6;
    if (room.visible) {
      lampK += ((lampOn ? 1 : .04) - lampK) * (calm ? 1 : .08); lamp.intensity = 26 * lampK * (1 + Math.sin(time * 13) * .012 * sway); bulbM.color.copy(lampC).multiplyScalar(lampK);
      signM.color.setHex(act === 'air' || (at && endT < 3) ? 0xffffff : 0x4a2a26);
      camTally.color.setScalar(.62 + .38 * Math.sin(time * 2.2)).multiply(lampC.set(0xff3b2f)); lampC.set(0xffd9a0);
      for (const f of floaters) { const d = f.userData; f.position.y = d.b.y + Math.sin(time * d.s + d.p) * .12 * sway; f.rotation.set(Math.sin(time * d.s * .7 + d.p) * .5, time * d.s * .3 * sway + d.p, Math.cos(time * d.s * .5 + d.p) * .4); }
    }

    const t = clamp(u / (N - 1));
    posCurve.getPoint(t, P); tgtCurve.getPoint(t, T);
    const inRoom = u < .6 || u > N - 1.4, par = inRoom ? 1.7 : 1;
    camera.position.set(P.x + px * .35 * par + Math.sin(time * .5) * .04 * sway, P.y - py * .22 * par + Math.cos(time * .4) * .03 * sway, P.z);
    camera.lookAt(T.x + px * .15, T.y - py * .1, T.z);
    camera.rotation.z += (target - u) * -.035;
    partU.uCam.value.copy(camera.position);
    // الخروج من باب الكنترول: الصورة بتتغسل بنور الباب للحظة (ماتش كت بالضوء)
    fin.uniforms.uCut.value = calm ? 0 : .5 * Math.exp(-Math.pow((u - doorU) / .07, 2));

    partU.uAB.value = clamp(u); partU.uDust.value = clamp((u - 1) / .7); partU.uEnd.value = clamp(u - (N - 2));
    endT = u > N - 1.03 ? endT + dt / 1000 : 0; partU.uOff.value = calm ? (u > N - 1.03 ? 1 : 0) : smooth(clamp((endT - 3) / 2.5));
    if (u < 1.6 && mqHover.matches && !calm) { ray.setFromCamera(ndc, camera); const k = (ORG.z - ray.ray.origin.z) / ray.ray.direction.z; partU.uMouse.value.copy(ray.ray.origin).addScaledVector(ray.ray.direction, k); } else partU.uMouse.value.set(99, 99, 0);

    const settledNear = Math.abs(target - u) < 1.2;
    for (const s of st) {
      if (!s.g) continue;
      const near = Math.abs(s.i - u), vis = near < 2.3;
      // خامات المشهد الحالي والمجاور بس.. والبعيد بيتنضف من الذاكرة
      if (Math.abs(s.i - target) < 1.6 || (near < 1.6 && settledNear)) ensure(s); else if (s.loaded && near > 2.2 && Math.abs(s.i - target) > 2.2) release(s);
      s.g.visible = s.title.visible = s.beam.visible = vis; s.sats.forEach(x => x.g.visible = vis);
      if (s.yearP) s.yearP.visible = near < 1.6; if (s.speed) s.speed.visible = vis; if (s.waves) s.waves.forEach(l => l.visible = vis); if (s.cards) s.cards.forEach(c => c.visible = vis);
      if (!vis) continue;
      const k = smooth(1 - clamp(near / .9)); s.k = k;
      let on;
      if (s.flip) {                                             // الورقة بتتقلب وتبقى شاشة (ولو الصورة ما وصلتش، الورقة بتفضل)
        const flip = calm ? 1 : smooth(clamp((k - .18) / .55)) * (s.failed ? 0 : lit(s.m));
        s.pivot.rotation.y = (1 - flip) * Math.PI * (s.i % 2 ? 1 : -1);
        on = smooth(clamp((flip - .45) / .5)); s.pivot.scale.setScalar(1);
      } else {                                                  // باقي المشاهد: دخول هادي بتقريب بسيط من غير قلب
        on = smooth(clamp((k - .08) / .5)); s.pivot.rotation.y = 0; s.pivot.scale.setScalar(calm ? 1 : .94 + .06 * on);
      }
      s.mats.forEach((m, j) => { m.uniforms.uOn.value = (s.scr ? on : smooth(clamp((k - .05 - j * .05) / .4))) * lit(m); });
      s.titleM.opacity = .15 * k; s.beamM.uniforms.uK.value = .05 + .3 * k;
      s.g.position.y = s.M.y + Math.sin(time * .6 + s.i) * .07 * sway;
      s.g.quaternion.copy(s.q); s.g.rotateY(px * .12 * k); s.g.rotateX(py * .08 * k);
      s.sats.forEach((x, j) => { x.m.uniforms.uOn.value = smooth(clamp((k - .3 - j * .08) / .5)) * .92 * lit(x.m); x.g.position.y = x.b.y + Math.sin(time * .5 + x.ph) * .14 * sway; });
      if (s.frameM) s.frameM.opacity = k * (.8 + .2 * Math.sin(time * 1.6));        // إطار البث: نبض هادي من غير وميض
      if (s.speedM) s.speedM.uniforms.uK.value = .26 * k * sway;
      if (s.yearM) s.yearM.opacity = .2 * smooth(clamp(1 - Math.abs(u - (s.i - .5)) / .5));
      if (s.cards) s.cards.forEach(c => { c.material.opacity = k; c.position.y = c.userData.b.y + Math.sin(time * .45 + c.userData.ph) * .1 * sway; });
      if (s.waves && k > .02) s.waves.forEach((l, j) => {
        const a = l.geometry.attributes.position, W2 = s.w * 1.9;
        for (let n = 0; n < 160; n++) { const x = (n / 159 - .5) * W2, env = Math.exp(-x * x / (W2 * .1 * W2)); a.setXYZ(n, s.M.x + x, s.M.y - s.h / 2 - .55 - j * .16 + Math.sin(x * (2.2 + j * .7) + time * (1.1 + j * .4)) * .2 * env * k, s.M.z + .3); }
        a.needsUpdate = true; l.material.opacity = k * (.5 - j * .13);
      });
    }
    pumpVids(u, calm);

    // تلميحات العناصر: للماوس بس.. اللمس ما بيعتمدش على hover
    if (mqHover.matches && frameN % 3 === 0) {
      const h = pick();
      if (h !== hoverHit && (h?.mesh !== hoverHit?.mesh)) { hoverHit = h; canvas.style.cursor = h && (h.act || h.tip) ? 'pointer' : ''; tip.hidden = !(h && h.tip); if (h?.tip) tip.textContent = h.tip; }
      if (hoverHit?.tip) { tip.style.left = mx + 'px'; tip.style.top = my + 'px'; }
      for (const hh of hitsNow()) if (hh.m) hh.m.uniforms.uHover.value += ((hoverHit && hoverHit.mesh === hh.mesh ? 1 : 0) - hh.m.uniforms.uHover.value) * .2;
    }

    fin.uniforms.uVel.value = calm ? 0 : vel;
    const r0 = performance.now();
    composer.render();
    // جودة استباقية: بنقيس الإطارات المتتالية وقت الحركة بس، وبننزل درجة لو متوسط نافذتين ورا بعض عدى 24ms (أقل من ~42 إطار)
    if (adaptive && moving && dt < 200) {
      if (perf.skip > 0) perf.skip--;
      else {
        perf.t += Math.max(dt, performance.now() - r0); perf.n++;
        if (perf.n >= 40) {
          const avg = perf.t / perf.n; perf.t = perf.n = 0; stats.avg = avg;
          perf.slow = avg > 24 ? perf.slow + 1 : 0;
          if (perf.slow >= 2 && quality < 4) { quality++; perf.slow = 0; perf.skip = 30; applyQuality(); }
          else if (quality === 4) { perf.dead = avg > 40 ? perf.dead + 1 : 0; if (perf.dead >= 3) { ui.fail(clamp(Math.round(u), 0, N - 1), 'الجهاز تقيل على المشهد.. كمل بالقراءة الخفيفة.'); return; } }
        }
      }
    }
    stats.frames++; stats.quality = quality;
  }
  const stats = { frames: 0, quality, avg: 0, get u() { return u; }, get textures() { return renderer.info.memory.textures; }, get cached() { return texCache.size; }, get running() { return running; }, get videos() { return vids.filter(v => v.el).length; } };
  // التبويب المخفي: الرسم بيقف وكل فيديوهات المشهد بتقف.. وعند الرجوع بيشتغل القريب المناسب بس
  document.addEventListener('visibilitychange', () => { if (document.hidden) { running = false; for (const v of vids) if (v.el) v.el.pause(); } else wake(); }, sig);
  mqCalm.addEventListener('change', wake, sig);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (alive) ui.fail(clamp(Math.round(u), 0, N - 1), 'المشهد وقف.. كمل بالقراءة الخفيفة.'); }, sig);

  function stop() {                                           // خروج نضيف: من غير معالجات باقية ولا موارد GPU
    if (!alive) return; alive = running = false; ac.abort();
    for (const v of vids) killVid(v);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (m.map) m.map.dispose(); if (m.uniforms?.map?.value?.dispose) m.uniforms.map.value.dispose(); m.dispose(); } });
    for (const e of texCache.values()) { e.dead = true; if (e.tex) e.tex.dispose(); } texCache.clear(); queue.length = 0;
    composer.dispose(); renderer.dispose(); renderer.forceContextLoss();
    canvas.style.cursor = ''; tip.hidden = true; yearEl.classList.remove('show'); cue.hidden = prev.hidden = true;
  }

  if (ui.at > 0) scrollTo(0, ui.at * SPAN + 2);
  u = calmWas === null && mqCalm.matches ? Math.floor(clamp(scrollY / SPAN, 0, N - 1) + .5) : mapScroll(scrollY);
  running = true; last = performance.now(); frame(last);
  window.__scene = stats;
  return { stop, goTo, index: () => clamp(Math.round(u), 0, N - 1), stats };
}
