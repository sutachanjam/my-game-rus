const installBtn = document.getElementById('installBtn');
const statusText = document.getElementById('status');

// Ссылка на ваш архив 
const ZIP_URL = 'https://github.com/sutachanjam/my-game-rus/releases/download/v1.0/patch.zip';

// Вспомогательная функция для создания вложенных папок
async function getDeepDirHandle(baseHandle, path) {
    const parts = path.split('/').filter(p => p); 
    let currentHandle = baseHandle;
    for (let i = 0; i < parts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
    }
    return currentHandle;
}

installBtn.addEventListener('click', async () => {
    if (!('showDirectoryPicker' in window)) {
        statusText.style.color = '#ff4444';
        statusText.textContent = 'Ошибка: Ваш браузер не поддерживает эту функцию. Используйте Google Chrome или Edge.';
        return;
    }

    try {
        statusText.style.color = '#aaa';
        statusText.textContent = 'Ожидание выбора папки игры...';

        // Запрашиваем папку
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

        statusText.textContent = 'Подключение к серверу и скачивание файлов...';

        let response;
        try {
            // Попытка 1: Скачиваем напрямую с GitHub
            response = await fetch(ZIP_URL);
            if (!response.ok) throw new Error(`GitHub вернул ошибку ${response.status}. Возможно, репозиторий закрыт (Private).`);
        } catch (fetchError) {
            console.warn('Прямое скачивание не удалось. Пробуем через прокси-сервер...', fetchError);
            
            // Попытка 2: Если напрямую заблокировано, скачиваем через прокси
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(ZIP_URL);
            response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error('Файл не найден или сервер недоступен. Проверьте правильность ссылки!');
            }
        }

        const arrayBuffer = await response.arrayBuffer();

        statusText.textContent = 'Распаковка и установка файлов...';

        // Читаем архив с помощью библиотеки JSZip
        const zip = new JSZip();
        const unzipped = await zip.loadAsync(arrayBuffer);
        const fileNames = Object.keys(unzipped.files);
        
        let processedFiles = 0;
        const totalFiles = fileNames.filter(name => !unzipped.files[name].dir).length;

        // Проходимся по каждому файлу в архиве
        for (const relativePath of fileNames) {
            const zipEntry = unzipped.files[relativePath];

            // Пропускаем папки
            if (zipEntry.dir) continue;

            // Получаем папку и имя файла
            const targetDirHandle = await getDeepDirHandle(dirHandle, relativePath);
            const fileName = relativePath.split('/').pop();

            // Создаем файл и записываем данные
            const fileHandle = await targetDirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            
            const fileData = await zipEntry.async('blob');
            await writable.write(fileData);
            await writable.close();

            processedFiles++;
            statusText.textContent = `Установлено файлов: ${processedFiles} из ${totalFiles}`;
        }

        statusText.style.color = '#00cc66';
        statusText.textContent = 'Русификатор успешно установлен!';

    } catch (error) {
        statusText.style.color = '#ff4444';
        if (error.name === 'AbortError') {
            statusText.textContent = 'Установка отменена (папка не выбрана).';
        } else {
            console.error(error);
            statusText.textContent = 'Ошибка: ' + error.message;
        }
    }
});
