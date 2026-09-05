import { invoke } from '@tauri-apps/api/core';
import { join, tempDir } from '@tauri-apps/api/path';
import { remove, writeFile } from '@tauri-apps/plugin-fs';
import { drawStrokes } from '$lib/ink/draw';
import { PAGE_WIDTH, compactStrokes, strokeBoundsHeight, toWireStroke, type Stroke } from '$lib/ink/types';

export type RecognizeResult = {
	text: string;
	engine: string;
};

export async function rasterizeStrokes(strokes: Stroke[], width = PAGE_WIDTH): Promise<Uint8Array> {
	const height = strokeBoundsHeight(strokes);
	const scale = 2;
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('canvas');
	}
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	drawStrokes(ctx, strokes, scale);
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((value) => {
			if (value) {
				resolve(value);
			} else {
				reject(new Error('png'));
			}
		}, 'image/png');
	});
	return new Uint8Array(await blob.arrayBuffer());
}

export async function recognizeHandwriting(strokes: Stroke[], width = PAGE_WIDTH): Promise<RecognizeResult> {
	const png = await rasterizeStrokes(strokes, width);
	const tmp = await join(await tempDir(), `easy-notes-ocr-${crypto.randomUUID()}.png`);
	await writeFile(tmp, png);
	try {
		return await invoke<RecognizeResult>('recognize_handwriting', {
			pngPath: tmp,
			strokes: compactStrokes(strokes).map(toWireStroke)
		});
	} finally {
		try {
			await remove(tmp);
		} catch {
			// Temp cleanup is best-effort.
		}
	}
}
