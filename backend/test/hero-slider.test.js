import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../../assets/js/hero-slider.js', import.meta.url), 'utf8');
const sharedScript = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(reduced = false) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://ghanaeconomicforum.com/', pretendToBeVisual: true });
  const { window } = dom; const document = window.document;
  const callbacks = new Map(); let frameId = 0;
  window.requestAnimationFrame = callback => { callbacks.set(++frameId, callback); return frameId; };
  window.cancelAnimationFrame = id => callbacks.delete(id);
  window.matchMedia = () => ({ matches: reduced, addEventListener() {} });
  window.eval(sharedScript);
  window.eval(script);
  function advance(time) { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(time)); }
  const hero = document.getElementById('gef-hero');
  const current = () => [...hero.querySelectorAll('.hero-slide')].findIndex(slide => slide.classList.contains('is-active'));
  return { dom, window, document, hero, current, advance, callbacks };
}

test('exactly three slides, one h1, lazy inactive images and usable static first slide', () => {
  const dom = new JSDOM(html);const d = dom.window.document;
  try {
    assert.equal(d.querySelectorAll('.hero-slide').length, 3);assert.equal(d.querySelectorAll('h1').length, 1);
    assert.ok(d.querySelector('.hero-slide.is-active img').getAttribute('src'));
    assert.equal(d.querySelectorAll('.hero-slide:not(.is-active) img[data-src]').length, 2);
    assert.equal(d.querySelector('.hero-slider-controls').hidden, true);
    assert.equal(d.querySelectorAll('.hero-slide-actions a').length, 6);
  } finally { dom.window.close(); }
});

test('six-second automatic progression loops through all three slides', async () => {
  const s = setup();
  try {
    assert.equal(s.current(), 0);s.advance(100);s.advance(6099);await settle();assert.equal(s.current(), 0);
    s.advance(6100);await settle();assert.equal(s.current(), 1);
    s.advance(6200);s.advance(12200);await settle();assert.equal(s.current(), 2);
    s.advance(12300);s.advance(18300);await settle();assert.equal(s.current(), 0);
  } finally { s.dom.window.close(); }
});

test('manual arrows and dots update slide visibility, focusability, progress and announcements', async () => {
  const s = setup();
  try {
    s.hero.querySelector('[data-hero-next]').click();await settle();assert.equal(s.current(), 1);
    assert.ok(s.hero.querySelector('#hero-slide-2 img').getAttribute('src'));
    assert.equal(s.hero.querySelector('#hero-slide-1').getAttribute('aria-hidden'), 'true');
    assert.equal(s.hero.querySelector('#hero-slide-1 a').tabIndex, -1);
    assert.equal(s.hero.querySelector('#hero-slide-2 a').hasAttribute('tabindex'), false);
    assert.equal(s.hero.dataset.playing, 'false');
    s.hero.querySelector('[data-hero-slide="2"]').click();await settle();assert.equal(s.current(), 2);
    assert.equal(s.hero.querySelector('[data-hero-slide="2"]').getAttribute('aria-current'), 'true');
    assert.match(s.document.getElementById('hero-slider-status').textContent, /Slide 3 of 3/);
    s.hero.querySelector('[data-hero-previous]').click();await settle();assert.equal(s.current(), 1);
  } finally { s.dom.window.close(); }
});

test('reduced motion starts paused; explicit play and pause controls work', () => {
  const s = setup(true);
  try {
    assert.equal(s.hero.dataset.playing, 'false');assert.equal(s.callbacks.size, 0);
    const toggle = s.hero.querySelector('[data-hero-toggle]');assert.match(toggle.getAttribute('aria-label'), /Play/);
    toggle.click();assert.equal(s.hero.dataset.playing, 'true');toggle.click();assert.equal(s.hero.dataset.playing, 'false');
  } finally { s.dom.window.close(); }
});

test('keyboard interaction pauses auto-rotation and supports arrow navigation', async () => {
  const s = setup();
  try {
    s.hero.querySelector('a').focus();assert.equal(s.hero.dataset.playing, 'false');
    s.hero.dispatchEvent(new s.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));await settle();assert.equal(s.current(), 1);
    s.hero.dispatchEvent(new s.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));await settle();assert.equal(s.current(), 0);
  } finally { s.dom.window.close(); }
});

test('horizontal touch swipe changes slides; vertical gestures preserve scrolling', async () => {
  const s = setup();
  const pointer = (type, x, y) => { const event = new s.window.Event(type, { bubbles: true });Object.assign(event, { pointerType: 'touch', pointerId: 1, clientX: x, clientY: y });s.hero.dispatchEvent(event); };
  try {
    pointer('pointerdown', 200, 100);pointer('pointerup', 100, 110);await settle();assert.equal(s.current(), 1);
    pointer('pointerdown', 200, 100);pointer('pointerup', 190, 250);await settle();assert.equal(s.current(), 1);
  } finally { s.dom.window.close(); }
});

test('shared header scroll state activates on scroll', () => {
  const s = setup();
  try {
    assert.equal(s.document.body.classList.contains('hero-slider-ready'), true);
    assert.equal(s.document.body.classList.contains('header-is-scrolled'), false);
    Object.defineProperty(s.window, 'scrollY', { value: 100, configurable: true });s.window.dispatchEvent(new s.window.Event('scroll'));
    assert.equal(s.document.body.classList.contains('header-is-scrolled'), true);
  } finally { s.dom.window.close(); }
});
