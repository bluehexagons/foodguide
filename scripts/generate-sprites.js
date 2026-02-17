#!/usr/bin/env node

/**
 * Sprite sheet generator for the Don't Starve food guide.
 *
 * Reads all images from html/img/, composites them into sprite sheet PNGs,
 * and writes a JSON manifest mapping each image filename to its position
 * in the sprite sheet. Images are resized to a uniform 64x64 grid cell.
 *
 * Usage:
 *   node scripts/generate-sprites.js
 *
 * Output:
 *   html/img/sprites/sheet-0.png   (sprite sheet image)
 *   html/img/sprites/sprites.json  (manifest)
 */

import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const IMG_DIR = join(__dirname, '..', 'html', 'img');
const SPRITES_DIR = join(IMG_DIR, 'sprites');

/** Size of each cell in the sprite sheet */
const CELL_SIZE = 64;

/** Number of columns per sheet */
const COLUMNS = 20;

/**
 * Maximum number of images per sprite sheet.
 * At 20 columns x 20 rows = 400 images per 1280x1280 sheet.
 * We have ~334 images so one sheet suffices, but this allows growth.
 */
const MAX_PER_SHEET = COLUMNS * 20;

/**
 * Files to exclude from the sprite sheet (non-icon images).
 * background.png is a tiling texture, not an icon.
 */
const EXCLUDE = new Set(['background.png']);

async function main() {
	const entries = await readdir(IMG_DIR, { withFileTypes: true });

	// Collect image files (png, webp — some .png files are actually webp)
	const imageFiles = entries
		.filter(e => {
			if (!e.isFile()) return false;
			if (EXCLUDE.has(e.name)) return false;
			const ext = extname(e.name).toLowerCase();
			return ext === '.png' || ext === '.webp' || ext === '.jpg' || ext === '.jpeg';
		})
		.map(e => e.name)
		.sort();

	if (imageFiles.length === 0) {
		console.log('No images found in', IMG_DIR);
		return;
	}

	console.log(`Found ${imageFiles.length} images to process`);

	// Ensure output directory exists
	await mkdir(SPRITES_DIR, { recursive: true });

	/** @type {Record<string, {sheet: number, col: number, row: number}>} */
	const manifest = {};

	/** @type {number[]} */
	const sheetRows = [];

	// Process in sheet-sized chunks
	const totalSheets = Math.ceil(imageFiles.length / MAX_PER_SHEET);

	for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex++) {
		const start = sheetIndex * MAX_PER_SHEET;
		const end = Math.min(start + MAX_PER_SHEET, imageFiles.length);
		const sheetFiles = imageFiles.slice(start, end);

		const rows = Math.ceil(sheetFiles.length / COLUMNS);
		const sheetWidth = COLUMNS * CELL_SIZE;
		const sheetHeight = rows * CELL_SIZE;

		console.log(
			`Sheet ${sheetIndex}: ${sheetFiles.length} images, ${COLUMNS}x${rows} grid (${sheetWidth}x${sheetHeight}px)`,
		);

		// Prepare all image buffers in parallel
		/** @type {Array<{input: Buffer, left: number, top: number}>} */
		const composites = [];

		const results = await Promise.all(
			sheetFiles.map(async (filename, i) => {
				const filePath = join(IMG_DIR, filename);
				try {
					const buffer = await sharp(filePath)
						.resize(CELL_SIZE, CELL_SIZE, {
							fit: 'contain',
							background: { r: 0, g: 0, b: 0, alpha: 0 },
						})
						.png()
						.toBuffer();

					const col = i % COLUMNS;
					const row = Math.floor(i / COLUMNS);

					return {
						filename,
						buffer,
						col,
						row,
						x: col * CELL_SIZE,
						y: row * CELL_SIZE,
					};
				} catch (err) {
					console.warn(`  Warning: Failed to process ${filename}: ${err.message}`);
					return null;
				}
			}),
		);

		for (const result of results) {
			if (result === null) continue;

			composites.push({
				input: result.buffer,
				left: result.x,
				top: result.y,
			});

			// Use img/filename as the key to match the URL paths used in the app
			manifest[`img/${result.filename}`] = {
				sheet: sheetIndex,
				col: result.col,
				row: result.row,
			};
		}

		// Create the sprite sheet
		const sheet = sharp({
			create: {
				width: sheetWidth,
				height: sheetHeight,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		});

		const outputPath = join(SPRITES_DIR, `sheet-${sheetIndex}.png`);
		await sheet.composite(composites).png({ compressionLevel: 9 }).toFile(outputPath);

		sheetRows.push(rows);
		console.log(`  Written: ${outputPath}`);
	}

	// Write manifest
	const manifestData = {
		cellSize: CELL_SIZE,
		columns: COLUMNS,
		rows: sheetRows[0] || 0,
		sheets: Array.from({ length: totalSheets }, (_, i) => `img/sprites/sheet-${i}.png`),
		images: manifest,
	};

	const manifestPath = join(SPRITES_DIR, 'sprites.json');
	await writeFile(manifestPath, JSON.stringify(manifestData), 'utf-8');
	console.log(`  Written: ${manifestPath}`);
	console.log(`Done. ${Object.keys(manifest).length} images in ${totalSheets} sheet(s).`);
}

main().catch(err => {
	console.error('Sprite generation failed:', err);
	process.exit(1);
});
