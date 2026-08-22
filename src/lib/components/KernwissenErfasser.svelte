<script lang="ts">
	import { onMount, tick } from 'svelte';

	let {
		quelleId,
		quelleBaumId,
		quelleTitel,
		ongespeichert,
		onschliessen
	}: {
		quelleId: string;
		quelleBaumId?: string | null;
		quelleTitel: string;
		ongespeichert?: (titel: string) => void;
		onschliessen: () => void;
	} = $props();

	type Entwurf = { title: string; front: string; back: string };

	const OLLAMA = 'http://127.0.0.1:11434';
	const BRUECKE_URL = 'http://127.0.0.1:11435/';
	const BRUECKE_ORIGIN = 'http://127.0.0.1:11435';
	const SELF_SERVICE = '__self_service__';
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
	const SYSTEMPROMPT = `Du bist ein sorgfältiger Qualitätsredakteur für deutsches juristisches Klausur-Kernwissen.

AUFGABE
Erzeuge aus der Nutzereingabe genau EINE didaktisch gute Wiederholungskarte. „Genau eine Karte“ beschränkt nur die Anzahl der Karten, nicht den zulässigen Umfang ihrer Rückseite. Eine Karte darf mehrere zusammengehörige Prüfungsschritte, Voraussetzungen oder Argumente enthalten.

VERBINDLICHE VOLLSTÄNDIGKEITSREGEL
1. Der diktierte oder geschriebene Nutzertext ist regelmäßig bereits ein fachlich gut formulierter, nahezu fertiger Entwurf genau des Gedankens, den der Nutzer später wiederholen will. Übernimm deshalb seine Gedankenführung, Gewichtung, inhaltliche Reichweite und bewusst genannten Einzelheiten als verbindliche Leitlinie. Suche darin nicht erst einen vermeintlich engeren „Hauptgedanken“ und interpretiere das Lernziel nicht eigenmächtig um.
2. Deine redaktionelle Leistung besteht vor allem darin, den Nutzertext sprachlich zu glätten, übersichtlich zu ordnen und als präzise Frage mit eigenständig verständlicher Antwort zu formulieren. Lass nur erkennbare Versprecher, Füllwörter, bloße Wiederholungen und eindeutig verworfene Selbstkorrekturen weg. Eindeutige Diktier- oder Transkriptionsfehler darfst du aus dem juristischen Zusammenhang behutsam berichtigen; bei inhaltlicher Unsicherheit bleibt die Nutzerformulierung maßgeblich.
3. Erhalte insbesondere sämtliche genannten Rechtsnormen, Definitionen, Prüfungsschritte und ihre Reihenfolge, Voraussetzungen, Unterscheidungen, Ausnahmen, Negationen, Indizien, Argumentationslinien, Rechtsfolgen und Ergebnisse.
4. Konkrete Nutzerwünsche zu Schwerpunkt, Vollständigkeit, Aufbau oder Darstellungsform sind verbindlich. Verlangt der Nutzer etwa „alle Bestandteile“, „inhaltlich vollständig“ oder „in Stichpunkten“, muss die Rückseite genau dies leisten.
5. Die optional markierte Passage ist verbindlicher fachlicher Kontext, nicht bloß dekorativer Zusatz. Nutze alle daraus für das erklärte Lernziel relevanten Definitionen, Voraussetzungen, Abgrenzungen, Bezüge und Präzisierungen, auch wenn der Nutzer sie im Kommentar nicht nochmals vollständig ausgesprochen hat. Sie dient dazu, das Diktat richtig einzuordnen und sinnvoll zu vervollständigen; sie darf dessen Schwerpunkt, Gedankenführung oder gewünschte Reichweite nicht verdrängen. Übernimm sie nicht mechanisch und weite das Lernziel nicht auf sachfremde Punkte der Passage aus. Ergänze keine neuen Themen, Meinungen oder Details aus Außenwissen.
6. Die fertige Karte muss ohne Ausgangskarte verständlich sein. Formuliere sie so, dass der Nutzer sie nach zwei Wochen und nach vielen anderen Lerninhalten isoliert lesen, eindeutig einordnen und sofort verstehen kann. Löse unklare Rückverweise wie „hier“, „dabei“, „dies“, „das“ oder „in diesem Fall“ auf und benenne das betroffene Rechtsproblem, Tatbestandsmerkmal oder Prüfungsstadium ausdrücklich.

REDAKTION
- Ermittle intern vor dem Schreiben alle eigenständigen inhaltlichen Bausteine des Nutzertexts. Prüfe vor der Ausgabe jeden dieser Bausteine gegen die Rückseite und überarbeite sie, falls noch etwas fehlt. Gib diese interne Checkliste nicht aus.
- Prüfe danach gedanklich die Karte ohne Nutzertext, markierte Passage und Quellkarte: Sind Gegenstand, rechtlicher Zusammenhang und Reichweite weiterhin eindeutig? Falls nicht, ergänze den knappsten erforderlichen Kontext.
- Vollständigkeit und juristische Präzision gehen vor Kürze. Formuliere erst danach so knapp und lernbar wie möglich. Es gibt keine feste Wortgrenze.
- Begründungen und Zwischenschritte sind beizubehalten, wenn der Nutzer sie bewusst diktiert oder als klausurrelevant bezeichnet. Sachverhalt, Literatur, Fundstellen und Nebeninformationen dürfen nur entfallen, soweit sie erkennbar nicht zum gewünschten Lerninhalt gehören.
- title: sachliches Stichwort, höchstens 7 Wörter.
- front: eine eindeutige Abruffrage, die den gesamten gewünschten Inhalt der einen Karte abfragt, ohne die Antwort vorwegzunehmen. Benenne den rechtlichen Gegenstand so konkret, dass die Frage isoliert verständlich ist.
- back: inhaltlich vollständige, eigenständig verständliche und klar strukturierte Antwort. Verwende bei mehreren Prüfungsschritten oder Argumenten Absätze, Nummerierungen oder prägnante Stichpunkte. Die Rückseite darf und soll länger sein, wenn dies für die vom Nutzer ausgewählten Inhalte oder ihre spätere Einordnung erforderlich ist.
- Normzitate knapp, aber exakt. Keine Floskeln wie „Wichtig ist“, „Merke“, „Hierbei ist zu beachten“ oder „Der Text besagt“.
- Kein Vorwort, keine Quellenangabe, keine Meta-Erklärung, keine zusätzliche Karte.

	Gib ausschließlich das verlangte JSON-Objekt mit title, front und back aus.`;

	let markierung = $state('');
	let kommentar = $state('');
	let nutzeBruecke = $state(false);
	let modelle = $state<string[]>([]);
	let modell = $state('');
	let modellStatus = $state('Suche lokale Modelle …');
	let erzeugt = $state<Entwurf | null>(null);
	let selfServiceOffen = $state(false);
	let selfServiceAntwort = $state('');
	let promptKopiert = $state(false);
	let kopierHinweisTimer: ReturnType<typeof setTimeout> | undefined;
	let arbeite = $state(false);
	let speichere = $state(false);
	let fehler = $state('');
	let kommentarFeld = $state<HTMLTextAreaElement>();
	const istSelfService = $derived(modell === SELF_SERVICE);
	const promptPaket = $derived.by(() =>
		selfServiceOffen ? bauePromptPaket() : ''
	);

	onMount(async () => {
		// Eine noch bestehende Auswahl nehmen wir gern als Zusatzkontext mit.
		// Sie ist ausdrücklich keine Voraussetzung mehr für die Funktion.
		const auswahl = window.getSelection();
		const text = auswahl?.toString().replace(/\s+/g, ' ').trim() ?? '';
		const anker = auswahl?.anchorNode;
		const element =
			anker instanceof Element ? anker : anker?.parentElement instanceof Element ? anker.parentElement : null;
		if (text && element?.closest('.karte')) markierung = text.slice(0, 6000);
		window.getSelection()?.removeAllRanges();
		nutzeBruecke = istSafariBrowser();
		if (nutzeBruecke) {
			const lokalesModell = localStorage.getItem(MODELL_SCHLUESSEL) || 'llama3.1:8b';
			modelle = [lokalesModell];
			modell = SELF_SERVICE;
			modellStatus = 'Safari nutzt die lokale Facta-Brücke. Alles bleibt auf diesem Mac.';
		} else {
			ladeModelle();
		}
		await tick();
		kommentarFeld?.focus();
	});

	function istSafariBrowser(): boolean {
		return (
			/Safari/i.test(navigator.userAgent) &&
			!/(Chrome|Chromium|CriOS|Edg|OPR)/i.test(navigator.userAgent)
		);
	}

	function nutzerInhalt(): string {
		return `MEIN DIKTIERTER ODER GESCHRIEBENER INHALT (maßgebliches Lernziel und Grundlage):\n${kommentar.trim()}${markierung ? `\n\nOPTIONALE MARKIERTE PASSAGE (nur Zusatzkontext):\n${markierung}` : ''}\n\nQUELLKARTE:\n${quelleTitel}`;
	}

	function bauePromptPaket(): string {
		return `Erstelle anhand der folgenden verbindlichen Redaktionsanweisung genau eine juristische Kernwissenkarte.\n\n--- SYSTEMANWEISUNG ---\n${SYSTEMPROMPT}\n\n--- NUTZEREINGABE ---\n${nutzerInhalt()}\n\n--- TECHNISCHES AUSGABEFORMAT ---\nAntworte ausschließlich mit genau einem validen JSON-Objekt in dieser Form:\n{\n  "title": "Kurzer Titel",\n  "front": "Präzise Abruffrage",\n  "back": "Inhaltlich vollständige, didaktisch strukturierte Antwort"\n}\nKein Markdown-Codeblock, keine Einleitung, keine Erklärung vor oder nach dem JSON.`;
	}

	function wechsleModell(event: Event) {
		modell = (event.currentTarget as HTMLSelectElement).value;
		erzeugt = null;
		selfServiceOffen = false;
		selfServiceAntwort = '';
		promptKopiert = false;
		fehler = '';
	}

	function oeffneSelfService() {
		if (!kommentar.trim()) return;
		selfServiceOffen = true;
		selfServiceAntwort = '';
		promptKopiert = false;
		fehler = '';
	}

	async function kopierePrompt() {
		try {
			await navigator.clipboard.writeText(promptPaket);
			promptKopiert = true;
			if (kopierHinweisTimer) clearTimeout(kopierHinweisTimer);
			kopierHinweisTimer = setTimeout(() => (promptKopiert = false), 2500);
		} catch {
			fehler = 'Das Prompt-Paket konnte nicht kopiert werden. Bitte den Text im Feld manuell markieren.';
		}
	}

	function bereinigeJsonAntwort(text: string): string {
		let sauber = text.trim();
		sauber = sauber.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
		const anfang = sauber.indexOf('{');
		const ende = sauber.lastIndexOf('}');
		return anfang >= 0 && ende > anfang ? sauber.slice(anfang, ende + 1) : sauber;
	}

	function uebernehmeSelfServiceAntwort() {
		fehler = '';
		try {
			const entwurf: unknown = JSON.parse(bereinigeJsonAntwort(selfServiceAntwort));
			if (!istEntwurf(entwurf)) {
				throw new Error('Das JSON muss die ausgefüllten Textfelder title, front und back enthalten.');
			}
			erzeugt = {
				title: entwurf.title.trim(),
				front: entwurf.front.trim(),
				back: entwurf.back.trim()
			};
		} catch (err) {
			fehler =
				err instanceof SyntaxError
					? 'Die eingefügte Antwort ist kein gültiges JSON. Bitte die vollständige Modellantwort erneut kopieren.'
					: err instanceof Error
						? err.message
						: 'Die Modellantwort konnte nicht übernommen werden.';
		}
	}

	function brueckenAnfrage(action: 'tags' | 'chat', payload?: object): Promise<unknown> {
		const requestId = crypto.randomUUID();
		return new Promise((resolve, reject) => {
			let fenster: Window | null = null;
			let antwortTimer: ReturnType<typeof setTimeout> | undefined;
			let gesendet = false;

			function aufraeumen() {
				window.removeEventListener('message', empfange);
				clearTimeout(startTimer);
				if (antwortTimer) clearTimeout(antwortTimer);
			}

			function empfange(event: MessageEvent) {
				if (event.origin !== BRUECKE_ORIGIN || event.source !== fenster) return;
				if (event.data?.type === 'facta-ollama-ready' && !gesendet) {
					gesendet = true;
					clearTimeout(startTimer);
					fenster?.postMessage(
						{ type: 'facta-ollama-request', requestId, action, payload },
						BRUECKE_ORIGIN
					);
					antwortTimer = setTimeout(() => {
						aufraeumen();
						reject(new Error('Das lokale Modell hat zu lange gebraucht.'));
					}, 120_000);
					return;
				}
				if (event.data?.type !== 'facta-ollama-response' || event.data?.requestId !== requestId)
					return;
				aufraeumen();
				if (event.data.ok) resolve(event.data.data);
				else reject(new Error(event.data.message || 'Die lokale KI konnte nicht antworten.'));
			}

			window.addEventListener('message', empfange);
			const startTimer = setTimeout(() => {
				aufraeumen();
				fenster?.close();
				reject(
					new Error(
						'Die lokale Facta-Brücke ist nicht erreichbar. Bitte den Hintergrunddienst einmal einrichten oder neu starten.'
					)
				);
			}, 8_000);

			fenster = window.open(
				BRUECKE_URL,
				'facta-ollama-bridge',
				'popup,width=430,height=230,resizable=yes'
			);
			if (!fenster) {
				aufraeumen();
				reject(new Error('Safari hat das lokale Hilfsfenster blockiert. Bitte Pop-ups für Facta erlauben.'));
			}
		});
	}

	async function ladeModelle() {
		modellStatus = 'Suche lokale Modelle …';
		try {
			let daten: { models?: Array<{ name?: string }> };
			if (nutzeBruecke) {
				daten = (await brueckenAnfrage('tags')) as { models?: Array<{ name?: string }> };
			} else {
				const res = await fetch(`${OLLAMA}/api/tags`);
				if (!res.ok) throw new Error(`Ollama antwortet mit ${res.status}`);
				daten = await res.json();
			}
			modelle = Array.isArray(daten.models)
				? daten.models
						.map((m: { name?: string }) => m.name)
						.filter((name: string | undefined): name is string => typeof name === 'string' && !!name)
				: [];
			modell = SELF_SERVICE;
			modellStatus = modelle.length
				? `${modelle.length} lokale${modelle.length === 1 ? 's Modell' : ' Modelle'} verfügbar.`
				: 'Ollama läuft, aber es ist noch kein Modell installiert.';
		} catch {
			modelle = [];
			modell = SELF_SERVICE;
			modellStatus = nutzeBruecke
				? 'Die lokale Facta-Brücke ist nicht erreichbar.'
				: 'Ollama ist in diesem Browser nicht erreichbar. Prüfe, ob der lokale Dienst läuft und Facta als Ursprung erlaubt ist.';
		}
	}

	function schliesseDialog() {
		if (arbeite || speichere) return;
		onschliessen();
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
		if (!modell || istSelfService || !kommentar.trim() || arbeite) return;
		arbeite = true;
		fehler = '';
		try {
			localStorage.setItem(MODELL_SCHLUESSEL, modell);
			const auftrag = {
				model: modell,
				stream: false,
				format: SCHEMA,
				options: { temperature: 0, num_predict: 900 },
				messages: [
					{
						role: 'system',
						content: SYSTEMPROMPT
					},
					{
						role: 'user',
						content: nutzerInhalt()
					}
				]
			};
			let daten: { message?: { content?: string } };
			if (nutzeBruecke) {
				daten = (await brueckenAnfrage('chat', auftrag)) as { message?: { content?: string } };
			} else {
				const res = await fetch(`${OLLAMA}/api/chat`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(auftrag)
				});
				if (!res.ok) {
					const antwort = await res.text();
					throw new Error(antwort || `Ollama antwortet mit ${res.status}`);
				}
				daten = await res.json();
			}
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
					mode: 'open',
					quelleId,
					quelleBaumId: quelleBaumId ?? null
				})
			});
			const antwort = await res.json().catch(() => null);
			if (!res.ok) throw new Error(antwort?.message ?? 'Speichern fehlgeschlagen.');
			const titel = erzeugt.title.trim();
			ongespeichert?.(titel);
			onschliessen();
		} catch (err) {
			fehler = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
		} finally {
			speichere = false;
		}
	}
</script>


<svelte:window onkeydown={(event) => event.key === 'Escape' && schliesseDialog()} />

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

			{#if markierung}<div class="abschnitt">
				<span class="feld-label">Markierte Passage</span>
				<blockquote>{markierung}</blockquote>
			</div>{/if}

			<div class="abschnitt">
				<label for="kernwissen-kommentar">Was willst du als Kernwissen festhalten?</label>
				<textarea
					id="kernwissen-kommentar"
					bind:value={kommentar}
					rows="4"
					placeholder="Sprich oder tippe den entscheidenden Gedanken ein …"
					bind:this={kommentarFeld}
				></textarea>
			</div>

			<div class="modell-zeile">
				<div>
					<label for="kernwissen-modell">Erstellung</label>
					<span>
						{istSelfService
							? 'Prompt kopieren, in einem beliebigen KI-Dienst ausführen und dessen JSON-Antwort wieder einfügen.'
							: modellStatus}
					</span>
				</div>
				<div class="modell-auswahl">
					<select id="kernwissen-modell" value={modell} onchange={wechsleModell}>
						{#if modelle.length > 0}
							<optgroup label="Lokal mit Ollama">
								{#each modelle as name (name)}<option value={name}>{name}</option>{/each}
							</optgroup>
						{/if}
						<option value={SELF_SERVICE}>Self-Service · eigene KI</option>
					</select>
					{#if modelle.length === 0 && !nutzeBruecke}
						<button class="modell-neu" type="button" onclick={ladeModelle}>Ollama erneut prüfen</button>
					{/if}
				</div>
			</div>

			{#if !erzeugt}
				{#if istSelfService}
					{#if !selfServiceOffen}
						<div class="aktionen rechts">
							<button class="primaer" type="button" onclick={oeffneSelfService} disabled={!kommentar.trim()}>
								Prompt-Paket erstellen
							</button>
						</div>
					{:else}
						<div class="self-service">
							<div class="self-kopf">
								<div>
									<span class="ueberzeile">1 · An KI-Dienst übergeben</span>
									<p>Das Paket als eine Nachricht in ChatGPT oder einen anderen KI-Dienst einfügen.</p>
								</div>
								<button class="sekundaer kopieren" type="button" onclick={kopierePrompt}>
									{promptKopiert ? '✓ Kopiert' : 'Prompt kopieren'}
								</button>
							</div>
							<textarea class="prompt-paket" readonly value={promptPaket} rows="7" aria-label="Prompt-Paket"></textarea>

							<label for="kernwissen-json">2 · JSON-Antwort wieder einfügen</label>
							<textarea
								id="kernwissen-json"
								bind:value={selfServiceAntwort}
								rows="5"
								maxlength="20000"
								placeholder="JSON mit title, front und back einfügen …"
							></textarea>
							<div class="aktionen">
								<button class="sekundaer" type="button" onclick={() => (selfServiceOffen = false)}>Zurück</button>
								<button
									class="primaer"
									type="button"
									onclick={uebernehmeSelfServiceAntwort}
									disabled={!selfServiceAntwort.trim()}
								>
									JSON übernehmen
								</button>
							</div>
						</div>
					{/if}
				{:else}
					<div class="aktionen rechts">
						<button class="primaer" type="button" onclick={verdichten} disabled={!modell || !kommentar.trim() || arbeite}>
							{arbeite ? 'Verdichte …' : 'Karte entwerfen'}
						</button>
					</div>
				{/if}
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

<style>
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
	}
	.modell-zeile > div:first-child {
		flex: 1;
	}
	.modell-zeile span {
		display: block;
		margin-top: 0.28rem;
		color: var(--text-fluester);
		font-size: 0.74rem;
		line-height: 1.35;
	}
	.modell-auswahl {
		width: min(16rem, 48%);
		flex: 0 1 16rem;
	}
	.modell-auswahl select {
		width: 100%;
		margin: 0;
	}
	.modell-neu {
		display: block;
		margin: 0.35rem 0 0 auto;
		border: none;
		background: none;
		padding: 0;
		color: var(--text-fluester);
		font: inherit;
		font-size: 0.68rem;
		cursor: pointer;
	}
	.modell-neu:hover {
		color: var(--text-leise);
	}
	.self-service {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
		border-top: 1px solid var(--linie);
		padding-top: 1rem;
	}
	.self-kopf {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.self-kopf p {
		margin: 0.28rem 0 0;
		color: var(--text-fluester);
		font-size: 0.76rem;
		line-height: 1.4;
	}
	.prompt-paket {
		margin-top: 0;
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--text-leise);
	}
	.kopieren {
		flex: 0 0 auto;
		padding: 0.48rem 0.75rem;
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
		.modell-auswahl {
			width: 100%;
			flex-basis: auto;
		}
		.self-kopf {
			align-items: stretch;
			flex-direction: column;
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
