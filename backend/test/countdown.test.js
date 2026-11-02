import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../../assets/js/countdown.js', import.meta.url), 'utf8');
const target = Date.parse('2026-11-10T08:00:00Z');
function setup(now) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;let current = now, tick, active = false, period;
  window.Date.now = () => current;
  window.matchMedia = () => ({ matches: true });
  window.setInterval = (callback, milliseconds) => { tick = callback;active = true;period = milliseconds;return 1; };
  window.clearInterval = () => { active = false; };
  window.eval(script);
  return { dom, window, section: window.document.querySelector('.event-countdown'),
    numbers: () => [...window.document.querySelectorAll('[data-countdown]')].map(x => x.textContent),
    setTime: next => { current = next;tick?.(); }, interval: () => period, active: () => active };
}

test('old event strip is removed and correct date/location/invitation remain accessible without scripts', () => {
  const dom = new JSDOM(html);
  try {
    const d = dom.window.document;assert.equal(d.querySelector('.event-strip'), null);
    assert.equal(d.querySelector('.event-countdown').dataset.eventStart, '2026-11-10T08:00:00Z');
    assert.equal(d.querySelectorAll('.countdown-card').length, 4);
    assert.match(d.querySelector('.countdown-event-details').textContent, /8:00 AM.*Accra, Ghana/);
    assert.equal(d.querySelector('.countdown-invitation').textContent, 'STRICTLY BY INVITATION');
    assert.equal(d.querySelector('[role=timer]').getAttribute('aria-live'), 'off');
  } finally { dom.window.close(); }
});

test('remaining days/hours/minutes/seconds use the explicit Accra UTC timestamp', () => {
  const seconds = 2 * 86400 + 8 * 3600 + 45 * 60 + 30;
  const s = setup(target - seconds * 1000);
  try { assert.deepEqual(s.numbers(), ['02', '08', '45', '30']);assert.equal(s.interval(), 1000); }
  finally { s.dom.window.close(); }
});

test('clock-based updates handle rollovers and skipped timer ticks without drifting', () => {
  const s = setup(target - 86400 * 1000);
  try {
    assert.deepEqual(s.numbers(), ['01', '00', '00', '00']);
    s.setTime(target - 86399 * 1000);assert.deepEqual(s.numbers(), ['00', '23', '59', '59']);
    s.setTime(target - 61 * 1000);assert.deepEqual(s.numbers(), ['00', '00', '01', '01']);
    s.setTime(target - 1000);assert.deepEqual(s.numbers(), ['00', '00', '00', '01']);
  } finally { s.dom.window.close(); }
});

test('completion stops updates, clamps at zero and announces the event start', () => {
  const s = setup(target - 1000);
  try {
    s.setTime(target);assert.deepEqual(s.numbers(), ['00', '00', '00', '00']);assert.equal(s.active(), false);
    assert.equal(s.section.querySelector('[role=status]').textContent, 'The Event Has Started');
    s.setTime(target + 86400 * 1000);assert.deepEqual(s.numbers(), ['00', '00', '00', '00']);
  } finally { s.dom.window.close(); }
});

test('visitors arriving after the opening see the started state immediately without an interval', () => {
  const s = setup(target + 1);
  try { assert.equal(s.active(), false);assert.equal(s.section.classList.contains('is-started'), true);assert.deepEqual(s.numbers(), ['00', '00', '00', '00']); }
  finally { s.dom.window.close(); }
});
