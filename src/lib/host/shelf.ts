import { listFolders } from 'tauri-plugin-scoped-storage-api';
import { appState, type NotebookSummary } from '$lib/appState.svelte';
import {
	entryFileName,
	markdownName,
	newEntry,
	parseEntry,
	serializeEntry,
	type NoteEntry
} from '$lib/note/entry';
import { parseNotebookYaml, serializeNotebookYaml } from '$lib/note/manifest';
import { t } from '$lib/i18n';
import { pickDirectory } from './dialogs';
import { formatHostError } from './error';
import {
	fileNameOf,
	joinPath,
	listDir,
	makeDir,
	pathExists,
	readText,
	removeDir,
	removeFile,
	renamePath,
	resolveUnder,
	writeText
} from './files';
import { isLockStale, isOurLock, readLock, releaseLock, writeLock } from './lock';
import { isScopedPath, parseScopedPath, scopedDisplayName, toScopedRoot } from './scopedPath';
import { holdScopedFolder } from './scope';
import { persistAppSettings } from './settings';

const SKIP_NAMES = new Set(['.dropbox', '.DS_Store', '__MACOSX', '.easy-reading', '.easy-notes']);
const MANIFEST = 'notebook.yaml';

function requireRoot(): string {
	const root = appState.shelfRoot;
	if (!root) {
		throw new Error(t('noLibrary'));
	}
	return root;
}

function slugTitle(title: string): string {
	const map: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
	const lowered = title
		.trim()
		.toLowerCase()
		.replace(/[äöüß]/g, (char) => map[char] ?? char);
	const slug = lowered.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return slug.length > 0 ? slug : 'heft';
}

function noteStem(fileName: string): string {
	return fileName.replace(/\.note\.json$/i, '');
}

async function uniqueChild(parent: string, desired: string, except?: string): Promise<string> {
	if (except && desired === except) {
		return except;
	}
	if (!(await pathExists(await joinPath(parent, desired)))) {
		return desired;
	}
	const isNote = desired.endsWith('.note.json');
	const stem = isNote ? noteStem(desired) : desired;
	const ext = isNote ? '.note.json' : '';
	let n = 2;
	while (true) {
		const candidate = `${stem}-${n}${ext}`;
		if (candidate === except || !(await pathExists(await joinPath(parent, candidate)))) {
			return candidate;
		}
		n += 1;
	}
}

async function hydrateScopedDisplay(root: string): Promise<string | null> {
	const parsed = parseScopedPath(root);
	if (!parsed) {
		return fileNameOf(root);
	}
	try {
		const folders = await listFolders();
		const match = folders.find((folder) => folder.id === parsed.id);
		if (match) {
			toScopedRoot(match.id, match.name ?? undefined, match.uri ?? undefined);
			return match.name ?? scopedDisplayName(parsed.id);
		}
	} catch {
		// Bookmark still usable even if the name list fails.
	}
	return scopedDisplayName(parsed.id);
}

export async function chooseShelfFolder(): Promise<void> {
	const path = await pickDirectory();
	if (!path) {
		return;
	}
	await holdScopedFolder(path);
	const name = (await hydrateScopedDisplay(path)) ?? t('untitled');
	appState.setShelf(path, name);
	await persistAppSettings();
	await refreshShelf();
}

export async function loadShelf(): Promise<void> {
	const root = appState.shelfRoot;
	if (!root) {
		return;
	}
	try {
		await holdScopedFolder(root);
		if (isScopedPath(root)) {
			const name = await hydrateScopedDisplay(root);
			if (name) {
				appState.setShelf(root, name);
			}
		}
		await refreshShelf();
	} catch (error) {
		appState.setError(formatHostError(error, t('folderMissing')));
		appState.setShelf(null, null);
		await persistAppSettings();
	}
}

async function readManifestAt(notebookPath: string) {
	const path = await joinPath(notebookPath, MANIFEST);
	if (!(await pathExists(path))) {
		return null;
	}
	return parseNotebookYaml(await readText(path));
}

export async function refreshShelf(): Promise<void> {
	const root = requireRoot();
	const entries = await listDir(root);
	const notebooks: NotebookSummary[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory || !entry.name || SKIP_NAMES.has(entry.name) || entry.name.startsWith('.')) {
			continue;
		}
		const folder = await joinPath(root, entry.name);
		const manifest = await readManifestAt(folder);
		if (!manifest) {
			continue;
		}
		notebooks.push({
			id: entry.name,
			title: manifest.title,
			entryCount: manifest.entries.length
		});
	}
	notebooks.sort((a, b) => a.title.localeCompare(b.title, appState.locale));
	appState.setNotebooks(notebooks);
}

function fallbackEntryTitle(fileName: string): string {
	return fileName.replace(/\.note\.json$/i, '');
}

async function titlesFor(folder: string, fileNames: string[]): Promise<Record<string, string>> {
	const titles: Record<string, string> = {};
	for (const fileName of fileNames) {
		try {
			const parsed = parseEntry(JSON.parse(await readText(await joinPath(folder, fileName))));
			const title = parsed?.title.trim();
			titles[fileName] = title && title.length > 0 ? title : fallbackEntryTitle(fileName);
		} catch {
			titles[fileName] = fallbackEntryTitle(fileName);
		}
	}
	return titles;
}

export async function createNotebook(title: string): Promise<string> {
	const root = requireRoot();
	const folderName = await uniqueChild(root, slugTitle(title));
	const folder = await joinPath(root, folderName);
	await makeDir(folder);
	await writeText(
		await joinPath(folder, MANIFEST),
		serializeNotebookYaml({ schema: 1, title: title.trim(), lang: appState.locale, entries: [] })
	);
	await refreshShelf();
	return folderName;
}

export async function renameNotebook(id: string, title: string): Promise<void> {
	const trimmed = title.trim();
	if (trimmed.length === 0) {
		return;
	}
	const root = requireRoot();
	const folder = await joinPath(root, id);
	const manifest = await readManifestAt(folder);
	if (!manifest) {
		throw new Error(t('openFailed'));
	}
	manifest.title = trimmed;
	await writeText(await joinPath(folder, MANIFEST), serializeNotebookYaml(manifest));
	const nextId = await uniqueChild(root, slugTitle(trimmed), id);
	if (nextId !== id) {
		await renamePath(folder, await joinPath(root, nextId));
	}
	const open = appState.openNotebook;
	if (open?.id === id) {
		appState.setOpenNotebook({ ...open, id: nextId, title: trimmed });
		if (appState.openEntry?.notebookId === id) {
			appState.setOpenEntry({
				notebookId: nextId,
				fileName: appState.openEntry.fileName
			});
		}
	}
	await refreshShelf();
}

export async function deleteNotebook(id: string): Promise<void> {
	const folder = await joinPath(requireRoot(), id);
	await releaseLock(folder);
	await removeDir(folder);
	if (appState.openNotebook?.id === id) {
		appState.setOpenNotebook(null);
	}
	await refreshShelf();
}

export async function openNotebook(id: string): Promise<void> {
	const root = requireRoot();
	const folder = await joinPath(root, id);
	const manifest = await readManifestAt(folder);
	if (!manifest) {
		throw new Error(t('openFailed'));
	}
	let lockWarning: string | null = null;
	const existing = await readLock(folder);
	if (existing && !isOurLock(existing) && !isLockStale(existing)) {
		lockWarning = `${t('lockHeld')} (${existing.machine})`;
	} else {
		await writeLock(folder);
	}
	appState.setOpenNotebook({
		id,
		title: manifest.title,
		entries: manifest.entries,
		entryTitles: await titlesFor(folder, manifest.entries),
		lockWarning
	});
}

export async function closeNotebook(): Promise<void> {
	const open = appState.openNotebook;
	if (!open) {
		return;
	}
	const folder = await joinPath(requireRoot(), open.id);
	await releaseLock(folder);
	appState.setOpenNotebook(null);
}

export async function createEntry(title: string): Promise<string> {
	const open = appState.openNotebook;
	if (!open) {
		throw new Error(t('openFailed'));
	}
	const folder = await joinPath(requireRoot(), open.id);
	const entry = newEntry(title.trim() || t('untitledEntry'));
	const fileName = await uniqueChild(folder, entryFileName(entry.createdAt, slugTitle(entry.title)));
	await writeText(await joinPath(folder, fileName), serializeEntry(entry));
	const manifest = await readManifestAt(folder);
	if (!manifest) {
		throw new Error(t('openFailed'));
	}
	manifest.entries = [...manifest.entries, fileName];
	await writeText(await joinPath(folder, MANIFEST), serializeNotebookYaml(manifest));
	appState.setOpenNotebook({
		...open,
		entries: manifest.entries,
		entryTitles: { ...open.entryTitles, [fileName]: entry.title }
	});
	await refreshShelf();
	return fileName;
}

export async function readEntry(notebookId: string, fileName: string): Promise<NoteEntry> {
	const path = await resolveUnder(requireRoot(), `${notebookId}/${fileName}`);
	const parsed = parseEntry(JSON.parse(await readText(path)));
	if (!parsed) {
		throw new Error(t('openFailed'));
	}
	return parsed;
}

export async function writeEntry(notebookId: string, fileName: string, entry: NoteEntry): Promise<void> {
	const path = await resolveUnder(requireRoot(), `${notebookId}/${fileName}`);
	await writeText(path, serializeEntry(entry));
}

export async function writeEntryMarkdown(
	notebookId: string,
	fileName: string,
	title: string,
	notebookTitle: string,
	body: string
): Promise<string> {
	const mdName = markdownName(fileName);
	const path = await resolveUnder(requireRoot(), `${notebookId}/${mdName}`);
	const front = [
		'---',
		`title: ${JSON.stringify(title)}`,
		`source: Easy Notes`,
		`notebook: ${JSON.stringify(notebookTitle)}`,
		`entry: ${fileName}`,
		'---',
		'',
		body.trim(),
		''
	].join('\n');
	await writeText(path, front);
	return mdName;
}

export async function renameEntry(notebookId: string, fileName: string, title: string): Promise<void> {
	const trimmed = title.trim();
	if (trimmed.length === 0) {
		return;
	}
	const folder = await joinPath(requireRoot(), notebookId);
	const entry = await readEntry(notebookId, fileName);
	entry.title = trimmed;
	await writeEntry(notebookId, fileName, entry);
	const nextName = await uniqueChild(folder, entryFileName(entry.createdAt, slugTitle(trimmed)), fileName);
	if (nextName !== fileName) {
		await renamePath(await joinPath(folder, fileName), await joinPath(folder, nextName));
		const fromMd = await joinPath(folder, markdownName(fileName));
		if (await pathExists(fromMd)) {
			await renamePath(fromMd, await joinPath(folder, markdownName(nextName)));
		}
		const manifest = await readManifestAt(folder);
		if (manifest) {
			manifest.entries = manifest.entries.map((name) => (name === fileName ? nextName : name));
			await writeText(await joinPath(folder, MANIFEST), serializeNotebookYaml(manifest));
		}
	}
	const mdPath = await joinPath(folder, markdownName(nextName));
	if (await pathExists(mdPath)) {
		const raw = await readText(mdPath);
		const withTitle = raw.replace(/^title:\s*.+$/m, `title: ${JSON.stringify(trimmed)}`);
		await writeText(
			mdPath,
			withTitle.replace(/^entry:\s*.+$/m, `entry: ${nextName}`)
		);
	}
	const open = appState.openNotebook;
	if (open?.id === notebookId) {
		const entryTitles = { ...open.entryTitles };
		if (nextName !== fileName) {
			delete entryTitles[fileName];
		}
		entryTitles[nextName] = trimmed;
		appState.setOpenNotebook({
			...open,
			entries: open.entries.map((name) => (name === fileName ? nextName : name)),
			entryTitles
		});
	}
	if (appState.openEntry?.notebookId === notebookId && appState.openEntry.fileName === fileName) {
		appState.setOpenEntry({ notebookId, fileName: nextName });
	}
}

export async function deleteEntry(notebookId: string, fileName: string): Promise<void> {
	const folder = await joinPath(requireRoot(), notebookId);
	await removeFile(await joinPath(folder, fileName));
	await removeFile(await joinPath(folder, markdownName(fileName)));
	const manifest = await readManifestAt(folder);
	if (manifest) {
		manifest.entries = manifest.entries.filter((entry) => entry !== fileName);
		await writeText(await joinPath(folder, MANIFEST), serializeNotebookYaml(manifest));
	}
	const open = appState.openNotebook;
	if (open?.id === notebookId) {
		const entryTitles = { ...open.entryTitles };
		delete entryTitles[fileName];
		appState.setOpenNotebook({
			...open,
			entries: open.entries.filter((entry) => entry !== fileName),
			entryTitles
		});
	}
	if (appState.openEntry?.notebookId === notebookId && appState.openEntry.fileName === fileName) {
		appState.setOpenEntry(null);
	}
	await refreshShelf();
}
