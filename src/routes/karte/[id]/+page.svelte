<script lang="ts">
	import LernKarte from '$lib/components/LernKarte.svelte';
	import type { Karte } from '$lib/types';
    import type { Kind } from '$lib/types';
    import KinderListe from '$lib/components/KinderListe.svelte';

	let { data } = $props();

	// Basis-Karte: aufgedeckt gehört zur ID (Ableitung statt Reset)
	let aufgedecktFuer = $state('');
	const basisAufgedeckt = $derived(aufgedecktFuer === data.node.id);

	// Der Stapel der Pop-up-Layer. Auch er "gehört" zur Basis-Karte:
	// navigierst du zu einer anderen Karte, zählt der alte Stapel nicht.
	type Layer = { node: Karte; children: Kind[]; aufgedeckt: boolean };
	let stack = $state<Layer[]>([]);
	let stackFuer = $state('');
    // Kacheln standardmäßig aus: Lernen ist der Normalfall,
	// die Landkarte holt man sich bei Bedarf dazu.
	let zeigeVerknuepft = $state(false);
	const layers = $derived(stackFuer === data.node.id ? stack : []);

	async function oeffne(id: string) {
		const res = await fetch(`/api/nodes/${id}`);
		if (!res.ok) return;
		const daten = await res.json();
		const bisher = stackFuer === data.node.id ? stack : [];
		stackFuer = data.node.id;
		stack = [...bisher, { node: daten.node, children: daten.children, aufgedeckt: false }];
	}

	function schliesseOberste() {
		stack = stack.slice(0, -1);
	}
</script>

<!-- Esc schließt den obersten Layer — Tastatur gehört zum guten Ton -->
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && layers.length > 0) schliesseOberste();
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
				Verknüpft
				<span class="schalter-zahl">{data.children.length}</span>
			</button>
		{/if}
	</nav>

	<LernKarte
		node={data.node}
		aufgedeckt={basisAufgedeckt}
		onaufdecken={() => (aufgedecktFuer = data.node.id)}
		onlink={oeffne}
	/>
    {#if zeigeVerknuepft}
    	<KinderListe children={data.children} onwahl={oeffne} />
    {/if}
</div>

{#each layers as layer, i (i)}
	<div
		class="overlay"
		style:--tiefe={i}
		onclick={schliesseOberste}
		role="presentation"
	>
		<div class="overlay-inhalt" onclick={(e) => e.stopPropagation()} role="presentation">
			<LernKarte
				node={layer.node}
				aufgedeckt={layer.aufgedeckt}
				onaufdecken={() => (stack[i].aufgedeckt = true)}
				onlink={oeffne}
				onschliessen={schliesseOberste}
			/>
            {#if zeigeVerknuepft}
            	<KinderListe children={layer.children} onwahl={oeffne} />
            {/if}
		</div>
	</div>
{/each}

<style>
	.seite {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.leiste {
		display: flex;
		justify-content: space-between;
		align-items: center;
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
	.zurueck {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.85rem;
		transition: color 0.15s ease;
	}
	.zurueck:hover { color: var(--text); }

	/* Der Vorhang: dunkelt ab UND zieht Unschärfe über das Dahinter —
	   das schafft echte Tiefe statt bloßem Grauschleier */
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
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.overlay-inhalt {
		width: 100%;
		max-width: 42rem;
		/* Jeder Layer rückt spürbar tiefer: Versatz wächst mit --tiefe */
		margin-top: calc(3rem + var(--tiefe) * 1.25rem);
		animation: auftauchen 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
        display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	@keyframes auftauchen {
		from { opacity: 0; transform: translateY(14px) scale(0.985); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>