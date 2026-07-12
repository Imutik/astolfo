const CACHE_NAME = 'astolfo-random-v1';
const REPO_OWNER = 'imutik';
const REPO_NAME = 'astolfo';
const BRANCH = 'main';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/?ref=${BRANCH}`;

let imageFiles = [];

// Получить список PNG-файлов из репозитория через API
async function fetchImageList() {
  const response = await fetch(API_URL, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!response.ok) throw new Error('GitHub API error: ' + response.status);
  const data = await response.json();
  return data
    .filter(item => item.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(item.name))
    .map(item => ({
      name: item.name,
      rawUrl: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${item.name}`
    }));
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Установка – загружаем список картинок
self.addEventListener('install', event => {
  event.waitUntil(
    fetchImageList()
      .then(list => {
        imageFiles = list;
        console.log('📸 Загружено файлов:', imageFiles.length);
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Ошибка загрузки списка:', err);
        return self.skipWaiting();
      })
  );
});

// Активация – очищаем старые кеши, берём управление
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Перехват запросов
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Перехватываем ВСЕ запросы к нашему сайту (кроме самого sw.js)
  if (url.origin === location.origin && !url.pathname.includes('sw.js')) {
    event.respondWith(
      (async () => {
        // Если список ещё не загружен, подгружаем
        if (imageFiles.length === 0) {
          try {
            imageFiles = await fetchImageList();
          } catch (e) {
            console.warn('Не удалось обновить список, используем кеш');
          }
        }

        if (imageFiles.length === 0) {
          return new Response('No images found', { status: 404 });
        }

        // Выбираем случайную картинку
        const chosen = randomItem(imageFiles);
        const imageResponse = await fetch(chosen.rawUrl);
        return imageResponse.clone();
      })()
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});
