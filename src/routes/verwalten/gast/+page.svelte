<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	let { data } = $props();
	let status = $state('');
	let name = $state('Gastzugang');
	let password = $state('');
	let expiresAt = $state('');
	let gastLink = $state('');
	let suche = $state('');
	let ausgewaehlteRootIds = $state<string[]>([]);
	$effect(() => {
		gastLink = data.portal ? `${window.location.origin}/gast/${data.portal.slug}` : '';
	});

	async function action(action: string, extra: Record<string, unknown> = {}) {
		status = 'Wird gespeichert …';
		const response = await fetch('/api/admin/gast', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, ...extra })
		});
		const result = await response.json();
		if (!response.ok) {
			status = result.message ?? 'Aktion fehlgeschlagen.';
			return false;
		}
		status =
			typeof result.trees === 'number'
				? `${result.trees} Bäume mit insgesamt ${result.nodes} Karten freigegeben.`
				: typeof result.nodes === 'number'
					? `${result.nodes} Karten im Baum freigegeben.`
					: 'Gespeichert.';
		password = '';
		await invalidateAll();
		return true;
	}
	async function copyLink() {
		const aktuellerLink = data.portal
			? `${window.location.origin}/gast/${data.portal.slug}`
			: gastLink;
		await navigator.clipboard.writeText(aktuellerLink);
		status = 'Gastlink kopiert.';
	}
	const shared = $derived(new Set(data.shares.map((s: { root_id: string }) => s.root_id)));
	type Root = { id: string; title: string; area: string | null };
	const verfuegbareRoots = $derived(
		(data.roots as Root[])
			.filter((root) => !shared.has(root.id))
			.sort((a, b) => a.title.localeCompare(b.title, 'de'))
	);
	const gefilterteRoots = $derived.by(() => {
		const begriff = suche.trim().toLocaleLowerCase('de');
		if (!begriff) return verfuegbareRoots;
		return verfuegbareRoots.filter((root) =>
			`${root.title} ${root.area ?? ''}`.toLocaleLowerCase('de').includes(begriff)
		);
	});
	const rootGruppen = $derived.by(() => {
		const gruppen = new Map<string, Root[]>();
		for (const root of gefilterteRoots) {
			const area = root.area ?? '_';
			if (!gruppen.has(area)) gruppen.set(area, []);
			gruppen.get(area)!.push(root);
		}
		return [...gruppen.entries()].sort(([a], [b]) => gebietName(a).localeCompare(gebietName(b), 'de'));
	});
	const ausgewaehlt = $derived(new Set(ausgewaehlteRootIds));

	const GEBIET_NAMEN: Record<string, string> = {
		zivilrecht: 'Zivilrecht',
		strafrecht: 'Strafrecht',
		oeffentliches_recht: 'Öffentliches Recht',
		kapitalgesellschaftsrecht: 'Kapitalgesellschaftsrecht',
		wissen_zivilrecht: 'Wissen Zivilrecht',
		wissen_kapitalgesellschaftsrecht: 'Wissen Kapitalgesellschaftsrecht',
		_: 'Ohne Gebiet'
	};
	function gebietName(area: string) {
		return GEBIET_NAMEN[area] ?? area.replaceAll('_', ' ');
	}
	function setzeAuswahl(ids: string[], aktiv: boolean) {
		const neu = new Set(ausgewaehlteRootIds);
		for (const id of ids) aktiv ? neu.add(id) : neu.delete(id);
		ausgewaehlteRootIds = [...neu];
	}
	function toggleRoot(id: string) {
		setzeAuswahl([id], !ausgewaehlt.has(id));
	}
	function toggleGruppe(roots: Root[]) {
		const alleGewaehlt = roots.every((root) => ausgewaehlt.has(root.id));
		setzeAuswahl(
			roots.map((root) => root.id),
			!alleGewaehlt
		);
	}
	async function teileAuswahl() {
		const rootIds = ausgewaehlteRootIds.filter((id) => !shared.has(id));
		if (
			rootIds.length === 0 ||
			!confirm(
				`${rootIds.length} vollständige Bäume für den Gast freigeben? Bereits bestehende Freigaben und deine Originalkarten bleiben unverändert.`
			)
		)
			return;
		if (await action('share_many', { rootIds })) ausgewaehlteRootIds = [];
	}
	async function aktualisiereAlle() {
		const rootIds = data.shares.map((share: { root_id: string }) => share.root_id);
		if (
			rootIds.length > 0 &&
			confirm(`Die Schnappschüsse aller ${rootIds.length} freigegebenen Bäume aktualisieren?`)
		)
			await action('share_many', { rootIds });
	}
</script>

<div class="seite">
	<nav><a href="/verwalten">‹ Verwalten</a></nav>
	<header>
		<p class="eyebrow">Eigentümerbereich</p>
		<h1>Abgeschotteter Gasttunnel</h1>
		<p>
			Nur ausdrücklich freigegebene Bäume sind sichtbar. Der Gast kann lernen und den Graphen
			öffnen, aber nichts verändern oder exportieren.
		</p>
	</header>
	{#if !data.portal}
		<section>
			<h2>Gastportal anlegen</h2>
			<div class="form">
				<input bind:value={name} placeholder="Name des Zugangs" /><input
					bind:value={password}
					type="password"
					placeholder="Neues Passwort · mindestens 16 Zeichen"
				/><button
					onclick={() => action('create', { name, password })}
					disabled={password.length < 16}>Portal anlegen</button
				>
			</div>
		</section>
	{:else}
		<section>
			<div class="statuszeile">
				<div>
					<h2>Zugang</h2>
					<span class:off={!data.portal.active}
						>{data.portal.active ? 'Geöffnet' : 'Geschlossen'}</span
					>
				</div>
				<button class="danger" onclick={() => action('active', { active: !data.portal.active })}
					>{data.portal.active ? 'Portal sofort schließen' : 'Portal öffnen'}</button
				>
			</div>
			<label for="guest-link">Persönlicher Link</label>
			<div class="row">
				<input id="guest-link" value={gastLink || `/gast/${data.portal.slug}`} readonly /><button
					onclick={copyLink}>Kopieren</button
				><button
					onclick={() =>
						confirm(
							'Der bisherige Link und alle laufenden Gastsitzungen werden sofort ungültig. Fortfahren?'
						) && action('rotate_link')}>Link wechseln</button
				>
			</div>
			<label for="guest-password">Passwort ändern</label>
			<div class="row">
				<input
					id="guest-password"
					bind:value={password}
					type="password"
					placeholder="Mindestens 16 Zeichen"
				/><button onclick={() => action('password', { password })} disabled={password.length < 16}
					>Passwort setzen</button
				>
			</div>
			<label for="guest-expiry">Automatisch schließen</label>
			<div class="row">
				<input id="guest-expiry" bind:value={expiresAt} type="datetime-local" /><button
					onclick={() => action('expiry', { expiresAt })}>Speichern</button
				><button
					onclick={() => {
						expiresAt = '';
						action('expiry', { expiresAt: '' });
					}}>Frist entfernen</button
				>
			</div>
		</section>
		<section>
			<div class="statuszeile">
				<div>
					<h2>Bäume freigeben</h2>
					<p class="muted">Mehrere Bäume markieren und gemeinsam als Schnappschuss freigeben.</p>
				</div>
				<span class="verfuegbar">{verfuegbareRoots.length} verfügbar</span>
			</div>
			<div class="auswahl-werkzeuge">
				<input bind:value={suche} type="search" placeholder="Bäume durchsuchen …" />
				<div class="actions">
					<button
						onclick={() => setzeAuswahl(gefilterteRoots.map((root) => root.id), true)}
						disabled={gefilterteRoots.length === 0}>Alle {gefilterteRoots.length} auswählen</button
					>
					<button onclick={() => (ausgewaehlteRootIds = [])} disabled={ausgewaehlteRootIds.length === 0}
						>Auswahl leeren</button
					>
				</div>
			</div>
			<div class="baum-auswahl">
				{#each rootGruppen as [area, roots] (area)}
					<div class="auswahl-gruppe">
						<div class="gruppen-kopf">
							<strong>{gebietName(area)}</strong>
							<span>{roots.filter((root) => ausgewaehlt.has(root.id)).length}/{roots.length}</span>
							<button onclick={() => toggleGruppe(roots)}>
								{roots.every((root) => ausgewaehlt.has(root.id)) ? 'Entfernen' : 'Alle wählen'}
							</button>
						</div>
						<div class="optionen">
							{#each roots as root (root.id)}
								<label class="baum-option" class:gewaehlt={ausgewaehlt.has(root.id)}>
									<input
										type="checkbox"
										checked={ausgewaehlt.has(root.id)}
										onchange={() => toggleRoot(root.id)}
									/>
									<span>{root.title}</span>
								</label>
							{/each}
						</div>
					</div>
				{/each}
				{#if gefilterteRoots.length === 0}
					<p class="muted leer">Keine passenden, noch nicht freigegebenen Bäume.</p>
				{/if}
			</div>
			<div class="auswahl-fuss">
				<span><strong>{ausgewaehlteRootIds.length}</strong> Bäume ausgewählt</span>
				<button class="primary" onclick={teileAuswahl} disabled={ausgewaehlteRootIds.length === 0}
					>Auswahl freigeben</button
				>
			</div>
		</section>
		<section>
			<div class="statuszeile">
				<h2>Freigegebene Bäume <span>{data.shares.length}</span></h2>
				{#if data.shares.length > 0}
					<button onclick={aktualisiereAlle}>Alle Schnappschüsse aktualisieren</button>
				{/if}
			</div>
			<div class="list">
				{#each data.shares as share}<div class="item">
						<div>
							<strong>{share.title}</strong><small>{share.node_count} Karten · Schnappschuss</small>
						</div>
						<div class="actions">
							<button onclick={() => action('share', { rootId: share.root_id })}
								>Aktualisieren</button
							><button
								class="danger-text"
								onclick={() =>
									confirm(
										'Diesen Baum aus dem Gastportal entfernen? Die Karten selbst bleiben erhalten.'
									) && action('unshare', { rootId: share.root_id })}>Freigabe entfernen</button
							>
						</div>
					</div>{/each}{#if data.shares.length === 0}<p class="muted">
						Noch ist kein Baum freigegeben.
					</p>{/if}
			</div>
		</section>
		<section>
			<div class="statuszeile">
				<div>
					<h2>Anmeldungen <span>{data.events.length}</span></h2>
					<p class="muted">
						Erfasst werden nur erfolgreiche Anmeldungen mit Zeitpunkt und IP-Adresse.
					</p>
				</div>
				{#if data.events.length}<button
						onclick={() => confirm('Anmeldehistorie löschen?') && action('clear_events')}
						>Historie löschen</button
					>{/if}
			</div>
			<div class="list">
				{#each data.events as event}<div class="event">
						<span>{new Date(event.logged_in_at).toLocaleString('de-DE')}</span><code
							>{event.ip}</code
						>
					</div>{/each}{#if data.events.length === 0}<p class="muted">
						Noch keine Gastanmeldung.
					</p>{/if}
			</div>
		</section>
	{/if}
	{#if status}<p class="notice">{status}</p>{/if}
</div>

<style>
	.seite {
		max-width: 52rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		display: grid;
		gap: 1.5rem;
	}
	nav a {
		color: var(--text-fluester);
		text-decoration: none;
		font-size: 0.85rem;
	}
	header {
		padding: 0.5rem 0;
	}
	h1 {
		font-size: 1.7rem;
		margin: 0.2rem 0;
	}
	.eyebrow,
	h2 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-fluester);
		margin: 0;
	}
	header p:not(.eyebrow),
	.muted {
		color: var(--text-leise);
		line-height: 1.5;
		font-size: 0.9rem;
	}
	section {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 1.2rem;
		display: grid;
		gap: 0.8rem;
	}
	.row,
	.form,
	.statuszeile,
	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.form {
		flex-direction: column;
		align-items: stretch;
	}
	.statuszeile {
		justify-content: space-between;
	}
	.statuszeile h2 span,
	h2 span {
		font-weight: 400;
	}
	label,
	small {
		font-size: 0.76rem;
		color: var(--text-fluester);
	}
	input {
		flex: 1;
		min-width: 0;
		background: var(--bg);
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.65rem 0.75rem;
		color: var(--text);
		font: inherit;
	}
	button {
		background: var(--flaeche-hoch);
		color: var(--text);
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.62rem 0.85rem;
		font: inherit;
		font-size: 0.84rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.primary {
		background: var(--akzent);
		border-color: var(--akzent);
		color: white;
		font-weight: 600;
	}
	.primary:hover:not(:disabled) {
		background: var(--akzent-hover);
		border-color: var(--akzent-hover);
	}
	.danger {
		border-color: #7f1d1d;
		color: #ff6961;
	}
	.danger-text {
		color: #ff6961;
	}
	.off {
		color: #ff6961;
	}
	.verfuegbar {
		flex-shrink: 0;
		color: var(--text-fluester);
		font-size: 0.78rem;
	}
	.auswahl-werkzeuge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.auswahl-werkzeuge > input {
		min-width: 13rem;
	}
	.baum-auswahl {
		max-height: 34rem;
		overflow: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius-m);
		background: color-mix(in srgb, var(--bg) 55%, transparent);
	}
	.auswahl-gruppe + .auswahl-gruppe {
		border-top: 1px solid var(--linie);
	}
	.gruppen-kopf {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.7rem;
		background: color-mix(in srgb, var(--flaeche-hoch) 94%, transparent);
		backdrop-filter: blur(8px);
	}
	.gruppen-kopf strong {
		flex: 1;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.gruppen-kopf span {
		color: var(--text-fluester);
		font-size: 0.72rem;
	}
	.gruppen-kopf button {
		padding: 0.3rem 0.55rem;
		font-size: 0.72rem;
	}
	.optionen {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
		padding: 0.55rem;
	}
	.baum-option {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		min-width: 0;
		padding: 0.6rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: calc(var(--radius-m) - 2px);
		background: var(--flaeche);
		color: var(--text-leise);
		font-size: 0.8rem;
		line-height: 1.35;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			color 0.15s ease;
	}
	.baum-option:hover {
		border-color: var(--linie-stark);
		color: var(--text);
	}
	.baum-option.gewaehlt {
		border-color: color-mix(in srgb, var(--akzent) 65%, var(--linie));
		background: color-mix(in srgb, var(--akzent) 11%, var(--flaeche));
		color: var(--text);
	}
	.baum-option input {
		width: 1rem;
		height: 1rem;
		min-width: 1rem;
		flex: 0 0 1rem;
		margin: 0.05rem 0 0;
		padding: 0;
		accent-color: var(--akzent);
	}
	.baum-option span {
		min-width: 0;
	}
	.leer {
		padding: 1rem;
		margin: 0;
	}
	.auswahl-fuss {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.8rem;
		padding-top: 0.1rem;
	}
	.auswahl-fuss span {
		color: var(--text-leise);
		font-size: 0.8rem;
	}
	.list {
		display: grid;
	}
	.item,
	.event {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem 0;
		border-top: 1px solid var(--linie);
	}
	.item div:first-child {
		display: grid;
		gap: 0.2rem;
	}
	.event {
		font-size: 0.84rem;
	}
	.event code {
		color: var(--text-leise);
	}
	.notice {
		position: sticky;
		bottom: 1rem;
		background: var(--flaeche-hoch);
		border: 1px solid var(--linie-stark);
		border-radius: 999px;
		padding: 0.65rem 1rem;
		text-align: center;
		margin: auto;
		font-size: 0.85rem;
	}
	@media (max-width: 650px) {
		.row,
		.statuszeile,
		.item,
		.auswahl-werkzeuge {
			align-items: stretch;
			flex-direction: column;
		}
		.actions {
			flex-wrap: wrap;
		}
		.auswahl-werkzeuge > input {
			min-width: 0;
		}
		.optionen {
			grid-template-columns: 1fr;
		}
		.auswahl-fuss {
			position: sticky;
			bottom: 0.5rem;
			z-index: 2;
			justify-content: space-between;
			padding: 0.6rem;
			border: 1px solid var(--linie-stark);
			border-radius: var(--radius-m);
			background: color-mix(in srgb, var(--flaeche-hoch) 94%, transparent);
			backdrop-filter: blur(8px);
		}
	}
</style>
