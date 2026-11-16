// Serverless room-code multiplayer over WebRTC (PeerJS) for static hosting such as Cloudflare Pages.
// The first player to open a room code becomes the host and runs the room logic (same protocol as
// server.js) inside the browser. Friends entering the same code connect directly to the host.
// If the host leaves, the remaining players race to claim the room and continue (host migration).

const P2P_ID_PREFIX = 'war-of-spacex-v1-';
const P2P_MAX_PLAYERS = 16;
const P2P_MAX_ATTEMPTS = 8;
const P2P_CONNECT_TIMEOUT_MS = 12000;

function freshBaseStats() {
    return { maxHull: 1200, hull: 1200, maxShield: 600, shield: 600 };
}

// In-browser equivalent of a server.js room, run by the host
class P2PRoomHost {
    constructor(code, seedBaseStats) {
        this.code = code;
        this.clients = new Map(); // client { send(obj) } -> player
        this.baseStats = freshBaseStats();
        // Keep the base state across host migration so the match continues where it was
        if (seedBaseStats && seedBaseStats.hull > 0) {
            this.baseStats.hull = Math.min(this.baseStats.maxHull, seedBaseStats.hull);
            this.baseStats.shield = Math.min(this.baseStats.maxShield, Math.max(0, seedBaseStats.shield));
        }
        this.scores = { defense: 0, attack: 0 };
    }

    addClient(client) {
        if (this.clients.size >= P2P_MAX_PLAYERS) return false;
        this.clients.set(client, {
            id: 'player_' + Math.random().toString(36).slice(2, 10),
            team: 'DEFENSE',
            name: 'Pilot',
            pos: { x: 0, y: 30, z: 200 },
            quat: { x: 0, y: 0, z: 0, w: 1 },
            speed: 0,
            hull: 100,
            shield: 100,
            joined: false
        });
        return true;
    }

    removeClient(client) {
        const player = this.clients.get(client);
        if (!player) return;
        this.clients.delete(client);
        if (player.joined) {
            this.broadcast({ type: 'PLAYER_LEFT', id: player.id });
            this.broadcastPlayerCounts();
        }
    }

    broadcast(obj, except = null) {
        for (const [client, p] of this.clients) {
            if (client !== except && p.joined) client.send(obj);
        }
    }

    broadcastPlayerCounts() {
        let defense = 0, attack = 0, total = 0;
        for (const [, p] of this.clients) {
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

    handle(client, msg) {
        const player = this.clients.get(client);
        if (!player || !msg || typeof msg !== 'object') return;
        if (msg.type !== 'JOIN' && !player.joined) return;

        switch (msg.type) {
            case 'JOIN': {
                player.team = msg.team === 'ATTACK' ? 'ATTACK' : 'DEFENSE';
                player.name = String(msg.name || player.name).slice(0, 16);
                if (player.team === 'DEFENSE') {
                    player.pos = { x: 0, y: 30, z: 220 };
                } else {
                    const angle = Math.random() * Math.PI * 2;
                    player.pos = { x: Math.cos(angle) * 750, y: (Math.random() - 0.5) * 150, z: Math.sin(angle) * 750 };
                }

                const existing = [];
                for (const [, p] of this.clients) {
                    if (p.joined && p !== player) existing.push(this.publicInfo(p));
                }
                player.joined = true;

                client.send({
                    type: 'INIT',
                    id: player.id,
                    team: player.team,
                    room: this.code,
                    pos: player.pos,
                    baseStats: this.baseStats,
                    scores: this.scores,
                    players: existing
                });
                this.broadcast({ type: 'PLAYER_JOINED', player: this.publicInfo(player) }, client);
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
                    type: 'PLAYER_MOVED', id: player.id, pos: player.pos, quat: player.quat,
                    speed: player.speed, hull: player.hull, shield: player.shield
                }, client);
                break;
            }
            case 'FIRE_LASER': {
                this.broadcast({
                    type: 'FIRE_LASER', id: player.id, team: player.team,
                    origin: msg.origin, dir: msg.dir, damage: msg.damage
                }, client);
                break;
            }
            case 'FIRE_MISSILE': {
                this.broadcast({
                    type: 'FIRE_MISSILE', id: player.id, team: player.team, origin: msg.origin, dir: msg.dir,
                    isTorpedo: !!msg.isTorpedo, targetPos: msg.targetPos, damage: msg.damage
                }, client);
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
                    this.baseStats = freshBaseStats();
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
                this.broadcast({ type: 'PLAYER_HIT', targetId: msg.targetId, damage: msg.damage, attackerId: player.id });
                break;
            }
            case 'PLAYER_KILLED': {
                if (msg.killerId && msg.killerId !== player.id) {
                    this.broadcast({ type: 'KILL_CREDIT', killerId: msg.killerId, victimId: player.id });
                }
                break;
            }
            case 'EMP_BLAST': {
                this.broadcast({ type: 'EMP_BLAST', origin: msg.origin, radius: msg.radius || 600, team: player.team }, client);
                break;
            }
        }
    }
}

// Transport with the same surface NetworkManager needs: start(), send(obj), close()
class P2PTransport {
    constructor(roomCode, handlers) {
        this.roomCode = roomCode;
        this.hostId = P2P_ID_PREFIX + roomCode;
        this.handlers = handlers; // { onOpen({host}), onMessage(msg), onHostLost(), onStatus(text), onFailed(reason), getBaseStats() }
        this.peer = null;
        this.conn = null;
        this.room = null;
        this.localClient = null;
        this.isHost = false;
        this.closed = false;
        this.attempts = 0;
        this.connectTimer = null;
    }

    start() {
        this.tryHost();
    }

    // Claim the room ID; if someone already holds it, join them as a guest
    tryHost() {
        if (this.closed) return;
        if (++this.attempts > P2P_MAX_ATTEMPTS) {
            this.handlers.onFailed('방 접속 시도 횟수를 초과했습니다.');
            return;
        }
        this.resetPeer();
        this.handlers.onStatus(`⏳ 방 [${this.roomCode}] 연결 중...`);

        const peer = new Peer(this.hostId, { debug: 1 });
        this.peer = peer;
        let opened = false;

        peer.on('open', () => {
            if (peer !== this.peer) return;
            opened = true;
            this.becomeHost();
        });

        peer.on('connection', (conn) => this.acceptGuest(conn));

        // Keep the room ID registered so new friends can still find the host
        peer.on('disconnected', () => {
            if (peer === this.peer && !this.closed && !peer.destroyed) peer.reconnect();
        });

        peer.on('error', (err) => {
            if (peer !== this.peer) return;
            if (!opened && err.type === 'unavailable-id') {
                this.joinAsGuest();
            } else if (!opened) {
                console.warn('[P2P] Host claim error:', err.type);
                this.retryLater();
            } else {
                console.warn('[P2P] Host error:', err.type);
            }
        });
    }

    becomeHost() {
        this.isHost = true;
        this.attempts = 0;
        this.room = new P2PRoomHost(this.roomCode, this.handlers.getBaseStats && this.handlers.getBaseStats());

        // Loopback client: the host's own game talks to the room like any other player
        this.localClient = {
            send: (obj) => setTimeout(() => this.handlers.onMessage(JSON.parse(JSON.stringify(obj))), 0)
        };
        this.room.addClient(this.localClient);
        console.log(`[P2P] Hosting room ${this.roomCode}`);
        this.handlers.onOpen({ host: true });
    }

    acceptGuest(conn) {
        if (!this.room) {
            conn.close();
            return;
        }
        const client = {
            send: (obj) => {
                if (conn.open) {
                    try { conn.send(obj); } catch (e) {}
                }
            }
        };
        conn.on('open', () => {
            if (!this.room || !this.room.addClient(client)) conn.close();
        });
        conn.on('data', (data) => {
            if (this.room) this.room.handle(client, data);
        });
        const drop = () => {
            if (this.room) this.room.removeClient(client);
        };
        conn.on('close', drop);
        conn.on('error', drop);
        conn.on('iceStateChanged', (state) => {
            if (state === 'failed' || state === 'closed') drop();
        });
    }

    joinAsGuest() {
        if (this.closed) return;
        this.resetPeer();
        const peer = new Peer({ debug: 1 });
        this.peer = peer;

        peer.on('open', () => {
            if (peer !== this.peer) return;
            const conn = peer.connect(this.hostId, { reliable: true, serialization: 'json' });
            this.conn = conn;

            this.connectTimer = setTimeout(() => {
                if (!conn.open && conn === this.conn) {
                    console.warn('[P2P] Guest connect timeout');
                    this.retryLater();
                }
            }, P2P_CONNECT_TIMEOUT_MS);

            conn.on('open', () => {
                if (conn !== this.conn) return;
                clearTimeout(this.connectTimer);
                this.isHost = false;
                this.attempts = 0;
                console.log(`[P2P] Joined room ${this.roomCode} as guest`);
                this.handlers.onOpen({ host: false });
            });
            conn.on('data', (data) => {
                if (conn === this.conn) this.handlers.onMessage(data);
            });
            const lost = () => {
                if (conn !== this.conn || this.closed) return;
                this.conn = null;
                this.handlers.onHostLost();
                this.retryLater();
            };
            conn.on('close', lost);
            conn.on('error', lost);
            conn.on('iceStateChanged', (state) => {
                if (state === 'failed' || state === 'closed') lost();
            });
        });

        peer.on('error', (err) => {
            if (peer !== this.peer) return;
            // Host vanished between our checks: try to claim the room ourselves
            console.warn('[P2P] Guest error:', err.type);
            this.retryLater();
        });
    }

    // Random jitter so remaining players don't all claim the room at the same instant
    retryLater() {
        if (this.closed) return;
        clearTimeout(this.connectTimer);
        this.resetPeer();
        setTimeout(() => this.tryHost(), 400 + Math.random() * 1200);
    }

    resetPeer() {
        clearTimeout(this.connectTimer);
        this.room = null;
        this.localClient = null;
        this.isHost = false;
        if (this.conn) {
            const c = this.conn;
            this.conn = null;
            try { c.close(); } catch (e) {}
        }
        if (this.peer) {
            const p = this.peer;
            this.peer = null;
            try { p.destroy(); } catch (e) {}
        }
    }

    send(obj) {
        if (this.isHost && this.room && this.localClient) {
            this.room.handle(this.localClient, JSON.parse(JSON.stringify(obj)));
        } else if (this.conn && this.conn.open) {
            try { this.conn.send(obj); } catch (e) {}
        }
    }

    close() {
        this.closed = true;
        this.resetPeer();
    }
}

window.P2PTransport = P2PTransport;
