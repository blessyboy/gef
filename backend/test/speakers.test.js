import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const script = await readFile(new URL('../../assets/js/speakers.js', import.meta.url), 'utf8');
const profiles = JSON.parse(await readFile(new URL('../../assets/speakers/profiles.json', import.meta.url), 'utf8'));
async function page(name = 'speakers', dialogSupport = true) {
  const dom = new JSDOM(await readFile(new URL(`../../${name}.html`, import.meta.url), 'utf8'), { runScripts: 'outside-only', url: `https://ghanaeconomicforum.com/${name}.html`, pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const dialog = window.document.getElementById('speaker-dialog');
  // Simulate the dialog API for controller tests; this does not validate native browser trapping.
  if (dialogSupport) {
    dialog.showModal = () => { dialog.setAttribute('open', ''); dialog.querySelector('button').focus(); };
    dialog.close = () => { dialog.removeAttribute('open'); dialog.dispatchEvent(new window.Event('close')); };
  } else dialog.showModal = undefined;
  window.eval(script);
  return { dom, window, document: window.document, dialog };
}

test('both pages preserve the same 22 speakers, original order, and unchanged first portrait', async () => {
  let reference;
  for (const name of ['index', 'speakers']) {
    const p = await page(name);
    try {
      const cards = [...p.document.querySelectorAll('.speaker-card')];
      assert.equal(cards.length, 22);
      assert.deepEqual(cards.map(card => card.dataset.speaker), profiles.map(profile => profile.slug));
      assert.equal(cards[0].querySelector('h3').textContent, 'John Dramani Mahama');
      assert.equal(cards[0].querySelector('img').getAttribute('src'), 'assets/john-dramani-mahama.png');
      assert.equal(cards.filter(card => card.classList.contains('speaker-card-featured')).length, 1);
      const snapshot = cards.map(card => card.outerHTML);
      if (reference) assert.deepEqual(snapshot, reference); else reference = snapshot;
      for (const card of cards) {
        assert.ok(card.querySelector('img').alt); assert.ok(card.querySelector('.speaker-title'));
        assert.ok(card.querySelector('.speaker-organization')); assert.ok(card.querySelector('.speaker-category'));
        assert.equal(card.querySelector('button').hidden, false);
        assert.equal(card.querySelector('button').textContent.trim(), '');
        assert.equal(card.querySelector('button').querySelector('svg, span'), null);
        assert.ok(card.querySelector('button').getAttribute('aria-label'));
      }
    } finally { p.dom.window.close(); }
  }
});

test('every profile opens correct role/image and close returns focus to its own button', async () => {
  const p = await page();
  try {
    for (const profile of profiles) {
      const opener = p.document.querySelector(`[data-open-speaker="${profile.slug}"]`);
      opener.click();
      assert.equal(p.dialog.hasAttribute('open'), true);
      assert.equal(p.document.getElementById('speaker-dialog-name').textContent, profile.name);
      assert.equal(p.document.getElementById('speaker-dialog-role').textContent, profile.title);
      assert.equal(p.document.querySelector('#speaker-dialog-photo img').getAttribute('src'), profile.image);
      assert.match(p.document.getElementById('speaker-dialog-biography').textContent, /Biography to be announced/);
      assert.equal(p.document.getElementById('speaker-dialog-socials').hidden, true);
      p.dialog.querySelector('.speaker-dialog-close').click();
      assert.equal(p.document.activeElement, opener);
      assert.equal(p.document.body.classList.contains('speaker-dialog-open'), false);
    }
  } finally { p.dom.window.close(); }
});

test('filters update visible cards, pressed state and announcement without removing profiles', async () => {
  const p = await page('index');
  try {
    p.document.querySelector('[data-speaker-filter="Energy"]').click();
    const visible = [...p.document.querySelectorAll('.speaker-card')].filter(card => !card.hidden);
    assert.equal(visible.length, profiles.filter(profile => profile.category === 'Energy').length);
    assert.ok(visible.every(card => card.dataset.category === 'Energy'));
    assert.equal(p.document.querySelectorAll('[data-speaker-filter][aria-pressed="true"]').length, 1);
    assert.match(p.document.getElementById('speaker-result-count').textContent, /Energy/);
    p.document.querySelector('[data-speaker-filter="All"]').click();
    assert.equal([...p.document.querySelectorAll('.speaker-card')].filter(card => !card.hidden).length, 22);
  } finally { p.dom.window.close(); }
});

test('unsupported dialog API leaves static speaker content without dead profile buttons', async () => {
  const p = await page('speakers', false);
  try {
    assert.equal(p.document.querySelectorAll('.speaker-card').length, 22);
    assert.ok([...p.document.querySelectorAll('.speaker-open')].every(button => button.hidden));
  } finally { p.dom.window.close(); }
});
