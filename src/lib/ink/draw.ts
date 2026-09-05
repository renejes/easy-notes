import type { InkPoint, Stroke } from '$lib/ink/types';

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
		if (stroke.points.length === 1) {
			ctx.lineWidth = stroke.width * scale;
			ctx.lineTo(first.x * scale + 0.1, first.y * scale);
		} else {
			for (let index = 1; index < stroke.points.length; index += 1) {
				const point = stroke.points[index];
				ctx.lineWidth =
					stroke.kind === 'marker'
						? stroke.width * scale
						: Math.max(1, stroke.width * (0.4 + point.p) * scale);
				ctx.lineTo(point.x * scale, point.y * scale);
			}
		}
		ctx.stroke();
		ctx.restore();
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
