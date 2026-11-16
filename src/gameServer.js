// GameRoom Durable Object: one instance per room code.
// Mirrors the protocol of server.js so the same client works with both backends.

const MAX_PLAYERS = 16;

export class GameRoom {
  constructor(state, env) {
    this.players = new Map(); // WebSocket -> player
    this.nextPlayerId = 1;
    this.code = 'PUBLIC';
    this.baseStats = this.freshBaseStats();
    this.scores = { defense: 0, attack: 0 };
  }

  freshBaseStats() {
    return { maxHull: 1200, hull: 1200, maxShield: 600, shield: 600 };
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    if (this.players.size >= MAX_PLAYERS) {
      return new Response('Room is full', { status: 403 });
    }

    const raw = new URL(request.url).searchParams.get('room') || '';
    this.code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PUBLIC';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.handleSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  handleSocket(socket) {
    const player = {
      id: 'player_' + this.nextPlayerId++,
      team: 'DEFENSE',
      name: 'Pilot',
      pos: { x: 0, y: 30, z: 200 },
      quat: { x: 0, y: 0, z: 0, w: 1 },
      speed: 0,
      hull: 100,
      shield: 100,
      joined: false
    };
    player.name = 'Pilot-' + player.id.slice(-3);
    this.players.set(socket, player);

    socket.addEventListener('message', (event) => {
      try {
        this.handleMessage(socket, player, JSON.parse(event.data));
      } catch (e) {
        console.error('Message error:', e && e.message);
      }
    });

    const onClose = () => {
      if (!this.players.delete(socket)) return;
      if (player.joined) {
        this.broadcast({ type: 'PLAYER_LEFT', id: player.id });
        this.broadcastPlayerCounts();
      }
      if (this.players.size === 0) {
        this.baseStats = this.freshBaseStats();
      }
    };
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onClose);
  }

  send(socket, obj) {
    try {
      socket.send(JSON.stringify(obj));
    } catch (e) {}
  }

  broadcast(obj, except = null) {
    const frame = JSON.stringify(obj);
    for (const [s, p] of this.players) {
      if (s !== except && p.joined) {
        try {
          s.send(frame);
        } catch (e) {}
      }
    }
  }

  broadcastPlayerCounts() {
    let defense = 0;
    let attack = 0;
    let total = 0;
    for (const [, p] of this.players) {
      if (!p.joined) continue;
      total++;
      if (p.team === 'DEFENSE') defense++;
      else attack++;
    }
    this.broadcast({ type: 'PLAYER_COUNTS', room: this.code, total, defense, attack });
  }

  publicInfo(p) {
    return { id: p.id, team: p.team, name: p.name, pos: p.pos, quat: p.quat, hull: p.hull, shield: p.shield };
  }

  handleMessage(socket, player, msg) {
    if (msg.type !== 'JOIN' && !player.joined) return;

    switch (msg.type) {
      case 'JOIN': {
        player.team = msg.team === 'ATTACK' ? 'ATTACK' : 'DEFENSE';
        player.name = String(msg.name || player.name).slice(0, 16);

        if (player.team === 'DEFENSE') {
          player.pos = { x: 0, y: 30, z: 220 };
        } else {
          const angle = Math.random() * Math.PI * 2;
          player.pos = {
            x: Math.cos(angle) * 750,
            y: (Math.random() - 0.5) * 150,
            z: Math.sin(angle) * 750
          };
        }

        const existing = [];
        for (const [, p] of this.players) {
          if (p.joined && p.id !== player.id) existing.push(this.publicInfo(p));
        }
        player.joined = true;

        this.send(socket, {
          type: 'INIT',
          id: player.id,
          team: player.team,
          room: this.code,
          pos: player.pos,
          baseStats: this.baseStats,
          scores: this.scores,
          players: existing
        });
        this.broadcast({ type: 'PLAYER_JOINED', player: this.publicInfo(player) }, socket);
        this.broadcastPlayerCounts();
        break;
      }

      case 'MOVE': {
        player.pos = msg.pos;
        player.quat = msg.quat;
        player.speed = msg.speed;
        player.hull = msg.hull;
        player.shield = msg.shield;
        this.broadcast({
          type: 'PLAYER_MOVED',
          id: player.id,
          pos: player.pos,
          quat: player.quat,
          speed: player.speed,
          hull: player.hull,
          shield: player.shield
        }, socket);
        break;
      }

      case 'FIRE_LASER': {
        this.broadcast({
          type: 'FIRE_LASER',
          id: player.id,
          team: player.team,
          origin: msg.origin,
          dir: msg.dir,
          damage: msg.damage
        }, socket);
        break;
      }

      case 'FIRE_MISSILE': {
        this.broadcast({
          type: 'FIRE_MISSILE',
          id: player.id,
          team: player.team,
          origin: msg.origin,
          dir: msg.dir,
          isTorpedo: !!msg.isTorpedo,
          targetPos: msg.targetPos,
          damage: msg.damage
        }, socket);
        break;
      }

      case 'DAMAGE_BASE': {
        const dmg = Math.min(250, msg.amount || 20);
        if (this.baseStats.shield > 0) {
          this.baseStats.shield = Math.max(0, this.baseStats.shield - dmg);
        } else {
          this.baseStats.hull = Math.max(0, this.baseStats.hull - dmg);
        }
        this.broadcast({ type: 'BASE_UPDATE', baseStats: this.baseStats, attackerId: player.id });

        if (this.baseStats.hull <= 0) {
          this.broadcast({
            type: 'GAME_OVER',
            winner: 'ATTACK',
            reason: '머스크 우주 데이터센터가 공격팀에 의해 완전 폭파되었습니다!'
          });
          this.baseStats = this.freshBaseStats();
        }
        break;
      }

      case 'REPAIR_BASE': {
        const heal = Math.min(50, msg.amount || 15);
        this.baseStats.hull = Math.min(this.baseStats.maxHull, this.baseStats.hull + heal);
        this.broadcast({ type: 'BASE_UPDATE', baseStats: this.baseStats, healerId: player.id });
        break;
      }

      case 'HIT_PLAYER': {
        this.broadcast({
          type: 'PLAYER_HIT',
          targetId: msg.targetId,
          damage: msg.damage,
          attackerId: player.id
        });
        break;
      }

      case 'PLAYER_KILLED': {
        if (msg.killerId && msg.killerId !== player.id) {
          this.broadcast({ type: 'KILL_CREDIT', killerId: msg.killerId, victimId: player.id });
        }
        break;
      }

      case 'EMP_BLAST': {
        this.broadcast({
          type: 'EMP_BLAST',
          origin: msg.origin,
          radius: msg.radius || 600,
          team: player.team
        }, socket);
        break;
      }
    }
  }
}
