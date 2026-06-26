<script lang="ts">
	let {
		files,
		current,
		onSelect
	}: {
		files: string[];
		current: string;
		onSelect: (f: string) => void;
	} = $props();

	function icon(filename: string) {
		if (filename.endsWith('.purus') || filename.endsWith('.mpurus') || filename.endsWith('.cpurus')) return '📄';
		return '📝';
	}
</script>

<aside class="file-tree">
	<div class="tree-header">FILES</div>
	{#each files as f (f)}
		<button
			class="tree-item {f === current ? 'active' : ''}"
			onclick={() => onSelect(f)}
			title={f}
		>
			<span class="tree-icon">{icon(f)}</span>
			<span class="tree-name">{f}</span>
		</button>
	{/each}
</aside>

<style>
	.file-tree {
		width: 140px;
		min-width: 140px;
		background: #111113;
		border-right: 1px solid #3f3f46;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		flex-shrink: 0;
	}
	.tree-header {
		padding: 8px 10px 4px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: #52525b;
		text-transform: uppercase;
	}
	.tree-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 5px 10px;
		background: none;
		border: none;
		color: #a1a1aa;
		font-size: 12px;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tree-item:hover {
		background: #27272a;
		color: #e4e4e7;
	}
	.tree-item.active {
		background: #3f3f46;
		color: #f59e0b;
	}
	.tree-icon {
		font-size: 11px;
		flex-shrink: 0;
	}
	.tree-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
