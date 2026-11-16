// Particle and Visual Effects System for War of SpaceX
// High-performance particle engine using pooled sprites and geometries in Three.js

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.shockwaves = [];
        this.repairBeams = [];

        // Laser bolts pool
        this.lasers = [];

        // Pre-create shared materials and textures
        this.createMaterials();
    }

    createMaterials() {
        // Procedural circular glow canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 60, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        this.glowTexture = new THREE.CanvasTexture(canvas);

        // Nanite cyan texture
        const nanoCanvas = document.createElement('canvas');
        nanoCanvas.width = 32;
        nanoCanvas.height = 32;
        const nCtx = nanoCanvas.getContext('2d');
        const nGrad = nCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
        nGrad.addColorStop(0, '#ffffff');
        nGrad.addColorStop(0.4, '#00ffff');
        nGrad.addColorStop(0.8, '#00ff88');
        nGrad.addColorStop(1, 'rgba(0,0,0,0)');
        nCtx.fillStyle = nGrad;
        nCtx.fillRect(0, 0, 32, 32);

        this.nanoTexture = new THREE.CanvasTexture(nanoCanvas);

        // Shared geometries
        this.sparkGeo = new THREE.BufferGeometry();
        this.sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
        
        this.sparkMat = new THREE.PointsMaterial({
            size: 6,
            color: 0xffaa33,
            map: this.glowTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.ringGeo = new THREE.RingGeometry(1, 1.3, 32);
    }

    // Spawn volumetric explosion
    spawnExplosion(pos, scale = 1, isDataCenter = false) {
        const particleCount = isDataCenter ? 70 : 35;
        const baseColor = isDataCenter ? 0xff3300 : 0xff7722;

        // Shockwave Ring
        const ringMat = new THREE.MeshBasicMaterial({
            color: isDataCenter ? 0xff2200 : 0xffaa00,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const ring = new THREE.Mesh(this.ringGeo, ringMat);
        ring.position.copy(pos);
        ring.rotation.x = Math.random() * Math.PI;
        ring.rotation.y = Math.random() * Math.PI;
        ring.scale.set(1, 1, 1);
        this.scene.add(ring);

        this.shockwaves.push({
            mesh: ring,
            scaleSpeed: 45 * scale,
            opacitySpeed: 1.5,
            life: 1.0
        });

        // Fire & Debris particles
        for (let i = 0; i < particleCount; i++) {
            const mat = new THREE.SpriteMaterial({
                map: this.glowTexture,
                color: Math.random() > 0.4 ? baseColor : 0xffffaa,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const sprite = new THREE.Sprite(mat);
            sprite.position.copy(pos);
            const size = (Math.random() * 8 + 6) * scale;
            sprite.scale.set(size, size, 1);

            const speed = (Math.random() * 50 + 20) * scale;
            const dir = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ).normalize();

            this.scene.add(sprite);

            this.particles.push({
                mesh: sprite,
                vel: dir.multiplyScalar(speed),
                decay: Math.random() * 0.8 + 0.6,
                growth: Math.random() * 12 + 6,
                life: 1.0,
                type: 'fire'
            });
        }
    }

    // Engine thruster particle
    spawnThrusterParticle(pos, dir, color = 0x00d4ff, size = 3) {
        const mat = new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: color,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.copy(pos);
        sprite.scale.set(size, size, 1);

        const spread = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        const vel = dir.clone().multiplyScalar(Math.random() * -18 - 15).add(spread);

        this.scene.add(sprite);

        this.particles.push({
            mesh: sprite,
            vel: vel,
            decay: 2.8,
            growth: -1.5,
            life: 1.0,
            type: 'thruster'
        });
    }

    // Nanite Repair Stream particles (flows from Player to Data Center)
    spawnRepairStream(startPos, endPos) {
        for (let i = 0; i < 3; i++) {
            const mat = new THREE.SpriteMaterial({
                map: this.nanoTexture,
                color: 0x00ffff,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(mat);
            // Slight jitter on start position
            sprite.position.copy(startPos).add(new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5
            ));
            const size = Math.random() * 4 + 3;
            sprite.scale.set(size, size, 1);

            const dir = endPos.clone().sub(startPos).normalize();
            const vel = dir.multiplyScalar(Math.random() * 180 + 120);

            this.scene.add(sprite);

            this.particles.push({
                mesh: sprite,
                vel: vel,
                target: endPos.clone(),
                decay: 1.4,
                growth: 0,
                life: 1.0,
                type: 'repair'
            });
        }
    }

    // EMP Shockwave explosion
    spawnEMP(pos, radius = 500) {
        const empRingMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const ring = new THREE.Mesh(this.ringGeo, empRingMat);
        ring.position.copy(pos);
        ring.scale.set(5, 5, 5);
        this.scene.add(ring);

        this.shockwaves.push({
            mesh: ring,
            scaleSpeed: radius * 1.5,
            opacitySpeed: 1.1,
            life: 1.0
        });

        // 3D Sphere Wireframe pulse
        const sphereGeo = new THREE.IcosahedronGeometry(20, 2);
        const sphereMat = new THREE.MeshBasicMaterial({
            color: 0x3388ff,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(pos);
        this.scene.add(sphere);

        this.shockwaves.push({
            mesh: sphere,
            scaleSpeed: radius * 1.2,
            opacitySpeed: 1.2,
            life: 1.0
        });
    }

    // Update all active particles and shockwaves
    update(dt) {
        // Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.life -= dt * sw.opacitySpeed;
            const s = sw.mesh.scale.x + sw.scaleSpeed * dt;
            sw.mesh.scale.set(s, s, s);
            sw.mesh.material.opacity = Math.max(0, sw.life);

            if (sw.life <= 0) {
                this.scene.remove(sw.mesh);
                if (sw.mesh.geometry && sw.mesh.geometry !== this.ringGeo) {
                    sw.mesh.geometry.dispose();
                }
                sw.mesh.material.dispose();
                this.shockwaves.splice(i, 1);
            }
        }

        // Standard particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt * p.decay;

            p.mesh.position.addScaledVector(p.vel, dt);

            if (p.growth !== 0) {
                const newScale = Math.max(0.1, p.mesh.scale.x + p.growth * dt);
                p.mesh.scale.set(newScale, newScale, 1);
            }

            p.mesh.material.opacity = Math.max(0, p.life);

            // Repair particle check target proximity
            if (p.type === 'repair' && p.target) {
                if (p.mesh.position.distanceTo(p.target) < 30) {
                    p.life = 0;
                }
            }

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    clear() {
        this.shockwaves.forEach(sw => {
            this.scene.remove(sw.mesh);
        });
        this.shockwaves = [];

        this.particles.forEach(p => {
            this.scene.remove(p.mesh);
        });
        this.particles = [];
    }
}

window.ParticleSystem = ParticleSystem;
