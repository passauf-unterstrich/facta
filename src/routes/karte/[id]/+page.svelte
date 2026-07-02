<script lang="ts">
	import { rendere } from '$lib/markdown';

	let { data } = $props();

	// Trick: aufgedeckt "gehoert" zur Karten-ID. Wechselt die Karte,
	// liefert der Vergleich automatisch false — Ableitung statt Reset.
	let aufgedecktFuer = $state('');
	const aufgedeckt = $derived(aufgedecktFuer === data.node.id);
</script>

<div class="seite">
	<nav class="leiste">
		<a class="zurueck" href="/">‹ Bibliothek</a>
	</nav>

	<article class="karte">
		<div class="typ">
			<span class="typ-punkt" style:--punkt="var(--typ-{data.node.type})"></span>
			{data.node.type}
		</div>

		<div class="inhalt">{@html rendere(data.node.front)}</div>

		{#if aufgedeckt}
			<div class="inhalt rueckseite">{@html rendere(data.node.back)}</div>
		{:else if data.node.back}
			<button class="aufdecken" onclick={() => (aufgedecktFuer = data.node.id)}>Aufdecken</button>
		{/if}
	</article>
</div>

<style>
	.seite {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.leiste { display: flex; }
	.zurueck {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.85rem;
		transition: color 0.15s ease;
	}
	.zurueck:hover { color: var(--text); }

	.karte {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 2rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.typ {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-fluester);
		margin-bottom: 1.25rem;
	}
	.typ-punkt {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
	}

	.inhalt {
		font-size: 1rem;
		line-height: 1.65;
	}
	/* Markdown-Kinder stylen: :global nötig, weil marked das HTML
	   erzeugt und Svelte es nicht als "eigenes" erkennt */
	.inhalt :global(p) { margin: 0 0 0.75em; }
	.inhalt :global(p:last-child) { margin-bottom: 0; }
	.inhalt :global(strong) { font-weight: 600; }
	.inhalt :global(ul) { padding-left: 1.25em; margin: 0 0 0.75em; }
	.inhalt :global(ol) { padding-left: 1.25em; margin: 0 0 0.75em; }
	.inhalt :global(li) { margin-bottom: 0.25em; }

	.rueckseite {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--linie);
		color: var(--text-leise);
		animation: einblenden 0.25s ease;
	}
	@keyframes einblenden {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.aufdecken {
		margin-top: 1.5rem;
		background: var(--flaeche-hoch);
		color: var(--text);
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.55rem 1.3rem;
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease, transform 0.1s ease;
	}
	.aufdecken:hover { background: var(--linie-stark); }
	.aufdecken:active { transform: scale(0.97); }

	:global(.inline-link) {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--akzent);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--akzent) 35%, transparent);
		text-underline-offset: 3px;
		transition: text-decoration-color 0.15s ease;
	}
	:global(.inline-link:hover) {
		text-decoration-color: var(--akzent);
	}
</style>