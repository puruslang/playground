<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
	import { javascript } from '@codemirror/lang-javascript';
	import { oneDark } from '@codemirror/theme-one-dark';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching
	} from '@codemirror/language';
	import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

	let { value = $bindable(''), onRun }: { value: string; onRun?: () => void } = $props();

	let container: HTMLDivElement;
	let view: EditorView;

	onMount(() => {
		const startState = EditorState.create({
			doc: value,
			extensions: [
				lineNumbers(),
				history(),
				bracketMatching(),
				closeBrackets(),
				highlightActiveLine(),
				syntaxHighlighting(defaultHighlightStyle),
				javascript(),
				oneDark,
				keymap.of([
					...defaultKeymap,
					...historyKeymap,
					...closeBracketsKeymap,
					{
						key: 'Ctrl-Enter',
						mac: 'Cmd-Enter',
						run: () => {
							onRun?.();
							return true;
						}
					}
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						value = update.state.doc.toString();
					}
				}),
				EditorView.theme({
					'&': { height: '100%', fontSize: '14px' },
					'.cm-scroller': { overflow: 'auto', fontFamily: "'Fira Code', 'Cascadia Code', monospace" },
					'.cm-content': { padding: '12px 0' }
				})
			]
		});

		view = new EditorView({ state: startState, parent: container });
	});

	$effect(() => {
		if (view && value !== view.state.doc.toString()) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: value }
			});
		}
	});

	onDestroy(() => view?.destroy());
</script>

<div bind:this={container} class="h-full w-full overflow-hidden rounded-lg border border-zinc-700"></div>