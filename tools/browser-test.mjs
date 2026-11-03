import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureHTML } from '../tests/fixtures/article.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'x-reader-test-'));
const screenshots = join(root, 'docs/screenshots');
await mkdir(screenshots, { recursive: true });
let context;
const errors = [];
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: process.env.HEADED !== '1', viewport: { width: 1440, height: 1000 },
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  await context.route('https://x.com/**', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHTML({ dark: url.searchParams.get('theme') === 'dark', semantic: /\/articles?\//.test(url.pathname) }) });
  });
  const page = context.pages()[0] || await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://x.com/demo/status/100');
  const host = page.locator('[data-x-reader-host]');
  await host.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.shadowRoot.querySelectorAll('.toc-item').length === 7);
  assert.equal(await host.locator('.toc-item').count(), 7);
  assert.equal(await host.locator('.panel').isVisible(), true);
  assert.equal(await host.getAttribute('data-theme'), 'light');
  await page.screenshot({ path: join(screenshots, 'reader-light.png'), animations: 'disabled' });
  assert.equal(await host.locator('.number,.count,.launcher-count,.refresh,h2,.article-title,.footer').count(), 0);
  const panelSize = await host.locator('.panel').boundingBox();
  const trendsArea = await page.locator('.rail-card.trends').boundingBox();
  const relatedArea = await page.locator('.rail-card.related').boundingBox();
  const primary = await page.locator('[data-testid="primaryColumn"]').boundingBox();
  assert.equal(panelSize.x, trendsArea.x);
  assert.equal(panelSize.y, trendsArea.y);
  assert.equal(panelSize.width, trendsArea.width);
  assert.ok(panelSize.x >= primary.x + primary.width);
  assert.ok(panelSize.y >= relatedArea.y + relatedArea.height);
  assert.ok(panelSize.height > 600 && panelSize.y + panelSize.height <= 984);
  assert.equal(await host.locator('.label').first().evaluate(node => getComputedStyle(node).fontSize), '13px');
  const beforeDrag = await host.boundingBox();
  const handle = await host.locator('.masthead').boundingBox();
  await page.mouse.move(handle.x + 45, handle.y + 16);
  await page.mouse.down();
  await page.mouse.move(handle.x - 55, handle.y + 56, { steps: 6 });
  await page.mouse.up();
  const afterDrag = await host.boundingBox();
  assert.ok(Math.abs(afterDrag.x - beforeDrag.x + 100) < 2);
  assert.ok(Math.abs(afterDrag.y - beforeDrag.y - 40) < 2);
  await page.evaluate(() => { document.body.style.backgroundColor = 'rgb(0, 0, 0)'; });
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.dataset.theme === 'dark');
  const afterPaint = await host.boundingBox();
  assert.equal(afterPaint.x, afterDrag.x);
  assert.equal(afterPaint.y, afterDrag.y);
  await page.evaluate(() => { document.body.style.backgroundColor = ''; });
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.dataset.theme === 'light');
  console.log('PASS: directory drags with the pointer, preserves its position across updates and has no extra counters or refresh control');

  const immediateSelection = await host.evaluate(node => {
    const shadow = node.shadowRoot;
    const before = scrollY;
    shadow.querySelectorAll('.toc-item')[3].click();
    return { selected: shadow.querySelector('[aria-current="true"]').dataset.index, before, after: scrollY };
  });
  assert.equal(immediateSelection.selected, '3');
  assert.equal(immediateSelection.after, immediateSelection.before, 'Selection should update before smooth scrolling moves the page.');
  await page.waitForFunction(() => {
    const body = document.querySelector('[data-testid="tweetText"]');
    const target = [...body.querySelectorAll('span[style]')].find(node => node.textContent.startsWith('4、'));
    return Math.abs(target.getBoundingClientRect().top - 96) < 8;
  });
  assert.equal(await host.locator('.toc-item[aria-current="true"] .label').textContent(), '4、把选择放回实际工作');
  const keyboardSelection = await page.evaluate(() => {
    const shadow = document.querySelector('[data-x-reader-host]').shadowRoot;
    const selected = () => shadow.querySelector('[aria-current="true"]').dataset.index;
    const selection = [];
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      selection.push(selected());
    }
    return selection;
  });
  assert.deepEqual(keyboardSelection, ['4', '5', '4']);
  await page.waitForFunction(() => {
    const target = [...document.querySelectorAll('[data-testid="tweetText"] span[style]')].find(node => node.textContent.startsWith('5、'));
    return Math.abs(target.getBoundingClientRect().top - 96) < 8;
  });
  assert.equal(await host.locator('[aria-current="true"]').getAttribute('data-index'), '4');
  console.log('PASS: immediate click selection, smooth chapter positioning and rapid up/down navigation');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.dataset.compact === 'true');
  assert.equal(await host.locator('.panel').isVisible(), false);
  await host.locator('.launcher').click();
  assert.equal(await host.locator('.panel').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await host.locator('.collapse').click();
  assert.equal(await host.locator('.launcher').isVisible(), true);
  assert.equal((await host.locator('.launcher').textContent()).trim(), '');
  const launcherSize = await host.locator('.launcher').boundingBox();
  assert.equal(launcherSize.width, 36);
  const iconColors = await host.locator('.launcher').evaluate(node => ({ bg: getComputedStyle(node).backgroundColor, fg: getComputedStyle(node).color }));
  assert.notEqual(iconColors.bg, iconColors.fg);
  const iconBefore = await host.locator('.launcher').boundingBox();
  const dx = iconBefore.x > 190 ? -80 : 80;
  await page.mouse.move(iconBefore.x + 18, iconBefore.y + 18);
  await page.mouse.down();
  await page.mouse.move(iconBefore.x + 18 + dx, iconBefore.y + 58, { steps: 8 });
  await page.mouse.up();
  assert.equal(await host.locator('.panel').isVisible(), false, 'Releasing a dragged icon must not open it.');
  const iconAfter = await host.locator('.launcher').boundingBox();
  assert.ok(Math.abs(iconAfter.x - iconBefore.x - dx) < 2);
  assert.ok(Math.abs(iconAfter.y - iconBefore.y - 40) < 2);
  await host.locator('.launcher').click();
  assert.equal(await host.locator('.panel').isVisible(), true, 'A regular click still opens after dragging.');
  const expandedAfterDrag = await host.locator('.panel').boundingBox();
  assert.ok(expandedAfterDrag.x >= 16 && expandedAfterDrag.x + expandedAfterDrag.width <= 374);
  assert.ok(Math.abs(expandedAfterDrag.y - iconAfter.y) < 2);
  await host.locator('.collapse').click();
  console.log('PASS: collapsed icon drags without opening; click reopens within viewport bounds');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('https://x.com/i/article/456?theme=dark');
  await host.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.dataset.theme === 'dark');
  assert.equal(await host.locator('.toc-item[data-depth="1"]').count(), 1);
  await page.screenshot({ path: join(screenshots, 'reader-dark.png'), animations: 'disabled' });
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="twitterArticleRichTextView"]');
    for (let i = 8; i <= 40; i++) root.insertAdjacentHTML('beforeend', `<h2>${i}、用于验证紧凑目录的章节</h2><p>章节内容</p>`);
  });
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.shadowRoot.querySelectorAll('.toc-item').length === 40);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await host.locator('.toc-item').last().click();
  const listPosition = await host.evaluate(node => {
    const shadow = node.shadowRoot;
    const item = shadow.querySelector('[aria-current="true"]').getBoundingClientRect();
    const nav = shadow.querySelector('nav').getBoundingClientRect();
    return { top: item.top, bottom: item.bottom, navTop: nav.top, navBottom: nav.bottom };
  });
  assert.ok(listPosition.top >= listPosition.navTop && listPosition.bottom <= listPosition.navBottom + 1);
  const largePanel = await host.locator('.panel').boundingBox();
  assert.ok(largePanel.height > 600 && largePanel.y + largePanel.height <= 984);
  await page.screenshot({ path: join(screenshots, 'reader-dark.png'), animations: 'disabled' });
  assert.equal(await host.locator('h2,.article-title,.footer').count(), 0);
  await page.evaluate(() => document.querySelectorAll('[data-testid="twitterArticleRichTextView"] > h2').forEach(node => { if (/^\d+、用于验证/.test(node.textContent)) { node.nextElementSibling.remove(); node.remove(); } }));
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.shadowRoot.querySelectorAll('.toc-item').length === 7);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  console.log('PASS: dark theme, formal heading hierarchy and bounded scrolling with 40 chapters');

  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  await manager.waitForSelector('extensions-item');
  const id = await manager.locator('extensions-item').evaluateAll(items => items.find(item => item.data?.name === 'x-reader')?.id);
  assert.ok(id, 'The unpacked x-reader extension should appear in Chromium extension management.');
  await manager.close();
  const popup = await context.newPage();
  popup.on('pageerror', error => errors.push(error.message));
  await popup.setViewportSize({ width: 360, height: 660 });
  await page.bringToFront();
  await popup.goto(`chrome-extension://${id}/src/popup/popup.html`);
  await popup.waitForFunction(() => document.querySelector('#status-label').textContent === '当前长文' && !document.querySelector('#toggle').disabled);
  await popup.evaluate(() => chrome.action.openPopup());
  await popup.waitForFunction(() => chrome.extension.getViews({ type: 'popup' }).some(view => view.document.readyState === 'complete' && view.document.querySelector('#status-label')?.textContent !== '正在读取页面'));
  await popup.evaluate(() => new Promise(resolve => {
    const view = chrome.extension.getViews({ type: 'popup' })[0];
    view.requestAnimationFrame(() => view.requestAnimationFrame(resolve));
  }));
  const nativePopup = await popup.evaluate(() => chrome.extension.getViews({ type: 'popup' }).map(view => ({
    width: view.innerWidth, height: view.innerHeight, contentWidth: view.document.documentElement.scrollWidth,
    titleWidth: view.document.querySelector('h1').getBoundingClientRect().width
  })));
  assert.equal(nativePopup.length, 1, 'Open the actual toolbar popup instead of validating only a full browser tab.');
  assert.equal(nativePopup[0].width, 360, 'The native popup must not shrink to its initial 178px viewport.');
  assert.ok(nativePopup[0].contentWidth <= 360);
  await popup.evaluate(() => chrome.extension.getViews({ type: 'popup' }).forEach(view => view.close()));
  await popup.screenshot({ path: join(screenshots, 'popup.png'), animations: 'disabled' });
  await popup.locator('[name="enabled"]').uncheck();
  await page.waitForFunction(() => !document.querySelector('[data-x-reader-host]'));
  await popup.locator('[name="enabled"]').check();
  await host.waitFor({ state: 'visible' });
  await popup.locator('[name="theme"]').selectOption('light');
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.dataset.theme === 'light');
  await popup.reload();
  assert.equal(await popup.locator('[name="theme"]').inputValue(), 'light');
  console.log('PASS: popup communicates with the page; disable/re-enable; theme settings survive reopening');
  await popup.locator('[name="theme"]').selectOption('auto');
  await popup.close();

  await page.evaluate(() => history.pushState({}, '', '/home'));
  await page.waitForFunction(() => !document.querySelector('[data-x-reader-host]'));
  await page.evaluate(() => history.pushState({}, '', '/i/article/456'));
  await host.waitFor({ state: 'visible' });
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="twitterArticleRichTextView"]');
    root.insertAdjacentHTML('beforeend', '<h2>8、异步加载的章节</h2>');
  });
  await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.shadowRoot.querySelectorAll('.toc-item').length === 8);
  assert.equal(await page.locator('[data-x-reader-host]').count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: SPA exit/re-entry and asynchronous content update; no uncaught page errors');
  console.log(`Screenshots: ${screenshots}`);
  console.log('Browser verification uses intercepted local X fixtures, not the live X service.');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
