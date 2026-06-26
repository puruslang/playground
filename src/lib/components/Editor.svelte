<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { keymap } from '@codemirror/view';
	import { indentWithTab } from '@codemirror/commands';
	import { javascript } from '@codemirror/lang-javascript';
	import { oneDark } from '@codemirror/theme-one-dark';

	let {
		value = '',
		onvalue,
		onRun
	}: { value: string; onvalue?: (v: string) => void; onRun?: () => void } = $props();

	let container: HTMLDivElement;
	let view: EditorView;
	let internalChange = false;

	onMount(async () => {
		await tick();

		view = new EditorView({
			parent: container,
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					javascript(),
					oneDark,
					keymap.of([
						indentWithTab,
						{
							key: 'Ctrl-Enter',
							mac: 'Mod-Enter',
							run: () => { onRun?.(); return true; }
						}
					]),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							internalChange = true;
							onvalue?.(update.state.doc.toString());
							internalChange = false;
						}
					}),
					// Per official guide: use ".cm-editor" selector for height
					EditorView.theme({
						'.cm-editor': { height: '100%' },
						'.cm-scroller': {
							overflow: 'auto',
							fontFamily: "'Fira Code', 'Cascadia Code', ui-monospace, monospace",
							fontSize: '14px',
							lineHeight: '1.6'
						}
					})
				]
			})
		});
	});

	$effect(() => {
		if (!internalChange && view && value !== view.state.doc.toString()) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: value }
			});
		}
	});

	onDestroy(() => view?.destroy());
</script>

<!--
  height:100% works because the parent sets an explicit flex height.
  overflow:hidden prevents the container from expanding beyond its bounds.
-->
<div bind:this={container} style="height:100%; overflow:hidden;"></div>
