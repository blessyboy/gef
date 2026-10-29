'use strict';
(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const button = form.querySelector('[type="submit"]');
  const buttonText = button.querySelector('[data-button-text]');
  const status = document.getElementById('contact-status');
  const names = ['fullName', 'email', 'phone', 'company', 'subject', 'message'];
  const inputs = Object.fromEntries(names.map(name => [name, form.elements.namedItem(name)]));
  const touched = new Set();
  const serverErrors = new Map();
  let sending = false, ready = false, token = '', widgetId;
  let submissionId = crypto.randomUUID?.() || '';
  let api;

  function message(text, kind = 'info', focus = false) {
    status.textContent = text;
    status.className = `contact-feedback is-${kind}`;
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    if (focus) status.focus({ preventScroll: false });
  }
  function errorFor(name) {
    const field = inputs[name];
    if (field.required && !field.value.trim()) return 'This field is required.';
    if (field.value.length > field.maxLength && field.maxLength > 0) return `Please use ${field.maxLength} characters or fewer.`;
    if (name === 'email' && field.value && (!field.validity.valid || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(field.value.trim()))) return 'Enter a valid email address.';
    if (name === 'phone' && field.value.trim() && !/^[+\d\s().-]{5,40}$/.test(field.value.trim())) return 'Enter a valid phone number.';
    return '';
  }
  function fieldError(name, text) {
    inputs[name].setAttribute('aria-invalid', String(Boolean(text)));
    document.getElementById(`${name}-error`).textContent = text;
  }
  function update() {
    let valid = true;
    for (const name of names) {
      const error = serverErrors.get(name) || errorFor(name);
      if (error) valid = false;
      if (touched.has(name)) fieldError(name, error);
    }
    button.disabled = sending || !ready || !token || !valid;
  }
  for (const name of names) {
    inputs[name].addEventListener('blur', () => { touched.add(name); update(); });
    inputs[name].addEventListener('input', () => { serverErrors.delete(name); update(); });
  }
  function resetVerification() {
    token = '';
    if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
    update();
  }
  async function initialize() {
    const base = window.GEF_CONTACT_CONFIG?.apiBaseUrl;
    if (!base) {
      message('Online messaging is currently unavailable. Please email info@ghanaeconomicforum.com or call the team.', 'info');
      return;
    }
    try {
      api = new URL(base);
      if (api.protocol !== 'https:' && !(api.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(api.hostname))) throw new Error('Invalid API address');
      if (location.protocol === 'file:') {
        message('Please use the live website to send a message, or email info@ghanaeconomicforum.com directly.', 'info'); return;
      }
      const response = await fetch(new URL('/api/config', api), { signal: AbortSignal.timeout(10000), credentials: 'omit' });
      const config = await response.json();
      if (!response.ok || !config.turnstileSiteKey || !submissionId) throw new Error('Unavailable');
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onerror = () => message('The security check could not load. Please retry or email the team directly.', 'error');
      script.onload = () => {
        window.turnstile.ready(() => {
          widgetId = window.turnstile.render('#contact-verification', {
            sitekey: config.turnstileSiteKey, action: 'contact', theme: 'light', size: 'flexible',
            callback(value) { token = value; ready = true; if (status.classList.contains('is-info')) message('Complete the required fields to send your message.'); update(); },
            'expired-callback'() { token = ''; message('Please complete the security check again.'); update(); },
            'error-callback'() { token = ''; message('Please retry the security check or email us directly.', 'error'); update(); }
          });
        });
      };
      document.head.append(script);
      message('Complete the security check and required fields to send your message.');
    } catch {
      message('Online messaging is temporarily unavailable. Please email info@ghanaeconomicforum.com or call the team.', 'error');
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    names.forEach(name => touched.add(name)); update();
    const invalid = names.find(name => serverErrors.has(name) || errorFor(name));
    if (invalid) { inputs[invalid].focus(); return; }
    if (!ready || !token || !api) { message('Please complete the security check before sending.', 'error', true); return; }
    sending = true; update();
    form.setAttribute('aria-busy', 'true');
    // Lock the submitted snapshot so edits made during a request cannot be accidentally cleared.
    names.forEach(name => { inputs[name].readOnly = true; });
    buttonText.textContent = 'Sending message…';
    button.classList.add('is-sending');
    message('Sending your message securely…');
    try {
      const payload = Object.fromEntries(names.map(name => [name, inputs[name].value.trim()]));
      payload.website = form.elements.namedItem('website').value;
      payload.turnstileToken = token;
      payload.submissionId = submissionId;
      const response = await fetch(new URL('/api/contact', api), {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        if (result.fields) for (const name of names) if (typeof result.fields[name] === 'string') { serverErrors.set(name, result.fields[name]); fieldError(name, result.fields[name]); }
        const fallback = response.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'We could not send your message. Please try again or email the team directly.';
        throw new Error(typeof result.error === 'string' ? result.error : fallback);
      }
      form.reset(); touched.clear(); serverErrors.clear(); names.forEach(name => fieldError(name, ''));
      submissionId = crypto.randomUUID();
      message('Thank you for contacting the Ghana Economic Forum. Our team will respond shortly.', 'success', true);
    } catch (error) {
      message(error.name === 'TimeoutError' || error instanceof TypeError ? 'We could not confirm sending. Your message is preserved. Please retry, or email us directly.' : error.message, 'error', true);
    } finally {
      sending = false; form.setAttribute('aria-busy', 'false');
      names.forEach(name => { inputs[name].readOnly = false; });
      buttonText.textContent = 'Send Message'; button.classList.remove('is-sending'); resetVerification();
    }
  });
  initialize(); update();
})();
