import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../../contact.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../../assets/js/contact.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 15));

async function setup({ configured = true, send = async () => Response.json({ ok: true }) } = {}) {
  const dom = new JSDOM(html, { url: 'https://ghanaeconomicforum.com/contact.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.AbortSignal = globalThis.AbortSignal;
  Object.defineProperty(window.crypto, 'randomUUID', { value: randomUUID });
  window.GEF_CONTACT_CONFIG = { apiBaseUrl: configured ? 'https://contact.example.com' : '' };
  const requests = [];
  window.fetch = async (url, init) => {
    if (url.pathname === '/api/config') return Response.json({ turnstileSiteKey: 'public-key' });
    requests.push(JSON.parse(init.body));
    return send(url, init);
  };
  let widget;
  window.turnstile = {
    ready: callback => callback(),
    render: (_, options) => { widget = options; options.callback('verified-token'); return 'widget'; },
    reset: () => queueMicrotask(() => widget.callback('new-token'))
  };
  const append = window.document.head.append.bind(window.document.head);
  window.document.head.append = node => { append(node); queueMicrotask(() => node.onload()); };
  window.eval(script);
  await tick();
  const form = window.document.getElementById('contact-form');
  const status = window.document.getElementById('contact-status');
  const submit = () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  function fill(values = {}) {
    const defaults = { fullName: 'Ama Mensah', email: 'ama@example.com', subject: 'Partnership', message: 'We would like to discuss collaboration.' };
    for (const [key, value] of Object.entries({ ...defaults, ...values })) {
      form.elements.namedItem(key).value = value;
      form.elements.namedItem(key).dispatchEvent(new window.Event('input', { bubbles: true }));
    }
  }
  return { dom, window, form, status, requests, fill, submit, button: form.querySelector('[type=submit]') };
}

test('form stays honest and disabled when live API configuration is missing', async () => {
  const s = await setup({ configured: false });
  try { s.fill(); assert.equal(s.button.disabled, true); assert.match(s.status.textContent, /unavailable/); assert.equal(s.requests.length, 0); }
  finally { s.dom.window.close(); }
});

test('required/email/optional phone validation gates sending and exposes inline errors', async () => {
  const s = await setup();
  try {
    s.fill({ email: 'wrong-email', phone: 'abc' });
    s.form.elements.email.dispatchEvent(new s.window.Event('blur'));
    assert.equal(s.button.disabled, true);
    assert.equal(s.form.elements.email.getAttribute('aria-invalid'), 'true');
    assert.match(s.window.document.getElementById('email-error').textContent, /valid email/);
    s.submit(); assert.equal(s.requests.length, 0);
    s.fill({ phone: '+233 20 123 4567' }); assert.equal(s.button.disabled, false);
  } finally { s.dom.window.close(); }
});

test('successful acceptance sends all fields and clears form only on success; success survives CAPTCHA reset', async () => {
  const s = await setup();
  try {
    s.fill({ company: 'Example Ltd', phone: '+233 20 123 4567' });s.submit();await tick();
    assert.equal(s.requests.length, 1);assert.equal(s.requests[0].fullName, 'Ama Mensah');assert.equal(s.requests[0].company, 'Example Ltd');
    assert.equal(s.requests[0].turnstileToken, 'verified-token');assert.ok(s.requests[0].submissionId);
    assert.equal(s.form.elements.fullName.value, '');
    assert.equal(s.status.textContent, 'Thank you for contacting the Ghana Economic Forum. Our team will respond shortly.');
    assert.equal(s.status.classList.contains('is-success'), true);
    assert.equal(s.window.document.activeElement, s.status);
    assert.equal(s.button.disabled, true);
  } finally { s.dom.window.close(); }
});

test('provider failure preserves all values and enables retry with same submission ID', async () => {
  const s = await setup({ send: async () => Response.json({ error: 'Please try again.' }, { status: 502 }) });
  try {
    s.fill();s.submit();await tick();
    assert.equal(s.form.elements.message.value, 'We would like to discuss collaboration.');assert.match(s.status.textContent, /try again/);
    assert.equal(s.button.disabled, false);s.submit();await tick();
    assert.equal(s.requests[0].submissionId, s.requests[1].submissionId);
  } finally { s.dom.window.close(); }
});

test('server field errors remain visible through challenge reset until edited', async () => {
  const s = await setup({ send: async () => Response.json({ error: 'Check highlighted fields.', fields: { subject: 'Please use a single line of text.' } }, { status: 422 }) });
  try {
    s.fill();s.submit();await tick();
    assert.match(s.window.document.getElementById('subject-error').textContent, /single line/);assert.equal(s.button.disabled, true);
    s.form.elements.subject.value = 'Updated subject';s.form.elements.subject.dispatchEvent(new s.window.Event('input'));
    assert.equal(s.button.disabled, false);
  } finally { s.dom.window.close(); }
});

test('loading locks submitted snapshot and duplicate submit cannot send a second request', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const s = await setup({ send: () => pending });
  try {
    s.fill();s.submit();s.submit();
    assert.equal(s.requests.length, 1);assert.equal(s.button.disabled, true);assert.equal(s.form.getAttribute('aria-busy'), 'true');
    assert.equal(s.form.elements.message.readOnly, true);assert.match(s.button.textContent, /Sending/);
    resolve(Response.json({ ok: true }));await tick();
    assert.equal(s.form.getAttribute('aria-busy'), 'false');assert.equal(s.form.elements.message.readOnly, false);
  } finally { s.dom.window.close(); }
});

test('network errors preserve content and never announce success', async () => {
  const s = await setup({ send: async () => { throw new TypeError('Failed to fetch'); } });
  try {
    s.fill();s.submit();await tick();assert.equal(s.form.elements.fullName.value, 'Ama Mensah');
    assert.equal(s.status.classList.contains('is-success'), false);assert.match(s.status.textContent, /could not confirm/);
  } finally { s.dom.window.close(); }
});
