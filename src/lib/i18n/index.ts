import { appState, type Locale } from '$lib/appState.svelte';
import { persistAppSettings } from '$lib/host/settings';
import { de, type MessageKey } from './de';
import { en } from './en';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { de, en };

export type { Locale, MessageKey };

export function t(key: MessageKey): string {
	return dictionaries[appState.locale][key];
}

export function setLocale(locale: Locale): void {
	appState.setLocale(locale);
	void persistAppSettings();
}
