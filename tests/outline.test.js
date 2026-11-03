import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { extractOutline, findArticle, isReadingRoute } from '../src/content/outline.js';

function page(html, path = '/writer/status/123') {
  return new JSDOM(`<main><div data-testid="primaryColumn">${html}</div></main>`, { url: `https://x.com${path}` }).window.document;
}
function post(text, id = '123') {
  return `<article data-testid="tweet"><a href="/writer/status/${id}"><time>今天</time></a><div data-testid="tweetText">${text}</div></article>`;
}

// Catches route checks that accidentally run on timelines or unrelated domains.
test('only supported X reading routes are recognized', () => {
  for (const url of ['https://x.com/a/status/123', 'https://twitter.com/a/status/123/photo/1', 'https://x.com/i/article/456', 'https://x.com/i/articles/456']) assert.equal(isReadingRoute(url), true, url);
  for (const url of ['https://x.com/home', 'https://x.com/a', 'https://example.org/a/status/123', 'https://x.com/a/status/no']) assert.equal(isReadingRoute(url), false, url);
});

// Real X permalink anchors have role=link themselves; only enclosing quote cards are excluded.
test('real X role=link permalinks identify the main article', () => {
  const doc = page('<article data-testid="tweet" role="article"><article data-testid="twitterArticleReadView" role="article"><div data-testid="twitter-article-title">长文标题</div><div data-testid="twitterArticleRichTextView"><div data-testid="longformRichTextComponent"><h1 data-block="true"><div><span>一、认识工具</span></div></h1><h2 data-block="true"><div><span>1. 第一步</span></div></h2></div></div></article><a role="link" href="/writer/status/123"><time>今天</time></a></article>');
  const result = extractOutline(findArticle(doc, doc.location.href));
  assert.equal(result.title, '长文标题');
  assert.deepEqual(result.headings.map(h => [h.text, h.level]), [['一、认识工具', 1], ['1. 第一步', 2]]);
});

test('author article routes identify the same longform body', () => {
  const doc = page('<article data-testid="tweet"><a role="link" href="/writer/status/123"><time>今天</time></a><div data-testid="twitterArticleRichTextView"><h1>文章第一章</h1><h2>子章节</h2></div></article>', '/writer/article/123');
  assert.equal(isReadingRoute(doc.location.href), true);
  assert.deepEqual(extractOutline(findArticle(doc, doc.location.href)).headings.map(h => h.text), ['子章节']);
});

// Catches extracting an earlier conversation post, reply, or quote as the main post.
test('selects the permalink-matching post and excludes quotes and replies', () => {
  const doc = page(post('<strong>前文标题</strong>', '111') + post('<strong>1、主帖章节</strong><div role="link"><div data-testid="tweetText"><strong>引用标题</strong></div></div>') + post('<strong>回复标题</strong>', '999'));
  const result = extractOutline(findArticle(doc, doc.location.href));
  assert.deepEqual(result.headings.map(h => h.text), ['1、主帖章节']);
});

// Catches treating a bold fragment in a normal sentence, or numbered body prose, as a heading.
test('extracts standalone bold and numbered lines from tweet spans and line breaks', () => {
  const doc = page(post('<span>导言中有 <strong>局部加粗</strong>，这还是正文。</span><br><br><span style="font-weight: 700">1、Pi Agent | 极简、自由度高</span><br><span>这是正文。</span><br><br><span>2、Claude Code | 开箱即用、功能完整</span><br>2、这是一段很长的正文，它虽然使用了编号，但包含多个句子，不应该被识别成章节标题。这里继续补充说明。<br><strong>总结与选择</strong>'));
  assert.deepEqual(extractOutline(findArticle(doc, doc.location.href)).headings.map(h => h.text), ['1、Pi Agent | 极简、自由度高', '2、Claude Code | 开箱即用、功能完整', '总结与选择']);
});

// Catches losing heading levels, duplicate labels, or accepting hidden/quoted content.
test('article headings preserve hierarchy and separate duplicate targets', () => {
  const doc = page('<h1 data-testid="twitterArticleTitle">长文标题</h1><div data-testid="twitterArticleRichTextView"><h2>开始</h2><p>正文</p><h3>细节</h3><h2>开始</h2><h2 hidden>隐藏章节</h2><blockquote><h2>引用标题</h2></blockquote></div>', '/i/articles/456');
  const result = extractOutline(findArticle(doc, doc.location.href));
  assert.equal(result.title, '长文标题');
  assert.deepEqual(result.headings.map(h => [h.text, h.level]), [['开始', 2], ['细节', 3], ['开始', 2]]);
  assert.notEqual(result.headings[0].target, result.headings[2].target);
});

// Catches bypassing user settings or misclassifying numbered list items.
test('heuristic switches disable only their own recognition mode', () => {
  const doc = page('<div data-testid="twitterArticleRichTextView"><p><strong>加粗标题</strong></p><p>2. 编号章节</p><ol><li>3. 列表内容</li></ol></div>');
  const article = findArticle(doc, doc.location.href);
  assert.deepEqual(extractOutline(article, { detectBold: false, detectNumbered: false }).headings.map(h => h.text), []);
  assert.deepEqual(extractOutline(article, { detectBold: true, detectNumbered: false }).headings.map(h => h.text), ['加粗标题']);
  assert.deepEqual(extractOutline(article, { detectBold: false, detectNumbered: true }).headings.map(h => h.text), ['2. 编号章节']);
});

// Real longform tables and numbered body references must not pollute a semantic outline.
test('formal articles prefer semantic headings over bold table labels and body references', () => {
  const doc = page('<div data-testid="twitter-article-title">文章标题</div><div data-testid="twitterArticleRichTextView"><h1>一、章节</h1><h2>子章节</h2><p><strong>导读卡片</strong></p><table><tr><th><strong>检查项</strong></th><th><strong>结果</strong></th></tr></table><p>第四章已经用过</p></div>');
  assert.deepEqual(extractOutline(findArticle(doc, doc.location.href)).headings.map(h => h.text), ['一、章节', '子章节']);
});

// Catches missing X's Draft.js block structure or duplicating nested spans.
test('Draft.js blocks and role headings are supported without duplicate entries', () => {
  const doc = page('<div data-testid="twitterArticleRichTextView"><div data-block="true"><div class="public-DraftStyleDefault-block"><span style="font-weight:700"><span>第一章 认识工具</span></span></div></div><div role="heading" aria-level="3"><span>深入理解</span></div><p><strong><a href="https://example.com">只有链接</a></strong></p></div>');
  assert.deepEqual(extractOutline(findArticle(doc, doc.location.href)).headings.map(h => [h.text, h.level]), [['第一章 认识工具', 2], ['深入理解', 3]]);
});

// Catches treating an article's tweet wrapper as a mismatching status permalink.
test('formal article content can live inside a tweet wrapper without a status route', () => {
  const doc = page('<h1 data-testid="twitter-article-title">真实标题选择器</h1>' + post('<div data-testid="twitterArticleRichTextView"><h2>文章章节</h2></div>'), '/i/articles/456');
  const result = extractOutline(findArticle(doc, doc.location.href));
  assert.equal(result.title, '真实标题选择器');
  assert.deepEqual(result.headings.map(h => h.text), ['文章章节']);
});

// Catches scanning a sidebar or feed when no actual main article is available.
test('does not fall back to arbitrary page text', () => {
  const doc = page('<aside><h2>趋势</h2></aside>');
  assert.equal(findArticle(doc, doc.location.href), null);
  assert.deepEqual(extractOutline(null).headings, []);
});
