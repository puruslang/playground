<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { createHighlighter, type BundledTheme, type HighlighterGeneric } from 'shiki';
	import purusGrammar from '$lib/lang/purus.tmLanguage.json';

	let {
		value = '',
		onvalue,
		onRun,
		lang = 'purus',
		readonly = false
	}: {
		value: string;
		onvalue?: (v: string) => void;
		onRun?: () => void;
		lang?: 'purus' | 'js';
		readonly?: boolean;
	} = $props();

	type Highlighter = HighlighterGeneric<string, BundledTheme>;

	let highlighted = $state('');
	let highlighter: Highlighter | null = null;
	let textarea: HTMLTextAreaElement;
	let highlightEl: HTMLDivElement;

	// Initialize Shiki with purus.tmLanguage.json — same grammar as docs
	onMount(async () => {
		highlighter = await createHighlighter({
			themes: ['one-dark-pro'],
			langs: lang === 'purus'
				? [purusGrammar as Parameters<Highlighter['loadLanguage']>[0]]
				: ['javascript']
		}) as Highlighter;

		await tick();
		updateHighlight(value);
	});

	function updateHighlight(code: string) {
		if (!highlighter) return;
		try {
			highlighted = highlighter.codeToHtml(code || ' ', {
				lang: lang === 'purus' ? 'purus' : 'javascript',
				theme: 'one-dark-pro'
			});
		} catch {
			highlighted = `<pre><code>${escapeHtml(code)}</code></pre>`;
		}
	}

	function escapeHtml(s: string) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	$effect(() => {
		updateHighlight(value);
	});

	function onInput(e: Event) {
		const v = (e.target as HTMLTextAreaElement).value;
		onvalue?.(v);
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			onRun?.();
			return;
		}
		if (e.key === 'Tab' && !readonly) {
			e.preventDefault();
			const ta = e.currentTarget as HTMLTextAreaElement;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			const newVal = value.slice(0, start) + '  ' + value.slice(end);
			onvalue?.(newVal);
			requestAnimationFrame(() => {
				ta.selectionStart = ta.selectionEnd = start + 2;
			});
		}
	}

	function syncScroll() {
		if (highlightEl && textarea) {
			highlightEl.scrollTop = textarea.scrollTop;
			highlightEl.scrollLeft = textarea.scrollLeft;
		}
	}
</script>

<div class="editor-root">
	<!-- Shiki-highlighted HTML layer (same grammar as docs) -->
	<div
		bind:this={highlightEl}
		class="highlight-layer"
		aria-hidden="true"
	>
		{@html highlighted}
	</div>

	<!-- Transparent textarea for editing -->
	{#if !readonly}
		<textarea
			bind:this={textarea}
			{value}
			oninput={onInput}
			onkeydown={onKeydown}
			onscroll={syncScroll}
			spellcheck="false"
			autocomplete="off"
			autocorrect="off"
			autocapitalize="off"
			class="editor-textarea"
			placeholder="-- Write Purus code here…"
		></textarea>
	{/if}
</div>

<style>
	.editor-root {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #1e1e2e;
	}

	/* Shiki HTML layer — behind the textarea, pointer-events off */
	.highlight-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}
	/* Strip Shiki's default <pre> styling so it matches textarea exactly */
	:global(.highlight-layer pre.shiki) {
		margin: 0;
		padding: 12px 16px;
		background: transparent !important;
		font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
		font-size: 14px;
		line-height: 1.6;
		tab-size: 2;
		white-space: pre;
		overflow: hidden;
		border-radius: 0;
	}
	:global(.highlight-layer pre.shiki code) {
		counter-reset: unset;
		display: block;
	}

	/* Transparent editing layer — same layout as the highlight <pre> */
	.editor-textarea {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		resize: none;
		border: none;
		outline: none;
		background: transparent;
		color: transparent;
		caret-color: #f59e0b;
		font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
		font-size: 14px;
		line-height: 1.6;
		tab-size: 2;
		white-space: pre;
		overflow: auto;
		padding: 12px 16px;
		box-sizing: border-box;
		z-index: 1;
	}
	.editor-textarea::selection {
		background: rgba(255, 255, 255, 0.15);
		color: transparent;
	}
</style>
