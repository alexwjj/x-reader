import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureHTML } from '../tests/fixtures/article.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'docs/store');
const profile = await mkdtemp(join(tmpdir(), 'x-reader-assets-'));
await mkdir(output, { recursive: true });
const chapters = [
  ['1、先看文章结构，再决定从哪里读', '打开有标题的 X 长文，右侧会自动出现目录。你可以先浏览章节，再选择感兴趣的部分。'],
  ['2、点击标题，直接跳到对应章节', '点击目录时，选中状态立即更新，正文同时滚动到对应位置。无需在长文里反复寻找。'],
  ['2.1 支持原生标题和层级', '正式文章保留标题层级，便于理解章节之间的关系。'],
  ['2.2 兼容加粗和编号小标题', '长帖中的独立加粗行和编号小标题也可以识别，两个识别选项可分别关闭。'],
  ['3、用上下方向键切换章节', '目录展开时，按上方向键阅读上一节，按下方向键进入下一节。输入框保留原有键盘行为。'],
  ['3.1 点击后立即高亮', '平滑滚动途中保留目标章节的选中状态，让每次操作都有明确反馈。'],
  ['4、把目录放在顺手的位置', '目录默认利用正文右侧的侧栏区域。拖动顶部短横条，即可调整面板位置。'],
  ['4.1 收起图标同样可以拖动', '需要更多阅读空间时可以收起目录；直接拖动图标，普通点击再展开。'],
  ['5、浅色和深色，都能自然融入', '外观可以跟随页面，也可以固定为浅色或深色。'],
  ['6、正文更新，目录自动跟上', '页面中的正文内容变化后，目录会自动更新，不需要手动重新扫描。'],
  ['7、在本地处理，不上传文章', '标题和正文只在当前页面内存中用于导航，偏好设置保存在当前浏览器。'],
  ['8、让每次长文阅读都有方向', '这是一篇为扩展演示制作的本地示例文章，用于展示实际目录交互。']
];

function demo(dark) {
  const dom = new JSDOM(fixtureHTML({ dark, semantic: true }));
  const doc = dom.window.document;
  doc.querySelector('[data-testid="twitterArticleTitle"]').textContent = '读长文，先有一张目录';
  doc.querySelector('.intro').textContent = 'x-reader 功能演示 · 以下内容为本地示例，非真实 X 用户文章。';
  const article = doc.querySelector('[data-testid="twitterArticleRichTextView"]');
  article.replaceChildren();
  for (const [title, text] of chapters) {
    const heading = doc.createElement(/^\d+\./.test(title) ? 'h3' : 'h2');
    heading.textContent = title;
    const paragraph = doc.createElement('p');
    paragraph.textContent = text;
    article.append(heading, paragraph);
  }
  const html = dom.serialize();
  dom.window.close();
  return html;
}

const asData = file => readFile(file).then(bytes => `data:image/png;base64,${bytes.toString('base64')}`);
const logo = await readFile(join(root, 'icons/logo.svg'), 'utf8');
const base = `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#0f1419;background:#f7f9fa}.brand{display:flex;align-items:center;gap:12px;font-weight:750;font-size:26px;letter-spacing:-1px}.brand svg{width:40px;height:40px}.eyebrow{font-size:12px;font-weight:600;letter-spacing:2px;color:#536471}.accent{color:#1d9bf0}.preview{overflow:hidden;background:#fff;border:1px solid #cfd9de;border-radius:16px}.preview img{display:block;width:100%}.windowbar{height:30px;border-bottom:1px solid #eff3f4;display:flex;align-items:center;gap:5px;padding:0 12px;color:#536471;font-size:10px}.dot{width:5px;height:5px;border-radius:50%;background:#cfd9de}.caption{margin-left:auto}.pill{display:inline-block;padding:7px 11px;border:1px solid #cfd9de;border-radius:20px;font-size:12px;color:#536471;margin-right:7px}`;
let context;
try {
  // Asset capture needs an isolated Chromium profile with the unpacked extension enabled.
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  await context.route('https://x.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: demo(new URL(route.request().url()).searchParams.has('dark')) }));
  const page = context.pages()[0] || await context.newPage();
  for (const theme of ['light', 'dark']) {
    await page.goto(`https://x.com/i/article/456${theme === 'dark' ? '?dark' : ''}`);
    await page.locator('[data-x-reader-host] .toc-item').first().waitFor();
    await page.waitForFunction(() => document.querySelector('[data-x-reader-host]')?.dataset.docked === 'true');
    await page.screenshot({ path: join(output, `screenshot-${theme}-1280x800.png`), animations: 'disabled' });
    if (theme === 'light') await page.locator('[data-x-reader-host] .panel').screenshot({ path: join(output, 'outline-detail.png'), animations: 'disabled' });
  }
  const screen = await asData(join(output, 'screenshot-light-1280x800.png'));
  const outline = await asData(join(output, 'outline-detail.png'));
  const preview = `<div class="preview"><div class="windowbar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="caption">x-reader · 本地功能演示</span></div><img src="${screen}" alt="实际扩展在本地示例文章上的目录"></div>`;
  const artwork = await context.newPage();
  const sizes = [];
  async function render(name, width, height, css, body) {
    await artwork.setViewportSize({ width, height });
    await artwork.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>x-reader 宣传图</title><style>${base}${css}</style></head><body>${body}</body></html>`);
    await artwork.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    await artwork.screenshot({ path: join(output, `${name}.png`), animations: 'disabled' });
    sizes.push({ file: `${name}.png`, width, height });
  }
  await render('readme-hero-1280x640', 1280, 640,
    '.brand{position:absolute;left:56px;top:44px}.copy{position:absolute;left:56px;top:146px;width:460px}h1{font-size:64px;line-height:1.12;letter-spacing:-3px;margin:18px 0 24px;font-weight:800}.lead{font-size:19px;line-height:1.8;color:#536471;margin:0 0 28px}.preview{position:absolute;left:564px;top:129px;width:660px}.footer{position:absolute;left:56px;bottom:38px;font-size:12px;color:#536471}',
    `<div class="brand">${logo}x-reader</div><div class="copy"><div class="eyebrow">CHROME EXTENSION · OPEN SOURCE</div><h1>读长文，<br>先有<span class="accent">目录。</span></h1><p class="lead">为 X 长文自动生成章节导航。<br>看清结构，跳到你想读的地方。</p><span class="pill">即时跳转</span><span class="pill">上下键切换</span><span class="pill">本地处理</span></div>${preview}<div class="footer">github.com/alexwjj/x-reader</div>`);
  await render('promo-small-440x280', 440, 280,
    '.brand{position:absolute;left:24px;top:22px;font-size:23px}.brand svg{width:32px;height:32px}h1{position:absolute;left:24px;top:74px;margin:0;font-size:33px;line-height:1.25;letter-spacing:-1px;z-index:1}.lead{position:absolute;left:24px;top:171px;font-size:13px;line-height:1.8;color:#536471;z-index:1}.detail{position:absolute;left:263px;top:108px;width:240px;border:1px solid #cfd9de;border-radius:12px;overflow:hidden;transform:rotate(-4deg)}.detail img{display:block;width:100%}.tag{position:absolute;left:24px;bottom:22px;font-size:11px;color:#536471}',
    `<div class="brand">${logo}x-reader</div><h1>X 长文，<br><span class="accent">自带目录。</span></h1><p class="lead">自动识别标题<br>点击直达章节</p><div class="detail"><img src="${outline}" alt="本地目录示例"></div><div class="tag">开源 · 本地处理</div>`);
  await render('promo-marquee-1400x560', 1400, 560,
    '.brand{position:absolute;left:64px;top:40px}.copy{position:absolute;left:64px;top:135px;width:530px}h1{font-size:59px;line-height:1.17;letter-spacing:-2px;margin:18px 0 22px}.lead{font-size:19px;line-height:1.8;color:#536471}.preview{position:absolute;left:632px;top:76px;width:704px}.footer{position:absolute;left:64px;bottom:38px;font-size:13px;color:#536471}',
    `<div class="brand">${logo}x-reader</div><div class="copy"><div class="eyebrow">A TABLE OF CONTENTS FOR X</div><h1>长文再长，<br>也能<span class="accent">一眼看清结构。</span></h1><p class="lead">自动目录 · 即时跳转 · 上下键切换<br>浅色深色，跟随你的阅读习惯。</p></div>${preview}<div class="footer">开源 · 无需配置 · 在本地处理文章</div>`);
  await artwork.setViewportSize({ width: 128, height: 128 });
  await artwork.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{position:absolute;left:16px;top:16px;width:96px;height:96px}</style></head><body>${logo}</body></html>`);
  await artwork.screenshot({ path: join(output, 'store-icon-128.png'), omitBackground: true });
  await writeFile(join(output, 'assets.json'), `${JSON.stringify({ screenshots: [
    { file: 'screenshot-light-1280x800.png', width: 1280, height: 800 },
    { file: 'screenshot-dark-1280x800.png', width: 1280, height: 800 }
  ], promotional: sizes }, null, 2)}\n`);
  console.log(`Generated Chrome Web Store screenshots, promo tiles and README hero → ${output}`);
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
