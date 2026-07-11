<script lang="ts">
	import { klartext, rendere } from '$lib/markdown';
	import type { Karte } from '$lib/types';

	let { data } = $props();

	// Nachschlagewerke einmal bauen
	const nodeMap = $derived(new Map(data.nodes.map((n) => [n.id, n])));
	const kinderVon = $derived.by(() => {
		const m = new Map<string, string[]>();
		for (const e of data.edges) {
			if (!m.has(e.from_id)) m.set(e.from_id, []);
			m.get(e.from_id)!.push(e.to_id);
		}
		return m;
	});

	// Der Pfad IST der Zustand: eine Kette gewählter IDs.
	// Spalte i zeigt die Kinder von pfad[i].
	// Der Pfad startet einmal bei der Wurzel und lebt dann eigenständig —
	// Abkopplung vom Prop ist gewollt.
	// svelte-ignore state_referenced_locally
	let pfad = $state<string[]>([data.start.id]);

	type Spalte = { elternId: string; eintraege: Karte[] };
	const spalten = $derived.by(() => {
		// Spalte 0 ist die Wurzel: der Fall selbst, wie im Finder
		// der Ausgangsordner sichtbar bleibt.
		const s: Spalte[] = [{ elternId: '__wurzel', eintraege: [data.start] }];
		for (const id of pfad) {
			const kinder = (kinderVon.get(id) ?? [])
				.map((kid) => nodeMap.get(kid))
				.filter((k): k is Karte => !!k);
			if (kinder.length > 0) s.push({ elternId: id, eintraege: kinder });
		}
		return s;
	});

	// Vorschau: die zuletzt gewählte Karte (Pfad-Ende, außer Start)
	const gewaehlt = $derived(pfad.length > 1 ? (nodeMap.get(pfad[pfad.length - 1]) ?? null) : null);

	function waehle(spaltenIndex: number, id: string) {
		// Wurzel-Klick: Pfad auf den Anfang zurücksetzen
		if (spaltenIndex === 0) {
			pfad = [data.start.id];
			return;
		}
		// Pfad bis zu dieser Spalte behalten, Wahl anhängen —
		// alles Tiefere klappt damit automatisch zu (Akkordeon gratis)
		pfad = [...pfad.slice(0, spaltenIndex), id];
	}

	function hatKinder(id: string): boolean {
		return (kinderVon.get(id)?.length ?? 0) > 0;
	}

	// Neue Spalte erscheint → sanft zu ihr scrollen
	let band: HTMLElement | null = $state(null);
	$effect(() => {
		pfad.length;
		band?.scrollTo({ left: band.scrollWidth, behavior: 'smooth' });
	});
</script>

<div class="kopf">
	<a class="zurueck" href={`/karte/${data.start.id}`}>‹ Zur Karte</a>
	<h1>{klartext(data.start.title ?? data.start.front)}</h1>
</div>

<div class="band" bind:this={band}>
	{#each spalten as spalte, i (spalte.elternId)}
		<div class="spalte">
			{#each spalte.eintraege as eintrag (eintrag.id)}
				<button
					class="eintrag"
					class:im-pfad={i === 0 ? true : pfad[i] === eintrag.id}
					onclick={() => waehle(i, eintrag.id)}
				>
					<span class="typ-punkt" style:--punkt="var(--typ-{eintrag.type})"></span>
					<span class="eintrag-text">{klartext(eintrag.title ?? eintrag.front)}</span>
					{#if hatKinder(eintrag.id)}<span class="pfeil">›</span>{/if}
				</button>
			{/each}
		</div>
	{/each}

	{#if gewaehlt}
		<div class="spalte vorschau">
			<div class="vorschau-typ">
				<span class="typ-punkt" style:--punkt="var(--typ-{gewaehlt.type})"></span>
				{gewaehlt.type}
			</div>
			<div class="vorschau-front">{@html rendere(gewaehlt.front)}</div>
			<a class="vorschau-lernen" href={`/karte/${gewaehlt.id}`}>Lernen ›</a>
		</div>
	{/if}
</div>

<style>
	.kopf {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
		padding: 1.5rem 2rem 1rem;
	}
	.zurueck {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.85rem;
		white-space: nowrap;
		transition: color 0.15s ease;
	}
	.zurueck:hover {
		color: var(--text);
	}
	h1 {
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Das Spaltenband: füllt den Rest der Höhe, scrollt horizontal */
	.band {
		display: flex;
		height: calc(100vh - 4.5rem);
		overflow-x: auto;
		border-top: 1px solid var(--linie);
		padding: 1.5rem 1rem;
		gap: 0.5rem;
	}
	.spalte {
		flex: 0 0 18rem;
		max-height: 100%;
		overflow-y: auto;
		border-right: 1px solid var(--linie);
		padding: 0.4rem 1rem 0.4rem 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		animation: spalte-auf 0.18s ease;
	}
	@keyframes spalte-auf {
		from {
			opacity: 0;
			transform: translateX(-6px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.eintrag {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		background: none;
		border: none;
		border-radius: var(--radius-m);
		padding: 0.65rem 0.8rem;
		color: var(--text-leise);
		font-family: inherit;
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}
	.eintrag:hover {
		background: var(--flaeche);
		color: var(--text);
	}
	/* Der aktive Pfad: gefüllt, hell — man sieht die Spur durch den Baum */
	.eintrag.im-pfad {
		background: var(--flaeche-hoch);
		color: var(--text);
	}
	.typ-punkt {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
		flex-shrink: 0;
	}
	.eintrag-text {
		flex: 1;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.pfeil {
		color: var(--text-fluester);
		flex-shrink: 0;
	}

	/* Vorschau-Spalte: das Finder-Detailfenster */
	.vorschau {
		flex: 0 0 20rem;
		padding: 1.25rem;
		gap: 0.9rem;
	}
	.vorschau-typ {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-fluester);
	}
	.vorschau-front {
		font-size: 0.95rem;
		line-height: 1.55;
	}
	.vorschau-front :global(p) {
		margin: 0 0 0.6em;
	}
	.vorschau-lernen {
		align-self: flex-start;
		color: var(--akzent);
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 500;
	}
	.vorschau-lernen:hover {
		color: var(--akzent-hover);
	}
</style>
