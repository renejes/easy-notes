<script lang="ts">
	import { onDestroy } from 'svelte';
	import { appState } from '$lib/appState.svelte';
	import { closeNotebook, createEntry, deleteEntry, deleteNotebook, renameEntry, renameNotebook } from '$lib/host/shelf';
	import { writeLock, LOCK_HEARTBEAT_MS } from '$lib/host/lock';
	import { joinPath } from '$lib/host/files';
	import { formatHostError } from '$lib/host/error';
	import { t } from '$lib/i18n';
	import { appDialog } from '$lib/ui/dialog.svelte';

	let { notebookId }: { notebookId: string } = $props();

	const notebook = $derived(appState.openNotebook);
	let heartbeat: number | undefined;

	$effect(() => {
		void notebookId;
		if (heartbeat !== undefined) {
			window.clearInterval(heartbeat);
		}
		heartbeat = window.setInterval(() => {
			const open = appState.openNotebook;
			const root = appState.shelfRoot;
			if (!open || !root || open.lockWarning) {
				return;
			}
			void joinPath(root, open.id).then((folder) => writeLock(folder));
		}, LOCK_HEARTBEAT_MS);
		return () => {
			if (heartbeat !== undefined) {
				window.clearInterval(heartbeat);
			}
		};
	});

	onDestroy(() => {
		if (heartbeat !== undefined) {
			window.clearInterval(heartbeat);
		}
	});

	async function back(): Promise<void> {
		await closeNotebook();
	}

	async function addEntry(): Promise<void> {
		const title = await appDialog.prompt(t('promptEntry'), t('untitledEntry'));
		if (title === null) {
			return;
		}
		try {
			const fileName = await createEntry(title);
			appState.setOpenEntry({ notebookId, fileName });
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}

	async function renameHeft(): Promise<void> {
		const current = notebook?.title ?? '';
		const title = await appDialog.prompt(t('promptNotebook'), current);
		if (!title || title.trim().length === 0 || title.trim() === current) {
			return;
		}
		try {
			await renameNotebook(notebookId, title);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}

	async function removeHeft(): Promise<void> {
		if (!(await appDialog.confirm(t('confirmDeleteNotebook')))) {
			return;
		}
		try {
			await deleteNotebook(notebookId);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}

	function openEntry(fileName: string): void {
		appState.setOpenEntry({ notebookId, fileName });
	}

	async function renamePage(fileName: string): Promise<void> {
		const current = notebook?.entryTitles[fileName] ?? '';
		const title = await appDialog.prompt(t('promptEntry'), current);
		if (!title || title.trim().length === 0 || title.trim() === current) {
			return;
		}
		try {
			await renameEntry(notebookId, fileName, title);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}

	async function removePage(fileName: string): Promise<void> {
		if (!(await appDialog.confirm(t('confirmDeleteEntry')))) {
			return;
		}
		try {
			await deleteEntry(notebookId, fileName);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}

	function labelFor(fileName: string, index: number): string {
		const title = notebook?.entryTitles[fileName]?.trim();
		if (title) {
			return title;
		}
		return `${t('untitledEntry')} ${index + 1}`;
	}
</script>

<section class="notebook">
	<header>
		<button type="button" onclick={() => void back()}>{t('back')}</button>
		<h1>{notebook?.title ?? t('untitled')}</h1>
		<button type="button" onclick={() => void renameHeft()}>{t('rename')}</button>
		<button type="button" onclick={() => void removeHeft()}>{t('delete')}</button>
		<button type="button" onclick={() => void addEntry()}>{t('newEntry')}</button>
	</header>

	{#if notebook?.lockWarning}
		<p class="error">{notebook.lockWarning}</p>
	{/if}

	{#if appState.lastError}
		<p class="error">{appState.lastError}</p>
	{/if}

	{#if !notebook || notebook.entries.length === 0}
		<p class="muted">{t('noEntries')}</p>
	{:else}
		<ol>
			{#each notebook.entries as fileName, index (fileName)}
				<li>
					<button type="button" class="file" onclick={() => openEntry(fileName)}>
						<span class="num">{index + 1}</span>
						<span>{labelFor(fileName, index)}</span>
					</button>
					<div class="row-actions">
						<button type="button" onclick={() => void renamePage(fileName)}>{t('rename')}</button>
						<button type="button" onclick={() => void removePage(fileName)}>{t('delete')}</button>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.notebook {
		height: var(--app-height, 100dvh);
		overflow: auto;
		max-width: 42rem;
		margin: 0 auto;
		padding: max(0.75rem, env(safe-area-inset-top, 0px)) max(1.5rem, env(safe-area-inset-right, 0px))
			max(1.5rem, env(safe-area-inset-bottom, 0px)) max(1.5rem, env(safe-area-inset-left, 0px));
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		transform: translateY(var(--app-offset, 0px));
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	h1 {
		margin: 0;
		flex: 1;
		font-size: 1.1rem;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: stretch;
	}

	.file {
		min-width: 0;
		flex: 1;
		text-align: left;
		display: flex;
		gap: 0.8rem;
		border-color: var(--hairline);
	}

	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: stretch;
	}

	.num {
		color: var(--muted);
		min-width: 2rem;
	}

	.error {
		margin: 0;
		border: 1px solid var(--line);
		padding: 0.6rem 0.8rem;
	}

	.muted {
		color: var(--muted);
		margin: 0;
	}
</style>
