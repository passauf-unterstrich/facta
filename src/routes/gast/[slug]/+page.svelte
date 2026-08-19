<script lang="ts">
	let { data } = $props();
	let fehlermeldung = $state('');
	let laedt = $state(false);

	async function anmelden(event: SubmitEvent) {
		event.preventDefault();
		fehlermeldung = '';
		laedt = true;
		const formular = event.currentTarget as HTMLFormElement;
		const passwort = String(new FormData(formular).get('password') ?? '');
		try {
			const response = await fetch('/api/gast/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: data.slug, passwort })
			});
			const ergebnis = (await response.json()) as { message?: string };
			if (!response.ok) {
				fehlermeldung = ergebnis.message ?? 'Die Anmeldung ist fehlgeschlagen.';
				return;
			}
			window.location.assign('/');
		} catch {
			fehlermeldung = 'Die Anmeldung konnte nicht übertragen werden.';
		} finally {
			laedt = false;
		}
	}
</script>

<svelte:head
	><title>Facta · {data.name}</title><meta
		name="robots"
		content="noindex,nofollow,noarchive,nosnippet"
	/></svelte:head
>
<main class="login-seite">
	<section class="login-karte">
		<div class="zeichen">F</div>
		<p class="ueberzeile">Persönlicher Gastzugang</p>
		<h1>{data.name}</h1>
		<p class="erklaerung">Freigegebene Fälle und Wissenskarten zum Lernen.</p>
		{#if !data.verfuegbar}<p class="fehler">Dieser Gastzugang ist derzeit geschlossen.</p>
		{:else}<form onsubmit={anmelden}>
				<label for="password">Passwort</label><input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
				{#if fehlermeldung}<p class="fehler" aria-live="polite">{fehlermeldung}</p>{/if}<button
					type="submit"
					disabled={laedt}>{laedt ? 'Wird geöffnet …' : 'Gastbereich öffnen'}</button
				>
			</form>{/if}
	</section>
</main>

<style>
	.login-seite {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}
	.login-karte {
		width: min(100%, 25rem);
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius-l);
		padding: 2rem;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
	}
	.zeichen {
		width: 2.5rem;
		height: 2.5rem;
		display: grid;
		place-items: center;
		border-radius: var(--radius-m);
		background: var(--typ-definition);
		color: #07130a;
		font-weight: 750;
		margin-bottom: 1.5rem;
	}
	.ueberzeile {
		margin: 0 0 0.35rem;
		color: var(--text-fluester);
		font-size: 0.78rem;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: 2rem;
		letter-spacing: -0.035em;
	}
	.erklaerung {
		margin: 0.6rem 0 1.75rem;
		color: var(--text-leise);
		line-height: 1.5;
	}
	form {
		display: grid;
		gap: 0.75rem;
	}
	label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-leise);
	}
	input {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--linie-stark);
		border-radius: var(--radius-m);
		padding: 0.8rem 0.9rem;
		color: var(--text);
		font: inherit;
		outline: none;
	}
	input:focus {
		border-color: var(--akzent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--akzent) 20%, transparent);
	}
	button {
		margin-top: 0.35rem;
		border: 0;
		border-radius: var(--radius-m);
		padding: 0.8rem 1rem;
		background: var(--akzent);
		color: white;
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.65;
		cursor: wait;
	}
	.fehler {
		margin: 0;
		color: #ff6961;
		font-size: 0.85rem;
		line-height: 1.45;
	}
</style>
