<script lang="ts">
	import { rendere } from '$lib/markdown';
	import type { Karte, KartenTyp, BauDaten } from '$lib/types';

	let {
		node,
		onsave,
		onlinkstart,
		onschliessen
	}: {
		node: Karte;
		onsave: (daten: BauDaten) => Promise<void>;
		onlinkstart: (start: number, ende: number, text: string, daten: BauDaten) => void;
		onschliessen?: () => void;
	} = $props();

	// Lokale Arbeitskopie (Entwurf) — Abkopplung vom Prop ist gewollt:
	// ein Entwurf darf nicht verloren gehen, wenn sich node ändert.
	// svelte-ignore state_referenced_locally
	let typ = $state<KartenTyp>(node.type);
	// svelte-ignore state_referenced_locally
	let titel = $state(node.title ?? '');
	// svelte-ignore state_referenced_locally
	let ref = $state(node.ref ?? '');
	// svelte-ignore state_referenced_locally
	let front = $state(node.front);
	// svelte-ignore state_referenced_locally
	let back = $state(node.back);
	let speichert = $state(false);
	let zeigeVorschau = $state(false);

	// Der komplette Entwurf als ein Objekt — wandert beim Speichern
	// und beim Verlinken gebündelt nach oben.
	const daten = $derived<BauDaten>({
		type: typ,
		front,
		back,
		title: titel.trim() || null,
		ref: ref.trim() || null
	});

	const geaendert = $derived(
		typ !== node.type ||
			front !== node.front ||
			back !== node.back ||
			(titel.trim() || null) !== node.title ||
			(ref.trim() || null) !== node.ref
	);

	let backFeld: HTMLTextAreaElement | null = $state(null);
	let frontFeld: HTMLTextAreaElement | null = $state(null);

	async function speichern() {
		speichert = true;
		await onsave(daten);
		speichert = false;
	}

	function verlinken() {
		if (!backFeld) return;
		const start = backFeld.selectionStart;
		const ende = backFeld.selectionEnd;
		if (start === ende) return;
		onlinkstart(start, ende, back.slice(start, ende), daten);
	}

	// Legt Markdown-Zeichen um die Markierung und stellt die
	// Auswahl danach wieder her — man kann direkt weiterformatieren.
	function formatiere(feld: HTMLTextAreaElement, istFront: boolean, vor: string, nach: string) {
		const start = feld.selectionStart;
		const ende = feld.selectionEnd;
		if (start === ende) return;
		const text = istFront ? front : back;
		const neu = text.slice(0, start) + vor + text.slice(start, ende) + nach + text.slice(ende);
		if (istFront) front = neu;
		else back = neu;
		requestAnimationFrame(() => {
			feld.focus();
			feld.setSelectionRange(start + vor.length, ende + vor.length);
		});
	}

	function tastatur(e: KeyboardEvent) {
		if (!(e.metaKey || e.ctrlKey)) return;

		if (e.key === 's') {
			e.preventDefault();
			if (geaendert) speichern();
			return;
		}

		// Formatieren nur in den Inhaltsfeldern (nicht Titel/Aktenzeichen)
		const ziel = e.target;
		const istFront = ziel === frontFeld;
		const istBack = ziel === backFeld;
		if (!istFront && !istBack) return;
		const feld = ziel as HTMLTextAreaElement;

		if (e.key === 'b') { e.preventDefault(); formatiere(feld, istFront, '**', '**'); }
		if (e.key === 'i') { e.preventDefault(); formatiere(feld, istFront, '*', '*'); }
		if (e.key === 'u') { e.preventDefault(); formatiere(feld, istFront, '<u>', '</u>'); }
	}
</script>

<article class="karte" onkeydown={tastatur} role="presentation">
	<div class="kopf">
		<div class="typ">
			<span class="typ-punkt" style:--punkt="var(--typ-{typ})"></span>
			<select class="typ-wahl" bind:value={typ}>
				<option value="fall">fall</option>
				<option value="schema">schema</option>
				<option value="definition">definition</option>
				<option value="subsumtion">subsumtion</option>
				<option value="simpel">simpel</option>
			</select>
			<span class="id">{node.id}</span>
		</div>
		{#if onschliessen}
			<button class="schliessen" onclick={onschliessen} aria-label="Schließen">×</button>
		{/if}
	</div>

	<div class="zeile-2">
		<div class="spalte-titel">
			<label class="feld-label" for="titel-{node.id}">Titel (fürs Menü)</label>
			<input id="titel-{node.id}" class="feld" bind:value={titel} placeholder="optional" />
		</div>
		{#if typ === 'fall'}
			<div class="spalte-ref">
				<label class="feld-label" for="ref-{node.id}">Aktenzeichen</label>
				<input id="ref-{node.id}" class="feld" bind:value={ref} placeholder="fiktiv" />
			</div>
		{/if}
	</div>

	<label class="feld-label" for="front-{node.id}">Vorderseite</label>
	<textarea id="front-{node.id}" class="feld" rows="2" bind:value={front} bind:this={frontFeld}></textarea>

	<div class="label-zeile">
		<label class="feld-label" for="back-{node.id}">Rückseite</label>
		<button class="vorschau-toggle" class:aktiv={zeigeVorschau} onclick={() => (zeigeVorschau = !zeigeVorschau)}>
			Vorschau
		</button>
	</div>
	<textarea
		id="back-{node.id}"
		class="feld feld-back"
		rows="8"
		bind:value={back}
		bind:this={backFeld}
	></textarea>

	{#if zeigeVorschau && back.trim()}
		<div class="vorschau">{@html rendere(back)}</div>
	{/if}

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
		margin-bottom: 0.5rem;
	}
	.typ {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.typ-punkt {
		width: 7px; height: 7px; border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
	}
	/* Der Typ ist im Bauen-Modus eine Entscheidung, kein Etikett */
	.typ-wahl {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-family: var(--mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.typ-wahl:focus { outline: none; color: var(--text); }
	.id {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--text-fluester);
		opacity: 0.7;
	}
	.schliessen {
		background: none; border: none; color: var(--text-fluester);
		font-size: 1.3rem; line-height: 1; cursor: pointer; padding: 0 0.2rem;
		transition: color 0.15s ease;
	}
	.schliessen:hover { color: var(--text); }

	.zeile-2 { display: flex; gap: 0.75rem; }
	.spalte-titel { flex: 1; display: flex; flex-direction: column; }
	.spalte-ref { flex: 0 0 11rem; display: flex; flex-direction: column; }

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
	.feld-back { font-size: 0.92rem; }

	.label-zeile {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.vorschau-toggle {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s ease;
	}
	.vorschau-toggle:hover { color: var(--text-leise); }
	.vorschau-toggle.aktiv { color: var(--akzent); }

	/* Die Vorschau sieht aus wie die spätere Lernkarte: gleiche Typo */
	.vorschau {
		margin-top: 0.5rem;
		border: 1px dashed var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.9rem 1rem;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-leise);
	}
	.vorschau :global(p) { margin: 0 0 0.6em; }
	.vorschau :global(p:last-child) { margin-bottom: 0; }
	.vorschau :global(strong) { font-weight: 600; color: var(--text); }
	.vorschau :global(ul) { padding-left: 1.25em; margin: 0 0 0.6em; }
	.vorschau :global(ol) { padding-left: 1.25em; margin: 0 0 0.6em; }

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
	.speichern.bereit {
		background: var(--akzent);
		color: white;
		border-color: transparent;
		cursor: pointer;
	}
	.speichern.bereit:hover { background: var(--akzent-hover); }
	.speichern.bereit:active { transform: scale(0.97); }
</style>
