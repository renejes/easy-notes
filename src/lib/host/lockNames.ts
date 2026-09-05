export const LOCK_FILE_NAME = 'easy-notes.lock.json';

export function isLockSidecarName(name: string): boolean {
	return name.toLowerCase() === LOCK_FILE_NAME;
}
