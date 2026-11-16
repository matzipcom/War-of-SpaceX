// War of SpaceX - Cloudflare Worker (free plan, SQLite-backed Durable Objects)
// Routes each WebSocket connection to the Durable Object of its room code.

import { GameRoom } from './gameServer.js';

export { GameRoom };

function sanitizeRoomCode(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return code || 'PUBLIC';
}

export default {
  async fetch(request, env) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('War of SpaceX game server is running. Connect via WebSocket.', {
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
      });
    }

    const room = sanitizeRoomCode(new URL(request.url).searchParams.get('room'));
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(room));
    return stub.fetch(request);
  }
};
