<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { keymap } from '@codemirror/view';
	import { indentWithTab } from '@codemirror/commands';
	import { javascript } from '@codemirror/lang-javascript';
	import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { tags } from '@lezer/highlight';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { purusLanguage } from '$lib/lang/purus';

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

	let container: HTMLDivElement;
	let view: EditorView;
	let internalChange = false;

	/**
	 * Custom HighlightStyle matching one-dark-pro colours.
	 * Mapped from purus.tmLanguage.json scope categories.
	 *
	 * one-dark-pro palette:
	 *   comment  #7f848e  (italic)
	 *   string   #98c379  (green)
	 *   keyword  #c678dd  (purple)   storage.type / control
	 *   def      #61afef  (blue)     entity.name.function / fn keyword
	 *   operator #56b6c2  (cyan)     keyword.operator.*
	 *   atom     #d19a66  (orange)   constant.language / numbers
	 *   type     #e5c07b  (yellow)   keyword.other.type
	 *   builtin  #e06c75  (red)      support.type
	 *   variable #abb2bf  (text)
	 */
	const purusHighlight = HighlightStyle.define([
		// comment
		{ tag: tags.comment,                   color: '#7f848e', fontStyle: 'italic' },
		// string / regexp
		{ tag: tags.string,                    color: '#98c379' },
		{ tag: tags.regexp,                    color: '#98c379' },
		// keywords (storage.type + control flow + other)
		{ tag: tags.keyword,                   color: '#c678dd' },
		{ tag: tags.controlKeyword,            color: '#c678dd' },
		{ tag: tags.moduleKeyword,             color: '#c678dd' },
		// fn keyword + function names → blue
		{ tag: tags.definitionKeyword,         color: '#61afef' },
		{ tag: tags.function(tags.variableName), color: '#61afef' },
		{ tag: tags.function(tags.definition(tags.variableName)), color: '#61afef' },
		// operators → cyan
		{ tag: tags.operator,                  color: '#56b6c2' },
		// literals / constants → orange
		{ tag: tags.atom,                      color: '#d19a66' },
		{ tag: tags.number,                    color: '#d19a66' },
		{ tag: tags.bool,                      color: '#d19a66' },
		{ tag: tags.null,                      color: '#d19a66' },
		// type keywords → yellow
		{ tag: tags.typeName,                  color: '#e5c07b' },
		{ tag: tags.typeOperator,              color: '#e5c07b' },
		// support.type → red
		{ tag: tags.standard(tags.variableName), color: '#e06c75' },
		// punctuation + default text
		{ tag: tags.punctuation,               color: '#abb2bf' },
		{ tag: tags.variableName,              color: '#abb2bf' },
		{ tag: tags.propertyName,              color: '#abb2bf' },
	]);

	onMount(async () => {
		await tick();

		const langExtension = lang === 'js'
			? javascript()
			: [purusLanguage, syntaxHighlighting(purusHighlight)];

		view = new EditorView({
			parent: container,
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					...(Array.isArray(langExtension) ? langExtension : [langExtension]),
					oneDark,
					...(readonly
						? [EditorState.readOnly.of(true)]
						: [
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
						]
					),
					// Per official guide: ".cm-editor" for height
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

<div bind:this={container} style="height:100%; overflow:hidden;"></div>
