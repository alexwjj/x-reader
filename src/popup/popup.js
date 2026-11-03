import { createSettingsStore } from '../shared/settings.js';

const store = createSettingsStore();
const form = document.querySelector('#settings');
const $ = selector => document.querySelector(selector);
let tabId;
let enabled = true;
let noticeTimer;

function notice(text, error = false) {
  clearTimeout(noticeTimer);
  $('#notice').textContent = text;
  $('#notice').dataset.error = String(error);
  if (!error) noticeTimer = setTimeout(() => { $('#notice').textContent = ''; }, 2200);
}
function renderSettings(settings) {
  enabled = settings.enabled;
  for (const key of ['enabled', 'detectBold', 'detectNumbered']) form.elements[key].checked = settings[key];
  form.elements.theme.value = settings.theme;
  if (settings.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = settings.theme;
}
async function message(type) {
  if (tabId === undefined) return null;
  try { return await chrome.tabs.sendMessage(tabId, { type: `x-reader:${type}` }); }
  catch { return null; }
}
async function updateStatus() {
  const status = await message('status');
  const supported = status?.supported && !status.error;
  $('#toggle').disabled = !supported || !enabled;
  $('#status-label').textContent = !enabled ? '目录已暂停' : supported ? '当前长文' : '等待打开长文';
  $('#page-title').textContent = supported && status.title ? status.title : '让长文更好读';
  $('#page-detail').textContent = !enabled ? '开启下方开关，继续使用长文目录。' : supported ? (status.count ? (status.open ? '目录已在页面右侧自动显示。' : '目录已收起，可随时展开继续阅读。') : '未发现标题，展开全文后会自动更新。') : '请打开 X 帖子或文章详情页；安装后已打开的页面需要刷新。';
  $('#toggle').firstChild.textContent = status?.open ? '收起目录' : '展开目录';
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('change', async event => {
  const input = event.target;
  if (!['enabled', 'detectBold', 'detectNumbered', 'theme'].includes(input.name)) return;
  const value = input.type === 'checkbox' ? input.checked : input.value;
  try {
    renderSettings(await store.save({ [input.name]: value }));
    notice('偏好已保存');
    await updateStatus();
  } catch { notice('保存失败，请重新打开扩展后重试。', true); }
});
$('#toggle').addEventListener('click', async () => {
  const result = await message('toggle');
  if (!result || result.error) notice('页面连接已断开，请刷新 X 页面。', true);
  await updateStatus();
});

try {
  renderSettings(await store.load());
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  await updateStatus();
} catch { notice('无法读取配置，请重新加载扩展。', true); }
