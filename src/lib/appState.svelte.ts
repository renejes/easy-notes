export type Locale = 'de' | 'en';

export type NotebookSummary = {
	id: string;
	title: string;
	entryCount: number;
};

export type OpenNotebook = {
	id: string;
	title: string;
	entries: string[];
	entryTitles: Record<string, string>;
	lockWarning: string | null;
};

export type OpenEntry = {
	notebookId: string;
	fileName: string;
};

const LOCALE_KEY = 'easy-notes.locale';

function isLocale(value: string | null): value is Locale {
	return value === 'de' || value === 'en';
}

function readStoredLocale(): Locale {
	if (typeof localStorage === 'undefined') {
		return 'de';
	}
	const stored = localStorage.getItem(LOCALE_KEY);
	return isLocale(stored) ? stored : 'de';
}

class AppState {
	locale = $state<Locale>(readStoredLocale());
	shelfRoot = $state<string | null>(null);
	shelfName = $state<string | null>(null);
	notebooks = $state<NotebookSummary[]>([]);
	openNotebook = $state<OpenNotebook | null>(null);
	openEntry = $state<OpenEntry | null>(null);
	lastError = $state<string | null>(null);
	busy = $state(false);

	setLocale(locale: Locale): void {
		this.locale = locale;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(LOCALE_KEY, locale);
		}
	}

	setShelf(root: string | null, name: string | null): void {
		this.shelfRoot = root;
		this.shelfName = name;
	}

	setNotebooks(notebooks: NotebookSummary[]): void {
		this.notebooks = notebooks;
	}

	setOpenNotebook(notebook: OpenNotebook | null): void {
		this.openNotebook = notebook;
		if (!notebook) {
			this.openEntry = null;
		}
	}

	setOpenEntry(entry: OpenEntry | null): void {
		this.openEntry = entry;
	}

	setError(message: string | null): void {
		this.lastError = message;
	}

	setBusy(busy: boolean): void {
		this.busy = busy;
	}
}

export const appState = new AppState();
