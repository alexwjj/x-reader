import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { startReader } from '../src/content/reader.js';
import { createSettingsStore, normalizeSettings } from '../src/shared/settings.js';

function storageAPI(initial = {}) {
  let data = { ...initial };
  const listeners = new Set();
  return {
    local: {
      async get() { return data; },
      async set(next) {
        const changes = Object.fromEntries(Object.entries(next).map(([key, newValue]) => [key, { oldValue: data[key], newValue }]));
        data = { ...data, ...next };
        for (const listener of listeners) listener(changes, 'local');
      }
    },
    onChanged: { addListener(fn) { listeners.add(fn); }, removeListener(fn) { listeners.delete(fn); } }
  };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 240));

// Catches accepting unknown types or losing defaults on partial stored data.
test('settings normalize untrusted stored values and persist partial updates', async () => {
  assert.deepEqual(normalizeSettings({ enabled: 'false', detectBold: false, theme: 'unknown', extra: true }), {
    enabled: true, detectBold: false, detectNumbered: true, theme: 'auto'
  });
  const store = createSettingsStore(storageAPI({ settings: { detectBold: false } }));
  await store.save({ theme: 'dark' });
  assert.deepEqual(await store.load(), { enabled: true, detectBold: false, detectNumbered: true, theme: 'dark' });
});

// Catches stale directories after SPA navigation, self-triggered rescans, or failure to re-enable.
test('reader updates after article changes and cleans up on navigation and disable', async t => {
  const dom = new JSDOM('<main><div data-testid="primaryColumn"><article data-testid="tweet"><a href="/a/status/123"><time>今天</time></a><div data-testid="tweetText"><strong>第一节</strong><br>正文<br><strong>第二节</strong></div></article></div></main>', { url: 'https://x.com/a/status/123', pretendToBeVisual: true });
  const win = dom.window;
  const store = createSettingsStore(storageAPI());
  const reader = await startReader(win, store);
  t.after(() => { reader.destroy(); win.close(); });
  assert.equal(reader.status().count, 2);
  const host = win.document.querySelector('[data-x-reader-host]');
  assert.ok(host?.shadowRoot.querySelector('nav'));
  assert.equal(host.shadowRoot.querySelectorAll('.toc-item').length, 2);
  win.document.querySelector('[data-testid="tweetText"]').insertAdjacentHTML('beforeend', '<br><strong>第三节</strong>');
  await settle();
  assert.equal(reader.status().count, 3);
  assert.equal(win.document.querySelectorAll('[data-x-reader-host]').length, 1);
  await store.save({ enabled: false });
  await settle();
  assert.equal(win.document.querySelector('[data-x-reader-host]'), null);
  await store.save({ enabled: true });
  await settle();
  assert.equal(reader.status().count, 3);
  win.history.pushState({}, '', '/home');
  reader.refresh();
  assert.equal(win.document.querySelector('[data-x-reader-host]'), null);
  assert.equal(reader.status().count, 0);
  win.history.pushState({}, '', '/a/status/123');
  reader.refresh();
  assert.equal(reader.status().count, 3);
});

// Catches placing the directory over the article instead of using the trends card area.
test('directory uses the right sidebar below related users and follows sidebar resizing', async t => {
  const dom = new JSDOM('<main><div data-testid="primaryColumn"><div data-testid="twitterArticleRichTextView"><h2>章节</h2></div></div><div data-testid="sidebarColumn"><aside><h2>相关用户</h2><div data-testid="UserCell">用户</div></aside><section><h2>有什么新鲜事</h2><div data-testid="trend">趋势</div></section></div></main>', { url: 'https://x.com/i/article/456', pretendToBeVisual: true });
  const win = dom.window;
  win.innerWidth = 1440;
  win.innerHeight = 1000;
  win.document.querySelector('[data-testid="primaryColumn"]').getBoundingClientRect = () => ({ left: 300, right: 1000, width: 700, top: 0 });
  const sidebar = win.document.querySelector('[data-testid="sidebarColumn"]');
  sidebar.getBoundingClientRect = () => ({ left: 1024, right: 1406, width: 382, top: 0, height: 1000 });
  let card = { left: 1040, right: 1390, width: 350, top: 260, bottom: 800, height: 540 };
  sidebar.querySelector('section').getBoundingClientRect = () => card;
  const reader = await startReader(win, createSettingsStore(storageAPI()));
  t.after(() => { reader.destroy(); win.close(); });
  const host = win.document.querySelector('[data-x-reader-host]');
  assert.equal(reader.status().open, true);
  assert.equal(host.style.left, '1040px');
  assert.equal(host.style.top, '260px');
  assert.equal(host.style.getPropertyValue('--panel-width'), '350px');
  assert.equal(host.style.getPropertyValue('--panel-max-height'), '724px');
  card = { ...card, left: 1060, right: 1390, width: 330 };
  win.dispatchEvent(new win.Event('resize'));
  assert.equal(host.style.left, '1060px');
  assert.equal(host.style.getPropertyValue('--panel-width'), '330px');
  // Hidden/offscreen sidebars must not cause a full directory to cover the main column.
  sidebar.getBoundingClientRect = () => ({ left: 0, right: 0, width: 0, top: 0, height: 0 });
  win.innerWidth = 1100;
  win.dispatchEvent(new win.Event('resize'));
  assert.equal(reader.status().open, false);
});

// Catches smooth scrolling that ignores the user's reduced-motion preference.
test('chapter navigation respects reduced motion', async t => {
  const dom = new JSDOM('<main><div data-testid="twitterArticleRichTextView"><h2>章节</h2></div></main>', { url: 'https://x.com/i/article/456', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  let requestedScroll;
  dom.window.scrollTo = options => { requestedScroll = options; };
  const reader = await startReader(dom.window, createSettingsStore(storageAPI()));
  t.after(() => { reader.destroy(); dom.window.close(); });
  dom.window.document.querySelector('[data-x-reader-host]').shadowRoot.querySelector('.toc-item').click();
  assert.equal(requestedScroll.behavior, 'instant');
});

async function navigationPage(t) {
  const dom = new JSDOM('<main><div data-testid="twitter-article-title">文章标题</div><div data-testid="twitterArticleRichTextView"><h2>第一节</h2><p>正文</p><h2>第二节</h2><p>正文</p><h2>第三节</h2></div></main>', { url: 'https://x.com/i/article/456', pretendToBeVisual: true });
  const win = dom.window;
  const headings = [...win.document.querySelectorAll('h2')];
  headings.forEach((heading, index) => { heading.getBoundingClientRect = () => ({ top: 200 + 600 * index - win.scrollY }); });
  const reader = await startReader(win, createSettingsStore(storageAPI()));
  reader.toggle();
  t.after(() => { reader.destroy(); win.close(); });
  const shadow = win.document.querySelector('[data-x-reader-host]').shadowRoot;
  const selected = () => Number(shadow.querySelector('[aria-current="true"]')?.dataset.index);
  return { win, reader, shadow, selected };
}

// Catches delayed selection and scroll-spy overriding the requested chapter during animation.
test('click selection happens before scrolling and remains stable during navigation', async t => {
  const { win, reader, shadow, selected } = await navigationPage(t);
  let selectedWhenScrollStarts;
  win.scrollTo = () => { selectedWhenScrollStarts = selected(); };
  shadow.querySelectorAll('.toc-item')[2].click();
  assert.equal(selectedWhenScrollStarts, 2);
  assert.equal(selected(), 2);
  win.scrollY = 300;
  win.dispatchEvent(new win.Event('scroll'));
  await new Promise(resolve => win.requestAnimationFrame(resolve));
  assert.equal(selected(), 2);
  reader.refresh();
  assert.equal(selected(), 2);
  win.dispatchEvent(new win.WheelEvent('wheel'));
  win.dispatchEvent(new win.Event('scroll'));
  await new Promise(resolve => win.requestAnimationFrame(resolve));
  assert.equal(selected(), 0);
});

// Catches slow repeated arrow navigation, boundary wrapping and stealing input-field keys.
test('up and down navigate immediately while ignoring editors and collapsed panels', async t => {
  const { win, reader, selected } = await navigationPage(t);
  const scrolls = [];
  win.scrollTo = options => { scrolls.push(options); };
  const key = (value, target = win.document.body) => {
    const event = new win.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  assert.equal(key('ArrowDown').defaultPrevented, true);
  assert.equal(selected(), 1);
  key('ArrowDown');
  assert.equal(selected(), 2);
  key('ArrowDown');
  assert.equal(selected(), 2);
  key('ArrowUp');
  assert.equal(selected(), 1);
  const input = win.document.createElement('textarea');
  win.document.body.append(input);
  assert.equal(key('ArrowDown', input).defaultPrevented, false);
  assert.equal(selected(), 1);
  reader.toggle();
  const previousScrolls = scrolls.length;
  assert.equal(key('ArrowDown').defaultPrevented, false);
  assert.equal(scrolls.length, previousScrolls);
});

// Catches navigation locks surviving completion or input shortcuts escaping editor guards.
test('completed navigation resumes scroll tracking and editable controls keep arrow keys', async t => {
  const { win, shadow, selected } = await navigationPage(t);
  win.scrollTo = () => {};
  Object.defineProperty(win.document.documentElement, 'scrollHeight', { value: 4000 });
  shadow.querySelectorAll('.toc-item')[1].click();
  win.scrollY = 704;
  win.dispatchEvent(new win.Event('scrollend'));
  win.scrollY = 1304;
  win.dispatchEvent(new win.Event('scroll'));
  await new Promise(resolve => win.requestAnimationFrame(resolve));
  assert.equal(selected(), 2);
  for (const html of ['<div contenteditable="true"><span>编辑器</span></div>', '<div role="textbox"><span>回复</span></div>']) {
    const container = win.document.createElement('div');
    container.innerHTML = html;
    win.document.body.append(container);
    const event = new win.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    container.querySelector('span').dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(selected(), 2);
  }
});

// Catches extension content treated as HTML and empty panels opening uninvited.
test('empty outlines stay hidden until requested and external title text is escaped', async t => {
  const dom = new JSDOM('<main><div data-testid="primaryColumn"><div data-testid="twitterArticleRichTextView"><p>普通正文</p></div></div></main>', { url: 'https://x.com/i/articles/456', pretendToBeVisual: true });
  const reader = await startReader(dom.window, createSettingsStore(storageAPI()));
  t.after(() => { reader.destroy(); dom.window.close(); });
  const host = dom.window.document.querySelector('[data-x-reader-host]');
  assert.ok(!host || host.hidden);
  reader.toggle();
  assert.equal(dom.window.document.querySelector('[data-x-reader-host]').hidden, false);
  dom.window.document.querySelector('p').innerHTML = '<strong>&lt;img src=x onerror=alert(1)&gt;</strong>';
  reader.refresh();
  const shadow = dom.window.document.querySelector('[data-x-reader-host]').shadowRoot;
  assert.equal(shadow.querySelector('img'), null);
  assert.ok(shadow.textContent.includes('<img src=x onerror=alert(1)>'));
});
