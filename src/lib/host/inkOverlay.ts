import { invoke } from '@tauri-apps/api/core';
import { compactStroke, parseStrokes, type InkKind, type Stroke } from '$lib/ink/types';

export type InkOverlayFrame = {
	canvasX: number;
	canvasY: number;
	canvasWidth: number;
	canvasHeight: number;
	clipX: number;
	clipY: number;
	clipWidth: number;
	clipHeight: number;
	pageWidth: number;
};

export type InkOverlayTool = {
	kind: InkKind | 'off';
	color: string;
	width: number;
};

type InkWindow = Window & {
	__easyNotesOnInkStroke?: (payload: unknown) => void;
	__easyNotesInkQueue?: unknown[];
};

const PLUGIN = 'plugin:handwriting';
const ATTACH_TIMEOUT_MS = 2000;

let attached = false;
let strokeHandler: ((stroke: Stroke) => void) | null = null;
let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
	const run = queue.then(task, task);
	queue = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

async function call(command: string, args?: Record<string, unknown>): Promise<void> {
	await invoke(`${PLUGIN}|${command}`, args);
}

function withTimeout(task: Promise<void>, ms: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => {
			reject(new Error('timeout'));
		}, ms);
		task.then(
			() => {
				window.clearTimeout(timer);
				resolve();
			},
			(error: unknown) => {
				window.clearTimeout(timer);
				reject(error);
			}
		);
	});
}

function setWindowHandler(handler: ((payload: unknown) => void) | null): void {
	const view = window as InkWindow;
	if (!handler) {
		delete view.__easyNotesOnInkStroke;
		return;
	}
	view.__easyNotesOnInkStroke = handler;
	const queued = view.__easyNotesInkQueue ?? [];
	view.__easyNotesInkQueue = [];
	for (const payload of queued) {
		handler(payload);
	}
}

function strokeFromPayload(payload: unknown): Stroke | null {
	const source = unwrapPayload(payload);
	const parsed = parseStrokes(Array.isArray(source) ? source : [source]);
	const stroke = parsed[0];
	if (!stroke) {
		return null;
	}
	return compactStroke(stroke) ?? stroke;
}

function unwrapPayload(payload: unknown): unknown {
	if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
		return payload;
	}
	const record = payload as Record<string, unknown>;
	if (record.points !== undefined) {
		return payload;
	}
	if (record.payload !== undefined) {
		return record.payload;
	}
	return payload;
}

function handleStrokePayload(payload: unknown): void {
	const stroke = strokeFromPayload(payload);
	if (stroke) {
		strokeHandler?.(stroke);
	}
}

export function overlayFrameFor(
	canvas: HTMLCanvasElement,
	clip: HTMLElement,
	pageWidth: number
): InkOverlayFrame {
	const paper = canvas.getBoundingClientRect();
	const bounds = clip.getBoundingClientRect();
	return {
		canvasX: paper.left,
		canvasY: paper.top,
		canvasWidth: paper.width,
		canvasHeight: paper.height,
		clipX: bounds.left,
		clipY: bounds.top,
		clipWidth: bounds.width,
		clipHeight: bounds.height,
		pageWidth
	};
}

export async function attachInkOverlay(
	frame: InkOverlayFrame,
	tool: InkOverlayTool,
	onStroke: (stroke: Stroke) => void
): Promise<void> {
	await enqueue(async () => {
		strokeHandler = onStroke;
		setWindowHandler(handleStrokePayload);
		try {
			await withTimeout(
				call('attach_ink_overlay', {
					...frame,
					kind: tool.kind,
					color: tool.color,
					width: tool.width
				}),
				ATTACH_TIMEOUT_MS
			);
			attached = true;
		} catch (error) {
			attached = false;
			strokeHandler = null;
			setWindowHandler(null);
			throw error;
		}
	});
}

export async function updateInkOverlay(frame: InkOverlayFrame): Promise<void> {
	if (!attached) {
		return;
	}
	await call('update_ink_overlay', frame);
}

export async function setInkTool(tool: InkOverlayTool, trim?: 'pop' | 'clear'): Promise<void> {
	if (!attached) {
		return;
	}
	await call('set_ink_tool', {
		kind: tool.kind,
		color: tool.color,
		width: tool.width,
		...(trim ? { trim } : {})
	});
}

export async function detachInkOverlay(): Promise<void> {
	await enqueue(async () => {
		if (!attached) {
			strokeHandler = null;
			setWindowHandler(null);
			return;
		}
		attached = false;
		try {
			await call('detach_ink_overlay');
		} catch {
			// Overlay is already gone when leaving iOS or tearing down.
		}
		const view = window as InkWindow;
		const queued = view.__easyNotesInkQueue ?? [];
		view.__easyNotesInkQueue = [];
		for (const payload of queued) {
			handleStrokePayload(payload);
		}
		strokeHandler = null;
		setWindowHandler(null);
	});
}
