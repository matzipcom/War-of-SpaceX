// 3D Procedural Ship, Station & Asset Models for War of SpaceX
// Built with Three.js BufferGeometries, Materials, and Procedural Textures

class SpaceModels {
    constructor() {
        this.cache = {};
        this.initSharedMaterials();
    }

    initSharedMaterials() {
        // Hull materials
        this.playerHullMat = new THREE.MeshStandardMaterial({
            color: 0x222b38,
            metalness: 0.85,
            roughness: 0.3,
            emissive: 0x05101a
        });

        this.playerTrimMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            emissive: 0x00a2ff,
            emissiveIntensity: 0.6,
            roughness: 0.2
        });

        this.cockpitMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            roughness: 0.1,
            metalness: 0.9,
            emissive: 0x0088aa,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.85
        });

        this.enemyHullMat = new THREE.MeshStandardMaterial({
            color: 0x1a1215,
            metalness: 0.8,
            roughness: 0.4,
            emissive: 0x220505
        });

        this.enemyTrimMat = new THREE.MeshStandardMaterial({
            color: 0xff1133,
            emissive: 0xff0022,
            emissiveIntensity: 0.8,
            roughness: 0.3
        });

        this.bomberHullMat = new THREE.MeshStandardMaterial({
            color: 0x2b2518,
            metalness: 0.7,
            roughness: 0.45,
            emissive: 0x1f1405
        });

        this.bomberTrimMat = new THREE.MeshStandardMaterial({
            color: 0xff8800,
            emissive: 0xff6600,
            emissiveIntensity: 0.9
        });

        this.stationMetalMat = new THREE.MeshStandardMaterial({
            color: 0x1e2733,
            metalness: 0.9,
            roughness: 0.35
        });

        this.stationWhiteMat = new THREE.MeshStandardMaterial({
            color: 0xe0e6ed,
            metalness: 0.6,
            roughness: 0.3
        });

        this.serverLedMat = new THREE.MeshBasicMaterial({
            color: 0x00ffcc
        });

        this.solarMat = new THREE.MeshStandardMaterial({
            color: 0x0a1a3a,
            emissive: 0x051530,
            roughness: 0.2,
            metalness: 0.95
        });
    }

    // 1. ELON MUSK'S "X" SPACE SUPER DATA CENTER (우주 데이터센터 거점)
    createDataCenter() {
        const group = new THREE.Group();
        group.name = "MuskSpaceDataCenter";

        // Central Supercomputing Reactor Core
        const coreGeo = new THREE.CylinderGeometry(35, 40, 110, 16);
        const core = new THREE.Mesh(coreGeo, this.stationMetalMat);
        group.add(core);

        // Core Glowing Energy Column (Translucent inner cylinder)
        const energyColGeo = new THREE.CylinderGeometry(20, 20, 130, 16);
        const energyColMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00c8ff,
            emissiveIntensity: 0.9,
            transparent: true,
            opacity: 0.85
        });
        const energyCol = new THREE.Mesh(energyColGeo, energyColMat);
        group.add(energyCol);
        group.energyCol = energyCol;

        // Rotating computational ring
        const ringGeo = new THREE.TorusGeometry(60, 5, 12, 36);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x2c3b4d,
            metalness: 0.8,
            roughness: 0.3,
            emissive: 0x004466
        });
        const compRing = new THREE.Mesh(ringGeo, ringMat);
        compRing.rotation.x = Math.PI / 2;
        group.add(compRing);
        group.compRing = compRing;

        // Second outer counter-rotating ring
        const ring2Geo = new THREE.TorusGeometry(85, 3.5, 12, 48);
        const compRing2 = new THREE.Mesh(ring2Geo, ringMat);
        compRing2.rotation.x = Math.PI / 2;
        group.add(compRing2);
        group.compRing2 = compRing2;

        // Iconic "X" Logo on the pinnacle of the Data Center
        const xGroup = new THREE.Group();
        const xBarGeo = new THREE.BoxGeometry(10, 60, 6);
        const xMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x00e5ff,
            emissiveIntensity: 0.8,
            metalness: 0.9,
            roughness: 0.1
        });
        const bar1 = new THREE.Mesh(xBarGeo, xMat);
        bar1.rotation.z = Math.PI / 4;
        const bar2 = new THREE.Mesh(xBarGeo, xMat);
        bar2.rotation.z = -Math.PI / 4;
        xGroup.add(bar1);
        xGroup.add(bar2);
        xGroup.position.set(0, 85, 0);
        xGroup.scale.set(1.2, 1.2, 1.2);
        group.add(xGroup);
        group.xLogo = xGroup;

        // Radial Server Pod Arrays (서버 블레이드 랙 모듈)
        const serverArms = 6;
        const serverPylons = [];
        for (let i = 0; i < serverArms; i++) {
            const angle = (i / serverArms) * Math.PI * 2;
            const arm = new THREE.Group();

            // Structural strut
            const strutGeo = new THREE.BoxGeometry(120, 8, 8);
            const strut = new THREE.Mesh(strutGeo, this.stationMetalMat);
            strut.position.x = 60;
            arm.add(strut);

            // Server Rack Pods
            for (let j = 0; j < 3; j++) {
                const podGeo = new THREE.BoxGeometry(22, 35, 18);
                const pod = new THREE.Mesh(podGeo, this.stationWhiteMat);
                pod.position.set(45 + j * 32, 0, 0);
                arm.add(pod);

                // Server status LEDs
                const ledGeo = new THREE.BoxGeometry(1, 28, 2);
                const ledStrip = new THREE.Mesh(ledGeo, this.serverLedMat);
                ledStrip.position.set(45 + j * 32 + 11.2, 0, 0);
                arm.add(ledStrip);
            }

            arm.rotation.y = angle;
            group.add(arm);
            serverPylons.push(arm);
        }

        // Starlink Relays & Vast Solar Array Wings
        const solarWingGeo = new THREE.BoxGeometry(180, 2, 45);
        const wing1 = new THREE.Mesh(solarWingGeo, this.solarMat);
        wing1.position.set(160, -30, 0);
        group.add(wing1);

        const wing2 = new THREE.Mesh(solarWingGeo, this.solarMat);
        wing2.position.set(-160, -30, 0);
        group.add(wing2);

        // Parabolic Deep-Space Communications Dish
        const dishGeo = new THREE.SphereGeometry(25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const dishMat = new THREE.MeshStandardMaterial({
            color: 0xdde5ed,
            roughness: 0.3,
            metalness: 0.8,
            side: THREE.DoubleSide
        });
        const dish = new THREE.Mesh(dishGeo, dishMat);
        dish.position.set(0, -75, 0);
        dish.rotation.x = Math.PI;
        group.add(dish);

        // Dish Feed Horn / Transmitter
        const hornGeo = new THREE.CylinderGeometry(2, 4, 25);
        const horn = new THREE.Mesh(hornGeo, this.playerTrimMat);
        horn.position.set(0, -95, 0);
        group.add(horn);

        // Holographic Forcefield Dome (Shield Mesh)
        const shieldGeo = new THREE.IcosahedronGeometry(220, 2);
        const shieldMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00a2ff,
            emissiveIntensity: 0.4,
            wireframe: true,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending
        });
        const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        group.add(shieldMesh);
        group.shieldMesh = shieldMesh;

        // Repair Dock Perimeter Hologram (수리 구역 링 표시기)
        const dockRingGeo = new THREE.TorusGeometry(260, 4, 8, 64);
        const dockRingMat = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        const dockRing = new THREE.Mesh(dockRingGeo, dockRingMat);
        dockRing.rotation.x = Math.PI / 2;
        group.add(dockRing);
        group.dockRing = dockRing;

        // Point light at the core
        const coreLight = new THREE.PointLight(0x00e5ff, 2.5, 450);
        coreLight.position.set(0, 0, 0);
        group.add(coreLight);

        return group;
    }

    // 2. PLAYER STARSHIP (X-Fighter "CyberHawk")
    createPlayerShip() {
        const group = new THREE.Group();
        group.name = "PlayerStarship";

        // Fuselage Main Body (Aerodynamic stealth delta shape)
        const bodyGeo = new THREE.ConeGeometry(3.5, 24, 5);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, this.playerHullMat);
        body.scale.set(1.4, 0.7, 1);
        group.add(body);

        // Cockpit Canopy
        const canopyGeo = new THREE.SphereGeometry(2.2, 12, 8);
        const canopy = new THREE.Mesh(canopyGeo, this.cockpitMat);
        canopy.scale.set(0.9, 0.7, 2.8);
        canopy.position.set(0, 1.4, -2);
        group.add(canopy);

        // Wings (Forward/Swept wing design)
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(14, -6);
        wingShape.lineTo(12, -12);
        wingShape.lineTo(0, -8);
        wingShape.closePath();

        const extrudeSettings = { depth: 0.5, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.2, bevelThickness: 0.2 };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeo.rotateX(-Math.PI / 2);

        // Right Wing
        const rightWing = new THREE.Mesh(wingGeo, this.playerHullMat);
        rightWing.position.set(1.5, 0, 3);
        group.add(rightWing);

        // Left Wing
        const leftWing = new THREE.Mesh(wingGeo, this.playerHullMat);
        leftWing.scale.x = -1;
        leftWing.position.set(-1.5, 0, 3);
        group.add(leftWing);

        // Wingtip Plasma Cannons
        const gunGeo = new THREE.CylinderGeometry(0.5, 0.7, 8, 8);
        gunGeo.rotateX(Math.PI / 2);

        const leftGun = new THREE.Mesh(gunGeo, this.playerTrimMat);
        leftGun.position.set(-14.2, 0, -3);
        group.add(leftGun);

        const rightGun = new THREE.Mesh(gunGeo, this.playerTrimMat);
        rightGun.position.set(14.2, 0, -3);
        group.add(rightGun);

        // Dual Engine Thruster Nozzles
        const nozzleGeo = new THREE.CylinderGeometry(1.2, 1.6, 3, 10);
        nozzleGeo.rotateX(Math.PI / 2);

        const leftNozzle = new THREE.Mesh(nozzleGeo, this.playerTrimMat);
        leftNozzle.position.set(-2, 0, 11);
        group.add(leftNozzle);

        const rightNozzle = new THREE.Mesh(nozzleGeo, this.playerTrimMat);
        rightNozzle.position.set(2, 0, 11);
        group.add(rightNozzle);

        // Thruster Glow Points (for particles/lights)
        const thrusterGlowGeo = new THREE.SphereGeometry(1, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const leftGlow = new THREE.Mesh(thrusterGlowGeo, glowMat);
        leftGlow.position.set(-2, 0, 12);
        group.add(leftGlow);

        const rightGlow = new THREE.Mesh(thrusterGlowGeo, glowMat);
        rightGlow.position.set(2, 0, 12);
        group.add(rightGlow);

        // Vertical Stabilizer Fins
        const finGeo = new THREE.BoxGeometry(0.4, 4.5, 6);
        const leftFin = new THREE.Mesh(finGeo, this.playerHullMat);
        leftFin.position.set(-4, 2, 7);
        leftFin.rotation.z = -0.25;
        group.add(leftFin);

        const rightFin = new THREE.Mesh(finGeo, this.playerHullMat);
        rightFin.position.set(4, 2, 7);
        rightFin.rotation.z = 0.25;
        group.add(rightFin);

        // Player Shield Mesh (Flashes when damaged)
        const pShieldGeo = new THREE.SphereGeometry(16, 12, 8);
        const pShieldMat = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            wireframe: true,
            transparent: true,
            opacity: 0.0
        });
        const pShield = new THREE.Mesh(pShieldGeo, pShieldMat);
        group.add(pShield);
        group.shieldMesh = pShield;

        return group;
    }

    // 3. ENEMY: VOID INTERCEPTOR (고속 요격기)
    createInterceptor() {
        const group = new THREE.Group();
        group.name = "VoidInterceptor";

        // Menacing swept forward triangular hull
        const bodyGeo = new THREE.ConeGeometry(3, 18, 4);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, this.enemyHullMat);
        body.scale.set(1.2, 0.6, 1);
        group.add(body);

        // Forward sweeping dagger wings
        const wingGeo = new THREE.BoxGeometry(16, 0.4, 6);
        const wing = new THREE.Mesh(wingGeo, this.enemyHullMat);
        wing.position.set(0, 0, 0);
        wing.rotation.y = 0.3;
        group.add(wing);

        // Crimson Glowing Sensor Eye
        const eyeGeo = new THREE.BoxGeometry(2.5, 0.8, 1);
        const eye = new THREE.Mesh(eyeGeo, this.enemyTrimMat);
        eye.position.set(0, 0.5, -7.5);
        group.add(eye);

        // Twin Crimson Laser Cannons
        const gunGeo = new THREE.CylinderGeometry(0.4, 0.4, 5, 6);
        gunGeo.rotateX(Math.PI / 2);

        const g1 = new THREE.Mesh(gunGeo, this.enemyTrimMat);
        g1.position.set(-6, 0, -2);
        group.add(g1);

        const g2 = new THREE.Mesh(gunGeo, this.enemyTrimMat);
        g2.position.set(6, 0, -2);
        group.add(g2);

        // Thruster
        const thrusterGeo = new THREE.CylinderGeometry(0.9, 1.3, 2, 8);
        thrusterGeo.rotateX(Math.PI / 2);
        const thruster = new THREE.Mesh(thrusterGeo, this.enemyTrimMat);
        thruster.position.set(0, 0, 8);
        group.add(thruster);

        return group;
    }

    // 4. ENEMY: SIEGE BOMBER (공성 폭격기)
    createBomber() {
        const group = new THREE.Group();
        group.name = "SiegeBomber";

        // Heavy Hexagonal Armored Hull
        const bodyGeo = new THREE.CylinderGeometry(5.5, 6.5, 26, 6);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, this.bomberHullMat);
        group.add(body);

        // Heavy Armor Plates
        const plateGeo = new THREE.BoxGeometry(18, 4, 16);
        const plate = new THREE.Mesh(plateGeo, this.bomberHullMat);
        plate.position.set(0, 1, 0);
        group.add(plate);

        // Twin Heavy Torpedo Launch Tubes
        const tubeGeo = new THREE.CylinderGeometry(1.6, 1.8, 14, 8);
        tubeGeo.rotateX(Math.PI / 2);

        const leftTube = new THREE.Mesh(tubeGeo, this.bomberTrimMat);
        leftTube.position.set(-7, -1.5, -4);
        group.add(leftTube);

        const rightTube = new THREE.Mesh(tubeGeo, this.bomberTrimMat);
        rightTube.position.set(7, -1.5, -4);
        group.add(rightTube);

        // Plasma Core Reactor (Orange glow)
        const coreGeo = new THREE.SphereGeometry(3.2, 10, 8);
        const core = new THREE.Mesh(coreGeo, this.bomberTrimMat);
        core.position.set(0, 2.5, 3);
        group.add(core);

        // Multi Thrusters
        for (let i = -1; i <= 1; i++) {
            const nozGeo = new THREE.CylinderGeometry(1.2, 1.6, 3, 6);
            nozGeo.rotateX(Math.PI / 2);
            const noz = new THREE.Mesh(nozGeo, this.bomberTrimMat);
            noz.position.set(i * 3.5, 0, 14);
            group.add(noz);
        }

        return group;
    }

    // 5. BOSS: SYNDICATE ORBITAL DREADNOUGHT (초대형 순양함)
    createBossDreadnought() {
        const group = new THREE.Group();
        group.name = "SyndicateDreadnought";

        // Gigantic Battleship Hull
        const mainHullGeo = new THREE.BoxGeometry(50, 25, 140);
        const mainHull = new THREE.Mesh(mainHullGeo, this.enemyHullMat);
        group.add(mainHull);

        // Forward Ramming Prow / Heavy Bow
        const prowGeo = new THREE.ConeGeometry(25, 60, 4);
        prowGeo.rotateX(Math.PI / 2);
        const prow = new THREE.Mesh(prowGeo, this.enemyHullMat);
        prow.position.set(0, 0, -95);
        prow.scale.set(1, 0.6, 1);
        group.add(prow);

        // Command Bridge Tower
        const bridgeGeo = new THREE.BoxGeometry(26, 15, 35);
        const bridge = new THREE.Mesh(bridgeGeo, this.stationMetalMat);
        bridge.position.set(0, 18, 15);
        group.add(bridge);

        const bridgeGlassGeo = new THREE.BoxGeometry(24, 4, 8);
        const glass = new THREE.Mesh(bridgeGlassGeo, this.enemyTrimMat);
        glass.position.set(0, 21, 5);
        group.add(glass);

        // Broadside Cannon Batteries
        for (let side of [-1, 1]) {
            for (let z = -40; z <= 40; z += 30) {
                const turretGeo = new THREE.CylinderGeometry(4, 5, 4, 8);
                const turret = new THREE.Mesh(turretGeo, this.stationMetalMat);
                turret.position.set(side * 26, 4, z);

                const barrelGeo = new THREE.CylinderGeometry(1.2, 1.2, 16, 6);
                barrelGeo.rotateZ(Math.PI / 2 * side);
                const barrel = new THREE.Mesh(barrelGeo, this.enemyTrimMat);
                barrel.position.set(side * 32, 4, z);

                group.add(turret);
                group.add(barrel);
            }
        }

        // Heavy Engine Thrusters
        for (let x of [-16, 0, 16]) {
            for (let y of [-5, 5]) {
                const engGeo = new THREE.CylinderGeometry(5, 7, 18, 10);
                engGeo.rotateX(Math.PI / 2);
                const eng = new THREE.Mesh(engGeo, this.enemyTrimMat);
                eng.position.set(x, y, 75);
                group.add(eng);
            }
        }

        // Boss Red Energy Shield
        const bShieldGeo = new THREE.IcosahedronGeometry(110, 2);
        const bShieldMat = new THREE.MeshStandardMaterial({
            color: 0xff0044,
            wireframe: true,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending
        });
        const bShield = new THREE.Mesh(bShieldGeo, bShieldMat);
        group.add(bShield);
        group.shieldMesh = bShield;

        return group;
    }

    // 6. EXPLOSIVE TORPEDO / MISSILE (유도 미사일 & 데이터센터 타격 폭탄)
    createMissile(isEnemy = true) {
        const group = new THREE.Group();
        group.name = "Missile";

        const col = isEnemy ? 0xff4400 : 0x00e5ff;
        const mat = new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.8
        });

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.6, 0.9, 7, 8);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, mat);
        group.add(body);

        // Warhead
        const headGeo = new THREE.ConeGeometry(0.9, 2.5, 8);
        headGeo.rotateX(Math.PI / 2);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0, -4.5);
        group.add(head);

        // Fins
        for (let i = 0; i < 4; i++) {
            const finGeo = new THREE.BoxGeometry(0.15, 2.4, 1.8);
            const fin = new THREE.Mesh(finGeo, mat);
            fin.rotation.z = (i * Math.PI) / 2;
            fin.position.set(0, 0, 2.5);
            group.add(fin);
        }

        return group;
    }

    // 7. STARLINK DEFENSE SATELLITE (스타링크 자동 방어 위성)
    createDefenseSatellite() {
        const group = new THREE.Group();
        group.name = "StarlinkDefenseSatellite";

        // Satellite bus
        const busGeo = new THREE.BoxGeometry(4, 3, 6);
        const bus = new THREE.Mesh(busGeo, this.stationMetalMat);
        group.add(bus);

        // Solar panels
        const panelGeo = new THREE.BoxGeometry(16, 0.3, 5);
        const panel = new THREE.Mesh(panelGeo, this.solarMat);
        panel.position.set(0, 0, 0);
        group.add(panel);

        // Micro Laser Turret
        const turretGeo = new THREE.SphereGeometry(1.2, 8, 8);
        const turret = new THREE.Mesh(turretGeo, this.playerTrimMat);
        turret.position.set(0, 2, 0);
        group.add(turret);

        const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 6);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, this.playerTrimMat);
        barrel.position.set(0, 2, -2);
        group.add(barrel);

        return group;
    }

    // 8. LOOT PICKUP (전리품 데이터 코어 / 수리 나노봇)
    createLootPickup(type = 'repair') {
        const group = new THREE.Group();
        group.name = "LootPickup";

        const col = type === 'repair' ? 0x00ff88 : (type === 'shield' ? 0x00aaff : 0xffcc00);

        const cubeGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
        const cubeMat = new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.9,
            transparent: true,
            opacity: 0.85
        });
        const cube = new THREE.Mesh(cubeGeo, cubeMat);
        group.add(cube);

        const wireGeo = new THREE.BoxGeometry(4.2, 4.2, 4.2);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true
        });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        group.add(wire);

        group.lootType = type;
        return group;
    }

    // 9. CELESTIAL SPACE ENVIRONMENT (Deep Space, Moving Warp Stars, Earth, Mars, Nebulas)
    createSpaceEnvironment(scene) {
        // Starfield Particles (Thousands of shining stars)
        const starGeo = new THREE.BufferGeometry();
        const starCount = 6000;
        const starPos = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const r = 300 + Math.random() * 3200;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);

            starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPos[i * 3 + 2] = r * Math.cos(phi);

            // Subtle color tint (white, blue, cyan, amber)
            const tint = Math.random();
            if (tint > 0.85) {
                starColors[i * 3] = 0.5; starColors[i * 3 + 1] = 0.8; starColors[i * 3 + 2] = 1.0;
            } else if (tint > 0.7) {
                starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.7; starColors[i * 3 + 2] = 0.4;
            } else if (tint > 0.55) {
                starColors[i * 3] = 0.3; starColors[i * 3 + 1] = 1.0; starColors[i * 3 + 2] = 0.9;
            } else {
                starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 1.0; starColors[i * 3 + 2] = 1.0;
            }
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 3.5,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);

        // Dynamic Moving Near-Starfield (Warp Effect for Speed Sensation)
        const nearStarGeo = new THREE.BufferGeometry();
        const nearStarCount = 800;
        const nearStarPos = new Float32Array(nearStarCount * 3);
        const nearStarOriginals = new Float32Array(nearStarCount * 3);

        for (let i = 0; i < nearStarCount; i++) {
            const x = (Math.random() - 0.5) * 1400;
            const y = (Math.random() - 0.5) * 1400;
            const z = (Math.random() - 0.5) * 1400;

            nearStarPos[i * 3] = x;
            nearStarPos[i * 3 + 1] = y;
            nearStarPos[i * 3 + 2] = z;

            nearStarOriginals[i * 3] = x;
            nearStarOriginals[i * 3 + 1] = y;
            nearStarOriginals[i * 3 + 2] = z;
        }

        nearStarGeo.setAttribute('position', new THREE.BufferAttribute(nearStarPos, 3));

        const nearStarMat = new THREE.PointsMaterial({
            size: 4.5,
            color: 0x88ccff,
            map: this.glowTexture || null,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const nearStars = new THREE.Points(nearStarGeo, nearStarMat);
        scene.add(nearStars);

        // Distant Earth Planet
        const earthGeo = new THREE.SphereGeometry(350, 32, 32);
        const earthMat = new THREE.MeshStandardMaterial({
            color: 0x1b4488,
            roughness: 0.7,
            metalness: 0.1,
            emissive: 0x051530
        });
        const earth = new THREE.Mesh(earthGeo, earthMat);
        earth.position.set(-1800, -800, -2200);
        scene.add(earth);

        // Atmospheric halo for Earth
        const haloGeo = new THREE.SphereGeometry(370, 32, 32);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x00a2ff,
            transparent: true,
            opacity: 0.25,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.copy(earth.position);
        scene.add(halo);

        // Distant Mars
        const marsGeo = new THREE.SphereGeometry(180, 24, 24);
        const marsMat = new THREE.MeshStandardMaterial({
            color: 0xc84c20,
            roughness: 0.8,
            metalness: 0.2,
            emissive: 0x301005
        });
        const mars = new THREE.Mesh(marsGeo, marsMat);
        mars.position.set(2200, 900, -2400);
        scene.add(mars);

        // Distant Sun Light
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
        sunLight.position.set(1200, 1500, 1000);
        scene.add(sunLight);

        // Space Ambient Light
        const ambLight = new THREE.AmbientLight(0x223344, 1.0);
        scene.add(ambLight);

        return { stars, nearStars, earth, mars };
    }
}

window.SpaceModels = SpaceModels;
