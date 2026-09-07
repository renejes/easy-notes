export type InkPoint = {
	x: number;
	y: number;
	p: number;
};

export type InkKind = 'pencil' | 'marker';

export type Stroke = {
	kind: InkKind;
	color: string;
	width: number;
	points: InkPoint[];
};

export const PENCIL_COLOR = '#111111';
export const PENCIL_WIDTH = 1.4;
export const MARKER_WIDTH = 16;
export const ERASER_RADIUS = 12;
export const PAGE_WIDTH = 768;
export const PAGE_MIN_HEIGHT = 1024;
export const PAGE_GROW_PAD = 240;
export const PAGE_LINE_GAP = 32;
export const PAGE_LINE_TOP = 40;

export const MARKER_COLORS = ['#FFE135', '#FF4DA6', '#FF6A00'] as const;

/** Page units. Drops duplicate samples without reshaping the stroke. */
export const INK_MIN_POINT_DIST = 0.5;

const DEFAULT_PRESSURE = 0.5;

function roundCoord(value: number): number {
	return Math.round(value * 10) / 10;
}

function roundPressure(value: number): number {
	return Math.round(value * 10) / 10;
}

function compactPoint(point: InkPoint): InkPoint {
	return {
		x: roundCoord(point.x),
		y: roundCoord(point.y),
		p: roundPressure(point.p)
	};
}

export function appendInkPoint(points: InkPoint[], next: InkPoint): void {
	const point = compactPoint(next);
	const last = points[points.length - 1];
	if (!last) {
		points.push(point);
		return;
	}
	const dx = point.x - last.x;
	const dy = point.y - last.y;
	if (dx * dx + dy * dy < INK_MIN_POINT_DIST * INK_MIN_POINT_DIST) {
		points[points.length - 1] = point;
		return;
	}
	points.push(point);
}

export function compactStroke(stroke: Stroke): Stroke | null {
	if (stroke.points.length === 0) {
		return null;
	}
	const points: InkPoint[] = [];
	for (const raw of stroke.points) {
		appendInkPoint(points, raw);
	}
	return {
		kind: stroke.kind,
		color: stroke.color,
		width: roundCoord(stroke.width),
		points
	};
}

export function compactStrokes(strokes: Stroke[]): Stroke[] {
	return strokes
		.map((stroke) => compactStroke(stroke))
		.filter((stroke): stroke is Stroke => stroke !== null);
}

type WirePoint = [number, number] | [number, number, number];

export type WireStroke = {
	kind?: InkKind;
	color: string;
	width: number;
	points: WirePoint[];
};

function toWirePoint(point: InkPoint): WirePoint {
	if (point.p === DEFAULT_PRESSURE) {
		return [point.x, point.y];
	}
	return [point.x, point.y, point.p];
}

export function toWireStroke(stroke: Stroke): WireStroke {
	const wire: WireStroke = {
		color: stroke.color,
		width: stroke.width,
		points: stroke.points.map(toWirePoint)
	};
	if (stroke.kind === 'marker') {
		wire.kind = 'marker';
	}
	return wire;
}

function parseKind(raw: unknown): InkKind {
	if (raw === 'marker') {
		return 'marker';
	}
	return 'pencil';
}

export function newStroke(kind: InkKind, color: string): Stroke {
	switch (kind) {
		case 'pencil':
			return { kind: 'pencil', color: PENCIL_COLOR, width: PENCIL_WIDTH, points: [] };
		case 'marker':
			return { kind: 'marker', color, width: MARKER_WIDTH, points: [] };
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

function parsePoint(raw: unknown): InkPoint | null {
	if (Array.isArray(raw)) {
		if (raw.length < 2) {
			return null;
		}
		const x = Number(raw[0]);
		const y = Number(raw[1]);
		const p = raw.length >= 3 ? Number(raw[2]) : DEFAULT_PRESSURE;
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(p)) {
			return null;
		}
		return { x, y, p };
	}
	if (typeof raw === 'object' && raw !== null) {
		const rec = raw as Record<string, unknown>;
		const x = Number(rec.x);
		const y = Number(rec.y);
		const p = rec.p === undefined ? DEFAULT_PRESSURE : Number(rec.p);
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(p)) {
			return null;
		}
		return { x, y, p };
	}
	return null;
}

function parseStroke(raw: unknown): Stroke | null {
	if (typeof raw !== 'object' || raw === null) {
		return null;
	}
	const rec = raw as Record<string, unknown>;
	if (!Array.isArray(rec.points)) {
		return null;
	}
	const points = rec.points
		.map((point) => parsePoint(point))
		.filter((point): point is InkPoint => point !== null);
	if (points.length === 0) {
		return null;
	}
	const kind = parseKind(rec.kind);
	return {
		kind,
		color: typeof rec.color === 'string' ? rec.color : PENCIL_COLOR,
		width:
			typeof rec.width === 'number' && Number.isFinite(rec.width)
				? rec.width
				: kind === 'marker'
					? MARKER_WIDTH
					: PENCIL_WIDTH,
		points
	};
}

export function parseStrokes(raw: unknown): Stroke[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	return raw.map((stroke) => parseStroke(stroke)).filter((stroke): stroke is Stroke => stroke !== null);
}

function eraseStroke(stroke: Stroke, eraser: InkPoint, radiusSq: number): Stroke[] {
	const kept: Stroke[] = [];
	let chunk: InkPoint[] = [];
	const flush = (): void => {
		if (chunk.length > 0) {
			kept.push({ ...stroke, points: chunk });
		}
		chunk = [];
	};
	for (const point of stroke.points) {
		const dx = point.x - eraser.x;
		const dy = point.y - eraser.y;
		if (dx * dx + dy * dy < radiusSq) {
			flush();
		} else {
			chunk.push(point);
		}
	}
	flush();
	return kept;
}

export function eraseAlong(strokes: Stroke[], from: InkPoint, to: InkPoint): Stroke[] {
	const radiusSq = ERASER_RADIUS * ERASER_RADIUS;
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dist = Math.hypot(dx, dy);
	const steps = Math.max(1, Math.ceil(dist / (ERASER_RADIUS * 0.45)));
	let current = strokes;
	for (let step = 0; step <= steps; step += 1) {
		const t = step / steps;
		const eraser: InkPoint = { x: from.x + dx * t, y: from.y + dy * t, p: 0.5 };
		current = current.flatMap((stroke) => eraseStroke(stroke, eraser, radiusSq));
	}
	return current;
}

export function strokeBoundsHeight(strokes: Stroke[]): number {
	let maxY = 0;
	for (const stroke of strokes) {
		for (const point of stroke.points) {
			if (point.y > maxY) {
				maxY = point.y;
			}
		}
	}
	return Math.max(PAGE_MIN_HEIGHT, maxY + PAGE_GROW_PAD);
}
