import { extractOutline, findArticle, isReadingRoute, targetRect } from './outline.js';
import { createPanel } from './panel.js';
import { createSettingsStore } from '../shared/settings.js';

const OFFSET = 96;

export async function startReader(win = window, store = createSettingsStore()) {
  const doc = win.document;
  let settings = await store.load();
  let outline = { title: '', root: null, headings: [] };
  let panel = null;
  let override = null;
  let route = '';
  let observer = null;
  let themeObserver = null;
  let routeTimer = null;
  let scanTimer = null;
  let frame = null;
  let destroyed = false;
  let attached = false;
  let selectedIndex = 0;
  let navigation = null;
  let navigationTimer = null;
  const media = win.matchMedia?.('(prefers-color-scheme: dark)');

  function layout() {
    const rect = (outline.root?.closest('[data-testid="primaryColumn"]') || outline.root)?.getBoundingClientRect();
    const sidebar = doc.querySelector('[data-testid="sidebarColumn"]');
    const rail = sidebar?.getBoundingClientRect();
    if (rail?.width >= 280 && rail.left >= (rect?.right || 0) && rail.left + 280 <= win.innerWidth - 16) {
      const sections = [...sidebar.querySelectorAll('section')];
      const trends = sidebar.querySelector('[data-testid="trend"]')?.closest('section') || sections.find(section =>
        /有什么新鲜事|正在发生|what[’']?s happening|trends for you|trending/i.test(section.querySelector('h1,h2,[role="heading"]')?.textContent || ''));
      const related = sidebar.querySelector('[data-testid="UserCell"]')?.closest('aside,section');
      const card = trends?.getBoundingClientRect();
      const relatedRect = related?.getBoundingClientRect();
      const area = card?.width >= 280 ? card : relatedRect?.width >= 280 ? relatedRect : rail;
      const left = Math.round(Math.max(rail.left, area.left));
      const width = Math.floor(Math.min(area.width, rail.right - left, win.innerWidth - left - 16));
      if (width >= 280) {
        const desiredTop = card?.width >= 280 ? card.top : relatedRect?.bottom ? relatedRect.bottom + 16 : 86;
        const top = Math.round(Math.max(86, Math.min(desiredTop, win.innerHeight - 256)));
        return { compact: false, docked: true, left, top, width };
      }
    }
    const left = rect && rect.right > 0 ? Math.round(rect.right + 24) : null;
    const available = left === null ? 0 : win.innerWidth - left - 16;
    const compact = available < 300;
    return { compact, docked: false, left: compact ? null : left, width: compact ? 350 : Math.min(350, available) };
  }

  function theme() {
    if (settings.theme !== 'auto') return settings.theme;
    for (const element of [doc.body, doc.documentElement]) {
      const color = win.getComputedStyle(element).backgroundColor;
      const rgb = color.match(/[\d.]+/g)?.map(Number);
      if (rgb && rgb.length >= 3 && (rgb.length < 4 || rgb[3] > 0)) {
        if ((rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722) >= 128) return 'light';
        return rgb[2] > rgb[0] + 8 && rgb[2] > rgb[1] ? 'dim' : 'dark';
      }
    }
    return media?.matches ? 'dark' : 'light';
  }

  function paint() {
    if (!panel) return;
    const position = layout();
    panel.render({ outline, ...position, theme: theme(), open: override ?? !position.compact,
      show: outline.headings.length > 0 || override === true });
    highlight();
  }

  function highlight() {
    if (!panel || !outline.headings.length) return;
    if (navigation) {
      panel.setActive(selectedIndex);
      return;
    }
    selectedIndex = 0;
    for (let i = 0; i < outline.headings.length; i++) {
      const rect = targetRect(outline.headings[i]);
      if (rect && rect.top <= OFFSET + 16) selectedIndex = i;
    }
    panel.setActive(selectedIndex);
  }

  function onScroll() {
    if (frame !== null) return;
    frame = win.requestAnimationFrame(() => { frame = null; highlight(); });
  }

  function jump(index) {
    const heading = outline.headings[index];
    if (!heading) return;
    const rect = targetRect(heading);
    if (!rect) { refresh(); return; }
    clearNavigation();
    selectedIndex = index;
    navigation = heading;
    panel.setActive(index);
    navigationTimer = win.setTimeout(() => { clearNavigation(); highlight(); }, 3000);
    const behavior = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    win.scrollTo({ top: Math.max(0, win.scrollY + rect.top - OFFSET), behavior });
  }

  function clearNavigation() {
    win.clearTimeout(navigationTimer);
    navigationTimer = navigation = null;
  }

  function onScrollEnd(event) {
    if (!navigation || (event.target !== doc && event.target !== win)) return;
    const rect = targetRect(navigation);
    const limit = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
    const destination = rect && Math.max(0, Math.min(limit, win.scrollY + rect.top - OFFSET));
    if (rect && Math.abs(win.scrollY - destination) < 3) clearNavigation();
  }

  function onInterrupt(event) {
    if (event.composedPath().includes(panel?.host)) return;
    clearNavigation();
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.composedPath().some(node => node.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="listbox"],[role="slider"]'))) return;
    if (['PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) { clearNavigation(); return; }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if (!panel || panel.host.hidden || !(override ?? !layout().compact) || !outline.headings.length) return;
    event.preventDefault();
    const index = Math.max(0, Math.min(outline.headings.length - 1, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)));
    if (index === selectedIndex) return;
    jump(index);
    if (panel.host.shadowRoot.activeElement?.matches('.toc-item')) {
      panel.host.shadowRoot.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true });
    }
  }

  function removePanel() {
    clearNavigation();
    selectedIndex = 0;
    panel?.destroy();
    panel = null;
    outline = { title: '', root: null, headings: [] };
  }

  function refresh() {
    if (destroyed || !settings.enabled) return;
    const nextRoute = win.location.pathname;
    if (route !== nextRoute) { override = null; removePanel(); route = nextRoute; }
    if (!isReadingRoute(win.location.href)) { removePanel(); return; }
    outline = extractOutline(findArticle(doc, win.location.href), settings);
    if (navigation) {
      const index = outline.headings.findIndex(heading => heading.target === navigation.target ||
        (heading.element === navigation.element && heading.text === navigation.text &&
          heading.target.startContainer === navigation.target.startContainer && heading.target.startOffset === navigation.target.startOffset));
      if (index < 0) clearNavigation();
      else { selectedIndex = index; navigation = outline.headings[index]; }
    }
    if (!panel) panel = createPanel(doc, {
      onToggle: toggle,
      onClose() { override = false; clearNavigation(); paint(); },
      onJump: jump
    });
    paint();
  }

  function toggle() {
    if (!settings.enabled || !isReadingRoute(win.location.href)) return;
    if (!panel) refresh();
    const { compact } = layout();
    override = !(override ?? (!compact && outline.headings.length > 0));
    if (!override) clearNavigation();
    paint();
  }

  function schedule() {
    if (scanTimer !== null) return;
    scanTimer = win.setTimeout(() => { scanTimer = null; refresh(); }, 160);
  }

  function relevant(record) {
    const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
    if (target?.closest('[data-x-reader-host]')) return false;
    const columns = 'main,[data-testid="primaryColumn"],[data-testid="sidebarColumn"]';
    if (target?.closest(columns)) return true;
    return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
      !node.matches('[data-x-reader-host]') && (node.matches(columns) || node.querySelector(columns)));
  }

  function attach() {
    if (attached) return;
    attached = true;
    observer = new win.MutationObserver(records => { if (records.some(relevant)) schedule(); });
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    themeObserver = new win.MutationObserver(paint);
    for (const element of [doc.body, doc.documentElement]) themeObserver.observe(element, { attributes: true, attributeFilter: ['class', 'style'] });
    // pushState is not observable across isolated worlds; a small route-only check covers X's SPA navigation.
    routeTimer = win.setInterval(() => { if (route !== win.location.pathname) refresh(); }, 700);
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('scrollend', onScrollEnd);
    win.addEventListener('wheel', onInterrupt, { passive: true });
    win.addEventListener('touchstart', onInterrupt, { passive: true });
    win.addEventListener('pointerdown', onInterrupt);
    win.addEventListener('keydown', onKeyDown);
    win.addEventListener('resize', paint);
    win.addEventListener('popstate', refresh);
    media?.addEventListener('change', paint);
  }

  function detach() {
    attached = false;
    observer?.disconnect();
    themeObserver?.disconnect();
    win.clearInterval(routeTimer);
    win.clearTimeout(scanTimer);
    if (frame !== null) win.cancelAnimationFrame(frame);
    scanTimer = frame = null;
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('scrollend', onScrollEnd);
    win.removeEventListener('wheel', onInterrupt);
    win.removeEventListener('touchstart', onInterrupt);
    win.removeEventListener('pointerdown', onInterrupt);
    win.removeEventListener('keydown', onKeyDown);
    win.removeEventListener('resize', paint);
    win.removeEventListener('popstate', refresh);
    media?.removeEventListener('change', paint);
    removePanel();
  }

  const unsubscribe = store.subscribe(value => {
    settings = value;
    if (settings.enabled) { attach(); refresh(); } else detach();
  });
  if (settings.enabled) { attach(); refresh(); }
  return {
    refresh,
    toggle,
    status() {
      const compact = layout().compact;
      return { enabled: settings.enabled, supported: isReadingRoute(win.location.href), count: outline.headings.length,
        title: outline.title, open: Boolean(panel && !panel.host.hidden && (override ?? !compact)) };
    },
    destroy() {
      destroyed = true;
      unsubscribe();
      detach();
    }
  };
}
