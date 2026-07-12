const CACHE_NAME = 'astolfo-random-v1';
const REPO_OWNER = 'imutik';
const REPO_NAME = 'astolfo';
const BRANCH = 'main';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/?ref=${BRANCH}`;

let imageFiles = []; // массив { name, rawUrl }

// Получить список PNG-файлов из репозитория через API
async function fetchImageList() {
  const response = await fetch(API_URL, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!response.ok) throw new Error('GitHub API error: ' + response.status);
  const data = await response.json();
  // Фильтруем только файлы .png (или .jpg, если есть)
  return data
    .filter(item => item.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(item.name))
    .map(item => ({
      name: item.name,
      rawUrl: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${item.name}`
    }));
}

// Случайный элемент из массива
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Установка – загружаем список картинок и кешируем его
self.addEventListener('install', event => {
  event.waitUntil(
    fetchImageList()
      .then(list => {
        imageFiles = list;
        console.log('📸 Загружено файлов:', imageFiles.length);
        // Можно также закешировать сами картинки, но необязательно
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Ошибка загрузки списка:', err);
        // Если не удалось, пробуем использовать старый кеш (если есть)
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

  // Обрабатываем только запросы к нашему Pages-домену (или подпапке)
  // и только если путь равен '/' или начинается с '/left'/'/right' (чтобы различать стороны)
  if (url.origin === location.origin && 
      (url.pathname === '/' || url.pathname.startsWith('/left') || url.pathname.startsWith('/right'))) {
    
    event.respondWith(
      (async () => {
        // Если список ещё не загружен (например, первый запуск), подгружаем
        if (imageFiles.length === 0) {
          try {
            imageFiles = await fetchImageList();
          } catch (e) {
            console.warn('Не удалось обновить список, используем кеш');
          }
        }

        // Если всё равно пусто – возвращаем заглушку
        if (imageFiles.length === 0) {
          return new Response('No images found', { status: 404 });
        }

        // Выбираем случайную картинку
        const chosen = randomItem(imageFiles);
        // Загружаем её содержимое
        const imageResponse = await fetch(chosen.rawUrl);
        // Возвращаем копию ответа (чтобы можно было использовать повторно)
        return imageResponse.clone();
      })()
    );
  } else {
    // Для всех остальных запросов (sw.js, index.html, иконки) – пропускаем
    event.respondWith(fetch(event.request));
  }
});
