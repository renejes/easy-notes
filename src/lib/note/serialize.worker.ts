/// <reference lib="webworker" />
import { serializeEntry, type NoteEntry } from './entry';

type SerializeRequest = {
	id: number;
	entry: NoteEntry;
};

self.onmessage = (event: MessageEvent<SerializeRequest>) => {
	const json = serializeEntry(event.data.entry);
	self.postMessage({ id: event.data.id, json });
};
