<script lang="ts">
	import type { Karte } from '$lib/types';
	import { klartext } from '$lib/markdown';

	let { data } = $props();

	let suche = $state('');
	let gebiet = $state<string | null>(null);
	let offen = $state<Record<string, boolean>>({});

	const GEBIET_NAMEN: Record<string, string> = {
		zivilrecht: 'Zivilrecht',
		strafrecht: 'Strafrecht',
		oeffentliches_recht: 'Öffentliches Recht',
		kapitalgesellschaftsrecht: 'KapGesR',
		wissen_zivilrecht: 'Wissen ZR',
		wissen_kapitalgesellschaftsrecht: 'Wissen KapGesR',
		_: 'Ohne Gebiet'
	};
	function gebietsName(a: string): string {
		return GEBIET_NAMEN[a] ?? a;
	}

	// Filter-Pillen aus den Daten
	const gebiete = $derived.by(() => {
		const vorhanden = new Set(
			data.nodes.map((n: Karte) => n.area).filter((a): a is string => !!a)
		);
		const bekannt = Object.keys(GEBIET_NAMEN).filter((a) => vorhanden.has(a));
		const unbekannt = [...vorhanden].filter((a) => !(a in GEBIET_NAMEN)).sort();
		return [...bekannt, ...unbekannt];
	});

	// Suche + Gebietsfilter
	const gefiltert = $derived(
		data.nodes.filter((n: Karte) => {
			if (gebiet && n.area !== gebiet) return false;
			const q = suche.toLowerCase();
			return (
				n.front.toLowerCase().includes(q) ||
				(n.title ?? '').toLowerCase().includes(q) ||
				n.id.toLowerCase().includes(q)
			);
		})
	);
	const faelle = $derived(gefiltert.filter((n: Karte) => n.type === 'fall'));

	// Gruppierung: von jedem Fall aus per Kanten alle Kinder sammeln.
	// Nicht zugeordnete Karten landen unter "Freistehend", nach Gebiet.
	type Gruppe = { fall: Karte; karten: Karte[] };
	const gruppen = $derived.by(() => {
		const nodesById = new Map(gefiltert.map((n) => [n.id, n]));
		const kanten = new Map<string, string[]>();
		for (const e of data.edges) {
			if (!kanten.has(e.from_id)) kanten.set(e.from_id, []);
			kanten.get(e.from_id)!.push(e.to_id);
		}
		const gs: Gruppe[] = [];
		const zugeordnet = new Set<string>();
		for (const fall of faelle) {
			const besucht = new Set<string>();
			const stapel = [fall.id];
			while (stapel.length > 0) {
				const id = stapel.pop()!;
				if (besucht.has(id)) continue;
				besucht.add(id);
				for (const kind of kanten.get(id) ?? []) stapel.push(kind);
			}
			const karten = [...besucht]
				.map((id) => nodesById.get(id))
				.filter((n): n is Karte => !!n && n.id !== fall.id);
			gs.push({ fall, karten });
			besucht.forEach((id) => zugeordnet.add(id));
		}
		return { gs, frei: gefiltert.filter((n) => !zugeordnet.has(n.id)) };
	});

	const freiNachArea = $derived.by(() => {
		const m = new Map<string, Karte[]>();
		for (const n of gruppen.frei) {
			const a = n.area ?? '_';
			if (!m.has(a)) m.set(a, []);
			m.get(a)!.push(n);
		}
		return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<div class="seite">
	<header class="kopf">
		<a class="verwalten-link" href="/verwalten" title="Verwalten">Verwalten</a>
		<h1>Facta</h1>
		<p class="untertitel">Dein vernetztes Wissen für die Fallbearbeitung.</p>
	</header>

	<input class="suche" type="search" placeholder="Karten durchsuchen …" bind:value={suche} />

	{#if gebiete.length > 0}
		<div class="gebiete">
			<button class="pille" class:aktiv={gebiet === null} onclick={() => (gebiet = null)}>
				Alle
			</button>
			{#each gebiete as g (g)}
				<button
					class="pille"
					class:aktiv={gebiet === g}
					onclick={() => (gebiet = gebiet === g ? null : g)}
				>
					{gebietsName(g)}
				</button>
			{/each}
		</div>
	{/if}

	{#if data.nodes.length === 0}
		<div class="leer">
			<p>Noch keine Karten.</p>
			<p class="leer-hinweis">Importiere einen Fall oder lege los.</p>
		</div>
	{:else}
		{#if faelle.length > 0}
			<section>
				<h2>Fälle</h2>
				<div class="fall-grid">
					{#each faelle as fall (fall.id)}
						<a class="fall-karte" href={`/karte/${fall.id}`}>
							<span class="typ-punkt" style:--punkt="var(--typ-fall)"></span>
							<span class="fall-front">{klartext(fall.title ?? fall.front)}</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if gruppen.gs.length > 0}
			<section>
				<h2>Kartenbäume nach Fall</h2>
				{#each gruppen.gs as g (g.fall.id)}
					<div class="fall-block">
						<div class="fall-kopf" role="button" tabindex="0"
							onclick={() => (offen[g.fall.id] = !offen[g.fall.id])}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); offen[g.fall.id] = !offen[g.fall.id]; } }}>
							<span class="pfeil" class:auf={offen[g.fall.id]}>›</span>
							<span class="typ-punkt" style:--punkt="var(--typ-fall)"></span>
							<a class="fall-titel" href={`/karte/${g.fall.id}`} onclick={(e) => e.stopPropagation()}>
								{klartext(g.fall.title ?? g.fall.front)}
							</a>
							<span class="fall-zahl">{g.karten.length} Karten</span>
						</div>
						{#if offen[g.fall.id]}
							<div class="unter-liste">
								{#each g.karten as node (node.id)}
									<a class="unter-zeile" href={`/karte/${node.id}`}>
										<span class="typ-punkt" style:--punkt="var(--typ-{node.type})"></span>
										<span class="zeile-front">{klartext(node.title ?? node.front)}</span>
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</section>
		{/if}

		{#if gruppen.frei.length > 0}
			<section>
				<h2>Freistehende Karten</h2>
				{#each freiNachArea as [area, karten] (area)}
					<div class="area-block">
						<div class="area-kopf">
							{gebietsName(area)}
							<span class="fall-zahl">{karten.length}</span>
						</div>
						<div class="unter-liste">
							{#each karten as node (node.id)}
								<a class="unter-zeile" href={`/karte/${node.id}`}>
									<span class="typ-punkt" style:--punkt="var(--typ-{node.type})"></span>
									<span class="zeile-front">{klartext(node.title ?? node.front)}</span>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</section>
		{/if}

		{#if gefiltert.length === 0}
			<p class="keine-treffer">Keine Karten in dieser Auswahl.</p>
		{/if}
	{/if}
</div>

<style>
	.seite {
		max-width: 44rem;
		margin: 0 auto;
		padding: 4rem 1.5rem 6rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.kopf {
		text-align: center;
		position: relative;
	}
	/* Verwalten oben rechts: still, immer erreichbar */
	.verwalten-link {
		position: absolute;
		top: 0;
		right: 0;
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.82rem;
		font-weight: 500;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--linie);
		transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}
	.verwalten-link:hover {
		color: var(--text);
		border-color: var(--linie-stark);
		background: var(--flaeche);
	}
	h1 {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		margin: 0;
	}
	.untertitel {
		color: var(--text-fluester);
		margin: 0.5rem 0 0;
		font-size: 0.95rem;
	}

	.suche {
		width: 100%;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.7rem 1rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.95rem;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.suche::placeholder { color: var(--text-fluester); }
	.suche:focus {
		outline: none;
		border-color: var(--akzent);
		background: var(--flaeche-hoch);
	}

	.gebiete {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		justify-content: center;
		margin-top: -0.75rem;
	}
	.pille {
		background: none;
		border: 1px solid var(--linie);
		border-radius: 999px;
		padding: 0.35rem 0.95rem;
		color: var(--text-leise);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
	}
	.pille:hover { border-color: var(--linie-stark); color: var(--text); }
	.pille:active { transform: scale(0.96); }
	.pille.aktiv {
		background: var(--text);
		border-color: var(--text);
		color: var(--bg);
	}

	h2 {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-fluester);
		margin: 0 0 0.9rem;
	}

	.fall-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.9rem;
	}
	.fall-karte {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 1.1rem 1.2rem;
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
	}
	.fall-karte:hover {
		border-color: var(--linie-stark);
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}
	.fall-karte:active {
		transform: translateY(0) scale(0.985);
		box-shadow: none;
	}
	.fall-front { font-size: 0.95rem; line-height: 1.45; font-weight: 500; }

	.typ-punkt {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
		flex-shrink: 0;
	}

	/* Fall-Block: klappbar */
	.fall-block {
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		margin-bottom: 0.5rem;
		overflow: hidden;
	}
	.fall-kopf {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		color: var(--text);
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.1s ease;
	}
	.fall-kopf:hover { background: var(--flaeche); }
	.pfeil {
		color: var(--text-fluester);
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}
	.pfeil.auf { transform: rotate(90deg); }
	.fall-titel {
		flex: 1;
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fall-titel:hover { color: var(--akzent); }
	.fall-zahl {
		font-size: 0.75rem;
		color: var(--text-fluester);
		flex-shrink: 0;
	}
	.unter-liste {
		border-top: 1px solid var(--linie);
		background: color-mix(in srgb, var(--flaeche) 40%, transparent);
	}
	.unter-zeile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 1rem 0.55rem 2.5rem;
		text-decoration: none;
		color: var(--text);
		font-size: 0.88rem;
		border-bottom: 1px solid var(--linie);
		transition: background 0.1s ease;
	}
	.unter-zeile:last-child { border-bottom: none; }
	.unter-zeile:hover { background: var(--flaeche); }
	.zeile-front {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.area-block {
		margin-bottom: 0.75rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		overflow: hidden;
	}
	.area-kopf {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 1rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-fluester);
		background: color-mix(in srgb, var(--flaeche) 60%, transparent);
	}

	.leer {
		text-align: center;
		padding: 4rem 0;
		color: var(--text-leise);
	}
	.leer-hinweis { color: var(--text-fluester); font-size: 0.85rem; }
	.keine-treffer {
		padding: 2rem 0;
		margin: 0;
		text-align: center;
		font-size: 0.9rem;
		color: var(--text-fluester);
	}
</style>
