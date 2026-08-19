<script lang="ts">
	import { klartext, rendere } from '$lib/markdown';
	import { parseZeilen } from '$lib/schalen';
	import type { Karte } from '$lib/types';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let zeigeSachverhalt = $state(false);
	// Ein angeklicktes Blatt (verlinkt, aber ohne Verzweigung): sein
	// voller Text erscheint rechts im Detail-Panel.
	let blattVorschau = $state<string | null>(null);
	const streifzugRest = $derived.by(() => {
		const raw = page.url.searchParams.get('streifzug');
		return raw ? raw.split(',').filter(Boolean) : [];
	});
	const streifzugAktiv = $derived(page.url.searchParams.has('streifzug'));
	const gebietFilter = $derived(page.url.searchParams.get('area'));
	const bibliothekLink = $derived(
		gebietFilter ? `/?area=${encodeURIComponent(gebietFilter)}` : '/'
	);
	function zielLink(art: 'karte' | 'graph', id: string, rest = streifzugRest): string {
		const params = new URLSearchParams();
		if (streifzugAktiv) params.set('streifzug', rest.join(','));
		if (gebietFilter) params.set('area', gebietFilter);
		const query = params.toString();
		return `/${art}/${id}${query ? `?${query}` : ''}`;
	}
	function naechsterBaum() {
		if (streifzugRest.length === 0) {
			goto(bibliothekLink);
			return;
		}
		const [naechster, ...rest] = streifzugRest;
		goto(zielLink('graph', naechster, rest));
	}

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

	// Verzweigt eine Karte weiter?
	function verzweigt(id: string): boolean {
		const n = nodeMap.get(id);
		if (!n) return false;
		if (n.mode !== 'open' && n.back.trim() !== '') return true;
		return (kinderVon.get(id)?.length ?? 0) > 0;
	}

	// svelte-ignore state_referenced_locally
	let pfad = $state<string[]>([data.start.id]);

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
				eintraege = parseZeilen(node.back).map((z) => ({
					label: klartext(z.label),
					ziel: z.ziel,
					section: z.section
				}));
			} else {
				eintraege = (kinderVon.get(id) ?? [])
					.map((kid) => nodeMap.get(kid))
					.filter((k): k is Karte => !!k)
					.map((k) => ({ label: klartext(k.title ?? k.front), ziel: k.id }));
			}
			if (eintraege.length > 0) s.push({ elternId: id, eintraege });
		}
		return s;
	});

	// Die gerade "im Fokus" stehende Karte: das angeklickte Blatt
	// (falls eins gesetzt ist), sonst das Ende des Pfads. Sie erscheint
	// rechts im Detail-Panel als Lese-Fläche.
	const gewaehlt = $derived(
		blattVorschau
			? (nodeMap.get(blattVorschau) ?? null)
			: pfad.length > 1
				? (nodeMap.get(pfad[pfad.length - 1]) ?? null)
				: null
	);

	function waehle(spaltenIndex: number, ziel: string) {
		blattVorschau = null;
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
		void pfad.length;
		band?.scrollTo({ left: band.scrollWidth, behavior: 'smooth' });
	});
</script>

<div class="kopf">
	<a class="zurueck" href={zielLink('karte', data.start.id)}>‹ Lernen</a>
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

{#if streifzugAktiv}
	<div class="streifzug-hud">
		<span class="streifzug-label">Zufälliger Baum</span>
		{#if streifzugRest.length > 0}
			<button class="streifzug-knopf" onclick={naechsterBaum}>Nächster Baum ›</button>
			<span class="streifzug-rest">noch {streifzugRest.length}</span>
		{:else}
			<span class="streifzug-rest">letzter Baum</span>
			<button class="streifzug-knopf" onclick={() => goto(bibliothekLink)}>Beenden</button>
		{/if}
	</div>
{/if}

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
				{:else if eintrag.ziel}
					<button
						class="eintrag blatt"
						class:im-pfad={blattVorschau === eintrag.ziel}
						onclick={() => {
							// Tiefere Spalten kollabieren, damit rechts und links dasselbe Ende zeigen
							pfad = pfad.slice(0, i);
							blattVorschau = eintrag.ziel;
						}}
					>
						<span class="typ-punkt" style:--punkt="var(--typ-{typVon(eintrag.ziel)})"></span>
						<span class="eintrag-text">{eintrag.label}</span>
					</button>
				{:else}
					<div class="eintrag blatt">
						<span class="typ-punkt" style:--punkt="var(--typ-simpel)"></span>
						<span class="eintrag-text">{eintrag.label}</span>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
</div>

{#if gewaehlt}
	<aside class="detail">
		<div class="detail-typ">
			<span class="typ-punkt" style:--punkt="var(--typ-{gewaehlt.type})"></span>
			<span>{gewaehlt.type}</span>
			{#if gewaehlt.ref}<span class="detail-ref">{gewaehlt.ref}</span>{/if}
		</div>
		{#if gewaehlt.title}
			<h2 class="detail-titel">{gewaehlt.title}</h2>
		{/if}
		<div class="detail-front">{@html rendere(gewaehlt.front)}</div>
		{#if gewaehlt.back.trim()}
			<div class="detail-back">{@html rendere(gewaehlt.back)}</div>
		{/if}
		{#if gewaehlt.chips.trim()}
			<div class="detail-chips">
				{#each parseZeilen(gewaehlt.chips) as chip, i (i)}
					{#if chip.ziel}
						<button class="chip" onclick={() => (blattVorschau = chip.ziel)}>
							{chip.label}
						</button>
					{:else}
						<span class="chip chip-passiv">{chip.label}</span>
					{/if}
				{/each}
			</div>
		{/if}
	</aside>
{/if}

<style>
	:global(body) {
		overflow: hidden;
	}

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

	.sv-panel {
		margin: 0 2rem 0.5rem;
		margin-right: calc(32rem + 2rem); /* Platz fürs Detail-Panel + Luft */
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

	/* Band links: horizontal scrollbar, rechts Raum fürs Detail-Panel */
	.band {
		display: flex;
		height: calc(100vh - 4.5rem);
		overflow-x: auto;
		overflow-y: hidden;
		border-top: 1px solid var(--linie);
		padding: 1.5rem 1rem;
		gap: 0.5rem;
		margin-right: 32rem;
	}
	.spalte {
		flex: 0 0 15rem;
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
	.eintrag.blatt {
		color: var(--text-fluester);
	}
	button.eintrag.blatt:hover {
		background: var(--flaeche);
		color: var(--text-leise);
	}
	div.eintrag.blatt {
		cursor: default;
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

	/* Detail-Panel rechts: fest positioniert, atmet ruhig.
	   Das ist die Lese-Fläche — Titel prominent, Text im Fluss. */
	.detail {
		position: fixed;
		top: 4.5rem;
		right: 0;
		bottom: 0;
		width: 32rem;
		background: var(--flaeche);
		border-left: 1px solid var(--linie);
		padding: 2rem 2.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: detail-auf 0.2s ease;
	}
	@keyframes detail-auf {
		from {
			opacity: 0;
			transform: translateX(8px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	.detail-typ {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-fluester);
	}
	.detail-ref {
		margin-left: auto;
		font-size: 0.7rem;
	}
	.detail-titel {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
		margin: 0;
		line-height: 1.35;
	}
	.detail-front {
		font-size: 1rem;
		line-height: 1.65;
		color: var(--text);
	}
	.detail-front :global(p) {
		margin: 0 0 0.75em;
	}
	.detail-front :global(p:last-child) {
		margin-bottom: 0;
	}
	.detail-front :global(strong) {
		color: var(--typ-definition);
		font-weight: 600;
	}
	.detail-front :global(em) {
		font-style: italic;
	}
	/* Rückseite: gestrichelte Linie als weiche Grenze */
	.detail-back {
		padding-top: 1.25rem;
		margin-top: 0.5rem;
		border-top: 1px dashed var(--linie-stark);
		font-size: 0.98rem;
		line-height: 1.65;
		color: var(--text-leise);
	}
	.detail-back :global(p) {
		margin: 0 0 0.75em;
	}
	.detail-back :global(strong) {
		color: var(--typ-definition);
		font-weight: 600;
	}
	.detail-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.75rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--linie);
	}
	.chip {
		background: color-mix(in srgb, var(--typ-thema) 10%, var(--flaeche));
		border: 1px solid color-mix(in srgb, var(--typ-thema) 30%, transparent);
		border-radius: 0.95rem;
		padding: 0.3rem 0.75rem;
		color: var(--text-leise);
		font-family: inherit;
		font-size: 0.78rem;
		cursor: pointer;
		text-align: left;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.chip:hover {
		border-color: var(--typ-thema);
		color: var(--text);
	}
	.chip-passiv {
		cursor: default;
		opacity: 0.7;
	}
	.streifzug-hud {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: color-mix(in srgb, var(--flaeche) 88%, transparent);
		backdrop-filter: blur(12px);
		border: 1px solid var(--linie);
		border-radius: 999px;
		padding: 0.35rem 0.5rem 0.35rem 0.9rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
	}
	.streifzug-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-fluester);
		font-weight: 500;
	}
	.streifzug-knopf {
		background: var(--akzent);
		color: white;
		border: 0;
		border-radius: 999px;
		padding: 0.3rem 0.9rem;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
	}
	.streifzug-rest {
		font-size: 0.72rem;
		color: var(--text-fluester);
	}
	@media (max-width: 640px) {
		.kopf {
			padding: 1rem;
			gap: 0.75rem;
		}
		.kopf h1 {
			font-size: 0.95rem;
		}
		.streifzug-label,
		.streifzug-rest {
			display: none;
		}
		.streifzug-hud {
			right: 0.75rem;
			bottom: 0.75rem;
		}
	}
</style>
