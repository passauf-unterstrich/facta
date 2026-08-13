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

	// --- Fall-Gruppierung ---
	// Von jeder fall-Karte aus per Kanten alle erreichbaren Karten
	// sammeln. Rest = "Freistehende Karten", nach area gruppiert.
	type Gruppe = { fall: KartenVorschau; karten: KartenVorschau[] };
	const gruppen = $derived.by(() => {
		const nodesById = new Map(data.nodes.map((n) => [n.id, n]));
		const kanten = new Map<string, string[]>();
		for (const e of data.edges) {
			if (!kanten.has(e.from_id)) kanten.set(e.from_id, []);
			kanten.get(e.from_id)!.push(e.to_id);
		}
		const faelle = data.nodes.filter((n) => n.type === 'fall');
		const gs: Gruppe[] = [];
		const zugeordnet = new Set<string>();
		for (const fall of faelle) {
			const besucht = new Set<string>();
			const stapel = [fall.id];
			while (stapel.length > 0) {
				const id = stapel.pop()!;
				if (besucht.has(id)) continue;
				besucht.add(id);
				for (const kind of kanten.get(id) ?? []) stapel.push(kind);
			}
			const karten = [...besucht]
				.map((id) => nodesById.get(id))
				.filter((n): n is KartenVorschau => !!n && n.id !== fall.id);
			gs.push({ fall, karten });
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
				JSON importieren
			</label>
			<a class="knopf-grau" href="/api/export" download>Backup exportieren</a>
			<button class="knopf-grau" onclick={kopierePrompt}>KI-Prompt kopieren</button>
		</div>
		{#if importStatus}<p class="status">{importStatus}</p>{/if}
		{#if promptStatus}<p class="status">{promptStatus}</p>{/if}
	</section>

	<section class="block">
		<h2>Fälle <span class="zahl">{gruppen.gs.length}</span></h2>
		{#each gruppen.gs as g (g.fall.id)}
			<div class="fall-block">
				<div class="fall-kopf" role="button" tabindex="0"
					onclick={() => (offen[g.fall.id] = !offen[g.fall.id])}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); offen[g.fall.id] = !offen[g.fall.id]; } }}>
					<span class="pfeil" class:auf={offen[g.fall.id]}>›</span>
					<span class="typ-punkt" style:--punkt="var(--typ-fall)"></span>
					<a class="fall-titel" href={`/karte/${g.fall.id}`} onclick={(e) => e.stopPropagation()}>
						{klartext(g.fall.title ?? g.fall.front)}
					</a>
					<span class="fall-zahl">{g.karten.length} Karten</span>
					<button
						class="loeschen"
						onclick={(e) => {
							e.stopPropagation();
							loesche(g.fall.id, klartext(g.fall.title ?? g.fall.front));
						}}
						aria-label="Löschen"
					>×</button>
				</div>
				{#if offen[g.fall.id]}
					<div class="fall-liste">
						{#each g.karten as node (node.id)}
							<div class="zeile zeile-eingerueckt">
								<span class="typ-punkt" style:--punkt="var(--typ-{node.type})"></span>
								<a class="zeile-front" href={`/karte/${node.id}`}>
									{klartext(node.title ?? node.front)}
								</a>
								<span class="zeile-id">{node.id}</span>
								<button
									class="loeschen"
									onclick={() => loesche(node.id, klartext(node.title ?? node.front))}
									aria-label="Löschen"
								>×</button>
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
									aria-label="Löschen"
								>×</button>
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
	.leiste { display: flex; }
	.zurueck {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.85rem;
		transition: color 0.15s ease;
	}
	.zurueck:hover { color: var(--text); }
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
	.zahl { font-weight: 400; margin-left: 0.3rem; }
	.block { display: flex; flex-direction: column; }

	.neu-zeile { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.feld {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.55rem 0.75rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.88rem;
	}
	.feld:focus { outline: none; border-color: var(--akzent); }
	.feld-schmal { flex: 0 0 auto; }
	.feld-breit { flex: 1; min-width: 12rem; }

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
		transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
	}
	.knopf-blau:hover { background: var(--akzent-hover); }
	.knopf-blau:active { transform: scale(0.97); }
	.knopf-blau:disabled { opacity: 0.4; cursor: default; }

	.daten-zeile { display: flex; gap: 0.5rem; }
	.knopf-grau {
		display: inline-block;
		background: var(--flaeche-hoch);
		color: var(--text);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.55rem 1.1rem;
		font-size: 0.88rem;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.knopf-grau:hover { background: var(--linie-stark); }
	.status { font-size: 0.85rem; color: var(--text-leise); margin: 0.75rem 0 0; }

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
	.fall-kopf:hover { background: var(--flaeche); }
	.pfeil {
		color: var(--text-fluester);
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}
	.pfeil.auf { transform: rotate(90deg); }
	.fall-titel {
		flex: 1;
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fall-titel:hover { color: var(--akzent); }
	.fall-zahl {
		font-size: 0.75rem;
		color: var(--text-fluester);
		flex-shrink: 0;
	}
	.fall-liste {
		border-top: 1px solid var(--linie);
		background: color-mix(in srgb, var(--flaeche) 40%, transparent);
	}

	.zeile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--linie);
		font-size: 0.9rem;
	}
	.zeile:last-child { border-bottom: none; }
	.zeile-eingerueckt { padding-left: 2.5rem; }
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
	.zeile-front:hover { color: var(--akzent); }
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
	.loeschen:hover { color: #ff453a; }

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
</style>
