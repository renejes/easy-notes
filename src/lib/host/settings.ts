import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appState, type Locale } from '$lib/appState.svelte';

const FILE = 'settings.json';
const LOCAL_KEY = 'easy-notes.settings';

export type AppSettings = {
	locale: Locale;
	shelfRoot: string | null;
	shelfName: string | null;
	paperLines: boolean;
};

type ParsedSettings = {
	locale: Locale;
	shelfRoot: string | null;
	shelfName: string | null;
	paperLines?: boolean;
};

function isLocale(value: unknown): value is Locale {
	return value === 'de' || value === 'en';
}

function parseSettings(raw: unknown): ParsedSettings | null {
	if (typeof raw !== 'object' || raw === null) {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const locale = isLocale(record.locale) ? record.locale : null;
	const shelfRoot = typeof record.shelfRoot === 'string' ? record.shelfRoot : null;
	const shelfName = typeof record.shelfName === 'string' ? record.shelfName : null;
	if (!locale && !shelfRoot) {
		return null;
	}
	return {
		locale: locale ?? 'de',
		shelfRoot,
		shelfName,
		paperLines: typeof record.paperLines === 'boolean' ? record.paperLines : undefined
	};
}

function readLocalSettings(): ParsedSettings | null {
	if (typeof localStorage === 'undefined') {
		return null;
	}
	try {
		const raw = localStorage.getItem(LOCAL_KEY);
		if (!raw) {
			return null;
		}
		return parseSettings(JSON.parse(raw));
	} catch {
		return null;
	}
}

function writeLocalSettings(settings: AppSettings): void {
	if (typeof localStorage === 'undefined') {
		return;
	}
	try {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
	} catch {
		// Private mode can block localStorage.
	}
}

function pickSettings(file: ParsedSettings | null, local: ParsedSettings | null): AppSettings | null {
	const paperLines = file?.paperLines ?? local?.paperLines ?? false;
	if (file?.shelfRoot) {
		return {
			locale: file.locale,
			shelfRoot: file.shelfRoot,
			shelfName: file.shelfName ?? local?.shelfName ?? null,
			paperLines
		};
	}
	if (local?.shelfRoot) {
		return {
			locale: file?.locale ?? local.locale,
			shelfRoot: local.shelfRoot,
			shelfName: local.shelfName,
			paperLines
		};
	}
	if (file) {
		return { locale: file.locale, shelfRoot: file.shelfRoot, shelfName: file.shelfName, paperLines };
	}
	if (local) {
		return { locale: local.locale, shelfRoot: local.shelfRoot, shelfName: local.shelfName, paperLines };
	}
	return null;
}

async function readFileSettings(): Promise<ParsedSettings | null> {
	try {
		if (!(await exists(FILE, { baseDir: BaseDirectory.AppConfig }))) {
			return null;
		}
		return parseSettings(JSON.parse(await readTextFile(FILE, { baseDir: BaseDirectory.AppConfig })));
	} catch {
		return null;
	}
}

export async function loadAppSettings(): Promise<AppSettings | null> {
	const local = readLocalSettings();
	const file = await readFileSettings();
	const picked = pickSettings(file, local);
	if (picked) {
		writeLocalSettings(picked);
	}
	return picked;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
	writeLocalSettings(settings);
	try {
		await mkdir('.', { baseDir: BaseDirectory.AppConfig, recursive: true });
		await writeTextFile(FILE, `${JSON.stringify(settings, null, 2)}\n`, {
			baseDir: BaseDirectory.AppConfig
		});
	} catch {
		// iOS WKWebView still has the localStorage copy.
	}
}

export async function persistAppSettings(): Promise<void> {
	await saveAppSettings({
		locale: appState.locale,
		shelfRoot: appState.shelfRoot,
		shelfName: appState.shelfName,
		paperLines: appState.paperLines
	});
}

export function setPaperLines(show: boolean): void {
	appState.paperLines = show;
	void persistAppSettings();
}
