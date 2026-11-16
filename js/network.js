// Real-Time Online Multiplayer Networking for War of SpaceX
// Connects via WebSocket, synchronizes players, weapons, bases, and remote 3D models

class NetworkManager {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.connected = false;
        this.playerId = null;
        this.myTeam = 'DEFENSE'; // 'DEFENSE' or 'ATTACK'
        this.roomCode = ''; // empty = public match; share a code to play with friends
        this.transport = null; // WebSocket or P2P transport: { send(obj), close() }
        this.isHost = false; // P2P only: this browser runs the room
        this.roomPlayerCount = 1;
        this.remotePlayers = new Map(); // id -> { mesh, targetPos, targetQuat, name, team, hull, shield }

        this.sendMoveTimer = 0;
        this.sendMoveInterval = 1 / 30; // 30Hz network sync
    }

    connect(selectedTeam, playerName, roomCode) {
        this.myTeam = selectedTeam;
        this.playerName = playerName || (selectedTeam === 'DEFENSE' ? 'SpaceX-Pilot' : 'Void-Raider');
        this.roomCode = (roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PUBLIC';

        if (!this.unloadHooked) {
            this.unloadHooked = true;
            // Release the P2P room ID right away so friends can take over hosting
            window.addEventListener('beforeunload', () => this.disconnect());
        }

        const mode = window.MULTIPLAYER_MODE || 'auto';
        if (mode === 'p2p') {
            this.connectP2P();
        } else {
            this.connectWebSocket(mode === 'auto');
        }
    }

    // Dedicated game server (node server.js or the Cloudflare Worker in src/)
    connectWebSocket(fallbackToP2P) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const base = window.WS_SERVER_URL || `${protocol}//${window.location.host}`;
        const wsUrl = `${base}/?room=${encodeURIComponent(this.roomCode)}`;
        let opened = false;
        let failed = false;

        const fail = () => {
            if (opened || failed) return;
            failed = true;
            clearTimeout(timer);
            try { this.ws && this.ws.close(); } catch (e) {}
            this.ws = null;
            this.transport = null;
            if (fallbackToP2P) {
                console.warn('[Multiplayer] No game server on this host, switching to P2P rooms.');
                this.connectP2P();
            } else {
                this.setConnectionStatus('⚠️ 게임 서버 연결 실패 (솔로 모드)');
            }
        };

        this.setConnectionStatus(`⏳ 방 [${this.roomCode}] 연결 중...`);
        let timer = null;
        try {
            this.ws = new WebSocket(wsUrl);
        } catch (e) {
            fail();
            return;
        }
        timer = setTimeout(fail, 4000);

        this.transport = {
            send: (obj) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
            },
            close: () => {
                try { this.ws && this.ws.close(); } catch (e) {}
            }
        };

        this.ws.onopen = () => {
            opened = true;
            clearTimeout(timer);
            console.log('[Multiplayer] Connected to game server.');
            this.onTransportOpen();
        };

        this.ws.onmessage = (event) => {
            try {
                this.handleMessage(JSON.parse(event.data));
            } catch (e) {
                console.error('[Multiplayer] JSON parse error:', e);
            }
        };

        this.ws.onclose = () => {
            if (!opened) {
                fail();
                return;
            }
            this.connected = false;
            this.setConnectionStatus('⚠️ 서버 연결이 끊어졌습니다');
            console.log('[Multiplayer] Disconnected from game server.');
        };

        this.ws.onerror = () => {
            if (!opened) fail();
        };
    }

    // Serverless WebRTC rooms (works on static hosting like Cloudflare Pages)
    connectP2P() {
        if (!window.P2PTransport || !window.Peer) {
            this.setConnectionStatus('⚠️ P2P 라이브러리 로드 실패 (솔로 모드)');
            console.warn('[Multiplayer] PeerJS not loaded; multiplayer unavailable.');
            return;
        }

        this.transport = new P2PTransport(this.roomCode, {
            getBaseStats: () => this.game.baseStats,
            onOpen: ({ host }) => {
                this.isHost = host;
                this.onTransportOpen();
            },
            onMessage: (msg) => this.handleMessage(msg),
            onHostLost: () => {
                this.connected = false;
                this.clearRemotePlayers();
                this.game.showCombatBanner('📡 방장 연결이 끊겼습니다. 방을 이어받는 중...');
            },
            onStatus: (text) => this.setConnectionStatus(text),
            onFailed: (reason) => {
                this.connected = false;
                this.setConnectionStatus('⚠️ 방 연결 실패 (솔로 모드)');
                this.game.showCombatBanner(`⚠️ 멀티플레이 연결 실패: ${reason}`);
            }
        });
        this.transport.start();
    }

    onTransportOpen() {
        this.connected = true;
        this.send({
            type: 'JOIN',
            team: this.myTeam,
            name: this.playerName,
            room: this.roomCode
        });
    }

    disconnect() {
        this.connected = false;
        if (this.transport && this.transport.close) this.transport.close();
        this.transport = null;
    }

    send(obj) {
        if (this.transport) this.transport.send(obj);
    }

    setConnectionStatus(text) {
        const roomEl = document.getElementById('room-code-display');
        if (roomEl) {
            roomEl.textContent = text;
            roomEl.classList.remove('hidden');
        }
    }

    clearRemotePlayers() {
        this.remotePlayers.forEach(rp => this.game.scene.remove(rp.mesh));
        this.remotePlayers.clear();
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'INIT': {
                this.playerId = msg.id;
                this.myTeam = msg.team;
                if (msg.room) this.roomCode = msg.room;
                console.log(`[Multiplayer] Joined as ${this.playerId} on Team ${this.myTeam} in Room [${this.roomCode}]`);

                // Show the current room code on the HUD so it can be shared with friends
                this.roomPlayerCount = (msg.players ? msg.players.length : 0) + 1;
                this.updateRoomDisplay();
                if (this.roomCode !== 'PUBLIC') {
                    const who = this.isHost ? '방을 만들었습니다 (방장)' : '입장 완료';
                    this.game.showCombatBanner(`🔑 방 [${this.roomCode}] ${who}! 친구에게 이 코드를 공유하세요.`);
                }

                // Fresh snapshot of the room (also covers rejoining after host migration)
                this.clearRemotePlayers();

                // Synchronize Data Center Base Stats
                if (msg.baseStats) {
                    this.game.baseStats.hull = msg.baseStats.hull;
                    this.game.baseStats.shield = msg.baseStats.shield;
                }

                // Spawn existing remote players
                if (msg.players) {
                    msg.players.forEach(p => this.addRemotePlayer(p));
                }
                break;
            }

            case 'PLAYER_JOINED': {
                this.addRemotePlayer(msg.player);
                const teamName = msg.player.team === 'DEFENSE' ? '수비팀(SpaceX)' : '공격팀(신디케이트)';
                this.game.showCombatBanner(`🚀 온라인 플레이어 [${msg.player.name}] 님이 ${teamName}에 참전했습니다!`);
                break;
            }

            case 'PLAYER_MOVED': {
                const rp = this.remotePlayers.get(msg.id);
                if (rp) {
                    rp.targetPos.set(msg.pos.x, msg.pos.y, msg.pos.z);
                    rp.targetQuat.set(msg.quat.x, msg.quat.y, msg.quat.z, msg.quat.w);
                    rp.speed = msg.speed;
                    rp.hull = msg.hull;
                    rp.shield = msg.shield;
                }
                break;
            }

            case 'PLAYER_LEFT': {
                this.removeRemotePlayer(msg.id);
                break;
            }

            case 'FIRE_LASER': {
                this.renderRemoteLaser(msg);
                break;
            }

            case 'FIRE_MISSILE': {
                this.renderRemoteMissile(msg);
                break;
            }

            case 'BASE_UPDATE': {
                if (msg.baseStats) {
                    this.game.baseStats.hull = msg.baseStats.hull;
                    this.game.baseStats.shield = msg.baseStats.shield;
                }
                break;
            }

            case 'PLAYER_HIT': {
                if (msg.targetId === this.playerId) {
                    this.game.damagePlayer(msg.damage, msg.attackerId);
                }
                break;
            }

            case 'KILL_CREDIT': {
                if (msg.killerId === this.playerId) {
                    this.game.onEnemyKilled();
                }
                break;
            }

            case 'EMP_BLAST': {
                this.game.particles.spawnEMP(
                    new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z),
                    msg.radius
                );
                if (window.soundFX) window.soundFX.empBlast();
                break;
            }

            case 'GAME_OVER': {
                if (msg.winner === this.myTeam) {
                    this.game.victory();
                } else {
                    this.game.gameOver(msg.reason || '작전 목표 달성 실패');
                }
                break;
            }

            case 'PLAYER_COUNTS': {
                this.updatePlayerCountsUI(msg);
                break;
            }
        }
    }

    // Add 3D Model for Remote Player
    addRemotePlayer(data) {
        if (data.id === this.playerId || this.remotePlayers.has(data.id)) return;

        let mesh;
        if (data.team === 'DEFENSE') {
            mesh = this.game.models.createPlayerShip();
        } else {
            mesh = this.game.models.createBomber();
        }

        mesh.position.set(data.pos.x, data.pos.y, data.pos.z);
        mesh.quaternion.set(data.quat.x, data.quat.y, data.quat.z, data.quat.w);
        this.game.scene.add(mesh);

        this.remotePlayers.set(data.id, {
            mesh: mesh,
            targetPos: new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z),
            targetQuat: new THREE.Quaternion(data.quat.x, data.quat.y, data.quat.z, data.quat.w),
            team: data.team,
            name: data.name,
            speed: data.speed || 0,
            hull: data.hull || 100,
            shield: data.shield || 100
        });
    }

    removeRemotePlayer(id) {
        const rp = this.remotePlayers.get(id);
        if (rp) {
            this.game.scene.remove(rp.mesh);
            this.remotePlayers.delete(id);
            this.game.showCombatBanner(`플레이어 [${rp.name}] 님이 퇴장했습니다.`);
        }
    }

    // Render Laser Shot by another player
    renderRemoteLaser(msg) {
        const origin = new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z);
        const dir = new THREE.Vector3(msg.dir.x, msg.dir.y, msg.dir.z).normalize();

        const boltGeo = new THREE.CylinderGeometry(0.35, 0.35, 10, 6);
        boltGeo.rotateX(Math.PI / 2);
        const boltMat = new THREE.MeshBasicMaterial({
            color: msg.team === 'DEFENSE' ? 0x00f0ff : 0xff1144
        });
        const mesh = new THREE.Mesh(boltGeo, boltMat);

        mesh.position.copy(origin);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        this.game.scene.add(mesh);

        if (msg.team === this.myTeam) {
            this.game.playerLasers.push({
                mesh: mesh,
                vel: dir.multiplyScalar(460),
                life: 1.8,
                damage: msg.damage || 25
            });
        } else {
            this.game.enemyLasers.push({
                mesh: mesh,
                vel: dir.multiplyScalar(350),
                life: 2.2,
                damage: msg.damage || 20
            });
        }

        if (window.soundFX) {
            if (msg.team === 'DEFENSE') window.soundFX.laser();
            else window.soundFX.enemyLaser();
        }
    }

    // Render Missile / Torpedo launched by another player
    renderRemoteMissile(msg) {
        const origin = new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z);
        const dir = new THREE.Vector3(msg.dir.x, msg.dir.y, msg.dir.z).normalize();
        const isEnemy = msg.team !== this.myTeam;

        const mesh = this.game.models.createMissile(isEnemy);
        mesh.position.copy(origin);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        if (msg.isTorpedo) mesh.scale.set(1.5, 1.5, 1.5);
        this.game.scene.add(mesh);

        this.game.missiles.push({
            isEnemy: isEnemy,
            mesh: mesh,
            vel: dir.multiplyScalar(msg.isTorpedo ? 130 : 260),
            speed: msg.isTorpedo ? 130 : 260,
            turnRate: msg.isTorpedo ? 1.8 : 4.0,
            targetPos: msg.targetPos ? new THREE.Vector3(msg.targetPos.x, msg.targetPos.y, msg.targetPos.z) : null,
            life: msg.isTorpedo ? 14.0 : 6.0,
            damage: msg.damage || (msg.isTorpedo ? 160 : 200),
            isTorpedo: !!msg.isTorpedo
        });

        if (window.soundFX) window.soundFX.missileLaunch();
    }

    // Send Local Player Movement Update
    update(dt) {
        // Interpolate remote players smoothly at 60fps
        this.remotePlayers.forEach(rp => {
            rp.mesh.position.lerp(rp.targetPos, dt * 12);
            rp.mesh.quaternion.slerp(rp.targetQuat, dt * 12);

            // Engine thruster particles for remote players
            if (rp.speed > 5) {
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rp.mesh.quaternion);
                const col = rp.team === 'DEFENSE' ? 0x00f0ff : 0xff4400;
                this.game.particles.spawnThrusterParticle(rp.mesh.position, forward, col, 3);
            }
        });

        // Send local player state to server at 30Hz
        if (this.connected && this.game.player) {
            this.sendMoveTimer += dt;
            if (this.sendMoveTimer >= this.sendMoveInterval) {
                this.sendMoveTimer = 0;
                this.send({
                    type: 'MOVE',
                    pos: {
                        x: Math.round(this.game.player.position.x * 10) / 10,
                        y: Math.round(this.game.player.position.y * 10) / 10,
                        z: Math.round(this.game.player.position.z * 10) / 10
                    },
                    quat: {
                        x: this.game.player.quaternion.x,
                        y: this.game.player.quaternion.y,
                        z: this.game.player.quaternion.z,
                        w: this.game.player.quaternion.w
                    },
                    speed: Math.round(this.game.playerStats.speed),
                    hull: Math.round(this.game.playerStats.hull),
                    shield: Math.round(this.game.playerStats.shield)
                });
            }
        }
    }

    // Client action dispatchers
    broadcastLaser(origin, dir, damage) {
        if (!this.connected) return;
        this.send({
            type: 'FIRE_LASER',
            origin: { x: origin.x, y: origin.y, z: origin.z },
            dir: { x: dir.x, y: dir.y, z: dir.z },
            damage: damage
        });
    }

    broadcastMissile(origin, dir, isTorpedo, targetPos, damage) {
        if (!this.connected) return;
        this.send({
            type: 'FIRE_MISSILE',
            origin: { x: origin.x, y: origin.y, z: origin.z },
            dir: { x: dir.x, y: dir.y, z: dir.z },
            isTorpedo: isTorpedo,
            targetPos: targetPos ? { x: targetPos.x, y: targetPos.y, z: targetPos.z } : null,
            damage: damage
        });
    }

    broadcastDamageBase(amount) {
        if (!this.connected) return;
        this.send({
            type: 'DAMAGE_BASE',
            amount: amount
        });
    }

    broadcastRepairBase(amount) {
        if (!this.connected) return;
        this.send({
            type: 'REPAIR_BASE',
            amount: amount
        });
    }

    broadcastEMP(origin, radius) {
        if (!this.connected) return;
        this.send({
            type: 'EMP_BLAST',
            origin: { x: origin.x, y: origin.y, z: origin.z },
            radius: radius
        });
    }

    updateRoomDisplay() {
        const roomEl = document.getElementById('room-code-display');
        if (roomEl) {
            const isPublic = !this.roomCode || this.roomCode === 'PUBLIC';
            const label = isPublic ? '🌐 공개 매치 (PUBLIC)' : `🔑 방 코드: ${this.roomCode}`;
            const role = this.isHost ? ' · 👑 방장' : '';
            roomEl.textContent = `${label}${role} · 👥 ${this.roomPlayerCount}명`;
            roomEl.classList.remove('hidden');
        }
    }

    updatePlayerCountsUI(data) {
        if (data.room) {
            this.roomPlayerCount = data.total;
            this.updateRoomDisplay();
        }
        // Update online player counter on start screen
        const totalEl = document.getElementById('online-player-total');
        const defenseEl = document.getElementById('online-defense-count');
        const attackEl = document.getElementById('online-attack-count');

        if (totalEl) totalEl.textContent = data.total;
        if (defenseEl) defenseEl.textContent = data.defense;
        if (attackEl) attackEl.textContent = data.attack;

        // Also update in-game overlay if it exists
        const inGameCounter = document.getElementById('in-game-player-counts');
        if (inGameCounter) {
            inGameCounter.innerHTML = `
                <div style="font-size: 14px;">
                    🛡️ Defense: <span style="color: #00f0ff;">${data.defense}</span> &nbsp;
                    ⚔️ Attack: <span style="color: #ff1144;">${data.attack}</span>
                </div>
            `;
        }
    }
}

window.NetworkManager = NetworkManager;
