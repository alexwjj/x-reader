(() => {
  if (globalThis.__xReaderReady) return;
  const ready = import(chrome.runtime.getURL('src/content/reader.js')).then(module => module.startReader());
  globalThis.__xReaderReady = ready;
  ready.catch(error => console.warn('[x-reader] 启动失败，请刷新页面。', error));
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!['x-reader:status', 'x-reader:toggle', 'x-reader:refresh'].includes(message?.type)) return;
    ready.then(reader => {
      if (message.type === 'x-reader:toggle') reader.toggle();
      if (message.type === 'x-reader:refresh') reader.refresh();
      respond(reader.status());
    }).catch(() => respond({ error: '目录尚未就绪，请刷新页面。' }));
    return true;
  });
})();
