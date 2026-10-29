# Ghana Economic Forum

A four-page, responsive event website built with HTML, CSS, Bootstrap 4.1.3 and small vanilla JavaScript enhancements. No build or dependency installation is needed.

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
- `contact.html`: telephone, email, map and registration links.
- `assets/css/styles.css`: shared design tokens, responsive component styles and reduced-motion support.
- `assets/js/main.js`: mobile navigation and speaker filters. Pages and links remain usable without JavaScript; all speakers display by default.
- `assets/vendor/bootstrap.min.css`: locally served Bootstrap CSS, including original licence notice.

Shared page structures are deliberately plain HTML: `.site-header`, `.hero`, `.topic`, `.speaker`, `.ticket-card`, `.site-footer`. The speaker-filter API uses `data-category` on profiles and `data-filter` on buttons. Use the existing profile markup to add speakers, preserving an accessible portrait name. Current navigation links use `aria-current="page"`.

## Decisions and tradeoffs

Static files are appropriate for this phase: inexpensive CDN hosting, no application server or database, no collected payment/contact data, and minimal operational complexity. Navigation/footer HTML is repeated across four files to keep each page independently usable. A future templating/build system can centralize it if the website expands. Bootstrap is local; custom CSS and a small script provide the design and interactions without jQuery or a Bootstrap JavaScript dependency.

Registration links point to https://epay.thebftonline.com (correcting the supplied `httpe://` typo); the address returned HTTP 200 during implementation. Payment processing stays with the external provider. No checkout transaction has been tested.

## Content review

Source: https://ghanaeconomicforum.com and its About and Contact pages, reviewed 29 October 2026. Ticket price follows the user?s instruction, overriding the old source-site price. The event date is 10 - 11 November, 2026, as supplied by the user. Attendance is Strictly By Invitation. The venue remains marked for confirmation. Speaker profiles were updated from the user-supplied artwork in `speaker images`; John Dramani Mahama remains first with the previously supplied photo. The 14 individual posters and 7 additional unique profiles from the lineup poster are framed with CSS, preserving all original artwork. Names, positions, source paths and frame coordinates are recorded in `assets/speakers/manifest.json`. No local logo was present at kickoff; the official logo was retrieved from the source website.

Before release, confirm the event date, venue, speaker lineup/roles, ticket inclusions, contact details and image rights. Replace provisional content in each HTML file. The conference audience photograph is an illustrative asset from the source website media library, not a verified photograph of GEF. All prices can be found by searching `3,000`; all registration links by searching `epay.thebftonline.com`.

## Hosting and production

Deploy the frontend directory to a static host over HTTPS. Publish only the four HTML files and `assets/`. No backend deployment is required in this phase. A future contact API should deploy separately and require server-side validation, rate limits, spam controls, restricted CORS and consent/retention policies. Do not add a form that reports success without a real delivery service.

Use short cache lifetimes for HTML, cache local assets with revalidation, and add versioned asset names before enabling immutable caching. Configure `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP allowing self-hosted scripts/styles/images (the contact page currently has two inline style attributes). Prefer CSP response headers; allow only the external destinations actually needed. Enable HSTS after HTTPS/domain verification. No secrets belong in this repository.

For CI, validate local links/assets and JavaScript syntax on each change, then deploy a preview for mobile/desktop keyboard and visual review. Keep the previous static deployment for immediate rollback. Monitor homepage availability and periodically verify the external registration URL. Containers, Kubernetes, databases and caching services are unnecessary for the current static scope.

## Validation

Run `python tools/validate.py` and `node --check assets/js/main.js`. Browser automation was unavailable in this session; responsive visual behavior and interactive keyboard behavior still require browser QA before production release.

The homepage background uses a 1200 x 720 illustrative photograph of the Inclusive FinTech Forum auditorium in Kigali, sourced directly from the conference organiser. Its source is recorded in `asset-sources.json`. The green gradient overlay preserves text contrast.
