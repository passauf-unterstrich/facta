<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { klartext } from '$lib/markdown';
	import { baueId } from '$lib/id';
	import type { KartenVorschau, KartenTyp } from '$lib/types';

	let { data } = $props();

	// --- Neue Karte ---
	let neuTyp = $state<KartenTyp>('fall');
	let neuArea = $state('zivilrecht');
	let neuTitel = $state('');

	async function erstelle() {
		if (!neuTitel.trim()) return;
		const id = baueId(neuTyp, neuTitel, (kandidat) => data.nodes.some((k) => k.id === kandidat));
		const res = await fetch('/api/nodes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id,
				type: neuTyp,
				area: neuArea,
				title: neuTitel.trim(),
				front: '',
				back: '',
				mode: neuTyp === 'schema' || neuTyp === 'fall' ? 'struktur' : 'open'
			})
		});
		if (res.ok) {
			goto(`/karte/${id}?modus=bauen`);
		} else {
			const antwort = await res.json().catch(() => null);
			alert('Erstellen fehlgeschlagen: ' + (antwort?.message ?? res.status));
		}
	}

	// --- Import ---
	let importStatus = $state('');
	async function importiere(event: Event) {
		const input = event.target as HTMLInputElement;
		const datei = input.files?.[0];
		if (!datei) return;
		importStatus = 'Importiere …';
		try {
			const daten = JSON.parse(await datei.text());
			const res = await fetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(daten)
			});
			const antwort = await res.json();
			if (!res.ok) throw new Error(antwort.message ?? 'Import fehlgeschlagen');
			importStatus = `${antwort.nodes} Karten, ${antwort.edges} Verknüpfungen importiert${antwort.uebersprungen ? ` (${antwort.uebersprungen} kaputte Kanten übersprungen)` : ''}.`;
			if (antwort.kollisionen?.length) {
				importStatus += ` ⚠ Überschrieben, bitte prüfen: ${antwort.kollisionen.join(', ')}`;
			}
			await invalidateAll();
		} catch (fehler) {
			importStatus = 'Fehler: ' + (fehler as Error).message;
		} finally {
			input.value = '';
		}
	}

	// --- KI-Prompt (Safari: kein await zwischen Klick und writeText) ---
	let promptStatus = $state('');
	let promptText = $state('');
	$effect(() => {
		fetch('/api/prompt')
			.then((r) => r.text())
			.then((t) => (promptText = t));
	});
	async function kopierePrompt() {
		try {
			await navigator.clipboard.writeText(promptText);
			promptStatus =
				'Prompt in der Zwischenablage — mit PDF ins Chatfenster, JSON zurück, hier importieren.';
		} catch {
			promptStatus = 'Kopieren blockiert — Prompt öffnet sich als Seite: /api/prompt';
		}
		setTimeout(() => (promptStatus = ''), 6000);
	}

	// --- Löschen ---
	async function loesche(id: string, front: string) {
		if (!confirm(`„${front}" wirklich löschen? Alle Verknüpfungen werden mit entfernt.`)) return;
		await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}

	async function loescheBaum(id: string, titel: string, anzahl: number) {
		if (
			!confirm(
				`Den gesamten Baum „${titel}“ mit ${anzahl} Karten wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
			)
		)
			return;
		const res = await fetch(`/api/admin/tree/${id}`, { method: 'DELETE' });
		const antwort = await res.json();
		if (!res.ok) {
			alert(antwort.message ?? 'Baum konnte nicht gelöscht werden.');
			return;
		}
		alert(`${antwort.nodes} Karten wurden als zusammenhängender Baum gelöscht.`);
		await invalidateAll();
	}

	const kernwissenAnzahl = $derived(
		data.nodes.filter((node: KartenVorschau) => node.area === 'kernwissen_klausur').length
	);
	let kernwissenStatus = $state('');
	async function loescheKernwissen() {
		if (kernwissenAnzahl === 0) return;
		if (
			!confirm(
				`Alle ${kernwissenAnzahl} Karten aus „Kernwissen Klausur“ wirklich löschen? Andere Karten und Gebiete bleiben unverändert.`
			)
		)
			return;
		const bestaetigung = prompt('Zur Sicherheitsprüfung bitte KERNWISSEN LÖSCHEN eingeben.');
		if (bestaetigung !== 'KERNWISSEN LÖSCHEN') {
			kernwissenStatus = 'Löschen abgebrochen.';
			return;
		}

		kernwissenStatus = 'Lösche Klausur-Kernwissen …';
		const res = await fetch('/api/admin/kernwissen', { method: 'DELETE' });
		const antwort = await res.json().catch(() => null);
		if (!res.ok) {
			kernwissenStatus = antwort?.message ?? 'Kernwissen konnte nicht gelöscht werden.';
			return;
		}
		kernwissenStatus = `${antwort.nodes} Kernwissen-Karten wurden gelöscht.`;
		await invalidateAll();
	}

	// --- Fall-Gruppierung ---
	// Von jeder fall-Karte aus per Kanten alle erreichbaren Karten
	// sammeln. Rest = "Freistehende Karten", nach area gruppiert.
	type BaumAst = { karte: KartenVorschau; kinder: BaumAst[] };
	type BaumEintrag = {
		karte: KartenVorschau;
		pfad: Array<'weiter' | 'leer' | 'zweig' | 'ende'>;
	};
	type Gruppe = { fall: KartenVorschau; karten: KartenVorschau[]; baum: BaumEintrag[] };
	const gruppen = $derived.by(() => {
		const nodesById = new Map(data.nodes.map((n) => [n.id, n]));
		const kanten = new Map<string, string[]>();
		for (const e of [...data.edges].sort((a, b) => a.id - b.id)) {
			if (!kanten.has(e.from_id)) kanten.set(e.from_id, []);
			kanten.get(e.from_id)!.push(e.to_id);
		}
		const faelle = data.nodes.filter((n) => n.type === 'fall');
		const gs: Gruppe[] = [];
		const zugeordnet = new Set<string>();
		for (const fall of faelle) {
			const besucht = new Set<string>([fall.id]);

			// Aus dem bestehenden Graphen einen eindeutigen Darstellungsbaum bauen.
			// Querverweise bleiben in der Datenbank erhalten, erscheinen hier aber
			// nur an der ersten strukturellen Stelle. Das verhindert Dopplungen und Zyklen.
			function baueAeste(elternId: string): BaumAst[] {
				const aeste: BaumAst[] = [];
				for (const kindId of kanten.get(elternId) ?? []) {
					if (besucht.has(kindId)) continue;
					const karte = nodesById.get(kindId);
					if (!karte) continue;
					besucht.add(kindId);
					const ast: BaumAst = { karte, kinder: [] };
					aeste.push(ast);
					ast.kinder = baueAeste(kindId);
				}
				return aeste;
			}

			const aeste = baueAeste(fall.id);
			const baum: BaumEintrag[] = [];
			function verflache(auswahl: BaumAst[], ahnenlinien: boolean[] = []) {
				for (const [index, ast] of auswahl.entries()) {
					const istLetzter = index === auswahl.length - 1;
					baum.push({
						karte: ast.karte,
						pfad: [
							...ahnenlinien.map((weiter) => (weiter ? ('weiter' as const) : ('leer' as const))),
							istLetzter ? 'ende' : 'zweig'
						]
					});
					verflache(ast.kinder, [...ahnenlinien, !istLetzter]);
				}
			}
			verflache(aeste);

			const karten = baum.map((eintrag) => eintrag.karte);
			gs.push({ fall, karten, baum });
			besucht.forEach((id) => zugeordnet.add(id));
		}
		return { gs, frei: data.nodes.filter((n) => !zugeordnet.has(n.id)) };
	});

	const freiNachArea = $derived.by(() => {
		const m = new Map<string, KartenVorschau[]>();
		for (const n of gruppen.frei) {
			const a = n.area ?? '_';
			if (!m.has(a)) m.set(a, []);
			m.get(a)!.push(n);
		}
		return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	const GEBIET_NAMEN: Record<string, string> = {
		zivilrecht: 'Zivilrecht',
		strafrecht: 'Strafrecht',
		oeffentliches_recht: 'Öffentliches Recht',
		kapitalgesellschaftsrecht: 'KapGesR',
		wissen_zivilrecht: 'Wissen ZR',
		wissen_kapitalgesellschaftsrecht: 'Wissen KapGesR',
		kernwissen_klausur: 'Kernwissen Klausur',
		_: 'Ohne Gebiet'
	};

	let offen = $state<Record<string, boolean>>({});
</script>

<div class="seite">
	<nav class="leiste">
		<a class="zurueck" href="/">‹ Bibliothek</a>
	</nav>

	<h1>Verwalten</h1>

	<section class="block">
		<h2>Neue Karte</h2>
		<div class="neu-zeile">
			<select class="feld feld-schmal" bind:value={neuTyp}>
				<option value="fall">Fall</option>
				<option value="schema">Schema</option>
				<option value="definition">Definition</option>
				<option value="subsumtion">Subsumtion</option>
				<option value="simpel">Simple Karte</option>
				<option value="thema">Thema (Signal)</option>
			</select>
			<select class="feld feld-schmal" bind:value={neuArea}>
				<option value="zivilrecht">Zivilrecht</option>
				<option value="strafrecht">Strafrecht</option>
				<option value="oeffentliches_recht">Öffentliches Recht</option>
				<option value="kapitalgesellschaftsrecht">KapGesR</option>
				<option value="wissen_zivilrecht">Wissen ZR</option>
				<option value="wissen_kapitalgesellschaftsrecht">Wissen KapGesR</option>
				<option value="kernwissen_klausur">Kernwissen Klausur</option>
			</select>
			<input
				class="feld feld-breit"
				bind:value={neuTitel}
				placeholder="Titel, z.B. SE wegen KV über Wochenendhaus"
				onkeydown={(e) => e.key === 'Enter' && erstelle()}
			/>
			<button class="knopf-blau" onclick={erstelle} disabled={!neuTitel.trim()}>
				Erstellen & bauen
			</button>
		</div>
	</section>

	<section class="block">
		<h2>Daten</h2>
		<div class="daten-zeile">
			<label class="knopf-grau">
				<input type="file" accept=".json,application/json" onchange={importiere} hidden />
				<span class="aktion-titel">JSON importieren</span>
				<span class="aktion-hinweis">Neue Kartensätze einlesen</span>
			</label>
			<a class="knopf-grau" href="/api/export" download>
				<span class="aktion-titel">Backup exportieren</span>
				<span class="aktion-hinweis">Alle Karten als JSON sichern</span>
			</a>
			<button class="knopf-grau" onclick={kopierePrompt}>
				<span class="aktion-titel">KI-Prompt kopieren</span>
				<span class="aktion-hinweis">Vorlage für neue Kartensätze</span>
			</button>
		</div>
		{#if importStatus}<p class="status">{importStatus}</p>{/if}
		{#if promptStatus}<p class="status">{promptStatus}</p>{/if}
	</section>

	<section class="block">
		<h2>Zugriff</h2>
		<a class="portal-karte" href="/verwalten/gast">
			<span class="portal-monogramm" aria-hidden="true">G</span>
			<span class="portal-text">
				<strong>Gastportal</strong>
				<span>Freigaben, Passwort und Zugriffe verwalten</span>
			</span>
			<span class="portal-pfeil" aria-hidden="true">›</span>
		</a>
	</section>

	<section class="block">
		<h2>Klausur-Kernwissen <span class="zahl">{kernwissenAnzahl}</span></h2>
		<div class="kernwissen-verwaltung">
			<div>
				<strong>Temporäre Merkkarten</strong>
				<span>Nur dieses Gebiet nach der Klausur gesammelt leeren.</span>
			</div>
			<button class="kernwissen-loeschen" onclick={loescheKernwissen} disabled={kernwissenAnzahl === 0}>
				Alle löschen
			</button>
		</div>
		{#if kernwissenStatus}<p class="status">{kernwissenStatus}</p>{/if}
	</section>

	<section class="block">
		<h2>Fälle <span class="zahl">{gruppen.gs.length}</span></h2>
		{#each gruppen.gs as g (g.fall.id)}
			<div class="fall-block">
				<div
					class="fall-kopf"
					role="button"
					tabindex="0"
					onclick={() => (offen[g.fall.id] = !offen[g.fall.id])}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							offen[g.fall.id] = !offen[g.fall.id];
						}
					}}
				>
					<span class="pfeil" class:auf={offen[g.fall.id]}>›</span>
					<span class="typ-punkt" style:--punkt="var(--typ-fall)"></span>
					<a class="fall-titel" href={`/karte/${g.fall.id}`} onclick={(e) => e.stopPropagation()}>
						{klartext(g.fall.title ?? g.fall.front)}
					</a>
					<span class="fall-zahl">{g.karten.length} Karten</span>
					<button
						class="baum-loeschen"
						onclick={(e) => {
							e.stopPropagation();
							loescheBaum(g.fall.id, klartext(g.fall.title ?? g.fall.front), g.karten.length + 1);
						}}>Baum löschen</button
					>
					<button
						class="loeschen"
						onclick={(e) => {
							e.stopPropagation();
							loesche(g.fall.id, klartext(g.fall.title ?? g.fall.front));
						}}
						aria-label="Löschen">×</button
					>
				</div>
				{#if offen[g.fall.id]}
					<div class="fall-liste baum-liste">
						{#each g.baum as eintrag (eintrag.karte.id)}
							<div class="zeile baum-zeile">
								<span class="baum-spur" aria-hidden="true">
									{#each eintrag.pfad as segment}
										<span class="baum-linie {segment}"></span>
									{/each}
								</span>
								<span
									class="typ-punkt"
									style:--punkt="var(--typ-{eintrag.karte.type})"
								></span>
								<a class="zeile-front" href={`/karte/${eintrag.karte.id}`}>
									{klartext(eintrag.karte.title ?? eintrag.karte.front)}
								</a>
								<span class="zeile-id">{eintrag.karte.id}</span>
								<button
									class="loeschen"
									onclick={() =>
										loesche(
											eintrag.karte.id,
											klartext(eintrag.karte.title ?? eintrag.karte.front)
										)}
									aria-label="Löschen">×</button
								>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
		{#if gruppen.gs.length === 0}
			<p class="status">Noch keine Fälle. Nach dem Import erscheinen sie hier.</p>
		{/if}
	</section>

	{#if gruppen.frei.length > 0}
		<section class="block">
			<h2>Freistehende Karten <span class="zahl">{gruppen.frei.length}</span></h2>
			{#each freiNachArea as [area, karten] (area)}
				<div class="area-block">
					<div class="area-kopf">
						{GEBIET_NAMEN[area] ?? area}
						<span class="fall-zahl">{karten.length}</span>
					</div>
					<div class="fall-liste">
						{#each karten as node (node.id)}
							<div class="zeile zeile-eingerueckt">
								<span class="typ-punkt" style:--punkt="var(--typ-{node.type})"></span>
								<a class="zeile-front" href={`/karte/${node.id}`}>
									{klartext(node.title ?? node.front)}
								</a>
								<span class="zeile-id">{node.id}</span>
								<button
									class="loeschen"
									onclick={() => loesche(node.id, klartext(node.title ?? node.front))}
									aria-label="Löschen">×</button
								>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.seite {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	.leiste {
		display: flex;
	}
	.zurueck {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.85rem;
		transition: color 0.15s ease;
	}
	.zurueck:hover {
		color: var(--text);
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
	}
	h2 {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-fluester);
		margin: 0 0 0.9rem;
	}
	.zahl {
		font-weight: 400;
		margin-left: 0.3rem;
	}
	.block {
		display: flex;
		flex-direction: column;
	}

	.neu-zeile {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.feld {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.55rem 0.75rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.88rem;
	}
	.feld:focus {
		outline: none;
		border-color: var(--akzent);
	}
	.feld-schmal {
		flex: 0 0 auto;
	}
	.feld-breit {
		flex: 1;
		min-width: 12rem;
	}

	.knopf-blau {
		background: var(--akzent);
		color: white;
		border: none;
		border-radius: var(--radius-m);
		padding: 0.55rem 1.1rem;
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.15s ease,
			transform 0.1s ease,
			opacity 0.15s ease;
	}
	.knopf-blau:hover {
		background: var(--akzent-hover);
	}
	.knopf-blau:active {
		transform: scale(0.97);
	}
	.knopf-blau:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.daten-zeile {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.knopf-grau {
		display: flex;
		min-width: 0;
		min-height: 4.25rem;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		background: var(--flaeche-hoch);
		color: var(--text);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.75rem 0.9rem;
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 500;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.1s ease;
	}
	.knopf-grau:hover {
		background: var(--linie-stark);
		border-color: color-mix(in srgb, var(--text-fluester) 55%, var(--linie));
	}
	.knopf-grau:active {
		transform: scale(0.985);
	}
	.aktion-titel {
		line-height: 1.25;
	}
	.aktion-hinweis {
		margin-top: 0.25rem;
		color: var(--text-fluester);
		font-size: 0.72rem;
		font-weight: 400;
		line-height: 1.3;
	}

	.portal-karte {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		border: 1px solid color-mix(in srgb, var(--akzent) 38%, var(--linie));
		border-radius: var(--radius-m);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
		color: var(--text);
		text-decoration: none;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.1s ease;
	}
	.portal-karte:hover {
		background: color-mix(in srgb, var(--akzent) 13%, var(--flaeche));
		border-color: color-mix(in srgb, var(--akzent) 62%, var(--linie));
	}
	.portal-karte:active {
		transform: scale(0.99);
	}
	.portal-monogramm {
		display: grid;
		width: 2.15rem;
		height: 2.15rem;
		flex: 0 0 2.15rem;
		place-items: center;
		border-radius: 50%;
		background: var(--akzent);
		color: white;
		font-size: 0.78rem;
		font-weight: 700;
	}
	.portal-text {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.15rem;
	}
	.portal-text strong {
		font-size: 0.9rem;
		font-weight: 600;
	}
	.portal-text span {
		color: var(--text-leise);
		font-size: 0.76rem;
		line-height: 1.35;
	}
	.portal-pfeil {
		color: var(--text-fluester);
		font-size: 1.35rem;
	}
	.kernwissen-verwaltung {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		background: var(--flaeche);
		padding: 0.85rem 1rem;
	}
	.kernwissen-verwaltung > div {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.18rem;
	}
	.kernwissen-verwaltung strong {
		font-size: 0.88rem;
		font-weight: 600;
	}
	.kernwissen-verwaltung span {
		color: var(--text-leise);
		font-size: 0.74rem;
		line-height: 1.35;
	}
	.kernwissen-loeschen {
		flex: 0 0 auto;
		border: 1px solid color-mix(in srgb, #ff453a 42%, var(--linie));
		border-radius: 999px;
		background: none;
		color: #ff6961;
		padding: 0.42rem 0.75rem;
		font: inherit;
		font-size: 0.76rem;
		cursor: pointer;
	}
	.kernwissen-loeschen:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.status {
		font-size: 0.85rem;
		color: var(--text-leise);
		margin: 0.75rem 0 0;
	}

	/* Fall-Block: klappbarer Container mit Baum drunter */
	.fall-block {
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		margin-bottom: 0.5rem;
		overflow: hidden;
	}
	.fall-kopf {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		color: var(--text);
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.1s ease;
	}
	.fall-kopf:hover {
		background: var(--flaeche);
	}
	.pfeil {
		color: var(--text-fluester);
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}
	.pfeil.auf {
		transform: rotate(90deg);
	}
	.fall-titel {
		flex: 1;
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fall-titel:hover {
		color: var(--akzent);
	}
	.fall-zahl {
		font-size: 0.75rem;
		color: var(--text-fluester);
		flex-shrink: 0;
	}
	.fall-liste {
		border-top: 1px solid var(--linie);
		background: color-mix(in srgb, var(--flaeche) 40%, transparent);
	}
	.baum-liste {
		--ast-breite: 1.05rem;
	}

	.zeile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--linie);
		font-size: 0.9rem;
	}
	.zeile:last-child {
		border-bottom: none;
	}
	.zeile-eingerueckt {
		padding-left: 2.5rem;
	}
	.baum-zeile {
		gap: 0.55rem;
		padding-left: 1rem;
	}
	.baum-spur {
		display: flex;
		align-self: stretch;
		flex: 0 0 auto;
		margin-block: -0.6rem;
	}
	.baum-linie {
		position: relative;
		width: var(--ast-breite);
		min-width: var(--ast-breite);
	}
	.baum-linie.weiter::before,
	.baum-linie.zweig::before,
	.baum-linie.ende::before,
	.baum-linie.zweig::after,
	.baum-linie.ende::after {
		position: absolute;
		content: '';
		background: var(--linie-stark);
	}
	.baum-linie.weiter::before,
	.baum-linie.zweig::before {
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
	}
	.baum-linie.ende::before {
		top: 0;
		bottom: 50%;
		left: 50%;
		width: 1px;
	}
	.baum-linie.zweig::after,
	.baum-linie.ende::after {
		top: 50%;
		left: 50%;
		right: 0;
		height: 1px;
	}
	.typ-punkt {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
		flex-shrink: 0;
	}
	.zeile-front {
		flex: 1;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.zeile-front:hover {
		color: var(--akzent);
	}
	.zeile-id {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--text-fluester);
		flex-shrink: 0;
	}
	.loeschen {
		background: none;
		border: none;
		color: var(--text-fluester);
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.2rem;
		transition: color 0.15s ease;
	}
	.loeschen:hover {
		color: #ff453a;
	}
	.baum-loeschen {
		background: none;
		border: 1px solid var(--linie);
		border-radius: 999px;
		color: var(--text-fluester);
		padding: 0.25rem 0.55rem;
		font: inherit;
		font-size: 0.72rem;
		cursor: pointer;
	}
	.baum-loeschen:hover {
		color: #ff6961;
		border-color: #7f1d1d;
	}

	/* Freistehende: nach area gruppiert */
	.area-block {
		margin-bottom: 0.75rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		overflow: hidden;
	}
	.area-kopf {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 1rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-fluester);
		background: color-mix(in srgb, var(--flaeche) 60%, transparent);
	}

	@media (max-width: 640px) {
		.seite {
			padding: 1.25rem 1rem 5rem;
			gap: 1.65rem;
		}
		.neu-zeile {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.feld-schmal {
			width: 100%;
		}
		.feld-breit,
		.knopf-blau {
			grid-column: 1 / -1;
			width: 100%;
		}
		.daten-zeile {
			grid-template-columns: 1fr;
		}
		.knopf-grau {
			min-height: 3.8rem;
		}
		.baum-liste {
			--ast-breite: 0.78rem;
		}
		.baum-zeile {
			padding-left: 0.65rem;
			gap: 0.45rem;
		}
		.portal-karte {
			padding: 0.8rem 0.9rem;
		}
		.zeile-id,
		.fall-zahl {
			display: none;
		}
		.baum-loeschen {
			font-size: 0;
			padding: 0.25rem 0.45rem;
		}
		.baum-loeschen::after {
			content: 'Baum';
			font-size: 0.68rem;
		}
	}
</style>
