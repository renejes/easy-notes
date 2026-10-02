import { serializeEntry, type NoteEntry } from './entry';
import SerializeWorker from './serialize.worker.ts?worker';

type SerializeResponse = {
	id: number;
	json: string;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (json: string) => void>();

function workerOrNull(): Worker | null {
	if (worker) {
		return worker;
	}
	try {
		const next = new SerializeWorker();
		next.onmessage = (event: MessageEvent<SerializeResponse>) => {
			const resolve = pending.get(event.data.id);
			if (!resolve) {
				return;
			}
			pending.delete(event.data.id);
			resolve(event.data.json);
		};
		next.onerror = () => {
			worker = null;
			for (const resolve of pending.values()) {
				resolve('');
			}
			pending.clear();
		};
		worker = next;
		return next;
	} catch {
		return null;
	}
}

/** Stringify off the UI thread. Falls back to the main thread if workers are unavailable. */
export function serializeEntryOffThread(entry: NoteEntry): Promise<string> {
	const current = workerOrNull();
	if (!current) {
		return Promise.resolve(serializeEntry(entry));
	}
	const id = seq + 1;
	seq = id;
	return new Promise((resolve) => {
		pending.set(id, (json) => {
			resolve(json.length > 0 ? json : serializeEntry(entry));
		});
		try {
			current.postMessage({ id, entry });
		} catch {
			pending.delete(id);
			resolve(serializeEntry(entry));
		}
	});
}
