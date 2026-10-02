// 梦幻小院 service worker (hand written, no dependencies).
//  - index.html / navigations: network first (so a new deploy shows up on the next open), cache as the offline fallback
//  - everything else on this origin (hashed js / css, art, fonts, icons): cache first, filled on first use
// The build (vite.config.ts) stamps the build id and the app-shell file list into dist/sw.js; each build gets its own cache.
// There is deliberately no skipWaiting(): a new worker waits until the game is closed, so a running session never
// loses the lazy chunks of the version it started with (old caches are deleted only when the new worker activates).

const VERSION = '202610021141' // build id placeholder
const CACHE = `mengyuan-${VERSION}`
const PRECACHE = '["assets/AlarmPanel-D9rPAnqn.js","assets/Avatar-BMMaNJos.js","assets/ChatModal-D8MCiaJp.js","assets/CommunityScreen-Bj-0IDAi.js","assets/DiaryScreen-CZMn_Hfb.js","assets/DiaryScreen-tiI8GJ1v.css","assets/DressScreen-D_tUeb74.js","assets/EventsModal-C-zCbAMY.js","assets/EventsModal-CQJaeYtq.css","assets/EvolveScreen--6PLxUav.css","assets/EvolveScreen-BC2g6_gm.js","assets/ExpressPanel-CXoBtr4K.js","assets/ExpressPanel-CeMcDw_p.css","assets/FriendsScreen-BETD1J3c.js","assets/GachaScreen-DjzZ1Zei.js","assets/GachaScreen-Kph7HqWj.css","assets/ItemDetailModal-C56aAJOg.js","assets/ItemDetailModal-DjzaF4lK.css","assets/MainScreen-DVhKVA5P.css","assets/MainScreen-Dl6pVqtV.js","assets/MallScreen-BdscuPJ4.css","assets/MallScreen-BgVEtgpD.js","assets/MedalsScreen-CwFm61a5.js","assets/MyShopScreen-BaWRqjg5.css","assets/MyShopScreen-CX8b8Fvo.js","assets/NestScreen-DvnLiHDb.css","assets/NestScreen-cEb6BdY0.js","assets/PotScreen-sTRtyml8.css","assets/PotScreen-upNklQLw.js","assets/ProfileModal-qMMWIQVJ.js","assets/RankScreen-ChAgEPmA.js","assets/SplashScreen-Bf-AFOr6.css","assets/SplashScreen-C-YMFR6I.js","assets/StorageScreen-DSYaVAjm.js","assets/StorageScreen-_RnYC9V4.css","assets/TeahouseScreen-BIDaKNJp.css","assets/TeahouseScreen-CpdJB2_-.js","assets/TownScreen-CUi75t-V.js","assets/TownScreen-DV0zSo-c.css","assets/TravelScreen-BLHVyvBA.css","assets/TravelScreen-DevVpXHV.js","assets/adaptive-n6vgjoeC.css","assets/avatar-0kdjqUFP.js","assets/avatar-Dji91Ei4.css","assets/entry-Btx60vu3.js","assets/entry-C2Fpz2i9.js","assets/entry-DLSqBUsw.css","assets/fredoka-hebrew-600-normal-BiVDObXj.woff","assets/fredoka-hebrew-600-normal-CTBxhdlE.woff2","assets/fredoka-hebrew-700-normal-DBqnFHCe.woff2","assets/fredoka-hebrew-700-normal-DiqR04Vd.woff","assets/fredoka-latin-600-normal-C4zohCW5.woff2","assets/fredoka-latin-600-normal-CcrEjrB4.woff","assets/fredoka-latin-700-normal-BOIZVyIN.woff2","assets/fredoka-latin-700-normal-C8FeHd3X.woff","assets/index-CGbyooJE.js","assets/index-u4Dfm1Bg.css","assets/modals-DHugx8rF.js","assets/modals-DyXZREKU.js","assets/panel-B6bHBd-g.js","assets/panel-BKiIL7XN.css","assets/preload-helper-CV0MfPXH.js","assets/social-eOqj22Kv.css","favicon.svg","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest"]'
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
