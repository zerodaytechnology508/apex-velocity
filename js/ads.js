// Google AdSense H5 Games Ads (Ad Placement API) wrapper.
// Every call is safe when ads are not configured, blocked, or unavailable:
// callbacks still fire so the game never gets stuck waiting for an ad.

import { CONFIG, adsConfigured } from './config.js';

let enabled = false;
let scriptFailed = false;
const displayFilled = new Set();

function once(fn) {
  let done = false;
  return (...a) => { if (!done) { done = true; fn(...a); } };
}

export const Ads = {
  get enabled() { return enabled && !scriptFailed; },

  // Loads the ad script and runs the preroll. onReady always fires.
  init(onReady, hooks) {
    this.hooks = hooks; // { pause(), resume() }
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };

    const ready = once(onReady);
    if (!adsConfigured()) { ready(); return; }

    enabled = true;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CONFIG.ads.client);
    if (CONFIG.ads.testMode) s.setAttribute('data-adbreak-test', 'on');
    s.setAttribute('data-ad-frequency-hint', CONFIG.ads.frequencyHint);
    s.onerror = () => { scriptFailed = true; ready(); };
    document.head.appendChild(s);

    window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });

    // Preroll: one per page load, before the player starts.
    const t = setTimeout(ready, 5000);
    window.adBreak({
      type: 'preroll',
      adBreakDone: () => { clearTimeout(t); ready(); },
    });
  },

  setSound(on) {
    if (this.enabled) window.adConfig({ sound: on ? 'on' : 'off' });
  },

  // Interstitial: type = 'start' | 'pause' | 'next' | 'browse'
  // done() runs after the ad (or immediately when no ad is shown).
  interstitial(type, name, done = () => {}) {
    const finish = once(done);
    if (!this.enabled) { finish(); return; }
    // If Google never starts an ad, continue after a short wait.
    const t = setTimeout(finish, 3500);
    window.adBreak({
      type, name,
      beforeAd: () => { clearTimeout(t); this.hooks?.pause(); },
      afterAd: () => { this.hooks?.resume(); },
      adBreakDone: () => { clearTimeout(t); finish(); },
    });
  },

  // Rewarded ad. offer(showFn) is called only when an ad is available;
  // wire showFn to a button. onReward runs if the player watched it fully.
  reward(name, { offer, onReward, onDone }) {
    if (!this.enabled) { onDone?.(false); return; }
    let offered = false;
    window.adBreak({
      type: 'reward', name,
      beforeAd: () => this.hooks?.pause(),
      afterAd: () => this.hooks?.resume(),
      beforeReward: (showAdFn) => { offered = true; offer(showAdFn); },
      adDismissed: () => {},
      adViewed: () => onReward(),
      adBreakDone: () => onDone?.(offered),
    });
  },

  // Responsive display ad inside a menu container (never during gameplay).
  display(container, slot) {
    if (!this.enabled || !slot || !container || displayFilled.has(container)) return;
    displayFilled.add(container);
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CONFIG.ads.client);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    container.appendChild(ins);
    container.hidden = false;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
  },
};
