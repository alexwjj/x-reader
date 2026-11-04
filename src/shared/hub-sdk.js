/** Small first-party analytics client. No cookies, query strings or personal profile data. */
export function createHubAnalytics({ projectId, endpoint, respectDNT = true, trackLocalhost = false } = {}) {
  if (typeof window === 'undefined' || !/^[a-z\d-]{1,80}$/.test(projectId || '')) return { track() {}, stop() {} }
  if (!trackLocalhost && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return { track() {}, stop() {} }
  let target
  try { target = new URL(endpoint || '/api/collect', location.href); if (!['https:', 'http:'].includes(target.protocol)) throw Error(); target.searchParams.set('project', projectId) } catch { return { track() {}, stop() {} } }
  if (respectDNT && (navigator.doNotTrack === '1' || navigator.globalPrivacyControl)) return { track() {}, stop() {} }
  const uuid = () => { if (crypto.randomUUID) return crypto.randomUUID(); const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; const h = [...b].map(v => v.toString(16).padStart(2, '0')).join(''); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}` }
  const stored = (getStorage, key) => { try { const storage = getStorage(); const old = storage.getItem(key); const value = /^[\da-f-]{36}$/i.test(old || '') ? old : uuid(); storage.setItem(key, value); return value } catch { return uuid() } }
  const visitor = stored(() => localStorage, 'hub-visitor-' + projectId)
  const session = stored(() => sessionStorage, 'hub-session-' + projectId)
  const device = matchMedia('(max-width: 600px)').matches ? 'mobile' : matchMedia('(max-width: 1024px)').matches ? 'tablet' : 'desktop'
  let referrer = ''; try { referrer = document.referrer ? new URL(document.referrer).hostname : '' } catch { /* No valid referring site. */ }
  let stopped = false, queue = [], lastPath = '', activeSince = Date.now(), activeMs = 0
  const cleanPath = () => { const route = location.hash.startsWith('#/') ? location.hash.slice(1).split('?')[0].split('#')[0] : ''; return ((route ? location.pathname.replace(/\/$/, '') + route : location.pathname) || '/').replace(/\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}(?=\/|$)/gi, '/:id').replace(/\/\d{7,}(?=\/|$)/g, '/:id').slice(0, 500) }
  const enqueue = (type, name, value = 0) => { if (!stopped) { queue.push({ id: uuid(), type, name, value, visitor, session, device, referrer, path: cleanPath() }); if (queue.length >= 20) flush() } }
  function flush() {
    if (!queue.length) return
    const batch = queue.splice(0, 20), text = JSON.stringify({ events: batch })
    if (navigator.sendBeacon?.(target.href, new Blob([text], { type: 'text/plain;charset=UTF-8' }))) return
    fetch(target.href, { method: 'POST', body: text, mode: 'cors', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {})
  }
  const engagement = () => {
    const now = Date.now(); if (!document.hidden) activeMs += Math.min(now - activeSince, 60_000)
    activeSince = now
    if (activeMs > 0) { enqueue('engagement', 'active_ms', Math.min(activeMs, 3_600_000)); activeMs = 0 }
  }
  const pageview = () => { const path = cleanPath(); if (path === lastPath) return; if (lastPath) engagement(); lastPath = path; enqueue('pageview', 'pageview'); flush() }
  const visibility = () => { if (document.hidden) { activeMs += Math.min(Date.now() - activeSince, 60_000); engagement(); flush() } else activeSince = Date.now() }
  const leave = () => { engagement(); flush() }
  const error = event => { enqueue('error', event.type === 'unhandledrejection' ? 'unhandledrejection' : 'javascript_error'); flush() }
  const load = () => { const nav = performance.getEntriesByType('navigation')[0]; if (nav?.loadEventEnd > 0) enqueue('metric', 'load_ms', Math.min(nav.loadEventEnd, 3_600_000)) }
  const observers = []; let cls = 0, lcp = 0, clsSupported = false, metricsReported = false
  if (typeof PerformanceObserver !== 'undefined') {
    for (const type of ['largest-contentful-paint', 'layout-shift']) try {
      const observer = new PerformanceObserver(list => { for (const e of list.getEntries()) { if (type === 'layout-shift') { if (!e.hadRecentInput) cls += e.value } else { lcp = e.startTime } } })
      observer.observe({ type, buffered: true }); observers.push(observer); if (type === 'layout-shift') clsSupported = true
    } catch { /* Unsupported performance entry type. */ }
  }
  const finalMetrics = () => { if (!metricsReported) { if (lcp) enqueue('metric', 'lcp_ms', Math.min(lcp, 3_600_000)); if (clsSupported) enqueue('metric', 'cls', cls); metricsReported = true } leave() }
  const originalPush = history.pushState, originalReplace = history.replaceState
  const push = function (...args) { const result = originalPush.apply(this, args); pageview(); return result }
  const replace = function (...args) { const result = originalReplace.apply(this, args); pageview(); return result }
  history.pushState = push; history.replaceState = replace
  window.addEventListener('popstate', pageview); window.addEventListener('hashchange', pageview)
  window.addEventListener('error', error); window.addEventListener('unhandledrejection', error)
  window.addEventListener('pagehide', finalMetrics); document.addEventListener('visibilitychange', visibility)
  const onLoad = () => setTimeout(load, 0)
  if (document.readyState === 'complete') load(); else window.addEventListener('load', onLoad, { once: true })
  const timer = setInterval(() => { engagement(); flush() }, 15_000)
  pageview()
  return {
    track(name) { if (/^[a-zA-Z\d_.-]{1,64}$/.test(name || '')) { enqueue('event', name); flush() } },
    stop() {
      if (stopped) return
      finalMetrics(); stopped = true; clearInterval(timer); observers.forEach(o => o.disconnect())
      window.removeEventListener('popstate', pageview); window.removeEventListener('hashchange', pageview)
      window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', error)
      window.removeEventListener('pagehide', finalMetrics); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('load', onLoad)
      if (history.pushState === push) history.pushState = originalPush
      if (history.replaceState === replace) history.replaceState = originalReplace
    },
  }
}

if (typeof window !== 'undefined') {
  const source = new URL(import.meta.url)
  const projectId = source.searchParams.get('project')
  if (projectId && !window.alexHubAnalytics) window.alexHubAnalytics = createHubAnalytics({ projectId, endpoint: new URL('/api/collect', source).href })
}
