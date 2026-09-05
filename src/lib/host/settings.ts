import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appState, type Locale } from '$lib/appState.svelte';

const FILE = 'settings.json';

export type AppSettings = {
	locale: Locale;
	shelfRoot: string | null;
	shelfName: string | null;
};

function isLocale(value: unknown): value is Locale {
	return value === 'de' || value === 'en';
}

export async function loadAppSettings(): Promise<AppSettings | null> {
	try {
		if (!(await exists(FILE, { baseDir: BaseDirectory.AppConfig }))) {
			return null;
		}
		const parsed: unknown = JSON.parse(await readTextFile(FILE, { baseDir: BaseDirectory.AppConfig }));
		if (typeof parsed !== 'object' || parsed === null) {
			return null;
		}
		const record = parsed as Record<string, unknown>;
		if (!isLocale(record.locale)) {
			return null;
		}
		return {
			locale: record.locale,
			shelfRoot: typeof record.shelfRoot === 'string' ? record.shelfRoot : null,
			shelfName: typeof record.shelfName === 'string' ? record.shelfName : null
		};
	} catch {
		return null;
	}
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
	try {
		await mkdir('.', { baseDir: BaseDirectory.AppConfig, recursive: true });
		await writeTextFile(FILE, `${JSON.stringify(settings, null, 2)}\n`, {
			baseDir: BaseDirectory.AppConfig
		});
	} catch {
		// Browser preview still keeps locale in localStorage.
	}
}

export async function persistAppSettings(): Promise<void> {
	await saveAppSettings({
		locale: appState.locale,
		shelfRoot: appState.shelfRoot,
		shelfName: appState.shelfName
	});
}
