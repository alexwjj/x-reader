import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createPanel } from '../src/content/panel.js';

function setup(t, actions = {}) {
  const dom = new JSDOM('<body></body>', { pretendToBeVisual: true });
  const panel = createPanel(dom.window.document, { onToggle() {}, onClose() {}, onJump() {}, ...actions });
  const state = { outline: { title: '这是应该完整展示的文章标题', headings: [{ text: '一、正文自带的编号', level: 1 }] }, open: true, show: true, theme: 'light', left: 500, compact: false };
  panel.render(state);
  t.after(() => { panel.destroy(); dom.window.close(); });
  return { dom, panel, state, shadow: panel.host.shadowRoot };
}

// Catches reintroducing synthetic numbering, badges or manual refresh controls.
test('outline preserves author headings without extra numbering or count controls', t => {
  const { shadow } = setup(t);
  assert.equal(shadow.querySelector('.toc-item').textContent, '一、正文自带的编号');
  assert.equal(shadow.querySelector('.count'), null);
  assert.equal(shadow.querySelector('.launcher-count'), null);
  assert.equal(shadow.querySelector('button[aria-label="重新扫描标题"]'), null);
});

// The reading companion should show only navigation, with an icon-only collapsed control.
test('compact panel omits titles and footer and collapses to an icon', t => {
  const { shadow } = setup(t);
  assert.equal(shadow.querySelector('h2,.article-title,.footer,.top-button'), null);
  assert.equal(shadow.querySelector('.launcher').textContent.trim(), '');
  assert.ok(shadow.querySelector('.launcher svg'));
});

// Catches dragging being lost when the article rescans or the theme changes.
test('dragged position survives renders and stays within a resized viewport', t => {
  const { dom, panel, state, shadow } = setup(t);
  const win = dom.window;
  panel.host.getBoundingClientRect = () => ({ left: Number.parseFloat(panel.host.style.left) || 500, top: Number.parseFloat(panel.host.style.top) || 86, width: 292, height: 400 });
  const handle = shadow.querySelector('.masthead');
  handle.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 520, clientY: 100 }));
  win.dispatchEvent(new win.MouseEvent('pointermove', { clientX: 420, clientY: 140 }));
  win.dispatchEvent(new win.MouseEvent('pointerup'));
  assert.equal(panel.host.style.left, '400px');
  assert.equal(panel.host.style.top, '126px');
  panel.render({ ...state, theme: 'dark' });
  assert.equal(panel.host.style.left, '400px');
  assert.equal(panel.host.style.top, '126px');
  win.innerWidth = 500;
  win.innerHeight = 400;
  panel.render(state);
  assert.equal(panel.host.style.left, '192px');
  assert.equal(panel.host.style.top, '126px');
});

// Catches collapsed buttons rejecting drag input or toggling open when a drag ends.
test('collapsed icon drags without opening and shares its position with the expanded panel', t => {
  let toggles = 0;
  const { dom, panel, state, shadow } = setup(t, { onToggle() { toggles++; } });
  const win = dom.window;
  panel.render({ ...state, open: false });
  panel.host.getBoundingClientRect = () => ({ left: Number.parseFloat(panel.host.style.left), top: Number.parseFloat(panel.host.style.top), width: panel.host.dataset.open === 'false' ? 36 : 350, height: 36 });
  const launcher = shadow.querySelector('.launcher');
  launcher.querySelector('svg').dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 518, clientY: 104 }));
  win.dispatchEvent(new win.MouseEvent('pointermove', { clientX: 438, clientY: 164 }));
  win.dispatchEvent(new win.MouseEvent('pointerup'));
  launcher.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  assert.equal(panel.host.style.left, '420px');
  assert.equal(panel.host.style.top, '146px');
  assert.equal(toggles, 0);
  panel.render({ ...state, open: true });
  assert.equal(panel.host.style.left, '420px');
  assert.equal(panel.host.style.top, '146px');
  panel.render({ ...state, open: false });
  launcher.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 438, clientY: 164 }));
  win.dispatchEvent(new win.MouseEvent('pointermove', { clientX: 439, clientY: 165 }));
  win.dispatchEvent(new win.MouseEvent('pointerup'));
  launcher.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  assert.equal(toggles, 1);
  assert.equal(panel.host.style.left, '420px');
});

// Catches the close button unintentionally starting a drag, or missing keyboard access.
test('header buttons do not drag; keyboard can move the directory', t => {
  const { dom, panel, shadow } = setup(t);
  const win = dom.window;
  const button = shadow.querySelector('.collapse');
  button.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 520, clientY: 100 }));
  win.dispatchEvent(new win.MouseEvent('pointermove', { clientX: 420, clientY: 140 }));
  win.dispatchEvent(new win.MouseEvent('pointerup'));
  assert.equal(panel.host.style.left, '500px');
  panel.host.getBoundingClientRect = () => ({ left: 500, top: 86, width: 292, height: 400 });
  const handle = shadow.querySelector('.masthead');
  handle.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(panel.host.style.left, '490px');
  const down = new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  handle.dispatchEvent(down);
  assert.equal(down.defaultPrevented, false);
  assert.equal(panel.host.style.top, '86px');
  handle.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }));
  assert.equal(panel.host.style.top, '96px');
});
