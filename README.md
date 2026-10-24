# Apex Velocity — browser 3D racing game

A complete, self-contained WebGL racing game (Three.js r169, bundled locally — no build step, no CDN needed).

- 5 circuits with their own environment: Valle Ridge (alpine afternoon), Red Mesa (desert midday), Costa Azul (coast at sunset with sea and palms), Frostpine Ring (snowfall, lower grip), Neon Harbor (night street circuit with city lights)
- 4 original cars built from lofted body sections: Vortex GT, Kestrel SV, Ronin 8, Atom RS, each with its own power, grip and top speed
- Chase, far chase, cockpit (steering wheel, live dashboard) and bumper cameras; look back with B
- PBR clear-coat car paint, sky-based reflections, real-time soft shadows, bloom, MSAA, ACES tone mapping
- Physics: torque curve and 6-speed gearbox (automatic or manual with rev-protection), traction limit and wheelspin, speed-sensitive steering, rotational inertia, aero grip, handbrake drift, nitro, horn
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
js/maps.js            the 5 circuits and their weather/lighting
js/track.js           circuit geometry, terrain, trackside furniture
js/scenery.js         trees, palms, cacti, city, street lights, sea, snow
js/cars.js            the 4 car models and the cockpit
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

W/↑ throttle · S/↓ brake & reverse · A/D steer · Space handbrake · Shift/N nitro · H horn · E/Q shift up/down (manual) · T auto/manual · C camera · V cockpit · B look back · R reset to track · P/Esc pause · M mute · F FPS counter.
Gamepad: RT throttle, LT brake, A handbrake, B nitro, RB/LB shift, Y camera, R3 cockpit, L3 horn, Back look back, Start pause.

## Tuning

- Opponents / default laps: `js/config.js`
- Car performance: `stats` of each model in `js/cars.js` (power, traction, drag, grip, steering, top speed)
- Add or edit circuits: control points and environment in `js/maps.js`
- AI pace: `skills` array in `js/main.js` and `DIFF` presets; corner speed `aLat` in `js/track.js`
- Lighting: sun, exposure and sky settings near the top of `js/main.js`
