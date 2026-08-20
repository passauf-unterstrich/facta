<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LernKarte from '$lib/components/LernKarte.svelte';
	import BauKarte from '$lib/components/BauKarte.svelte';
	import KinderListe from '$lib/components/KinderListe.svelte';
	import LinkMenu from '$lib/components/LinkMenu.svelte';
	import KernwissenErfasser from '$lib/components/KernwissenErfasser.svelte';
	import type { Karte, Kind, BauDaten } from '$lib/types';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { data } = $props();

	// Default ist Lernen — außer die URL wünscht explizit anderes
	// (z.B. Sprung von "Erstellen & bauen" aus der Verwaltung)
	// Fall-Streifzug: wenn ?streifzug=id1,id2,id3 in der URL steht,
	// erscheint oben ein HUD, das zum nächsten Fall springt.
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
	function naechsterFall() {
		if (streifzugRest.length === 0) {
			goto(bibliothekLink);
			return;
		}
		const [naechster, ...rest] = streifzugRest;
		goto(zielLink('karte', naechster, rest));
	}
	function streifzugBeenden() {
		goto(bibliothekLink);
	}

	let modus = $state<'lernen' | 'bauen'>('lernen');
	let autoAufdecken = $state(false);
	const autoAufdeckenKey = $derived(`facta:auto-aufdecken:${data.rolle}`);
	onMount(() => {
		if (data.rolle === 'owner' && page.url.searchParams.get('modus') === 'bauen') modus = 'bauen';
		try {
			autoAufdecken = sessionStorage.getItem(autoAufdeckenKey) === '1';
		} catch {
			// Private Browsermodi können Web-Speicher sperren. Dann gilt
			// die Auswahl weiterhin für die aktuelle geladene Seite.
		}
	});
	function schalteAutoAufdecken() {
		autoAufdecken = !autoAufdecken;
		try {
			sessionStorage.setItem(autoAufdeckenKey, autoAufdecken ? '1' : '0');
		} catch {
			// Der Schalter funktioniert auch ohne verfügbaren Web-Speicher.
		}
	}
	let zeigeVerknuepft = $state(false);
	let kernwissenOffen = $state(false);
	let kernwissenHinweis = $state('');
	let kernwissenHinweisTimer: ReturnType<typeof setTimeout> | undefined;
	function kernwissenGespeichert(titel: string) {
		kernwissenHinweis = `„${titel}“ wurde zu Kernwissen Klausur hinzugefügt.`;
		if (kernwissenHinweisTimer) clearTimeout(kernwissenHinweisTimer);
		kernwissenHinweisTimer = setTimeout(() => (kernwissenHinweis = ''), 4500);
	}

	// Lern-Zustand (Ableitung: gehört zur Karten-ID)
	let aufgedecktFuer = $state('');
	const basisAufgedeckt = $derived(autoAufdecken || aufgedecktFuer === data.node.id);

	// Layer-Stack
	type Layer = { node: Karte; children: Kind[]; aufgedeckt: boolean };
	let stack = $state<Layer[]>([]);
	let stackFuer = $state('');
	const layers = $derived(stackFuer === data.node.id ? stack : []);
	const kernwissenQuelle = $derived.by(() => {
		const oberste = layers.at(-1)?.node ?? data.node;
		return oberste.title?.trim() || oberste.ref?.trim() || oberste.front.slice(0, 160);
	});

	// id → typ für alle aktuell bekannten Karten: nährt die Signal-
	// Erkennung im Renderer (Link auf 'thema' = gelbe Markierung).
	const typMap = $derived.by(() => {
		const m = new Map<string, string>();
		for (const k of data.children) m.set(k.id, k.type);
		for (const l of stack) for (const k of l.children) m.set(k.id, k.type);
		return m;
	});

	// Verlink-Zustand: welche Ebene verlinkt gerade was?
	// ebene -1 = Basis-Karte, 0+ = Layer-Index
	let link = $state<{
		ebene: number;
		feld: 'back' | 'chips';
		start: number;
		ende: number;
		text: string;
		daten: BauDaten;
	} | null>(null);

	async function holeKarte(id: string) {
		const res = await fetch(`/api/nodes/${id}`);
		if (!res.ok) return null;
		return res.json();
	}

	async function oeffne(id: string) {
		const daten = await holeKarte(id);
		if (!daten) return;
		const bisher = stackFuer === data.node.id ? stack : [];
		stackFuer = data.node.id;
		stack = [
			...bisher,
			{ node: daten.node, children: daten.children, aufgedeckt: autoAufdecken }
		];
	}

	function schliesseOberste() {
		stack = stack.slice(0, -1);
	}

	// Speichern: schreibt die Karte, dann Daten frisch holen.
	// invalidateAll() lässt SvelteKit die load-Funktion neu laufen —
	// so sieht die Basis-Karte ihre neuen Kinder sofort.
	async function speichere(node: Karte, daten: BauDaten) {
		await fetch('/api/nodes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: node.id, area: node.area, ...daten })
		});
		if (stackFuer === data.node.id && stack.length > 0) {
			// Layer auffrischen, deren Karte das war
			for (let i = 0; i < stack.length; i++) {
				if (stack[i].node.id === node.id) {
					const frisch = await holeKarte(node.id);
					if (frisch) stack[i] = { ...stack[i], node: frisch.node, children: frisch.children };
				}
			}
		}
		await invalidateAll();
	}

	// Verlinken Schritt 1: BauKarte meldet Markierung + aktuellen Text
	function linkStart(
		ebene: number,
		feld: 'back' | 'chips',
		start: number,
		ende: number,
		text: string,
		daten: BauDaten
	) {
		link = { ebene, feld, start, ende, text, daten };
	}

	// Verlinken Schritt 2: Ziel gewählt → [[Text|id]] in den Text setzen,
	// speichern (Kante entsteht via Sync), Zielkarte als Layer öffnen
	async function linkFertig(zielId: string) {
		if (!link) return;
		const l = link;
		link = null;
		const quelle = l.feld === 'chips' ? l.daten.chips : l.daten.back;
		const neuerText = quelle.slice(0, l.start) + `[[${l.text}|${zielId}]]` + quelle.slice(l.ende);
		const node = l.ebene === -1 ? data.node : stack[l.ebene].node;
		await speichere(node, { ...l.daten, [l.feld]: neuerText });
		await oeffne(zielId);
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && !kernwissenOffen && !link && layers.length > 0) schliesseOberste();
	}}
/>

<div class="seite">
	<nav class="leiste">
		<a class="zurueck" href={bibliothekLink}>‹ Bibliothek</a>

		<div class="leiste-aktionen">
			{#if data.children.length > 0}
				<button
					class="schalter"
					class:aktiv={zeigeVerknuepft}
					onclick={() => (zeigeVerknuepft = !zeigeVerknuepft)}
				>
					Verknüpft <span class="schalter-zahl">{data.children.length}</span>
				</button>
			{/if}
		</div>
	</nav>

	{#if modus === 'lernen'}
		<LernKarte
			node={data.node}
			aufgedeckt={basisAufgedeckt}
			onaufdecken={() => (aufgedecktFuer = data.node.id)}
			onlink={oeffne}
		/>
	{:else}
		{#key `${data.node.id}:${data.node.updated_at}`}
			<BauKarte
				node={data.node}
				onsave={(daten) => speichere(data.node, daten)}
				onlinkstart={(feld, start, ende, text, daten) =>
					linkStart(-1, feld, start, ende, text, daten)}
			/>
		{/key}
		{#if link && link.ebene === -1}
			<LinkMenu
				markText={link.text}
				area={data.node.area}
				elternTyp={data.node.type}
				onfertig={linkFertig}
				onabbrechen={() => (link = null)}
			/>
		{/if}
	{/if}

	{#if zeigeVerknuepft}
		<KinderListe children={data.children} onwahl={oeffne} />
	{/if}
</div>

{#each layers as layer, i (i)}
	<div
		class="overlay"
		onmousedown={(e) => {
			// Nur schließen, wenn der DRÜCK-Start auf dem Vorhang lag —
			// Markier-Schwünge aus der Karte hinaus schließen nichts mehr.
			if (e.target === e.currentTarget) schliesseOberste();
		}}
		role="presentation"
	>
		<div
			class="overlay-inhalt"
			style:--tiefe={i}
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			{#if modus === 'lernen'}
				<LernKarte
					node={layer.node}
					aufgedeckt={autoAufdecken || layer.aufgedeckt}
					onaufdecken={() => (stack[i].aufgedeckt = true)}
					onlink={oeffne}
					onschliessen={schliesseOberste}
					{typMap}
				/>
			{:else}
				{#key `${layer.node.id}:${layer.node.updated_at}`}
					<BauKarte
						node={layer.node}
						onsave={(daten) => speichere(layer.node, daten)}
						onlinkstart={(feld, start, ende, text, daten) =>
							linkStart(i, feld, start, ende, text, daten)}
						onschliessen={schliesseOberste}
					/>
				{/key}
				{#if link && link.ebene === i}
					<LinkMenu
						markText={link.text}
						area={layer.node.area}
						elternTyp={layer.node.type}
						onfertig={linkFertig}
						onabbrechen={() => (link = null)}
					/>
				{/if}
			{/if}
			{#if zeigeVerknuepft}
				<KinderListe children={layer.children} onwahl={oeffne} />
			{/if}
		</div>
	</div>
{/each}

{#if data.rolle === 'owner' && modus === 'lernen' && kernwissenOffen}
	<KernwissenErfasser
		quelleTitel={kernwissenQuelle}
		ongespeichert={kernwissenGespeichert}
		onschliessen={() => (kernwissenOffen = false)}
	/>
{/if}

{#if kernwissenHinweis}
	<div class="kernwissen-hinweis" role="status">{kernwissenHinweis}</div>
{/if}

{#if modus === 'lernen'}
	<div class="lernwerkzeuge" aria-label="Lernwerkzeuge">
		{#if data.rolle === 'owner'}
			<button
				class="memorize-mini"
				type="button"
				title="Kernwissenkarte erstellen"
				onclick={() => (kernwissenOffen = true)}
			>
				<span aria-hidden="true">＋</span> Memorize
			</button>
		{/if}
		<button
			class="auto-schalter"
			class:aktiv={autoAufdecken}
			type="button"
			aria-pressed={autoAufdecken}
			title="Rückseiten in dieser Sitzung direkt anzeigen"
			onclick={schalteAutoAufdecken}
		>
			<span class="auto-spur" aria-hidden="true"><span></span></span>
			<span>Auto-Aufdecken</span>
		</button>
	</div>
{/if}

<div class="modus-hud">
	<button class:aktiv={modus === 'lernen'} onclick={() => (modus = 'lernen')}>Lernen</button>
	{#if data.rolle === 'owner'}
		<button class:aktiv={modus === 'bauen'} onclick={() => (modus = 'bauen')}>Bauen</button>
	{/if}
	<a class="hud-link" href={zielLink('graph', data.node.id)}>Graph</a>
</div>

{#if streifzugAktiv}
	<div class="streifzug-hud">
		<span class="streifzug-label">Zufälliger Baum</span>
		{#if streifzugRest.length > 0}
			<button class="streifzug-knopf" onclick={naechsterFall}>Nächster Baum ›</button>
			<span class="streifzug-rest">noch {streifzugRest.length}</span>
		{:else}
			<span class="streifzug-rest">letzter Baum</span>
			<button class="streifzug-knopf" onclick={streifzugBeenden}>Beenden</button>
		{/if}
	</div>
{/if}

<style>
	.seite {
		max-width: 44rem;
		margin: 0 auto;
		padding: 4rem 1.5rem 6rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.leiste {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.zurueck {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.85rem;
		transition: color 0.15s ease;
	}
	.zurueck:hover {
		color: var(--text);
	}

	/* Schwebendes HUD: über allen Ebenen, halbtransparent mit Blur */
	.modus-hud {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100; /* über den Overlays (50) */
		display: flex;
		background: color-mix(in srgb, var(--flaeche) 85%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--linie);
		border-radius: 999px;
		padding: 3px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
	}
	.modus-hud button {
		background: none;
		border: none;
		border-radius: 999px;
		padding: 0.3rem 1rem;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}
	.modus-hud button.aktiv {
		background: var(--flaeche-hoch);
		color: var(--text);
	}
	.hud-link {
		display: flex;
		align-items: center;
		border-radius: 999px;
		padding: 0.3rem 1rem;
		color: var(--text-fluester);
		font-size: 0.8rem;
		font-weight: 500;
		text-decoration: none;
		transition: color 0.15s ease;
	}
	.hud-link:hover {
		color: var(--text);
	}

	.schalter {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: 1px solid var(--linie);
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.schalter:hover {
		color: var(--text-leise);
		border-color: var(--linie-stark);
	}
	.schalter.aktiv {
		color: var(--text);
		background: var(--flaeche-hoch);
		border-color: var(--linie-stark);
	}
	.schalter-zahl {
		font-size: 0.7rem;
		opacity: 0.7;
	}
	.leiste-aktionen {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
	}
	.lernwerkzeuge {
		position: fixed;
		left: 1rem;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 110;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		border: 1px solid var(--linie);
		border-radius: 999px;
		background: color-mix(in srgb, var(--flaeche) 88%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
		padding: 0.28rem 0.55rem;
	}
	.auto-schalter {
		display: flex;
		align-items: center;
		gap: 0.42rem;
		background: none;
		border: none;
		padding: 0.3rem 0.25rem;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: color 0.15s ease;
	}
	.auto-schalter:hover,
	.auto-schalter.aktiv {
		color: var(--text-leise);
	}
	.memorize-mini {
		display: flex;
		align-items: center;
		gap: 0.22rem;
		border: none;
		background: none;
		padding: 0.3rem 0.15rem;
		color: var(--text-fluester);
		font: inherit;
		font-size: 0.72rem;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.15s ease;
	}
	.memorize-mini:hover {
		color: var(--text-leise);
	}
	.memorize-mini span {
		color: var(--akzent);
		font-size: 0.8rem;
	}
	.auto-spur {
		position: relative;
		width: 1.75rem;
		height: 1rem;
		flex: 0 0 1.75rem;
		border: 1px solid var(--linie-stark);
		border-radius: 999px;
		background: var(--flaeche-hoch);
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.auto-spur span {
		position: absolute;
		top: 2px;
		left: 2px;
		width: calc(1rem - 6px);
		height: calc(1rem - 6px);
		border-radius: 50%;
		background: var(--text-fluester);
		transition:
			transform 0.15s ease,
			background 0.15s ease;
	}
	.auto-schalter.aktiv .auto-spur {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 28%, var(--flaeche-hoch));
	}
	.auto-schalter.aktiv .auto-spur span {
		background: var(--akzent);
		transform: translateX(0.75rem);
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		overflow-y: auto;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		padding: 2rem 1.5rem;
		animation: vorhang 0.2s ease;
	}
	@keyframes vorhang {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.overlay-inhalt {
		width: 100%;
		max-width: 42rem;
		margin-top: calc(3rem + var(--tiefe) * 1.25rem);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		animation: auftauchen 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
	}
	@keyframes auftauchen {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Streifzug-HUD: sitzt oben rechts, ruhig, informativ */
	.streifzug-hud {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: color-mix(in srgb, var(--flaeche) 85%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
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
		border: none;
		border-radius: 999px;
		padding: 0.3rem 0.9rem;
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.streifzug-knopf:hover {
		background: var(--akzent-hover);
	}
	.streifzug-rest {
		font-size: 0.72rem;
		color: var(--text-fluester);
	}
	.kernwissen-hinweis {
		position: fixed;
		left: 50%;
		bottom: 5.25rem;
		z-index: 220;
		transform: translateX(-50%);
		width: max-content;
		max-width: calc(100vw - 2rem);
		border: 1px solid color-mix(in srgb, var(--akzent) 45%, var(--linie));
		border-radius: 999px;
		background: color-mix(in srgb, var(--flaeche-hoch) 92%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
		padding: 0.52rem 0.85rem;
		color: var(--text-leise);
		font-size: 0.76rem;
		text-align: center;
	}

	@media (max-width: 560px) {
		.seite {
			padding-inline: 1rem;
		}
		.leiste {
			align-items: flex-start;
		}
		.leiste-aktionen {
			flex-wrap: wrap;
			gap: 0.3rem;
		}
		.lernwerkzeuge {
			left: 50%;
			bottom: max(0.75rem, env(safe-area-inset-bottom));
			transform: translateX(-50%);
			max-width: calc(100vw - 1.5rem);
			white-space: nowrap;
		}
		.auto-schalter {
			font-size: 0.7rem;
		}
		.schalter {
			font-size: 0.72rem;
			padding-inline: 0.65rem;
		}
	}
</style>
