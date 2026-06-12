'use strict';
/* IT Help Desk Service Worker — app-shell caching for offline support */
const CACHE_NAME='it-helpdesk-v1';

const LOCAL_ASSETS=[
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/api.js',
  './js/auth.js',
  './js/ui-tickets.js',
  './js/ui-users.js',
  './js/ui-devices.js',
  './js/ui-internet.js',
  './js/ui-notifications.js',
  './js/ui-guidelines.js',
  './js/ui-manual.js',
  './js/ui-ai.js',
  './js/ui-dashboard.js',
  './js/app.js'
];

const CDN_ASSETS=[
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>{
      return Promise.all(
        LOCAL_ASSETS.map(url=>cache.add(url).catch(()=>{})).concat(
          CDN_ASSETS.map(url=>cache.add(new Request(url,{mode:'no-cors'})).catch(()=>{}))
        )
      );
    }).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

function isSupabase(url){
  return /supabase\.co|supabase\.com/i.test(url);
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=req.url;

  // Never intercept Supabase API calls
  if(isSupabase(url))return;

  const isNav=req.mode==='navigate';
  const isSameOrigin=url.startsWith(self.location.origin);
  const isCDN=CDN_ASSETS.some(a=>url.startsWith(a.split('?')[0]));

  if(isNav){
    // network-first, fallback to cached shell
    e.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE_NAME).then(c=>c.put(req,copy)).catch(()=>{});
        return res;
      }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  if(isSameOrigin||isCDN){
    // cache-first, update in background
    e.respondWith(
      caches.match(req).then(cached=>{
        const fetchPromise=fetch(req).then(res=>{
          if(res&&(res.ok||res.type==='opaque')){
            const copy=res.clone();
            caches.open(CACHE_NAME).then(c=>c.put(req,copy)).catch(()=>{});
          }
          return res;
        }).catch(()=>cached);
        return cached||fetchPromise;
      })
    );
  }
});
