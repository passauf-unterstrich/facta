<script lang="ts">
	import type { Karte, KartenTyp } from '$lib/types';

	let {
		markText,
		area,
		onfertig,
		onabbrechen
	}: {
		markText: string;
		area: string | null;
		onfertig: (zielId: string) => void;
		onabbrechen: () => void;
	} = $props();

	let alle = $state<Karte[]>([]);
	let suche = $state(markText); // Suche startet mit dem markierten Begriff
	let zeigeNeu = $state(false);
	let neuTyp = $state<KartenTyp>('definition');
	let neuFront = $state(markText);
	let sucheFeld: HTMLInputElement | null = $state(null);

	$effect(() => {
		fetch('/api/nodes')
			.then((r) => r.json())
			.then((daten) => (alle = daten));
		sucheFeld?.focus();
	});

	const treffer = $derived(
		alle
			.filter(
				(n) =>
					n.front.toLowerCase().includes(suche.toLowerCase()) ||
					n.id.toLowerCase().includes(suche.toLowerCase())
			)
			.slice(0, 8)
	);

	// Auto-ID: "Was ist ein Angebot?" → def_was_ist_ein_angebot → gekürzt.
	// Umlaute übersetzt, Sonderzeichen raus, Kollisionen bekommen -2, -3 …
	function baueId(typ: KartenTyp, front: string): string {
		const praefix: Record<KartenTyp, string> = {
			fall: 'fall', schema: 'agl', definition: 'def',
			subsumtion: 'sub', simpel: 'k'
		};
		const slug = front
			.toLowerCase()
			.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
			.replace(/§/g, 'p')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.split('_').slice(0, 4).join('_');
		let id = `${praefix[typ]}_${slug}`;
		let n = 2;
		while (alle.some((k) => k.id === id)) id = `${praefix[typ]}_${slug}_${n++}`;
		return id;
	}

	async function erstelleUndVerlinke() {
		if (!neuFront.trim()) return;
		const id = baueId(neuTyp, neuFront);
		const res = await fetch('/api/nodes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, type: neuTyp, area, front: neuFront, back: '' })
		});
		if (res.ok) onfertig(id);
	}

	function tastatur(e: KeyboardEvent) {
		if (e.key === 'Escape') onabbrechen();
		if (e.key === 'Enter' && !zeigeNeu && treffer.length > 0) {
			e.preventDefault();
			onfertig(treffer[0].id);
		}
	}
</script>

<div class="menu" onkeydown={tastatur} role="presentation">
	<div class="titel">„{markText}" verlinken</div>

	<input
		class="suche"
		bind:this={sucheFeld}
		bind:value={suche}
		placeholder="Karte suchen …"
	/>

	<div class="liste">
		{#each treffer as k (k.id)}
			<button class="eintrag" onclick={() => onfertig(k.id)}>
				<span class="typ-punkt" style:--punkt="var(--typ-{k.type})"></span>
				<span class="eintrag-front">{k.front}</span>
				<span class="eintrag-id">{k.id}</span>
			</button>
		{/each}
		{#if treffer.length === 0}
			<div class="keine">Keine bestehende Karte gefunden.</div>
		{/if}
	</div>

	{#if !zeigeNeu}
		<button class="neu-toggle" onclick={() => (zeigeNeu = true)}>+ Neue Karte erstellen</button>
	{:else}
		<div class="neu-box">
			<select class="neu-feld" bind:value={neuTyp}>
				<option value="definition">Definition</option>
				<option value="schema">Schema / Anspruchsgrundlage</option>
				<option value="subsumtion">Subsumtion</option>
				<option value="simpel">Simple Karte</option>
				<option value="fall">Fall</option>
			</select>
			<input class="neu-feld" bind:value={neuFront} placeholder="Vorderseite der neuen Karte" />
			<button class="neu-los" onclick={erstelleUndVerlinke}>Erstellen, verlinken & öffnen</button>
		</div>
	{/if}

	<button class="abbrechen" onclick={onabbrechen}>Abbrechen (Esc)</button>
</div>

<style>
	.menu {
		margin-top: 0.75rem;
		background: var(--bg);
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		animation: auf 0.15s ease;
	}
	@keyframes auf {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.titel { font-size: 0.8rem; color: var(--text-leise); }

	.suche {
		width: 100%;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-s);
		padding: 0.5rem 0.7rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.88rem;
	}
	.suche:focus { outline: none; border-color: var(--akzent); }

	.liste { display: flex; flex-direction: column; max-height: 14rem; overflow-y: auto; }
	.eintrag {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: none;
		border: none;
		border-radius: var(--radius-s);
		padding: 0.45rem 0.55rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
	}
	.eintrag:hover { background: var(--flaeche); }
	.eintrag:first-child { background: var(--flaeche); } /* Enter-Ziel sichtbar */
	.typ-punkt { width: 6px; height: 6px; border-radius: 50%; background: var(--punkt); flex-shrink: 0; }
	.eintrag-front { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.eintrag-id { font-family: var(--mono); font-size: 0.68rem; color: var(--text-fluester); }
	.keine { font-size: 0.82rem; color: var(--text-fluester); padding: 0.4rem 0.55rem; }

	.neu-toggle {
		background: none;
		border: 1px dashed var(--linie-stark);
		border-radius: var(--radius-s);
		padding: 0.5rem;
		color: var(--text-leise);
		font-family: inherit;
		font-size: 0.82rem;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.neu-toggle:hover { color: var(--text); border-color: var(--text-fluester); }

	.neu-box { display: flex; flex-direction: column; gap: 0.45rem; }
	.neu-feld {
		width: 100%;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-s);
		padding: 0.45rem 0.6rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.85rem;
	}
	.neu-los {
		background: var(--akzent);
		color: white;
		border: none;
		border-radius: var(--radius-s);
		padding: 0.5rem;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
	}
	.neu-los:hover { background: var(--akzent-hover); }

	.abbrechen {
		background: none; border: none; color: var(--text-fluester);
		font-size: 0.75rem; cursor: pointer; align-self: flex-start; padding: 0;
	}
	.abbrechen:hover { color: var(--text-leise); }
</style>