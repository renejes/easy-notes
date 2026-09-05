import { parse, stringify } from 'yaml';
import { parseManifestValue, type NotebookManifest } from './entry';

export function parseNotebookYaml(raw: string): NotebookManifest {
	return parseManifestValue(parse(raw));
}

export function serializeNotebookYaml(manifest: NotebookManifest): string {
	return stringify(
		{
			schema: 1,
			title: manifest.title,
			lang: manifest.lang,
			entries: manifest.entries
		},
		{ lineWidth: 0 }
	);
}
