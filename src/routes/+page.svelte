<script lang="ts">
	import { onMount } from 'svelte';
	import Editor from '$lib/components/Editor.svelte';
	import type { PageData } from './$types';
	import type { VersionEntry } from '$lib/types';

	let { data }: { data: PageData } = $props();

	const DEFAULT_CODE = `-- Purus Playground
const name be //;World;//
const greeting be //;Hello, [name]!;//
console.log[greeting]

-- Try more features:
fn add a; b to a add b
console.log[add[1; 2]]

const nums be [1..5]
for n in nums
  console.log[n]
`;

	// versions come from server load — available immediately on render
	const versions: VersionEntry[] = data.versions ?? [];
	const defaultVersion = versions.find((v) => !v.deprecated)?.version ?? versions[0]?.version ?? 'latest';

	let code = $state(DEFAULT_CODE);
	let version = $state(defaultVersion);
	let mode = $state<'node' | 'browser'>('node');
	let running = $state(false);

	let compiled = $state('');
	let stdout = $state('');
	let stderr = $state('');
	let tab = $state<'output' | 'compiled'>('output');

	let iframeRef: HTMLIFrameElement;

	onMount(() => {
		// Restore from URL params
		const p = new URLSearchParams(window.location.search);
		if (p.get('code')) {
			try { code = decodeURIComponent(escape(atob(p.get('code')!))); } catch {}
		}
		if (p.get('m') === 'browser') mode = 'browser';
		if (p.get('v')) version = p.get('v')!;
	});

	async function run() {
		if (running) return;
		running = true;
		compiled = '';
		stdout = '';
		stderr = '';
		tab = 'output';

		try {
			const res = await fetch('/api/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code, version: version || 'latest', mode })
			});
			const data = await res.json();

			compiled = data.compiled ?? '';
			stderr = data.stderr ?? '';

			if (!data.success) {
				tab = 'output';
			} else if (mode === 'browser' && data.compiled) {
				runInBrowser(data.compiled);
			} else {
				stdout = data.stdout ?? '';
				tab = 'output';
			}
		} catch (e) {
			stderr = String(e);
		} finally {
			running = false;
		}
	}

	function runInBrowser(js: string) {
		const html = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script>
const __lines = [];
const __errs = [];
const _console = {
  log:   (...a) => __lines.push(a.join(' ')),
  error: (...a) => __errs.push(a.join(' ')),
  warn:  (...a) => __errs.push(a.join(' ')),
  info:  (...a) => __lines.push(a.join(' '))
};
Object.defineProperty(window, 'console', { value: _console });
try {
${js.replace(/<\/script>/g, '<\\/script>')}
} catch(e) { __errs.push(String(e)); }
window.parent.postMessage({ type: 'purus-result', stdout: __lines.join('\\n'), stderr: __errs.join('\\n') }, '*');
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

	function share() {
		const url = new URL(window.location.href);
		url.searchParams.set('code', btoa(unescape(encodeURIComponent(code))));
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

<div class="flex h-screen flex-col bg-zinc-950 text-zinc-100" style="font-family: system-ui, sans-serif;">
	<!-- Header -->
	<header class="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-2">
		<a href="/" class="flex items-center gap-2 hover:opacity-80">
			<img src="https://raw.githubusercontent.com/puruslang/assets/main/icon.svg" alt="Purus" class="h-6 w-6" />
			<span class="font-semibold text-white">Purus Playground</span>
		</a>

		<a href="https://purus.work/getting-started/installation" target="_blank" rel="noopener"
			class="text-xs text-zinc-500 hover:text-zinc-300">Docs ↗</a>

		<div class="ml-auto flex items-center gap-2 flex-wrap">
			<!-- Version selector -->
			<select
				bind:value={version}
				class="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none hover:bg-zinc-700 cursor-pointer"
			>
				{#if versions.length === 0}
					<option value="latest">latest</option>
				{:else}
					{#each versions as v (v.version)}
						<option value={v.version}>
							{v.version}{v.deprecated ? ' (deprecated)' : ''}
						</option>
					{/each}
				{/if}
			</select>

			<!-- Mode selector -->
			<div class="flex rounded bg-zinc-800 text-sm">
				<button
					class="rounded-l px-3 py-1 transition-colors {mode === 'node'
						? 'bg-amber-500 text-zinc-900 font-medium'
						: 'text-zinc-400 hover:text-zinc-200'}"
					onclick={() => (mode = 'node')}
				>
					Node.js v22
				</button>
				<button
					class="rounded-r px-3 py-1 transition-colors {mode === 'browser'
						? 'bg-amber-500 text-zinc-900 font-medium'
						: 'text-zinc-400 hover:text-zinc-200'}"
					onclick={() => (mode = 'browser')}
				>
					Browser
				</button>
			</div>

			<!-- Share -->
			<button
				onclick={share}
				class="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
			>
				{copied ? 'Copied!' : 'Share'}
			</button>

			<!-- Run -->
			<button
				onclick={run}
				disabled={running}
				class="flex items-center gap-1.5 rounded bg-amber-500 px-4 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-amber-400 disabled:opacity-50 transition-colors"
			>
				{#if running}
					<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
					</svg>
					Running…
				{:else}
					▶ Run
					<span class="text-xs opacity-60">Ctrl+↵</span>
				{/if}
			</button>
		</div>
	</header>

	<!-- Main split pane -->
	<div class="flex flex-1 overflow-hidden min-h-0">
		<!-- Editor pane -->
		<div class="flex w-1/2 min-w-0 flex-col border-r border-zinc-800">
			<div class="shrink-0 border-b border-zinc-800 px-4 py-1.5 text-xs text-zinc-500 flex items-center gap-2">
				<span>main.purus</span>
				<span class="ml-auto opacity-40">Ctrl+Enter to run</span>
			</div>
			<div class="flex-1 min-h-0" style="overflow: hidden;">
				<Editor bind:value={code} onRun={run} />
			</div>
		</div>

		<!-- Output pane -->
		<div class="flex w-1/2 min-w-0 flex-col">
			<!-- Tabs -->
			<div class="shrink-0 flex border-b border-zinc-800">
				<button
					class="px-4 py-1.5 text-xs transition-colors {tab === 'output'
						? 'border-b-2 border-amber-500 text-white'
						: 'text-zinc-500 hover:text-zinc-300'}"
					onclick={() => (tab = 'output')}
				>
					Output
				</button>
				<button
					class="px-4 py-1.5 text-xs transition-colors {tab === 'compiled'
						? 'border-b-2 border-amber-500 text-white'
						: 'text-zinc-500 hover:text-zinc-300'}"
					onclick={() => (tab = 'compiled')}
				>
					Compiled JS
				</button>
				{#if stderr && tab !== 'output'}
					<span class="ml-auto self-center pr-3 text-xs text-red-400">● error</span>
				{/if}
			</div>

			<div class="flex-1 overflow-auto p-4 min-h-0" style="font-family: 'Fira Code', monospace;">
				{#if tab === 'output'}
					{#if !stdout && !stderr && !running}
						<p class="text-sm text-zinc-600">
							Press <kbd class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-400">Run</kbd>
							or <kbd class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-400">Ctrl+Enter</kbd>
							to execute.
						</p>
					{/if}
					{#if stderr}
						<div class="mb-3 rounded-md border border-red-800 bg-red-950/50 p-3">
							<p class="mb-1.5 text-xs font-semibold text-red-400">Compile / Runtime Error</p>
							<pre class="whitespace-pre-wrap text-sm text-red-300">{stderr}</pre>
						</div>
					{/if}
					{#if stdout}
						<pre class="whitespace-pre-wrap text-sm text-zinc-200">{stdout}</pre>
					{/if}
				{:else}
					{#if compiled}
						<pre class="whitespace-pre-wrap text-xs text-zinc-400">{compiled}</pre>
					{:else}
						<p class="text-sm text-zinc-600">Compiled JavaScript will appear here after running.</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Browser sandbox iframe -->
<iframe bind:this={iframeRef} title="sandbox" sandbox="allow-scripts" class="hidden" aria-hidden="true"></iframe>
