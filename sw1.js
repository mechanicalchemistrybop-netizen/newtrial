/* NeoPOP X 2.0 service worker. Caches ONLY the static app shell. Never touches IndexedDB/localStorage,
   never caches workbooks (.xlsx), Google APIs, quote feeds or any cross-origin request. */
const VERSION='nx2-v1';
const SHELL='nx-shell-'+VERSION;
const ASSETS=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','libs/xlsx.full.min.js','libs/chart.umd.js','libs/chartjs-plugin-datalabels.min.js'];
self.addEventListener('install',e=>{
  // addAll is atomic; add one by one so a missing optional lib never blocks install.
  e.waitUntil(caches.open(SHELL).then(c=>Promise.all(ASSETS.map(a=>c.add(a).catch(()=>{})))));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k.startsWith('nx-shell-')&&k!==SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
const sensitive=u=>/\.(xlsx|xlsm|xls|csv)(\?|$)/i.test(u.pathname)||/finance_data/i.test(u.pathname);
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin||sensitive(u))return; // network only, default handling
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(SHELL).then(c=>c.put('index.html',cp))}return res}).catch(()=>caches.match('index.html').then(m=>m||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok&&res.type==='basic'){const cp=res.clone();caches.open(SHELL).then(c=>c.put(r,cp))}return res})));
});
