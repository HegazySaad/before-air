#!/usr/bin/env python3
"""جرد مرجعي للنصوص والروابط والوسائط من صفحة HTML.

  python3 tools/inventory.py index.html > inventory.json
  python3 tools/inventory.py --diff old.json new.json
"""
import sys, json, collections
from html.parser import HTMLParser

SKIP = {'script', 'style'}


class Inv(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0; self.sec = ''; self.text = []; self.links = []; self.media = []; self.sections = []; self.metas = []

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag in SKIP: self.skip += 1
        if tag == 'section' and a.get('id'): self.sec = a['id']; self.sections.append(a['id'])
        if tag == 'a' and a.get('href'): self.links.append(a['href'])
        if tag in ('img', 'video', 'source') and a.get('src'): self.media.append(a['src'])
        if tag == 'video' and a.get('poster'): self.media.append(a['poster'])
        for k in ('data-img', 'data-sats', 'data-wall'):
            if a.get(k): self.media += [x for x in a[k].split(',') if x]
        for k in ('data-paper', 'data-name', 'data-year', 'aria-label', 'alt', 'content'):
            if a.get(k) and (k != 'content' or a.get('name') == 'description' or 'og:' in a.get('property', '')):
                self.metas.append(f'{k}={a[k]}')

    def handle_endtag(self, tag):
        if tag in SKIP: self.skip -= 1
        if tag == 'section': self.sec = ''

    def handle_data(self, d):
        d = ' '.join(d.split())
        if d and not self.skip: self.text.append(d)


def inv(path):
    p = Inv(); p.feed(open(path, encoding='utf8').read())
    return {'sections': p.sections, 'text': p.text, 'links': p.links, 'media': p.media, 'attrs': p.metas}


def diff(a, b):
    ok = True
    if a['sections'] != b['sections']:
        print('SECTIONS differ:\n  old', a['sections'], '\n  new', b['sections']); ok = False
    for k in ('text', 'links', 'media', 'attrs'):
        ca, cb = collections.Counter(a[k]), collections.Counter(b[k])
        gone, added = ca - cb, cb - ca
        print(f'{k}: old {sum(ca.values())} ({len(ca)} unique) / new {sum(cb.values())} ({len(cb)} unique)')
        for x, n in gone.items(): print(f'  - [{n}] {x}'); ok = ok and k not in ('text', 'links')
        for x, n in added.items(): print(f'  + [{n}] {x}')
    ext = lambda d: [x for x in d['links'] if x.startswith('http')]
    print('https link occurrences:', len(ext(a)), '->', len(ext(b)))
    return ok


if __name__ == '__main__':
    if sys.argv[1] == '--diff':
        sys.exit(0 if diff(json.load(open(sys.argv[2])), json.load(open(sys.argv[3]))) else 1)
    json.dump(inv(sys.argv[1]), sys.stdout, ensure_ascii=False, indent=1)
