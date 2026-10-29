import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

// Regression for the observed production failure: new footer markup with old cached CSS,
// and unbounded inline SVGs becoming viewport-sized when that stylesheet is missing.
test('all pages load matching versioned footer CSS and bound icons even without CSS', async () => {
  const stylesheet = await readFile(new URL('../../assets/css/footer.css', import.meta.url));
  const version = createHash('sha256').update(stylesheet).digest('hex').slice(0, 12);
  let reference;
  for (const page of ['index', 'about', 'speakers', 'contact', 'privacy', 'terms']) {
    const markup = await readFile(new URL(`../../${page}.html`, import.meta.url), 'utf8');
    const dom = new JSDOM(markup);
    try {
      const doc = dom.window.document;
      const link = doc.querySelector('link[href^="assets/css/footer.css"]');
      assert.equal(link?.getAttribute('href'), `assets/css/footer.css?v=${version}`, page);
      const footer = doc.querySelector('.premium-footer');
      assert.ok(footer, page);
      for (const icon of footer.querySelectorAll('svg')) {
        assert.equal(icon.getAttribute('width'), '18'); assert.equal(icon.getAttribute('height'), '18');
      }
      assert.equal(footer.querySelector('img').getAttribute('width'), '174');
      assert.equal(footer.querySelector('img').getAttribute('height'), '51');
      if (reference) assert.equal(footer.outerHTML, reference); else reference = footer.outerHTML;
    } finally { dom.window.close(); }
  }
});
