'use strict';
/* IT Help Desk Service Worker — push notifications only (no caching) */
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});

self.addEventListener('push',e=>{
  let data={};
  try{data=e.data.json();}catch(_){data={title:'IT Help Desk',body:e.data?e.data.text():''};}
  const title=data.title||'🔔 IT Help Desk';
  const options={
    body:data.body||'',
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    vibrate:[200,100,200],
    dir:'rtl',
    lang:'ar',
    data:{url:data.url||'./'}
  };
  e.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.url)||'./';
  e.waitUntil(self.clients.matchAll({type:'window'}).then(list=>{
    for(const c of list){if(c.url.includes(self.location.origin)&&'focus' in c)return c.focus();}
    if(self.clients.openWindow)return self.clients.openWindow(url);
  }));
});
