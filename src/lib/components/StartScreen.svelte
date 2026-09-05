<script lang="ts">
	import { appState } from '$lib/appState.svelte';
	import { chooseShelfFolder, createNotebook, deleteNotebook, openNotebook, refreshShelf, renameNotebook } from '$lib/host/shelf';
	import { formatHostError } from '$lib/host/error';
	import { setPaperLines } from '$lib/host/settings';
	import { setLocale, t } from '$lib/i18n';
	import { appDialog } from '$lib/ui/dialog.svelte';

	let action = $state<'idle' | 'folder' | 'refresh' | 'create'>('idle');

	async function chooseFolder(): Promise<void> {
		appState.setError(null);
		action = 'folder';
		appState.setBusy(true);
		try {
			await chooseShelfFolder();
		} catch (error) {
			appState.setError(formatHostError(error, t('folderMissing')));
		} finally {
			appState.setBusy(false);
			action = 'idle';
		}
	}

	async function refresh(): Promise<void> {
		appState.setError(null);
		action = 'refresh';
		appState.setBusy(true);
		try {
			await refreshShelf();
		} catch (error) {
			appState.setError(formatHostError(error, t('folderMissing')));
		} finally {
			appState.setBusy(false);
			action = 'idle';
		}
	}

	async function addNotebook(): Promise<void> {
		const title = await appDialog.prompt(t('promptNotebook'));
		if (!title || title.trim().length === 0) {
			return;
		}
		appState.setError(null);
		action = 'create';
		appState.setBusy(true);
		try {
			const id = await createNotebook(title);
			await openNotebook(id);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		} finally {
			appState.setBusy(false);
			action = 'idle';
		}
	}

	async function open(id: string): Promise<void> {
		appState.setError(null);
		try {
			await openNotebook(id);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}

	async function rename(id: string, current: string): Promise<void> {
		const title = await appDialog.prompt(t('promptNotebook'), current);
		if (!title || title.trim().length === 0 || title.trim() === current) {
			return;
		}
		appState.setError(null);
		try {
			await renameNotebook(id, title);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}

	async function remove(id: string): Promise<void> {
		if (!(await appDialog.confirm(t('confirmDeleteNotebook')))) {
			return;
		}
		appState.setError(null);
		try {
			await deleteNotebook(id);
		} catch (error) {
			appState.setError(formatHostError(error, t('openFailed')));
		}
	}
</script>

<main class="start">
	<header>
		<svg class="logo" viewBox="0 0 32 32" width="48" height="48" aria-hidden="true" focusable="false">
			<rect width="32" height="32" fill="#111111" />
			<rect fill="#ffffff" x="8" y="4" width="16" height="24" />
			<g fill="none" stroke="#111111" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.4 10.4c.8-1.6 1.7.9 2.5-.4.8-1.2 1.4 1.1 2.3-.2.8-1.1 1.5.8 2.3-.3.7-.9 1.4.6 2.1-.1" />
				<path d="M10.4 15.2c1.1-1.4 1.9.8 2.9-.3.9-1 1.5 1 2.5-.2.8-.9 1.5.7 2.2-.2.6-.8 1.2.5 1.8 0" />
				<path d="M10.4 20.6c.9-1.2 1.6.7 2.5-.3.8-.9 1.3.8 2.1 0 .6-.6 1.1.4 1.6-.1" />
			</g>
			<rect fill="#FFE135" x="10.4" y="16.5" width="11.2" height="1.4" />
		</svg>
		<p class="kicker">{t('appName')}</p>
		<h1>{t('tagline')}</h1>
		{#if appState.shelfName}
			<p class="bound">{t('boundTo')}: {appState.shelfName}</p>
		{:else}
			<p class="hint">{t('libraryHint')}</p>
		{/if}
	</header>

	<div class="actions">
		{#if appState.shelfRoot}
			<button type="button" onclick={() => void addNotebook()} disabled={appState.busy}>
				{t('newNotebook')}
			</button>
			<button type="button" onclick={() => void refresh()} disabled={appState.busy}>
				{action === 'refresh' ? t('refreshing') : t('refreshShelf')}
			</button>
			<button type="button" onclick={() => void chooseFolder()} disabled={appState.busy}>
				{t('changeFolder')}
			</button>
		{:else}
			<button type="button" onclick={() => void chooseFolder()} disabled={appState.busy}>
				{action === 'folder' ? t('refreshing') : t('chooseFolder')}
			</button>
		{/if}
	</div>

	{#if appState.lastError}
		<p class="error">{appState.lastError}</p>
	{/if}

	{#if appState.shelfRoot}
		<section>
			<h2>{t('recent')}</h2>
			{#if appState.notebooks.length === 0}
				<p class="muted">{t('noRecent')}</p>
			{:else}
				<ul>
					{#each appState.notebooks as notebook (notebook.id)}
						<li>
							<button type="button" class="file" onclick={() => void open(notebook.id)}>
								<span>{notebook.title}</span>
								<span class="muted">{notebook.entryCount} {t('entryCount')}</span>
							</button>
							<div class="row-actions">
								<button type="button" onclick={() => void rename(notebook.id, notebook.title)}>
									{t('rename')}
								</button>
								<button type="button" onclick={() => void remove(notebook.id)}>{t('delete')}</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<footer>
		<label>
			{t('language')}
			<select
				value={appState.locale}
				onchange={(event) => {
					const value = event.currentTarget.value;
					if (value === 'de' || value === 'en') {
						setLocale(value);
					}
				}}
			>
				<option value="de">{t('german')}</option>
				<option value="en">{t('english')}</option>
			</select>
		</label>
		<label>
			<input
				type="checkbox"
				checked={appState.paperLines}
				onchange={(event) => setPaperLines(event.currentTarget.checked)}
			/>
			{t('paperLines')}
		</label>
	</footer>
</main>

<style>
	.start {
		height: var(--app-height, 100dvh);
		overflow: auto;
		max-width: 42rem;
		margin: 0 auto;
		padding: max(12vh, calc(env(safe-area-inset-top, 0px) + 2rem))
			max(1.5rem, env(safe-area-inset-right, 0px)) max(3rem, env(safe-area-inset-bottom, 0px))
			max(1.5rem, env(safe-area-inset-left, 0px));
		display: flex;
		flex-direction: column;
		gap: 2rem;
		transform: translateY(var(--app-offset, 0px));
	}

	.kicker {
		margin: 0 0 0.4rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.8rem;
	}

	.logo {
		display: block;
		width: 2.75rem;
		height: 2.75rem;
		margin: 0 0 1rem;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.bound,
	.hint {
		margin: 0.8rem 0 0;
		max-width: 36rem;
		line-height: 1.45;
	}

	.hint {
		color: var(--muted);
	}

	h2 {
		margin: 0 0 0.8rem;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.error {
		margin: 0;
		border: 1px solid var(--line);
		padding: 0.6rem 0.8rem;
	}

	.muted {
		color: var(--muted);
	}

	ul {
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
		border-color: var(--hairline);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: stretch;
	}

	.file span:last-child {
		font-size: 0.75rem;
	}

	footer {
		margin-top: auto;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		align-items: center;
	}

	select {
		margin-left: 0.5rem;
	}

	footer label:last-child {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
</style>
