export function formatHostError(error: unknown, fallback: string): string {
	if (typeof error === 'string' && error.trim().length > 0) {
		return error;
	}
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	if (typeof error === 'object' && error !== null) {
		const record = error as Record<string, unknown>;
		if (typeof record.message === 'string' && record.message.trim().length > 0) {
			return record.message;
		}
	}
	return fallback;
}
