<script lang="ts">
	import { rendere } from '$lib/markdown';
	import type { Karte } from '$lib/types';

	// Die Komponente ist bewusst "dumm": Sie zeigt an und meldet
	// Ereignisse nach oben (onlink, onaufdecken). Was dann passiert,
	// entscheidet die Seite — so bleibt sie überall einsetzbar.
	let {
		node,
		aufgedeckt,
		onaufdecken,
		onlink,
		onschliessen
	}: {
		node: Karte;
		aufgedeckt: boolean;
		onaufdecken: () => void;
		onlink: (id: string) => void;
		onschliessen?: () => void;
	} = $props();

	// Ein Lauscher für alle Inline-Links (Event-Delegation):
	// statt jeden Link einzeln zu verkabeln, fängt die Karte
	// jeden Klick und prüft, ob er einen .inline-link traf.
	function klickAbfangen(e: MouseEvent) {
		const ziel = e.target as HTMLElement;
		if (ziel.classList.contains('inline-link')) {
			const id = ziel.getAttribute('data-link');
			if (id) onlink(id);
		}
	}
</script>

<article class="karte" onclick={klickAbfangen} role="presentation">
	<div class="kopf">
		<div class="typ">
			<span class="typ-punkt" style:--punkt="var(--typ-{node.type})"></span>
			{node.type}
		</div>
		<div class="kopf-rechts">
			{#if node.ref}<span class="ref">{node.ref}</span>{/if}
			{#if onschliessen}
				<button class="schliessen" onclick={onschliessen} aria-label="Schließen">×</button>
			{/if}
		</div>
	</div>

	{#if node.title}<div class="titel">{node.title}</div>{/if}
	<div class="inhalt">{@html rendere(node.front)}</div>

	{#if aufgedeckt}
		<div class="inhalt rueckseite">{@html rendere(node.back)}</div>
	{:else if node.back}
		<button class="aufdecken" onclick={onaufdecken}>Aufdecken</button>
	{/if}
</article>

<style>
	.karte {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 2rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
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
	}
	.typ-punkt {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
	}
	.schliessen {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.2rem;
		transition: color 0.15s ease;
	}
	.schliessen:hover { color: var(--text); }
	.kopf-rechts { display: flex; align-items: center; gap: 0.6rem; }
	.ref { font-family: var(--mono); font-size: 0.7rem; color: var(--text-fluester); }
	.titel {
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin-bottom: 0.75rem;
	}

	.inhalt { font-size: 1rem; line-height: 1.65; }
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
	:global(.inline-link:hover) { text-decoration-color: var(--akzent); }
</style>