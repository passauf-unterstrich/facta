<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LernKarte from '$lib/components/LernKarte.svelte';
	import BauKarte from '$lib/components/BauKarte.svelte';
	import KinderListe from '$lib/components/KinderListe.svelte';
	import LinkMenu from '$lib/components/LinkMenu.svelte';
	import type { Karte, Kind } from '$lib/types';
    import { page } from '$app/state';

	let { data } = $props();

	// Default ist Lernen — außer die URL wünscht explizit anderes
	// (z.B. Sprung von "Erstellen & bauen" aus der Verwaltung)
	let modus = $state<'lernen' | 'bauen'>(
		page.url.searchParams.get('modus') === 'bauen' ? 'bauen' : 'lernen'
	);
	let zeigeVerknuepft = $state(false);

	// Lern-Zustand (Ableitung: gehört zur Karten-ID)
	let aufgedecktFuer = $state('');
	const basisAufgedeckt = $derived(aufgedecktFuer === data.node.id);

	// Layer-Stack
	type Layer = { node: Karte; children: Kind[]; aufgedeckt: boolean };
	let stack = $state<Layer[]>([]);
	let stackFuer = $state('');
	const layers = $derived(stackFuer === data.node.id ? stack : []);

	// Verlink-Zustand: welche Ebene verlinkt gerade was?
	// ebene -1 = Basis-Karte, 0+ = Layer-Index
	let link = $state<{
		ebene: number;
		start: number;
		ende: number;
		text: string;
		front: string;
		back: string;
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
		stack = [...bisher, { node: daten.node, children: daten.children, aufgedeckt: false }];
	}

	function schliesseOberste() {
		stack = stack.slice(0, -1);
	}

	// Speichern: schreibt die Karte, dann Daten frisch holen.
	// invalidateAll() lässt SvelteKit die load-Funktion neu laufen —
	// so sieht die Basis-Karte ihre neuen Kinder sofort.
	async function speichere(node: Karte, front: string, back: string) {
		await fetch('/api/nodes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: node.id, type: node.type, area: node.area, front, back })
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
	function linkStart(ebene: number, start: number, ende: number, text: string, front: string, back: string) {
		link = { ebene, start, ende, text, front, back };
	}

	// Verlinken Schritt 2: Ziel gewählt → [[Text|id]] in den Text setzen,
	// speichern (Kante entsteht via Sync), Zielkarte als Layer öffnen
	async function linkFertig(zielId: string) {
		if (!link) return;
		const l = link;
		link = null;
		const neuerBack = l.back.slice(0, l.start) + `[[${l.text}|${zielId}]]` + l.back.slice(l.ende);
		const node = l.ebene === -1 ? data.node : stack[l.ebene].node;
		await speichere(node, l.front, neuerBack);
		await oeffne(zielId);
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && !link && layers.length > 0) schliesseOberste();
	}}
/>

<div class="seite">
	<nav class="leiste">
		<a class="zurueck" href="/">‹ Bibliothek</a>

		{#if data.children.length > 0}
			<button
				class="schalter"
				class:aktiv={zeigeVerknuepft}
				onclick={() => (zeigeVerknuepft = !zeigeVerknuepft)}
			>
				Verknüpft <span class="schalter-zahl">{data.children.length}</span>
			</button>
		{:else}
			<span class="platzhalter"></span>
		{/if}
	</nav>

	{#if modus === 'lernen'}
		<LernKarte
			node={data.node}
			aufgedeckt={basisAufgedeckt}
			onaufdecken={() => (aufgedecktFuer = data.node.id)}
			onlink={oeffne}
		/>
	{:else}
		{#key data.node.id}
			<BauKarte
				node={data.node}
				onsave={(front, back) => speichere(data.node, front, back)}
				onlinkstart={(start, ende, text, front, back) =>
					linkStart(-1, start, ende, text, front, back)}
			/>
		{/key}
		{#if link && link.ebene === -1}
			<LinkMenu
				markText={link.text}
				area={data.node.area}
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
	<div class="overlay" onclick={schliesseOberste} role="presentation">
		<div
			class="overlay-inhalt"
			style:--tiefe={i}
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			{#if modus === 'lernen'}
				<LernKarte
					node={layer.node}
					aufgedeckt={layer.aufgedeckt}
					onaufdecken={() => (stack[i].aufgedeckt = true)}
					onlink={oeffne}
					onschliessen={schliesseOberste}
				/>
			{:else}
				{#key layer.node.id}
					<BauKarte
						node={layer.node}
						onsave={(front, back) => speichere(layer.node, front, back)}
						onlinkstart={(start, ende, text, front, back) =>
							linkStart(i, start, ende, text, front, back)}
						onschliessen={schliesseOberste}
					/>
				{/key}
				{#if link && link.ebene === i}
					<LinkMenu
						markText={link.text}
						area={layer.node.area}
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

<div class="modus-hud">
	<button class:aktiv={modus === 'lernen'} onclick={() => (modus = 'lernen')}>Lernen</button>
	<button class:aktiv={modus === 'bauen'} onclick={() => (modus = 'bauen')}>Bauen</button>
</div>

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
	.zurueck:hover { color: var(--text); }

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
		transition: background 0.15s ease, color 0.15s ease;
	}
	.modus-hud button.aktiv {
		background: var(--flaeche-hoch);
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
		transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}
	.schalter:hover { color: var(--text-leise); border-color: var(--linie-stark); }
	.schalter.aktiv {
		color: var(--text);
		background: var(--flaeche-hoch);
		border-color: var(--linie-stark);
	}
	.schalter-zahl { font-size: 0.7rem; opacity: 0.7; }
	.platzhalter { width: 1px; }

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
	@keyframes vorhang { from { opacity: 0; } to { opacity: 1; } }

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
		from { opacity: 0; transform: translateY(14px) scale(0.985); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>