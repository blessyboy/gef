import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateSubmission } from '../src/index.js';

const ORIGIN = 'https://ghanaeconomicforum.com';
const data = (overrides = {}) => ({ fullName: 'Ama Mensah', email: 'ama@example.com', phone: '+233 20 123 4567',
  company: 'Example Ltd', subject: 'Sponsorship enquiry', message: 'We would like to discuss a partnership.',
  website: '', turnstileToken: 'token', submissionId: '7b37fbaa-dd6b-4b29-b1e3-788fb5fe9687', ...overrides });
const environment = (overrides = {}) => ({ ALLOWED_ORIGINS: `${ORIGIN},https://www.ghanaeconomicforum.com`,
  RESEND_API_KEY: 'test-only', TURNSTILE_SECRET_KEY: 'test-only', TURNSTILE_SITE_KEY: 'public-test-key',
  MAIL_FROM: 'Ghana Economic Forum <contact@ghanaeconomicforum.com>',
  CONTACT_RATE_LIMITER: { limit: async () => ({ success: true }) }, ...overrides });
function request(body = data(), options = {}) {
  return new Request('https://contact.example.com/api/contact', {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...options.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}
function transport({ challenge = { success: true, hostname: 'ghanaeconomicforum.com', action: 'contact' }, mailStatus = 200 } = {}) {
  const calls = [];
  const handler = createHandler(async (url, init) => {
    calls.push({ url, init });
    return url.includes('siteverify') ? Response.json(challenge) : Response.json(mailStatus === 200 ? { id: 'email-id' } : { message: 'private provider details' }, { status: mailStatus });
  });
  return { handler, calls };
}

test('valid message is sent to fixed inbox, with safe sender, reply-to, and exact subject/body', async () => {
  const { handler, calls } = transport();
  const response = await handler(request(data({ to: 'attacker@example.com', from: 'forged@example.com' })), environment());
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  assert.equal(calls.length, 2);
  const message = JSON.parse(calls[1].init.body);
  assert.deepEqual(message.to, ['info@ghanaeconomicforum.com']);
  assert.equal(message.from, 'Ghana Economic Forum <contact@ghanaeconomicforum.com>');
  assert.equal(message.reply_to, 'ama@example.com');
  assert.equal(message.subject, 'New Contact Form Submission - Sponsorship enquiry');
  assert.match(message.text, /Name: Ama Mensah\nEmail: ama@example.com\nPhone: \+233/);
  assert.match(message.text, /Company: Example Ltd\nSubject: Sponsorship enquiry\n\nMessage:\nWe would/);
  assert.equal('html' in message, false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('required fields, length limits, wrong types and invalid email are rejected server-side', () => {
  for (const name of ['fullName', 'email', 'subject', 'message']) assert.ok(validateSubmission(data({ [name]: '  ' })).errors[name]);
  assert.ok(validateSubmission(data({ fullName: 42 })).errors.fullName);
  assert.ok(validateSubmission(data({ email: 'bad@address' })).errors.email);
  assert.ok(validateSubmission(data({ message: 'x'.repeat(5001) })).errors.message);
  assert.ok(validateSubmission(data({ phone: 'not-a-number' })).errors.phone);
  assert.ok(validateSubmission(null).errors.form);
  assert.ok(validateSubmission([]).errors.form);
});

test('header injection is rejected, and markup in message is only plain text', async () => {
  for (const name of ['fullName', 'subject', 'email', 'company']) assert.ok(validateSubmission(data({ [name]: 'value\r\nBcc: attacker@example.com' })).errors[name]);
  const { handler, calls } = transport();
  assert.equal((await handler(request(data({ message: '<script>alert(1)</script>' })), environment())).status, 200);
  assert.match(JSON.parse(calls[1].init.body).text, /<script>/);
  assert.equal(JSON.parse(calls[1].init.body).html, undefined);
});

test('optional fields may be blank; Unicode names and line breaks are preserved', () => {
  const result = validateSubmission(data({ fullName: '  Akosua Osei-Ampofo  ', phone: '', company: '', message: 'First\r\nSecond' }));
  assert.deepEqual(result.errors, {}); assert.equal(result.fields.fullName, 'Akosua Osei-Ampofo'); assert.equal(result.fields.message, 'First\nSecond');
});

test('bad origins and missing Origin cannot send messages', async () => {
  const { handler, calls } = transport();
  assert.equal((await handler(request(data(), { headers: { Origin: 'https://attacker.example' } }), environment())).status, 403);
  const req = request(); req.headers.delete('Origin');
  assert.equal((await handler(req, environment())).status, 403); assert.equal(calls.length, 0);
});

test('allowed CORS preflight and public config work without exposing credentials', async () => {
  const { handler } = transport();
  const preflight = await handler(new Request('https://contact.example.com/api/contact', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), environment());
  assert.equal(preflight.status, 200); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const config = await handler(new Request('https://contact.example.com/api/config', { headers: { Origin: ORIGIN } }), environment());
  const text = await config.text(); assert.match(text, /public-test-key/); assert.doesNotMatch(text, /test-only|RESEND_API_KEY|TURNSTILE_SECRET/);
});

test('misconfiguration fails closed; no pretend email success', async () => {
  const { handler, calls } = transport();
  for (const name of ['RESEND_API_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY', 'MAIL_FROM', 'CONTACT_RATE_LIMITER']) {
    assert.equal((await handler(request(), environment({ [name]: '' }))).status, 503);
  }
  assert.equal(calls.length, 0);
});

test('rate-limited submissions are rejected before calling external services', async () => {
  const { handler, calls } = transport();
  const response = await handler(request(), environment({ CONTACT_RATE_LIMITER: { limit: async () => ({ success: false }) } }));
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60'); assert.equal(calls.length, 0);
});

test('unsupported methods, wrong content type, malformed JSON and large bodies are rejected', async () => {
  const { handler, calls } = transport(); const env = environment();
  assert.equal((await handler(new Request('https://contact.example.com/api/contact', { headers: { Origin: ORIGIN } }), env)).status, 405);
  assert.equal((await handler(request(data(), { headers: { 'Content-Type': 'text/plain' } }), env)).status, 415);
  assert.equal((await handler(request('{'), env)).status, 400);
  assert.equal((await handler(request('x'.repeat(17000)), env)).status, 413);
  assert.equal(calls.length, 0);
});

test('spam trap, missing tokens, invalid submission IDs and missing trusted IP are rejected', async () => {
  const { handler, calls } = transport();
  for (const overrides of [{ website: 'bot' }, { turnstileToken: '' }, { submissionId: 'bad' }]) {
    assert.equal((await handler(request(data(overrides)), environment())).status, 422);
  }
  const req = request();req.headers.delete('CF-Connecting-IP');
  assert.equal((await handler(req, environment())).status, 503); assert.equal(calls.length, 0);
});

test('failed, replayed, wrong-host and wrong-action challenges never send emails', async () => {
  for (const challenge of [{ success: false, 'error-codes': ['timeout-or-duplicate'] },
    { success: true, hostname: 'attacker.example', action: 'contact' }, { success: true, hostname: 'ghanaeconomicforum.com', action: 'login' }]) {
    const { handler, calls } = transport({ challenge });
    assert.equal((await handler(request(), environment())).status, 422); assert.equal(calls.length, 1);
  }
});

test('provider rejection and network failures never return success or expose provider errors', async () => {
  const { handler } = transport({ mailStatus: 403 });
  const response = await handler(request(), environment()); assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private provider details|test-only/);
  const unavailable = createHandler(async () => { throw new Error('secret provider response'); });
  const failed = await unavailable(request(), environment()); assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /secret provider response/);
});

test('same-message retries keep provider idempotency key; edits change it', async () => {
  const { handler, calls } = transport();
  await handler(request(), environment()); await handler(request(), environment());
  await handler(request(data({ message: 'An edited request.' })), environment());
  const keys = calls.filter(x => x.url.includes('resend')).map(x => x.init.headers['Idempotency-Key']);
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2]);
});
