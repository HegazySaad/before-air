// قبل الهوا — المشهد هو الصفحة. السكرول بيحرك كاميرا واحدة من غير قطع.
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
const AIR = shots.findIndex(s => s.id === 'onair');
const POST = shots.findIndex(s => s.id === 'bts');
const mqNarrow = matchMedia('(max-width:820px),(max-aspect-ratio:9/10)');
const mqCalm = matchMedia('(prefers-reduced-motion:reduce)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const unboot = () => window.__unboot && window.__unboot();

/* ---------- النوافذ ---------- */
const runDlg = $('#runDlg'), reelDlg = $('#reelDlg'), reel = $('#reel'), sheetDlg = $('#sheetDlg');
const openReel = () => { reelDlg.showModal(); reel.play().catch(() => {}); };
function openSheet(i) {
  const s = shots[i], src = $('.sheet', s); if (!src) return;
  $('#sheetH').textContent = $('h2', s).textContent;
  $('#sheetMeta').textContent = $('.meta', s)?.textContent || '';
  $('#sheetBody').innerHTML = src.innerHTML;
  sheetDlg.showModal(); sheetDlg.scrollTop = 0;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-run],[data-reel],[data-sheet]'); if (!t) return;
  if (t.matches('[data-run]')) runDlg.showModal();
  else if (t.matches('[data-reel]')) openReel();
  else openSheet(shots.indexOf(t.closest('.shot')));
});
[runDlg, reelDlg, sheetDlg].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
reelDlg.addEventListener('close', () => reel.pause());

/* ---------- المشهد ---------- */
start().catch(e => { console.warn('3D off:', e); root.classList.remove('gl'); unboot(); });

async function start() {
  const canvas = $('#stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
  root.classList.add('gl');
  let narrow = mqNarrow.matches;
  const BG = new THREE.Color(0x060505);
  renderer.setClearColor(BG);
  const scene = new THREE.Scene();
  const FOV = 40, VIS = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 140);
  const uFog = { value: new THREE.Vector2(14, 50) }, uTime = { value: 0 };

  const loadN = $('#loadN'); let total = 0, done = 0;
  const tick = () => { done++; if (loadN) loadN.textContent = String(Math.round(done / total * 100)).padStart(2, '0'); };
  const loader = new THREE.TextureLoader();
  const loadTex = url => { total++; return new Promise(res => loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tick(); res(t); }, undefined, () => { tick(); res(null); })); };
  const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

  await Promise.all([document.fonts.load('700 100px "Aref Ruqaa"', 'قبل الهوا'), document.fonts.load('500 20px "Readex Pro"', 'قبل')]).catch(() => {});
  const face = await loadImg(shots[1].dataset.img);

  /* ---- الجزيئات: «قبل الهوا» ← الوش ← تراب النور ← اللمبة الحمرا ---- */
  const COUNT = narrow ? 20000 : 42000;
  const WA = narrow ? 5.4 : 9.6, PW = narrow ? 3 : 3.6, PH = PW * 1.25;
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const partU = { uTime, uAB: { value: 0 }, uDust: { value: 0 }, uEnd: { value: 0 }, uOff: { value: 0 }, uCam: { value: new THREE.Vector3() }, uPx: { value: 1 }, uCalm: { value: 0 }, uMouse: { value: new THREE.Vector3(99, 99, 0) }, uEndPos: { value: new THREE.Vector3() } };
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
      A.set([(pts[k] + rnd() * 2 - 600) / 1200 * WA, -(pts[k + 1] + rnd() * 2 - 220) / 1200 * WA, (rnd() - .5) * .3], i * 3);
      let px = 0, py = 0, lum = 0, o = 0;
      for (let t = 0; t < 40; t++) { px = rnd() * 160; py = rnd() * 200; o = ((py | 0) * 160 + (px | 0)) * 4; lum = (fd[o] + fd[o + 1] + fd[o + 2]) / 765; if (rnd() < lum * 1.7 + .012) break; }
      B.set([(px / 160 - .5) * PW, -(py / 200 - .5) * PH, lum * .9 - .3], i * 3);
      C.set([fd[o] / 255 * 1.25 + .03, fd[o + 1] / 255 * 1.25 + .03, fd[o + 2] / 255 * 1.25 + .03], i * 3);
      R.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(A, 3)); g.setAttribute('aB', new THREE.BufferAttribute(B, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(C, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(R, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: partU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aB,aCol;attribute vec4 aRnd;uniform float uTime,uAB,uDust,uEnd,uOff,uPx,uCalm;uniform vec3 uMouse,uEndPos,uCam;varying vec3 vCol;varying float vA;
float ez(float t){return t*t*(3.-2.*t);}
void main(){
float tAB=ez(clamp(uAB*1.5-aRnd.x*.5,0.,1.)),tD=ez(clamp(uDust*1.6-aRnd.y*.6,0.,1.)),tE=ez(clamp(uEnd*1.5-aRnd.z*.5,0.,1.));
vec3 p=mix(position,aB,tAB);
vec3 w=vec3(sin(aRnd.w*40.+uTime*.9),cos(aRnd.x*37.+uTime*.7),sin(aRnd.y*29.+uTime*.8));
p+=w*sin(3.1416*tAB)*1.5;
p+=w*.014*(1.-uCalm);
vec2 dm=p.xy-uMouse.xy;float dl=length(dm);p.xy+=dm/(dl+.001)*smoothstep(1.3,0.,dl)*.5*(1.-tD);p.z+=smoothstep(1.3,0.,dl)*.6*(1.-tD);
float L=80.;vec3 d=vec3(uCam.x+(aRnd.x*2.-1.)*17.,(aRnd.y*2.-1.)*7.+sin(uTime*.25+aRnd.w*30.)*.35*(1.-uCalm),0.);
d.x+=sin(uTime*.18+aRnd.z*50.)*.4*(1.-uCalm);
d.z=uCam.z+mod(-aRnd.z*L-uCam.z,L)-L+7.;
p=mix(p,d,tD);p+=w*sin(3.1416*tD)*2.2*(1.-tAB*0.);
vec3 s=normalize(aRnd.xyz-.5+.0001)*(.1+.2*aRnd.w*aRnd.w);
p=mix(p,uEndPos+s+w*.01,tE);
vec3 c=mix(vec3(1.,.92,.8),aCol,tAB);c=mix(c,vec3(.8,.72,.6),tD);c=mix(c,vec3(1.,.14,.08)*(1.-uOff*.92),tE);
float a=mix(.5,.5,tAB);a=mix(a,.07+.3*aRnd.w*aRnd.w,tD);a=mix(a,.5,tE);
float sz=mix(1.,1.2,tAB);sz=mix(sz,.7+aRnd.w*1.6,tD);sz=mix(sz,.75,tE);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.,uPx*sz/-mv.z);
vCol=c;vA=a*smoothstep(.4,2.2,-mv.z)*(1.-smoothstep(46.,70.,-mv.z));}`,
      fragmentShader: `varying vec3 vCol;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.08,d)*vA;gl_FragColor=vec4(vCol*a,a);}`,
    });
    const pts3 = new THREE.Points(g, m); pts3.frustumCulled = false; pts3.renderOrder = 10; scene.add(pts3);
  }

  /* ---- الشاشات ---- */
  const blank = new THREE.DataTexture(new Uint8Array([8, 7, 7, 255]), 1, 1); blank.needsUpdate = true;
  const VS = 'varying vec2 vUv;varying float vD;void main(){vUv=uv;vec4 m=modelViewMatrix*vec4(position,1.);vD=-m.z;gl_Position=projectionMatrix*m;}';
  const FS = `uniform sampler2D map;uniform float uOn,uAsp,uBoost,uHover,uTime;uniform vec2 uRep,uOff,uFog;uniform vec3 uBg;varying vec2 vUv;varying float vD;
void main(){vec2 h=vec2(uAsp,1.)*.5;vec2 p=(vUv-.5)*vec2(uAsp,1.);float r=length(max(abs(p)-h+.045,0.))-.045;if(r>0.)discard;
vec2 uv=vUv*uRep+uOff;float ca=.0012+(1.-uOn)*.007;
vec3 t=vec3(texture2D(map,uv+vec2(ca,0.)).r,texture2D(map,uv).g,texture2D(map,uv-vec2(ca,0.)).b);
float open=smoothstep(0.,.55,uOn);float edge=abs(vUv.y-.5)-open*.5;
float band=1.-smoothstep(-.004,.004,edge);
float line=smoothstep(.02,0.,abs(edge))*(1.-smoothstep(.5,.95,uOn))*step(.02,uOn);
float scan=1.-.025*sin(vUv.y*480.+uTime*2.);
vec3 lit=t*scan*uBoost*(1.+.15*uHover);
vec3 c=mix(t*.06,lit,band*smoothstep(.08,1.,uOn))+vec3(1.,.95,.88)*line*1.6;
c*=1.-.12*smoothstep(.4,.8,length(vUv-.5));
float f=smoothstep(uFog.x,uFog.y,vD);gl_FragColor=vec4(mix(c,uBg,f),1.);
#include <colorspace_fragment>
}`;
  function screenMat(asp, boost = 1.0) {
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: blank }, uOn: { value: 0 }, uAsp: { value: asp }, uBoost: { value: boost }, uHover: { value: 0 }, uTime, uRep: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uFog, uBg: { value: BG } }, vertexShader: VS, fragmentShader: FS });
    m.userData.asp = asp; return m;
  }
  function cover(m, imgAsp) {
    const a = m.userData.asp, rep = m.uniforms.uRep.value, off = m.uniforms.uOff.value;
    if (imgAsp > a) { rep.set(a / imgAsp, 1); off.set((1 - rep.x) / 2, 0); } else { rep.set(1, imgAsp / a); off.set(0, (1 - rep.y) / 2); }
  }
  const setTex = (m, t) => { if (!t) return; m.uniforms.map.value = t; cover(m, t.image.width / t.image.height); };
  const plane = new THREE.PlaneGeometry(1, 1), box = new THREE.BoxGeometry(1, 1, 1);
  const bodyM = new THREE.MeshBasicMaterial({ color: 0x0e0c0b }), bodyFar = new THREE.MeshBasicMaterial({ color: 0x0a0908 });
  function monitor(w, h, boost) {
    const g = new THREE.Group(), m = screenMat(w / h, boost);
    const body = new THREE.Mesh(box, bodyM); body.scale.set(w + .14, h + .14, .2); body.position.z = -.11;
    const scr = new THREE.Mesh(plane, m); scr.scale.set(w, h, 1);
    g.add(body, scr); return { g, m, scr, body };
  }
  function textTex(str, W, H, size, color, bg) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
    x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    let s = size; do { x.font = `700 ${s}px "Aref Ruqaa",serif`; s -= 8; } while (x.measureText(str).width > W * .92 && s > 40);
    x.fillText(str, W / 2, H * .54);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const beamG = new THREE.ConeGeometry(2.7, 12, 48, 1, true);
  const beamVS = 'varying vec3 vN,vV;varying float vH;void main(){vH=uv.y;vec4 m=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-m.xyz);gl_Position=projectionMatrix*m;}';
  const beamFS = 'uniform float uK;varying vec3 vN,vV;varying float vH;void main(){float e=pow(abs(dot(normalize(vN),normalize(vV))),2.2);float a=e*pow(vH,1.6)*uK;gl_FragColor=vec4(vec3(1.,.86,.66)*a,a);}';

  const WALL = ['img/sm/crew.webp', 'img/sm/multiview-night.webp', 'img/sm/desert-crew.webp', 'img/sm/operator.webp', null, 'img/sm/painter-wide.webp', 'img/sm/piano.webp', 'img/sm/night-desert.webp', 'img/sm/library-set.webp'];
  const SATP = [[-3.5, 1.5, -3.2], [3.7, -.2, -4.4], [-3.9, -1.3, -6], [3.2, 2, -7.2]];
  let videoMat = null, videoIdx = -1, video = null;
  const first = [];

  const st = shots.map((el, i) => {
    const kind = el.dataset.kind, s = { el, kind, i, k: 0, on: 0, mats: [], sats: [], M: new THREE.Vector3(), C: new THREE.Vector3(), T: new THREE.Vector3() };
    if (kind === 'title' || kind === 'me') return s;
    s.M.set(Math.sin(i * .9) * 4.6, Math.sin(i * 1.7) * 1.3, -(i - 1) * 16 - 4);
    s.w = kind === 'sign' ? 5 : kind === 'end' ? 2.5 : kind === 'wall' ? 4.9 : 4.5;
    s.h = kind === 'sign' ? 1.7 : kind === 'end' ? 3.33 : s.w * 9 / 16;
    const mon = monitor(s.w, s.h, kind === 'sign' ? 1.6 : 1.0); Object.assign(s, mon); scene.add(s.g);
    if (kind === 'wall') {
      s.scr.visible = false;
      const tw = (s.w - .12) / 3, th = (s.h - .12) / 3;
      WALL.forEach((src, k) => {
        const m = screenMat(tw / th), t = new THREE.Mesh(plane, m);
        t.scale.set(tw, th, 1); t.position.set((k % 3 - 1) * (tw + .06), (1 - Math.floor(k / 3)) * (th + .06), .001); s.g.add(t); s.mats.push(m);
        if (!src) { videoMat = m; videoIdx = i; }
        loadTex(src || el.dataset.img).then(x => setTex(m, x));
      });
      s.hit = s.body;
    } else {
      s.mats.push(s.m); s.hit = s.scr;
      if (kind === 'sign') setTex(s.m, textTex('على الهوا', 1024, 348, 250, '#ff3b2f', '#140504'));
      else { const p = loadTex(el.dataset.img).then(x => setTex(s.m, x)); if (i < 5) first.push(p); }
    }
    (el.dataset.sats || '').split(',').filter(Boolean).forEach((src, k) => {
      const sm = monitor(1, 1); sm.body.material = bodyFar; sm.h = 1.35; sm.p = SATP[k % 4]; sm.ph = rnd() * 6; scene.add(sm.g); s.sats.push(sm);
      loadTex(src).then(t => { if (!t) return; const a = t.image.width / t.image.height, hh = a < 1 ? 2.1 : 1.5; sm.h = hh; sm.scr.scale.set(hh * a, hh, 1); sm.body.scale.set(hh * a + .1, hh + .1, .14); sm.m.uniforms.uAsp.value = sm.m.userData.asp = a; setTex(sm.m, t); });
    });
    // اسم الفقرة بخط كبير ورا الشاشة
    s.titleM = new THREE.MeshBasicMaterial({ map: textTex(kind === 'sign' ? 'قبل الهوا خلص' : el.dataset.name, 1024, 300, 210, '#fff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    s.title = new THREE.Mesh(plane, s.titleM); scene.add(s.title);
    s.beamM = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 } }, vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    s.beam = new THREE.Mesh(beamG, s.beamM); s.beam.renderOrder = 4; scene.add(s.beam);
    return s;
  });
  const END = st[N - 1];

  // علامات أرضية الاستوديو
  const floorU = { uCam: partU.uCam };
  {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(260, N * 40 + 200), new THREE.ShaderMaterial({
      uniforms: floorU, transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: 'uniform vec3 uCam;varying vec3 vW;void main(){vec2 g=abs(fract(vW.xz/3.-.5)-.5)*3.;float c=max(step(g.x,.02)*step(g.y,.24),step(g.y,.02)*step(g.x,.24));float d=distance(vW.xz,uCam.xz);float a=c*.34*(1.-smoothstep(5.,30.,d));if(a<.003)discard;gl_FragColor=vec4(vec3(.85,.78,.66)*a,a);}',
    }));
    f.rotation.x = -Math.PI / 2; f.position.set(0, -3.6, -(N * 18)); f.renderOrder = 1; scene.add(f);
  }

  /* ---- المعالجة: bloom + انحراف لوني مع السرعة + حبيبات ---- */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .3, .6, .88); composer.addPass(bloom);
  const fin = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime, uVel: { value: 0 }, uGrain: { value: .012 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uVel,uGrain;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.)*43758.5453);}
void main(){vec2 d=vUv-.5;float r=length(d);float ca=(.0016+uVel*.02)*r*2.;
vec3 c=vec3(0.);for(int i=0;i<4;i++){float s=1.-float(i)*uVel*.035;vec2 u=.5+d*s;c+=vec3(texture2D(tDiffuse,u+d*ca).r,texture2D(tDiffuse,u).g,texture2D(tDiffuse,u-d*ca).b);}
c*=.25;c*=1.-smoothstep(.4,.98,r)*.6;c+=(h(gl_FragCoord.xy)-.5)*uGrain*(.15+smoothstep(0.,.4,dot(c,vec3(.33))));gl_FragColor=vec4(max(c,0.),1.);}`,
  });
  composer.addPass(fin); composer.addPass(new OutputPass());

  /* ---- التخطيط حسب مقاس الشاشة ---- */
  let posCurve, tgtCurve, SPAN = 1000;
  const track = $('#track');
  function layout() {
    narrow = mqNarrow.matches;
    const W = innerWidth, H = innerHeight, asp = W / H, dpr = Math.min(devicePixelRatio || 1, narrow ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); composer.setPixelRatio(dpr); composer.setSize(W, H);
    camera.aspect = asp; camera.updateProjectionMatrix();
    partU.uPx.value = (narrow ? .05 : .046) * H * dpr / VIS;
    let dMax = 8; const bar = parseFloat(getComputedStyle(root).getPropertyValue('--bar')) || 60;
    // أول حاجة: بُعد الكاميرا المطلوب لكل شاشة، وبعدين المسافة بين المحطات بتتحسب منه
    // عشان الشاشة اللي قبلها تفضل دايماً ورا الكاميرا ومتغطيش على اللي بعدها
    let zPrev = null;
    st.forEach(s => {
      if (!s.g) return;
      const capEl = $('.cap', s.el), padB = parseFloat(getComputedStyle(s.el).paddingBottom) || 0;
      const topY = bar + 14, botY = Math.max(topY + 120, H - padB - capEl.offsetHeight - 22), areaH = botY - topY;
      const ff = areaH * .96 / H, wf = narrow ? .96 : .66;
      s.dd = Math.max(s.h / (ff * VIS), s.w / (wf * VIS * asp)); s.off = .5 - (topY + botY) / 2 / H;
      s.M.z = zPrev === null ? -Math.max(20, s.dd + 8) : zPrev - Math.max(18, s.dd + 10); zPrev = s.M.z;
    });
    st.forEach((s, i) => {
      if (s.kind === 'title') { const d = Math.max(8, WA / ((narrow ? .9 : .6) * VIS * asp)); s.C.set(0, 0, d); s.T.set(0, -.07 * VIS * d, 0); return; }
      if (s.kind === 'me') {
        const d = narrow ? Math.max(PH / (.44 * VIS), PW / (.82 * VIS * asp)) : PH / (.62 * VIS), vh = VIS * d;
        s.T.set(narrow ? 0 : vh * asp * .17, -(narrow ? .2 : .06) * vh, 0); s.C.set(s.T.x * .6, s.T.y, d); return;
      }
      // الشاشة بتتمركز في المساحة الفاضية بين الشريط والكلام
      const d = s.dd, vh = VIS * d, off = s.off;
      dMax = Math.max(dMax, d);
      s.T.copy(s.M).add(new THREE.Vector3(narrow ? 0 : vh * asp * .03, -off * vh, 0));
      s.C.copy(s.T).add(new THREE.Vector3((i % 2 ? 1 : -1) * (narrow ? .3 : .9), .2, d));
      s.g.position.copy(s.M); s.g.lookAt(s.C); s.q = s.g.quaternion.clone();
      const tw = narrow ? s.w * 1.25 : s.w * 1.7;
      s.title.scale.set(tw, tw * 300 / 1024, 1); s.title.position.copy(s.M).add(new THREE.Vector3(0, s.h / 2 + tw * .11, -2.6)); s.title.lookAt(s.C);
      s.beam.position.copy(s.M).add(new THREE.Vector3(0, 4.2, -.4));
      s.sats.forEach(sm => { sm.b = new THREE.Vector3(sm.p[0] * (narrow ? .42 : 1), sm.p[1] * (narrow ? 1.5 : 1) + (narrow ? 1.2 : 0), sm.p[2]).add(s.M); sm.g.position.copy(sm.b); sm.g.lookAt(s.C); });
    });
    uFog.value.set(dMax + 7, dMax + 44);
    posCurve = new THREE.CatmullRomCurve3(st.map(s => s.C), false, 'centripetal');
    tgtCurve = new THREE.CatmullRomCurve3(st.map(s => s.T), false, 'centripetal');
    partU.uEndPos.value.copy(END.M).add(new THREE.Vector3(narrow ? 0 : -END.w / 2 - .9, narrow ? END.h / 2 + .55 : END.h / 2 - .2, .3));
    SPAN = Math.round(H * 1.4); track.style.height = SPAN * (N - 1) + H + 'px';
  }
  layout();
  addEventListener('resize', layout);

  // السكرول: نص المسافة وقفة عند الفقرة، والنص التاني حركة
  const mapScroll = y => { const v = clamp(y / SPAN, 0, N - 1), i = Math.floor(v); const q = clamp((v - i - .36) / .3); return i + q * q * q * (q * (q * 6 - 15) + 10); };
  const goTo = i => scrollTo({ top: clamp(i, 0, N - 1) * SPAN + (i > 0 ? 2 : 0), behavior: mqCalm.matches ? 'auto' : 'smooth' });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const i = shots.findIndex(s => '#' + s.id === a.getAttribute('href')); if (i < 0) return;
    e.preventDefault(); if (runDlg.open) runDlg.close(); goTo(i);
  });

  /* ---- شريط الحالة ---- */
  const stateTxt = $('#stateTxt'), tc = $('#tc'), cue = $('#cue'), cueTxt = $('#cueTxt'), runLinks = [...runDlg.querySelectorAll('a')];
  let active = -1, shown = -1, act = '', lastTc = '', airMs = 0;
  const two = n => String(n).padStart(2, '0');
  function hud(u, dt) {
    const idx = clamp(Math.round(u), 0, N - 1), a = idx < AIR ? 'pre' : idx < POST ? 'air' : 'post';
    if (a !== act) { act = a; root.dataset.act = a; stateTxt.textContent = a === 'pre' ? 'قبل الهوا' : a === 'air' ? 'على الهوا' : 'بعد الهوا'; }
    if (a === 'air') airMs += dt;
    const s = Math.floor(airMs / 1000);
    const t = a === 'pre' ? '00:' + two(Math.max(1, Math.ceil(10 * (1 - clamp(u / AIR))))) : a === 'air' ? two(Math.floor(s / 60)) + ':' + two(s % 60) : '';
    if (t !== lastTc) tc.textContent = lastTc = t;
    if (idx !== active) {
      active = idx; cueTxt.textContent = idx === N - 1 ? 'من الأول' : shots[idx + 1].dataset.name; cue.hidden = false;
      runLinks.forEach((l, i) => i === idx ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current'));
    }
    const vis = Math.abs(u - idx) < .3 ? idx : -1;
    if (vis !== shown) { if (shown >= 0) shots[shown].classList.remove('on'); if (vis >= 0) shots[vis].classList.add('on'); shown = vis; }
  }
  cue.addEventListener('click', () => goTo(active === N - 1 ? 0 : active + 1));

  /* ---- الماوس ---- */
  let px = 0, py = 0, tx = 0, ty = 0, hover = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9);
  addEventListener('pointermove', e => { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); if (e.pointerType === 'mouse') { tx = ndc.x; ty = -ndc.y; } }, { passive: true });
  canvas.addEventListener('click', e => {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const s = st[active]; if (!s || !s.hit || Math.abs(u - active) > .3) return;
    ray.setFromCamera(ndc, camera); if (!ray.intersectObject(s.hit).length) return;
    if (s.kind === 'wall') openReel(); else if ($('.sheet', s.el)) openSheet(active); else if (s.kind === 'sign') runDlg.showModal();
  });

  /* ---- الحلقة ---- */
  const P = new THREE.Vector3(), T = new THREE.Vector3(), tmp = new THREE.Vector3();
  let u = mapScroll(scrollY), last = performance.now(), time = 0, running = true, endT = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(250, now - last); last = now; time += dt / 1000; uTime.value = time;
    const calm = mqCalm.matches, target = mapScroll(scrollY);
    u = calm ? target : u + (target - u) * (1 - Math.exp(-dt / 1000 * 2.6));
    const vel = clamp(Math.abs(target - u) * 1.6);
    px += (tx - px) * .05; py += (ty - py) * .05;
    hud(u, dt);

    const t = clamp(u / (N - 1));
    posCurve.getPoint(t, P); tgtCurve.getPoint(t, T);
    const sway = calm ? 0 : 1;
    camera.position.set(P.x + px * .35 + Math.sin(time * .5) * .04 * sway, P.y - py * .22 + Math.cos(time * .4) * .03 * sway, P.z);
    camera.lookAt(T.x + px * .15, T.y - py * .1, T.z);
    camera.rotation.z += (target - u) * -.05;
    partU.uCam.value.copy(camera.position);

    partU.uAB.value = clamp(u); partU.uDust.value = clamp(u - 1); partU.uEnd.value = clamp(u - (N - 2)); partU.uCalm.value = calm ? 1 : 0;
    endT = u > N - 1.03 ? endT + dt / 1000 : 0; partU.uOff.value = smooth(clamp((endT - 3) / 2.5));
    if (u < 1.6) { ray.setFromCamera(ndc, camera); const k = -ray.ray.origin.z / ray.ray.direction.z; partU.uMouse.value.copy(ray.ray.origin).addScaledVector(ray.ray.direction, k); } else partU.uMouse.value.set(99, 99, 0);

    let hov = false;
    for (const s of st) {
      if (!s.g) continue;
      const near = Math.abs(s.i - u), vis = near < 2.3;
      s.g.visible = s.title.visible = s.beam.visible = vis; s.sats.forEach(x => x.g.visible = vis);
      if (!vis) continue;
      const k = smooth(1 - clamp(near / .9)); s.k = k;
      const on = smooth(clamp((k - .03) / .38));
      let hv = 0;
      if (k > .8 && !narrow) { ray.setFromCamera(ndc, camera); if (ray.intersectObject(s.hit).length) { hv = 1; hov = s.kind !== 'screen' || !!$('.sheet', s.el) || s.kind === 'wall'; } }
      s.mats.forEach(m => { m.uniforms.uOn.value = on; m.uniforms.uHover.value += (hv - m.uniforms.uHover.value) * .1; });
      s.titleM.opacity = .16 * k; s.beamM.uniforms.uK.value = .05 + .3 * k;
      s.g.position.y = s.M.y + Math.sin(time * .6 + s.i) * .07 * sway;
      s.g.quaternion.copy(s.q); s.g.rotateY(px * .16 * k); s.g.rotateX(py * .1 * k);
      s.sats.forEach((x, j) => { x.m.uniforms.uOn.value = smooth(clamp((k - .3 - j * .08) / .5)) * .92; x.g.position.y = x.b.y + Math.sin(time * .5 + x.ph) * .14 * sway; });
    }
    if (hov !== hover) { hover = hov; canvas.style.cursor = hov ? 'pointer' : ''; }

    if (videoMat && Math.abs(u - videoIdx) < 1.1 && !video && !calm) {
      video = document.createElement('video'); Object.assign(video, { src: 'vid/showreel.mp4', muted: true, loop: true, playsInline: true, preload: 'auto' });
      video.addEventListener('playing', () => { const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace; videoMat.uniforms.map.value = vt; cover(videoMat, 16 / 9); }, { once: true });
    }
    if (video) { const want = Math.abs(u - videoIdx) < .7 && !reelDlg.open; if (want && video.paused) video.play().catch(() => {}); else if (!want && !video.paused) video.pause(); }

    fin.uniforms.uVel.value = calm ? 0 : vel;
    composer.render();
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; root.classList.remove('gl'); });

  await Promise.race([Promise.all(first), new Promise(r => setTimeout(r, 4000))]);
  if (location.hash) { const i = shots.findIndex(s => '#' + s.id === location.hash); if (i > 0) scrollTo(0, i * SPAN + 2); }
  requestAnimationFrame(frame);
  requestAnimationFrame(() => requestAnimationFrame(unboot));
}
