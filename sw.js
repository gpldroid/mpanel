const CACHE="mpanel-shell-v2";
const APP_SHELL=["./","./index.html","./assets/css/style.css"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=="GET"||url.origin!==location.origin)return;
 if(url.pathname.includes("/rest/")||url.pathname.includes("/auth/")||url.pathname.includes("/functions/"))return;
 event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res}).catch(()=>caches.match(req).then(c=>c||caches.match("./index.html"))));
});