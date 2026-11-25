# Deploy

Live (private to you): **https://claude.ai/artifact/XLvqUQQooN2rgdqYSEne2E**. Version 1, 2026-11-25.
Built from `app/` with `npx vite build --mode single`, wrapped into `deploy/ironrow.html`.
Declared capability: `downloads` (so backups/CSV exports can be saved from inside claude.ai).

## Preflight (2026-11-25)

| check | result |
| --- | --- |
| unit tests (`npm test`) | 41 passed |
| e2e (`npx playwright test`, Pixel 7, console-error + axe checks) | 14 passed |
| production build (`npm run build`) | passes |
| single-file build, core flow smoke test (also wrapped like the host) | passes, 0 console errors |
| parity (`parity.py`) | 100 / 100, 22/22 must-haves |
| rebrand sweep (`sweep.py --config replica/brand.json`) | clean |
| open S1 / S2 bugs | 0 / 0 |
| store listing (`listing.py`) | n/a, not shipping to stores |
| privacy policy / terms / cookie banner | n/a: personal use, no server, no cookies, no analytics |
| account deletion | Settings → Delete all data |

No production services: no database, auth, payments or email by design. Nothing was bought.

## What's different inside claude.ai

- Data lives in **this browser's** storage for the artifact. A different phone or browser starts empty.
  Use Settings → Export backup and Restore to move it.
- Rest alerts: vibration and a beep; system notifications are blocked in the artifact frame.
- Screen-on (wake lock) may or may not be granted; the app works either way.
- No offline install (service workers don't run in artifacts). For an installable, offline app, host the PWA build:

## Optional: host the installable PWA yourself

The regular build (`app/dist/` after `npm run build`) is a static site with a service worker.
Any static host works; you sign in and click, nothing to configure:

- **Netlify Drop**: drag `app/dist` onto app.netlify.com/drop.
- **Cloudflare Pages / Vercel**: connect this repo, root `app`, build `npm run build`, output `dist`.
- **GitHub Pages**: needs the repo public (or a paid plan); deploy `app/dist`.

Then open it on your phone and use "Add to Home Screen". That gives offline use and the full-screen app.
Rest alerts are a beep and a buzz while the app is open; iPhones pause home-screen web apps when locked, so
background notifications would need a push server. Use "Keep screen on" during workouts.

**Hosted now:** GitHub Pages from the `gh-pages` branch, https://iaviv669-lab.github.io/Claude-/ (Pages must be
switched on in the repo's Settings → Pages → Deploy from a branch → gh-pages / root).
Update it: `cd app && npm run build`, then replace the contents of the `gh-pages` branch with `app/dist`.

**App Store:** not pursued (owner's choice: personal use, no Apple Developer account or Mac). It would need the
$99/yr account, a native wrapper (e.g. Capacitor) with real native features to pass guideline 4.2, and a macOS
build (a Mac or a GitHub Actions macOS runner). A custom domain is only needed if you want one:
point a CNAME at the host's target and it handles HTTPS.

## First week, watch for

- Does a workout survive the phone locking mid-rest? (Should: everything is saved on each tap.)
- Export a backup after your first few sessions and keep it somewhere safe.
- Anything that feels slow in the logger: note the screen and what you tapped.

## Redeploy

`cd app && npm run build:artifact`, then publish `deploy/ironrow.html` to the same artifact URL.
