<script lang="ts">
	import { rendere, rendereInline } from '$lib/markdown';
	import { parseZeilen } from '$lib/schalen';
	import type { Karte } from '$lib/types';

	// Die Komponente ist bewusst "dumm": Sie zeigt an und meldet
	// Ereignisse nach oben (onlink, onaufdecken). Was dann passiert,
	// entscheidet die Seite — so bleibt sie überall einsetzbar.
	let {
		node,
		aufgedeckt,
		onaufdecken,
		onlink,
		onschliessen,
		typMap
	}: {
		node: Karte;
		aufgedeckt: boolean;
		onaufdecken: () => void;
		onlink: (id: string) => void;
		onschliessen?: () => void;
		typMap?: Map<string, string>;
	} = $props();

	// Ein Lauscher für alle Inline-Links (Event-Delegation): statt
	// jeden Link einzeln zu verkabeln, fängt die Karte jeden Klick
	// und prüft, ob er einen .inline-link traf.
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
	<div class="inhalt">{@html rendere(node.front, typMap)}</div>

	{#if aufgedeckt}
		{#if node.mode && node.mode !== 'open'}
			<div class="schalen rueckseite" class:chips={node.mode === 'chips'}>
				{#each parseZeilen(node.back) as z, i (i)}
					{#if z.ziel}
						<button class="schale" onclick={() => onlink(z.ziel!)}>
							<span class="schale-text">{@html rendereInline(z.label)}</span>
							<span class="schale-pfeil">›</span>
						</button>
					{:else}
						<div class="schale-titel">{@html rendereInline(z.label)}</div>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="inhalt rueckseite">{@html rendere(node.back, typMap)}</div>
		{/if}
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
	.schliessen:hover {
		color: var(--text);
	}
	.kopf-rechts {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.ref {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--text-fluester);
	}
	.titel {
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin-bottom: 0.75rem;
	}

	.inhalt {
		font-size: 1rem;
		line-height: 1.65;
	}
	.inhalt :global(p) {
		margin: 0 0 0.75em;
	}
	.inhalt :global(p:last-child) {
		margin-bottom: 0;
	}
	.inhalt :global(strong) {
		font-weight: 600;
	}
	.inhalt :global(ul) {
		padding-left: 1.25em;
		margin: 0 0 0.75em;
	}
	.inhalt :global(ol) {
		padding-left: 1.25em;
		margin: 0 0 0.75em;
	}
	.inhalt :global(li) {
		margin-bottom: 0.25em;
	}

	.rueckseite {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--linie);
		color: var(--text-leise);
		animation: einblenden 0.25s ease;
	}

	/* Schalen im Lern-Modus: große, tappbare Pillen untereinander */
	.schalen {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.schale {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		text-align: left;
		background: var(--flaeche-hoch);
		border: 1px solid var(--linie-stark);
		border-radius: 999px;
		padding: 0.85rem 1.25rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.95rem;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			transform 0.12s ease,
			background 0.15s ease;
	}
	.schale:hover {
		border-color: var(--akzent);
		transform: translateY(-1px);
	}
	.schale:active {
		transform: translateY(0) scale(0.99);
	}
	.schale-text {
		flex: 1;
	}
	.schale-pfeil {
		color: var(--text-fluester);
	}
	.schale-titel {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-fluester);
		margin-top: 0.4rem;
	}

	/* Chips-Variante: kleine Bubbles nebeneinander (Skizze 2) */
	.schalen.chips {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.schalen.chips .schale {
		width: auto;
		font-size: 0.85rem;
		padding: 0.45rem 0.9rem;
	}
	@keyframes einblenden {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		transition:
			background 0.15s ease,
			transform 0.1s ease;
	}
	.aufdecken:hover {
		background: var(--linie-stark);
	}
	.aufdecken:active {
		transform: scale(0.97);
	}

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

	/* Signal-Wort: gelb markiert wie im Lehrbuch, kein Verweis-Look */
	:global(.inline-link.signal) {
		color: var(--text);
		text-decoration: none;
		background: color-mix(in srgb, var(--typ-thema) 22%, transparent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--typ-thema) 22%, transparent);
		border-radius: 3px;
	}
	:global(.inline-link.signal:hover) {
		background: color-mix(in srgb, var(--typ-thema) 38%, transparent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--typ-thema) 38%, transparent);
	}
</style>
