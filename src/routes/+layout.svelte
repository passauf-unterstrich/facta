<script lang="ts">
	import './layout.css';
	import '$lib/tokens.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{@render children()}

<style>
	:global(body) {
		background: var(--bg);
		color: var(--text);
		font-family: var(--schrift);
		min-height: 100vh;
		-webkit-font-smoothing: antialiased;
	}
	/* Formularelemente: Browser-Eigenleben abschalten, unsere Optik überall */
	:global(select),
	:global(button),
	:global(input),
	:global(textarea) {
		appearance: none;
		-webkit-appearance: none;
	}
	/* Selects bekommen einen dezenten eigenen Pfeil (Chevron als SVG) */
	:global(select) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2371717a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.7rem center;
		padding-right: 2rem !important;
		cursor: pointer;
	}
</style>
