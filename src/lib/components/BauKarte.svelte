<script lang="ts">
	import type { Karte } from '$lib/types';

	let {
		node,
		onsave,
		onlinkstart,
		onschliessen
	}: {
		node: Karte;
		onsave: (front: string, back: string) => Promise<void>;
		onlinkstart: (start: number, ende: number, text: string, front: string, back: string) => void;
		onschliessen?: () => void;
	} = $props();

	// Lokale Arbeitskopie: Du tippst in front/back, das Original in
	// node bleibt unberührt, bis gespeichert wird. Wie ein Entwurf.
	// (Die Abkopplung vom Prop ist gewollt — deshalb das svelte-ignore:
	// ein Entwurf darf nicht verloren gehen, wenn sich node ändert.)
	// svelte-ignore state_referenced_locally
	let front = $state(node.front);
	// svelte-ignore state_referenced_locally
	let back = $state(node.back);
	let speichert = $state(false);

	// "Gibt es ungespeicherte Änderungen?" — reine Ableitung
	const geaendert = $derived(front !== node.front || back !== node.back);

    let backFeld: HTMLTextAreaElement | null = $state(null);

	// Meldet die aktuelle Markierung im Rückseiten-Feld nach oben —
	// samt Entwurfs-Text, damit der Link in den AKTUELLEN Text kommt.
	function verlinken() {
		if (!backFeld) return;
		const start = backFeld.selectionStart;
		const ende = backFeld.selectionEnd;
		if (start === ende) return; // nichts markiert
		onlinkstart(start, ende, back.slice(start, ende), front, back);
	}

	async function speichern() {
		speichert = true;
		await onsave(front, back);
		speichert = false;
	}

	// Cmd+S zum Speichern — im Editor Pflicht
	function tastatur(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			if (geaendert) speichern();
		}
	}
</script>

<article class="karte" onkeydown={tastatur} role="presentation">
	<div class="kopf">
		<div class="typ">
			<span class="typ-punkt" style:--punkt="var(--typ-{node.type})"></span>
			{node.type}
			<span class="id">{node.id}</span>
		</div>
		{#if onschliessen}
			<button class="schliessen" onclick={onschliessen} aria-label="Schließen">×</button>
		{/if}
	</div>

	<label class="feld-label" for="front-{node.id}">Vorderseite</label>
	<textarea id="front-{node.id}" class="feld" rows="2" bind:value={front}></textarea>

	<label class="feld-label" for="back-{node.id}">Rückseite</label>
	<textarea id="back-{node.id}" class="feld feld-back" rows="8" bind:value={back} bind:this={backFeld}></textarea>

	<div class="aktionen">
		<button class="verlinken" onclick={verlinken}>Markiertes verlinken</button>
		<button class="speichern" class:bereit={geaendert} onclick={speichern} disabled={!geaendert || speichert}>
			{speichert ? 'Speichert …' : geaendert ? 'Speichern' : 'Gespeichert'}
		</button>
	</div>
</article>

<style>
	.karte {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
	}
	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}
	.typ {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-fluester);
	}
	.typ-punkt {
		width: 7px; height: 7px; border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
	}
	/* Im Bauen-Modus DARF die ID sichtbar sein: hier bist du Techniker */
	.id { text-transform: none; letter-spacing: 0; opacity: 0.7; }
	.schliessen {
		background: none; border: none; color: var(--text-fluester);
		font-size: 1.3rem; line-height: 1; cursor: pointer; padding: 0 0.2rem;
		transition: color 0.15s ease;
	}
	.schliessen:hover { color: var(--text); }

	.feld-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-fluester);
		margin: 0.75rem 0 0.35rem;
	}
	.feld {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.7rem 0.85rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.92rem;
		line-height: 1.55;
		resize: vertical;
		transition: border-color 0.15s ease;
	}
	.feld:focus { outline: none; border-color: var(--akzent); }
	.feld-back { font-family: var(--mono); font-size: 0.85rem; }

	.aktionen {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1rem;
	}
	.verlinken {
		background: none;
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.5rem 1rem;
		color: var(--text-leise);
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.verlinken:hover { color: var(--text); border-color: var(--text-fluester); }

	.speichern {
		background: var(--flaeche-hoch);
		color: var(--text-fluester);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.5rem 1.2rem;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: default;
		transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
	}
	/* Der Knopf "lädt sich auf", sobald es was zu speichern gibt */
	.speichern.bereit {
		background: var(--akzent);
		color: white;
		border-color: transparent;
		cursor: pointer;
	}
	.speichern.bereit:hover { background: var(--akzent-hover); }
	.speichern.bereit:active { transform: scale(0.97); }
</style>