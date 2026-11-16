// Multiplayer server endpoint.
// Pages (static hosting) cannot run WebSockets, so on *.pages.dev the game connects to the
// Cloudflare Worker below. Anywhere else (node server.js / Codespaces) it uses the same host.
window.WS_SERVER_URL = location.hostname.endsWith('.pages.dev')
    ? 'wss://war-of-spacex-ws.WORKERS_SUBDOMAIN.workers.dev'
    : '';
