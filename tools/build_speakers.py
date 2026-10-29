"""Refresh both static speaker showcases after editing assets/speakers/profiles.json."""
from pathlib import Path
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
profiles = json.loads((ROOT / 'assets/speakers/profiles.json').read_text(encoding='utf-8'))
assert profiles[0]['slug'] == 'john-dramani-mahama', 'Keep the first speaker.'
assert len({p['slug'] for p in profiles}) == len(profiles), 'Duplicate speaker IDs.'


def card(profile):
    p = {key: html.escape(str(value), quote=True) for key, value in profile.items()}
    featured = profile.get('featured', False)
    frame = '' if featured else ' frame-' + p['slug']
    badge = '<span class="speaker-featured-badge">Featured Speaker</span>' if featured else ''
    organization = p['organization'] or '<span aria-hidden="true">&#8212;</span><span class="sr-only">Organization not provided</span>'
    return (
        f'<article class="speaker speaker-card{" speaker-card-featured" if featured else ""}" '
        f'data-category="{p["category"]}" data-speaker="{p["slug"]}">'
        f'<div class="portrait speaker-photo{frame}"><img src="{p["image"]}" alt="{p["name"]}" '
        f'width="400" height="450" loading="lazy">{badge}</div><div class="speaker-card-body">'
        f'<span class="speaker-category category-{p["category"].lower()}">{p["category"]}</span>'
        f'<h3>{p["name"]}</h3><p class="speaker-title">{p["title"]}</p>'
        f'<p class="speaker-organization">{organization}</p><button class="speaker-open" type="button" '
        f'data-open-speaker="{p["slug"]}" aria-label="Open speaker details: {p["name"]}" aria-haspopup="dialog" '
        'aria-controls="speaker-dialog" hidden></button></div></article>'
    )


data = json.dumps(profiles, ensure_ascii=True).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
for name in ['index.html', 'speakers.html']:
    path = ROOT / name
    page = path.read_text(encoding='utf-8')
    page, count = re.subn(r'<div class="speaker-grid">.*?</div><p class="speaker-content-note">',
                          lambda _: '<div class="speaker-grid">' + ''.join(map(card, profiles)) + '</div><p class="speaker-content-note">',
                          page, count=1, flags=re.S)
    assert count == 1, name
    page = re.sub(r'(<script type="application/json" id="speaker-profile-data">).*?(</script>)',
                  lambda m: m[1] + data + m[2], page, flags=re.S)
    page = re.sub(r'\d+ speakers &#183; Ideas that move us forward', f'{len(profiles)} speakers &#183; Ideas that move us forward', page)
    for asset in ['assets/css/speakers.css', 'assets/js/speakers.js']:
        version = hashlib.sha256((ROOT / asset).read_bytes()).hexdigest()[:12]
        page = re.sub(re.escape(asset) + r'(?:\?v=[a-f0-9]+)?', lambda _: asset + '?v=' + version, page)
    path.write_text(page, encoding='utf-8')
print(f'Updated both static showcases with {len(profiles)} speakers.')
