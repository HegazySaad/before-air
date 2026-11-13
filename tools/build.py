#!/usr/bin/env python3
"""يبني index.html من content/site.json.

التشغيل من جذر المشروع:  python3 tools/build.py
كل النصوص والروابط في content/site.json.. المولّد ده شكل بس.
"""
import html, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
D = json.loads((ROOT / 'content' / 'site.json').read_text(encoding='utf8'))
SITE = D['site']
CH = [c for c in D['chapters'] if not c.get('draft') or '--with-drafts' in sys.argv]   # المسودات ما بتتنشرش إلا بطلب صريح
E = html.escape
PLAY = '<span class="ph" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg></span>'
DOT = '<i class="dot"></i>'


def link(l):
    pic = f'<img class="th" src="{E(l["thumb"])}" alt="" width="320" height="180" loading="lazy">' if l.get('thumb') else PLAY
    return (f'<li><a class="lnk" href="{E(l["url"])}" target="_blank" rel="noopener noreferrer">{pic}'
            f'<span class="txt"><b>{E(l["title"])}</b><span>{E(l["sub"])}</span></span></a></li>')


def action(a):
    cls = 'btn ghost' if a.get('ghost') else 'btn'
    hint = f'<span class="hint">{E(a["hint"])}</span>' if a.get('hint') else ''
    return f'<button type="button" class="{cls}" data-do="{a["do"]}">{DOT}{E(a["label"])}</button>{hint}'


def sheet(c):
    if c.get('type') == 'program':
        return (f'    <p>{E(c["desc"])}</p>\n    <p class="role"><b>دوري</b> {E(c["role"])}</p>\n'
                f'    <ul class="lnks">{"".join(link(l) for l in c["links"])}</ul>')
    if c.get('type') == 'credits':
        cr = ''.join(f'<li><b>{E(x["title"])}</b><span>{E(x["role"])}</span><small>{E(x["detail"])}</small></li>' for x in D['credits'])
        bf = ''.join(f'<li><b>{E(x["place"])}</b><span>{E(x["role"])}</span><small>{E(x["when"])}</small></li>' for x in D['before'])
        return f'    <h3>على الشاشة</h3>\n    <ul class="roll">{cr}</ul>\n    <h3>قبل التلفزيون</h3>\n    <ul class="roll">{bf}</ul>'
    if c.get('type') == 'script':
        out = []
        for s in c['script']:
            out.append(f'    <h3>{E(s["h"])}</h3>')
            out += [f'    <p>{E(x)}</p>' for x in s.get('lines', []) if not s.get('q') or s is c['script'][0]] if not s.get('q') else []
            if s.get('q'):
                pre = [x for x in s.get('lines', []) if s['h'].startswith(('Gear 2', 'Gear 3', 'السباق'))]
                out += [f'    <p>{E(x)}</p>' for x in pre]
                out += [f'    <p class="dir">{E(x)}</p>' for x in s.get('dir', [])]
                out += [f'    <p>{E(x)}</p>' for x in s.get('after', [])]
                out.append('    <ul class="qs">' + ''.join(f'<li>{E(q)}</li>' for q in s['q']) + '</ul>')
                if s['h'] == 'Gear 1':
                    out += [f'    <p>{E(x)}</p>' for x in s.get('lines', [])]
                out += [f'    <p class="dir">{E(x)}</p>' for x in s.get('after2', [])]
            if s.get('cut'):
                out.append(f'    <p class="cut">{E(s["cut"])}</p>')
        out.append('    <p class="fine">النص منقول من ورقة الحلقة زي ما هو.</p>')
        return '\n'.join(out)
    return ''


def chapter(c):
    hid = f'h-{c["id"]}'
    tag = 'h1' if c.get('h1') else 'h2'
    cap = [f'    <{tag} id="{hid}">{E(c["title"])}</{tag}>']
    if c.get('meta'):
        cap.append(f'    <p class="meta">{E(c["meta"])}</p>')
    cap.append(f'    <p class="lead">{E(c["lead"])}</p>')
    cap += [f'    <p>{E(b)}</p>' for b in c.get('body', [])]
    if c.get('facts'):
        cap.append('    <ul class="facts">' + ''.join(f'<li><b>{E(a)}</b><span>{E(b)}</span></li>' for a, b in c['facts']) + '</ul>')
    if c.get('type') == 'program':                 # مقتطف الدور ظاهر في المشهد.. والورقة الكاملة لسه موجودة
        cap.append(f'    <p class="role in-cap"><b>دوري</b> {E(c["role"])}</p>')
    if c['kind'] == 'control':                     # بديل HTML لشاشات حيطة الكنترول
        cap.append('    <ul class="chips" aria-label="برامج الحلقة">' + ''.join(
            f'<li><a href="#{x["id"]}">{E(x["nav"])}</a></li>' for x in CH if x.get('type') == 'program' and CH.index(x) > CH.index(c)) + '</ul>')
    go = [action(a) for a in c.get('actions', [])]
    sh = sheet(c)
    if sh:
        go.append(f'<button type="button" class="btn" data-do="sheet">{DOT}{E(c.get("sheetLabel", "افتح الورقة"))}</button>')
    if c.get('contact'):
        go.append(f'<a class="btn" href="{E(SITE["linkedin"])}" target="_blank" rel="noopener noreferrer">{DOT}نكمل الحكاية على لينكد إن</a>')
        go.append(f'<a class="mail" href="mailto:{E(SITE["email"])}">{E(SITE["email"])}</a>')
    if go:
        cap.append('    <p class="go">' + ''.join(go) + '</p>')
    if c.get('contact'):
        cap.append(f'    <p class="fine">{E(SITE["footer"])} · <a href="v3.html">النسخة اللي فاتت</a></p>')
    attrs = {'data-name': c['nav'], 'data-kind': c['kind']}
    if c.get('flip'):
        attrs['data-flip'] = '1'
    if c.get('paperHead'):
        attrs['data-paperhead'] = c['paperHead']
    for k in ('img', 'year', 'mood', 'tint', 'paper'):
        if c.get(k):
            attrs[f'data-{k}'] = c[k]
    for k in ('sats', 'wall'):
        if c.get(k):
            attrs[f'data-{k}'] = ','.join(c[k])
    w, h = c.get('imgDims', [1280, 720])
    fig = ''
    if c.get('img'):
        small = ROOT / 'img' / 'm' / pathlib.Path(c['img']).name
        if small.exists() and w > 640:
            attrs['data-imgm'] = f'img/m/{small.name}'
        ss = f' srcset="img/m/{small.name} 640w, {E(c["img"])} {w}w" sizes="(max-width:760px) 92vw, 700px"' if small.exists() and w > 640 else ''
        fig = f'<figure class="pic"><img src="{E(c["img"])}"{ss} alt="" width="{w}" height="{h}" loading="lazy" decoding="async"></figure>'
    a = ' '.join(f'{k}="{E(v)}"' for k, v in attrs.items())
    if c.get('note'):
        cap.append(f'    <aside class="note" aria-label="ملاحظة على الهامش"><b>على الهامش</b>{E(c["note"])}</aside>')
    shd = f'\n  <div class="sheet">\n{sh}\n  </div>' if sh else ''
    return (f'<section class="shot k-{c["kind"]}" id="{c["id"]}" {a} aria-labelledby="{hid}">\n  {fig}\n'
            f'  <div class="cap">\n' + '\n'.join(cap) + f'\n  </div>{shd}\n</section>')


nav = ''.join(f'<li><a href="#{c["id"]}">{E(c["nav"])}' + (f'<small>{E(c["year"])}</small>' if c.get('year') else '') + '</a></li>' for c in CH)
work = ''.join(
    f'<li><a href="#{c["id"]}" data-open="{c["id"]}"><img src="{E(c["img"])}" alt="" width="320" height="180" loading="lazy">'
    f'<span class="txt"><b>{E(c["title"])}</b><span>{E(c["meta"])}</span></span></a></li>'
    for c in CH if c.get('type') == 'program')
ld = json.dumps({
    '@context': 'https://schema.org', '@type': 'Person', 'name': SITE['nameEn'], 'alternateName': SITE['name'],
    'jobTitle': 'TV Content Editor & Scriptwriter', 'worksFor': {'@type': 'Organization', 'name': 'Abu Dhabi Media Network'},
    'url': SITE['url'], 'sameAs': [SITE['linkedin']], 'knowsLanguage': ['ar']}, ensure_ascii=False)
eggs = E(json.dumps(D['eggs'], ensure_ascii=False))

page = f'''<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(SITE["title"])}</title>
<meta name="description" content="{E(SITE["description"])}">
<meta name="theme-color" content="#060505">
<link rel="preload" href="fonts/aref-ruqaa-arabic-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/readex-pro-arabic-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="take.css">
<script>/* اختيار شكل العرض قبل أول رسم: المحفوظ، وبعدين إشارات الجهاز (تقليل الحركة، توفير البيانات، WebGL2) */
(function(r){{var q=(location.search.match(/[?&]view=(lite|cine|high)/)||[])[1],v=null,gl=false;
try{{v=localStorage.getItem('qh-view')}}catch(e){{}}if(!/^(lite|cine|high)$/.test(v||''))v=null;
try{{gl=!!document.createElement('canvas').getContext('webgl2')}}catch(e){{}}
var mm=function(x){{return !!(window.matchMedia&&matchMedia(x).matches)}};
var save=!!(navigator.connection&&navigator.connection.saveData)||mm('(prefers-reduced-data:reduce)');
var mode=q||v||((save||mm('(prefers-reduced-motion:reduce)'))?'lite':'auto');if(!gl)mode='lite';
window.__view={{mode:mode,gl:gl,save:save,chosen:!!(q||v)}};r.setAttribute('data-view',mode=='auto'?'cine':mode);
if(mode!='lite'){{r.classList.add('gl','pre');setTimeout(function(){{if(!window.__ui)r.classList.remove('gl','pre')}},6000)}}}})(document.documentElement)</script>
<link rel="modulepreload" href="ui.js">
<script type="importmap">{{"imports":{{"three":"./vendor/three.module.min.js","three/addons/":"./vendor/jsm/"}}}}</script>
<script type="application/ld+json">{ld}</script>
<meta property="og:type" content="website">
<meta property="og:title" content="حجازي سعد.. قبل الهوا">
<meta property="og:description" content="{E(SITE["ogDescription"])}">
<meta property="og:locale" content="ar_AE">
<meta property="og:url" content="{E(SITE["url"])}">
<meta property="og:image" content="{E(SITE["url"])}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
</head>
<body data-eggs="{eggs}">
<a class="skip" href="#documentary">روح للشغل على طول</a>
<button type="button" class="skip two" data-view="lite">اقرا من غير حركة</button>
<canvas id="stage" aria-hidden="true"></canvas>
<div class="bars" aria-hidden="true"></div>
<header class="bar">
  <a class="name" href="#top">{E(SITE["name"])}</a>
  <p class="state"><i class="dot"></i><span id="stateTxt">قبل الهوا</span><button type="button" class="tc" id="tc" dir="ltr" aria-label="تايم كود">00:00:00:00</button></p>
  <button type="button" class="hb" data-do="work" aria-haspopup="dialog">الشغل</button>
  <button type="button" class="hb" data-do="run" aria-haspopup="dialog">ترتيب الحلقة</button>
  <button type="button" class="hb vw" data-do="view" aria-haspopup="dialog" aria-label="شكل العرض"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span>العرض</span></button>
</header>
<main id="main">
{chr(10).join(chapter(c) for c in CH)}
</main>
<div id="track" aria-hidden="true"></div>
<p class="year" id="year" aria-hidden="true"><small>آلة الزمن</small><b id="yearN"></b></p>
<nav class="cuebar" aria-label="تنقل بين المشاهد">
  <button type="button" id="prev" class="cue alt" hidden aria-label="المشهد اللي قبله">اللي قبله</button>
  <button type="button" id="cue" class="cue" hidden><i class="dot"></i><b>كيو</b><span id="cueTxt"></span></button>
</nav>
<div id="tip" role="tooltip" hidden></div>
<div id="toast" role="status" aria-live="polite"></div>
<dialog id="runDlg" aria-labelledby="runH">
  <form method="dialog"><h2 id="runH">ترتيب الحلقة</h2><button class="x">اقفل</button></form>
  <ol>{nav}</ol>
</dialog>
<dialog id="workDlg" aria-labelledby="workH">
  <form method="dialog"><h2 id="workH">الشغل على طول</h2><button class="x">اقفل</button></form>
  <ul class="work">{work}</ul>
  <p class="more"><a href="#credits" data-open="credits">التترات كاملة.. وقبل التلفزيون</a></p>
</dialog>
<dialog id="sheetDlg" aria-labelledby="sheetH">
  <form method="dialog"><button type="button" class="x alt" id="share">انسخ اللينك</button><button class="x">اقفل الورقة</button></form>
  <div class="paper"><i class="dot"></i><h2 id="sheetH"></h2><p class="meta" id="sheetMeta"></p><div id="sheetBody"></div><p class="jump"><a id="sheetGo" href="#">روح للمشهد ده في الرحلة</a></p></div>
</dialog>
<dialog id="reelDlg" aria-label="تحت الهوا في 50 ثانية">
  <form method="dialog"><button class="x">اقفل</button></form>
  <video id="reel" poster="vid/showreel-thumb.webp" controls playsinline preload="none"></video>
</dialog>
<dialog id="viewDlg" aria-labelledby="viewH">
  <form method="dialog"><h2 id="viewH">شكل العرض</h2><button class="x">اقفل</button></form>
  <div class="views">
    <button type="button" data-view="lite"><b>قراءة خفيفة</b><span>كل الكلام والصور واللينكات.. من غير 3D ولا فيديو.</span></button>
    <button type="button" data-view="cine"><b>سينمائي متوازن</b><span>الرحلة كاملة.. بحركة ومؤثرات على قد الجهاز.</span></button>
    <button type="button" data-view="high"><b>جودة أعلى</b><span>للأجهزة القوية بس.. نور وتفاصيل أكتر.</span></button>
  </div>
  <p class="more" id="viewNote">اختيارك بيتحفظ على الجهاز ده.</p>
</dialog>
<script type="module" src="ui.js"></script>
</body>
</html>
'''
(ROOT / 'index.html').write_text(page, encoding='utf8')
print(f'index.html: {len(CH)} chapters, {len(page)} bytes')
