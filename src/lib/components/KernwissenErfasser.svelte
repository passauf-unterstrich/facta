<script lang="ts">
	import { onMount, tick } from 'svelte';

	let {
		quelleTitel,
		ongespeichert
	}: {
		quelleTitel: string;
		ongespeichert?: (titel: string) => void;
	} = $props();

	type Entwurf = { title: string; front: string; back: string };
	type Position = { x: number; y: number };

	const OLLAMA = 'http://127.0.0.1:11434';
	const MODELL_SCHLUESSEL = 'facta:kernwissen:ollama-modell';
	const SCHEMA = {
		type: 'object',
		properties: {
			title: { type: 'string' },
			front: { type: 'string' },
			back: { type: 'string' }
		},
		required: ['title', 'front', 'back'],
		additionalProperties: false
	};
	const SYSTEMPROMPT = `Du bist ein kompromissloser Redakteur für deutsches juristisches Klausur-Kernwissen.

AUFGABE
Erzeuge genau EINE atomare Wiederholungskarte. Sie soll nicht den gesamten Ausgangstext abbilden, sondern nur den einen klausurrelevanten Gedanken, den der Nutzer später in wenigen Sekunden abrufen muss.

PRIORITÄTEN
1. Der Nutzerkommentar legt fest, WAS gelernt werden soll. Auch ein langer oder diktierter Kommentar ist zunächst auf seine eine zentrale Lernabsicht zu reduzieren.
2. Die markierte Passage ist die inhaltliche Grundlage. Führe keine neuen Themen, Meinungen oder Details aus Außenwissen ein.
3. Bei bloßem sprachlichem Ballast darfst und sollst du mutig kürzen. Verändere jedoch keine Rechtsnorm, Tatbestandsvoraussetzung, Rechtsfolge, Ausnahme, Negation, Zahl oder Rangfolge.

REDAKTION
- Entscheide intern zuerst: „Welche eine Information muss nach dieser Eingabe hängen bleiben?“ Gib diese Vorüberlegung nicht aus.
- Streiche Sachverhalt, Einleitung, Literatur, Fundstellen, Wiederholungen, Begründungswege und Nebenfolgen, sofern sie nicht selbst das Lernziel sind.
- Wenn der Kommentar mehrere Punkte enthält, nimm den klar erkennbaren Hauptpunkt. Nur untrennbar notwendige Voraussetzungen dürfen mit auf die Karte.
- title: sachliches Stichwort, höchstens 7 Wörter.
- front: eine eindeutige Abruffrage oder ein präziser Lückengedanke, höchstens 20 Wörter. Die Antwort darf nicht vorweggenommen werden.
- back: unmittelbare Antwort, grundsätzlich ein Satz; nur wenn klarer, höchstens 3 sehr kurze Stichpunkte und insgesamt höchstens 50 Wörter.
- Normzitate knapp, aber exakt. Keine Floskeln wie „Wichtig ist“, „Merke“, „Hierbei ist zu beachten“ oder „Der Text besagt“.
- Kein Vorwort, keine Quellenangabe, keine Meta-Erklärung, keine zusätzliche Karte.

Gib ausschließlich das verlangte JSON-Objekt mit title, front und back aus.`;

	let markierung = $state('');
	let position = $state<Position | null>(null);
	let dialogOffen = $state(false);
	let kommentar = $state('');
	let modelle = $state<string[]>([]);
	let modell = $state('');
	let modellStatus = $state('Suche lokale Modelle …');
	let erzeugt = $state<Entwurf | null>(null);
	let arbeite = $state(false);
	let speichere = $state(false);
	let fehler = $state('');
	let kommentarFeld = $state<HTMLTextAreaElement>();

	onMount(() => {
		ladeModelle();
	});

	async function ladeModelle() {
		modellStatus = 'Suche lokale Modelle …';
		try {
			const res = await fetch(`${OLLAMA}/api/tags`);
			if (!res.ok) throw new Error(`Ollama antwortet mit ${res.status}`);
			const daten = await res.json();
			modelle = Array.isArray(daten.models)
				? daten.models
						.map((m: { name?: string }) => m.name)
						.filter((name: string | undefined): name is string => typeof name === 'string' && !!name)
				: [];
			const gemerkt = localStorage.getItem(MODELL_SCHLUESSEL) ?? '';
			modell = modelle.includes(gemerkt) ? gemerkt : (modelle[0] ?? '');
			modellStatus = modelle.length
				? `${modelle.length} lokale${modelle.length === 1 ? 's Modell' : ' Modelle'} verfügbar.`
				: 'Ollama läuft, aber es ist noch kein Modell installiert.';
		} catch {
			modelle = [];
			modell = '';
			modellStatus =
				'Ollama ist in diesem Browser nicht erreichbar. Öffne Ollama auf diesem Mac und erlaube Facta als Ursprung.';
		}
	}

	function pruefeMarkierung(event?: Event) {
		if (dialogOffen) return;
		const ziel = event?.target instanceof Element ? event.target : null;
		if (ziel?.closest('[data-kernwissen-trigger]')) return;

		// Mobile Browser setzen die endgültige Auswahl teils erst direkt
		// nach dem Pointer-Ereignis. Ein kurzer Aufschub fängt beides ab.
		setTimeout(() => {
			if (dialogOffen) return;
			const auswahl = window.getSelection();
			const text = auswahl?.toString().replace(/\s+/g, ' ').trim() ?? '';
			if (!auswahl || auswahl.rangeCount === 0 || !text) {
				position = null;
				return;
			}

			const anker = auswahl.anchorNode;
			const element =
				anker instanceof Element ? anker : anker?.parentElement instanceof Element ? anker.parentElement : null;
			if (!element?.closest('.karte')) {
				position = null;
				return;
			}

			const rect = auswahl.getRangeAt(0).getBoundingClientRect();
			if (!rect.width && !rect.height) return;
			markierung = text.slice(0, 6000);
			position = {
				x: Math.min(Math.max(rect.left + rect.width / 2, 74), window.innerWidth - 74),
				y: Math.max(rect.top - 12, 52)
			};
		}, 20);
	}

	async function oeffneDialog() {
		if (!markierung) return;
		dialogOffen = true;
		position = null;
		kommentar = '';
		erzeugt = null;
		fehler = '';
		window.getSelection()?.removeAllRanges();
		await tick();
		kommentarFeld?.focus();
	}

	function schliesseDialog() {
		if (arbeite || speichere) return;
		dialogOffen = false;
		markierung = '';
		position = null;
		erzeugt = null;
		fehler = '';
	}

	function istEntwurf(wert: unknown): wert is Entwurf {
		if (!wert || typeof wert !== 'object') return false;
		const e = wert as Record<string, unknown>;
		return (
			typeof e.title === 'string' &&
			!!e.title.trim() &&
			typeof e.front === 'string' &&
			!!e.front.trim() &&
			typeof e.back === 'string' &&
			!!e.back.trim()
		);
	}

	async function verdichten() {
		if (!modell || !kommentar.trim() || arbeite) return;
		arbeite = true;
		fehler = '';
		try {
			localStorage.setItem(MODELL_SCHLUESSEL, modell);
			const res = await fetch(`${OLLAMA}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: modell,
					stream: false,
					format: SCHEMA,
					options: { temperature: 0, num_predict: 320 },
					messages: [
						{
							role: 'system',
							content: SYSTEMPROMPT
						},
						{
							role: 'user',
							content: `MEIN KOMMENTAR (maßgebliches Lernziel):\n${kommentar.trim()}\n\nMARKIERTE PASSAGE (nur Kontext):\n${markierung}\n\nQUELLKARTE:\n${quelleTitel}`
						}
					]
				})
			});
			if (!res.ok) {
				const antwort = await res.text();
				throw new Error(antwort || `Ollama antwortet mit ${res.status}`);
			}
			const daten = await res.json();
			const inhalt = daten?.message?.content;
			if (typeof inhalt !== 'string') throw new Error('Ollama hat keinen Kartenentwurf geliefert.');
			const entwurf = JSON.parse(inhalt);
			if (!istEntwurf(entwurf)) throw new Error('Der Kartenentwurf ist unvollständig.');
			erzeugt = {
				title: entwurf.title.trim(),
				front: entwurf.front.trim(),
				back: entwurf.back.trim()
			};
		} catch (err) {
			fehler =
				err instanceof SyntaxError
					? 'Das lokale Modell hat kein gültiges Kartenformat geliefert. Bitte erneut versuchen.'
					: err instanceof Error
						? err.message
						: 'Die Karte konnte lokal nicht erzeugt werden.';
		} finally {
			arbeite = false;
		}
	}

	async function speichern() {
		if (!erzeugt || !istEntwurf(erzeugt) || speichere) return;
		speichere = true;
		fehler = '';
		try {
			const res = await fetch('/api/nodes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: `kernwissen_${crypto.randomUUID().replaceAll('-', '_')}`,
					type: 'simpel',
					area: 'kernwissen_klausur',
					title: erzeugt.title.trim(),
					front: erzeugt.front.trim(),
					back: erzeugt.back.trim(),
					chips: '',
					ref: null,
					mode: 'open'
				})
			});
			const antwort = await res.json().catch(() => null);
			if (!res.ok) throw new Error(antwort?.message ?? 'Speichern fehlgeschlagen.');
			const titel = erzeugt.title.trim();
			dialogOffen = false;
			markierung = '';
			erzeugt = null;
			ongespeichert?.(titel);
		} catch (err) {
			fehler = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
		} finally {
			speichere = false;
		}
	}
</script>

<svelte:window
	onpointerup={pruefeMarkierung}
	onmouseup={pruefeMarkierung}
	ontouchend={pruefeMarkierung}
	onkeyup={pruefeMarkierung}
	onkeydown={(event) => {
		if (event.key === 'Escape' && dialogOffen) schliesseDialog();
	}}
/>
<!-- Safari aktualisiert die sichtbare Textauswahl in verschachtelten Karten
     teilweise erst nach pointerup. selectionchange ist dort die verlässliche
     Quelle; Maus und Touch oben bleiben als schnelle Fallbacks erhalten. -->
<svelte:document onselectionchange={pruefeMarkierung} />

{#if position && !dialogOffen}
	<button
		class="markierungs-knopf"
		style:left={`${position.x}px`}
		style:top={`${position.y}px`}
		type="button"
		data-kernwissen-trigger
		onpointerdown={(event) => event.preventDefault()}
		onclick={oeffneDialog}
	>
		<span aria-hidden="true">＋</span> Kernwissen
	</button>
{/if}

{#if dialogOffen}
	<div
		class="vorhang"
		role="presentation"
		onmousedown={(event) => event.target === event.currentTarget && schliesseDialog()}
	>
		<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="kernwissen-titel">
			<header>
				<div>
					<span class="ueberzeile">Kernwissen Klausur</span>
					<h2 id="kernwissen-titel">Merkkarte verdichten</h2>
				</div>
				<button class="schliessen" type="button" onclick={schliesseDialog} aria-label="Schließen">×</button>
			</header>

			<div class="abschnitt">
				<span class="feld-label">Markierte Passage</span>
				<blockquote>{markierung}</blockquote>
			</div>

			<div class="abschnitt">
				<label for="kernwissen-kommentar">Was willst du dir daraus unbedingt merken?</label>
				<textarea
					id="kernwissen-kommentar"
					bind:value={kommentar}
					rows="4"
					placeholder="Dein Kommentar bestimmt den Schwerpunkt der Karte …"
					bind:this={kommentarFeld}
				></textarea>
			</div>

			<div class="modell-zeile">
				<div>
					<label for="kernwissen-modell">Lokales Modell</label>
					<span>{modellStatus}</span>
				</div>
				{#if modelle.length > 0}
					<select id="kernwissen-modell" bind:value={modell}>
						{#each modelle as name (name)}<option value={name}>{name}</option>{/each}
					</select>
				{:else}
					<button class="sekundaer klein" type="button" onclick={ladeModelle}>Erneut prüfen</button>
				{/if}
			</div>

			{#if !erzeugt}
				<div class="aktionen rechts">
					<button class="primaer" type="button" onclick={verdichten} disabled={!modell || !kommentar.trim() || arbeite}>
						{arbeite ? 'Verdichte …' : 'Karte entwerfen'}
					</button>
				</div>
			{:else}
				<div class="vorschau">
					<span class="ueberzeile">Bearbeitbare Vorschau</span>
					<label for="kernwissen-entwurf-titel">Titel</label>
					<input id="kernwissen-entwurf-titel" bind:value={erzeugt.title} />
					<label for="kernwissen-entwurf-front">Vorderseite</label>
					<textarea id="kernwissen-entwurf-front" bind:value={erzeugt.front} rows="2"></textarea>
					<label for="kernwissen-entwurf-back">Rückseite</label>
					<textarea id="kernwissen-entwurf-back" bind:value={erzeugt.back} rows="4"></textarea>
				</div>
				<div class="aktionen">
					<button class="sekundaer" type="button" onclick={() => (erzeugt = null)}>Neu entwerfen</button>
					<button class="primaer" type="button" onclick={speichern} disabled={!istEntwurf(erzeugt) || speichere}>
						{speichere ? 'Speichere …' : 'OK · Karte hinzufügen'}
					</button>
				</div>
			{/if}

			{#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
		</div>
	</div>
{/if}

<style>
	.markierungs-knopf {
		position: fixed;
		z-index: 240;
		transform: translate(-50%, -100%);
		border: 1px solid color-mix(in srgb, var(--akzent) 65%, var(--linie));
		border-radius: 999px;
		background: color-mix(in srgb, var(--flaeche-hoch) 90%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38);
		color: var(--text);
		padding: 0.42rem 0.72rem;
		font: inherit;
		font-size: 0.76rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}
	.markierungs-knopf:hover {
		background: color-mix(in srgb, var(--akzent) 18%, var(--flaeche-hoch));
	}
	.markierungs-knopf span {
		color: var(--akzent);
	}

	.vorhang {
		position: fixed;
		inset: 0;
		z-index: 300;
		display: grid;
		place-items: center;
		overflow-y: auto;
		padding: 1.25rem;
		background: rgba(0, 0, 0, 0.68);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	.dialog {
		width: min(40rem, 100%);
		max-height: calc(100dvh - 2.5rem);
		overflow-y: auto;
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-l);
		background: var(--bg);
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
		padding: 1.4rem;
	}
	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.35rem;
	}
	h2 {
		margin: 0.18rem 0 0;
		font-size: 1.3rem;
		letter-spacing: -0.02em;
	}
	.ueberzeile,
	label,
	.feld-label {
		display: block;
		color: var(--text-fluester);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.schliessen {
		border: none;
		background: none;
		color: var(--text-fluester);
		font: inherit;
		font-size: 1.4rem;
		line-height: 1;
		cursor: pointer;
	}
	.abschnitt {
		margin-bottom: 1rem;
	}
	blockquote {
		max-height: 8rem;
		overflow-y: auto;
		margin: 0.4rem 0 0;
		border-left: 2px solid var(--akzent);
		border-radius: 0 var(--radius-m) var(--radius-m) 0;
		background: var(--flaeche);
		padding: 0.75rem 0.9rem;
		color: var(--text-leise);
		font-size: 0.86rem;
		line-height: 1.5;
	}
	textarea,
	input,
	select {
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.4rem;
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-m);
		background: var(--flaeche);
		color: var(--text);
		padding: 0.7rem 0.8rem;
		font: inherit;
		font-size: 0.9rem;
		line-height: 1.45;
		resize: vertical;
	}
	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--akzent);
	}
	.modell-zeile {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin: 1rem 0;
		border-top: 1px solid var(--linie);
		padding-top: 0.9rem;
	}
	.modell-zeile > div {
		min-width: 0;
		flex: 1;
	}
	.modell-zeile span {
		display: block;
		margin-top: 0.28rem;
		color: var(--text-fluester);
		font-size: 0.74rem;
		line-height: 1.35;
	}
	.modell-zeile select {
		width: auto;
		max-width: 48%;
		margin: 0;
	}
	.vorschau {
		display: grid;
		gap: 0.65rem;
		margin-top: 1.2rem;
		border-top: 1px solid var(--linie);
		padding-top: 1rem;
	}
	.vorschau input,
	.vorschau textarea {
		margin-top: -0.3rem;
	}
	.aktionen {
		display: flex;
		justify-content: space-between;
		gap: 0.65rem;
		margin-top: 1rem;
	}
	.aktionen.rechts {
		justify-content: flex-end;
	}
	.primaer,
	.sekundaer {
		border-radius: var(--radius-m);
		padding: 0.62rem 1rem;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
	}
	.primaer {
		border: 1px solid var(--akzent);
		background: var(--akzent);
		color: white;
	}
	.sekundaer {
		border: 1px solid var(--linie-stark);
		background: var(--flaeche);
		color: var(--text-leise);
	}
	.sekundaer.klein {
		flex: 0 0 auto;
		padding: 0.48rem 0.75rem;
	}
	.primaer:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.fehler {
		margin: 0.9rem 0 0;
		border-radius: var(--radius-m);
		background: color-mix(in srgb, #ff453a 10%, transparent);
		padding: 0.65rem 0.75rem;
		color: #ff6961;
		font-size: 0.78rem;
		line-height: 1.45;
	}

	@media (max-width: 560px) {
		.vorhang {
			place-items: end center;
			padding: 0;
		}
		.dialog {
			width: 100%;
			max-height: 92dvh;
			border-radius: var(--radius-l) var(--radius-l) 0 0;
			padding: 1.1rem;
		}
		.modell-zeile {
			align-items: stretch;
			flex-direction: column;
		}
		.modell-zeile select {
			width: 100%;
			max-width: none;
		}
		.aktionen {
			flex-direction: column-reverse;
		}
		.primaer,
		.sekundaer {
			width: 100%;
		}
	}
</style>
