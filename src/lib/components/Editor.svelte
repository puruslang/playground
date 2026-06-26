<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { javascript } from '@codemirror/lang-javascript';
	import { oneDark } from '@codemirror/theme-one-dark';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		indentOnInput
	} from '@codemirror/language';
	import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

	let { value = $bindable(''), onRun }: { value: string; onRun?: () => void } = $props();

	let container: HTMLDivElement;
	let view: EditorView;
	let internalChange = false;

	onMount(async () => {
		// Wait for the DOM layout to be fully computed before creating CodeMirror
		await tick();

		view = new EditorView({
			parent: container,
			state: EditorState.create({
				doc: value,
				extensions: [
					history(),
					drawSelection(),
					indentOnInput(),
					bracketMatching(),
					closeBrackets(),
					highlightActiveLine(),
					lineNumbers(),
					javascript(),
					syntaxHighlighting(defaultHighlightStyle),
					oneDark,
					keymap.of([
						...closeBracketsKeymap,
						...defaultKeymap,
						...historyKeymap,
						indentWithTab,
						{
							key: 'Ctrl-Enter',
							mac: 'Mod-Enter',
							run: () => {
								onRun?.();
								return true;
							}
						}
					]),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							internalChange = true;
							value = update.state.doc.toString();
							internalChange = false;
						}
					}),
					EditorView.theme({
						'&': { height: '100%', fontSize: '14px', background: '#18181b' },
						'.cm-scroller': {
							overflow: 'auto',
							fontFamily:
								"'Fira Code', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace",
							lineHeight: '1.6'
						},
						'.cm-content': { padding: '8px 0', caretColor: '#f59e0b' },
						'.cm-line': { padding: '0 12px' },
						'.cm-cursor': { borderLeftColor: '#f59e0b' },
						'.cm-activeLine': { backgroundColor: '#27272a' },
						'.cm-gutters': { background: '#18181b', borderRight: '1px solid #3f3f46' },
						'.cm-lineNumbers .cm-gutterElement': { padding: '0 8px', minWidth: '2.5em' }
					})
				]
			})
		});
	});

	// Sync external value changes into the editor (e.g. share URL restore)
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
  The wrapper is position:relative with a defined height.
  The inner div is position:absolute to fill it reliably,
  avoiding any height:100% inheritance-chain breakage.
-->
<div style="position: relative; width: 100%; height: 100%;">
	<div
		bind:this={container}
		style="position: absolute; inset: 0; overflow: hidden;"
	></div>
</div>
