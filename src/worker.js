// War of SpaceX - Cloudflare Workers Backend
// Handles WebSocket connections and game state management

import { GameServer } from './gameServer.js';

export default {
  async fetch(request, env) {
    // Upgrade to WebSocket
    if (request.headers.get('Upgrade') === 'websocket') {
      try {
        const server = new GameServer(env);
        return server.handleWebSocket(request);
      } catch (error) {
        console.error('WebSocket error:', error);
        return new Response('WebSocket connection failed', { status: 400 });
      }
    }

    // Serve static files from public directory
    const url = new URL(request.url);
    
    // Route to Cloudflare Pages
    if (request.method === 'GET') {
      // Proxy to Pages
      const origin = new URL(request.url);
      origin.host = env.PAGES_URL || 'war-of-spacex.pages.dev';
      
      return fetch(new Request(origin, request));
    }

    return new Response('Not Found', { status: 404 });
  },

  // Durable Object binding
  async ws(request, env) {
    const id = env.GAME_SERVER.idFromName('game-server-1');
    const gameServer = env.GAME_SERVER.get(id);
    return gameServer.fetch(request);
  }
};
