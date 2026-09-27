const CACHE="bloomie-p20-v1";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const copy=resp.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
    return resp;
  })));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=(event.notification.data&&event.notification.data.url)||"./";
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if("focus"in client)return client.focus();
      }
      if(clients.openWindow)return clients.openWindow(target);
    })
  );
});
