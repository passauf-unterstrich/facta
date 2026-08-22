<script lang="ts">
	import type { Karte, KartenVorschau } from '$lib/types';
	import LernKarte from '$lib/components/LernKarte.svelte';
	import { klartext } from '$lib/markdown';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	let suche = $state('');
	let gebiet = $state<string | null>(page.url.searchParams.get('area'));
	let offen = $state<Record<string, boolean>>({});
	let suchtreffer = $state<Karte[]>([]);
	let sucheLaedt = $state(false);
	let sucheFehler = $state('');
	const sucheAktiv = $derived(suche.trim().length > 0);

	const GEBIET_NAMEN: Record<string, string> = {
		zivilrecht: 'Zivilrecht',
		strafrecht: 'Strafrecht',
		oeffentliches_recht: 'Öffentliches Recht',
		kapitalgesellschaftsrecht: 'KapGesR',
		wissen_zivilrecht: 'Wissen ZR',
		wissen_kapitalgesellschaftsrecht: 'Wissen KapGesR',
		kernwissen_klausur: 'Kernwissen Klausur',
		_: 'Ohne Gebiet'
	};
	function gebietsName(a: string): string {
		return GEBIET_NAMEN[a] ?? a;
	}
	function waehleGebiet(neu: string | null) {
		gebiet = neu;
		goto(neu ? `/?area=${encodeURIComponent(neu)}` : '/', {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}
	function kartenLink(id: string): string {
		return `/karte/${id}${gebiet ? `?area=${encodeURIComponent(gebiet)}` : ''}`;
	}
	function fallDeckblatt(fall: KartenVorschau): string {
		return klartext(fall.ref?.trim() || fall.title || fall.front);
	}

	// Jeder Karte wird für die Suchansicht der auf kürzestem Weg erreichbare
	// Fallknoten zugeordnet. So führt „Zum Hauptbaum“ auch bei tiefen Karten
	// direkt auf das Deckblatt des Falls.
	const hauptbaumById = $derived.by(() => {
		const nodes = data.nodes as KartenVorschau[];
		const nodesById = new Map(nodes.map((node) => [node.id, node]));
		const kinder = new Map<string, string[]>();
		for (const edge of data.edges) {
			if (!kinder.has(edge.from_id)) kinder.set(edge.from_id, []);
			kinder.get(edge.from_id)!.push(edge.to_id);
		}
		const wurzeln = nodes
			.filter((node) => node.type === 'fall')
			.sort((a, b) => fallDeckblatt(a).localeCompare(fallDeckblatt(b), 'de', { numeric: true }));
		const zuordnung = new Map<string, KartenVorschau>();
		const warteschlange: Array<{ id: string; wurzel: KartenVorschau }> = [];
		for (const wurzel of wurzeln) {
			zuordnung.set(wurzel.id, wurzel);
			warteschlange.push({ id: wurzel.id, wurzel });
		}
		for (let index = 0; index < warteschlange.length; index++) {
			const aktuell = warteschlange[index];
			for (const kindId of kinder.get(aktuell.id) ?? []) {
				if (!nodesById.has(kindId) || zuordnung.has(kindId)) continue;
				zuordnung.set(kindId, aktuell.wurzel);
				warteschlange.push({ id: kindId, wurzel: aktuell.wurzel });
			}
		}
		// Ältere Imports enthalten vereinzelt keine durchgehende Zwischenkante,
		// tragen aber weiterhin denselben stabilen ID-Stamm wie ihre Fallwurzel.
		// Dieser eng begrenzte Fallback ordnet z. B. u_kap2_e10_t1__i_rechtsweg
		// zuverlässig u_kap2_e10_t1__fall zu, ohne fremde Bäume zu vermischen.
		const wurzelStaemme = wurzeln
			.filter((wurzel) => wurzel.id.endsWith('__fall'))
			.map((wurzel) => ({ wurzel, stamm: wurzel.id.slice(0, -'__fall'.length) }))
			.sort((a, b) => b.stamm.length - a.stamm.length);
		for (const node of nodes) {
			if (zuordnung.has(node.id)) continue;
			const passend = wurzelStaemme.find(({ stamm }) => node.id.startsWith(`${stamm}__`));
			if (passend) zuordnung.set(node.id, passend.wurzel);
		}
		return zuordnung;
	});

	$effect(() => {
		const begriff = suche.replace(/\s+/g, ' ').trim();
		const aktivesGebiet = gebiet;
		if (begriff.length < 2) {
			suchtreffer = [];
			sucheLaedt = false;
			sucheFehler = '';
			return;
		}

		suchtreffer = [];
		sucheLaedt = true;
		sucheFehler = '';
		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			try {
				const params = new URLSearchParams({ q: begriff });
				if (aktivesGebiet) params.set('area', aktivesGebiet);
				const response = await fetch(`/api/search?${params}`, { signal: controller.signal });
				if (!response.ok) throw new Error('Die Suche konnte nicht geladen werden.');
				const result = (await response.json()) as { results?: Karte[] };
				suchtreffer = Array.isArray(result.results) ? result.results : [];
			} catch (err) {
				if (controller.signal.aborted) return;
				sucheFehler = err instanceof Error ? err.message : 'Die Suche ist fehlgeschlagen.';
			} finally {
				if (!controller.signal.aborted) sucheLaedt = false;
			}
		}, 280);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	});

	async function abmelden() {
		await fetch('/logout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}'
		});
		window.location.assign('/login');
	}

	// Filter-Pillen aus den Daten
	const gebiete = $derived.by(() => {
		const vorhanden = new Set(
			data.nodes.map((n: KartenVorschau) => n.area).filter((a): a is string => !!a)
		);
		// Das persönliche Klausurgebiet bleibt auch im leeren Ausgangszustand
		// sichtbar. Im Gastportal erscheint es weder leer noch befüllt.
		if (data.rolle === 'owner') vorhanden.add('kernwissen_klausur');
		const bekannt = Object.keys(GEBIET_NAMEN).filter((a) => vorhanden.has(a));
		const unbekannt = [...vorhanden].filter((a) => !(a in GEBIET_NAMEN)).sort();
		return [...bekannt, ...unbekannt];
	});

	// Die normale Bibliothek bleibt leichtgewichtig und filtert nur nach Gebiet.
	// Vollständige Rückseiten lädt ausschließlich die Suche bei Bedarf nach.
	const gefiltert = $derived(
		data.nodes.filter((n: KartenVorschau) => {
			if (gebiet && n.area !== gebiet) return false;
			return true;
		})
	);
	const faelle = $derived(gefiltert.filter((n: KartenVorschau) => n.type === 'fall'));

	// Gruppierung: von jedem Fall aus per Kanten alle Kinder sammeln.
	// Nicht zugeordnete Karten landen unter "Freistehend", nach Gebiet.
	type Gruppe = { fall: KartenVorschau; karten: KartenVorschau[] };
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
				.filter((n): n is KartenVorschau => !!n && n.id !== fall.id);
			gs.push({ fall, karten });
			besucht.forEach((id) => zugeordnet.add(id));
		}
		return { gs, frei: gefiltert.filter((n) => !zugeordnet.has(n.id)) };
	});

	const freiNachArea = $derived.by(() => {
		const m = new Map<string, KartenVorschau[]>();
		for (const n of gruppen.frei) {
			const a = n.area ?? '_';
			if (!m.has(a)) m.set(a, []);
			m.get(a)!.push(n);
		}
		return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<div class="seite" class:suchmodus={sucheAktiv}>
	<header class="kopf">
		<div class="kopf-aktionen">
			{#if data.rolle === 'owner'}
				<a class="kopf-link" href="/verwalten" title="Verwalten">Verwalten</a>
			{/if}
			<button class="kopf-link" type="button" onclick={abmelden}>Abmelden</button>
		</div>
		<h1>Facta</h1>
		<p class="untertitel">
			{data.rolle === 'guest'
				? `${data.portalName} · Kursmaterialien`
				: 'Dein vernetztes Wissen für die Fallbearbeitung.'}
		</p>
	</header>

	<input
		class="suche"
		type="search"
		placeholder="In Vorder- und Rückseiten suchen, z. B. § 71 GVG …"
		aria-label="Alle Karten durchsuchen"
		bind:value={suche}
	/>

	{#if gebiete.length > 0}
		<div class="gebiete">
			<button class="pille" class:aktiv={gebiet === null} onclick={() => waehleGebiet(null)}>
				Alle
			</button>
			{#each gebiete as g (g)}
				<button
					class="pille"
					class:aktiv={gebiet === g}
					onclick={() => waehleGebiet(gebiet === g ? null : g)}
				>
					{gebietsName(g)}
				</button>
			{/each}
		</div>
	{/if}

	{#if sucheAktiv}
		<section class="suchbereich" aria-live="polite">
			<div class="suchkopf">
				<h2>Suchergebnisse</h2>
				{#if !sucheLaedt && !sucheFehler && suche.trim().length >= 2}
					<span>{suchtreffer.length} {suchtreffer.length === 1 ? 'Karte' : 'Karten'}</span>
				{/if}
			</div>

			{#if suche.trim().length < 2}
				<p class="suchhinweis">Gib mindestens zwei Zeichen ein.</p>
			{:else if sucheLaedt}
				<p class="suchhinweis">Durchsuche Vorder- und Rückseiten …</p>
			{:else if sucheFehler}
				<p class="suchhinweis suchfehler">{sucheFehler}</p>
			{:else if suchtreffer.length === 0}
				<p class="suchhinweis">Keine Karte enthält „{suche.trim()}“.</p>
			{:else}
				<div class="suchtreffer-liste">
					{#each suchtreffer as treffer (treffer.id)}
						{@const hauptbaum = hauptbaumById.get(treffer.id)}
						<div class="suchtreffer-block">
							<div class="treffer-leiste">
								<div class="treffer-zuordnung">
									<span>{gebietsName(treffer.area ?? '_')}</span>
									{#if hauptbaum}
										<span aria-hidden="true">·</span>
										<span>{fallDeckblatt(hauptbaum)}</span>
									{/if}
								</div>
								<div class="treffer-aktionen">
									{#if treffer.type !== 'fall'}
										<a class="treffer-knopf" href={kartenLink(treffer.id)}>Karte öffnen</a>
									{/if}
									{#if hauptbaum}
										<a class="treffer-knopf primaer" href={kartenLink(hauptbaum.id)}>
											{treffer.type === 'fall' ? 'Baum öffnen' : 'Zum Hauptbaum'}
										</a>
									{/if}
								</div>
							</div>
							<LernKarte
								node={treffer}
								aufgedeckt={true}
								onaufdecken={() => {}}
								onlink={(id) => goto(kartenLink(id))}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if !sucheAktiv && data.nodes.length > 0}
		<div class="streifzug-zeile">
			<a class="streifzug-pille" href={`/streifzug/karten${gebiet ? `?area=${gebiet}` : ''}`}>
				Zufällige Karte
			</a>
			<a class="streifzug-pille" href={`/streifzug/faelle${gebiet ? `?area=${gebiet}` : ''}`}>
				Zufälliger Baum
			</a>
			{#if gebiet}
				<span class="streifzug-hinweis">aus {gebietsName(gebiet)}</span>
			{/if}
		</div>
	{/if}

	{#if !sucheAktiv && data.nodes.length === 0}
		<div class="leer">
			<p>Noch keine Karten.</p>
			<p class="leer-hinweis">Importiere einen Fall oder lege los.</p>
		</div>
	{:else if !sucheAktiv}
		{#if faelle.length > 0}
			<section>
				<h2>Fälle</h2>
				<div class="fall-grid">
					{#each faelle as fall (fall.id)}
						<a class="fall-karte" href={kartenLink(fall.id)}>
							<span class="typ-punkt" style:--punkt="var(--typ-fall)"></span>
							<span class="fall-front">{fallDeckblatt(fall)}</span>
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
						<div
							class="fall-kopf"
							role="button"
							tabindex="0"
							onclick={() => (offen[g.fall.id] = !offen[g.fall.id])}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									offen[g.fall.id] = !offen[g.fall.id];
								}
							}}
						>
							<span class="pfeil" class:auf={offen[g.fall.id]}>›</span>
							<span class="typ-punkt" style:--punkt="var(--typ-fall)"></span>
							<a
								class="fall-titel"
								href={kartenLink(g.fall.id)}
								onclick={(e) => e.stopPropagation()}
							>
								{fallDeckblatt(g.fall)}
							</a>
							<span class="fall-zahl">{g.karten.length} Karten</span>
						</div>
						{#if offen[g.fall.id]}
							<div class="unter-liste">
								{#each g.karten as node (node.id)}
									<a class="unter-zeile" href={kartenLink(node.id)}>
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
								<a class="unter-zeile" href={kartenLink(node.id)}>
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
	.seite.suchmodus {
		max-width: 56rem;
	}

	.kopf {
		text-align: center;
		position: relative;
	}
	/* Leise Verwaltungsaktionen oben rechts */
	.kopf-aktionen {
		position: absolute;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.kopf-link {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.82rem;
		font-weight: 500;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--linie);
		background: transparent;
		font-family: inherit;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.kopf-link:hover {
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
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.suche::placeholder {
		color: var(--text-fluester);
	}
	.suche:focus {
		outline: none;
		border-color: var(--akzent);
		background: var(--flaeche-hoch);
	}

	.suchbereich {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.suchkopf {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.suchkopf h2 {
		margin: 0;
	}
	.suchkopf span {
		color: var(--text-fluester);
		font-size: 0.78rem;
	}
	.suchhinweis {
		margin: 0;
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--text-fluester);
		font-size: 0.9rem;
		border: 1px dashed var(--linie);
		border-radius: var(--radius-m);
	}
	.suchfehler {
		color: #ff6961;
	}
	.suchtreffer-liste {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.suchtreffer-block {
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		overflow: hidden;
		background: color-mix(in srgb, var(--flaeche) 45%, transparent);
	}
	.treffer-leiste {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 0.85rem 0.7rem 1.1rem;
		border-bottom: 1px solid var(--linie);
	}
	.treffer-zuordnung {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		color: var(--text-fluester);
		font-size: 0.75rem;
	}
	.treffer-zuordnung span:last-child {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.treffer-aktionen {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
	}
	.treffer-knopf {
		border: 1px solid var(--linie-stark);
		border-radius: 999px;
		padding: 0.4rem 0.75rem;
		color: var(--text-leise);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 500;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.treffer-knopf:hover {
		background: var(--flaeche-hoch);
		border-color: var(--text-fluester);
		color: var(--text);
	}
	.treffer-knopf.primaer {
		border-color: color-mix(in srgb, var(--akzent) 55%, var(--linie));
		color: var(--akzent);
	}
	.suchtreffer-block :global(.karte) {
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: var(--flaeche);
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
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease,
			transform 0.1s ease;
	}
	.pille:hover {
		border-color: var(--linie-stark);
		color: var(--text);
	}
	.pille:active {
		transform: scale(0.96);
	}
	/* Streifzug-Knöpfe: eigene Optik, damit klar wird — das ist Aktion, kein Filter */
	.streifzug-zeile {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: center;
		align-items: center;
		margin-top: -0.5rem;
	}
	.streifzug-pille {
		background: var(--flaeche);
		border: 1px solid var(--linie-stark);
		border-radius: 999px;
		padding: 0.45rem 1.1rem;
		color: var(--text);
		text-decoration: none;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.1s ease;
	}
	.streifzug-pille:hover {
		background: var(--flaeche-hoch);
		border-color: var(--text-fluester);
	}
	.streifzug-pille:active {
		transform: scale(0.97);
	}
	.streifzug-hinweis {
		font-size: 0.78rem;
		color: var(--text-fluester);
	}

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
		transition:
			border-color 0.15s ease,
			transform 0.15s ease,
			box-shadow 0.15s ease;
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
	.fall-front {
		font-size: 0.95rem;
		line-height: 1.45;
		font-weight: 500;
	}

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
	.fall-kopf:hover {
		background: var(--flaeche);
	}
	.pfeil {
		color: var(--text-fluester);
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}
	.pfeil.auf {
		transform: rotate(90deg);
	}
	.fall-titel {
		flex: 1;
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fall-titel:hover {
		color: var(--akzent);
	}
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
	.unter-zeile:last-child {
		border-bottom: none;
	}
	.unter-zeile:hover {
		background: var(--flaeche);
	}
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
	.leer-hinweis {
		color: var(--text-fluester);
		font-size: 0.85rem;
	}
	.keine-treffer {
		padding: 2rem 0;
		margin: 0;
		text-align: center;
		font-size: 0.9rem;
		color: var(--text-fluester);
	}

	@media (max-width: 560px) {
		.seite {
			padding-top: 1.5rem;
		}
		.kopf-aktionen {
			position: static;
			justify-content: center;
			margin-bottom: 1.1rem;
		}
		.treffer-leiste {
			align-items: flex-start;
			flex-direction: column;
			padding: 0.75rem 0.85rem;
		}
		.treffer-aktionen {
			width: 100%;
			justify-content: flex-end;
		}
		.suchtreffer-block :global(.karte) {
			padding: 1.35rem;
		}
	}
</style>
