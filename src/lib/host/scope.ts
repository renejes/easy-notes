import {
	startAccessingSecurityScopedResource,
	stopAccessingSecurityScopedResource
} from '@tauri-apps/plugin-fs';
import { isScopedPath } from './scopedPath';

let heldPath: string | null = null;

function asFileUrl(path: string): string {
	if (path.startsWith('file:')) {
		return path;
	}
	return path;
}

export async function holdScopedFolder(path: string): Promise<void> {
	if (isScopedPath(path)) {
		heldPath = path;
		return;
	}
	if (heldPath && heldPath !== path && !isScopedPath(heldPath)) {
		try {
			await stopAccessingSecurityScopedResource(asFileUrl(heldPath));
		} catch {
			// Desktop ignores this API.
		}
	}
	try {
		await startAccessingSecurityScopedResource(asFileUrl(path));
		heldPath = path;
	} catch {
		heldPath = path;
	}
}
