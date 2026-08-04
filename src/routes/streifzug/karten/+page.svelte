<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import LernKarte from '$lib/components/LernKarte.svelte';
	import type { Karte, Kind } from '$lib/types';
	import { klartext } from '$lib/markdown';

	let { data } = $props();

	const gebietFilter = $derived(page.url.searchParams.get('area'));
	const GEBIET_NAMEN: Record<string, string> = {
		zivilrecht: 'Zivilrecht',
		strafrecht: 'Strafrecht',
		oeffentliches_recht: 'Öffentliches Recht',
		kapitalgesellschaftsrecht: 'KapGesR',
		wissen_zivilrecht: 'Wissen ZR',
		wissen_kapitalgesellschaftsrecht: 'Wissen KapGesR'
	};

	// Kandidaten: alle Karten, ggf. gefiltert nach area
	const kandidaten = $derived(
		data.nodes.filter((n: Karte) => !gebietFilter || n.area === gebietFilter)
	);

	// Der Streifzug: eine Reihenfolge (Array von IDs) + aktueller Index.
	// Beides im sessionStorage, damit ein Reload nichts verwirft.
	let reihenfolge = $state<string[]>([]);
	let index = $state(0);
	// svelte-ignore state_referenced_locally
	let aufgedeckt = $state(false);

	// Aktuelle Karte + Kinder (fürs LernKarte-typMap)
	let karte = $state<Karte | null>(null);
	let kinder = $state<Kind[]>([]);
	const typMap = $derived(new Map(kinder.map((k) => [k.id, k.type])));

	function schluessel() {
		return `streifzug-karten-${gebietFilter ?? 'alle'}`;
	}

	function mischen<T>(arr: T[]): T[] {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	async function ladeKarte(id: string) {
		aufgedeckt = false;
		const res = await fetch(`/api/nodes/${id}`);
		if (!res.ok) {
			karte = null;
			return;
		}
		const daten = await res.json();
		karte = daten.node;
		kinder = daten.children;
	}

	function starten() {
		reihenfolge = mischen(kandidaten.map((k) => k.id));
		index = 0;
		sessionStorage.setItem(schluessel(), JSON.stringify({ reihenfolge, index }));
		if (reihenfolge.length > 0) ladeKarte(reihenfolge[0]);
	}

	function naechste() {
		if (index < reihenfolge.length - 1) {
			index++;
			sessionStorage.setItem(schluessel(), JSON.stringify({ reihenfolge, index }));
			ladeKarte(reihenfolge[index]);
		} else {
			// Ende — Reihenfolge leeren, Endbildschirm erscheint
			index = reihenfolge.length;
			sessionStorage.removeItem(schluessel());
		}
	}

	function beenden() {
		sessionStorage.removeItem(schluessel());
		goto('/');
	}

	// Beim Betreten: gespeicherten Streifzug wieder aufnehmen, sonst starten
	onMount(() => {
		const gespeichert = sessionStorage.getItem(schluessel());
		if (gespeichert) {
			try {
				const { reihenfolge: r, index: i } = JSON.parse(gespeichert);
				if (Array.isArray(r) && r.length > 0 && typeof i === 'number' && i < r.length) {
					reihenfolge = r;
					index = i;
					ladeKarte(r[i]);
					return;
				}
			} catch {
				/* fällt in starten() */
			}
		}
		starten();
	});
</script>

<div class="seite">
	<nav class="leiste">
		<button class="zurueck" onclick={beenden}>‹ Bibliothek</button>
		<div class="titel-block">
			<span class="modus">Zufällige Karten</span>
			{#if gebietFilter}
				<span class="filter">aus {GEBIET_NAMEN[gebietFilter] ?? gebietFilter}</span>
			{/if}
		</div>
		<span class="fortschritt">
			{#if reihenfolge.length > 0 && index < reihenfolge.length}
				{index + 1} / {reihenfolge.length}
			{/if}
		</span>
	</nav>

	{#if kandidaten.length === 0}
		<div class="hinweis">
			<p>Keine Karten im aktuellen Filter.</p>
			<button class="knopf" onclick={beenden}>Zurück</button>
		</div>
	{:else if index >= reihenfolge.length}
		<div class="hinweis">
			<p>Alle {reihenfolge.length} Karten durch.</p>
			<div class="knopf-zeile">
				<button class="knopf" onclick={starten}>Neu starten</button>
				<button class="knopf knopf-primaer" onclick={beenden}>Zur Bibliothek</button>
			</div>
		</div>
	{:else if karte}
		<LernKarte
			node={karte}
			{aufgedeckt}
			onaufdecken={() => (aufgedeckt = true)}
			onlink={(id) => goto(`/karte/${id}`)}
			{typMap}
		/>
		<div class="aktion">
			<button class="knopf knopf-primaer" onclick={naechste}>Nächste zufällige Karte ›</button>
		</div>
	{/if}
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
		align-items: center;
		gap: 1rem;
	}
	.zurueck {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s ease;
	}
	.zurueck:hover {
		color: var(--text);
	}
	.titel-block {
		flex: 1;
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.modus {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text);
	}
	.filter {
		font-size: 0.8rem;
		color: var(--text-fluester);
	}
	.fortschritt {
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--text-fluester);
	}
	.aktion {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}
	.knopf {
		background: var(--flaeche-hoch);
		color: var(--text);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.6rem 1.3rem;
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.15s ease,
			transform 0.1s ease;
	}
	.knopf:hover {
		background: var(--linie-stark);
	}
	.knopf:active {
		transform: scale(0.97);
	}
	.knopf-primaer {
		background: var(--akzent);
		color: white;
		border-color: transparent;
	}
	.knopf-primaer:hover {
		background: var(--akzent-hover);
	}
	.knopf-zeile {
		display: flex;
		gap: 0.7rem;
		justify-content: center;
		margin-top: 1.5rem;
	}
	.hinweis {
		text-align: center;
		padding: 3rem 0;
		color: var(--text-leise);
	}
	.hinweis p {
		margin: 0 0 1rem;
	}
</style>
