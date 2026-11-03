const HEADING = 'h1,h2,h3,h4,h5,h6,[role="heading"]';
const RICH_TEXT = '[data-testid="twitterArticleRichTextView"], [data-testid="twitterArticleRichText"]';
const EXCLUDED = 'blockquote,pre,code,li,aside,button,[hidden],[aria-hidden="true"],[data-testid="quoteTweet"],[data-x-reader-host]';
const BLOCK = /^(P|DIV|SECTION|HEADER|FIGCAPTION|H[1-6])$/;
const NUMBERED = /^(?:(?:\d{1,2}|[一二三四五六七八九十百]+)[、.．)）:：]\s*\S|第[\d一二三四五六七八九十百]+[章节部分篇]\s*\S|(?:chapter|part|section)\s+\d+\b)/i;

export function isReadingRoute(href) {
  try {
    const url = new URL(href);
    return ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) &&
      /^\/[^/]+\/(?:status|articles?)\/\d+(?:\/|$)/.test(url.pathname);
  } catch { return false; }
}

function visible(element) {
  if (element.closest(EXCLUDED)) return false;
  for (let current = element; current; current = current.parentElement) {
    if (current.hidden || current.getAttribute('aria-hidden') === 'true') return false;
    const style = current.ownerDocument.defaultView.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

export function findArticle(doc, href) {
  if (!isReadingRoute(href)) return null;
  const main = doc.querySelector('[data-testid="primaryColumn"]') || doc.querySelector('main');
  if (!main) return null;
  const id = new URL(href).pathname.match(/\/status\/(\d+)/)?.[1];
  const tweets = [...main.querySelectorAll('article[data-testid="tweet"]')];
  const tweet = tweets.find(candidate => [...candidate.querySelectorAll('a[href]')].some(link => {
    return link.querySelector('time') && link.getAttribute('href').match(/\/status\/(\d+)(?:\/|$)/)?.[1] === id &&
      !link.parentElement.closest('[data-testid="quoteTweet"], [role="link"]');
  }));
  const rich = [...main.querySelectorAll(RICH_TEXT)].find(root => {
    const owner = root.closest('article[data-testid="tweet"]');
    return visible(root) && !root.closest('[role="link"]') && (!id || !owner || owner === tweet);
  });
  const root = rich || (tweet && [...tweet.querySelectorAll('[data-testid="tweetText"]')].find(text => !text.closest('[role="link"]')));
  if (!root || !visible(root)) return null;
  const titleElement = main.querySelector('[data-testid="twitterArticleTitle"], [data-testid="twitter-article-title"]') || (rich && root.querySelector('h1'));
  const firstLine = (root.innerText || root.textContent).trim().split('\n').find(line => line.trim());
  const title = titleElement?.textContent.trim() || (firstLine && Array.from(firstLine.trim()).slice(0, 80).join('')) || '当前长文';
  return { root, title, titleElement, article: tweet || root };
}

export function extractOutline(article, options = {}) {
  if (!article) return { title: '', root: null, headings: [] };
  const { root, title, titleElement } = article;
  const settings = { detectBold: true, detectNumbered: true, ...options };
  const doc = root.ownerDocument;
  const headings = [];
  let line = [];

  function flush() {
    const parts = line;
    line = [];
    const text = parts.map(part => part.text).join('').replace(/\s+/g, ' ').trim();
    if (text.length < 2 || text.length > 80 || /[。！？!?；;]/.test(text)) return;
    if (parts.some(part => part.link)) return;
    const meaningful = parts.filter(part => part.text.trim());
    if (!meaningful.length) return;
    const bold = meaningful.every(part => part.bold);
    if (!(settings.detectBold && bold) && !(settings.detectNumbered && NUMBERED.test(text))) return;
    const first = meaningful[0];
    const last = meaningful.at(-1);
    const target = doc.createRange();
    target.setStart(first.node, first.start);
    target.setEnd(last.node, last.start + last.text.length);
    headings.push({ text, level: 2, target, element: first.node.parentElement, kind: bold ? 'bold' : 'numbered' });
  }

  function walk(node, inheritedBold = false) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      for (const match of text.matchAll(/[^\n]+|\n/g)) {
        if (match[0] === '\n') flush();
        else line.push({ text: match[0], node, start: match.index, bold: inheritedBold, link: Boolean(node.parentElement.closest('a')) });
      }
      return;
    }
    if (node.nodeType !== 1) return;
    if (node !== root && (node.matches(EXCLUDED) || !visible(node) ||
      (node.matches('[data-testid="tweetText"]') && node !== root))) { flush(); return; }
    if (node.matches('br')) { flush(); return; }
    if (node !== root && node.matches(HEADING)) {
      flush();
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text && node !== titleElement) {
        const level = Number(node.getAttribute('aria-level')) || Number(node.tagName.slice(1)) || 2;
        headings.push({ text, level: Math.max(1, Math.min(6, level)), target: node, element: node, kind: 'heading' });
      }
      return;
    }
    const block = node !== root && BLOCK.test(node.tagName);
    if (block) flush();
    const weight = doc.defaultView.getComputedStyle(node).fontWeight;
    const bold = inheritedBold || node.matches('b,strong') || weight === 'bold' || Number(weight) >= 600;
    for (const child of node.childNodes) walk(child, bold);
    if (block) flush();
  }
  walk(root);
  flush();
  const hasNativeHeadings = headings.some(heading => heading.kind === 'heading' && /^H[1-6]$/.test(heading.element.tagName));
  return { title, root, headings: hasNativeHeadings ? headings.filter(heading => heading.kind === 'heading') : headings };
}

export function targetRect(heading) {
  const target = heading.target;
  if ('commonAncestorContainer' in target && !target.commonAncestorContainer.isConnected) return null;
  if ('isConnected' in target && !target.isConnected) return null;
  return typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : heading.element.getBoundingClientRect();
}
