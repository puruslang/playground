<script lang="ts">
	import { onMount } from 'svelte';
	import Editor from '$lib/components/Editor.svelte';
	import FileTree from '$lib/components/FileTree.svelte';
	import type { PageData } from './$types';
	import type { VersionEntry } from '$lib/types';

	let { data }: { data: PageData } = $props();

	const DEFAULT_MAIN = `-- Purus Playground
const name be //;World;//
const greeting be //;Hello, [name]!;//
console.log[greeting]

-- Try more:
fn add a; b to a add b
console.log[add[1; 2]]

const nums be [1..5]
for n in nums
  console.log[n]
`;

	const DEFAULT_CONFIG = `-- config.purus
const type be //;module;//
const entry be //;src;//
const outDir be //;dist;//
const strict be true
`;

	const versions: VersionEntry[] = data.versions ?? [];
	const defaultVersion =
		versions.find((v) => !v.deprecated)?.version ?? versions[0]?.version ?? 'latest';

	// Files
	const FILE_NAMES = ['main.purus', 'config.purus'];
	let files = $state<Record<string, string>>({
		'main.purus': DEFAULT_MAIN,
		'config.purus': DEFAULT_CONFIG
	});
	let currentFile = $state('main.purus');

	// Run settings
	let version = $state(defaultVersion);
	let mode = $state<'node' | 'browser'>('node');
	let running = $state(false);

	// Output
	let compiled = $state('');
	let stdout = $state('');
	let stderr = $state('');
	let tab = $state<'output' | 'compiled'>('output');

	let iframeRef: HTMLIFrameElement;

	// Current file's code (two-way binding via getter/setter effect)
	let currentCode = $derived(files[currentFile] ?? '');

	function setCurrentCode(v: string) {
		files = { ...files, [currentFile]: v };
	}

	onMount(() => {
		const p = new URLSearchParams(window.location.search);
		if (p.get('code')) {
			try {
				files = { ...files, 'main.purus': decodeURIComponent(escape(atob(p.get('code')!))) };
			} catch {}
		}
		if (p.get('m') === 'browser') mode = 'browser';
		if (p.get('v')) version = p.get('v')!;
	});

	async function doRun(runMode: 'node' | 'browser' | 'compile') {
		if (running) return;
		running = true;
		compiled = '';
		stdout = '';
		stderr = '';
		tab = runMode === 'compile' ? 'compiled' : 'output';

		try {
			const res = await fetch('/api/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: files['main.purus'],
					version: version || 'latest',
					mode: runMode
				})
			});
			const result = await res.json();
			compiled = result.compiled ?? '';
			stderr = result.stderr ?? '';

			if (!result.success) {
				tab = 'output';
			} else if (runMode === 'compile') {
				tab = 'compiled';
			} else if (runMode === 'browser' && result.compiled) {
				runInBrowser(result.compiled);
			} else {
				stdout = result.stdout ?? '';
				tab = 'output';
			}
		} catch (e) {
			stderr = String(e);
			tab = 'output';
		} finally {
			running = false;
		}
	}

	function runInBrowser(js: string) {
		const html = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script>
const __l=[];const __e=[];
const _c={log:(...a)=>__l.push(a.join(' ')),error:(...a)=>__e.push(a.join(' ')),warn:(...a)=>__e.push(a.join(' ')),info:(...a)=>__l.push(a.join(' '))};
Object.defineProperty(window,'console',{value:_c});
try{${js.replace(/<\/script>/g, '<\\/script>')}
}catch(e){__e.push(String(e));}
window.parent.postMessage({type:'purus-result',stdout:__l.join('\\n'),stderr:__e.join('\\n')},'*');
<\/script></body></html>`;
		const blob = new Blob([html], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		if (iframeRef) iframeRef.src = url;
		const handler = (e: MessageEvent) => {
			if (e.data?.type === 'purus-result') {
				stdout = e.data.stdout ?? '';
				stderr = e.data.stderr ?? '';
				tab = 'output';
				URL.revokeObjectURL(url);
				window.removeEventListener('message', handler);
			}
		};
		window.addEventListener('message', handler);
		setTimeout(() => window.removeEventListener('message', handler), 8000);
	}

	function clearFile() {
		files = { ...files, [currentFile]: '' };
	}

	function share() {
		const url = new URL(window.location.href);
		url.searchParams.set('code', btoa(unescape(encodeURIComponent(files['main.purus']))));
		url.searchParams.set('v', version);
		url.searchParams.set('m', mode);
		navigator.clipboard.writeText(url.toString()).catch(() => {});
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	let copied = $state(false);
</script>

<svelte:head>
	<title>Purus Playground</title>
</svelte:head>

<div class="root">
	<!-- ── Header ── -->
	<header class="header">
		<a href="/" class="brand">
			<img
				src="https://raw.githubusercontent.com/puruslang/assets/main/icon.svg"
				alt="Purus"
				class="brand-icon"
			/>
			<span>Purus Playground</span>
		</a>
		<a
			href="https://purus.work"
			target="_blank"
			rel="noopener"
			class="docs-link"
		>Docs ↗</a>

		<div class="header-right">
			<!-- Version -->
			<select bind:value={version} class="select">
				{#if versions.length === 0}
					<option value="latest">latest</option>
				{:else}
					{#each versions as v (v.version)}
						<option value={v.version}
							>{v.version}{v.deprecated ? ' (deprecated)' : ''}</option
						>
					{/each}
				{/if}
			</select>

			<!-- Mode -->
			<div class="mode-switch">
				<button
					class="mode-btn {mode === 'node' ? 'active' : ''}"
					onclick={() => (mode = 'node')}>Node.js v22</button
				>
				<button
					class="mode-btn {mode === 'browser' ? 'active' : ''}"
					onclick={() => (mode = 'browser')}>Browser</button
				>
			</div>

			<!-- Clear -->
			<button class="btn-ghost" onclick={clearFile} title="Clear current file">Clear</button>

			<!-- Share -->
			<button class="btn-ghost" onclick={share}>{copied ? 'Copied!' : 'Share'}</button>

			<!-- Compile only -->
			<button
				class="btn-secondary"
				onclick={() => doRun('compile')}
				disabled={running}
				title="Compile to JS without running"
			>
				{running ? '…' : 'Compile'}
			</button>

			<!-- Run -->
			<button
				class="btn-primary"
				onclick={() => doRun(mode)}
				disabled={running}
				title="Ctrl+Enter"
			>
				{#if running}
					<span class="spin">⟳</span> Running…
				{:else}
					▶ Run <span class="hint">Ctrl+↵</span>
				{/if}
			</button>
		</div>
	</header>

	<!-- ── Body ── -->
	<div class="body">
		<!-- File tree -->
		<FileTree
			files={FILE_NAMES}
			current={currentFile}
			onSelect={(f) => (currentFile = f)}
		/>

		<!-- Editor pane -->
		<div class="editor-pane">
			<div class="pane-bar">
				<span class="filename">{currentFile}</span>
				<span class="hint-text">Ctrl+Enter to run</span>
			</div>
			<div class="editor-wrap">
				<Editor value={currentCode} onvalue={setCurrentCode} onRun={() => doRun(mode)} />
			</div>
		</div>

		<!-- Output pane -->
		<div class="output-pane">
			<div class="pane-bar tabs">
				<button
					class="tab {tab === 'output' ? 'active' : ''}"
					onclick={() => (tab = 'output')}>Output</button
				>
				<button
					class="tab {tab === 'compiled' ? 'active' : ''}"
					onclick={() => (tab = 'compiled')}>Compiled JS</button
				>
				{#if stderr && tab !== 'output'}
					<span class="err-dot">● error</span>
				{/if}
			</div>
			<div class="output-body">
				{#if tab === 'output'}
					{#if !stdout && !stderr && !running}
						<p class="placeholder">
							Press <kbd>Run</kbd> or <kbd>Ctrl+Enter</kbd> to execute.
						</p>
					{/if}
					{#if stderr}
						<div class="error-block">
							<p class="error-label">Error</p>
							<pre>{stderr}</pre>
						</div>
					{/if}
					{#if stdout}
						<pre class="stdout">{stdout}</pre>
					{/if}
				{:else}
					{#if compiled}
						<pre class="compiled">{compiled}</pre>
					{:else}
						<p class="placeholder">Compiled JavaScript will appear here.</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Browser sandbox -->
<iframe bind:this={iframeRef} title="sandbox" sandbox="allow-scripts" class="hidden"></iframe>

<style>
	:global(html, body) { height: 100%; margin: 0; }

	.root {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #09090b;
		color: #e4e4e7;
		font-family: system-ui, sans-serif;
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 16px;
		height: 44px;
		border-bottom: 1px solid #27272a;
		flex-shrink: 0;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
		color: #fff;
		font-weight: 600;
		font-size: 14px;
	}
	.brand:hover { opacity: 0.8; }
	.brand-icon { width: 22px; height: 22px; }
	.docs-link { font-size: 12px; color: #71717a; text-decoration: none; }
	.docs-link:hover { color: #a1a1aa; }

	.header-right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.select {
		background: #27272a;
		color: #e4e4e7;
		border: none;
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 13px;
		cursor: pointer;
		outline: none;
	}
	.select:hover { background: #3f3f46; }

	.mode-switch { display: flex; border-radius: 6px; overflow: hidden; }
	.mode-btn {
		background: #27272a;
		border: none;
		color: #a1a1aa;
		padding: 4px 10px;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}
	.mode-btn:hover { background: #3f3f46; color: #e4e4e7; }
	.mode-btn.active { background: #f59e0b; color: #09090b; font-weight: 600; }

	.btn-ghost {
		background: none;
		border: 1px solid #3f3f46;
		color: #a1a1aa;
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 12px;
		cursor: pointer;
	}
	.btn-ghost:hover { background: #27272a; color: #e4e4e7; }

	.btn-secondary {
		background: #27272a;
		border: 1px solid #52525b;
		color: #d4d4d8;
		border-radius: 6px;
		padding: 4px 12px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.btn-secondary:hover:not(:disabled) { background: #3f3f46; }
	.btn-secondary:disabled { opacity: 0.5; cursor: default; }

	.btn-primary {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #f59e0b;
		border: none;
		color: #09090b;
		border-radius: 6px;
		padding: 5px 14px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-primary:hover:not(:disabled) { background: #fbbf24; }
	.btn-primary:disabled { opacity: 0.5; cursor: default; }
	.hint { font-size: 10px; opacity: 0.6; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.spin { display: inline-block; animation: spin 0.8s linear infinite; }

	/* Body */
	.body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Editor pane */
	.editor-pane {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
		border-right: 1px solid #27272a;
	}
	.editor-wrap {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Output pane */
	.output-pane {
		display: flex;
		flex-direction: column;
		width: 50%;
		min-width: 0;
		min-height: 0;
	}

	/* Shared pane bar */
	.pane-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		height: 32px;
		border-bottom: 1px solid #27272a;
		flex-shrink: 0;
		background: #111113;
	}
	.filename { font-size: 12px; color: #71717a; }
	.hint-text { margin-left: auto; font-size: 11px; color: #3f3f46; }

	/* Tabs */
	.tabs { gap: 0; padding: 0; }
	.tab {
		height: 32px;
		padding: 0 14px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: #71717a;
		font-size: 12px;
		cursor: pointer;
		transition: color 0.1s, border-color 0.1s;
	}
	.tab:hover { color: #a1a1aa; }
	.tab.active { color: #fff; border-bottom-color: #f59e0b; }
	.err-dot { margin-left: auto; padding-right: 12px; font-size: 11px; color: #f87171; }

	/* Output body */
	.output-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 16px;
		font-family: 'Fira Code', ui-monospace, monospace;
		font-size: 13px;
	}
	.placeholder { color: #52525b; font-size: 13px; }
	.placeholder kbd {
		background: #27272a;
		border-radius: 4px;
		padding: 1px 6px;
		font-family: inherit;
		font-size: 12px;
		color: #a1a1aa;
	}
	.error-block {
		background: rgba(127,29,29,0.3);
		border: 1px solid #7f1d1d;
		border-radius: 6px;
		padding: 12px;
		margin-bottom: 12px;
	}
	.error-label { font-size: 11px; font-weight: 600; color: #f87171; margin: 0 0 6px; }
	.error-block pre { color: #fca5a5; white-space: pre-wrap; margin: 0; }
	.stdout { color: #e4e4e7; white-space: pre-wrap; margin: 0; }
	.compiled { color: #a1a1aa; white-space: pre-wrap; margin: 0; font-size: 12px; }

	.hidden { display: none; }
</style>
