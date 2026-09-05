import { compactStrokes, parseStrokes, toWireStroke, type Stroke } from '$lib/ink/types';

export type NoteLang = 'de' | 'en';

export type NoteSource = {
	app: 'easy-reading';
	document: string;
	pageIndex: number;
	insertId: string;
};

export type NotePage = {
	width: number;
	grow: 'vertical';
};

export type NoteEntry = {
	schema: 1;
	id: string;
	title: string;
	createdAt: string;
	page: NotePage;
	strokes: Stroke[];
	source: NoteSource | null;
};

export type NotebookManifest = {
	schema: 1;
	title: string;
	lang: NoteLang;
	entries: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLang(value: unknown): value is NoteLang {
	return value === 'de' || value === 'en';
}

export function emptyManifest(title: string, lang: NoteLang = 'de'): NotebookManifest {
	return { schema: 1, title, lang, entries: [] };
}

export function parseManifestValue(parsed: unknown): NotebookManifest {
	if (!isRecord(parsed)) {
		throw new Error('invalid-manifest');
	}
	if (typeof parsed.title !== 'string' || parsed.title.trim().length === 0) {
		throw new Error('invalid-manifest');
	}
	const entries = Array.isArray(parsed.entries)
		? parsed.entries.filter((entry): entry is string => typeof entry === 'string' && entry.endsWith('.note.json'))
		: [];
	return {
		schema: 1,
		title: parsed.title.trim(),
		lang: isLang(parsed.lang) ? parsed.lang : 'de',
		entries
	};
}

export function parseEntry(raw: unknown): NoteEntry | null {
	if (!isRecord(raw)) {
		return null;
	}
	if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.createdAt !== 'string') {
		return null;
	}
	const pageRaw = isRecord(raw.page) ? raw.page : {};
	const width = typeof pageRaw.width === 'number' && Number.isFinite(pageRaw.width) ? pageRaw.width : 768;
	return {
		schema: 1,
		id: raw.id,
		title: raw.title,
		createdAt: raw.createdAt,
		page: { width, grow: 'vertical' },
		strokes: parseStrokes(raw.strokes),
		source: parseSource(raw.source)
	};
}

function parseSource(raw: unknown): NoteSource | null {
	if (!isRecord(raw)) {
		return null;
	}
	if (raw.app !== 'easy-reading') {
		return null;
	}
	if (
		typeof raw.document !== 'string' ||
		typeof raw.pageIndex !== 'number' ||
		typeof raw.insertId !== 'string'
	) {
		return null;
	}
	return {
		app: 'easy-reading',
		document: raw.document,
		pageIndex: raw.pageIndex,
		insertId: raw.insertId
	};
}

export function serializeEntry(entry: NoteEntry): string {
	return `${JSON.stringify(
		{
			schema: 1,
			id: entry.id,
			title: entry.title,
			createdAt: entry.createdAt,
			page: { width: entry.page.width, grow: 'vertical' },
			strokes: compactStrokes(entry.strokes).map(toWireStroke),
			source: entry.source
		},
		null,
		0
	)}\n`;
}

export function newEntry(title: string, width = 768): NoteEntry {
	return {
		schema: 1,
		id: crypto.randomUUID(),
		title,
		createdAt: new Date().toISOString(),
		page: { width, grow: 'vertical' },
		strokes: [],
		source: null
	};
}

export function entryFileName(createdAt: string, slug: string): string {
	const day = createdAt.slice(0, 10);
	return `${day}-${slug}.note.json`;
}

export function markdownName(noteFile: string): string {
	return noteFile.replace(/\.note\.json$/i, '.md');
}
