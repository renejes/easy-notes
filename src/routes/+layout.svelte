<script lang="ts">
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/400-italic.css';
	import '@fontsource/ibm-plex-mono/700.css';
	import '@fontsource/ibm-plex-mono/700-italic.css';
	import '../app.css';
	import AppDialog from '$lib/components/AppDialog.svelte';
	import { appState } from '$lib/appState.svelte';
	import { loadShelf } from '$lib/host/shelf';
	import { loadAppSettings, persistAppSettings } from '$lib/host/settings';
	import { t } from '$lib/i18n';
	import { onMount, type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	function syncAppViewport(): void {
		const viewport = window.visualViewport;
		const height = viewport?.height ?? window.innerHeight;
		const offset = viewport?.offsetTop ?? 0;
		document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
		document.documentElement.style.setProperty('--app-offset', `${Math.round(offset)}px`);
	}

	onMount(() => {
		syncAppViewport();
		const viewport = window.visualViewport;
		viewport?.addEventListener('resize', syncAppViewport);
		viewport?.addEventListener('scroll', syncAppViewport);
		window.addEventListener('resize', syncAppViewport);
		void (async () => {
			const settings = await loadAppSettings();
			if (settings) {
				appState.setLocale(settings.locale);
				appState.setShelf(settings.shelfRoot, settings.shelfName);
			} else {
				await persistAppSettings();
			}
			document.documentElement.lang = appState.locale === 'de' ? 'de' : 'en';
			await loadShelf();
		})();
		return () => {
			viewport?.removeEventListener('resize', syncAppViewport);
			viewport?.removeEventListener('scroll', syncAppViewport);
			window.removeEventListener('resize', syncAppViewport);
		};
	});

	$effect(() => {
		document.documentElement.lang = appState.locale === 'de' ? 'de' : 'en';
	});
</script>

<svelte:head>
	<title>{t('appName')}</title>
</svelte:head>

{@render children()}
<AppDialog />
