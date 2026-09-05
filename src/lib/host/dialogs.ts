import { open } from '@tauri-apps/plugin-dialog';
import {
	forgetFolder,
	isScopedStorageError,
	listFolders,
	pickFolder,
	type FolderHandle
} from 'tauri-plugin-scoped-storage-api';
import { formatHostError } from './error';
import { parseScopedPath, toScopedRoot } from './scopedPath';
import { holdScopedFolder } from './scope';

async function holdIfPicked(path: string | null): Promise<string | null> {
	if (path) {
		await holdScopedFolder(path);
	}
	return path;
}

function asSinglePath(selected: string | string[] | null): string | null {
	if (selected === null) {
		return null;
	}
	if (Array.isArray(selected)) {
		return selected[0] ?? null;
	}
	return selected;
}

function suppressPickerClickThrough(): void {
	if (typeof window === 'undefined') {
		return;
	}
	const until = Date.now() + 500;
	const block = (event: Event): void => {
		if (Date.now() > until) {
			window.removeEventListener('pointerup', block, true);
			window.removeEventListener('click', block, true);
			return;
		}
		event.preventDefault();
		event.stopPropagation();
	};
	window.addEventListener('pointerup', block, true);
	window.addEventListener('click', block, true);
	window.setTimeout(() => {
		window.removeEventListener('pointerup', block, true);
		window.removeEventListener('click', block, true);
	}, 500);
}

async function canonicalScopedFolder(picked: FolderHandle): Promise<FolderHandle> {
	if (!picked.uri) {
		return picked;
	}
	let folders: FolderHandle[] = [];
	try {
		folders = await listFolders();
	} catch {
		return picked;
	}
	const sameUri = folders.filter((folder) => folder.uri === picked.uri);
	const keep = sameUri.find((folder) => folder.id !== picked.id) ?? picked;
	for (const extra of sameUri) {
		if (extra.id === keep.id) {
			continue;
		}
		try {
			await forgetFolder(extra.id);
		} catch {
			// Extra handles are only for the recents list.
		}
	}
	if (keep.id !== picked.id) {
		try {
			await forgetFolder(picked.id);
		} catch {
			// Keep the older handle.
		}
	}
	return keep.id === picked.id ? picked : { ...keep, name: picked.name ?? keep.name };
}

function isFolderPickerUnavailable(error: unknown): boolean {
	if (isScopedStorageError(error) && error.code === 'UNSUPPORTED') {
		return true;
	}
	return /unsupported|not implemented|FolderPicker/i.test(formatHostError(error, ''));
}

export async function pickDirectory(): Promise<string | null> {
	try {
		const folder = await canonicalScopedFolder(await pickFolder());
		suppressPickerClickThrough();
		return toScopedRoot(folder.id, folder.name ?? undefined, folder.uri ?? undefined);
	} catch (error) {
		if (isScopedStorageError(error) && (error.code === 'CANCELLED' || error.code === 'CANCELED')) {
			return null;
		}
		if (!isFolderPickerUnavailable(error)) {
			throw error;
		}
	}
	const selected = await open({
		multiple: false,
		directory: true,
		recursive: true
	});
	if (selected) {
		suppressPickerClickThrough();
	}
	return holdIfPicked(asSinglePath(selected));
}

export async function releaseScopedFolder(path: string): Promise<void> {
	const parsed = parseScopedPath(path);
	if (!parsed) {
		return;
	}
	try {
		await forgetFolder(parsed.id);
	} catch {
		// Recents can drop a stale handle without blocking.
	}
}
