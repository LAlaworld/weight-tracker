/* 每日重量记录 Service Worker
 * 策略：静态资源 network-first（联网拿最新，断网用缓存）；
 * 飞书 API（/feishu）和非 GET 请求直接放行，绝不缓存。
 */
const CACHE = 'weight-tracker-v1'
const PRECACHE = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {}),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API 与非 GET 不拦截
  if (event.request.method !== 'GET' || url.pathname.startsWith('/feishu')) return
  // 只处理同源请求
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached
          // 页面导航断网时回退到首页壳
          if (event.request.mode === 'navigate') return caches.match('./index.html')
          return Response.error()
        }),
      ),
  )
})
