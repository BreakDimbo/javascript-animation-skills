// 梦幻小院 service worker (hand written, no dependencies).
//  - index.html / navigations: network first (so a new deploy shows up on the next open), cache as the offline fallback
//  - everything else on this origin (hashed js / css, art, fonts, icons): cache first, filled on first use
// The build (vite.config.ts) stamps the build id and the app-shell file list into dist/sw.js; each build gets its own cache.
// There is deliberately no skipWaiting(): a new worker waits until the game is closed, so a running session never
// loses the lazy chunks of the version it started with (old caches are deleted only when the new worker activates).

const VERSION = '202610021224' // build id placeholder
const CACHE = `mengyuan-${VERSION}`
const PRECACHE = '["assets/AlarmPanel-MF8qnCgZ.js","assets/Avatar-Zut4peWy.js","assets/ChatModal-B3XTj3ql.js","assets/CommunityScreen-BzW-a3W_.js","assets/DiaryScreen-a1chLnOu.js","assets/DiaryScreen-tiI8GJ1v.css","assets/DressScreen-DiStsc8K.js","assets/EventsModal-B6rvJV5D.js","assets/EventsModal-CQJaeYtq.css","assets/EvolveScreen--6PLxUav.css","assets/EvolveScreen-BKQWe9wi.js","assets/ExpressPanel-CeMcDw_p.css","assets/ExpressPanel-CjanGXR3.js","assets/FriendsScreen-BNUWPHLv.js","assets/GachaScreen-DLWizias.js","assets/GachaScreen-Kph7HqWj.css","assets/ItemDetailModal-DjzaF4lK.css","assets/ItemDetailModal-GAKTI2_T.js","assets/MainScreen-Bcc6aY9s.js","assets/MainScreen-DVhKVA5P.css","assets/MallScreen-BdscuPJ4.css","assets/MallScreen-CjSSbc-s.js","assets/MedalsScreen-DCI3kxW1.js","assets/MyShopScreen-BaWRqjg5.css","assets/MyShopScreen-KnpbVAw-.js","assets/NestScreen-CiJGTqKy.js","assets/NestScreen-DvnLiHDb.css","assets/PotScreen-BZQNuy-J.js","assets/PotScreen-sTRtyml8.css","assets/ProfileModal-DQ5VkGho.js","assets/RankScreen-DxkS7X6Y.js","assets/SplashScreen-BTMMpXub.js","assets/SplashScreen-Bf-AFOr6.css","assets/StorageScreen-VWcedLES.js","assets/StorageScreen-_RnYC9V4.css","assets/TeahouseScreen-BIDaKNJp.css","assets/TeahouseScreen-CrA6uzyG.js","assets/TownScreen-BF_vCj6F.js","assets/TownScreen-DV0zSo-c.css","assets/TravelScreen-BLHVyvBA.css","assets/TravelScreen-CuRPe4Uy.js","assets/adaptive-n6vgjoeC.css","assets/avatar-Dji91Ei4.css","assets/avatar-YutoKMIP.js","assets/entry-DLSqBUsw.css","assets/entry-Dn1CkPDR.js","assets/entry-VpSw4fVt.js","assets/fredoka-hebrew-600-normal-BiVDObXj.woff","assets/fredoka-hebrew-600-normal-CTBxhdlE.woff2","assets/fredoka-hebrew-700-normal-DBqnFHCe.woff2","assets/fredoka-hebrew-700-normal-DiqR04Vd.woff","assets/fredoka-latin-600-normal-C4zohCW5.woff2","assets/fredoka-latin-600-normal-CcrEjrB4.woff","assets/fredoka-latin-700-normal-BOIZVyIN.woff2","assets/fredoka-latin-700-normal-C8FeHd3X.woff","assets/index-BjodCvw2.js","assets/index-u4Dfm1Bg.css","assets/modals-BzV1g92W.js","assets/modals-DDFmPcvM.js","assets/panel-BKiIL7XN.css","assets/panel-DqGot5JT.js","assets/preload-helper-CV0MfPXH.js","assets/social-eOqj22Kv.css","favicon.svg","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest"]'
const INDEX = new URL('./index.html', self.registration.scope).toString()

self.addEventListener('install', event => {
  const list = (() => {
    try {
      const v = JSON.parse(PRECACHE)
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  })()
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        [INDEX, new URL('assets/index.json', self.registration.scope).toString(), ...list.map(f => new URL(f, self.registration.scope).toString())].map(url =>
          // index.html must be fresh; hashed files can come straight from the HTTP cache the page just filled
          cache.add(url === INDEX ? new Request(url, { cache: 'reload' }) : url),
        ),
      ),
    ),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('mengyuan-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(INDEX, res.clone())
    return res
  } catch {
    const hit = await cache.match(INDEX, { ignoreVary: true })
    if (hit) return hit
    throw new Error('offline and not cached')
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request, { ignoreVary: true }) // Vary: Origin on module scripts would otherwise miss
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok && res.status === 200) cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.headers.has('range')) return
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }
  event.respondWith(cacheFirst(request))
})
