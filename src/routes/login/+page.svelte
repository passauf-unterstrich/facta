<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Facta · Privater Zugang</title>
	<meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
</svelte:head>

<main class="login-seite">
	<section class="login-karte">
		<div class="zeichen">F</div>
		<p class="ueberzeile">Privater Zugang</p>
		<h1>Facta</h1>
		<p class="erklaerung">Melde dich an, um deine Lernkarten zu öffnen.</p>

		{#if !data.konfiguriert || form?.nichtKonfiguriert}
			<p class="fehler">Der Zugang ist noch nicht vollständig konfiguriert.</p>
		{:else}
			<form method="POST">
				<label for="password">Passwort</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
				{#if form?.falsch}<p class="fehler">Das Passwort stimmt nicht.</p>{/if}
				<button type="submit">Öffnen</button>
			</form>
		{/if}
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
		background: var(--akzent);
		color: white;
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
		transition:
			background 0.15s ease,
			transform 0.15s ease;
	}
	button:hover {
		background: var(--akzent-hover);
	}
	button:active {
		transform: scale(0.985);
	}
	.fehler {
		margin: 0;
		color: #ff6961;
		font-size: 0.85rem;
		line-height: 1.45;
	}
</style>
