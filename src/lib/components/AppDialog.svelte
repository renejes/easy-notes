<script lang="ts">
	import { t } from '$lib/i18n';
	import { appDialog } from '$lib/ui/dialog.svelte';

	function onKeydown(event: KeyboardEvent): void {
		if (!appDialog.current || event.key !== 'Escape') {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		appDialog.cancel();
	}

	function onSubmit(event: SubmitEvent): void {
		event.preventDefault();
		appDialog.submit();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if appDialog.current}
	<div class="scrim">
		<form class="dialog" onsubmit={onSubmit}>
			<p>{appDialog.current.message}</p>
			{#if appDialog.current.kind === 'prompt'}
				<input bind:value={appDialog.inputValue} />
			{/if}
			<div class="actions">
				<button type="button" onclick={() => appDialog.cancel()}>{t('cancel')}</button>
				<button type="submit">{t('ok')}</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		left: 0;
		right: 0;
		top: var(--app-offset, 0px);
		height: var(--app-height, 100dvh);
		z-index: 40;
		background: rgb(255 255 255 / 0.92);
		display: grid;
		place-items: center;
		padding: max(1.5rem, env(safe-area-inset-top, 0px)) max(1.5rem, env(safe-area-inset-right, 0px))
			max(1.5rem, env(safe-area-inset-bottom, 0px)) max(1.5rem, env(safe-area-inset-left, 0px));
	}

	.dialog {
		width: min(28rem, 100%);
		border: 1px solid var(--line);
		background: var(--bg);
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dialog p {
		margin: 0;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
	}
</style>
