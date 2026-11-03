import { startReader } from '../src/content/reader.js';

const params = new URLSearchParams(location.search);
const readingURL = params.get('kind') === 'article' ? 'https://x.com/i/articles/456' : 'https://x.com/demo/status/100';
// Use the production reader against the local fixture, with an in-memory settings store.
const demoWindow = new Proxy(window, {
  get(target, key) {
    if (key === 'location') return new URL(readingURL);
    const value = Reflect.get(target, key);
    return typeof value === 'function' && !/^[A-Z]/.test(String(key)) ? value.bind(target) : value;
  }
});
const reader = await startReader(demoWindow, {
  async load() { return { enabled: true, detectBold: true, detectNumbered: true, theme: params.get('theme') === 'dark' ? 'dark' : 'light' }; },
  subscribe() { return () => {}; }
});
window.addEventListener('pagehide', () => reader.destroy(), { once: true });
const controls = document.querySelector('.right-rail');
const switchTheme = document.createElement('a');
const next = new URL(location.href);
next.searchParams.set('theme', params.get('theme') === 'dark' ? 'light' : 'dark');
switchTheme.href = next.href;
switchTheme.textContent = '切换明暗';
switchTheme.style.cssText = 'display:inline-block;margin-top:15px;color:inherit';
controls.append(document.createElement('br'), switchTheme);
