import { basename, dirname, join } from '@tauri-apps/api/path';
import {
	exists,
	mkdir,
	readDir,
	readFile,
	readTextFile,
	remove,
	rename,
	writeFile,
	writeTextFile,
	type DirEntry
} from '@tauri-apps/plugin-fs';
import {
	exists as scopedExists,
	getFolderInfo,
	mkdir as scopedMkdir,
	readDir as scopedReadDir,
	readFile as scopedReadFile,
	readTextFile as scopedReadTextFile,
	removeDir as scopedRemoveDir,
	removeFile as scopedRemoveFile,
	rename as scopedRename,
	writeFile as scopedWriteFile,
	writeTextFile as scopedWriteTextFile
} from 'tauri-plugin-scoped-storage-api';
import {
	isScopedPath,
	joinScoped,
	parseScopedPath,
	scopedFileName,
	splitRelative
} from './scopedPath';

export async function joinPath(...parts: string[]): Promise<string> {
	if (parts.length > 0 && isScopedPath(parts[0])) {
		return joinScoped(parts[0], ...parts.slice(1));
	}
	return join(...parts);
}

export async function resolveUnder(root: string, relativePath: string): Promise<string> {
	const parts = splitRelative(relativePath);
	if (parts.length === 0) {
		return root;
	}
	return joinPath(root, ...parts);
}

export async function fileNameOf(path: string): Promise<string> {
	if (isScopedPath(path)) {
		return scopedFileName(path);
	}
	return basename(path);
}

export async function pathExists(path: string): Promise<boolean> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		if (scoped.rel.length === 0) {
			try {
				await getFolderInfo(scoped.id);
				return true;
			} catch {
				return false;
			}
		}
		return scopedExists(scoped.id, scoped.rel);
	}
	return exists(path);
}

export async function makeDir(path: string): Promise<void> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		if (scoped.rel.length === 0) {
			return;
		}
		await scopedMkdir(scoped.id, scoped.rel, true);
		return;
	}
	await mkdir(path, { recursive: true });
}

export async function listDir(path: string): Promise<DirEntry[]> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		const entries = await scopedReadDir(scoped.id, scoped.rel.length > 0 ? scoped.rel : undefined);
		return entries.map((entry) => ({
			name: entry.name,
			isDirectory: entry.isDir,
			isFile: entry.isFile,
			isSymlink: false
		}));
	}
	return readDir(path);
}

export async function readBytes(path: string): Promise<Uint8Array> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		return scopedReadFile(scoped.id, scoped.rel);
	}
	return readFile(path);
}

export async function writeBytes(path: string, data: Uint8Array): Promise<void> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		await scopedWriteFile(scoped.id, scoped.rel, data, { recursive: true });
		return;
	}
	const parent = await dirname(path);
	await mkdir(parent, { recursive: true });
	await writeFile(path, data);
}

export async function readText(path: string): Promise<string> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		return scopedReadTextFile(scoped.id, scoped.rel);
	}
	return readTextFile(path);
}

export async function writeText(path: string, content: string): Promise<void> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		await scopedWriteTextFile(scoped.id, scoped.rel, content, { recursive: true });
		return;
	}
	const parent = await dirname(path);
	await mkdir(parent, { recursive: true });
	await writeTextFile(path, content);
}

export async function removeFile(path: string): Promise<void> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		if (scoped.rel.length === 0) {
			return;
		}
		try {
			await scopedRemoveFile(scoped.id, scoped.rel);
		} catch {
			// Missing file is fine.
		}
		return;
	}
	try {
		await remove(path);
	} catch {
		// Missing file is fine.
	}
}

export async function removeDir(path: string): Promise<void> {
	const scoped = parseScopedPath(path);
	if (scoped) {
		if (scoped.rel.length === 0) {
			return;
		}
		await scopedRemoveDir(scoped.id, scoped.rel, true);
		return;
	}
	await remove(path, { recursive: true });
}

export async function renamePath(from: string, to: string): Promise<void> {
	if (from === to) {
		return;
	}
	const fromScoped = parseScopedPath(from);
	const toScoped = parseScopedPath(to);
	if (fromScoped && toScoped) {
		if (fromScoped.id !== toScoped.id) {
			throw new Error('rename');
		}
		await scopedRename(fromScoped.id, fromScoped.rel, toScoped.rel);
		return;
	}
	await rename(from, to);
}
