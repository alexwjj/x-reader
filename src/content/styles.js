export const panelStyles = `
:host {
  all: initial;
  --bg: #fff; --text: #0f1419; --muted: #536471; --line: #eff3f4;
  --hover: rgba(15,20,25,.04); --accent: #1d9bf0; --active: rgba(29,155,240,.08);
  position: fixed; z-index: 2147483000; width: min(var(--panel-width,350px),calc(100vw - 32px)); top: 86px; right: 24px;
  color: var(--text); color-scheme: light; letter-spacing: normal;
  font: 12px/1.45 TwitterChirp,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
}
:host([data-theme="dark"]) {
  --bg: #000; --text: #e7e9ea; --muted: #71767b; --line: #2f3336;
  --hover: rgba(231,233,234,.06); --active: rgba(29,155,240,.1); color-scheme: dark;
}
:host([data-theme="dim"]) {
  --bg: #15202b; --text: #f7f9f9; --muted: #8b98a5; --line: #38444d;
  --hover: rgba(247,249,249,.06); --active: rgba(29,155,240,.1); color-scheme: dark;
}
:host([data-open="false"]) { width: 36px; }
:host([hidden]), [hidden] { display: none !important; }
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
button:focus-visible, .masthead:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
svg { width: 18px; height: 18px; display: block; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.panel { display: flex; flex-direction: column; max-height: var(--panel-max-height,calc(100dvh - 102px)); overflow: hidden; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; }
:host([data-docked="true"]) .panel { height: var(--panel-max-height); }
.masthead { position: relative; display: flex; align-items: center; justify-content: flex-end; height: 28px; padding: 1px 5px; flex-shrink: 0; cursor: grab; touch-action: none; user-select: none; }
.grip { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); width: 24px; height: 3px; border-radius: 3px; background: var(--line); }
:host([data-dragging]) .masthead { cursor: grabbing; }
.icon-button { display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 50%; background: transparent; color: var(--muted); }
.icon-button svg { width: 16px; height: 16px; }
.icon-button:hover { background: var(--hover); color: var(--text); }
nav { position: relative; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 0 6px; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
ol { list-style: none; margin: 0; padding: 0; }
.toc-item { display: block; position: relative; width: 100%; padding: 6px 14px; border: 0; text-align: left; background: transparent; color: var(--text); line-height: 1.45; }
.toc-item:hover { background: var(--hover); }
.toc-item[aria-current="true"] { background: var(--active); color: var(--accent); }
.toc-item[aria-current="true"]::before { content: ""; position: absolute; left: 0; top: 5px; bottom: 5px; width: 2px; background: var(--accent); }
.label { font-size: 13px; overflow-wrap: anywhere; }
.toc-item[aria-current="true"] .label { font-weight: 600; }
.toc-item[data-depth="1"] { padding-left: 24px; color: var(--muted); }
.toc-item[data-depth="2"] { padding-left: 36px; color: var(--muted); }
.toc-item[data-depth="3"] { padding-left: 48px; color: var(--muted); }
.toc-item[data-depth][aria-current="true"] { color: var(--accent); }
.empty { padding: 4px 12px 16px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.empty strong { display: block; margin-bottom: 5px; color: var(--text); font-weight: 600; }
.launcher { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 1px solid var(--text); border-radius: 50%; background: var(--text); color: var(--bg); touch-action: none; user-select: none; cursor: grab; }
:host([data-dragging]) .launcher { cursor: grabbing; }
.launcher:hover { opacity: .85; }
@media (max-width: 700px) { :host { right: 16px; top: 76px; } }
`;
