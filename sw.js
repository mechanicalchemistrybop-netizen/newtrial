/* Money dashboard service worker · v14.0
   - Opens instantly from the saved copy, then quietly checks for a newer index.html in the background
     (a "New version ready" prompt appears in the app; nothing reloads by itself).
   - Caches the static app shell and Google Fonts so repeat launches are fast and work offline.
   - Never touches IndexedDB/localStorage, never caches workbooks (.xlsx/.csv), Google APIs, quote feeds
     or any other cross-origin data. */
const VERSION='v14.0';
const SHELL='nx-shell-'+VERSION;
const FONTS='nx-fonts-v1';
const ASSETS=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','libs/xlsx.full.min.js','libs/chart.umd.js','libs/chartjs-plugin-datalabels.min.js'];
self.addEventListener('install',e=>{
  // add one by one so a missing optional file never blocks install
  e.waitUntil(caches.open(SHELL).then(c=>Promise.all(ASSETS.map(a=>c.add(a).catch(()=>{})))));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if((k.startsWith('nx-shell-')&&k!==SHELL)||k.startsWith('finance-dashboard-shell-')) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
const sensitive=u=>/\.(xlsx|xlsm|xls|csv)(\?|$)/i.test(u.pathname)||/finance_data/i.test(u.pathname);
const tell=async()=>{for(const c of await self.clients.matchAll({type:'window'}))c.postMessage({type:'UPDATE_READY'})};
const stamp=r=>r?(r.headers.get('etag')||r.headers.get('last-modified')||r.headers.get('content-length')||''):'';
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  /* Google Fonts: stale-while-revalidate, so text renders instantly and offline */
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(FONTS).then(async c=>{
      const hit=await c.match(r);
      const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res}).catch(()=>null);
      if(hit){e.waitUntil(net);return hit}
      return (await net)||new Response('',{status:504});
    }));
    return;
  }
  if(u.origin!==location.origin||sensitive(u))return; // network only, default handling
  if(r.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(SHELL);
      const hit=(await c.match('index.html'))||(await c.match('./'));
      const net=fetch(new Request('index.html',{cache:'no-cache'})).then(async res=>{
        if(res&&res.ok){
          const changed=hit&&stamp(hit)&&stamp(res)&&stamp(hit)!==stamp(res);
          await c.put('index.html',res.clone());
          if(changed)tell();
        }
        return res;
      }).catch(()=>null);
      if(hit){e.waitUntil(net);return hit}            // instant launch from the saved copy
      return (await net)||new Response('You are offline and the app is not saved yet.',{status:503});
    })());
    return;
  }
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok&&res.type==='basic'){const cp=res.clone();caches.open(SHELL).then(c=>c.put(r,cp))}return res})));
});
