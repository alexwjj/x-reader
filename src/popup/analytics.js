import { createHubAnalytics } from '../shared/hub-sdk.js';
const origin = 'https://alexwjj-hub.weightbook.icu';
const toggle = document.getElementById('hub-analytics');
let analytics;
const start = () => { analytics = createHubAnalytics({ projectId: 'x-reader', endpoint: origin + '/api/collect' }); };
const saved = await chrome.storage.local.get('hubAnalyticsEnabled');
if (saved.hubAnalyticsEnabled && await chrome.permissions.contains({ origins: [origin + '/*'] })) { toggle.checked = true; start(); }
toggle.addEventListener('change', async () => {
  if (toggle.checked) {
    const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
    toggle.checked = granted;
    await chrome.storage.local.set({ hubAnalyticsEnabled: granted });
    if (granted) start();
  } else {
    analytics?.stop(); analytics = undefined;
    await chrome.storage.local.set({ hubAnalyticsEnabled: false });
    await chrome.permissions.remove({ origins: [origin + '/*'] });
  }
});
