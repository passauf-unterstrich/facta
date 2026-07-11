<script lang="ts">
	import { rendere } from '$lib/markdown';
	import { parseZeilen, serialisiere, type Zeile } from '$lib/schalen';
	import type { Karte, KartenTyp, KartenMode, BauDaten } from '$lib/types';

	// Verlinken meldet neben der Position auch das QUELL-FELD, damit
	// die Seite den [[Link]] in den richtigen Text spleißt.
	export type LinkFeld = 'back' | 'chips';

	let {
		node,
		onsave,
		onlinkstart,
		onschliessen
	}: {
		node: Karte;
		onsave: (daten: BauDaten) => Promise<void>;
		onlinkstart: (feld: LinkFeld, start: number, ende: number, text: string, daten: BauDaten) => void;
		onschliessen?: () => void;
	} = $props();

	// Arbeitskopie (Entwurf) — Abkopplung vom Prop ist gewollt:
	// ein Entwurf darf nicht verloren gehen, wenn sich node ändert.
	// svelte-ignore state_referenced_locally
	let typ = $state<KartenTyp>(node.type);
	// svelte-ignore state_referenced_locally
	let modeWert = $state<KartenMode>(node.mode);
	// svelte-ignore state_referenced_locally
	let titel = $state(node.title ?? '');
	// svelte-ignore state_referenced_locally
	let ref = $state(node.ref ?? '');
	// svelte-ignore state_referenced_locally
	let front = $state(node.front);
	// svelte-ignore state_referenced_locally
	let back = $state(node.back);
	// svelte-ignore state_referenced_locally
	let zeilen = $state<Zeile[]>(node.mode !== 'open' ? parseZeilen(node.back) : []);
	// Chips: immer Zeilen-UI, kein Freitext-Modus
	// svelte-ignore state_referenced_locally
	let chipZeilen = $state<Zeile[]>(parseZeilen(node.chips));
	let speichert = $state(false);
	let vorschauFront = $state(false);
	let vorschauBack = $state(false);

	const istSchalen = $derived(modeWert !== 'open');
	const chipsText = $derived(serialisiere(chipZeilen));

	// In Schalen-Modi ist back stets die Serialisierung der Schalen.
	$effect(() => {
		if (istSchalen) back = serialisiere(zeilen);
	});

	function wechsleMode(neu: KartenMode) {
		if (neu !== 'open' && modeWert === 'open') zeilen = parseZeilen(back);
		modeWert = neu;
	}

	const daten = $derived<BauDaten>({
		type: typ,
		front,
		back,
		chips: chipsText,
		title: titel.trim() || null,
		ref: ref.trim() || null,
		mode: modeWert
	});

	const geaendert = $derived(
		typ !== node.type ||
			modeWert !== node.mode ||
			front !== node.front ||
			back !== node.back ||
			chipsText !== node.chips ||
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

	// --- Zeilen-Aktionen (Schalen und Chips teilen die Mechanik) ---
	function neueSchale() {
		zeilen = [...zeilen, { label: '', ziel: null }];
	}
	function loescheSchale(k: number) {
		zeilen = zeilen.filter((_, i) => i !== k);
	}
	function neuerChip() {
		chipZeilen = [...chipZeilen, { label: '', ziel: null }];
	}
	function loescheChip(k: number) {
		chipZeilen = chipZeilen.filter((_, i) => i !== k);
	}

	// Offset einer Zeile im serialisierten Text — damit die Seite den
	// [[Link]] exakt um dieses Label legen kann.
	function zeilenOffset(zs: Zeile[], k: number): number {
		let offset = 0;
		let index = 0;
		for (const z of zs) {
			if (z.label.trim() === '') continue;
			if (index === k) break;
			offset += (z.ziel ? `[[${z.label}|${z.ziel}]]` : z.label).length + 1;
			index++;
		}
		return offset;
	}

	function verlinkeZeile(feld: LinkFeld, zs: Zeile[], k: number) {
		const label = zs[k].label.trim();
		if (!label) return;
		zs[k].label = label;
		const offset = zeilenOffset(zs, k);
		if (feld === 'back') back = serialisiere(zs);
		onlinkstart(feld, offset, offset + label.length, label, daten);
	}

	// --- Formatieren (Cmd+B/I/U) + Cmd+S ---
	function formatiereText(text: string, start: number, ende: number, vor: string, nach: string) {
		return text.slice(0, start) + vor + text.slice(start, ende) + nach + text.slice(ende);
	}

	function tastatur(e: KeyboardEvent) {
		if (!(e.metaKey || e.ctrlKey)) return;

		if (e.key === 's') {
			e.preventDefault();
			if (geaendert) speichern();
			return;
		}

		const paare: Record<string, [string, string]> = {
			b: ['**', '**'],
			i: ['*', '*'],
			u: ['<u>', '</u>']
		};
		const paar = paare[e.key];
		if (!paar) return;

		const ziel = e.target;

		// Zeilen-Beschriftung (Schale oder Chip)?
		if (ziel instanceof HTMLInputElement && ziel.dataset.zeile !== undefined) {
			e.preventDefault();
			const k = Number(ziel.dataset.zeile);
			const liste = ziel.dataset.feld === 'chips' ? chipZeilen : zeilen;
			const start = ziel.selectionStart ?? 0;
			const ende = ziel.selectionEnd ?? 0;
			if (start === ende) return;
			liste[k].label = formatiereText(liste[k].label, start, ende, paar[0], paar[1]);
			requestAnimationFrame(() => {
				ziel.focus();
				ziel.setSelectionRange(start + paar[0].length, ende + paar[0].length);
			});
			return;
		}

		const istFront = ziel === frontFeld;
		const istBack = ziel === backFeld;
		if (!istFront && !istBack) return;
		e.preventDefault();
		const feld = ziel as HTMLTextAreaElement;
		const start = feld.selectionStart;
		const ende = feld.selectionEnd;
		if (start === ende) return;
		if (istFront) front = formatiereText(front, start, ende, paar[0], paar[1]);
		else back = formatiereText(back, start, ende, paar[0], paar[1]);
		requestAnimationFrame(() => {
			feld.focus();
			feld.setSelectionRange(start + paar[0].length, ende + paar[0].length);
		});
	}

	function verlinken() {
		if (!backFeld) return;
		const start = backFeld.selectionStart;
		const ende = backFeld.selectionEnd;
		if (start === ende) return;
		onlinkstart('back', start, ende, back.slice(start, ende), daten);
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
				<option value="thema">thema</option>
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
	<textarea
		id="front-{node.id}"
		class="feld"
		rows="2"
		bind:value={front}
		bind:this={frontFeld}
	></textarea>
	<div class="unter-zeile">
		<button
			class="vorschau-toggle"
			class:aktiv={vorschauFront}
			onclick={() => (vorschauFront = !vorschauFront)}
		>
			Vorschau
		</button>
	</div>

	{#if vorschauFront && front.trim()}
		<div class="vorschau">{@html rendere(front)}</div>
	{/if}

	<div class="label-zeile">
		<label class="feld-label" for="back-{node.id}">Rückseite</label>
		<span class="mode-wrap">
			<span class="mode-anzeige"
				>{modeWert === 'open' ? 'Offen' : modeWert === 'agls' ? 'AGLs' : 'Schema'}</span
			>
			<select
				class="mode-wahl"
				value={modeWert}
				onchange={(e) => wechsleMode(e.currentTarget.value as KartenMode)}
				aria-label="Darstellungs-Modus"
			>
				<option value="open">Offen</option>
				<option value="agls">AGLs</option>
				<option value="schema">Schema</option>
			</select>
		</span>
	</div>

	{#if !istSchalen}
		<textarea
			id="back-{node.id}"
			class="feld feld-back"
			rows="8"
			bind:value={back}
			bind:this={backFeld}
		></textarea>

		<div class="unter-zeile">
			<button
				class="vorschau-toggle"
				class:aktiv={vorschauBack}
				onclick={() => (vorschauBack = !vorschauBack)}
			>
				Vorschau
			</button>
		</div>

		{#if vorschauBack && back.trim()}
			<div class="vorschau">{@html rendere(back)}</div>
		{/if}
	{:else}
		<div class="schalen">
			{#each zeilen as zeile, k (k)}
				<div class="schale">
					<input
						class="schale-label"
						data-zeile={k}
						data-feld="back"
						bind:value={zeile.label}
						placeholder="z.B. A. § 437 iVm. § 280 — SE wegen Sachmangel"
					/>
					{#if zeile.ziel}
						<span class="ziel-chip">
							{zeile.ziel}
							<button class="chip-x" onclick={() => (zeile.ziel = null)} title="Verlinkung lösen"
								>×</button
							>
						</span>
					{:else}
						<button
							class="zeile-link"
							onclick={() => verlinkeZeile('back', zeilen, k)}
							disabled={!zeile.label.trim()}
						>
							verlinken
						</button>
					{/if}
					<button class="zeile-weg" onclick={() => loescheSchale(k)} aria-label="Schale löschen"
						>×</button
					>
				</div>
			{/each}
			<button class="schale-plus" onclick={neueSchale}>＋</button>
		</div>
	{/if}

	<!-- Chips: der Bahnhof — kleine Verweise unter der Karte, in jedem Mode -->
	<label class="feld-label" for="chips-{node.id}">Chips (Verweise unter der Karte)</label>
	<div class="chips" id="chips-{node.id}">
		{#each chipZeilen as chip, k (k)}
			<div class="chip">
				<input
					class="chip-label"
					data-zeile={k}
					data-feld="chips"
					bind:value={chip.label}
					placeholder="z.B. BGH: Wochenendhaus als Sachmangel?"
				/>
				{#if chip.ziel}
					<span class="ziel-chip">
						{chip.ziel}
						<button class="chip-x" onclick={() => (chip.ziel = null)} title="Verlinkung lösen"
							>×</button
						>
					</span>
				{:else}
					<button
						class="zeile-link"
						onclick={() => verlinkeZeile('chips', chipZeilen, k)}
						disabled={!chip.label.trim()}
					>
						verlinken
					</button>
				{/if}
				<button class="zeile-weg" onclick={() => loescheChip(k)} aria-label="Chip löschen">×</button>
			</div>
		{/each}
		<button class="chip-plus" onclick={neuerChip}>＋ Chip</button>
	</div>

	<div class="aktionen">
		{#if !istSchalen}
			<button class="verlinken" onclick={verlinken}>Markiertes verlinken</button>
		{:else}
			<span></span>
		{/if}
		<button
			class="speichern"
			class:bereit={geaendert}
			onclick={speichern}
			disabled={!geaendert || speichert}
		>
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
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
	}
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
	.typ-wahl:focus {
		outline: none;
		color: var(--text);
	}
	.id {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--text-fluester);
		opacity: 0.7;
	}
	.schliessen {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.2rem;
		transition: color 0.15s ease;
	}
	.schliessen:hover {
		color: var(--text);
	}

	.zeile-2 {
		display: flex;
		gap: 0.75rem;
	}
	.spalte-titel {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.spalte-ref {
		flex: 0 0 11rem;
		display: flex;
		flex-direction: column;
	}

	.label-zeile {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.unter-zeile {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.3rem;
	}
	.feld-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-fluester);
		margin: 0.75rem 0 0.35rem;
	}
	.mode-wrap {
		position: relative;
		display: inline-block;
	}
	.mode-anzeige {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-fluester);
		transition: color 0.15s ease;
	}
	.mode-wrap:hover .mode-anzeige {
		color: var(--text-leise);
	}
	.mode-wahl {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		background: none !important;
		padding: 0 !important;
		border: none;
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
	.vorschau-toggle:hover {
		color: var(--text-leise);
	}
	.vorschau-toggle.aktiv {
		color: var(--akzent);
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
	.feld:focus {
		outline: none;
		border-color: var(--akzent);
	}
	.feld-back {
		font-size: 0.92rem;
	}

	.vorschau {
		margin-top: 0.5rem;
		border: 1px dashed var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.9rem 1rem;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-leise);
	}
	.vorschau :global(p) {
		margin: 0 0 0.6em;
	}
	.vorschau :global(p:last-child) {
		margin-bottom: 0;
	}
	.vorschau :global(strong) {
		font-weight: 600;
		color: var(--text);
	}
	.vorschau :global(ul) {
		padding-left: 1.25em;
		margin: 0 0 0.6em;
	}
	.vorschau :global(ol) {
		padding-left: 1.25em;
		margin: 0 0 0.6em;
	}

	/* Schalen: gestapelte Pillen */
	.schalen {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.schale {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: var(--bg);
		border: 1px solid var(--linie);
		border-radius: 999px;
		padding: 0.35rem 0.6rem 0.35rem 1rem;
		transition: border-color 0.15s ease;
	}
	.schale:focus-within {
		border-color: var(--akzent);
	}
	.schale-label {
		flex: 1;
		background: none;
		border: none;
		color: var(--text);
		font-family: inherit;
		font-size: 0.92rem;
		padding: 0.3rem 0;
	}
	.schale-label:focus {
		outline: none;
	}
	.schale-plus {
		align-self: flex-start;
		background: none;
		border: 1px dashed var(--linie-stark);
		border-radius: 999px;
		padding: 0.35rem 1.1rem;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.schale-plus:hover {
		color: var(--text);
		border-color: var(--text-fluester);
	}

	/* Chips im Editor: kompakter als Schalen, gelber Akzent */
	.chips {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg);
		border: 1px solid color-mix(in srgb, var(--typ-thema) 25%, var(--linie));
		border-radius: 999px;
		padding: 0.2rem 0.5rem 0.2rem 0.85rem;
		transition: border-color 0.15s ease;
	}
	.chip:focus-within {
		border-color: color-mix(in srgb, var(--typ-thema) 60%, var(--linie));
	}
	.chip-label {
		flex: 1;
		background: none;
		border: none;
		color: var(--text);
		font-family: inherit;
		font-size: 0.82rem;
		padding: 0.25rem 0;
	}
	.chip-label:focus {
		outline: none;
	}
	.chip-plus {
		align-self: flex-start;
		background: none;
		border: 1px dashed color-mix(in srgb, var(--typ-thema) 35%, var(--linie-stark));
		border-radius: 999px;
		padding: 0.25rem 0.85rem;
		color: var(--text-fluester);
		font-family: inherit;
		font-size: 0.78rem;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.chip-plus:hover {
		color: var(--text);
		border-color: var(--typ-thema);
	}

	/* Gemeinsame Zeilen-Elemente */
	.ziel-chip {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: var(--flaeche-hoch);
		border-radius: 999px;
		padding: 0.2rem 0.4rem 0.2rem 0.7rem;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--typ-definition);
		flex-shrink: 0;
	}
	.chip-x {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-size: 0.9rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.15rem;
	}
	.chip-x:hover {
		color: var(--text);
	}
	.zeile-link {
		background: none;
		border: 1px solid var(--linie-stark);
		border-radius: 999px;
		padding: 0.25rem 0.75rem;
		color: var(--text-leise);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.zeile-link:hover:not(:disabled) {
		color: var(--text);
		border-color: var(--text-fluester);
	}
	.zeile-link:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.zeile-weg {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.2rem;
		flex-shrink: 0;
		transition: color 0.15s ease;
	}
	.zeile-weg:hover {
		color: #ff453a;
	}

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
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.verlinken:hover {
		color: var(--text);
		border-color: var(--text-fluester);
	}
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
		transition:
			background 0.15s ease,
			color 0.15s ease,
			transform 0.1s ease;
	}
	.speichern.bereit {
		background: var(--akzent);
		color: white;
		border-color: transparent;
		cursor: pointer;
	}
	.speichern.bereit:hover {
		background: var(--akzent-hover);
	}
	.speichern.bereit:active {
		transform: scale(0.97);
	}
</style>
