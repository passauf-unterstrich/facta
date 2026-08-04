<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Karte } from '$lib/types';

	let { data } = $props();

	const gebietFilter = $derived(page.url.searchParams.get('area'));
	const GEBIET_NAMEN: Record<string, string> = {
		zivilrecht: 'Zivilrecht',
		strafrecht: 'Strafrecht',
		oeffentliches_recht: 'Öffentliches Recht',
		kapitalgesellschaftsrecht: 'KapGesR'
	};

	const kandidaten = $derived(
		data.faelle.filter((n: Karte) => !gebietFilter || n.area === gebietFilter)
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
		const queryRest = rest.length > 0 ? `?streifzug=${rest.join(',')}` : '';
		goto(`/karte/${erster}${queryRest}`, { replaceState: true });
	});
</script>

<div class="seite">
	{#if kandidaten.length === 0}
		<p>Keine Fälle im aktuellen Filter.</p>
		<button class="knopf" onclick={() => goto('/')}>Zurück</button>
	{:else}
		<p class="lade">Fall-Streifzug startet …</p>
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
