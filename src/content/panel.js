import { panelStyles } from './styles.js';
import { makeDraggable } from './drag.js';

const icons = {
  outline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h2m4 0h10M4 12h2m4 0h7M4 18h2m4 0h10"/></svg>',
  collapse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
};

export function createPanel(doc, actions) {
  const host = doc.createElement('div');
  host.setAttribute('data-x-reader-host', '');
  const shadow = host.attachShadow({ mode: 'open' });
  // Only static extension-owned markup goes through innerHTML; page content uses textContent.
  shadow.innerHTML = `<style>${panelStyles}</style>
    <section class="panel" aria-label="x-reader 文章目录">
      <div class="masthead" tabindex="0" role="group" aria-label="拖动目录位置" title="拖动调整位置，Alt + 方向键移动；上下键切换章节">
        <span class="grip" aria-hidden="true"></span><button class="icon-button collapse" aria-label="收起目录" title="收起目录">${icons.collapse}</button>
      </div>
      <nav aria-label="文章章节"><ol></ol></nav>
      <div class="empty" hidden><strong>还没有发现章节标题</strong>请先展开完整长文，或在扩展设置中开启加粗、编号小标题识别。<br>页面更新后，目录会自动更新。</div>
    </section>
    <button class="launcher" aria-label="展开文章目录" title="点击展开目录，拖动调整位置" aria-expanded="false">${icons.outline}</button>`;
  const $ = selector => shadow.querySelector(selector);
  const drag = makeDraggable(host, [$('.masthead'), $('.launcher')]);
  let signature = '';
  let active = -1;
  let listButtons = [];
  $('.collapse').addEventListener('click', () => { actions.onToggle(); $('.launcher').focus(); });
  $('.launcher').addEventListener('click', () => { actions.onToggle(); ($('.toc-item') || $('.collapse')).focus(); });
  $('ol').addEventListener('click', event => {
    const item = event.target.closest('[data-index]');
    if (item) actions.onJump(Number(item.dataset.index));
  });
  shadow.addEventListener('keydown', event => {
    if (event.key === 'Escape') { actions.onClose(); $('.launcher').focus(); }
  });
  doc.body.append(host);

  return {
    host,
    render({ outline, open, show, theme, left, compact, width = 350, top, docked = false }) {
      host.hidden = !show;
      host.dataset.theme = theme;
      host.dataset.compact = String(compact);
      host.dataset.open = String(open);
      host.dataset.docked = String(docked);
      host.style.setProperty('--panel-width', `${width}px`);
      $('.panel').hidden = !open;
      $('.launcher').hidden = open;
      drag.place({ left, compact, top });
      $('.launcher').setAttribute('aria-expanded', String(open));
      $('.empty').hidden = outline.headings.length > 0;
      $('nav').hidden = outline.headings.length === 0;
      const nextSignature = JSON.stringify(outline.headings.map(item => [item.text, item.level]));
      if (signature === nextSignature) return;
      signature = nextSignature;
      active = -1;
      const minLevel = Math.min(...outline.headings.map(item => item.level));
      const fragment = doc.createDocumentFragment();
      listButtons = outline.headings.map((heading, index) => {
        const li = doc.createElement('li');
        const button = doc.createElement('button');
        button.className = 'toc-item';
        button.dataset.index = index;
        button.dataset.depth = Math.min(3, heading.level - minLevel);
        const label = doc.createElement('span');
        label.className = 'label';
        label.textContent = heading.text;
        button.append(label);
        li.append(button);
        fragment.append(li);
        return button;
      });
      $('ol').replaceChildren(fragment);
    },
    setActive(index) {
      if (index === active) return;
      listButtons[active]?.removeAttribute('aria-current');
      const button = listButtons[index];
      if (button) {
        button.setAttribute('aria-current', 'true');
        const nav = $('nav');
        const top = button.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
        if (top < nav.scrollTop || top + button.offsetHeight > nav.scrollTop + nav.clientHeight) {
          nav.scrollTop = Math.max(0, top - nav.clientHeight / 3);
        }
      }
      active = index;
    },
    destroy() { drag.destroy(); host.remove(); }
  };
}
