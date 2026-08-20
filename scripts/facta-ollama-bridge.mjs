import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = 11435;
const ERLAUBTER_HOST = `${HOST}:${PORT}`;
const CLIENT_PFAD = fileURLToPath(new URL('./facta-ollama-bridge-client.js', import.meta.url));
const CLIENT_CODE = readFileSync(CLIENT_PFAD, 'utf8');

const SEITE = `<!doctype html>
<html lang="de">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Facta · Lokale KI</title>
		<style>
			:root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
			body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #0a0a0b; color: #f2f2f4; }
			main { width: min(26rem, calc(100% - 2rem)); padding: 1.4rem; border: 1px solid #303035; border-radius: 18px; background: #17171a; box-sizing: border-box; }
			.zeile { display: flex; align-items: center; gap: .8rem; }
			.punkt { width: .65rem; height: .65rem; flex: 0 0 .65rem; border-radius: 50%; background: #0a84ff; box-shadow: 0 0 0 .28rem rgba(10,132,255,.14); animation: puls 1.2s ease-in-out infinite; }
			h1 { margin: 0; font-size: 1rem; font-weight: 600; }
			p { margin: .55rem 0 0 1.45rem; color: #98989f; font-size: .8rem; line-height: 1.45; }
			.fehler .punkt { background: #ff453a; box-shadow: 0 0 0 .28rem rgba(255,69,58,.14); animation: none; }
			@keyframes puls { 50% { opacity: .45; transform: scale(.82); } }
		</style>
	</head>
	<body>
		<main id="status">
			<div class="zeile"><span class="punkt"></span><h1>Facta verdichtet dein Kernwissen …</h1></div>
			<p>Alles bleibt auf diesem Mac. Dieses Fenster schließt sich automatisch.</p>
		</main>
		<script src="/bridge.js"></script>
	</body>
</html>`;

const server = createServer((request, response) => {
	if (request.headers.host !== ERLAUBTER_HOST) {
		response.writeHead(421, { 'Content-Type': 'text/plain; charset=utf-8' });
		response.end('Ungültiger Host');
		return;
	}

	const headers = {
		'Cache-Control': 'no-store, max-age=0',
		'Content-Security-Policy':
			"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src http://127.0.0.1:11434; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
		'Cross-Origin-Resource-Policy': 'same-origin',
		'Referrer-Policy': 'no-referrer',
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY'
	};

	if (request.method !== 'GET') {
		response.writeHead(405, { ...headers, Allow: 'GET' });
		response.end();
		return;
	}

	if (request.url === '/' || request.url === '/index.html') {
		response.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
		response.end(SEITE);
		return;
	}

	if (request.url === '/bridge.js') {
		response.writeHead(200, {
			...headers,
			'Content-Type': 'text/javascript; charset=utf-8'
		});
		response.end(CLIENT_CODE);
		return;
	}

	if (request.url === '/favicon.ico') {
		response.writeHead(204, headers);
		response.end();
		return;
	}

	response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
	response.end('Nicht gefunden');
});

server.on('error', (fehler) => {
	console.error(`[Facta-Ollama-Brücke] ${fehler.message}`);
	process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
	console.log(`[Facta-Ollama-Brücke] bereit auf http://${ERLAUBTER_HOST}`);
});
