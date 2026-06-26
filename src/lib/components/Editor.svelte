<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { javascript } from '@codemirror/lang-javascript';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
	import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

	let { value = $bindable(''), onRun }: { value: string; onRun?: () => void } = $props();

	let container: HTMLDivElement;
	let view: EditorView;
	let skipUpdate = false;

	onMount(() => {
		view = new EditorView({
			parent: container,
			state: EditorState.create({
				doc: value,
				extensions: [
					// Core
					history(),
					drawSelection(),
					indentOnInput(),
					bracketMatching(),
					closeBrackets(),
					highlightActiveLine(),
					lineNumbers(),
					// Language (JS highlighting is closest match for now)
					javascript(),
					syntaxHighlighting(defaultHighlightStyle),
					oneDark,
					// Keymaps
					keymap.of([
						...closeBracketsKeymap,
						...defaultKeymap,
						...historyKeymap,
						indentWithTab,
						{
							key: 'Ctrl-Enter',
							mac: 'Mod-Enter',
							run: () => { onRun?.(); return true; }
						}
					]),
					// Sync value outward
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							skipUpdate = true;
							value = update.state.doc.toString();
							skipUpdate = false;
						}
					}),
					// Theme
					EditorView.theme({
						'&': {
							height: '100%',
							fontSize: '14px',
							background: '#18181b' // zinc-900
						},
						'.cm-scroller': {
							overflow: 'auto',
							fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace",
							lineHeight: '1.6'
						},
						'.cm-content': { padding: '8px 0', caretColor: '#f59e0b' },
						'.cm-line': { padding: '0 12px' },
						'.cm-cursor': { borderLeftColor: '#f59e0b' },
						'.cm-activeLine': { backgroundColor: '#27272a' },  // zinc-800
						'.cm-gutters': { background: '#18181b', borderRight: '1px solid #3f3f46' },
						'.cm-lineNumbers .cm-gutterElement': { padding: '0 8px' }
					})
				]
			})
		});
	});

	// Sync value inward (e.g. from share URL)
	$effect(() => {
		if (!skipUpdate && view && value !== view.state.doc.toString()) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: value }
			});
		}
	});

	onDestroy(() => view?.destroy());
</script>

<div
	bind:this={container}
	style="height:100%; width:100%; overflow:hidden;"
></div>
