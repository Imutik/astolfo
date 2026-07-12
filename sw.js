const REPO = 'imutik/astolfo';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${REPO}/contents?ref=${BRANCH}`;

let files = [];

async function loadFileList() {
  const r = await fetch(API, { headers: { Accept: 'application/vnd.github.v3+json' } });
  if (!r.ok) throw new Error('GitHub API error');
  const data = await r.json();
  files = data
    .filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name))
    .map(f => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${f.name}`);
  console.log('📸 Загружено файлов:', files.length);
}

self.addEventListener('install', e => {
  e.waitUntil(loadFileList().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin && !url.pathname.includes('sw.js')) {
    e.respondWith((async () => {
      if (files.length === 0) {
        try { await loadFileList(); } catch (err) {}
      }
      if (files.length === 0) {
        return new Response('No images', { status: 404 });
      }
      const chosen = files[Math.floor(Math.random() * files.length)];
      const img = await fetch(chosen);
      return img.clone();
    })());
  } else {
    e.respondWith(fetch(e.request));
  }
});
