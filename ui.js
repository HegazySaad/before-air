// قبل الهوا — الواجهة الخفيفة: النوافذ، الورقة، شكل العرض.. والمشهد الـ3D بيتحمل بس لما يتطلب.
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const shots = [...document.querySelectorAll('.shot')];
const idOf = id => shots.findIndex(s => s.id === id);
const mqCalm = matchMedia('(prefers-reduced-motion:reduce)');
const boot = window.__view || { mode: 'lite', gl: false, save: false, chosen: false };
window.__ui = true; root.classList.add('ui');

/* ---------- رسائل ونوافذ ---------- */
const runDlg = $('#runDlg'), reelDlg = $('#reelDlg'), reel = $('#reel'), sheetDlg = $('#sheetDlg'), workDlg = $('#workDlg'), viewDlg = $('#viewDlg');
const dialogs = [runDlg, reelDlg, sheetDlg, workDlg, viewDlg];
const toastEl = $('#toast'); let toastT = 0;
function toast(msg) { if (!msg) return; toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3200); }
function show(d) { if (!d.open) d.showModal(); }
function openReel() {                                        // الريل اختيار صريح: مفيش تحميل قبل الضغط
  const tall = innerHeight > innerWidth * 1.2, src = tall ? 'vid/showreel-v.mp4' : 'vid/showreel.mp4';
  if (!reel.getAttribute('src')?.endsWith(src)) { reel.src = src; reel.poster = tall ? 'vid/showreel-v.webp' : 'vid/showreel-thumb.webp'; }
  reelDlg.classList.toggle('tall', tall); show(reelDlg); reel.play().catch(() => {});
}
reelDlg.addEventListener('close', () => reel.pause());
dialogs.forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* ---------- الورقة: بتفتح بخطوة واحدة في السجل، وزرار الرجوع بيقفلها ---------- */
let sheetId = '';
function openSheet(i, push = true) {
  const s = shots[i], src = s && $('.sheet', s); if (!src) return;
  if (!root.classList.contains('gl')) { go(i); return; }     // في القراءة الخفيفة الورقة مفتوحة جوه الصفحة
  sheetId = s.id;
  $('#sheetH').textContent = $('h2', s).textContent;
  $('#sheetMeta').textContent = $('.meta', s)?.textContent || '';
  $('#sheetBody').innerHTML = src.innerHTML;
  $('#sheetGo').setAttribute('href', '#' + s.id);
  show(sheetDlg); sheetDlg.scrollTop = 0;
  if (push && history.state?.sheet !== s.id) history.pushState({ sheet: s.id }, '', '#' + s.id);
}
sheetDlg.addEventListener('close', () => {
  if (history.state?.sheet) history.back();
  // التركيز بيرجع للزرار اللي فتح الورقة.. ولو اتفتحت من الفهرس، لزرار الورقة في مشهدها
  requestAnimationFrame(() => { if (!document.activeElement?.closest('#' + CSS.escape(sheetId))) $('#' + CSS.escape(sheetId) + ' [data-do=sheet]')?.focus({ preventScroll: true }); });
});
addEventListener('popstate', e => {
  if (e.state?.sheet) { const i = idOf(e.state.sheet); if (i >= 0) openSheet(i, false); }
  else if (sheetDlg.open) sheetDlg.close();
});
$('#share').addEventListener('click', () => {
  const url = location.origin + location.pathname + '#' + sheetId;
  (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast('اتنسخ لينك البرنامج'), () => toast(url));
});

/* ---------- التنقل ---------- */
let scene = null;                                             // المشهد الشغال (لو فيه)
function current() {                                          // القسم اللي قدام القارئ دلوقتي
  if (scene) return scene.index();
  let best = 0, d = 1e9;
  shots.forEach((s, i) => { const r = s.getBoundingClientRect(), k = Math.abs(r.top - 80); if (r.bottom > 80 && k < d) { d = k; best = i; } });
  return best;
}
function go(i, instant) {
  if (scene) return scene.goTo(i, instant);
  shots[i].scrollIntoView({ behavior: instant || mqCalm.matches ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(history.state?.sheet ? null : history.state, '', i ? '#' + shots[i].id : location.pathname + location.search);
}
document.addEventListener('click', e => {
  const vb = e.target.closest('button[data-view]'); if (vb) { setView(vb.dataset.view, true); return; }
  const t = e.target.closest('[data-do]');
  if (t) {
    const d = t.dataset.do, i = shots.indexOf(t.closest('.shot'));
    if (d === 'run') show(runDlg); else if (d === 'work') show(workDlg); else if (d === 'view') { markView(); show(viewDlg); }
    else if (d === 'reel') openReel(); else if (d === 'sheet') openSheet(i); else if (d === 'next') go(1);
    return;
  }
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const i = idOf(a.getAttribute('href').slice(1)); if (i < 0) return;
  e.preventDefault();
  const wasSheet = sheetDlg.open && history.state?.sheet;
  if (wasSheet) history.replaceState(null, '', location.href);   // قفل الورقة من غير رجوع زيادة في السجل
  dialogs.forEach(d => d.open && d.close());
  if (a.dataset.open && root.classList.contains('gl')) { go(i, true); openSheet(i); } else go(i);
});
addEventListener('hashchange', () => { if (history.state?.sheet) return; const i = idOf(location.hash.slice(1)); if (i >= 0 && i !== current()) go(i); });
// صورة ما اتحملتش: القسم بيكمل بالكلام واللينكات
document.addEventListener('error', e => { const im = e.target; if (im.tagName === 'IMG') { im.closest('.pic')?.classList.add('noimg'); if (im.classList.contains('th')) im.style.visibility = 'hidden'; } }, true);
// كل الفيديوهات بتقف لما التبويب يتخبى.. ومفيش حاجة بترجع تشتغل لوحدها
document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('video').forEach(v => v.pause()); });

/* ---------- شكل العرض: قراءة خفيفة / سينمائي متوازن / جودة أعلى ---------- */
function capable() {                                         // إشارات متاحة + قيم احتياطية (الدعم مش شامل)
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  return boot.gl && cores >= 8 && mem >= 8 && !matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) >= 700;
}
let view = boot.mode === 'auto' ? 'cine' : boot.mode, busy = false;
function markView() {
  viewDlg.querySelectorAll('[data-view]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.view === view)); if (b.dataset.view !== 'lite') b.disabled = !boot.gl; });
  $('#viewNote').textContent = !boot.gl ? 'المتصفح ده مش بيشغل الـ3D.. فالقراءة الخفيفة هي المتاحة.' : boot.save && !boot.chosen ? 'توفير البيانات شغال عندك.. فبدأنا بالقراءة الخفيفة.' : mqCalm.matches && !boot.chosen ? 'جهازك طالب حركة أقل.. فبدأنا بالقراءة الخفيفة.' : 'اختيارك بيتحفظ على الجهاز ده.';
}
function toLite(i, why) {                                      // رجوع نضيف للصفحة العادية عند نفس القسم
  if (scene) { try { scene.stop(); } catch (e) {} scene = null; }
  root.classList.remove('gl', 'pre', 'js3d'); root.dataset.view = view = 'lite';
  delete root.dataset.act; delete root.dataset.mood; delete root.dataset.kind;
  shots.forEach(s => { s.classList.remove('on'); $('.cap', s)?.classList.remove('scrolls'); });
  $('#track').style.height = '';
  const cv = $('#stage'), fresh = cv.cloneNode(false); fresh.removeAttribute('style'); fresh.removeAttribute('width'); fresh.removeAttribute('height'); cv.replaceWith(fresh);
  if (i > 0) shots[i].scrollIntoView({ block: 'start' }); else scrollTo(0, 0);
  if (why) toast(why);
}
async function toScene(mode, i) {
  if (busy) return; busy = true;
  if (scene) { scene.stop(); scene = null; const cv = $('#stage'); cv.replaceWith(cv.cloneNode(false)); }
  root.classList.add('gl', 'pre'); root.dataset.view = view = mode;
  shots.forEach((s, k) => s.classList.toggle('on', k === i));
  try {
    const m = await import('./take.js');
    scene = await m.start({ mode, at: i, save: boot.save, lock: /[?&]lock=1/.test(location.search), toast, openReel, openSheet, isOpen: () => reelDlg.open,
      fail: (idx, why) => toLite(idx, why) });
    root.classList.remove('pre');
  } catch (e) {
    console.warn('3D off:', e); toLite(i, boot.gl ? 'المشهد ما اشتغلش.. كمل بالقراءة الخفيفة.' : '');
  }
  busy = false;
}
const stored = () => { try { return localStorage.getItem('qh-view'); } catch (e) { return null; } };
function setView(mode, save) {
  if (mode !== 'lite' && !boot.gl) { toast('المتصفح ده مش بيشغل الـ3D.'); return; }
  if (save) { try { localStorage.setItem('qh-view', mode); } catch (e) {} boot.chosen = true; }
  dialogs.forEach(d => d.open && d.close());
  const i = current();
  if (mode === view && (mode === 'lite' || scene)) return;
  if (mode === 'lite') toLite(i); else toScene(mode, i);
  markView();
}

/* ---------- البداية ---------- */
const h0 = Math.max(0, idOf(location.hash.slice(1)));
if (view === 'lite') { root.classList.remove('gl', 'pre'); }
else toScene(boot.mode === 'auto' && capable() ? 'high' : view, h0);
markView();
