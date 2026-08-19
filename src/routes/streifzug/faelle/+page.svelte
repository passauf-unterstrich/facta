<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { KartenAuswahl } from '$lib/types';

	let { data } = $props();

	const gebietFilter = $derived(page.url.searchParams.get('area'));

	const kandidaten = $derived(
		data.faelle.filter((n: KartenAuswahl) => !gebietFilter || n.area === gebietFilter)
	);

	function mischen<T>(arr: T[]): T[] {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	// Der Streifzug leitet zur ersten Fall-Karte weiter und übergibt
	// die restliche Reihenfolge als Query-Parameter. Die Karten-Seite
	// zeigt dann ein "Nächster Fall"-HUD, wenn ?streifzug=... anliegt.
	onMount(() => {
		if (kandidaten.length === 0) return;
		const reihenfolge = mischen(kandidaten.map((k) => k.id));
		const [erster, ...rest] = reihenfolge;
		const params = new URLSearchParams();
		params.set('streifzug', rest.join(','));
		if (gebietFilter) params.set('area', gebietFilter);
		goto(`/karte/${erster}?${params}`, { replaceState: true });
	});

	function zurBibliothek() {
		goto(gebietFilter ? `/?area=${encodeURIComponent(gebietFilter)}` : '/');
	}
</script>

<div class="seite">
	{#if kandidaten.length === 0}
		<p>Keine Fälle im aktuellen Filter.</p>
		<button class="knopf" onclick={zurBibliothek}>Zurück</button>
	{:else}
		<p class="lade">Zufälliger Baum startet …</p>
	{/if}
</div>

<style>
	.seite {
		max-width: 44rem;
		margin: 4rem auto;
		padding: 0 1.5rem;
		text-align: center;
		color: var(--text-leise);
	}
	.lade {
		color: var(--text-fluester);
	}
	.knopf {
		background: var(--flaeche-hoch);
		color: var(--text);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.6rem 1.3rem;
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		margin-top: 1rem;
	}
</style>
