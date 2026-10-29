# Ghana Economic Forum

A responsive event website with four main pages and two information pages built with HTML, CSS, Bootstrap 4.1.3 and small vanilla JavaScript enhancements. The frontend needs no build or dependency installation. The contact form uses a separately deployed Cloudflare Worker and Resend; see `backend/README.md`.

## Preview

Open `index.html` directly, or serve the directory:

```powershell
cd "C:\Users\User\Desktop\My Projects\gef"
python -m http.server 8080 --bind 127.0.0.1
```

Visit http://127.0.0.1:8080. Stop with Ctrl+C.

## Pages and architecture

- `index.html`: event introduction, themes, speaker preview, GH? 3,000 ticket, and FAQ.
- `about.html`: history and purpose.
- `speakers.html`: 22 speaker profiles, with accessible sector filters.
- `contact.html`: accessible contact form, contact/social links and registration information.
- `assets/js/contact.js`: validation, Turnstile, submission/loading/retry/success states.
- `assets/js/contact-config.js`: public API origin (no credentials).
- `backend/`: separate Worker API, Resend integration, abuse prevention and automated tests.
- `assets/css/styles.css`: shared design tokens, responsive component styles and reduced-motion support.
- `assets/js/main.js`: mobile navigation and speaker filters. Pages and links remain usable without JavaScript; all speakers display by default.
- `assets/vendor/bootstrap.min.css`: locally served Bootstrap CSS, including original licence notice.

Shared page structures are deliberately plain HTML: `.site-header`, `.hero`, `.topic`, `.speaker`, `.ticket-card`, `.site-footer`. The speaker-filter API uses `data-category` on profiles and `data-filter` on buttons. Use the existing profile markup to add speakers, preserving an accessible portrait name. Current navigation links use `aria-current="page"`.

## Decisions and tradeoffs

The frontend stays static for inexpensive CDN hosting. Contact submissions go through a separate Cloudflare Worker to Resend, with no application database or stored message cache. Payment processing stays external. Navigation/footer HTML is repeated across four files to keep each page independently usable. A future templating/build system can centralize it if the website expands. Bootstrap is local; custom CSS and a small script provide the design and interactions without jQuery or a Bootstrap JavaScript dependency.

Registration links point to https://epay.thebftonline.com (correcting the supplied `httpe://` typo); the address returned HTTP 200 during implementation. Payment processing stays with the external provider. No checkout transaction has been tested.

## Content review

Source: https://ghanaeconomicforum.com and its About and Contact pages, reviewed 29 October 2026. Ticket price follows the user?s instruction, overriding the old source-site price. The event date is 10 - 11 November, 2026, as supplied by the user. Attendance is Strictly By Invitation. The venue remains marked for confirmation. Speaker profiles were updated from the user-supplied artwork in `speaker images`; John Dramani Mahama remains first with the previously supplied photo. The 14 individual posters and 7 additional unique profiles from the lineup poster are framed with CSS, preserving all original artwork. Names, positions, source paths and frame coordinates are recorded in `assets/speakers/manifest.json`. No local logo was present at kickoff; the official logo was retrieved from the source website.

Before release, confirm the event date, venue, speaker lineup/roles, ticket inclusions, contact details and image rights. Replace provisional content in each HTML file. The conference audience photograph is an illustrative asset from the source website media library, not a verified photograph of GEF. All prices can be found by searching `3,000`; all registration links by searching `epay.thebftonline.com`.

## Hosting and production

Deploy the six HTML pages and `assets/` to the existing static host over HTTPS. Deploy `backend/` separately as a Cloudflare Worker. Configure Resend/Turnstile secrets only in the backend; set the public API origin in `assets/js/contact-config.js` after deployment. See `backend/README.md` for exact setup commands, security decisions, API contract and release checks. The form is intentionally unavailable until configured and never reports a fake success.

Use short cache lifetimes for HTML, cache local assets with revalidation, and add versioned asset names before enabling immutable caching. Configure `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP allowing self-hosted scripts/styles/images (the contact page currently has two inline style attributes). Prefer CSP response headers; allow only the external destinations actually needed. Enable HSTS after HTTPS/domain verification. No secrets belong in this repository.

For CI, validate local links/assets and JavaScript syntax on each change, then deploy a preview for mobile/desktop keyboard and visual review. Keep the previous static deployment for immediate rollback. Monitor homepage availability and periodically verify the external registration URL. Containers, Kubernetes, databases and caching services are unnecessary for the current static scope.

## Validation

Run `python tools/validate.py`, `node --check assets/js/main.js`, and `npm.cmd test` from `backend`. The contact API and frontend behavior have 20 automated tests using mocked external services; the Worker deployment dry run passed. Actual email delivery has not been tested or configured. Browser automation was unavailable in this session; responsive visual behavior and interactive keyboard behavior still require browser QA before production release.

The homepage background uses a 1200 x 720 illustrative photograph of the Inclusive FinTech Forum auditorium in Kigali, sourced directly from the conference organiser. Its source is recorded in `asset-sources.json`. The green gradient overlay preserves text contrast.

## Shared footer

All six pages share the same `.premium-footer` markup and scoped responsive CSS. The container is limited to 1200px; the grid uses four columns on desktop, two on tablet, and a centered single column on mobile. The logo keeps its natural aspect ratio. Contact icons and social symbols are inline SVGs, with accessible link names and no external icon dependency. Hover transitions respect reduced-motion preferences.

The footer Programme link targets the homepage programme overview. Privacy and Terms links open `privacy.html` and `terms.html`. Social links use B&FT channels. Per the user?s instruction, there are no working hours or newsletter subscription elements.

## Contact form activation

The premium Contact Us section is implemented locally. It uses explicit labels, field-level validation, accessible status feedback, responsive single/two-column layouts, and preserved values after errors. Privacy text now describes contact submissions and the Cloudflare/Resend processing path. No hours or newsletter were introduced.

Live email is pending configuration, not complete: verify your domain in Resend, configure a managed Turnstile widget, save backend secrets, deploy the Worker, set its public origin in `assets/js/contact-config.js`, and deploy the static frontend. See `backend/README.md`. A successful API response confirms provider acceptance, not eventual inbox delivery. Verify a live message with the receiving inbox owner before release.

## Footer stylesheet deployment

The footer styles live in `assets/css/footer.css`, loaded independently on all six pages with a content-hash query version. Shared and Contact styles also use versioned URLs to avoid old cached CSS after publishing. Deploy all six HTML files and the CSS files together; publishing only HTML leaves new markup paired with old styles. The live site was observed serving an old 16,423-character shared stylesheet with a four-hour cache lifetime while serving newer footer HTML. Inline SVG dimensions now provide safe fallback sizing even if CSS fails.

Run `npm.cmd test` in `backend` for the footer regression check: it verifies matching stylesheet versions across every page and safe icon/logo dimensions without CSS. This check does not establish responsive visual rendering; browser QA remains required at phone, tablet, desktop and browser zoom sizes.
