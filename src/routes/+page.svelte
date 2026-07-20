<script lang="ts">
	import type { Karte } from '$lib/types';
	import { klartext } from '$lib/markdown';

	let { data } = $props();

	let suche = $state('');
	let gebiet = $state<string | null>(null); // null = Alle

	// Anzeige-Namen für bekannte Rechtsgebiete; unbekannte area-Werte
	// erscheinen roh — nichts aus den Daten geht verloren.
	const GEBIETS_NAMEN: Record<string, string> = {
		zivilrecht: 'Zivilrecht',
		strafrecht: 'Strafrecht',
		oeffentliches_recht: 'Öffentliches Recht',
		kapitalgesellschaftsrecht: 'KapGesR',
		wissen_zivilrecht: 'Wissen ZR',
		wissen_kapitalgesellschaftsrecht: 'Wissen KapGesR'
	};
	function gebietsName(a: string): string {
		return GEBIETS_NAMEN[a] ?? a;
	}

	// Die Pillen entstehen aus den Daten: jede area, die tatsächlich
	// vorkommt, bekommt einen Filter — in stabiler Reihenfolge.
	const gebiete = $derived.by(() => {
		const vorhanden = new Set(
			data.nodes.map((n: Karte) => n.area).filter((a): a is string => !!a)
		);
		const bekannt = Object.keys(GEBIETS_NAMEN).filter((a) => vorhanden.has(a));
		const unbekannt = [...vorhanden].filter((a) => !(a in GEBIETS_NAMEN)).sort();
		return [...bekannt, ...unbekannt];
	});

	const gefiltert = $derived(
		data.nodes.filter((n: Karte) => {
			if (gebiet && n.area !== gebiet) return false;
			const q = suche.toLowerCase();
			return (
				n.front.toLowerCase().includes(q) ||
				(n.title ?? '').toLowerCase().includes(q) ||
				n.id.toLowerCase().includes(q)
			);
		})
	);
	const faelle = $derived(gefiltert.filter((n: Karte) => n.type === 'fall'));
</script>

<div class="seite">
	<header class="kopf">
		<h1>Facta</h1>
		<p class="untertitel">Dein vernetztes Wissen für die Fallbearbeitung.</p>
	</header>

	<input class="suche" type="search" placeholder="Karten durchsuchen …" bind:value={suche} />

	{#if gebiete.length > 0}
		<div class="gebiete">
			<button class="pille" class:aktiv={gebiet === null} onclick={() => (gebiet = null)}>
				Alle
			</button>
			{#each gebiete as g (g)}
				<button
					class="pille"
					class:aktiv={gebiet === g}
					onclick={() => (gebiet = gebiet === g ? null : g)}
				>
					{gebietsName(g)}
				</button>
			{/each}
		</div>
	{/if}

	{#if data.nodes.length === 0}
		<div class="leer">
			<p>Noch keine Karten.</p>
			<p class="leer-hinweis">Importiere einen Fall oder lege los.</p>
		</div>
	{:else}
		{#if faelle.length > 0}
			<section>
				<h2>Fälle</h2>
				<div class="fall-grid">
					{#each faelle as fall (fall.id)}
						<a class="fall-karte" href={`/karte/${fall.id}`}>
							<span class="typ-punkt" style:--punkt="var(--typ-fall)"></span>
							<span class="fall-front">{klartext(fall.title ?? fall.front)}</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h2>Alle Karten <span class="zahl">{gefiltert.length}</span></h2>
			<div class="karten-liste">
				{#each gefiltert as node (node.id)}
					<a class="zeile" href={`/karte/${node.id}`}>
						<span class="typ-punkt" style:--punkt="var(--typ-{node.type})"></span>
						<span class="zeile-front">{klartext(node.title ?? node.front)}</span>
					</a>
				{/each}
				{#if gefiltert.length === 0}
					<p class="keine-treffer">Keine Karten in dieser Auswahl.</p>
				{/if}
			</div>
		</section>
	{/if}

	<footer class="fuss">
		<a href="/verwalten">Verwalten</a>
	</footer>
</div>

<style>
	.seite {
		max-width: 44rem;
		margin: 0 auto;
		padding: 4rem 1.5rem 6rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.kopf {
		text-align: center;
	}
	h1 {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		margin: 0;
	}
	.untertitel {
		color: var(--text-fluester);
		margin: 0.5rem 0 0;
		font-size: 0.95rem;
	}

	.suche {
		width: 100%;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		padding: 0.7rem 1rem;
		color: var(--text);
		font-family: inherit;
		font-size: 0.95rem;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.suche::placeholder {
		color: var(--text-fluester);
	}
	.suche:focus {
		outline: none;
		border-color: var(--akzent);
		background: var(--flaeche-hoch);
	}

	/* Rechtsgebiete: Filter-Pillen wie in Apple Music — die aktive
	   ist gefüllt, ein zweiter Tap hebt den Filter wieder auf */
	.gebiete {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		justify-content: center;
		margin-top: -0.75rem;
	}
	.pille {
		background: none;
		border: 1px solid var(--linie);
		border-radius: 999px;
		padding: 0.35rem 0.95rem;
		color: var(--text-leise);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease,
			transform 0.1s ease;
	}
	.pille:hover {
		border-color: var(--linie-stark);
		color: var(--text);
	}
	.pille:active {
		transform: scale(0.96);
	}
	.pille.aktiv {
		background: var(--text);
		border-color: var(--text);
		color: var(--bg);
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

	.fall-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.9rem;
	}
	.fall-karte {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 1.1rem 1.2rem;
		text-decoration: none;
		color: var(--text);
		transition:
			border-color 0.15s ease,
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}
	.fall-karte:hover {
		border-color: var(--linie-stark);
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}
	.fall-karte:active {
		transform: translateY(0) scale(0.985);
		box-shadow: none;
	}
	.fall-front {
		font-size: 0.95rem;
		line-height: 1.45;
		font-weight: 500;
	}

	.typ-punkt {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--punkt, var(--typ-simpel));
		flex-shrink: 0;
	}

	.karten-liste {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		overflow: hidden;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 1rem;
		text-decoration: none;
		color: var(--text);
		font-size: 0.9rem;
		border-bottom: 1px solid var(--linie);
		transition: background 0.1s ease;
	}
	.zeile:last-child {
		border-bottom: none;
	}
	.zeile:hover {
		background: var(--flaeche);
	}
	.zeile:active {
		background: var(--flaeche-hoch);
	}
	.zeile-front {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.keine-treffer {
		padding: 1rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-fluester);
		text-align: center;
	}

	.leer {
		text-align: center;
		padding: 4rem 0;
		color: var(--text-leise);
	}
	.leer-hinweis {
		color: var(--text-fluester);
		font-size: 0.85rem;
	}

	.fuss {
		text-align: center;
	}
	.fuss a {
		color: var(--text-fluester);
		font-size: 0.85rem;
		text-decoration: none;
		transition: color 0.15s ease;
	}
	.fuss a:hover {
		color: var(--text-leise);
	}
</style>
