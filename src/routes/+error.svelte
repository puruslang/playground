<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Purus Playground</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
	<img
		src="https://raw.githubusercontent.com/puruslang/assets/main/icon.svg"
		alt="Purus"
		class="mb-6 h-16 w-16 opacity-40"
	/>
	<h1 class="mb-2 text-6xl font-bold text-amber-500">{page.status}</h1>
	<p class="mb-8 text-zinc-400">
		{#if page.status === 404}
			This page doesn't exist.
		{:else}
			Something went wrong.
		{/if}
	</p>
	<a
		href="/"
		class="rounded bg-amber-500 px-6 py-2 font-semibold text-zinc-900 hover:bg-amber-400 transition-colors"
	>
		Go to Playground
	</a>
</div>