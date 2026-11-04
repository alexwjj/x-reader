import { createHubAnalytics } from '../shared/hub-sdk.js';
async function initialize() {
  const toggle = document.getElementById('hub-analytics');
  let analytics;
  const start = () => { analytics = createHubAnalytics({ projectId: 'x-reader', endpoint: 'https://alexwjj-hub.weightbook.icu/api/collect' }); };
  const saved = await chrome.storage.local.get('hubAnalyticsEnabled');
  toggle.checked = saved.hubAnalyticsEnabled !== false;
  if (toggle.checked) start();
  toggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ hubAnalyticsEnabled: toggle.checked });
    if (toggle.checked) start();
    else { analytics?.stop({ flush: false }); analytics = undefined; }
  });
}
void initialize().catch(() => { document.getElementById('hub-analytics').disabled = true; });
