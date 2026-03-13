import sharp from "sharp";
import fs from "fs";
import path from "path";

async function createIco() {
    const inputPath = path.join(process.cwd(), "public", "favicon.png");
    const outputPath = path.join(process.cwd(), "public", "favicon.ico");

    if (!fs.existsSync(inputPath)) {
        console.error("File not found:", inputPath);
        return;
    }

    try {
        // ICO обычно требует ресайз, например 32x32 или 64x64
        const buffer = await sharp(inputPath)
            .resize(64, 64)
            .png()
            .toBuffer();

        // Записываем просто как переименованный PNG (браузеры понимают PNG в .ico)
        // Либо просто копируем скругленный PNG в ICO.
        fs.writeFileSync(outputPath, buffer);

        console.log("Successfully created favicon.ico from rounded PNG");
    } catch (error) {
        console.error("Error processing image:", error);
    }
}

createIco();
