# x-reader

![x-reader: a table of contents for long reads on X](docs/store/readme-hero-1280x640.png)

A clickable table of contents for long reads on X. Navigate headings from a floating panel beside the article, with the current section highlighted as you scroll.

[中文](README.md) · [AI installation](#install-with-an-ai-assistant) · [Privacy](PRIVACY.md) · [Report an issue](https://github.com/alexwjj/x-reader/issues) · [Changelog](CHANGELOG.md)

## Install with an AI assistant

**Local installation is free and requires no store account or registration fee.** Copy the prompt below into an AI assistant that can use your computer's terminal or browser. A chat-only assistant can guide you through the manual steps. The extension itself does not need AI to run.

```text
Help me install x-reader in Chrome on my computer. It is an open-source extension that automatically creates a table of contents for long articles on X/Twitter.

Repository: https://github.com/alexwjj/x-reader

Read the repository README and manifest.json first, then install it:
1. If you can use my terminal or filesystem, download the repository into a permanent local directory. Prefer git clone; if Git is unavailable, download and extract the main branch ZIP. Inspect an existing directory before using it and do not overwrite my files or uncommitted changes. If you cannot operate my computer, give me concise instructions for my operating system.
2. Find the project root containing manifest.json, src/ and icons/, and check that entry files and icons exist. No build is required. Do not run npm install or npm ci, or install Node.js or development dependencies just to install the extension.
3. Open chrome://extensions and help me enable Developer mode, click Load unpacked, and select the project root. For browser or operating-system steps that require my confirmation, tell me exactly what to click and give me the absolute directory path.
4. Refresh existing X tabs. Ask me to open a long article with section headings and expand the full text. Check that the outline appears on the right, clicking headings navigates, and Up/Down switches chapters. Short posts without headings do not show an automatic outline.
5. Tell me where it is installed, which steps you actually completed, and how to update: update the local source, reload the extension in chrome://extensions, then refresh X. Remind me to keep the installation directory because Chrome continues reading its files.

Perform the steps you can directly. Guide me when a manual click or confirmation is required. If you cannot operate or verify the browser, say so instead of claiming installation succeeded. No Chrome Web Store developer registration or registration fee is needed.
```

## Preview

| Light | Dark |
| --- | --- |
| ![Article navigation on a light page](docs/store/screenshot-light-1280x800.png) | ![Dark outline with chapter navigation](docs/store/screenshot-dark-1280x800.png) |

Screenshots show the actual extension running on local demonstration content, without real accounts or user articles.

<p align="center"><img src="docs/screenshots/popup.png" alt="x-reader toolbar popup with page status, outline controls and preferences" width="360"></p>

## Features

- Supports X/Twitter post detail pages and Articles, using semantic headings, standalone bold lines and numbered section titles.
- Appears automatically when headings are available, with click-to-jump navigation and active-section tracking. Updates automatically as the article changes.
- Uses X-style colors, subtle borders, blue selection and 13px labels. Aligns with the right sidebar's trends card below related users, uses the sidebar width and extends toward the bottom of the viewport. No article title, extra numbering, counts or footer.
- Click or press Up/Down to select the previous/next chapter immediately while the article scrolls. Selection stays on the requested chapter throughout smooth scrolling; editors keep their normal arrow-key behavior.
- Drag the top grip or the collapsed icon to reposition it; both share the same position, and releasing a dragged icon does not open it. Focus either control and press Alt + arrow keys to move it. Hold Shift for larger steps.
- Opens beside the article when space allows. On narrow screens or when right-side space is limited, starts as a contrasting 36px outline icon that opens the panel.
- Offers page-following, light and dark themes, with preferences applied immediately.
- Manifest V3 and native JavaScript, with no build step or runtime dependencies. No background worker, remote API, AI or account configuration.

## Install

Requires **Chrome 116+**. No Node.js, npm or payment is needed. The project is distributed through this repository. Follow the manual steps below or use the [AI installation prompt](#install-with-an-ai-assistant).

1. [Download the source ZIP](https://github.com/alexwjj/x-reader/archive/refs/heads/main.zip) and extract it into a permanent directory, or clone this repository. Keep `manifest.json`, `src/` and `icons/` together.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `x-reader/` project root directly. No build is required.
4. Optionally pin x-reader to the toolbar. **Refresh X tabs that were already open when you installed the extension.**

You can also extract the archive produced by `npm run zip` and load the extracted directory containing `manifest.json`. After editing or updating the source, reload the extension in the extension manager, then refresh the X page.

## Usage and settings

Open a post detail page (`/<user>/status/<number>`) or an article (`/<user>/article/<number>`, `/i/article/<number>` or `/i/articles/<number>`) on `x.com` or `twitter.com`, and expand the full text. The outline appears when headings are found. An empty panel stays hidden until you open it manually from the toolbar popup.

The popup shows page status, toggles the outline and saves preferences. Content changes update the outline automatically. The dragged position survives updates on the current page and resets when switching articles. Press `Esc` while focus is inside the outline to collapse it.

| Setting | Default | Behavior |
| --- | --- | --- |
| Enable x-reader | On | Disabling removes the panel and stops content observation; enabling resumes it. |
| Detect bold headings | On | Treats short, standalone, fully bold lines as heading candidates. |
| Detect numbered headings | On | Recognizes short lines such as `1、背景`, `第一章 起点` and `Chapter 1`. |
| Outline theme | `auto` | `auto` follows the page, `light` forces light colors, and `dark` forces dark colors. |

Semantic headings (`h1`–`h6` and `role="heading"`) remain enabled regardless of the bold and numbered detection switches. When native H1–H6 section headings exist, their structure takes priority over bold and numbered heuristics, keeping table labels and body references out of the outline. Preferences use `chrome.storage.local` and are not synced across devices.

## Privacy and permissions

The manifest requests only the `storage` permission for local preferences. Content scripts are limited to X/Twitter domains. Article text and outlines are processed in the current page's memory, without being saved or uploaded. The extension does not read login credentials, collect analytics or call private X APIs. It requires no X account configuration; access to page content remains subject to X's own requirements. See [PRIVACY.md](PRIVACY.md).

## Limits and troubleshooting

- **Only loaded DOM content is available.** Collapsed or unloaded text is absent from the outline. Expand or load the text, then wait for the outline to update automatically.
- **Heading detection uses imperfect heuristics.** Short numbered prose can be mistaken for a heading, and unusual formatting may be missed. Disable either heuristic as needed. Lists, quotations, code and hidden content are filtered.
- **Compatibility depends on X's actual DOM.** Site changes, experiments or different content containers can break article selection. If no outline appears, check that you are on a detail page, the extension is enabled and the page was refreshed after installation.
- Home feeds do not receive a combined outline. Full-text fetching, downloads, translation, AI summaries and access-control bypasses are outside the scope.
- Local fixture tests do not certify compatibility with the live X website.

## Promotional assets

![x-reader small promotional tile](docs/store/promo-small-440x280.png)

The project icon, two 1280×800 screenshots of the actual extension on local demo content, 440×280 small promo tile, 1400×560 marquee and README hero are available in [docs/store/](docs/store/) for sharing the project. Assets use common store dimensions; installing the extension still follows the free local installation steps above.

```bash
npm run assets:store  # Regenerate images in isolated Chromium
npm run check:public # Check public dependency URLs, local paths and image sizes
```

The project `.npmrc` uses the public npm registry, and every locked package has a public download URL. The extension has no runtime npm dependencies. Development packages and local design notes are excluded from the extension ZIP.

## Development and packaging

Requires **Node.js 22+**. Run from the project root:

```bash
npm ci
npm run lint
npm test
npx playwright install chromium
npm run test:browser
```

`lint` runs static project checks; `npm test` covers DOM behavior and logic. Browser tests load the actual extension in isolated Chromium and intercept X network requests with local fixtures to check extension loading and interaction. They do not test the authenticated live X website or establish support for every real DOM variant. Test status is determined by actual command output.

```bash
npm run demo
```

View the local demo at `http://localhost:4173`. Content scripts still match only X/Twitter domains; the demo illustrates the interface and sample content without adding support for arbitrary websites.

```bash
npm run zip
```

Produces `dist/x-reader-0.1.4.zip`. Packaging uses a fixed file allowlist and includes extension runtime files regardless of whether they have been committed to Git. Development dependencies, tests and local demo resources are excluded.

```text
manifest.json       Extension declaration and permissions
src/content/        Article selection, heading extraction, panel and lifecycle
src/shared/         Defaults and local settings storage
src/popup/          Toolbar popup
icons/              Project icons
tests/              Tests and DOM fixtures
tools/              Checks, demo, browser tests and packaging
docs/               Architecture, design and screenshots
```

See [Architecture](docs/architecture.md) and [Contributing](CONTRIBUTING.md) for details. Future work focuses on reproducible article samples, better DOM adapters, fewer false heading matches and broader regression coverage.

## Reference and license

The organization of the project introduction, installation and settings documentation takes inspiration from [wangsen2020/x-media-downloader](https://github.com/wangsen2020/x-media-downloader). x-reader's descriptions and documentation are written independently, without reusing that project's branding or the official X logo.

Released under the [MIT License](LICENSE). x-reader is an independent project and is not affiliated with X.
