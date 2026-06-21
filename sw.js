const CACHE = 'studysuperz-v3';
const PRECACHE = [
  '/', '/index.html', '/manifest.json', '/assets/logo.png', '/assets/nitish.webp',
  '/subjects/maths.html','/subjects/physics.html','/subjects/chemistry.html',
  '/subjects/biology.html','/subjects/science.html','/subjects/english.html',
  '/subjects/hindi.html','/subjects/history.html','/subjects/geography.html',
  '/subjects/economics.html','/subjects/accounts.html','/subjects/cs.html',
  '/subjects/business.html','/subjects/polsci.html','/subjects/social.html',
  '/exams/index.html','/tools/mock-test.html','/notes/index.html',
  '/dashboard/index.html','/live/index.html','/tools/index.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, {cache:'reload'}))).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if(e.request.method!=='GET')return;
  if(e.request.url.includes('supabase.co')||e.request.url.includes('api.anthropic')||e.request.url.includes('googleapis')||e.request.url.includes('api.x.ai'))return;
  e.respondWith(fetch(e.request).then(res=>{
    if(res&&res.status===200){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}
    return res;
  }).catch(()=>caches.match(e.request).then(c=>c||caches.match('/index.html'))));
});
self.addEventListener('push', e => {
  const d = e.data?.json()||{title:'Study Superz 📚',body:'Time to study! Your daily goal is waiting.'};
  e.waitUntil(self.registration.showNotification(d.title||'Study Superz',{body:d.body,icon:'/assets/logo.png',badge:'/icons/icon.svg',tag:'study-superz',vibrate:[200,100,200],actions:[{action:'open',title:'Open App'},{action:'dismiss',title:'Later'}],data:{url:d.url||'/index.html'}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if(e.action!=='dismiss') e.waitUntil(clients.openWindow(e.notification.data?.url||'/'));
});
self.addEventListener('sync', e => {
  if(e.tag==='sync-progress') e.waitUntil(Promise.resolve());
});
