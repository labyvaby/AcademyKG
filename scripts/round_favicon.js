import sharp from "sharp";
import fs from "fs";
import path from "path";

async function roundFavicon() {
    const inputPath = path.join(process.cwd(), "public", "favicon.png");
    const outputPath = path.join(process.cwd(), "public", "favicon_rounded.png");

    if (!fs.existsSync(inputPath)) {
        console.error("File not found:", inputPath);
        return;
    }

    try {
        const metadata = await sharp(inputPath).metadata();
        const width = metadata.width || 512;
        const height = metadata.height || 512;
        const size = Math.min(width, height);

        // Создаем маску круга
        const circleSvg = `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="black"/></svg>`;
        const circleMask = Buffer.from(circleSvg);

        // Вырезаем круг
        await sharp(inputPath)
            .resize(size, size, { fit: "cover" })
            .composite([{ input: circleMask, blend: "dest-in" }])
            .png()
            .toFile(outputPath);

        console.log("Successfully rounded favicon:", outputPath);

        // Переименовываем
        fs.renameSync(outputPath, inputPath);
        console.log("Replaced original favicon.png");
    } catch (error) {
        console.error("Error processing image:", error);
    }
}

roundFavicon();
