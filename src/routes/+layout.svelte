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
</style>