# Ghana Economic Forum

A responsive event website with seven main/content pages and two information pages built with HTML, CSS, Bootstrap 4.1.3 and small vanilla JavaScript enhancements. The frontend needs no build or dependency installation. The contact form uses a separately deployed Cloudflare Worker and Resend; see `backend/README.md`.

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

Deploy the nine HTML pages and `assets/` to the existing static host over HTTPS. Deploy `backend/` separately as a Cloudflare Worker. Configure Resend/Turnstile secrets only in the backend; set the public API origin in `assets/js/contact-config.js` after deployment. See `backend/README.md` for exact setup commands, security decisions, API contract and release checks. The form is intentionally unavailable until configured and never reports a fake success.

Use short cache lifetimes for HTML, cache local assets with revalidation, and add versioned asset names before enabling immutable caching. Configure `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP allowing self-hosted scripts/styles/images (the contact page currently has two inline style attributes). Prefer CSP response headers; allow only the external destinations actually needed. Enable HSTS after HTTPS/domain verification. No secrets belong in this repository.

For CI, validate local links/assets and JavaScript syntax on each change, then deploy a preview for mobile/desktop keyboard and visual review. Keep the previous static deployment for immediate rollback. Monitor homepage availability and periodically verify the external registration URL. Containers, Kubernetes, databases and caching services are unnecessary for the current static scope.

## Validation

Run `python tools/validate.py`, `node --check assets/js/main.js`, and `npm.cmd test` from `backend`. The contact API and frontend behavior have 20 automated tests using mocked external services; the Worker deployment dry run passed. Actual email delivery has not been tested or configured. Browser automation was unavailable in this session; responsive visual behavior and interactive keyboard behavior still require browser QA before production release.

The homepage background uses a 1200 x 720 illustrative photograph of the Inclusive FinTech Forum auditorium in Kigali, sourced directly from the conference organiser. Its source is recorded in `asset-sources.json`. The green gradient overlay preserves text contrast.

## Shared footer

All nine pages share the same `.premium-footer` markup and scoped responsive CSS. The container is limited to 1200px; the grid uses four columns on desktop, two on tablet, and a centered single column on mobile. The logo keeps its natural aspect ratio. Contact icons and social symbols are inline SVGs, with accessible link names and no external icon dependency. Hover transitions respect reduced-motion preferences.

The footer Programme link targets the homepage programme overview. Privacy and Terms links open `privacy.html` and `terms.html`. Social links use B&FT channels. Per the user?s instruction, there are no working hours or newsletter subscription elements.

## Contact form activation

The premium Contact Us section is implemented locally. It uses explicit labels, field-level validation, accessible status feedback, responsive single/two-column layouts, and preserved values after errors. Privacy text now describes contact submissions and the Cloudflare/Resend processing path. No hours or newsletter were introduced.

Live email is pending configuration, not complete: verify your domain in Resend, configure a managed Turnstile widget, save backend secrets, deploy the Worker, set its public origin in `assets/js/contact-config.js`, and deploy the static frontend. See `backend/README.md`. A successful API response confirms provider acceptance, not eventual inbox delivery. Verify a live message with the receiving inbox owner before release.

## Footer stylesheet deployment

The footer styles live in `assets/css/footer.css`, loaded independently on all six pages with a content-hash query version. Shared and Contact styles also use versioned URLs to avoid old cached CSS after publishing. Deploy all six HTML files and the CSS files together; publishing only HTML leaves new markup paired with old styles. The live site was observed serving an old 16,423-character shared stylesheet with a four-hour cache lifetime while serving newer footer HTML. Inline SVG dimensions now provide safe fallback sizing even if CSS fails.

Run `npm.cmd test` in `backend` for the footer regression check: it verifies matching stylesheet versions across every page and safe icon/logo dimensions without CSS. This check does not establish responsive visual rendering; browser QA remains required at phone, tablet, desktop and browser zoom sizes.

## Speaker showcase

The Home and Speakers pages contain the same 22 profiles, with John Dramani Mahama first and his original portrait preserved. The responsive grid uses four columns above 1100px, two at tablet widths, and one below 768px. Cards share a fixed photo aspect ratio, consistent content structure, full-card profile activation, and a featured gold accent on the first profile. Existing source artwork is framed through CSS without modifying the original files. Some portraits originate in a lower-resolution group poster; original high-resolution headshots would improve large modal sharpness.

Update `assets/speakers/profiles.json`, then run `python tools/build_speakers.py` to refresh both static card lists, embedded dialog data, and versioned stylesheet/script URLs. Full biography, expertise, and personal social links were not supplied. The modal explicitly says biographies will be announced and omits unavailable expertise/social details; do not invent them. Add approved content to the `biography`, `expertise`, and `socialLinks` fields later. A social link has `label` and an HTTPS `url`.

Profile dialogs use the native modal dialog API for focus containment and Escape dismissal; the controller restores focus to the initiating card. Buttons stay hidden in browsers without dialog support while static speaker content remains available. Staggered 600ms entry animations are progressive enhancements and respect reduced-motion preferences. Tests cover all 22 profiles, preserved ordering, image paths, filtering, profile content, close/focus return, and unsupported-dialog fallback. These DOM tests do not establish native browser rendering or focus trapping; perform visual/keyboard QA before release.

Deploy `index.html`, `speakers.html`, `assets/css/speakers.css`, and `assets/js/speakers.js` together, retaining existing speaker assets and shared styles. The new CSS and script use content-versioned URLs to avoid the previously observed stale stylesheet problem.

Speaker cards now use compact content padding with no reserved name/title height and no visible profile link or arrow. A native, labelled button covers the card without consuming layout space, preserving keyboard access to profile dialogs. Badge, name, job title and organization remain in order. Grid rows keep cards equal in height without distributing unnecessary gaps between details.

## GEF 2026 Concept Note content refresh

The website copy and SEO metadata reflect the supplied Concept Note. New content pages are `programme.html`, `energy-day.html` and `investment-marketplace.html`, reusing existing page styles, navigation and footer. They are linked from the homepage programme overview. No CSS/JavaScript or existing navigation header was changed for this content update. See `docs/gef-2026-content-update.md` for source mapping and validation. Publish all nine HTML pages together; existing assets remain required.

## Three-slide homepage hero

The homepage uses exactly three slides: presidential leadership, capital/partnerships, and industrial/energy growth. `assets/css/hero-slider.css` and `assets/js/hero-slider.js` are homepage-only and content-versioned. The native JavaScript controller fades slides, advances every four seconds, loops, supports arrows/dots/keyboard/swipe navigation, and displays progress with pause/play. It pauses on keyboard engagement, pointer hover, hidden tabs and when off-screen; explicit Play resumes after manual navigation. Reduced-motion visitors start paused and do not receive fades/zoom/reveal animations. They can explicitly choose automatic rotation.

Only the first image has an eager high-priority source. Other images are loaded and decoded when requested, so the currently visible slide remains until the next is ready. The compressed images are self-hosted under `assets/hero/`, with source provenance in `asset-sources.json`. They are illustrative images, not claims about attendance at GEF 2026. Slide 2 uses a 1280 x 854 official Ghana Ministry of Finance meeting photograph; Slide 3 shows solar-powered industrial infrastructure in Ghana. Core Web Vitals have not been measured.

The hero fills the viewport, with minimum heights on short screens to prevent clipped text/buttons. The shared header is opaque white on every page, including the homepage. It remains sticky and becomes slightly more compact with a stronger shadow after scrolling. Without JavaScript, the first slide, its CTA links and normal header remain usable; inactive slide links are outside the tab order. Manual slide changes are announced politely; automatic changes are not announced.

Seven DOM/controller tests cover the three-slide structure, four-second infinite loop, manual navigation, inactive-link focus handling, reduced-motion startup, keyboard controls, horizontal-vs-vertical touch gestures and shared header scroll state. They do not verify rendered image crops, native mobile gestures or browser performance. Publish `index.html`, the new hero CSS/JS and all three `assets/hero/` images together.

## Shared white navigation

`assets/css/header.css` loads last on all nine pages with a content-versioned URL. It gives the main header a pure white background, dark menu links, gold hover underlines, a green registration CTA and an opaque white animated mobile panel. `assets/js/main.js` owns the shared passive scroll handler. Transparent hero-header overrides were removed. Initial desktop height is 106px and compact height is 90px; tablet/mobile use proportionate sizes. The header remains sticky without JavaScript, with a normal readable menu. Publish all HTML files with the changed header/hero CSS and shared/hero JavaScript together.

### Presidential leadership slide

The first slide features John Dramani Mahama at the Japan-Ghana summit during TICAD 9 on 20 August 2025. The photograph is credited to the Cabinet Public Relations Office of the Cabinet Secretariat, Japan, and listed under CC BY 4.0 on its Wikimedia Commons source page. Visible source/licence attribution and a modification notice are included on the slide. The local derivative is 2000 x 1334, approximately 199 KiB. CSS applies the display crop, overlay and zoom; the photo is not presented as a GEF 2026 event photograph. The source, creator, licence and changes are recorded in `asset-sources.json`. The other two slides and four-second interval remain unchanged.

The presidential hero now uses `presidential-leadership-clean.jpg`, with backdrop event lettering removed using AI-assisted editing. Visible slide attribution has moved to `privacy.html#photo-credits`, linked from all footers; source, licence and editing disclosure are preserved there.
