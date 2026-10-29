const RECIPIENT = 'info@ghanaeconomicforum.com';
const MAX_BYTES = 16384;
const SINGLE_LINE_CONTROLS = /[\u0000-\u001f\u007f\u2028\u2029]/;
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSubmission(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: { form: 'Please check your submission.' } };
  }
  const fields = {};
  for (const [name, max, required] of [
    ['fullName', 120, true], ['email', 254, true], ['phone', 40, false],
    ['company', 160, false], ['subject', 160, true], ['message', 5000, true]
  ]) {
    const value = input[name] ?? '';
    if (typeof value !== 'string') { errors[name] = 'Please enter text.'; continue; }
    // Preserve international names and message content; email is sent as plain text.
    const clean = value.normalize('NFC').trim().replace(/\r\n?/g, '\n');
    fields[name] = clean;
    if (required && !clean) errors[name] = 'This field is required.';
    else if (clean.length > max) errors[name] = `Please use ${max} characters or fewer.`;
    else if (name !== 'message' && SINGLE_LINE_CONTROLS.test(clean)) errors[name] = 'Please use a single line of text.';
    else if (name === 'message' && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)) errors[name] = 'Please remove unsupported characters.';
  }
  if (fields.email && !EMAIL.test(fields.email)) errors.email = 'Enter a valid email address.';
  if (fields.phone && !/^[+\d\s().-]{5,40}$/.test(fields.phone)) errors.phone = 'Enter a valid phone number.';
  if (typeof input.turnstileToken !== 'string' || !input.turnstileToken || input.turnstileToken.length > 2048) {
    errors.verification = 'Please complete the security check.';
  }
  if (typeof input.submissionId !== 'string' || !UUID.test(input.submissionId)) {
    errors.form = 'Please refresh the page and try again.';
  }
  if (typeof input.website !== 'string' || input.website.trim()) errors.form = 'Unable to accept this submission.';
  return { fields, errors };
}

async function readJson(request) {
  if (!request.body) throw new Error('invalid-json');
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new Error('too-large');
  const reader = request.body.getReader();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); throw new Error('too-large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error('invalid-json'); }
}

function configured(env) {
  return Boolean(env.RESEND_API_KEY && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY &&
    env.CONTACT_RATE_LIMITER && env.MAIL_FROM && !SINGLE_LINE_CONTROLS.test(env.MAIL_FROM));
}

export function createHandler(fetchExternal = globalThis.fetch) {
  return async function handle(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') ||
      (request.method === 'GET' && url.pathname === '/api/config' && allowedOrigins.includes(url.origin) ? url.origin : null);
    const allowed = Boolean(origin && allowedOrigins.includes(origin));
    const headers = {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin', 'X-Request-ID': requestId,
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {})
    };
    const reply = (status, body, extra = {}) => new Response(JSON.stringify({ ...body, requestId }), {
      status, headers: { ...headers, ...extra }
    });
    if (url.pathname === '/health' && request.method === 'GET') return reply(200, { ok: true });
    if (!['/api/contact', '/api/config'].includes(url.pathname)) return reply(404, { error: 'Not found.' });
    if (!allowed) return reply(403, { error: 'This website is not permitted to submit this form.' });
    if (request.method === 'OPTIONS') return reply(200, {}, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600'
    });
    if (!configured(env)) return reply(503, { error: 'Messaging is temporarily unavailable. Please email info@ghanaeconomicforum.com.' });
    if (url.pathname === '/api/config') {
      if (request.method !== 'GET') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, OPTIONS' });
      return reply(200, { turnstileSiteKey: env.TURNSTILE_SITE_KEY });
    }
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });
    try {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return reply(503, { error: 'Unable to verify this request. Please try again later.' });
      const limited = await env.CONTACT_RATE_LIMITER.limit({ key: `contact:${ip}` });
      if (!limited.success) return reply(429, { error: 'Too many attempts. Please wait a minute before trying again.' }, { 'Retry-After': '60' });
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
        return reply(415, { error: 'Please submit the form using this website.' });
      }
      let input;
      try { input = await readJson(request); }
      catch (error) { return reply(error.message === 'too-large' ? 413 : 400, { error: 'Please check the form and shorten your message if needed.' }); }
      const { fields, errors } = validateSubmission(input);
      if (Object.keys(errors).length) return reply(422, { error: 'Please check the highlighted fields.', fields: errors });
      const verification = await fetchExternal('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: input.turnstileToken, remoteip: ip })
      });
      if (!verification.ok) return reply(503, { error: 'The security check is unavailable. Please try again.' });
      const result = await verification.json();
      if (!result.success || result.hostname !== new URL(origin).hostname || result.action !== 'contact') {
        return reply(422, { error: 'Please complete the security check again.', fields: { verification: 'Please complete the security check again.' } });
      }
      // Bind idempotency to the normalized message. Same-message retries cannot send duplicates,
      // and edited messages cannot collide with an earlier uncertain response.
      const payloadDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)));
      const digest = Array.from(new Uint8Array(payloadDigest), byte => byte.toString(16).padStart(2, '0')).join('');
      const email = await fetchExternal('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(12000),
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json',
          'Idempotency-Key': `gef-${input.submissionId}-${digest}` },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [RECIPIENT], reply_to: fields.email,
          subject: `New Contact Form Submission - ${fields.subject}`,
          text: `Name: ${fields.fullName}\nEmail: ${fields.email}\nPhone: ${fields.phone || 'Not provided'}\nCompany: ${fields.company || 'Not provided'}\nSubject: ${fields.subject}\n\nMessage:\n${fields.message}` })
      });
      if (!email.ok) {
        console.warn(JSON.stringify({ event: 'contact_provider_error', requestId, status: email.status }));
        return reply(502, { error: 'We could not send your message. Your details are still here. Please try again or email us directly.' });
      }
      const accepted = await email.json();
      if (typeof accepted.id !== 'string' || !accepted.id) throw new Error('invalid-provider-response');
      return reply(200, { ok: true });
    } catch {
      // Do not log errors containing provider payloads, tokens or user data.
      console.warn(JSON.stringify({ event: 'contact_unavailable', requestId }));
      return reply(503, { error: 'Sending is temporarily unavailable. Your details are still here. Please try again or email us directly.' });
    }
  };
}

export default { fetch: createHandler() };
