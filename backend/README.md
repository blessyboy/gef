# Ghana Economic Forum contact API

The static website calls a separate Cloudflare Worker. The Worker verifies the visitor with Turnstile, validates the request, and sends a plain-text message through Resend to **info@ghanaeconomicforum.com**. No application database or contact-message cache is used. The recipient cannot be overridden by the browser.

## Activate live sending

1. In Resend, verify a sending domain you control (for example `ghanaeconomicforum.com`) using the DNS records Resend supplies. Use a sending-only API key, restricted to that domain where supported. Set `MAIL_FROM` in `wrangler.toml` to a sender on the verified domain. Do not use the visitor's address as the sender: it is passed as `reply_to`.
2. Create a managed Cloudflare Turnstile widget permitting `ghanaeconomicforum.com` and `www.ghanaeconomicforum.com`. Put its **public site key** in `TURNSTILE_SITE_KEY` in `wrangler.toml`. The expected widget action is `contact`.
3. From this `backend` directory, install and log in:

   ```powershell
   npm.cmd ci
   npx.cmd wrangler login
   npx.cmd wrangler secret put RESEND_API_KEY
   npx.cmd wrangler secret put TURNSTILE_SECRET_KEY
   ```

   Paste each secret only into the CLI's secret prompt. Never add secrets to HTML, JavaScript, Git, public build variables, or chat. For local Wrangler development only, copy `.dev.vars.example` to ignored `.dev.vars` and replace values locally.

4. Review the exact production origins in `ALLOWED_ORIGINS`. Reserve the rate-limit namespace `10429` for this Worker or choose another unused positive integer. Run checks and package the Worker:

   ```powershell
   npm.cmd test
   npx.cmd wrangler deploy --dry-run --outdir .wrangler/build
   npx.cmd wrangler deploy
   ```

5. Copy the returned HTTPS Worker origin into **only** `apiBaseUrl` in `../assets/js/contact-config.js`. Example: `https://gef-contact-api.YOUR-SUBDOMAIN.workers.dev`. A custom API subdomain works too. Leave out `/api/contact`; the frontend supplies route paths. Deploy frontend files separately to the existing static host. A browser-opened `file://` page cannot submit; use HTTPS or an explicitly permitted local development origin.
6. On the live Contact page, send a real message you authorize, confirm it reaches `info@ghanaeconomicforum.com`, and reply to confirm the visitor's Reply-To address. The inbox owner should confirm receipt. Review the Resend delivery event and check spam/quarantine. Verify SPF/DKIM and configure DMARC through your domain administrator. API acceptance is not proof of inbox delivery.

This implementation has **not** provisioned accounts/DNS, stored credentials, deployed a Worker, or sent a live email. Until the steps above are complete, the form preserves values and provides the direct email/phone alternative; it never claims a message was sent.

## API contract

- `GET /health`: public liveness check; does not assert provider configuration or delivery health.
- `GET /api/config`: allowed-origin configuration request; returns only the public Turnstile site key. Returns 503 if required server configuration is missing.
- `POST /api/contact`: JSON body with `fullName`, `email`, `phone`, `company`, `subject`, `message`, empty `website` honeypot, `turnstileToken`, and a UUID-v4 `submissionId`. Required text: fullName, email, subject, message. Response is `{ ok: true, requestId }` only after Resend accepts the message.
- Errors return `{ error, requestId, fields? }`. Statuses: 400 invalid JSON, 403 forbidden origin, 405 wrong method, 413 oversized body, 415 unsupported media type, 422 invalid fields/security check, 429 rate limit, 502 email-provider rejection, 503 unconfigured/unavailable service. Error responses never echo secrets, provider bodies, or contact details.

Subject: `New Contact Form Submission - [subject]`. Body includes Name, Email, Phone, Company, Subject and Message. User text is normalized and length/type checked, single-line fields reject control characters, and email is plain text to prevent HTML execution. International names and meaningful message text are preserved.

## Abuse prevention and reliability

- Cloudflare's trusted `CF-Connecting-IP` is required. Never deploy this handler on an untrusted proxy that lets visitors choose this header. The Worker binding allows approximately five requests per minute per IP **per Cloudflare location**. It is not a strict global counter. Add account-level WAF rules/budget alerts for large or distributed attacks.
- Turnstile tokens are verified server-side on every submission, including expected hostname/action. Expired/replayed tokens fail closed. Origin allowlisting is a browser boundary, not a replacement for bot checks.
- Honeypot, bounded streaming request parsing (16 KiB), 5000-character messages, and timeouts bound request cost. This is a public enquiry service; authentication is intentionally unnecessary. No cookies or credentials are accepted.
- A stable per-form UUID and content hash become the Resend idempotency key. Retrying an uncertain request for the same message retains that key. The key changes after successful submission or if content changes; no message data is persisted in browser storage. Provider idempotency only applies within its supported retention window.
- The UI locks the submitted snapshot during sending, blocks duplicate submits, retains fields on failure, resets the security check for retry, and clears fields only on confirmed API acceptance. Required-field validity and security checks gate the button.
- Application logs contain only error categories, HTTP status, and request IDs. No contact payloads, email addresses, IP values, tokens or credentials are logged by application code. Configure provider/host log retention to suit your policies.
- There is no background queue in this minimal version. Provider failures surface to the visitor for retry; monitor bounces and rejected messages in Resend. A queue can be added if guaranteed deferred retries become a requirement.

## Separate deployment and monitoring

Keep the current static frontend deployment. Deploy only `backend` as a Worker; no Docker image, Kubernetes cluster, database, or PHP server is required. GitHub Actions runs static link checks, script syntax checks, and handler tests before deployment. Do not publish the repository root as a Worker asset directory or expose local secret files through a static server.

Monitor `/health`, Worker 429/5xx counts, Turnstile failures and Resend delivery/bounce events; alert on sustained failures or unexpected sending volume. Retain a previous Worker version for rollback. Rotate sending keys when access changes. An automated health check must not repeatedly send email.

If you enforce CSP headers on the frontend, permit `https://challenges.cloudflare.com` in `script-src` and `frame-src`, and permit the deployed API origin in `connect-src`; keep `default-src 'self'`, `object-src 'none'`, and `base-uri 'self'`. The form uses external scripts only for Turnstile and never requires inline scripts. Verify your exact CSP in the deployment preview.

## Tests

```powershell
npm.cmd test
```

Handler tests use mocked Turnstile/Resend transports, so they do not send email. DOM tests exercise the actual HTML and frontend JavaScript with simulated provider responses. These verify logic, not rendered layouts, native focus behavior, live CAPTCHA, or actual email delivery. Test desktop/tablet/mobile layouts and keyboard flow in a real browser before release.

Provider references: [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Worker rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
