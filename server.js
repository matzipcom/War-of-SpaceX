// Multiplayer Game & WebSocket Server for War of SpaceX
// Pure Node.js implementation: zero external dependencies, ultra-fast & low latency.
// Run with: node server.js

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Static file MIME types
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

// Global Server Game State (room-based: share a room code with friends to play together)
const PUBLIC_ROOM = 'PUBLIC';

const gameState = {
    rooms: new Map(), // roomCode -> room { code, players: Map(socket -> playerData), baseStats, scores }
    nextPlayerId: 1
};

function createRoomState(code) {
    return {
        code: code,
        players: new Map(),
        baseStats: {
            maxHull: 1200,
            hull: 1200,
            maxShield: 600,
            shield: 600
        },
        scores: {
            defense: 0,
            attack: 0
        }
    };
}

function getOrCreateRoom(code) {
    let room = gameState.rooms.get(code);
    if (!room) {
        room = createRoomState(code);
        gameState.rooms.set(code, room);
        console.log(`Room [${code}] created. Active rooms: ${gameState.rooms.size}`);
    }
    return room;
}

// Normalize a user-supplied room code; empty codes fall back to the public room
function sanitizeRoomCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return code || PUBLIC_ROOM;
}

function totalPlayerCount() {
    let total = 0;
    for (const [, room] of gameState.rooms) total += room.players.size;
    return total;
}

// 1. Static HTTP Server
const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    const filePath = path.join(__dirname, reqUrl);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
                res.end('500 Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// 2. RFC 6455 WebSocket Framing Utilities
function decodeWebSocketFrame(buffer) {
    if (buffer.length < 2) return null;
    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
        if (buffer.length < 4) return null;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
    } else if (payloadLen === 127) {
        if (buffer.length < 10) return null;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
    }

    if (buffer.length < offset + (isMasked ? 4 : 0) + payloadLen) return null;

    let payload;
    if (isMasked) {
        const mask = buffer.slice(offset, offset + 4);
        offset += 4;
        payload = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
            payload[i] = buffer[offset + i] ^ mask[i % 4];
        }
    } else {
        payload = buffer.slice(offset, offset + payloadLen);
    }

    return { opcode, payload: payload.toString('utf8'), totalLength: offset + payloadLen };
}

function encodeWebSocketFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    const len = payload.length;
    let header;
    if (len <= 125) {
        header = Buffer.from([0x81, len]);
    } else if (len <= 65535) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, payload]);
}

function sendToSocket(socket, obj) {
    if (socket.writable) {
        try {
            socket.write(encodeWebSocketFrame(JSON.stringify(obj)));
        } catch (e) {
            console.error('Send error:', e.message);
        }
    }
}

function broadcast(room, obj, exceptSocket = null) {
    if (!room) return;
    const frame = encodeWebSocketFrame(JSON.stringify(obj));
    for (const [s] of room.players) {
        if (s !== exceptSocket && s.writable) {
            try {
                s.write(frame);
            } catch (e) {}
        }
    }
}

// Broadcast player counts for a room to its members
function broadcastPlayerCounts(room) {
    if (!room) return;
    let defenseCount = 0;
    let attackCount = 0;
    for (const [, player] of room.players) {
        if (player.team === 'DEFENSE') defenseCount++;
        else if (player.team === 'ATTACK') attackCount++;
    }
    broadcast(room, {
        type: 'PLAYER_COUNTS',
        room: room.code,
        total: room.players.size,
        defense: defenseCount,
        attack: attackCount
    });
}

// 3. WebSocket Upgrade & Event Handlers
server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
        socket.destroy();
        return;
    }

    const acceptKey = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + acceptKey + '\r\n\r\n'
    );

    const playerId = 'player_' + (gameState.nextPlayerId++);
    const playerObj = {
        id: playerId,
        room: null, // assigned when the player sends JOIN with a room code
        team: 'DEFENSE',
        name: 'Pilot-' + playerId.slice(-3),
        pos: { x: 0, y: 30, z: 200 },
        quat: { x: 0, y: 0, z: 0, w: 1 },
        speed: 0,
        hull: 100,
        shield: 100,
        score: 0,
        kills: 0,
        baseDamage: 0
    };

    // Send a global snapshot so the lobby counter works before joining a room
    let lobbyDefense = 0, lobbyAttack = 0;
    for (const [, room] of gameState.rooms) {
        for (const [, p] of room.players) {
            if (p.team === 'DEFENSE') lobbyDefense++;
            else if (p.team === 'ATTACK') lobbyAttack++;
        }
    }
    sendToSocket(socket, {
        type: 'PLAYER_COUNTS',
        room: null,
        total: totalPlayerCount(),
        defense: lobbyDefense,
        attack: lobbyAttack
    });

    let incomingBuffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
        incomingBuffer = Buffer.concat([incomingBuffer, chunk]);

        while (incomingBuffer.length > 0) {
            const frame = decodeWebSocketFrame(incomingBuffer);
            if (!frame) break;

            incomingBuffer = incomingBuffer.slice(frame.totalLength);

            if (frame.opcode === 8) {
                // Close frame
                socket.end();
                break;
            } else if (frame.opcode === 1) {
                // Text frame
                try {
                    const msg = JSON.parse(frame.payload);
                    handlePlayerMessage(socket, playerObj, msg);
                } catch (e) {
                    console.error('JSON parse error:', e.message);
                }
            }
        }
    });

    socket.on('close', () => {
        const room = playerObj.room;
        if (room) {
            room.players.delete(socket);
            playerObj.room = null;
            broadcast(room, {
                type: 'PLAYER_LEFT',
                id: playerObj.id
            });
            // Update player counts when player leaves
            broadcastPlayerCounts(room);

            // Clean up empty rooms (fresh base stats for the next match)
            if (room.players.size === 0) {
                gameState.rooms.delete(room.code);
                console.log(`Room [${room.code}] closed (empty). Active rooms: ${gameState.rooms.size}`);
            }
            console.log(`Player ${playerObj.id} (${playerObj.team}) disconnected from room [${room.code}]. Total: ${totalPlayerCount()}`);
        }
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
        socket.destroy();
    });
});

// 4. Handle Ingame Packets
function handlePlayerMessage(socket, player, msg) {
    const room = player.room;

    switch (msg.type) {
        case 'JOIN': {
            // Move out of any previous room first (re-join safety)
            if (room) {
                room.players.delete(socket);
                broadcast(room, { type: 'PLAYER_LEFT', id: player.id });
                broadcastPlayerCounts(room);
                if (room.players.size === 0) gameState.rooms.delete(room.code);
            }

            // Join the requested room (friends share the same room code)
            const roomCode = sanitizeRoomCode(msg.room);
            const joinedRoom = getOrCreateRoom(roomCode);
            joinedRoom.players.set(socket, player);
            player.room = joinedRoom;

            player.team = msg.team === 'ATTACK' ? 'ATTACK' : 'DEFENSE';
            player.name = (msg.name || player.name).slice(0, 16);

            // Spawn point based on team
            if (player.team === 'DEFENSE') {
                player.pos = { x: 0, y: 30, z: 220 };
            } else {
                // Attackers spawn in perimeter
                const angle = Math.random() * Math.PI * 2;
                player.pos = {
                    x: Math.cos(angle) * 750,
                    y: (Math.random() - 0.5) * 150,
                    z: Math.sin(angle) * 750
                };
            }

            // Send INIT packet with existing players & base stats of the joined room
            const existingPlayers = [];
            for (const [, p] of joinedRoom.players) {
                if (p.id !== player.id) {
                    existingPlayers.push({
                        id: p.id,
                        team: p.team,
                        name: p.name,
                        pos: p.pos,
                        quat: p.quat,
                        hull: p.hull,
                        shield: p.shield
                    });
                }
            }

            sendToSocket(socket, {
                type: 'INIT',
                id: player.id,
                team: player.team,
                room: joinedRoom.code,
                pos: player.pos,
                baseStats: joinedRoom.baseStats,
                scores: joinedRoom.scores,
                players: existingPlayers
            });

            // Notify everyone else in the room
            broadcast(joinedRoom, {
                type: 'PLAYER_JOINED',
                player: {
                    id: player.id,
                    team: player.team,
                    name: player.name,
                    pos: player.pos,
                    quat: player.quat,
                    hull: player.hull,
                    shield: player.shield
                }
            }, socket);

            // Send updated player counts to room members
            broadcastPlayerCounts(joinedRoom);

            console.log(`Player ${player.id} joined room [${joinedRoom.code}] team ${player.team} as "${player.name}"`);
            break;
        }

        case 'MOVE': {
            if (!room) break;
            player.pos = msg.pos;
            player.quat = msg.quat;
            player.speed = msg.speed;
            player.hull = msg.hull;
            player.shield = msg.shield;

            // Broadcast movement to all other clients in the room
            broadcast(room, {
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
            if (!room) break;
            broadcast(room, {
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
            if (!room) break;
            broadcast(room, {
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
            if (!room) break;
            const dmg = Math.min(250, msg.amount || 20);
            if (room.baseStats.shield > 0) {
                room.baseStats.shield = Math.max(0, room.baseStats.shield - dmg);
            } else {
                room.baseStats.hull = Math.max(0, room.baseStats.hull - dmg);
            }

            broadcast(room, {
                type: 'BASE_UPDATE',
                baseStats: room.baseStats,
                attackerId: player.id
            });

            if (room.baseStats.hull <= 0) {
                broadcast(room, {
                    type: 'GAME_OVER',
                    winner: 'ATTACK',
                    reason: '머스크 우주 데이터센터가 공격팀에 의해 완전 폭파되었습니다!'
                });

                // Reset base so the room can play another round
                room.baseStats.hull = room.baseStats.maxHull;
                room.baseStats.shield = room.baseStats.maxShield;
            }
            break;
        }

        case 'REPAIR_BASE': {
            if (!room) break;
            const heal = Math.min(50, msg.amount || 15);
            room.baseStats.hull = Math.min(room.baseStats.maxHull, room.baseStats.hull + heal);

            broadcast(room, {
                type: 'BASE_UPDATE',
                baseStats: room.baseStats,
                healerId: player.id
            });
            break;
        }

        case 'HIT_PLAYER': {
            if (!room) break;
            broadcast(room, {
                type: 'PLAYER_HIT',
                targetId: msg.targetId,
                damage: msg.damage,
                attackerId: player.id
            });
            break;
        }

        case 'PLAYER_KILLED': {
            if (!room) break;
            if (msg.killerId && msg.killerId !== player.id) {
                broadcast(room, {
                    type: 'KILL_CREDIT',
                    killerId: msg.killerId,
                    victimId: player.id
                });
            }
            break;
        }

        case 'EMP_BLAST': {
            if (!room) break;
            broadcast(room, {
                type: 'EMP_BLAST',
                origin: msg.origin,
                radius: msg.radius || 600,
                team: player.team
            }, socket);
            break;
        }
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` War of SpaceX: Multiplayer Game Server Online `);
    console.log(` Listening on http://0.0.0.0:${PORT}            `);
    console.log(` WebSocket server running on ws://0.0.0.0:${PORT} `);
    console.log(`===============================================`);
});
