// Game Server - Manages multiplayer game state and WebSocket connections
// Uses Durable Objects for persistent game state

export class GameServer {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = new Map();
    this.baseStats = {
      maxHull: 100000,
      hull: 100000,
      maxShield: 50000,
      shield: 50000,
      shieldRegenRate: 15,
      shieldRegenDelay: 8,
      lastHitTime: 0
    };
    this.connections = new Map();
  }

  // Handle WebSocket upgrade
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  handleSocket(socket) {
    const playerId = this.generatePlayerId();
    let playerObj = null;

    socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(socket, playerObj, msg, (obj) => { playerObj = obj; });
      } catch (e) {
        console.error('Message parse error:', e);
      }
    });

    socket.addEventListener('close', () => {
      if (playerObj) {
        this.players.delete(playerId);
        this.broadcastToAll({
          type: 'PLAYER_LEFT',
          id: playerObj.id
        });
        this.broadcastPlayerCounts();
      }
    });

    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.connections.set(playerId, socket);
  }

  handleMessage(socket, playerObj, msg, setPlayer) {
    switch (msg.type) {
      case 'JOIN': {
        const player = {
          id: this.generatePlayerId(),
          team: msg.team,
          name: msg.name || 'Pilot-X',
          pos: { x: msg.team === 'DEFENSE' ? 100 : -100, y: 50, z: msg.team === 'DEFENSE' ? 200 : -200 },
          quat: { x: 0, y: 0, z: 0, w: 1 },
          hull: msg.team === 'DEFENSE' ? 100 : 150,
          shield: 100,
          speed: 0
        };

        this.players.set(socket, player);
        setPlayer(player);

        // Send init response
        socket.send(JSON.stringify({
          type: 'INIT',
          id: player.id,
          team: player.team,
          baseStats: this.baseStats,
          players: Array.from(this.players.values())
        }));

        // Notify others
        this.broadcastToAll({
          type: 'PLAYER_JOINED',
          player: player
        }, socket);

        this.broadcastPlayerCounts();
        break;
      }

      case 'MOVE': {
        if (!playerObj) return;
        playerObj.pos = msg.pos;
        playerObj.quat = msg.quat;
        playerObj.speed = msg.speed;
        playerObj.hull = msg.hull;
        playerObj.shield = msg.shield;

        this.broadcastToAll({
          type: 'PLAYER_MOVED',
          id: playerObj.id,
          pos: msg.pos,
          quat: msg.quat,
          speed: msg.speed,
          hull: msg.hull,
          shield: msg.shield
        }, socket);
        break;
      }

      case 'FIRE_LASER': {
        if (!playerObj) return;
        this.broadcastToAll({
          type: 'FIRE_LASER',
          id: playerObj.id,
          team: playerObj.team,
          origin: msg.origin,
          dir: msg.dir,
          damage: msg.damage
        }, socket);
        break;
      }

      case 'FIRE_MISSILE': {
        if (!playerObj) return;
        this.broadcastToAll({
          type: 'FIRE_MISSILE',
          id: playerObj.id,
          team: playerObj.team,
          origin: msg.origin,
          dir: msg.dir,
          isTorpedo: msg.isTorpedo,
          damage: msg.damage
        }, socket);
        break;
      }

      case 'DAMAGE_BASE': {
        if (!playerObj) return;
        this.baseStats.hull -= msg.damage || 0;
        this.baseStats.lastHitTime = Date.now();

        this.broadcastToAll({
          type: 'BASE_UPDATE',
          baseStats: this.baseStats,
          attackerId: playerObj.id
        });

        if (this.baseStats.hull <= 0) {
          this.broadcastToAll({
            type: 'GAME_OVER',
            winner: 'ATTACK',
            reason: 'Musk Space Data Center destroyed!'
          });
        }
        break;
      }

      case 'REPAIR_BASE': {
        if (!playerObj) return;
        const heal = Math.min(50, msg.amount || 15);
        this.baseStats.hull = Math.min(this.baseStats.maxHull, this.baseStats.hull + heal);

        this.broadcastToAll({
          type: 'BASE_UPDATE',
          baseStats: this.baseStats,
          healerId: playerObj.id
        });
        break;
      }

      case 'PLAYER_HIT': {
        this.broadcastToAll({
          type: 'PLAYER_HIT',
          targetId: msg.targetId,
          damage: msg.damage,
          attackerId: playerObj?.id
        });
        break;
      }

      case 'EMP_BLAST': {
        if (!playerObj) return;
        this.broadcastToAll({
          type: 'EMP_BLAST',
          origin: msg.origin,
          radius: msg.radius,
          playerId: playerObj.id
        });
        break;
      }
    }
  }

  broadcastToAll(msg, excludeSocket = null) {
    const data = JSON.stringify(msg);
    for (const [id, socket] of this.connections) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    }
  }

  broadcastPlayerCounts() {
    let defenseCount = 0;
    let attackCount = 0;

    for (const player of this.players.values()) {
      if (player.team === 'DEFENSE') defenseCount++;
      else if (player.team === 'ATTACK') attackCount++;
    }

    this.broadcastToAll({
      type: 'PLAYER_COUNTS',
      total: this.players.size,
      defense: defenseCount,
      attack: attackCount
    });
  }

  generatePlayerId() {
    return 'player-' + Math.random().toString(36).substr(2, 9);
  }
}

// Durable Object export
export class GameServerDurable {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.gameServer = new GameServer(state, env);
  }

  async fetch(request) {
    return this.gameServer.fetch(request);
  }
}
