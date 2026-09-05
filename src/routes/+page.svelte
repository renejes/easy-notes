<script lang="ts">
	import { appState } from '$lib/appState.svelte';
	import EntryCanvas from '$lib/components/EntryCanvas.svelte';
	import NotebookShell from '$lib/components/NotebookShell.svelte';
	import StartScreen from '$lib/components/StartScreen.svelte';
	import { chooseShelfFolder } from '$lib/host/shelf';
	import { formatHostError } from '$lib/host/error';
	import { t } from '$lib/i18n';

	async function onKeydown(event: KeyboardEvent): Promise<void> {
		if (appState.openNotebook) {
			return;
		}
		const mod = event.metaKey || event.ctrlKey;
		if (!mod || event.key !== 'o') {
			return;
		}
		event.preventDefault();
		appState.setBusy(true);
		try {
			await chooseShelfFolder();
		} catch (error) {
			appState.setError(formatHostError(error, t('folderMissing')));
		} finally {
			appState.setBusy(false);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if appState.openEntry && appState.openNotebook}
	{#key `${appState.openEntry.notebookId}:${appState.openEntry.fileName}`}
		<EntryCanvas notebookId={appState.openEntry.notebookId} fileName={appState.openEntry.fileName} />
	{/key}
{:else if appState.openNotebook}
	<NotebookShell notebookId={appState.openNotebook.id} />
{:else}
	<StartScreen />
{/if}
