const fs = require('fs');
const path = require('path');

/**
 * Скрипт для сборки шрифтов в Base64 для pdfmake
 */

// Конфигурация путей
const FONTS_DIR = path.join(__dirname, '../src/assets/fonts');
const OUTPUT_FILE = path.join(__dirname, '../src/utility/custom_vfs.ts'); // В вашем проекте это папка utility

const FONT_FILES = [
    'Roboto-Regular.ttf',
    'Roboto-Bold.ttf',
    'Roboto-Italic.ttf',
    'Roboto-BoldItalic.ttf',
    'Roboto-Medium.ttf'
];

function generateVfs() {
    const vfs = {};

    console.log('--- Начинаю генерацию VFS ---');

    FONT_FILES.forEach(fileName => {
        const filePath = path.join(FONTS_DIR, fileName);

        if (fs.existsSync(filePath)) {
            const base64Content = fs.readFileSync(filePath).toString('base64');
            vfs[fileName] = base64Content;
            console.log(`[OK] Добавлен: ${fileName}`);
        } else {
            console.error(`[ERROR] Файл не найден: ${filePath}`);
        }
    });

    const content = `// Файл сгенерирован автоматически через scripts/generate-vfs.js
export const customVfs: Record<string, string> = ${JSON.stringify(vfs, null, 2)};
`;

    try {
        // Создаем директорию если её нет
        const dir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, content);
        console.log('----------------------------');
        console.log(`Успешно! Файл создан: ${OUTPUT_FILE}`);
    } catch (err) {
        console.error(`Ошибка при записи файла: ${err.message}`);
    }
}

generateVfs();
