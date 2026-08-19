<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	let { data } = $props();
	let status = $state('');
	let name = $state('Gastzugang');
	let password = $state('');
	let rootId = $state('');
	let expiresAt = $state('');
	let gastLink = $state('');
	onMount(() => {
		if (data.portal) gastLink = `${window.location.origin}/gast/${data.portal.slug}`;
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
		status = result.nodes ? `${result.nodes} Karten im Baum freigegeben.` : 'Gespeichert.';
		password = '';
		await invalidateAll();
		return true;
	}
	async function copyLink() {
		await navigator.clipboard.writeText(gastLink);
		status = 'Gastlink kopiert.';
	}
	const shared = $derived(new Set(data.shares.map((s: { root_id: string }) => s.root_id)));
	const verfuegbareRoots = $derived(data.roots.filter((r: { id: string }) => !shared.has(r.id)));
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
			<h2>Freigegebene Bäume <span>{data.shares.length}</span></h2>
			<div class="row">
				<select bind:value={rootId}
					><option value="">Baum auswählen …</option>{#each verfuegbareRoots as root}<option
							value={root.id}>{root.title} · {root.area ?? 'ohne Gebiet'}</option
						>{/each}</select
				><button onclick={() => rootId && action('share', { rootId })} disabled={!rootId}
					>Gesamten Baum freigeben</button
				>
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
	input,
	select {
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
		.item {
			align-items: stretch;
			flex-direction: column;
		}
		.actions {
			flex-wrap: wrap;
		}
	}
</style>
