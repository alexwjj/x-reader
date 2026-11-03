# 隐私说明 / Privacy

适用于 x-reader 0.1.4，更新日期：2026-11-03。

## 本地处理

x-reader 在受支持的 X/Twitter 页面中读取已加载的正文 DOM，提取文章标题和章节标题，生成可点击目录。正文、标题、DOM 引用、当前章节及面板展开状态只用于页面内存中的导航，不保存为文章档案或阅读历史。

扩展无后台工作线程、远程接口、AI 服务或统计 SDK，不上传正文、目录、网址或使用行为，不读取登录凭证，也不要求配置账号或密钥。不调用 X 私有接口，不主动获取未加载正文，不绕过登录、付费或其他内容访问限制。

## 本地访问的数据类别

- 网站内容：当前受支持长文页面的标题、正文和页面路径。仅在本地用于识别阅读路由、生成目录和定位章节。
- 阅读偏好：启用状态、加粗/编号识别开关和主题，仅保存于当前浏览器。

本地访问和处理网页内容不等于不处理用户数据。上述内容不传输给开发者或第三方，不出售，不用于广告、信用评估或与章节导航无关的目的。关闭页面会释放正文及目录的内存状态。

## 保存的数据

唯一持久化的数据是 `chrome.storage.local` 中 `settings` 项下的四个偏好：

| 字段 | 用途 | 默认值 |
| --- | --- | --- |
| `enabled` | 是否启用目录 | `true` |
| `detectBold` | 是否识别加粗小标题 | `true` |
| `detectNumbered` | 是否识别编号小标题 | `true` |
| `theme` | 目录主题 | `auto` |

这些设置保存在当前浏览器配置文件中，不使用 `chrome.storage.sync`，不由扩展跨设备同步。关闭扩展功能不会清除偏好；卸载扩展会移除其本地存储。

## 权限与网站范围

- 仅申请 `storage` 权限，用于读取、保存偏好和响应设置变更。
- 内容脚本仅匹配 HTTPS 的 `x.com`、`www.x.com`、`twitter.com`、`www.twitter.com`，在受支持的帖子或文章详情路由提取目录。
- 弹窗通过当前标签页与内容脚本交换状态、展开/收起和重新扫描指令；文章数据不会发送到服务器。
- 不申请 `cookies`、`history`、`downloads` 或全站访问权限。

X 网站自身的网络请求与数据处理由 X 决定，本说明覆盖 x-reader 扩展的行为。开发时安装 npm 依赖或 Playwright 浏览器涉及相应软件分发服务，与扩展日常运行无关。

## 联系方式

隐私问题可通过 [项目 Issues](https://github.com/alexwjj/x-reader/issues) 联系维护者。Issue 是公开的，请勿附上私人文章、账号凭据或个人浏览器配置。

## English

x-reader processes already-loaded article DOM on supported X/Twitter pages to create a local outline. Article text, titles, DOM references, active section and panel state remain in page memory. The extension does not keep article archives or reading history.

Locally accessed website content includes the current article's title, body and page path. It is used only to identify supported reading routes, build the outline and navigate chapters. Local processing is still data processing; this content is not transmitted to the developer or third parties, sold, used for advertising or credit decisions, or used for purposes unrelated to chapter navigation. Closing the page releases article and outline memory. Privacy questions can be raised through the public [project Issues](https://github.com/alexwjj/x-reader/issues); do not post private content or credentials.

Only four preferences persist under `settings` in `chrome.storage.local`: `enabled`, `detectBold`, `detectNumbered` (all default to `true`), and `theme` (defaults to `auto`). The extension does not sync them across devices. Disabling the feature keeps preferences; uninstalling removes its local storage.

The extension requests only `storage`. Its content scripts match HTTPS X/Twitter domains, including their `www` variants. The popup exchanges local status and navigation commands with the active tab. There is no background worker, remote API, AI service, analytics or upload of article content, URLs or usage data. It does not read credentials, require account or API-key configuration, call private X APIs, fetch unloaded text or bypass access restrictions.

X's own network activity and data practices are separate. Installing development dependencies or Playwright browsers contacts their software distribution services; these are not extension runtime services.
