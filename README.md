# Apex Velocity — browser 3D racing game

A complete, self-contained WebGL racing game (Three.js r169, bundled locally — no build step, no CDN needed).

- 2.7 km circuit with elevation, curbs, armco barriers, grandstand, pit building, 2,400 trees, mountains
- PBR clear-coat car paint, sky-based reflections, real-time soft shadows, bloom, MSAA, ACES tone mapping
- Physics: speed-sensitive steering, grip limit (understeer), handbrake drift, 6-speed gearbox, nitro, wall and car contact
- 5 AI drivers that brake for corners, take racing lines, overtake and avoid traffic
- F1-style five-light start, lap timing, best lap (saved), live standings, minimap, results table
- Synthesized engine, tyre, wind and impact sound (no audio files)
- Keyboard, gamepad and touch controls; Fast / High / Ultra 4K quality presets
- Google AdSense H5 Games Ads already wired in: preroll, start, pause, next-race interstitials and a rewarded ad (double nitro), plus optional display ads on menu/results screens only

## Folder

```
index.html            the game page (SEO meta, JSON-LD, import map)
js/config.js          ← the only file you edit to turn ads on
js/main.js            game flow, rendering, camera, HUD wiring
js/vehicle.js         player physics + AI drivers
js/track.js           circuit, terrain, scenery
js/car.js             procedural car model
js/textures.js        procedural textures
js/ads.js             AdSense H5 Games Ads wrapper (safe when ads are off/blocked)
js/audio.js, fx.js, hud.js, input.js
lib/                  Three.js + addons (MIT licence included)
privacy.html, about.html, ads.txt, robots.txt, sitemap.xml, manifest.webmanifest, favicon.svg
```

## Run locally

ES modules do not load from `file://`, so use any static server:

```
cd game
python -m http.server 8080      # or: npx serve .
```

Open http://localhost:8080

## Put it online (free)

Any static host works. Easiest options:

- **Cloudflare Pages / Netlify**: drag the `game` folder onto the dashboard upload page.
- **GitHub Pages**: push the folder to a repo, Settings → Pages → deploy from branch.
- **Your own hosting (cPanel etc.)**: upload the folder contents to `public_html`.

AdSense needs a domain you own (e.g. `apexvelocity.com`), not a `*.pages.dev` / `*.netlify.app` subdomain.
After deploying, replace `YOUR-DOMAIN.com` in `index.html`, `robots.txt` and `sitemap.xml`, and fill the
`[placeholders]` in `privacy.html` and `about.html`.

## Turn on Google ads

1. Sign up at adsense.google.com with your domain and add the site. Google reviews it before ads serve
   (usually days to a few weeks). Approval is Google's decision; sites need real content, a privacy policy
   and working navigation — this package includes all three.
2. Put your publisher ID in `js/config.js` → `ads.client` (format `ca-pub-1234567890123456`).
3. Put the same number in `ads.txt` (`pub-1234567890123456`) and upload it to the site root.
4. Apply for **H5 Games Ads** (AdSense → Ads → "H5 games" / Ad Placement API). Until approved, keep
   `testMode: true` — you will see Google's test ads, which earn nothing.
5. When approved, set `testMode: false` and redeploy.
6. Optional: create two responsive Display ad units and paste their slot IDs into `menuSlot` and `resultsSlot`.
7. In AdSense → Privacy & messaging, publish a GDPR consent message (required for EEA/UK visitors).

While `ads.client` is the placeholder, the game makes no requests to Google and runs ad-free.

### Where ads appear

| Moment | Type | Notes |
|---|---|---|
| First load | `preroll` | once per page load |
| Start race | `start` | interstitial |
| Pause | `pause` | interstitial, capped by frequency hint |
| Race again | `next` | interstitial |
| Results screen | `reward` | player opts in → double nitro next race |
| Menu & results | display | never shown during driving |

Frequency is capped by `frequencyHint` (default 60 s) and by Google.

## Controls

W/↑ throttle · S/↓ brake & reverse · A/D steer · Space handbrake · Shift/N nitro · C camera · R reset to track · P/Esc pause · M mute · F FPS counter.
Gamepad: RT throttle, LT brake, A handbrake, B nitro, Y camera, Start pause.

## Tuning

- Opponents / default laps: `js/config.js`
- Car feel: `js/vehicle.js` (`top`, acceleration `13.5`, braking `33`, grip `aMax`, steering `maxSteer`)
- AI pace: `skills` array in `js/main.js` and `DIFF` presets; corner speed `aLat` in `js/track.js`
- Track layout: `CTRL` control points at the top of `js/track.js`
- Lighting: sun, exposure and sky settings near the top of `js/main.js`
