<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { on } from 'svelte/events';
	import { appState } from '$lib/appState.svelte';
	import {
		drawPaper,
		drawStrokes,
		isInkPointer,
		pointerToPoint,
		predictedPoints,
		strokePointers
	} from '$lib/ink/draw';
	import {
		MARKER_COLORS,
		MARKER_WIDTH,
		PAGE_GROW_PAD,
		PAGE_MIN_HEIGHT,
		PAGE_WIDTH,
		PENCIL_COLOR,
		PENCIL_WIDTH,
		appendInkPoint,
		compactStroke,
		eraseAlong,
		newStroke,
		strokeBoundsHeight,
		type InkPoint,
		type Stroke
	} from '$lib/ink/types';
	import {
		attachInkOverlay,
		detachInkOverlay,
		overlayFrameFor,
		setInkTool,
		updateInkOverlay,
		type InkOverlayTool
	} from '$lib/host/inkOverlay';
	import { setPaperLines } from '$lib/host/settings';
	import { recognizeHandwriting } from '$lib/host/ocr';
	import { formatHostError } from '$lib/host/error';
	import { readEntry, writeEntry, writeEntryMarkdown } from '$lib/host/shelf';
	import { t, type MessageKey } from '$lib/i18n';
	import { appDialog } from '$lib/ui/dialog.svelte';
	import type { NoteEntry } from '$lib/note/entry';

	let { notebookId, fileName }: { notebookId: string; fileName: string } = $props();

	type DeskTool = 'pencil' | 'marker' | 'eraser' | 'flip';

	const MARKERS: { color: (typeof MARKER_COLORS)[number]; label: MessageKey }[] = [
		{ color: MARKER_COLORS[0], label: 'markerYellow' },
		{ color: MARKER_COLORS[1], label: 'markerPink' },
		{ color: MARKER_COLORS[2], label: 'markerOrange' }
	];

	let paperCanvas: HTMLCanvasElement | undefined = $state();
	let inkCanvas: HTMLCanvasElement | undefined = $state();
	let liveCanvas: HTMLCanvasElement | undefined = $state();
	let pageEl: HTMLDivElement | undefined = $state();
	let deskTool = $state<DeskTool | null>(null);
	let markerColor = $state<(typeof MARKER_COLORS)[number]>(MARKER_COLORS[0]);
	let entry = $state<NoteEntry | null>(null);
	let scale = $state(1);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let currentStroke: Stroke | null = null;
	let lastErasePoint: InkPoint | null = null;
	let activePointerId: number | null = null;
	let saveTimer: number | undefined;
	let asTextOpen = $state(false);
	let asTextBusy = $state(false);
	let asTextBody = $state('');
	let asTextNotice = $state<string | null>(null);
	let extraHeight = $state(0);
	let overlayLive = $state(false);
	let pencilSeen = $state(false);
	let nativePending = $state(0);

	const drawing = $derived(
		deskTool === 'pencil' || deskTool === 'marker' || deskTool === 'eraser'
	);
	const wantsNativeInk = $derived(
		pencilSeen && (deskTool === 'pencil' || deskTool === 'marker')
	);
	const overlayPaused = $derived(appDialog.current !== null || asTextOpen);
	const nativeOwnsInk = $derived(overlayLive && !overlayPaused);
	const strokes = $derived(entry?.strokes ?? []);
	const canEditInk = $derived(strokes.length > 0);
	const pageHeight = $derived(
		Math.max(extraHeight, entry ? strokeBoundsHeight(entry.strokes) : PAGE_MIN_HEIGHT)
	);

	async function persist(): Promise<void> {
		if (!entry) {
			return;
		}
		await writeEntry(notebookId, fileName, entry);
	}

	function scheduleSave(): void {
		if (saveTimer !== undefined) {
			window.clearTimeout(saveTimer);
		}
		saveTimer = window.setTimeout(() => {
			void persist();
		}, 400);
	}

	function sizeSurfaces(width: number, height: number): void {
		if (!paperCanvas || !inkCanvas || !liveCanvas) {
			return;
		}
		paperCanvas.width = width;
		paperCanvas.height = height;
		inkCanvas.width = width;
		inkCanvas.height = height;
		liveCanvas.width = width;
		liveCanvas.height = height;
		const ctx = paperCanvas.getContext('2d');
		if (ctx) {
			drawPaper(ctx, width, height, scale, appState.paperLines);
		}
	}

	function liveContext(): CanvasRenderingContext2D | null {
		if (!liveCanvas) {
			return null;
		}
		return liveCanvas.getContext('2d', { desynchronized: true, alpha: true });
	}

	function clearLive(): void {
		const ctx = liveContext();
		if (!ctx || !liveCanvas) {
			return;
		}
		ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
	}

	function paintLive(stroke: Stroke, extra: InkPoint[] = []): void {
		const ctx = liveContext();
		if (!ctx || !liveCanvas) {
			return;
		}
		ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
		const preview = extra.length === 0 ? stroke : { ...stroke, points: [...stroke.points, ...extra] };
		drawStrokes(ctx, [preview], scale);
	}

	function redrawInk(): void {
		if (!inkCanvas) {
			return;
		}
		const ctx = inkCanvas.getContext('2d');
		if (!ctx) {
			return;
		}
		ctx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
		const skip = overlayLive && !overlayPaused ? nativePending : 0;
		const shown = skip > 0 ? strokes.slice(0, Math.max(0, strokes.length - skip)) : strokes;
		drawStrokes(ctx, shown, scale);
	}

	function layoutPage(): void {
		if (!paperCanvas || !pageEl || !entry) {
			return;
		}
		const maxWidth = Math.max(320, pageEl.clientWidth - 2);
		scale = Math.min(2, maxWidth / Math.max(1, entry.page.width || PAGE_WIDTH));
		const pixelWidth = Math.max(320, Math.round((entry.page.width || PAGE_WIDTH) * scale));
		const pixelHeight = Math.max(1, Math.round(pageHeight * scale));
		sizeSurfaces(pixelWidth, pixelHeight);
		redrawInk();
	}

	function growIfNeeded(point: InkPoint): void {
		const needed = Math.max(PAGE_MIN_HEIGHT, point.y + PAGE_GROW_PAD);
		if (needed <= extraHeight) {
			return;
		}
		extraHeight = needed;
		layoutPage();
	}

	function blockTouchDefault(canvas: HTMLCanvasElement): () => void {
		const block = (event: Event) => {
			event.preventDefault();
		};
		return on(canvas, 'touchmove', block, { capture: true, passive: false });
	}

	async function load(id: string, name: string, cancelled: () => boolean): Promise<void> {
		loading = true;
		error = null;
		try {
			const loaded = await readEntry(id, name);
			if (cancelled()) {
				return;
			}
			entry = loaded;
			extraHeight = 0;
			layoutPage();
		} catch (caught) {
			if (!cancelled()) {
				error = formatHostError(caught, t('openFailed'));
			}
		} finally {
			if (!cancelled()) {
				loading = false;
			}
		}
	}

	$effect(() => {
		const id = notebookId;
		const name = fileName;
		let cancelled = false;
		untrack(() => {
			void load(id, name, () => cancelled);
		});
		return () => {
			cancelled = true;
			void persist();
		};
	});

	$effect(() => {
		void pageEl;
		void entry;
		void loading;
		void appState.paperLines;
		if (!loading && entry) {
			untrack(() => layoutPage());
		}
	});

	$effect(() => {
		const onResize = () => layoutPage();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	$effect(() => {
		const markPencil = (event: PointerEvent) => {
			if (event.pointerType === 'pen') {
				pencilSeen = true;
			}
		};
		window.addEventListener('pointerdown', markPencil, true);
		window.addEventListener('pointermove', markPencil, true);
		return () => {
			window.removeEventListener('pointerdown', markPencil, true);
			window.removeEventListener('pointermove', markPencil, true);
		};
	});

	$effect(() => {
		if (!wantsNativeInk || loading || !inkCanvas || !pageEl) {
			untrack(() => {
				nativePending = 0;
				overlayLive = false;
				layoutPage();
			});
			void detachInkOverlay();
			return;
		}
		const canvas = inkCanvas;
		const clip = pageEl;
		const width = untrack(() => entry?.page.width || PAGE_WIDTH);
		const tool = untrack(() => overlayTool());
		let cancelled = false;
		void tick()
			.then(async () => {
				if (cancelled) {
					return false;
				}
				await attachInkOverlay(overlayFrameFor(canvas, clip, width), tool, addNativeStroke);
				return true;
			})
			.then((attachedOk) => {
				if (cancelled || !attachedOk) {
					return;
				}
				untrack(() => {
					nativePending = 0;
					overlayLive = true;
				});
			})
			.catch(() => {
				if (!cancelled) {
					untrack(() => {
						overlayLive = false;
					});
				}
			});
		return () => {
			cancelled = true;
			untrack(() => {
				nativePending = 0;
				overlayLive = false;
				layoutPage();
			});
			void detachInkOverlay();
		};
	});

	$effect(() => {
		if (!overlayLive) {
			return;
		}
		const tool = overlayPaused
			? { kind: 'off' as const, color: markerColor, width: PENCIL_WIDTH }
			: overlayTool();
		void setInkTool(tool);
	});

	$effect(() => {
		if (!overlayLive || !inkCanvas || !pageEl) {
			return;
		}
		void pageHeight;
		const canvas = inkCanvas;
		const clip = pageEl;
		const width = untrack(() => entry?.page.width || PAGE_WIDTH);
		const sync = (): void => {
			void updateInkOverlay(overlayFrameFor(canvas, clip, width));
		};
		const stopScroll = on(clip, 'scroll', sync, { passive: true });
		window.addEventListener('resize', sync);
		window.visualViewport?.addEventListener('resize', sync);
		window.visualViewport?.addEventListener('scroll', sync);
		sync();
		return () => {
			stopScroll();
			window.removeEventListener('resize', sync);
			window.visualViewport?.removeEventListener('resize', sync);
			window.visualViewport?.removeEventListener('scroll', sync);
		};
	});

	onDestroy(() => {
		if (saveTimer !== undefined) {
			window.clearTimeout(saveTimer);
		}
		void detachInkOverlay();
		void persist();
	});

	function closeEntry(): void {
		appState.setOpenEntry(null);
	}

	function selectDeskTool(next: DeskTool): void {
		deskTool = deskTool === next ? null : next;
	}

	function overlayTool(): InkOverlayTool {
		switch (deskTool) {
			case 'pencil':
				return { kind: 'pencil', color: PENCIL_COLOR, width: PENCIL_WIDTH };
			case 'marker':
				return { kind: 'marker', color: markerColor, width: MARKER_WIDTH };
			case null:
			case 'eraser':
			case 'flip':
				return { kind: 'off', color: markerColor, width: PENCIL_WIDTH };
			default: {
				const _exhaustive: never = deskTool;
				return _exhaustive;
			}
		}
	}

	function addNativeStroke(stroke: Stroke): void {
		if (!entry) {
			return;
		}
		nativePending += 1;
		const last = stroke.points[stroke.points.length - 1];
		if (last) {
			growIfNeeded(last);
		}
		entry = { ...entry, strokes: [...entry.strokes, stroke] };
		scheduleSave();
	}

	function selectMarker(color: (typeof MARKER_COLORS)[number]): void {
		if (deskTool === 'marker' && markerColor === color) {
			deskTool = null;
			return;
		}
		markerColor = color;
		deskTool = 'marker';
	}

	function setStrokes(next: Stroke[]): void {
		if (!entry) {
			return;
		}
		entry = { ...entry, strokes: next };
		scheduleSave();
		layoutPage();
	}

	function onPointerDown(event: PointerEvent): void {
		if (!inkCanvas) {
			return;
		}
		switch (deskTool) {
			case null:
			case 'flip':
				return;
			case 'pencil':
			case 'marker': {
				if (nativeOwnsInk) {
					return;
				}
				event.preventDefault();
				if (!isInkPointer(event) || activePointerId !== null) {
					return;
				}
				activePointerId = event.pointerId;
				inkCanvas.setPointerCapture(event.pointerId);
				currentStroke = newStroke(deskTool, markerColor);
				appendInkPoint(currentStroke.points, pointerToPoint(event, inkCanvas, scale));
				paintLive(currentStroke);
				return;
			}
			case 'eraser': {
				event.preventDefault();
				if (!isInkPointer(event) || activePointerId !== null) {
					return;
				}
				activePointerId = event.pointerId;
				inkCanvas.setPointerCapture(event.pointerId);
				const point = pointerToPoint(event, inkCanvas, scale);
				lastErasePoint = point;
				setStrokes(eraseAlong(strokes, point, point));
				return;
			}
			default: {
				const _exhaustive: never = deskTool;
				return _exhaustive;
			}
		}
	}

	function onPointerMove(event: PointerEvent): void {
		if (!inkCanvas || event.pointerId !== activePointerId) {
			return;
		}
		switch (deskTool) {
			case null:
			case 'flip':
				return;
			case 'eraser': {
				event.preventDefault();
				if (!lastErasePoint) {
					return;
				}
				let from = lastErasePoint;
				let next = strokes;
				for (const pointer of strokePointers(event)) {
					const point = pointerToPoint(pointer, inkCanvas, scale);
					next = eraseAlong(next, from, point);
					from = point;
				}
				lastErasePoint = from;
				setStrokes(next);
				return;
			}
			case 'pencil':
			case 'marker': {
				event.preventDefault();
				if (!currentStroke) {
					return;
				}
				for (const pointer of strokePointers(event)) {
					const point = pointerToPoint(pointer, inkCanvas, scale);
					appendInkPoint(currentStroke.points, point);
					growIfNeeded(point);
				}
				paintLive(currentStroke, predictedPoints(event, inkCanvas, scale));
				return;
			}
			default: {
				const _exhaustive: never = deskTool;
				return _exhaustive;
			}
		}
	}

	function commitStroke(event: PointerEvent): void {
		if (activePointerId !== null && event.pointerId !== activePointerId) {
			return;
		}
		if (inkCanvas && activePointerId !== null) {
			try {
				inkCanvas.releasePointerCapture(activePointerId);
			} catch {
				// Capture already released on pointercancel / pointerup.
			}
		}
		activePointerId = null;
		lastErasePoint = null;
		if (!currentStroke || !entry) {
			clearLive();
			return;
		}
		const compacted = compactStroke(currentStroke);
		currentStroke = null;
		if (compacted) {
			entry = { ...entry, strokes: [...entry.strokes, compacted] };
			scheduleSave();
		}
		clearLive();
		layoutPage();
	}

	function undo(): void {
		if (!canEditInk) {
			return;
		}
		if (overlayLive && nativePending > 0) {
			nativePending -= 1;
			void setInkTool(overlayTool(), 'pop');
		}
		setStrokes(strokes.slice(0, -1));
	}

	function commitLiveInk(): void {
		nativePending = 0;
		layoutPage();
	}

	async function pauseOverlayForDialog(): Promise<void> {
		if (!overlayLive) {
			return;
		}
		commitLiveInk();
		await setInkTool({ kind: 'off', color: markerColor, width: PENCIL_WIDTH });
	}

	async function clearSheet(): Promise<void> {
		if (!canEditInk) {
			return;
		}
		await pauseOverlayForDialog();
		if (!(await appDialog.confirm(t('confirmClear')))) {
			return;
		}
		setStrokes([]);
	}

	async function openAsText(): Promise<void> {
		await pauseOverlayForDialog();
		asTextNotice = null;
		asTextOpen = true;
		asTextBusy = true;
		asTextBody = '';
		try {
			const result = await recognizeHandwriting(strokes, entry?.page.width ?? PAGE_WIDTH);
			asTextBody = result.text;
		} catch (caught) {
			asTextNotice = formatHostError(caught, t('recognizeFailed'));
		} finally {
			asTextBusy = false;
		}
	}

	async function saveAsText(): Promise<void> {
		if (!entry) {
			return;
		}
		try {
			await writeEntryMarkdown(
				notebookId,
				fileName,
				entry.title,
				appState.openNotebook?.title ?? t('untitled'),
				asTextBody
			);
			asTextNotice = t('savedMarkdown');
		} catch (caught) {
			asTextNotice = formatHostError(caught, t('openFailed'));
		}
	}

	async function copyAsText(): Promise<void> {
		try {
			await navigator.clipboard.writeText(asTextBody);
			asTextNotice = t('copied');
		} catch {
			asTextNotice = t('openFailed');
		}
	}
</script>

<section class="reader">
	<header>
		<button type="button" onclick={closeEntry}>{t('back')}</button>
		<p>{appState.openNotebook?.title ?? t('untitled')} · {entry?.title ?? fileName}</p>
		<div class="tools">
			<button type="button" class:active={deskTool === 'pencil'} onclick={() => selectDeskTool('pencil')}>
				{t('draw')}
			</button>
			{#each MARKERS as marker (marker.color)}
				<button
					type="button"
					class="swatch"
					class:active={deskTool === 'marker' && markerColor === marker.color}
					style:background={marker.color}
					title={t(marker.label)}
					aria-label={t(marker.label)}
					onclick={() => selectMarker(marker.color)}
				></button>
			{/each}
			<button type="button" class:active={deskTool === 'eraser'} onclick={() => selectDeskTool('eraser')}>
				{t('eraser')}
			</button>
			<button type="button" class:active={deskTool === 'flip'} onclick={() => selectDeskTool('flip')}>
				{t('flip')}
			</button>
			<button
				type="button"
				class:active={appState.paperLines}
				aria-pressed={appState.paperLines}
				onclick={() => setPaperLines(!appState.paperLines)}
			>
				{t('paperLines')}
			</button>
			<button type="button" onclick={undo} disabled={!canEditInk}>{t('undoStroke')}</button>
			<button type="button" onclick={() => void clearSheet()} disabled={!canEditInk}>{t('clearSheet')}</button>
			<button type="button" onclick={() => void openAsText()} disabled={!canEditInk}>{t('asText')}</button>
		</div>
	</header>

	{#if error}
		<p class="error">{error}</p>
	{:else if loading}
		<p class="muted">{t('opening')}</p>
	{/if}

	<div class="stage">
		<div class="page" bind:this={pageEl}>
			<canvas bind:this={paperCanvas}></canvas>
			<canvas
				bind:this={inkCanvas}
				class="ink"
				class:passthrough={!drawing || nativeOwnsInk}
				{@attach drawing && !nativeOwnsInk && blockTouchDefault}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={commitStroke}
				onpointercancel={commitStroke}
				oncontextmenu={(event) => event.preventDefault()}
			></canvas>
			<canvas bind:this={liveCanvas} class="ink live"></canvas>
		</div>
	</div>
</section>

{#if asTextOpen}
	<div class="scrim">
		<form
			class="dialog"
			onsubmit={(event) => {
				event.preventDefault();
				void saveAsText();
			}}
		>
			<p>{t('textHint')}</p>
			{#if asTextBusy}
				<p class="muted">{t('recognizing')}</p>
			{:else}
				<textarea bind:value={asTextBody} rows="12"></textarea>
			{/if}
			{#if asTextNotice}
				<p class="muted">{asTextNotice}</p>
			{/if}
			<div class="actions">
				<button type="button" onclick={() => (asTextOpen = false)}>{t('cancel')}</button>
				<button type="button" onclick={() => void copyAsText()} disabled={asTextBusy}>{t('copyText')}</button>
				<button type="submit" disabled={asTextBusy}>{t('saveText')}</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.reader {
		height: var(--app-height, 100dvh);
		display: flex;
		flex-direction: column;
		transform: translateY(var(--app-offset, 0px));
		padding: max(0.75rem, env(safe-area-inset-top, 0px)) max(0.75rem, env(safe-area-inset-right, 0px))
			max(0.75rem, env(safe-area-inset-bottom, 0px)) max(0.75rem, env(safe-area-inset-left, 0px));
		gap: 0.75rem;
	}

	header {
		position: relative;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	header p {
		margin: 0;
		flex: 1;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.swatch {
		width: 2.75rem;
		min-width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		border: 1px solid var(--line);
	}

	.swatch.active {
		outline: 2px solid var(--fg);
		outline-offset: 2px;
	}

	.stage {
		flex: 1;
		min-height: 0;
	}

	.page {
		position: relative;
		height: 100%;
		overflow: auto;
		border: 1px solid var(--line);
		background: var(--bg);
		display: grid;
		place-items: start center;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	canvas {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.ink {
		position: absolute;
		left: 50%;
		top: 0;
		transform: translateX(-50%);
		touch-action: none;
	}

	.ink.passthrough {
		pointer-events: none;
	}

	.ink.live {
		pointer-events: none;
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

	.scrim {
		position: fixed;
		left: 0;
		right: 0;
		top: var(--app-offset, 0px);
		height: var(--app-height, 100dvh);
		z-index: 30;
		background: rgb(255 255 255 / 0.92);
		display: grid;
		place-items: center;
		padding: max(1.5rem, env(safe-area-inset-top, 0px)) max(1.5rem, env(safe-area-inset-right, 0px))
			max(1.5rem, env(safe-area-inset-bottom, 0px)) max(1.5rem, env(safe-area-inset-left, 0px));
	}

	.dialog {
		width: min(40rem, 100%);
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

	textarea {
		width: 100%;
		min-height: 14rem;
		resize: vertical;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
</style>
