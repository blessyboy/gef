from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
root = Path(__file__).resolve().parents[1]
class Page(HTMLParser):
 def __init__(self, path):
  super().__init__(); self.path=path; self.refs=[]; self.ids=set(); self.h1=0; self.errors=[]
 def handle_starttag(self, tag, attrs):
  a=dict(attrs)
  if 'id' in a:
   if a['id'] in self.ids:self.errors.append('Duplicate id '+a['id'])
   self.ids.add(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='img' and 'alt' not in a:self.errors.append('Image missing alt')
  for key in ['href','src']:
   if a.get(key):self.refs.append(a[key])
pages={}
for name in [p.name for p in sorted(root.glob('*.html'))]:
 p=Page(root/name);p.feed(p.path.read_text(encoding='utf-8'));pages[name]=p
errors=[]
for name,p in pages.items():
 errors += [name+': '+e for e in p.errors]
 if p.h1!=1:errors.append(name+': expected one h1')
 for ref in p.refs:
  u=urlsplit(ref)
  if u.scheme or u.netloc:continue
  target=(p.path.parent/unquote(u.path)).resolve() if u.path else p.path
  if not target.is_relative_to(root) or not target.exists():errors.append(name+': missing '+ref)
  if u.fragment and target.name in pages and u.fragment not in pages[target.name].ids:errors.append(name+': missing fragment '+ref)
 assert 'https://epay.thebftonline.com' in p.path.read_text(encoding='utf-8')
if errors:raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} pages; local links, fragments, scripts, styles and images exist; one h1 per page; all images have alt attributes; registration present.')
