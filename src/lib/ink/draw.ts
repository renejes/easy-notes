import { PAGE_LINE_GAP, PAGE_LINE_TOP, type InkPoint, type Stroke } from '$lib/ink/types';

export function drawPaper(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	scale: number,
	lined: boolean
): void {
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);
	if (!lined) {
		return;
	}
	ctx.save();
	ctx.strokeStyle = '#d4d4d4';
	ctx.lineWidth = 1;
	ctx.beginPath();
	const gap = PAGE_LINE_GAP * scale;
	const top = PAGE_LINE_TOP * scale;
	for (let y = top; y < height; y += gap) {
		const row = Math.round(y) + 0.5;
		ctx.moveTo(0, row);
		ctx.lineTo(width, row);
	}
	ctx.stroke();
	ctx.restore();
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number): void {
	ctx.lineJoin = 'round';
	for (const stroke of strokes) {
		if (stroke.points.length === 0) {
			continue;
		}
		ctx.save();
		switch (stroke.kind) {
			case 'pencil':
				ctx.globalCompositeOperation = 'source-over';
				ctx.globalAlpha = 1;
				ctx.lineCap = 'round';
				ctx.strokeStyle = stroke.color;
				break;
			case 'marker':
				ctx.globalCompositeOperation = 'source-over';
				ctx.globalAlpha = 0.42;
				ctx.lineCap = 'butt';
				ctx.strokeStyle = stroke.color;
				break;
			default: {
				const _exhaustive: never = stroke.kind;
				return _exhaustive;
			}
		}
		ctx.beginPath();
		const first = stroke.points[0];
		ctx.moveTo(first.x * scale, first.y * scale);
		ctx.lineWidth = strokeLineWidth(stroke, scale);
		if (stroke.points.length === 1) {
			ctx.lineTo(first.x * scale + 0.1, first.y * scale);
		} else {
			for (let index = 1; index < stroke.points.length; index += 1) {
				const point = stroke.points[index];
				ctx.lineTo(point.x * scale, point.y * scale);
			}
		}
		ctx.stroke();
		ctx.restore();
	}
}

function strokeLineWidth(stroke: Stroke, scale: number): number {
	switch (stroke.kind) {
		case 'pencil':
			// PencilKit's pen reads thinner than a round canvas stroke of the same width.
			return stroke.width * scale * 0.5;
		case 'marker':
			return stroke.width * scale;
		default: {
			const _exhaustive: never = stroke.kind;
			return _exhaustive;
		}
	}
}

export function pointerToPoint(
	event: PointerEvent,
	canvas: HTMLCanvasElement,
	scale: number
): InkPoint {
	const rect = canvas.getBoundingClientRect();
	return {
		x: ((event.clientX - rect.left) * (canvas.width / rect.width)) / scale,
		y: ((event.clientY - rect.top) * (canvas.height / rect.height)) / scale,
		p: event.pressure > 0 ? event.pressure : 0.5
	};
}

/** Palm/finger is `touch`. Pencil is `pen`, Mac trackpad/mouse is `mouse`. */
export function isInkPointer(event: PointerEvent): boolean {
	return event.pointerType !== 'touch';
}

/** Hovering Pencil must not start an erase. */
export function isInkContact(event: PointerEvent): boolean {
	return isInkPointer(event) && event.buttons > 0;
}

function isIosHost(): boolean {
	if (typeof navigator === 'undefined') {
		return false;
	}
	const ua = navigator.userAgent;
	if (/iPhone|iPad|iPod/i.test(ua)) {
		return true;
	}
	return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

/**
 * WebKit's getCoalescedEvents on iPad returns points out of order (and often
 * without pointerId/target). tldraw disabled coalesced ink on iOS for that.
 * iPad pointermove already arrives at a high rate; use the event itself.
 */
export function strokePointers(event: PointerEvent): PointerEvent[] {
	if (isIosHost() || typeof event.getCoalescedEvents !== 'function') {
		return [event];
	}
	const events = event.getCoalescedEvents();
	if (events.length === 0) {
		return [event];
	}
	const usable = events.filter(
		(item) => Number.isFinite(item.clientX) && Number.isFinite(item.clientY)
	);
	return usable.length > 0 ? usable : [event];
}

export function predictedPoints(
	event: PointerEvent,
	canvas: HTMLCanvasElement,
	scale: number
): InkPoint[] {
	if (isIosHost() || typeof event.getPredictedEvents !== 'function') {
		return [];
	}
	return event.getPredictedEvents().map((predicted) => pointerToPoint(predicted, canvas, scale));
}
