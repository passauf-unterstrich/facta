(() => {
	'use strict';

	const FACTA_ORIGIN = 'https://facta-one.vercel.app';
	const OLLAMA = 'http://127.0.0.1:11434';
	const status = document.querySelector('#status');
	let verarbeitet = false;

	function zeigeFehler(nachricht) {
		status?.classList.add('fehler');
		const titel = status?.querySelector('h1');
		const text = status?.querySelector('p');
		if (titel) titel.textContent = 'Lokale KI konnte nicht antworten';
		if (text) text.textContent = nachricht;
	}

	function antworte(nachricht) {
		window.opener?.postMessage(nachricht, FACTA_ORIGIN);
	}

	async function bearbeite(event) {
		if (
			verarbeitet ||
			event.origin !== FACTA_ORIGIN ||
			event.source !== window.opener ||
			event.data?.type !== 'facta-ollama-request'
		)
			return;

		const { requestId, action, payload } = event.data;
		if (typeof requestId !== 'string' || requestId.length > 100) return;
		if (action !== 'tags' && action !== 'chat') return;
		if (action === 'chat' && (!payload || typeof payload !== 'object')) return;
		if (action === 'chat' && JSON.stringify(payload).length > 100_000) {
			antworte({
				type: 'facta-ollama-response',
				requestId,
				ok: false,
				message: 'Der lokale Auftrag ist zu groß.'
			});
			return;
		}

		verarbeitet = true;
		try {
			const response = await fetch(`${OLLAMA}/api/${action}`, {
				method: action === 'tags' ? 'GET' : 'POST',
				headers: action === 'chat' ? { 'Content-Type': 'application/json' } : undefined,
				body: action === 'chat' ? JSON.stringify(payload) : undefined
			});
			const text = await response.text();
			let data;
			try {
				data = JSON.parse(text);
			} catch {
				data = null;
			}
			if (!response.ok) throw new Error(data?.error || text || `Ollama antwortet mit ${response.status}`);

			antworte({ type: 'facta-ollama-response', requestId, ok: true, data });
			setTimeout(() => window.close(), 350);
		} catch (fehler) {
			const message = fehler instanceof Error ? fehler.message : 'Unbekannter lokaler Fehler';
			zeigeFehler(message);
			antworte({ type: 'facta-ollama-response', requestId, ok: false, message });
		}
	}

	window.addEventListener('message', bearbeite);

	if (!window.opener) {
		zeigeFehler('Öffne die lokale Brücke ausschließlich über den Memorize-Button in Facta.');
		return;
	}

	// Wiederholen, falls Facta seinen Listener einen Augenblick später setzt.
	const bereitTimer = setInterval(() => {
		if (verarbeitet || window.closed) {
			clearInterval(bereitTimer);
			return;
		}
		antworte({ type: 'facta-ollama-ready' });
	}, 250);
	antworte({ type: 'facta-ollama-ready' });
	setTimeout(() => clearInterval(bereitTimer), 30_000);
})();
