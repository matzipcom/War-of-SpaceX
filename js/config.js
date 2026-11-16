// Multiplayer connection settings
//  'p2p'  : serverless WebRTC rooms (PeerJS). Works on static hosting such as Cloudflare Pages.
//  'ws'   : dedicated WebSocket game server only (node server.js, or the Worker in src/).
//  'auto' : try the WebSocket server first, fall back to P2P if none answers.
window.MULTIPLAYER_MODE = /\.pages\.dev$|\.github\.io$/.test(location.hostname) ? 'p2p' : 'auto';

// Optional external WebSocket server, e.g. 'wss://war-of-spacex-ws.<subdomain>.workers.dev'.
// Empty = same host as the page.
window.WS_SERVER_URL = '';
