// ============================================================
//  APEX VELOCITY — global configuration
//  Edit this file before going live. Nothing else needs to change.
// ============================================================

export const CONFIG = {
  gameName: 'APEX VELOCITY',

  // Default race length (player can change it in the menu)
  laps: 3,

  // Number of AI opponents on the grid
  opponents: 5,

  ads: {
    // 1) Your AdSense publisher ID, e.g. 'ca-pub-1234567890123456'.
    //    While this stays as the placeholder, ads are fully disabled
    //    and the game runs ad-free (no network calls to Google).
    client: 'ca-pub-XXXXXXXXXXXXXXXX',

    // 2) Keep true until Google approves your site for H5 Games Ads.
    //    Test mode shows Google's sample ads and earns nothing.
    testMode: true,

    // 3) Minimum time between interstitial ads (Google's frequency hint).
    frequencyHint: '60s',

    // 4) Optional display-ad unit IDs (AdSense > Ads > By ad unit > Display ads).
    //    Shown ONLY on menu / results screens, never over gameplay.
    //    Leave '' to disable a slot.
    menuSlot: '',
    resultsSlot: '',
  },
};

export function adsConfigured() {
  return /^ca-pub-\d{10,20}$/.test(CONFIG.ads.client);
}
