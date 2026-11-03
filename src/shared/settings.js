export const DEFAULT_SETTINGS = Object.freeze({ enabled: true, detectBold: true, detectNumbered: true, theme: 'auto' });

export function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const result = { ...DEFAULT_SETTINGS };
  for (const key of ['enabled', 'detectBold', 'detectNumbered']) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  if (['auto', 'light', 'dark'].includes(input.theme)) result.theme = input.theme;
  return result;
}

export function createSettingsStore(storage = globalThis.chrome.storage) {
  let queue = Promise.resolve();
  const load = async () => normalizeSettings((await storage.local.get('settings')).settings);
  return {
    load,
    save(patch) {
      const operation = queue.then(async () => {
        const settings = normalizeSettings({ ...await load(), ...patch });
        await storage.local.set({ settings });
        return settings;
      });
      queue = operation.catch(() => {});
      return operation;
    },
    subscribe(callback) {
      const listener = (changes, area) => {
        if (area === 'local' && changes.settings) callback(normalizeSettings(changes.settings.newValue));
      };
      storage.onChanged.addListener(listener);
      return () => storage.onChanged.removeListener(listener);
    }
  };
}
