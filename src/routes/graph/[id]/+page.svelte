<script lang="ts">
	import { klartext, rendere } from '$lib/markdown';
	import { parseZeilen } from '$lib/schalen';
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

	// Verzweigt eine Karte weiter? (Struktur-Zeilen oder Kanten)
	function verzweigt(id: string): boolean {
		const n = nodeMap.get(id);
		if (!n) return false;
		if (n.mode !== 'open' && n.back.trim() !== '') return true;
		return (kinderVon.get(id)?.length ?? 0) > 0;
	}

	// Der Pfad startet einmal bei der Wurzel und lebt dann eigenständig —
	// Abkopplung vom Prop ist gewollt.
	let zeigeSachverhalt = $state(false);

	// svelte-ignore state_referenced_locally
	let pfad = $state<string[]>([data.start.id]);

	// Ein Spalten-Eintrag: Section (Überschrift), verlinkte Schale
	// (klickbar wenn verzweigt, sonst gedimmt) oder unverlinkte Schale.
	type Eintrag = { label: string; ziel: string | null; section?: boolean };
	type Spalte = { elternId: string; eintraege: Eintrag[] };

	const spalten = $derived.by(() => {
		const wurzel: Eintrag = {
			label: klartext(data.start.title ?? data.start.front),
			ziel: data.start.id
		};
		const s: Spalte[] = [{ elternId: '__wurzel', eintraege: [wurzel] }];

		for (const id of pfad) {
			const node = nodeMap.get(id);
			if (!node) continue;

			let eintraege: Eintrag[];
			if (node.mode !== 'open' && node.back.trim() !== '') {
				// Struktur-Karte: der TEXT ist die Wahrheit — ALLE Zeilen
				// zeigen, auch Sections und unverlinkte Schalen.
				eintraege = parseZeilen(node.back).map((z) => ({
					label: klartext(z.label),
					ziel: z.ziel,
					section: z.section
				}));
			} else {
				// Offene Karte: Kinder aus den Kanten
				eintraege = (kinderVon.get(id) ?? [])
					.map((kid) => nodeMap.get(kid))
					.filter((k): k is Karte => !!k)
					.map((k) => ({ label: klartext(k.title ?? k.front), ziel: k.id }));
			}
			if (eintraege.length > 0) s.push({ elternId: id, eintraege });
		}
		return s;
	});

	const gewaehlt = $derived(
		pfad.length > 1 ? (nodeMap.get(pfad[pfad.length - 1]) ?? null) : null
	);

	function waehle(spaltenIndex: number, ziel: string) {
		if (spaltenIndex === 0) {
			pfad = [data.start.id];
			return;
		}
		pfad = [...pfad.slice(0, spaltenIndex), ziel];
	}

	function typVon(ziel: string | null): string {
		return (ziel && nodeMap.get(ziel)?.type) || 'simpel';
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
	{#if data.start.front.trim()}
		<button
			class="sv-toggle"
			class:aktiv={zeigeSachverhalt}
			onclick={() => (zeigeSachverhalt = !zeigeSachverhalt)}
		>
			Sachverhalt
		</button>
	{/if}
</div>

{#if zeigeSachverhalt && data.start.front.trim()}
	<div class="sv-panel">
		{#if data.start.ref}<div class="sv-ref">{data.start.ref}</div>{/if}
		<div class="sv-text">{@html rendere(data.start.front)}</div>
	</div>
{/if}

<div class="band" bind:this={band}>
	{#each spalten as spalte, i (spalte.elternId)}
		<div class="spalte">
			{#each spalte.eintraege as eintrag, j (j)}
				{#if eintrag.section}
					<div class="section">{eintrag.label}</div>
				{:else if eintrag.ziel && verzweigt(eintrag.ziel)}
					<button
						class="eintrag"
						class:im-pfad={i === 0 ? true : pfad[i] === eintrag.ziel}
						onclick={() => waehle(i, eintrag.ziel!)}
					>
						<span class="typ-punkt" style:--punkt="var(--typ-{typVon(eintrag.ziel)})"></span>
						<span class="eintrag-text">{eintrag.label}</span>
						<span class="pfeil">›</span>
					</button>
				{:else}
					<!-- Blatt (verlinkt ohne Verzweigung) oder unverlinkte
					     Schale: sichtbar für den Überblick, gedimmt, nicht klickbar -->
					<div class="eintrag blatt">
						<span class="typ-punkt" style:--punkt="var(--typ-{typVon(eintrag.ziel)})"></span>
						<span class="eintrag-text">{eintrag.label}</span>
					</div>
				{/if}
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

	.sv-toggle {
		background: none;
		border: 1px solid var(--linie);
		border-radius: 999px;
		padding: 0.3rem 0.9rem;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.sv-toggle:hover {
		color: var(--text-leise);
		border-color: var(--linie-stark);
	}
	.sv-toggle.aktiv {
		color: var(--text);
		background: var(--flaeche-hoch);
		border-color: var(--linie-stark);
	}

	/* Sachverhalt-Panel: ruhige Fläche unter dem Kopf, klappt auf */
	.sv-panel {
		margin: 0 2rem 0.5rem;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 1.1rem 1.4rem;
		max-height: 40vh;
		overflow-y: auto;
		animation: sv-auf 0.18s ease;
	}
	@keyframes sv-auf {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.sv-ref {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--text-fluester);
		margin-bottom: 0.5rem;
	}
	.sv-text {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-leise);
	}
	.sv-text :global(p) {
		margin: 0 0 0.6em;
	}
	.sv-text :global(p:last-child) {
		margin-bottom: 0;
	}
	.sv-text :global(strong) {
		color: var(--typ-definition);
		font-weight: 600;
	}

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

	/* Section in der Spalte: graue Kapitälchen-Zeile mit Linie —
	   gleiche Sprache wie im Lern-Modus */
	.section {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-fluester);
		margin: 0.5rem 0 0.15rem;
		padding: 0 0.8rem;
	}
	.section::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--linie);
	}

	.eintrag {
		display: flex;
		align-items: flex-start;
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
	.eintrag.im-pfad {
		background: var(--flaeche-hoch);
		color: var(--text);
	}

	/* Blätter: gedimmt, aber gut lesbar — der Gesamtüberblick */
	.eintrag.blatt {
		cursor: default;
		color: var(--text-fluester);
	}
	.eintrag.blatt:hover {
		background: none;
		color: var(--text-fluester);
	}

	.typ-punkt {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
		flex-shrink: 0;
		margin-top: 0.35rem;
	}
	.eintrag-text {
		flex: 1;
		line-height: 1.4;
	}
	.pfeil {
		color: var(--text-fluester);
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

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
