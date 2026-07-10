<script lang="ts">
	import { klartext } from '$lib/markdown';
	import type { Kind } from '$lib/types';

	let {
		children,
		onwahl
	}: {
		children: Kind[];
		onwahl: (id: string) => void;
	} = $props();
</script>

{#if children.length > 0}
	<section class="kinder">
		<h2>Verknüpft</h2>
		<div class="liste">
			{#each children as kind (kind.edge_id)}
				<button class="kachel" onclick={() => onwahl(kind.id)}>
					<span class="typ-punkt" style:--punkt="var(--typ-{kind.type})"></span>
					<span class="front">{klartext(kind.title ?? kind.front)}</span>
					{#if kind.label}<span class="label">{kind.label}</span>{/if}
				</button>
			{/each}
		</div>
	</section>
{/if}

<style>
	.kinder { display: flex; flex-direction: column; }
	h2 {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-fluester);
		margin: 0 0 0.75rem;
	}
	.liste {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		overflow: hidden;
	}
	.kachel {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid var(--linie);
		padding: 0.7rem 1rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.1s ease;
	}
	.kachel:last-child { border-bottom: none; }
	.kachel:hover { background: var(--flaeche); }
	.kachel:active { background: var(--flaeche-hoch); }
	.typ-punkt {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
		flex-shrink: 0;
	}
	.front {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.label {
		font-size: 0.75rem;
		color: var(--text-fluester);
		flex-shrink: 0;
	}
</style>