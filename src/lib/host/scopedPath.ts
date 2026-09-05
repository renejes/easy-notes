export const SCOPED_PREFIX = 'scoped:';

const displayNames = new Map<string, string>();
const folderUris = new Map<string, string>();

export function toScopedRoot(id: string, name?: string, uri?: string): string {
	if (name && name.length > 0) {
		displayNames.set(id, name);
	}
	if (uri && uri.length > 0) {
		folderUris.set(id, uri);
	}
	return `${SCOPED_PREFIX}${id}`;
}

export function scopedUri(id: string): string | undefined {
	return folderUris.get(id);
}

export function isScopedPath(path: string): boolean {
	return path.startsWith(SCOPED_PREFIX);
}

export function parseScopedPath(path: string): { id: string; rel: string } | null {
	if (!path.startsWith(SCOPED_PREFIX)) {
		return null;
	}
	const rest = path.slice(SCOPED_PREFIX.length);
	const slash = rest.indexOf('/');
	if (slash === -1) {
		return { id: rest, rel: '' };
	}
	return { id: rest.slice(0, slash), rel: rest.slice(slash + 1) };
}

export function scopedDisplayName(id: string): string {
	return displayNames.get(id) ?? id;
}

export function joinScoped(root: string, ...parts: string[]): string {
	const parsed = parseScopedPath(root);
	if (!parsed) {
		return [root, ...parts].filter((part) => part.length > 0).join('/');
	}
	const extra = parts.filter((part) => part.length > 0).join('/');
	const rel = [parsed.rel, extra].filter((part) => part.length > 0).join('/');
	return rel.length > 0 ? `${SCOPED_PREFIX}${parsed.id}/${rel}` : `${SCOPED_PREFIX}${parsed.id}`;
}

export function scopedFileName(path: string): string {
	const parsed = parseScopedPath(path);
	if (!parsed) {
		const normalized = path.replace(/\/+$/, '');
		const index = normalized.lastIndexOf('/');
		return index === -1 ? normalized : normalized.slice(index + 1);
	}
	if (parsed.rel.length === 0) {
		return scopedDisplayName(parsed.id);
	}
	const index = parsed.rel.lastIndexOf('/');
	return index === -1 ? parsed.rel : parsed.rel.slice(index + 1);
}

export function fileNameOfPath(path: string): string {
	const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
	const index = normalized.lastIndexOf('/');
	return index === -1 ? normalized : normalized.slice(index + 1);
}

export function dirOfRel(rel: string): string {
	const normalized = rel.replace(/\\/g, '/');
	const index = normalized.lastIndexOf('/');
	return index === -1 ? '' : normalized.slice(0, index);
}

export function splitRelative(relativePath: string): string[] {
	return relativePath.split(/[/\\]/).filter((part) => part.length > 0);
}
