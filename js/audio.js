// Procedural Web Audio API Engine for War of SpaceX
// Zero external audio assets required; fully self-contained and instant load.

class SoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.bgmGain = null;
        this.sfxGain = null;
        this.bgmPlaying = false;
        this.bgmTimer = null;
        this.repairOsc = null;
        this.repairGain = null;
        this.thrusterOsc = null;
        this.thrusterGain = null;
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        // Master gains
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.9;
        this.sfxGain.connect(this.masterGain);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.35;
        this.bgmGain.connect(this.masterGain);

        this.initContinuousThruster();
        this.startBGM();
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.enabled = !this.enabled;
        if (this.masterGain) {
            this.masterGain.gain.value = this.enabled ? 0.8 : 0;
        }
        return this.enabled;
    }

    // Player Dual Laser Shot
    laser() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.12);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.13);
    }

    // Enemy Laser Shot (Darker, menacing)
    enemyLaser() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.16);
    }

    // Missile Launch
    missileLaunch() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;

        // Sub tone
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.35);

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        // Noise rush
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(2400, t + 0.35);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.4);
        noise.start(t);
        noise.stop(t + 0.4);
    }

    // Explosions (Scaled by impact)
    explosion(isHeavy = false) {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const dur = isHeavy ? 1.6 : 0.7;

        // Low frequency thud
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isHeavy ? 140 : 180, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + dur);

        oscGain.gain.setValueAtTime(isHeavy ? 0.8 : 0.5, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        // Noise rumble
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isHeavy ? 600 : 900, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + dur);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(isHeavy ? 0.7 : 0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(oscGain);
        oscGain.connect(this.sfxGain);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + dur);
        noise.start(t);
        noise.stop(t + dur);
    }

    // Shield Deflection Impact
    shieldHit() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.2);
    }

    // Continuous Repair Beam Harmonic Hum
    setRepairBeamActive(active) {
        if (!this.enabled || !this.ctx) return;
        if (active) {
            if (!this.repairOsc) {
                const t = this.ctx.currentTime;
                this.repairOsc = this.ctx.createOscillator();
                const subOsc = this.ctx.createOscillator();
                this.repairGain = this.ctx.createGain();

                this.repairOsc.type = 'sine';
                this.repairOsc.frequency.setValueAtTime(523.25, t); // C5

                subOsc.type = 'triangle';
                subOsc.frequency.setValueAtTime(659.25, t); // E5

                this.repairGain.gain.setValueAtTime(0.01, t);
                this.repairGain.gain.linearRampToValueAtTime(0.2, t + 0.2);

                this.repairOsc.connect(this.repairGain);
                subOsc.connect(this.repairGain);
                this.repairGain.connect(this.sfxGain);

                this.repairOsc.start(t);
                subOsc.start(t);
                this.subRepairOsc = subOsc;
            }
        } else {
            if (this.repairOsc && this.repairGain) {
                const t = this.ctx.currentTime;
                this.repairGain.gain.linearRampToValueAtTime(0.001, t + 0.1);
                setTimeout(() => {
                    if (this.repairOsc) {
                        try { this.repairOsc.stop(); } catch(e){}
                        this.repairOsc = null;
                    }
                    if (this.subRepairOsc) {
                        try { this.subRepairOsc.stop(); } catch(e){}
                        this.subRepairOsc = null;
                    }
                }, 120);
            }
        }
    }

    // Engine Thruster Continuous Ambient Loop
    initContinuousThruster() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(65, this.ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        this.thrusterOsc = osc;
        this.thrusterFilter = filter;
        this.thrusterGain = gain;
    }

    updateThruster(throttle, boosting) {
        if (!this.ctx || !this.thrusterGain) return;
        const t = this.ctx.currentTime;
        const targetFreq = 50 + throttle * 60 + (boosting ? 80 : 0);
        const targetGain = 0.05 + throttle * 0.12 + (boosting ? 0.15 : 0);
        this.thrusterOsc.frequency.setTargetAtTime(targetFreq, t, 0.08);
        this.thrusterGain.gain.setTargetAtTime(this.enabled ? targetGain : 0, t, 0.08);
    }

    // Warning / Alarm Tone
    alarm() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.setValueAtTime(500, t + 0.12);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.26);
    }

    // EMP Shockwave Blast
    empBlast() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.8);

        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.95);
    }

    // Upgrade Success Chime
    upgrade() {
        if (!this.enabled || !this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const t = this.ctx.currentTime + idx * 0.09;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.26);
        });
    }

    // Ambient Space Synthwave Soundtrack (Procedural)
    startBGM() {
        if (this.bgmPlaying || !this.ctx) return;
        this.bgmPlaying = true;

        const chordProgression = [
            [130.81, 164.81, 196.00, 246.94], // C maj7
            [110.00, 146.83, 174.61, 220.00], // A min
            [138.59, 174.61, 207.65, 261.63], // F maj
            [98.00, 123.47, 146.83, 196.00]   // G
        ];

        let chordIndex = 0;
        let step = 0;

        const playSynthStep = () => {
            if (!this.enabled || !this.ctx) {
                this.bgmTimer = setTimeout(playSynthStep, 250);
                return;
            }
            const t = this.ctx.currentTime;
            const chord = chordProgression[chordIndex];
            const noteFreq = chord[step % chord.length] * (step % 2 === 0 ? 1 : 2);

            // Arpeggio lead
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(noteFreq, t);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000 + Math.sin(t * 0.5) * 500, t);

            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(t);
            osc.stop(t + 0.23);

            // Bass pulse on beat 0
            if (step === 0) {
                const bass = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();
                bass.type = 'sine';
                bass.frequency.setValueAtTime(chord[0] * 0.5, t);
                bassGain.gain.setValueAtTime(0.2, t);
                bassGain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
                bass.connect(bassGain);
                bassGain.connect(this.bgmGain);
                bass.start(t);
                bass.stop(t + 1.9);
            }

            step = (step + 1) % 8;
            if (step === 0) {
                chordIndex = (chordIndex + 1) % chordProgression.length;
            }

            this.bgmTimer = setTimeout(playSynthStep, 240);
        };

        playSynthStep();
    }
}

window.soundFX = new SoundFX();
