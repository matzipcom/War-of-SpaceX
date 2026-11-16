// Core Game Engine for War of SpaceX
// Complete 3D Space Flight, Base Defense, Combat, and Repair Mechanics

class Game {
    constructor() {
        this.state = 'START'; // START, PLAYING, PAUSED, GAMEOVER, VICTORY
        this.cameraMode = 'CHASE'; // CHASE, COCKPIT

        // Scene, Camera, Renderer
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x040812, 0.0003);

        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 7000);
        this.fov = 65;
        this.targetFov = 65;
        this.minFov = 35; // Zoom-in (telescopic / precision focus)
        this.maxFov = 110; // Zoom-out (wide-angle situational awareness)
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        // Subsystems
        this.models = new SpaceModels();
        this.particles = new ParticleSystem(this.scene);
        this.environment = this.models.createSpaceEnvironment(this.scene);

        // Entities
        this.player = null;
        this.dataCenter = null;
        this.enemies = [];
        this.playerLasers = [];
        this.enemyLasers = [];
        this.missiles = []; // both player and enemy torpedoes
        this.satellites = [];
        this.pickups = [];

        // Game stats & upgrades
        this.wave = 1;
        this.maxWave = 5;
        this.isWaveTransitioning = false;
        this.sessionTime = 300; // 5 minutes
        this.sessionMaxTime = 300;
        this.score = 0;
        this.credits = 0;
        this.enemiesDestroyed = 0;
        this.torpedoesIntercepted = 0;
        this.totalRepairs = 0;

        // Track stats locally
        this.playerKills = 0;
        this.totalBaseDamage = 0;

        // Multiplayer & Faction
        this.playerTeam = 'DEFENSE'; // 'DEFENSE' or 'ATTACK'
        this.network = new NetworkManager(this);

        // Player Stats
        this.playerStats = {
            maxHull: 100,
            hull: 100,
            maxShield: 100,
            shield: 100,
            speed: 0,
            maxSpeed: 85,
            boostSpeed: 140,
            acceleration: 60,
            handling: 1.8,
            boostEnergy: 100,
            maxBoostEnergy: 100,
            boostRegen: 20,
            laserDamage: 25,
            laserCooldown: 0.14,
            laserTimer: 0,
            missiles: 4,
            maxMissiles: 4,
            missileReloadTimer: 0,
            missileReloadTime: 4.0,
            empCooldown: 25,
            empTimer: 0,
            repairRate: 40, // HP per second repaired to Data Center
            repairRange: 320,
            isRepairing: false
        };

        // Upgrades Levels
        this.upgrades = {
            laser: 1,
            defense: 1,
            missiles: 1,
            repair: 1,
            satellites: 0,
            emp: 1
        };

        // Base (Data Center) Stats
        this.baseStats = {
            maxHull: 100000,
            hull: 100000,
            maxShield: 50000,
            shield: 50000,
            shieldRegenRate: 15,
            shieldRegenDelay: 8,
            lastHitTime: 0
        };

        // Controls input state
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            rollLeft: false,
            rollRight: false,
            up: false,
            down: false,
            boost: false,
            fireLaser: false,
            fireMissile: false,
            repair: false,
            mouseX: 0,
            mouseY: 0
        };

        // Clock & Delta
        this.clock = new THREE.Clock();
        this.targetEnemy = null;
        this.mouseLockedTarget = null;
        this.raycaster = new THREE.Raycaster();
        this.mouseNDC = new THREE.Vector2(0, 0);

        // Setup
        this.initEntities();
        this.initEvents();
        this.initRadar();
    }

    // Initialize 3D world entities
    initEntities() {
        // 1. Data Center (Base) at origin
        this.dataCenter = this.models.createDataCenter();
        this.dataCenter.position.set(0, 0, 0);
        this.scene.add(this.dataCenter);

        // Player physics / motion vectors
        this.playerVelocity = new THREE.Vector3();
        this.playerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.playerQuat = new THREE.Quaternion();

        // 2. Setup initial player ship
        this.setupPlayerShip('DEFENSE');
    }

    setupPlayerShip(team) {
        if (this.player) {
            this.scene.remove(this.player);
        }
        this.playerTeam = team;

        const defenseStats = document.getElementById('defense-stats');
        const attackStats = document.getElementById('attack-stats');
        const scoreboard = document.getElementById('faction-scoreboard');

        if (team === 'DEFENSE') {
            if (defenseStats) defenseStats.classList.remove('hidden');
            if (attackStats) attackStats.classList.add('hidden');
            if (scoreboard) scoreboard.style.borderColor = '#00f0ff';
            this.player = this.models.createPlayerShip();
            this.player.position.set(0, 30, 220);
            this.player.rotation.set(0, 0, 0);
            this.playerStats.laserDamage = 25;
            this.playerStats.maxSpeed = 85;
            this.playerStats.boostSpeed = 145;
            this.playerStats.maxHull = 100;
            this.playerStats.hull = 100;
        } else {
            // ATTACK: Syndicate Dread Bomber
            if (defenseStats) defenseStats.classList.add('hidden');
            if (attackStats) attackStats.classList.remove('hidden');
            if (scoreboard) scoreboard.style.borderColor = '#ff3355';
            this.player = this.models.createBomber();
            this.player.position.set(0, 40, -850);
            this.player.lookAt(0, 0, 0);
            this.playerStats.laserDamage = 38;
            this.playerStats.maxSpeed = 75;
            this.playerStats.boostSpeed = 130;
            this.playerStats.maxHull = 150;
            this.playerStats.hull = 150;
        }
        this.scene.add(this.player);
    }

    // Event listeners for keyboard, mouse, resize
    initEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Mouse controls
        window.addEventListener('mousemove', (e) => {
            if (this.state !== 'PLAYING') return;
            // Normalized NDC coords -1 to 1 for Three.js raycasting
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            this.input.mouseX = (e.clientX - cx) / cx;
            this.input.mouseY = (e.clientY - cy) / cy;
            this.mouseNDC.set(this.input.mouseX, -this.input.mouseY);

            // Directly position dynamic aim crosshair at mouse coordinates
            const crosshair = document.getElementById('crosshair');
            if (crosshair) {
                crosshair.style.left = `${e.clientX}px`;
                crosshair.style.top = `${e.clientY}px`;
                crosshair.style.transform = 'translate(-50%, -50%)';
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (window.soundFX && !window.soundFX.ctx) window.soundFX.init();
            window.soundFX.resume();

            if (this.state !== 'PLAYING') return;
            if (e.button === 0) {
                this.input.fireLaser = true;
            } else if (e.button === 2) {
                this.launchPlayerMissile();
            } else if (e.button === 1) {
                // Middle click: Reset FOV to default 65
                this.targetFov = 65;
                this.showCombatBanner('시야각(FOV) 기본값 65°로 초기화');
            }
        });

        // Mouse Wheel FOV Zoom In / Out
        window.addEventListener('wheel', (e) => {
            if (this.state !== 'PLAYING') return;
            // deltaY > 0: Wheel Down -> Increase FOV (Zoom out / Wide angle)
            // deltaY < 0: Wheel Up -> Decrease FOV (Zoom in / Precision focus)
            const fovStep = 4.0;
            if (e.deltaY < 0) {
                this.targetFov = Math.max(this.minFov, this.targetFov - fovStep);
            } else {
                this.targetFov = Math.min(this.maxFov, this.targetFov + fovStep);
            }
            this.showCombatBanner(`시야각(FOV): ${Math.round(this.targetFov)}°`);
        }, { passive: true });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.input.fireLaser = false;
            }
        });

        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            if (window.soundFX && !window.soundFX.ctx) window.soundFX.init();
            window.soundFX.resume();

            const code = e.code;
            if (code === 'KeyW') this.input.forward = true;
            if (code === 'KeyS') this.input.backward = true;
            if (code === 'KeyA') this.input.left = true;
            if (code === 'KeyD') this.input.right = true;
            if (code === 'KeyQ') this.input.rollLeft = true;
            if (code === 'KeyE') this.input.rollRight = true;
            if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.boost = true;
            if (code === 'Space') this.input.fireLaser = true;
            if (code === 'KeyC') this.input.down = true;
            if (code === 'KeyZ') this.input.up = true;
            if (code === 'KeyR') this.input.repair = true;
            if (code === 'KeyF') this.launchPlayerMissile();
            if (code === 'KeyX') this.triggerEMP();
            if (code === 'KeyV') this.toggleCameraView();
            if (code === 'KeyU') this.toggleUpgradeModal();
            if (code === 'KeyP' || code === 'Escape') this.togglePause();
            if (code === 'KeyM') this.toggleAudio();
        });

        window.addEventListener('keyup', (e) => {
            const code = e.code;
            if (code === 'KeyW') this.input.forward = false;
            if (code === 'KeyS') this.input.backward = false;
            if (code === 'KeyA') this.input.left = false;
            if (code === 'KeyD') this.input.right = false;
            if (code === 'KeyQ') this.input.rollLeft = false;
            if (code === 'KeyE') this.input.rollRight = false;
            if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.boost = false;
            if (code === 'Space') this.input.fireLaser = false;
            if (code === 'KeyC') this.input.down = false;
            if (code === 'KeyZ') this.input.up = false;
            if (code === 'KeyR') this.input.repair = false;
        });

        // UI Buttons
        document.getElementById('start-btn')?.addEventListener('click', () => this.startGame('DEFENSE'));
        document.getElementById('join-defense-btn')?.addEventListener('click', () => {
            const callsign = document.getElementById('player-callsign')?.value || 'SpaceX-Pilot';
            this.startGame('DEFENSE', callsign);
        });
        document.getElementById('join-attack-btn')?.addEventListener('click', () => {
            const callsign = document.getElementById('player-callsign')?.value || 'Void-Raider';
            this.startGame('ATTACK', callsign);
        });
        document.getElementById('restart-btn')?.addEventListener('click', () => this.restartGame());
        document.getElementById('victory-restart-btn')?.addEventListener('click', () => this.continueEndless());
        document.getElementById('resume-btn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('pause-switch-defense-btn')?.addEventListener('click', () => this.switchTeam('DEFENSE'));
        document.getElementById('pause-switch-attack-btn')?.addEventListener('click', () => this.switchTeam('ATTACK'));
        document.getElementById('open-upgrade-btn')?.addEventListener('click', () => this.toggleUpgradeModal(true));
        document.getElementById('close-upgrade-btn')?.addEventListener('click', () => this.toggleUpgradeModal(false));
        document.getElementById('sound-toggle-btn')?.addEventListener('click', () => this.toggleAudio());
        document.getElementById('repair-action-btn')?.addEventListener('mousedown', () => { this.input.repair = true; });
        document.getElementById('repair-action-btn')?.addEventListener('mouseup', () => { this.input.repair = false; });
        document.getElementById('repair-action-btn')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.repair = true; });
        document.getElementById('repair-action-btn')?.addEventListener('touchend', (e) => { e.preventDefault(); this.input.repair = false; });

        // Touch control buttons for mobile/tablet
        document.getElementById('touch-fire')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.fireLaser = true; });
        document.getElementById('touch-fire')?.addEventListener('touchend', (e) => { e.preventDefault(); this.input.fireLaser = false; });
        document.getElementById('touch-missile')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.launchPlayerMissile(); });
        document.getElementById('touch-boost')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.boost = true; });
        document.getElementById('touch-boost')?.addEventListener('touchend', (e) => { e.preventDefault(); this.input.boost = false; });
        document.getElementById('touch-emp')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.triggerEMP(); });

        document.getElementById('open-settings-btn')?.addEventListener('click', () => this.toggleSettingsModal(true));
        document.getElementById('close-settings-btn')?.addEventListener('click', () => this.applySettings());
        
        // Volume sliders live update
        ['master', 'bgm', 'sfx'].forEach(type => {
            const el = document.getElementById(`${type}-volume`);
            const valEl = document.getElementById(`${type}-volume-val`);
            if (el) el.addEventListener('input', (e) => {
                if (valEl) valEl.innerText = e.target.value + '%';
            });
        });

    // Toggle Camera View Mode
    toggleCameraView() {
        this.cameraMode = (this.cameraMode === 'CHASE') ? 'COCKPIT' : 'CHASE';
        this.showCombatBanner(this.cameraMode === 'COCKPIT' ? '조종석 1인칭 뷰 (COCKPIT CAM)' : '3인칭 추적 뷰 (CHASE CAM)');
    }

    // Toggle Sound Mute
    toggleAudio() {
        if (!window.soundFX) return;
        const enabled = window.soundFX.toggleMute();
        const btn = document.getElementById('sound-toggle-btn');
        if (btn) btn.innerText = enabled ? '🔊 사운드 ON' : '🔇 사운드 OFF';
    }

    // Toggle Settings Modal
    toggleSettingsModal(forceOpen = null) {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;
        const isOpen = !modal.classList.contains('hidden');
        const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

        if (shouldOpen) {
            modal.classList.remove('hidden');
            this.loadSettingsUI();
        } else {
            modal.classList.add('hidden');
        }
    }

    // Load settings values into modal
    loadSettingsUI() {
        const sf = window.soundFX;
        if (sf) {
            const mv = document.getElementById('master-volume');
            const bv = document.getElementById('bgm-volume');
            const sv = document.getElementById('sfx-volume');
            if (mv) mv.value = Math.round(sf.volume * 100);
            if (bv) bv.value = Math.round(sf.bgmVolume * 100);
            if (sv) sv.value = Math.round(sf.sfxVolume * 100);
            const mvVal = document.getElementById('master-volume-val');
            const bvVal = document.getElementById('bgm-volume-val');
            const svVal = document.getElementById('sfx-volume-val');
            if (mvVal) mvVal.innerText = Math.round(sf.volume * 100) + '%';
            if (bvVal) bvVal.innerText = Math.round(sf.bgmVolume * 100) + '%';
            if (svVal) svVal.innerText = Math.round(sf.sfxVolume * 100) + '%';
        }
        const lang = document.getElementById('language-select');
        if (lang) lang.value = this.currentLanguage || 'ko';
    }

    // Apply settings
    applySettings() {
        const sf = window.soundFX;
        if (sf) {
            const mv = document.getElementById('master-volume');
            const bv = document.getElementById('bgm-volume');
            const sv = document.getElementById('sfx-volume');
            if (mv) sf.setVolume(parseInt(mv.value) / 100);
            if (bv) sf.setBGMVolume(parseInt(bv.value) / 100);
            if (sv) sf.setSFXVolume(parseInt(sv.value) / 100);
        }
        const lang = document.getElementById('language-select');
        if (lang) this.setLanguage(lang.value);
        this.toggleSettingsModal(false);
        this.showCombatBanner('⚙️ 설정이 적용되었습니다!');
    }

    // Set game language
    setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('war-of-spacex-lang', lang);
        const langNames = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文' };
        this.showCombatBanner('🌐 언어가 ' + (langNames[lang] || lang) + '로 변경되었습니다.');
    }

    // Radar Minimap Setup
    initRadar() {
        this.radarCanvas = document.getElementById('radar-canvas');
        if (this.radarCanvas) {
            this.radarCtx = this.radarCanvas.getContext('2d');
        }
    }

    // Start Game from Menu with selected Faction
    startGame(team = 'DEFENSE', callsign = 'Pilot-X') {
        if (window.soundFX) window.soundFX.init();
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.state = 'PLAYING';
        this.clock.start();
        this.sessionTime = this.sessionMaxTime; // Reset 5-minute timer

        this.setupPlayerShip(team);
        this.network.connect(team, callsign);

        const repairBtn = document.getElementById('repair-action-btn');
        const missileText = document.getElementById('missile-count-text');
        const empText = document.getElementById('emp-status-text');
        const headerTitle = document.querySelector('.top-center-hud .hud-header span:first-child');

        if (team === 'ATTACK') {
            if (headerTitle) headerTitle.innerText = '🎯 머스크 우주 데이터센터 (공격 타겟)';
            if (repairBtn) repairBtn.innerText = '⚡ 데이터 코어 해킹/교란 [R]';
            if (missileText) missileText.innerText = '💣 공성 폭발 어뢰: 4 / 4';
            if (empText) empText.innerText = '클러스터 폭발탄: 준비 완료 [X]';
            this.showCombatBanner('⚔️ 신디케이트 공습 개시! 머스크 우주 데이터센터를 폭파하십시오!');
        } else {
            if (headerTitle) headerTitle.innerText = '🛰️ X 우주 데이터센터 (수호 기지)';
            if (repairBtn) repairBtn.innerText = '🔧 데이터센터 수리 빔 [R]';
            if (missileText) missileText.innerText = '🚀 호밍 미사일: 4 / 4';
            if (empText) empText.innerText = 'EMP 충격파: 준비 완료 [X]';
            this.showCombatBanner('🛡️ 머스크 우주 데이터센터 방어 시스템 가동!');
        }
    }

    // Continue / New Session (5-minute time attack mode)
    continueEndless() {
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.state = 'PLAYING';
        this.sessionTime = this.sessionMaxTime; // Reset to 5 minutes
    }

    // Restart Game (Pure 5-minute Time Attack Reset)
    restartGame() {
        // Reset state
        this.state = 'PLAYING';
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');

        // Reset session timer
        this.sessionTime = this.sessionMaxTime;

        // Clear active entities
        this.enemies.forEach(e => this.scene.remove(e.mesh));
        this.enemies = [];
        this.playerLasers.forEach(l => this.scene.remove(l.mesh));
        this.playerLasers = [];
        this.enemyLasers.forEach(l => this.scene.remove(l.mesh));
        this.enemyLasers = [];
        this.missiles.forEach(m => this.scene.remove(m.mesh));
        this.missiles = [];
        this.pickups.forEach(p => this.scene.remove(p.mesh));
        this.pickups = [];
        this.satellites.forEach(s => this.scene.remove(s.mesh));
        this.satellites = [];
        this.particles.clear();

        // Reset player & base stats
        this.wave = 1;
        this.score = 0;
        this.credits = 0;
        this.enemiesDestroyed = 0;
        this.torpedoesIntercepted = 0;
        this.totalRepairs = 0;

        this.playerStats.hull = this.playerStats.maxHull;
        this.playerStats.shield = this.playerStats.maxShield;
        this.playerStats.boostEnergy = this.playerStats.maxBoostEnergy;
        this.playerStats.missiles = this.playerStats.maxMissiles;
        this.playerStats.empTimer = 0;

        this.playerKills = 0;
        this.totalBaseDamage = 0;

        this.baseStats.hull = this.baseStats.maxHull;
        this.baseStats.shield = this.baseStats.maxShield;

        this.player.position.set(0, 30, 200);
        this.player.rotation.set(0, 0, 0);

        this.showCombatBanner('시스템 재부팅 완료. 5분 대전 준비!');
    }

    // Pause Toggle
    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.updatePauseTeamUI();
            document.getElementById('pause-screen').classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-screen').classList.add('hidden');
        }
    }

    // Switch Faction (Attack <-> Defense) during pause
    switchTeam(team) {
        if (!team || team === this.playerTeam) return;
        if (this.state !== 'PAUSED') {
            this.showCombatBanner('일시 정지 상태에서만 진영을 전환할 수 있습니다. (ESC)');
            return;
        }

        const prevTeam = this.playerTeam;
        this.setupPlayerShip(team);
        this.network.myTeam = team;

        // Update HUD texts based on new team
        this.updateTeamHUD(team);

        // Update pause screen team status text
        this.updatePauseTeamUI();

        const teamName = team === 'DEFENSE' ? '수비TEAM (DEFENSE)' : '공격TEAM (ATTACK)';
        this.showCombatBanner(`🔄 진영 전환 완료: ${prevTeam === 'DEFENSE' ? '수비' : '공격'} → ${team === 'DEFENSE' ? '수비' : '공격'}`);
    }

    // Update pause screen faction status display
    updatePauseTeamUI() {
        const statusEl = document.getElementById('pause-team-status');
        if (!statusEl) return;
        if (this.playerTeam === 'DEFENSE') {
            statusEl.innerHTML = '🛡️ 현재 진영: 수비팀 (DEFENSE) | 🛰️ X 우주 데이터센터 수호';
            statusEl.style.color = '#00e5ff';
        } else {
            statusEl.innerHTML = '⚔️ 현재 진영: 공격TEAM (ATTACK) | 💣 머스크 데이터센터 폭파';
            statusEl.style.color = '#ff3355';
        }
    }

    // Update HUD weapon labels & header based on team
    updateTeamHUD(team) {
        const headerTitle = document.querySelector('.top-center-hud .hud-header span:first-child');
        const repairBtn = document.getElementById('repair-action-btn');
        const missileText = document.getElementById('missile-count-text');
        const empText = document.getElementById('emp-status-text');

        if (team === 'ATTACK') {
            if (headerTitle) headerTitle.innerText = '🎯 머스크 우주 데이터센터 (공격 타겟)';
            if (repairBtn) repairBtn.innerText = '⚡ 데이터 코어 해킹/교란 [R]';
            if (missileText) missileText.innerText = '💣 공성 폭발 어pedo: 4 / 4';
            if (empText) empText.innerText = '클러스터 폭발탄: 준비 완료 [X]';
        } else {
            if (headerTitle) headerTitle.innerText = '🛰️ X 우주 데이터센터 (수호 기지)';
            if (repairBtn) repairBtn.innerText = '🔧 데이터센터 수리 빔 [R]';
            if (missileText) missileText.innerText = '🚀 호밍 미사일: 4 / 4';
            if (empText) empText.innerText = 'EMP 충격파: 준비 완료 [X]';
        }
    }

    // Upgrade Modal Toggle
    toggleUpgradeModal(forceOpen = null) {
        const modal = document.getElementById('upgrade-modal');
        if (!modal) return;
        const isOpen = !modal.classList.contains('hidden');
        const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

        if (shouldOpen) {
            modal.classList.remove('hidden');
            this.updateUpgradeShopUI();
        } else {
            modal.classList.add('hidden');
        }
    }

    // Spawn Waves of Syndicate Attackers (Removed for pure PVP)
    spawnWave(waveNum) {
    }

    // Spawn Individual Enemy (Removed for pure PVP)
    spawnEnemy(type, distance = 700, isElite = false) {
    }

    // Calculate 3D World Aim Point based on Mouse Cursor Position
    getAimTarget() {
        this.raycaster.setFromCamera(this.mouseNDC, this.camera);

        // Check if cursor ray is near any hostile target (aim assist / target locking)
        let lockedTarget = null;
        let closestDist = Infinity;

        // 1. Check enemy ships
        for (let e of this.enemies) {
            const hitRadius = e.type === 'BOSS' ? 70 : (e.type === 'BOMBER' ? 32 : 18);
            const distToRay = this.raycaster.ray.distanceToPoint(e.mesh.position);
            if (distToRay < hitRadius + 22) {
                const distToCam = e.mesh.position.distanceTo(this.camera.position);
                if (distToCam < closestDist) {
                    closestDist = distToCam;
                    lockedTarget = {
                        point: e.mesh.position.clone(),
                        enemy: e,
                        dist: distToCam
                    };
                }
            }
        }

        // 2. Check enemy explosive torpedoes
        for (let m of this.missiles) {
            if (m.isEnemy) {
                const distToRay = this.raycaster.ray.distanceToPoint(m.mesh.position);
                if (distToRay < 24) {
                    const distToCam = m.mesh.position.distanceTo(this.camera.position);
                    if (distToCam < closestDist) {
                        closestDist = distToCam;
                        lockedTarget = {
                            point: m.mesh.position.clone(),
                            missile: m,
                            dist: distToCam
                        };
                    }
                }
            }
        }

        this.mouseLockedTarget = lockedTarget;

        if (lockedTarget) {
            return lockedTarget.point;
        }

        // Default: 800 units along the mouse ray in 3D world space
        return this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(800));
    }

    // Launch Player Laser Bolts towards Mouse Aim Target
    firePlayerLaser() {
        if (this.playerStats.laserTimer > 0) return;
        this.playerStats.laserTimer = this.playerStats.laserCooldown;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.player.quaternion);
        const aimTarget = this.getAimTarget();
        const isAttack = this.playerTeam === 'ATTACK';
        const laserColor = isAttack ? 0xff1144 : 0x00f0ff;
        const damage = isAttack ? 38 : this.playerStats.laserDamage;

        // Twin wingtip blaster positions
        [-14, 14].forEach(offset => {
            const spawnPos = this.player.position.clone()
                .add(right.clone().multiplyScalar(offset))
                .add(forward.clone().multiplyScalar(5));

            // Direction vector pointing forward from player (ignoring mouse aim for straight fire)
            const shootDir = forward.clone();

            const boltGeo = new THREE.CylinderGeometry(0.35, 0.35, 10, 6);
            boltGeo.rotateX(Math.PI / 2);
            const boltMat = new THREE.MeshBasicMaterial({ color: laserColor });
            const mesh = new THREE.Mesh(boltGeo, boltMat);

            mesh.position.copy(spawnPos);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), shootDir);
            this.scene.add(mesh);

            this.playerLasers.push({
                mesh: mesh,
                vel: shootDir.multiplyScalar(460).add(this.playerVelocity.clone().multiplyScalar(0.3)),
                life: 1.8,
                damage: damage,
                isAttackLaser: isAttack
            });

            if (this.network) {
                this.network.broadcastLaser(spawnPos, shootDir, damage);
            }
        });

        if (window.soundFX) {
            if (isAttack) window.soundFX.enemyLaser();
            else window.soundFX.laser();
        }
    }

    // Launch Player Missile / Siege Torpedo
    launchPlayerMissile() {
        if (this.playerStats.missiles <= 0) {
            this.showCombatBanner('미사일 재장전 중 (RELOADING)...');
            return;
        }

        this.playerStats.missiles--;
        this.updateMissileHUD();

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);

        if (this.playerTeam === 'ATTACK') {
            // ATTACK TEAM: Launch Heavy Orbital Siege Torpedo targeting Data Center!
            const mesh = this.models.createMissile(true);
            mesh.position.copy(this.player.position).add(forward.clone().multiplyScalar(10));
            mesh.quaternion.copy(this.player.quaternion);
            mesh.scale.set(1.6, 1.6, 1.6);
            this.scene.add(mesh);

            this.missiles.push({
                isEnemy: true,
                isPlayerAttackTorpedo: true,
                mesh: mesh,
                vel: forward.clone().multiplyScalar(110),
                speed: 140,
                turnRate: 2.0,
                targetPos: new THREE.Vector3(0, 0, 0),
                life: 16.0,
                damage: 220,
                isTorpedo: true
            });

            if (this.network) {
                this.network.broadcastMissile(this.player.position, forward, true, { x: 0, y: 0, z: 0 }, 220);
            }
            if (window.soundFX) window.soundFX.missileLaunch();
            this.showCombatBanner('💣 공성 대형 폭발 어뢰 발사! 데이터센터 타격 궤도 진입!');
            return;
        }

        // DEFENSE TEAM: Launch Straight Anti-Fighter Missile
        const mesh = this.models.createMissile(false);
        mesh.position.copy(this.player.position).add(forward.clone().multiplyScalar(10));
        mesh.quaternion.copy(this.player.quaternion);
        this.scene.add(mesh);

        this.missiles.push({
            isEnemy: false,
            mesh: mesh,
            vel: forward.clone().multiplyScalar(260), // Fixed straight velocity
            speed: 260,
            turnRate: 0, // No homing, straight path
            target: null,
            life: 5.0,
            damage: 220
        });

        if (this.network) {
            this.network.broadcastMissile(this.player.position, forward, false, target ? target.mesh.position : null, 220);
        }
        if (window.soundFX) window.soundFX.missileLaunch();
        this.showCombatBanner('🚀 호밍 미사일 발사!');
    }

    // Launch Enemy Explosive Torpedo targeting Musk's Data Center!
    launchEnemyTorpedo(bomber) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(bomber.mesh.quaternion);
        const mesh = this.models.createMissile(true);
        mesh.position.copy(bomber.mesh.position).add(forward.clone().multiplyScalar(8));
        mesh.quaternion.copy(bomber.mesh.quaternion);
        mesh.scale.set(1.5, 1.5, 1.5); // Heavier torpedo
        this.scene.add(mesh);

        this.missiles.push({
            isEnemy: true,
            mesh: mesh,
            vel: forward.clone().multiplyScalar(90),
            speed: 130,
            turnRate: 1.8,
            targetPos: new THREE.Vector3(0, 0, 0), // Targets Data Center!
            life: 15.0,
            damage: 160,
            isTorpedo: true
        });

        if (window.soundFX) window.soundFX.missileLaunch();
        this.showCombatBanner('⚠️ 경보: 적 공성 폭격기가 데이터센터로 폭발 탄두 발사! 요격하십시오!');
    }

    // Trigger Special Skill: EMP for Defense, Cluster Bomb for Attack
    triggerEMP() {
        if (this.playerStats.empTimer > 0) {
            this.showCombatBanner(`스킬 쿨다운 중: ${Math.ceil(this.playerStats.empTimer)}s`);
            return;
        }

        if (this.playerTeam === 'ATTACK') {
            // ATTACK: Cluster Explosive Barrage against Data Center & Defenders
            this.playerStats.empTimer = this.playerStats.empCooldown;
            this.particles.spawnExplosion(this.player.position, 2.0, true);
            if (window.soundFX) window.soundFX.explosion(true);

            // Deploy 4 explosive cluster bombs towards Data Center
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const offsetDir = new THREE.Vector3(Math.cos(angle), (Math.random() - 0.5) * 0.4, Math.sin(angle));
                const bombPos = this.player.position.clone().add(offsetDir.clone().multiplyScalar(25));

                const mesh = this.models.createMissile(true);
                mesh.position.copy(bombPos);
                this.scene.add(mesh);

                this.missiles.push({
                    isEnemy: true,
                    isPlayerAttackTorpedo: true,
                    mesh: mesh,
                    vel: this.dataCenter.position.clone().sub(bombPos).normalize().multiplyScalar(150),
                    speed: 150,
                    turnRate: 1.5,
                    targetPos: new THREE.Vector3(0, 0, 0),
                    life: 10.0,
                    damage: 130,
                    isTorpedo: true
                });
            }

            if (this.network) {
                this.network.broadcastEMP(this.player.position, 600);
            }
            this.showCombatBanner('💥 클러스터 폭발탄 4연발 살포! 데이터센터 방어막 타격!');
            return;
        }

        // DEFENSE: EMP Shockwave
        this.playerStats.empTimer = this.playerStats.empCooldown;
        this.particles.spawnEMP(this.player.position, 600);
        if (window.soundFX) window.soundFX.empBlast();
        this.showCombatBanner('⚡ EMP 파동 방출! 접근 중인 적 어뢰 폭파 및 적 함선 스턴! ⚡');

        if (this.network) {
            this.network.broadcastEMP(this.player.position, 600);
        }

        // Detonate all enemy missiles within 600 units
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            if (m.isEnemy && m.mesh.position.distanceTo(this.player.position) < 650) {
                this.particles.spawnExplosion(m.mesh.position, 1.2);
                this.scene.remove(m.mesh);
                this.missiles.splice(i, 1);
                this.torpedoesIntercepted++;
                this.credits += 30;
            }
        }

        // Stun & damage nearby enemies
        this.enemies.forEach(e => {
            const dist = e.mesh.position.distanceTo(this.player.position);
            if (dist < 600) {
                e.hp -= 50;
                e.shootTimer = 4.0; // Stun shooting
                this.particles.spawnExplosion(e.mesh.position, 0.8);
            }
        });
    }

    // Deploy / Add Starlink Defense Satellite
    addDefenseSatellite() {
        const sat = this.models.createDefenseSatellite();
        const angle = (this.satellites.length / 4) * Math.PI * 2;
        const radius = 280;
        sat.position.set(Math.cos(angle) * radius, 30, Math.sin(angle) * radius);
        this.scene.add(sat);

        this.satellites.push({
            mesh: sat,
            angle: angle,
            radius: radius,
            orbitSpeed: 0.25,
            shootTimer: 0,
            shootInterval: 1.4,
            damage: 20
        });

        if (window.soundFX) window.soundFX.upgrade();
        this.showCombatBanner(`🛰️ 스타링크 궤도 방어 위성 ${this.satellites.length}기 배치 완료!`);
    }

    // Spawn Loot Pickup when enemy dies
    spawnLoot(pos) {
        const r = Math.random();
        const type = r < 0.45 ? 'repair' : (r < 0.75 ? 'shield' : 'credit');
        const mesh = this.models.createLootPickup(type);
        mesh.position.copy(pos);
        this.scene.add(mesh);

        this.pickups.push({
            mesh: mesh,
            type: type,
            life: 25.0
        });
    }

    // Helper: Find closest enemy to player
    getClosestEnemy() {
        let closest = null;
        let minDist = Infinity;
        for (let e of this.enemies) {
            const d = e.mesh.position.distanceTo(this.player.position);
            if (d < minDist) {
                minDist = d;
                closest = e;
            }
        }
        return closest;
    }

    // Update Player Movement & Physics
    updatePlayer(dt) {
        // Boost handling
        const isBoosting = this.input.boost && this.playerStats.boostEnergy > 0;
        if (isBoosting) {
            this.playerStats.boostEnergy = Math.max(0, this.playerStats.boostEnergy - 35 * dt);
        } else {
            this.playerStats.boostEnergy = Math.min(this.playerStats.maxBoostEnergy, this.playerStats.boostEnergy + this.playerStats.boostRegen * dt);
        }

        const maxSpd = isBoosting ? this.playerStats.boostSpeed : this.playerStats.maxSpeed;

        // Acceleration / Deceleration & Newtonian Physics with Inertia & Momentum
        const targetEnginePower = this.input.forward ? maxSpd : (this.input.backward ? -25 : 0);
        if (!this.playerStats.throttle) this.playerStats.throttle = 0;
        this.playerStats.throttle = THREE.MathUtils.lerp(this.playerStats.throttle, targetEnginePower, dt * (this.input.forward ? 1.5 : 2.2));
        this.playerStats.speed = this.playerStats.throttle;

        // Mouse Pitch and Yaw rotation with realistic weight & inertia
        const deadzone = 0.04;
        let pitchInput = 0;
        let yawInput = 0;

        if (Math.abs(this.input.mouseY) > deadzone) {
            pitchInput = -this.input.mouseY * this.playerStats.handling * dt * 1.3;
        }
        if (Math.abs(this.input.mouseX) > deadzone) {
            yawInput = -this.input.mouseX * this.playerStats.handling * dt * 1.3;
        }

        // Keyboard roll
        let rollInput = 0;
        if (this.input.rollLeft) rollInput += 3.5 * dt;
        if (this.input.rollRight) rollInput -= 3.5 * dt;

        // Auto bank roll into yaw turns for immersive arcade-spaceflight feel
        const autoBank = -this.input.mouseX * 0.6;
        const totalRoll = rollInput + autoBank * dt * 5.0;

        // Rotate player with Quaternions (prevents gimbal lock in 3D space)
        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchInput);
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawInput);
        const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), totalRoll);

        this.player.quaternion.multiply(qYaw).multiply(qPitch).multiply(qRoll);

        // Forward motion vectors
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.player.quaternion);

        // Newtonian Drift / Momentum Physics: Velocity vector smoothly adapts to ship facing direction with weight and inertia (Pure forward flight)
        const desiredVelocity = forward.clone().multiplyScalar(this.playerStats.speed);
        if (!this.playerVelocity) this.playerVelocity = new THREE.Vector3();
        this.playerVelocity.lerp(desiredVelocity, dt * 2.5);

        this.player.position.addScaledVector(this.playerVelocity, dt);

        // Update Environment (Near stars move towards player to simulate speed)
        const nearStars = this.environment.nearStars;
        if (nearStars) {
            const posAttr = nearStars.geometry.attributes.position;
            const speedFactor = Math.max(1, this.playerStats.speed * 0.2);
            for (let i = 0; i < posAttr.count; i++) {
                posAttr.setZ(i, posAttr.getZ(i) + speedFactor * dt * 10);
                if (posAttr.getZ(i) > 700) {
                    posAttr.setZ(i, -700);
                }
            }
            posAttr.needsUpdate = true;
        }

        // Keep player within combat engagement sphere (radius: 2000)
        const distFromCenter = this.player.position.length();
        if (distFromCenter > 2200) {
            const pullBack = this.player.position.clone().negate().normalize().multiplyScalar(40 * dt);
            this.player.position.add(pullBack);
            this.showCombatBanner('⚠️ 전장 경계 이탈 주의! 중앙 데이터센터로 복귀하십시오!');
        }

        // Thruster particle trails
        if (this.playerStats.speed > 5) {
            const leftNozzlePos = this.player.position.clone().add(right.clone().multiplyScalar(-2)).add(forward.clone().multiplyScalar(-10));
            const rightNozzlePos = this.player.position.clone().add(right.clone().multiplyScalar(2)).add(forward.clone().multiplyScalar(-10));
            const pColor = isBoosting ? 0x00f0ff : 0x0088ff;
            const pSize = isBoosting ? 5 : 3;

            this.particles.spawnThrusterParticle(leftNozzlePos, forward, pColor, pSize);
            this.particles.spawnThrusterParticle(rightNozzlePos, forward, pColor, pSize);
        }

        if (window.soundFX) {
            window.soundFX.updateThruster(Math.abs(this.playerStats.speed) / this.playerStats.maxSpeed, isBoosting);
        }

        // Firing Weapons
        if (this.playerStats.laserTimer > 0) this.playerStats.laserTimer -= dt;
        if (this.input.fireLaser) {
            this.firePlayerLaser();
        }

        // Missile reload
        if (this.playerStats.missiles < this.playerStats.maxMissiles) {
            this.playerStats.missileReloadTimer += dt;
            if (this.playerStats.missileReloadTimer >= this.playerStats.missileReloadTime) {
                this.playerStats.missiles++;
                this.playerStats.missileReloadTimer = 0;
                this.updateMissileHUD();
            }
        }

        // EMP cooldown
        if (this.playerStats.empTimer > 0) {
            this.playerStats.empTimer = Math.max(0, this.playerStats.empTimer - dt);
        }

        // Player Shield Slow Regeneration
        if (this.playerStats.shield < this.playerStats.maxShield) {
            this.playerStats.shield = Math.min(this.playerStats.maxShield, this.playerStats.shield + 8 * dt);
        }

        // Data Center Repair Mechanic
        this.handleDataCenterRepair(dt);

        // Update Camera
        this.updateCamera(dt, autoBank);
    }

    // Camera follow logic
    updateCamera(dt, autoBank) {
        // Smooth FOV zoom transition
        if (Math.abs(this.camera.fov - this.targetFov) > 0.05) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, dt * 10);
            this.camera.updateProjectionMatrix();
        }

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.player.quaternion);

        if (this.cameraMode === 'CHASE') {
            const targetCamPos = this.player.position.clone()
                .add(forward.clone().multiplyScalar(-32))
                .add(up.clone().multiplyScalar(9));

            this.camera.position.lerp(targetCamPos, dt * 14);
            const lookTarget = this.player.position.clone().add(forward.clone().multiplyScalar(60));
            this.camera.lookAt(lookTarget);
            this.camera.up.copy(up);
        } else {
            // First Person Cockpit Cam
            const cockpitPos = this.player.position.clone()
                .add(forward.clone().multiplyScalar(1.5))
                .add(up.clone().multiplyScalar(2.0));

            this.camera.position.copy(cockpitPos);
            const lookTarget = this.player.position.clone().add(forward.clone().multiplyScalar(100));
            this.camera.lookAt(lookTarget);
            this.camera.up.copy(up);
        }
    }

    // Data Center Interaction: Repair for Defense / Sabotage for Attack
    handleDataCenterRepair(dt) {
        const distToBase = this.player.position.distanceTo(this.dataCenter.position);
        const inRepairRange = distToBase <= this.playerStats.repairRange;
        const promptEl = document.getElementById('repair-prompt');
        const actionBtn = document.getElementById('repair-action-btn');

        if (inRepairRange) {
            if (this.playerTeam === 'ATTACK') {
                // ATTACK TEAM: Sabotage & Siphon Energy
                if (promptEl) {
                    promptEl.classList.remove('hidden');
                    promptEl.innerText = '⚡ 기지 침투 완료! [R] 키를 눌러 데이터센터 쉴드 해킹 & 자원 약탈!';
                    promptEl.style.borderColor = '#ff3355';
                    promptEl.style.color = '#ff3355';
                }
                if (actionBtn) actionBtn.classList.remove('disabled');

                if (this.input.repair) {
                    const dmg = 35 * dt;
                    if (this.baseStats.shield > 0) {
                        this.baseStats.shield = Math.max(0, this.baseStats.shield - dmg);
                    } else {
                        this.baseStats.hull = Math.max(0, this.baseStats.hull - dmg);
                    }
                    this.credits += Math.floor(20 * dt);
                    this.particles.spawnExplosion(this.player.position, 0.2);

                    if (this.network) this.network.broadcastDamageBase(dmg);
                    if (window.soundFX) window.soundFX.setRepairBeamActive(true);
                    this.playerStats.isRepairing = true;
                } else {
                    if (this.playerStats.isRepairing) {
                        this.playerStats.isRepairing = false;
                        if (window.soundFX) window.soundFX.setRepairBeamActive(false);
                    }
                }
            } else {
                // DEFENSE TEAM: Nanite Repair Beam
                if (promptEl) {
                    promptEl.classList.remove('hidden');
                    promptEl.innerText = '✨ 수리 구역 진입 완료! [R] 키를 눌러 데이터센터를 복구하십시오! ✨';
                    promptEl.style.borderColor = '#00ff88';
                    promptEl.style.color = '#00ff88';
                }
                if (actionBtn) actionBtn.classList.remove('disabled');

                if (this.input.repair && this.baseStats.hull < this.baseStats.maxHull) {
                    const healAmt = this.playerStats.repairRate * dt;
                    this.baseStats.hull = Math.min(this.baseStats.maxHull, this.baseStats.hull + healAmt);
                    this.totalRepairs += healAmt;
                    this.credits += Math.floor(healAmt * 0.5);

                    this.particles.spawnRepairStream(this.player.position, this.dataCenter.position);
                    if (window.soundFX) window.soundFX.setRepairBeamActive(true);
                    if (this.network) this.network.broadcastRepairBase(healAmt);

                    this.playerStats.isRepairing = true;
                } else {
                    if (this.playerStats.isRepairing) {
                        this.playerStats.isRepairing = false;
                        if (window.soundFX) window.soundFX.setRepairBeamActive(false);
                    }
                }
            }
        } else {
            if (promptEl) promptEl.classList.add('hidden');
            if (actionBtn) actionBtn.classList.add('disabled');
            if (this.playerStats.isRepairing) {
                this.playerStats.isRepairing = false;
                if (window.soundFX) window.soundFX.setRepairBeamActive(false);
            }
        }
    }

    // Update Data Center Base
    updateDataCenter(dt) {
        // Rotate rings & elements
        if (this.dataCenter.compRing) this.dataCenter.compRing.rotation.z += 0.4 * dt;
        if (this.dataCenter.compRing2) this.dataCenter.compRing2.rotation.z -= 0.25 * dt;
        if (this.dataCenter.xLogo) this.dataCenter.xLogo.rotation.y += 0.3 * dt;
        if (this.dataCenter.dockRing) this.dataCenter.dockRing.rotation.z += 0.15 * dt;

        // Shield regeneration after delay
        const now = this.clock.getElapsedTime();
        if (now - this.baseStats.lastHitTime > this.baseStats.shieldRegenDelay) {
            if (this.baseStats.shield < this.baseStats.maxShield) {
                this.baseStats.shield = Math.min(this.baseStats.maxShield, this.baseStats.shield + this.baseStats.shieldRegenRate * dt);
            }
        }

        // Auto-Hull Regeneration: 1000 HP per 10 seconds (100 HP per second)
        if (this.baseStats.hull < this.baseStats.maxHull) {
            this.baseStats.hull = Math.min(this.baseStats.maxHull, this.baseStats.hull + 100 * dt);
        }

        // Pulse shield opacity based on shield strength
        if (this.dataCenter.shieldMesh) {
            const shieldRatio = this.baseStats.shield / this.baseStats.maxShield;
            this.dataCenter.shieldMesh.material.opacity = 0.08 + shieldRatio * 0.15;
        }

        // Check base destruction
        if (this.baseStats.hull <= 0 && this.state === 'PLAYING') {
            if (this.playerTeam === 'ATTACK') {
                this.victory('머스크 우주 데이터센터 완전 폭파 성공! 신디케이트 공습 함대의 완전한 승리!');
            } else {
                this.gameOver('머스크 우주 데이터센터가 파괴되었습니다. 인류의 우주 슈퍼컴퓨팅 네트워크가 붕괴했습니다.');
            }
        }
    }

    // Update Starlink Defense Satellites
    updateSatellites(dt) {
        this.satellites.forEach(sat => {
            sat.angle += sat.orbitSpeed * dt;
            sat.mesh.position.set(
                Math.cos(sat.angle) * sat.radius,
                30 + Math.sin(sat.angle * 2) * 20,
                Math.sin(sat.angle) * sat.radius
            );
            sat.mesh.rotation.y += 0.5 * dt;

            // Automated fire at closest enemy within range
            sat.shootTimer += dt;
            if (sat.shootTimer >= sat.shootInterval) {
                let nearest = null;
                let minDist = 380;
                for (let e of this.enemies) {
                    const d = e.mesh.position.distanceTo(sat.mesh.position);
                    if (d < minDist) {
                        minDist = d;
                        nearest = e;
                    }
                }

                if (nearest) {
                    sat.shootTimer = 0;
                    sat.mesh.lookAt(nearest.mesh.position);

                    const dir = nearest.mesh.position.clone().sub(sat.mesh.position).normalize();
                    const boltGeo = new THREE.CylinderGeometry(0.3, 0.3, 8, 6);
                    boltGeo.rotateX(Math.PI / 2);
                    const boltMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
                    const mesh = new THREE.Mesh(boltGeo, boltMat);
                    mesh.position.copy(sat.mesh.position);
                    mesh.quaternion.copy(sat.mesh.quaternion);
                    this.scene.add(mesh);

                    this.playerLasers.push({
                        mesh: mesh,
                        vel: dir.multiplyScalar(400),
                        life: 1.2,
                        damage: sat.damage
                    });

                    if (window.soundFX) window.soundFX.laser();
                }
            }
        });
    }

    // Update Enemies AI & Combat (Removed for pure PVP)
    updateEnemies(dt) {
    }

    // Spawn Enemy Laser Bolt
    spawnEnemyLaser(pos, forward, damage = 15) {
        const boltGeo = new THREE.CylinderGeometry(0.4, 0.4, 10, 6);
        boltGeo.rotateX(Math.PI / 2);
        const boltMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
        const mesh = new THREE.Mesh(boltGeo, boltMat);

        mesh.position.copy(pos);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward);
        this.scene.add(mesh);

        this.enemyLasers.push({
            mesh: mesh,
            vel: forward.clone().multiplyScalar(320),
            life: 2.2,
            damage: damage
        });

        if (window.soundFX) window.soundFX.enemyLaser();
    }

    // Update Player & Enemy Lasers
    updateLasers(dt) {
        // 1. Player Lasers
        for (let i = this.playerLasers.length - 1; i >= 0; i--) {
            const l = this.playerLasers[i];
            l.life -= dt;
            l.mesh.position.addScaledVector(l.vel, dt);

            let hit = false;

            // Check hit against enemies
            for (let e of this.enemies) {
                const hitRadius = e.type === 'BOSS' ? 70 : (e.type === 'BOMBER' ? 24 : 15);
                if (l.mesh.position.distanceTo(e.mesh.position) < hitRadius) {
                    e.hp -= l.damage;
                    hit = true;
                    this.particles.spawnExplosion(l.mesh.position, 0.35);
                    if (window.soundFX) window.soundFX.shieldHit();
                    break;
                }
            }

            // Check hit against Data Center if player is on ATTACK team
            if (!hit && this.playerTeam === 'ATTACK' && l.mesh.position.distanceTo(this.dataCenter.position) < 115) {
                hit = true;
                this.damageDataCenter(l.damage);
                if (this.network) this.network.broadcastDamageBase(l.damage);
                this.particles.spawnExplosion(l.mesh.position, 0.45);
            }

            // Check hit against remote human players
            if (!hit && this.network) {
                for (const [id, rp] of this.network.remotePlayers) {
                    if (rp.team !== this.playerTeam && l.mesh.position.distanceTo(rp.mesh.position) < 18) {
                        hit = true;
                        this.particles.spawnExplosion(l.mesh.position, 0.6);
                        if (window.soundFX) window.soundFX.shieldHit();
                        this.network.send({
                            type: 'HIT_PLAYER',
                            targetId: id,
                            damage: l.damage
                        });
                        this.credits += 25;
                        this.score += 250;
                        if (this.playerTeam === 'DEFENSE') {
                            this.playerKills++;
                        }
                        this.showCombatBanner(`적 플레이어 [${rp.name}] 명중! +$25`);
                        break;
                    }
                }
            }

            // Check hit against enemy torpedoes (interception!)
            if (!hit) {
                for (let j = this.missiles.length - 1; j >= 0; j--) {
                    const m = this.missiles[j];
                    if (m.isEnemy && l.mesh.position.distanceTo(m.mesh.position) < 14) {
                        hit = true;
                        this.particles.spawnExplosion(m.mesh.position, 1.2);
                        if (window.soundFX) window.soundFX.explosion(true);
                        this.scene.remove(m.mesh);
                        this.missiles.splice(j, 1);
                        this.torpedoesIntercepted++;
                        this.credits += 40;
                        this.score += 300;
                        this.showCombatBanner('🎯 적 어뢰 요격 성공! (TORPEDO INTERCEPTED) +$40');
                        break;
                    }
                }
            }

            if (hit || l.life <= 0) {
                this.scene.remove(l.mesh);
                l.mesh.geometry.dispose();
                this.playerLasers.splice(i, 1);
            }
        }

        // 2. Enemy Lasers
        for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
            const l = this.enemyLasers[i];
            l.life -= dt;
            l.mesh.position.addScaledVector(l.vel, dt);

            let hit = false;

            // Hit Player
            if (l.mesh.position.distanceTo(this.player.position) < 12) {
                hit = true;
                this.damagePlayer(l.damage);
            }

            // Hit Data Center
            if (!hit && l.mesh.position.distanceTo(this.dataCenter.position) < 110) {
                hit = true;
                this.damageDataCenter(l.damage);
            }

            if (hit || l.life <= 0) {
                this.scene.remove(l.mesh);
                l.mesh.geometry.dispose();
                this.enemyLasers.splice(i, 1);
            }
        }
    }

    // Update Missiles & Torpedoes
    updateMissiles(dt) {
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            m.life -= dt;

            // Determine Target Position
            let targetPos = null;
            if (m.isEnemy) {
                targetPos = this.dataCenter.position;
            } else {
                if (m.target && m.target.hp > 0) {
                    targetPos = m.target.mesh.position;
                }
            }

            // Homing steering (Only for enemy missiles/torpedoes)
            if (m.isEnemy && targetPos) {
                const desired = targetPos.clone().sub(m.mesh.position).normalize().multiplyScalar(m.speed);
                m.vel.lerp(desired, dt * m.turnRate);
                m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), m.vel.clone().normalize());
            }

            m.mesh.position.addScaledVector(m.vel, dt);

            // Smoke trail particle
            const forward = m.vel.clone().normalize();
            this.particles.spawnThrusterParticle(
                m.mesh.position,
                forward,
                m.isEnemy ? 0xff4400 : 0x00f0ff,
                m.isTorpedo ? 5 : 3
            );

            let exploded = false;

            // Check Torpedo impact on Data Center
            if (m.isEnemy) {
                if (m.mesh.position.distanceTo(this.dataCenter.position) < 90) {
                    exploded = true;
                    this.damageDataCenter(m.damage);
                    this.particles.spawnExplosion(m.mesh.position, 2.5, true);
                    if (window.soundFX) window.soundFX.explosion(true);
                    this.showCombatBanner('💥 경보: 폭발 탄두가 데이터센터에 직격했습니다!');
                }
            } else {
                // Check player missile impact on enemies
                for (let e of this.enemies) {
                    const hitRad = e.type === 'BOSS' ? 65 : (e.type === 'BOMBER' ? 24 : 14);
                    if (m.mesh.position.distanceTo(e.mesh.position) < hitRad) {
                        exploded = true;
                        e.hp -= m.damage;
                        this.particles.spawnExplosion(m.mesh.position, 1.6);
                        if (window.soundFX) window.soundFX.explosion(true);
                        break;
                    }
                }
            }

            if (exploded || m.life <= 0) {
                this.scene.remove(m.mesh);
                this.missiles.splice(i, 1);
            }
        }
    }

    // Damage Player Ship
    damagePlayer(amount) {
        if (this.playerStats.shield > 0) {
            this.playerStats.shield = Math.max(0, this.playerStats.shield - amount);
            if (this.player.shieldMesh) {
                this.player.shieldMesh.material.opacity = 0.6;
                setTimeout(() => { if (this.player.shieldMesh) this.player.shieldMesh.material.opacity = 0; }, 120);
            }
            if (window.soundFX) window.soundFX.shieldHit();
        } else {
            this.playerStats.hull = Math.max(0, this.playerStats.hull - amount);
            this.particles.spawnExplosion(this.player.position, 0.6);
            if (window.soundFX) window.soundFX.explosion(false);
        }

        if (this.playerStats.hull <= 0 && this.state === 'PLAYING') {
            this.gameOver('플레이어 함선이 파괴되었습니다.');
        }
    }

    // Damage Musk's Data Center Base
    damageDataCenter(amount) {
        this.baseStats.lastHitTime = this.clock.getElapsedTime();
        this.totalBaseDamage += amount;

        if (this.baseStats.shield > 0) {
            this.baseStats.shield = Math.max(0, this.baseStats.shield - amount);
            if (this.dataCenter.shieldMesh) {
                this.dataCenter.shieldMesh.material.opacity = 0.5;
                setTimeout(() => {
                    if (this.dataCenter.shieldMesh) this.dataCenter.shieldMesh.material.opacity = 0.2;
                }, 150);
            }
            if (window.soundFX) window.soundFX.shieldHit();
        } else {
            this.baseStats.hull = Math.max(0, this.baseStats.hull - amount);
            this.particles.spawnExplosion(this.dataCenter.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50)), 1.2, true);
            if (window.soundFX) window.soundFX.explosion(true);
            if (window.soundFX) window.soundFX.alarm();
        }
    }

    // Update Loot Pickups
    updatePickups(dt) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.life -= dt;
            p.mesh.rotation.x += 1.5 * dt;
            p.mesh.rotation.y += 2.0 * dt;

            // Magnet pull to player when close
            const dist = p.mesh.position.distanceTo(this.player.position);
            if (dist < 120) {
                const pullDir = this.player.position.clone().sub(p.mesh.position).normalize();
                p.mesh.position.addScaledVector(pullDir, 180 * dt);
            }

            // Collected by player
            if (dist < 18) {
                if (p.type === 'repair') {
                    // Repair Nanites: heals Data Center + Player
                    this.baseStats.hull = Math.min(this.baseStats.maxHull, this.baseStats.hull + 120);
                    this.playerStats.hull = Math.min(this.playerStats.maxHull, this.playerStats.hull + 30);
                    this.showCombatBanner('✨ 나노봇 코어 획득! 데이터센터 +120 HP, 함선 +30 HP 수리 완료!');
                } else if (p.type === 'shield') {
                    this.playerStats.shield = this.playerStats.maxShield;
                    this.baseStats.shield = Math.min(this.baseStats.maxShield, this.baseStats.shield + 150);
                    this.showCombatBanner('🛡️ 실드 에너지 충전 셀 획득! 실드 완충!');
                } else {
                    this.credits += 75;
                    this.score += 500;
                    this.showCombatBanner('💎 서버 데이터 큐브 회수! +$75 크레딧');
                }

                if (window.soundFX) window.soundFX.upgrade();
                this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
            }
        }
    }

    // Update Radar Minimap
    updateRadar() {
        if (!this.radarCtx) return;
        const ctx = this.radarCtx;
        const width = this.radarCanvas.width;
        const height = this.radarCanvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radarRange = 1400; // max distance mapped to radar edge

        ctx.clearRect(0, 0, width, height);

        // Draw Player at center (cyan triangle pointing up)
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx - 4, cy + 5);
        ctx.lineTo(cx + 4, cy + 5);
        ctx.closePath();
        ctx.fill();

        // Player forward heading in world space
        const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
        const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.player.quaternion);

        // Draw Data Center on Radar (Large Green Diamond)
        const toBase = this.dataCenter.position.clone().sub(this.player.position);
        const baseRelX = toBase.dot(playerRight);
        const baseRelY = -toBase.dot(playerForward);

        const baseRadX = cx + (baseRelX / radarRange) * (cx - 10);
        const baseRadY = cy + (baseRelY / radarRange) * (cy - 10);

        ctx.fillStyle = '#00ff88';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(baseRadX, baseRadY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw Enemies on Radar (Red dots)
        this.enemies.forEach(e => {
            const rel = e.mesh.position.clone().sub(this.player.position);
            const rx = rel.dot(playerRight);
            const ry = -rel.dot(playerForward);
            const px = cx + (rx / radarRange) * (cx - 10);
            const py = cy + (ry / radarRange) * (cy - 10);

            ctx.fillStyle = e.type === 'BOSS' ? '#ff00ff' : (e.type === 'BOMBER' ? '#ff8800' : '#ff2244');
            ctx.beginPath();
            ctx.arc(px, py, e.type === 'BOSS' ? 5 : (e.type === 'BOMBER' ? 3.5 : 2.5), 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Incoming Torpedoes on Radar (Flashing yellow/red)
        this.missiles.forEach(m => {
            if (m.isEnemy) {
                const rel = m.mesh.position.clone().sub(this.player.position);
                const rx = rel.dot(playerRight);
                const ry = -rel.dot(playerForward);
                const px = cx + (rx / radarRange) * (cx - 10);
                const py = cy + (ry / radarRange) * (cy - 10);

                ctx.fillStyle = (Date.now() % 300 < 150) ? '#ffff00' : '#ff0000';
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        // Draw Remote Human Players on Radar
        if (this.network) {
            this.network.remotePlayers.forEach(rp => {
                const rel = rp.mesh.position.clone().sub(this.player.position);
                const rx = rel.dot(playerRight);
                const ry = -rel.dot(playerForward);
                const px = cx + (rx / radarRange) * (cx - 10);
                const py = cy + (ry / radarRange) * (cy - 10);

                ctx.fillStyle = rp.team === this.playerTeam ? '#00e5ff' : '#ff0033';
                ctx.beginPath();
                ctx.arc(px, py, 4.5, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    // Update Target Lock-on UI & Gimbal Aim
    updateLockOn() {
        // Continuously evaluate mouse aim point and locks
        this.getAimTarget();

        // 1. Position Bore Reticle (Ship Nose Direction)
        const boreEl = document.getElementById('bore-reticle');
        if (boreEl && this.player) {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
            const borePoint = this.player.position.clone().add(forward.multiplyScalar(120));
            borePoint.project(this.camera);

            if (borePoint.z < 1) {
                const bx = (borePoint.x * 0.5 + 0.5) * window.innerWidth;
                const by = (-borePoint.y * 0.5 + 0.5) * window.innerHeight;
                boreEl.style.left = `${bx}px`;
                boreEl.style.top = `${by}px`;
                boreEl.style.display = 'block';
            } else {
                boreEl.style.display = 'none';
            }
        }

        // 2. Update Mouse Crosshair Locked State
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
            if (this.mouseLockedTarget) {
                crosshair.classList.add('locked');
            } else {
                crosshair.classList.remove('locked');
            }
        }

        // 3. Update Target Lock Box
        const lockBox = document.getElementById('lock-box');
        if (!lockBox) return;

        let activeTarget = null;
        let activeDist = 0;
        let targetType = 'TARGET';

        if (this.mouseLockedTarget) {
            if (this.mouseLockedTarget.enemy) {
                activeTarget = this.mouseLockedTarget.enemy.mesh.position;
                activeDist = this.mouseLockedTarget.dist;
                targetType = this.mouseLockedTarget.enemy.type;
            } else if (this.mouseLockedTarget.missile) {
                activeTarget = this.mouseLockedTarget.missile.mesh.position;
                activeDist = this.mouseLockedTarget.dist;
                targetType = '⚠️ TORPEDO';
            }
        } else {
            // Fall back to closest enemy in forward view
            let bestEnemy = null;
            let bestDist = Infinity;

            this.enemies.forEach(e => {
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
                const toEnemy = e.mesh.position.clone().sub(this.player.position);
                const dot = forward.dot(toEnemy.clone().normalize());

                if (dot > 0.5) {
                    const d = toEnemy.length();
                    if (d < bestDist) {
                        bestDist = d;
                        bestEnemy = e;
                    }
                }
            });

            if (bestEnemy) {
                activeTarget = bestEnemy.mesh.position;
                activeDist = bestDist;
                targetType = bestEnemy.type;
                this.targetEnemy = bestEnemy;
            }
        }

        if (activeTarget) {
            const screenPos = activeTarget.clone().project(this.camera);
            if (screenPos.z < 1) {
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

                lockBox.classList.remove('hidden');
                lockBox.style.left = `${x}px`;
                lockBox.style.top = `${y}px`;

                const lockText = document.getElementById('lock-text');
                if (lockText) {
                    lockText.innerText = `${targetType} [${Math.round(activeDist)}m]`;
                }
            } else {
                lockBox.classList.add('hidden');
            }
        } else {
            lockBox.classList.add('hidden');
        }
    }

    // Update HUD Stats
    updateHUD() {
        // Base Status
        const baseHullPct = Math.max(0, (this.baseStats.hull / this.baseStats.maxHull) * 100);
        const baseShieldPct = Math.max(0, (this.baseStats.shield / this.baseStats.maxShield) * 100);

        const baseHullBar = document.getElementById('base-hull-bar');
        const baseShieldBar = document.getElementById('base-shield-bar');
        const baseHullText = document.getElementById('base-hull-text');
        const baseShieldText = document.getElementById('base-shield-text');
        const baseDistText = document.getElementById('base-dist-text');

        if (baseHullBar) baseHullBar.style.width = `${baseHullPct}%`;
        if (baseShieldBar) baseShieldBar.style.width = `${baseShieldPct}%`;
        if (baseHullText) baseHullText.innerText = `${Math.ceil(this.baseStats.hull)} / ${this.baseStats.maxHull}`;
        if (baseShieldText) baseShieldText.innerText = `${Math.ceil(this.baseStats.shield)} / ${this.baseStats.maxShield}`;
        if (baseDistText) {
            const dist = Math.round(this.player.position.distanceTo(this.dataCenter.position));
            baseDistText.innerText = `거리: ${dist}m`;
        }

        // Player Status
        const playerHullPct = Math.max(0, (this.playerStats.hull / this.playerStats.maxHull) * 100);
        const playerShieldPct = Math.max(0, (this.playerStats.shield / this.playerStats.maxShield) * 100);
        const boostPct = Math.max(0, (this.playerStats.boostEnergy / this.playerStats.maxBoostEnergy) * 100);

        const pHullBar = document.getElementById('player-hull-bar');
        const pShieldBar = document.getElementById('player-shield-bar');
        const pBoostBar = document.getElementById('player-boost-bar');
        const speedText = document.getElementById('speed-text');

        if (pHullBar) pHullBar.style.width = `${playerHullPct}%`;
        if (pShieldBar) pShieldBar.style.width = `${playerShieldPct}%`;
        if (pBoostBar) pBoostBar.style.width = `${boostPct}%`;
        if (speedText) speedText.innerText = `${Math.round(this.playerStats.speed * 20)} km/h`;

        // EMP Status
        const empText = document.getElementById('emp-status-text');
        if (empText) {
            if (this.playerStats.empTimer > 0) {
                empText.innerText = `EMP: ${Math.ceil(this.playerStats.empTimer)}s`;
                empText.style.color = '#ffaa00';
            } else {
                empText.innerText = 'EMP 준비 완료 [X]';
                empText.style.color = '#00f0ff';
            }
        }

        // Credits & Score
        const creditText = document.getElementById('credits-text');
        const scoreText = document.getElementById('score-text');
        if (creditText) creditText.innerText = `$${this.credits}`;
        if (scoreText) scoreText.innerText = `SCORE: ${this.score}`;

        // Faction Scoreboard Update
        const killsText = document.getElementById('kills-text');
        const damageText = document.getElementById('damage-text');
        if (killsText) killsText.innerText = `${this.playerKills} KILLS`;
        if (damageText) damageText.innerText = `${Math.floor(this.totalBaseDamage)} DMG`;
    }

    updateMissileHUD() {
        const missileText = document.getElementById('missile-count-text');
        if (missileText) {
            missileText.innerText = `MISSILES: ${this.playerStats.missiles} / ${this.playerStats.maxMissiles}`;
        }
    }

    // Floating Announcement Banner
    showCombatBanner(msg) {
        const banner = document.getElementById('combat-banner');
        if (!banner) return;
        banner.innerText = msg;
        banner.classList.remove('fade');
        void banner.offsetWidth; // trigger reflow
        banner.classList.add('fade');
    }

    // Upgrade Shop System
    initUpgradeShopUI() {
        const buyBtns = document.querySelectorAll('.buy-upgrade-btn');
        buyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = btn.getAttribute('data-type');
                this.purchaseUpgrade(type);
            });
        });
    }

    updateUpgradeShopUI() {
        const creditDisplay = document.getElementById('modal-credits');
        if (creditDisplay) creditDisplay.innerText = `$${this.credits}`;

        const upgradesConfig = {
            laser: { cost: this.upgrades.laser * 150, max: 5 },
            defense: { cost: this.upgrades.defense * 160, max: 5 },
            missiles: { cost: this.upgrades.missiles * 180, max: 5 },
            repair: { cost: this.upgrades.repair * 200, max: 5 },
            satellites: { cost: (this.upgrades.satellites + 1) * 300, max: 4 },
            emp: { cost: this.upgrades.emp * 220, max: 4 }
        };

        for (let key in upgradesConfig) {
            const conf = upgradesConfig[key];
            const lvlEl = document.getElementById(`lvl-${key}`);
            const costEl = document.getElementById(`cost-${key}`);
            const btn = document.getElementById(`btn-${key}`);

            if (lvlEl) lvlEl.innerText = `Lv.${this.upgrades[key]}`;

            if (this.upgrades[key] >= conf.max) {
                if (costEl) costEl.innerText = 'MAX';
                if (btn) btn.classList.add('disabled');
            } else {
                if (costEl) costEl.innerText = `$${conf.cost}`;
                if (btn) {
                    if (this.credits >= conf.cost) {
                        btn.classList.remove('disabled');
                    } else {
                        btn.classList.add('disabled');
                    }
                }
            }
        }
    }

    purchaseUpgrade(type) {
        const costs = {
            laser: this.upgrades.laser * 150,
            defense: this.upgrades.defense * 160,
            missiles: this.upgrades.missiles * 180,
            repair: this.upgrades.repair * 200,
            satellites: (this.upgrades.satellites + 1) * 300,
            emp: this.upgrades.emp * 220
        };

        const cost = costs[type];
        if (this.credits < cost) return;

        this.credits -= cost;
        this.upgrades[type]++;

        // Apply Upgrade Effects
        if (type === 'laser') {
            this.playerStats.laserDamage += 12;
            this.playerStats.laserCooldown = Math.max(0.08, this.playerStats.laserCooldown - 0.02);
            this.showCombatBanner('⚡ 플라즈마 레이저 강화 완료! 공격력 및 연사속도 상승!');
        } else if (type === 'defense') {
            this.playerStats.maxShield += 40;
            this.playerStats.shield = this.playerStats.maxShield;
            this.playerStats.maxHull += 30;
            this.playerStats.hull = this.playerStats.maxHull;
            this.showCombatBanner('🛡️ 함선 방어막 & 선체 장갑 업그레이드 완료!');
        } else if (type === 'missiles') {
            this.playerStats.maxMissiles += 2;
            this.playerStats.missiles = this.playerStats.maxMissiles;
            this.playerStats.missileReloadTime = Math.max(2.0, this.playerStats.missileReloadTime - 0.5);
            this.updateMissileHUD();
            this.showCombatBanner('🚀 유도 미사일 포드 확장 완료! 최대 적재량 증가!');
        } else if (type === 'repair') {
            this.playerStats.repairRate += 30;
            this.baseStats.shieldRegenRate += 10;
            this.showCombatBanner('🔧 나노봇 수리 빔 출력 대폭 증강! 수리 속도 증가!');
        } else if (type === 'satellites') {
            this.addDefenseSatellite();
        } else if (type === 'emp') {
            this.playerStats.empCooldown = Math.max(12, this.playerStats.empCooldown - 4);
            this.showCombatBanner('⚡ EMP 냉각 시스템 개조 완료! 재사용 대기시간 단축!');
        }

        if (window.soundFX) window.soundFX.upgrade();
        this.updateUpgradeShopUI();
    }

    // Game Over Trigger
    gameOver(reason) {
        this.state = 'GAMEOVER';
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('gameover-screen').classList.remove('hidden');
        document.getElementById('gameover-reason').innerText = reason;
        document.getElementById('go-stats').innerHTML = `
            최종 생존 웨이브: ${this.wave}<br>
            격추한 적 함선: ${this.enemiesDestroyed}대<br>
            요격한 적 어뢰: ${this.torpedoesIntercepted}발<br>
            데이터센터 총 수리량: ${Math.round(this.totalRepairs)} HP<br>
            최종 스코어: ${this.score}
        `;
    }

    // Victory Trigger (Cleared Wave 5 Boss!)
    victory() {
        this.state = 'VICTORY';
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('victory-screen').classList.remove('hidden');
        document.getElementById('vic-stats').innerHTML = `
            신디케이트 보스 기함 격침 완료!<br>
            머스크 우주 데이터센터 방어 성공!<br><br>
            격추한 적 함선: ${this.enemiesDestroyed}대<br>
            요격한 적 어뢰: ${this.torpedoesIntercepted}발<br>
            데이터센터 총 수리량: ${Math.round(this.totalRepairs)} HP<br>
            최종 스코어: ${this.score}
        `;
    }

    // Main Game Loop (RequestAnimationFrame)
    loop() {
        requestAnimationFrame(() => this.loop());

        const dt = Math.min(this.clock.getDelta(), 0.1);

        if (this.state === 'PLAYING') {
            this.updatePlayer(dt);
            this.updateDataCenter(dt);
            this.updateSatellites(dt);
            this.updateLasers(dt);
            this.updateMissiles(dt);
            this.updatePickups(dt);
            this.particles.update(dt);
            this.updateRadar();
            this.updateLockOn();
            this.updateHUD();
            if (this.network) this.network.update(dt);

            // Session timer countdown
            this.sessionTime -= dt;
            const remainingSec = Math.max(0, Math.ceil(this.sessionTime));
            if (document.getElementById('timer-display')) {
                document.getElementById('timer-display').innerText = `남은 시간: ${remainingSec}s`;
            }

            // 5-minute auto-victory if base survives
            if (this.sessionTime <= 0) {
                this.sessionTime = 0;
                this.state = 'VICTORY';
                this.victory('5분 생존 성공! 데이터센터 수호 임무 완수!');
            }
        } else {
            // Idle background rotation on menus
            if (this.dataCenter) {
                if (this.dataCenter.compRing) this.dataCenter.compRing.rotation.z += 0.2 * dt;
                if (this.dataCenter.xLogo) this.dataCenter.xLogo.rotation.y += 0.3 * dt;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Instantiate on window load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
    window.game.loop();
});
