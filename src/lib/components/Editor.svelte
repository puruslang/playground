<script lang="ts">
	let { value = $bindable(''), onRun }: { value: string; onRun?: () => void } = $props();

	function onKeydown(e: KeyboardEvent) {
		// Ctrl+Enter / Cmd+Enter → run
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			onRun?.();
			return;
		}
		// Tab → insert 2 spaces
		if (e.key === 'Tab') {
			e.preventDefault();
			const ta = e.currentTarget as HTMLTextAreaElement;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			value = value.slice(0, start) + '  ' + value.slice(end);
			// Restore cursor after Svelte updates the DOM
			requestAnimationFrame(() => {
				ta.selectionStart = ta.selectionEnd = start + 2;
			});
		}
	}
</script>

<textarea
	bind:value
	onkeydown={onKeydown}
	spellcheck="false"
	autocomplete="off"
	autocorrect="off"
	autocapitalize="off"
	class="editor-textarea"
	placeholder="-- Write Purus code here…"
></textarea>

<style>
	.editor-textarea {
		display: block;
		width: 100%;
		height: 100%;
		resize: none;
		border: none;
		outline: none;
		padding: 12px 16px;
		background: #18181b;
		color: #e4e4e7;
		font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace;
		font-size: 14px;
		line-height: 1.6;
		tab-size: 2;
		white-space: pre;
		overflow: auto;
		box-sizing: border-box;
		caret-color: #f59e0b;
	}
	.editor-textarea::selection {
		background: #3f3f46;
	}
</style>
