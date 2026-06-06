/**
 * NEBULASYNTH - AUDIO SYNTHESIS ENGINE
 * Uses Web Audio API to procedurally generate all sounds, instruments, and effects.
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.analyser = null;
        
        // Synth Settings
        this.oscType = 'sine';
        this.adsr = {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.6,
            release: 0.5
        };
        this.filter = {
            cutoff: 2500,
            resonance: 1
        };
        this.delay = {
            enabled: false,
            time: 0.3,
            feedback: 0.4
        };

        // Sequencer State
        this.isPlaying = false;
        this.bpm = 120;
        this.currentStep = 0;
        this.tempoInterval = null;
        
        // Active preset tracker
        this.currentPreset = 'space-odyssey';
        
        // Precision Audio Scheduler parameters
        this.nextNoteTime = 0.0;
        this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)
        this.lookahead = 25.0; // How frequently to call scheduling function (ms)
        this.schedulerTimer = null;
        
        // Sequencer Grid: 5 tracks (Kick, Snare, Hihat, Bass, Lead) x 16 steps
        this.grid = {
            kick: Array(16).fill(false),
            snare: Array(16).fill(false),
            hihat: Array(16).fill(false),
            bass: Array(16).fill(false),
            lead: Array(16).fill(false)
        };

        // Noise Buffer for Drum synthesis (Hihat, Snare)
        this.noiseBuffer = null;
        
        // Frequencies for keyboard / synth tracks
        this.frequencies = {
            // Octave 4 (Keyboard + Lead Track)
            'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63,
            'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00,
            'A#4': 466.16, 'B4': 493.88,
            
            // Octave 5 (High Sweet Chimes)
            'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25,
            'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00,
            'A#5': 932.33, 'B5': 987.77,
            
            // Octave 2/3 (Bass Track defaults)
            'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00,
            'A3': 220.00, 'B3': 246.94,
            'C2': 65.41,  'G2': 78.00,   'A2': 82.41
        };

        // UI Callbacks
        this.onStepTick = null; // Called when a step advances (for animation)
    }

    /**
     * Initializes the Web Audio API context.
     * Must be triggered by user interaction due to browser autoplay policies.
     */
    init() {
        if (this.ctx) return; // Already initialized

        // Create audio context
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();

        // Create main gain node for volume control
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7; // default volume

        // Create analyser for visualizer
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;

        // Connections
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        // Generate noise buffer
        this.generateNoiseBuffer();
    }

    /**
     * Resumes Audio Context if suspended
     */
    async resume() {
        this.init();
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * Generates a 2-second white noise buffer for drums synthesis
     */
    generateNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        this.noiseBuffer = buffer;
    }

    /**
     * Sets master volume percentage
     * @param {number} val Scale from 0.0 to 1.0
     */
    setVolume(val) {
        if (!this.masterGain) return;
        this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }

    /* ==========================================================================
       DRUM SYNTHESIS NODES
       ========================================================================== */

    /**
     * Synthesizes a Bass Drum / Kick - Soft and warm for children
     */
    triggerKick(time) {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.type = 'sine';
        // Gentle sweep down
        osc.frequency.setValueAtTime(110, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.15);
        
        // Softer volume decay
        gain.gain.setValueAtTime(0.45, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        
        osc.start(time);
        osc.stop(time + 0.18);
    }

    /**
     * Synthesizes a Snare Drum - Soft and non-intrusive
     */
    triggerSnare(time) {
        if (!this.ctx || !this.noiseBuffer) return;

        // 1. Noise Component (Snare wires rattling) - very soft
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1200, time);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.12, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        // 2. Shell Snap (Triangle pitch Sweep) - soft pop
        const snapOsc = this.ctx.createOscillator();
        const snapGain = this.ctx.createGain();
        
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(160, time);
        snapOsc.frequency.exponentialRampToValueAtTime(70, time + 0.08);
        
        snapGain.gain.setValueAtTime(0.18, time);
        snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        
        snapOsc.connect(snapGain);
        snapGain.connect(this.masterGain);

        // Trigger snap
        noiseSource.start(time);
        noiseSource.stop(time + 0.12);
        
        snapOsc.start(time);
        snapOsc.stop(time + 0.08);
    }

    /**
     * Synthesizes a metallic Hi-Hat - Sweet chime-like sound for children
     */
    triggerHiHat(time) {
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(8000, time);

        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + 0.04);
    }

    /* ==========================================================================
       SYNTHESIZER NOTE TRIGGER
       ========================================================================== */

    /**
     * Plays a synth note procedurally applying Envelope, Filter, and Delay effects
     * @param {number} freq Frequency in Hz
     * @param {number} startTime Scheduled start time (sec)
     * @param {number} duration Note duration (sec)
     */
    triggerSynthNote(freq, startTime, duration = 0.5) {
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const ampGain = this.ctx.createGain();
        const filterNode = this.ctx.createBiquadFilter();
        
        osc.type = this.oscType;
        osc.frequency.setValueAtTime(freq, startTime);

        // Filter Settings
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(this.filter.cutoff, startTime);
        filterNode.Q.setValueAtTime(this.filter.resonance, startTime);

        // Envelope Calculation (ADSR)
        const now = startTime;
        const envAttack = this.adsr.attack;
        const envDecay = this.adsr.decay;
        const envSustain = this.adsr.sustain;
        const envRelease = this.adsr.release;
        
        // Safeguard to prevent scheduling overlapping envelopes when note duration is short
        const activeDuration = Math.max(duration, envAttack + envDecay);
        const stopTime = now + activeDuration + envRelease;
        
        ampGain.gain.setValueAtTime(0, now);
        // Attack: Sweep from 0 to peak gain (0.8)
        ampGain.gain.linearRampToValueAtTime(0.8, now + envAttack);
        // Decay: Decay to sustain level
        ampGain.gain.linearRampToValueAtTime(envSustain * 0.8, now + envAttack + envDecay);
        
        // Release trigger
        ampGain.gain.setValueAtTime(envSustain * 0.8, now + activeDuration);
        ampGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

        // Routing Chain: Oscillator -> Filter -> Envelope (AmpGain)
        osc.connect(filterNode);
        
        // Connect through Space Delay if enabled
        if (this.delay.enabled) {
            const delayNode = this.ctx.createDelay();
            const feedbackGain = this.ctx.createGain();
            const delayBlendGain = this.ctx.createGain();
            
            delayNode.delayTime.setValueAtTime(this.delay.time, now);
            feedbackGain.gain.setValueAtTime(this.delay.feedback, now);
            delayBlendGain.gain.setValueAtTime(0.4, now); // wet blend level
            
            // Loop path: Delay -> Feedback -> Delay
            delayNode.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            
            // Route envelope into both dry and wet delay lines
            filterNode.connect(ampGain);
            ampGain.connect(this.masterGain); // dry signal
            
            ampGain.connect(delayNode);       // input to delay
            delayNode.connect(delayBlendGain); 
            delayBlendGain.connect(this.masterGain); // wet signal
        } else {
            filterNode.connect(ampGain);
            ampGain.connect(this.masterGain);
        }

        osc.start(now);
        osc.stop(stopTime);
    }

    /* ==========================================================================
       PRECISION SEQUENCER CLOCK & SCHEDULER
       ========================================================================== */

    /**
     * Starts sequencer playback
     */
    startSequencer() {
        this.resume();
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        
        // Start scheduler loop
        this.schedulerTimer = setInterval(() => this.scheduler(), this.lookahead);
    }

    /**
     * Stops sequencer playback
     */
    stopSequencer() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
        this.currentStep = 0;
    }

    /**
     * Checks scheduler queue and schedules notes for any events in lookahead window
     */
    scheduler() {
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleStep(this.currentStep, this.nextNoteTime);
            this.advanceStep();
        }
    }

    /**
     * Advances step index and computes next step time
     */
    advanceStep() {
        const secondsPerBeat = 60.0 / this.bpm;
        const stepDuration = secondsPerBeat / 4; // 16th note steps (quarter beat)
        
        this.nextNoteTime += stepDuration;
        
        // Loop step index 0-15
        this.currentStep = (this.currentStep + 1) % 16;
    }

    /**
     * Evaluates grids for active notes and triggers them at precision time
     */
    scheduleStep(stepIndex, time) {
        // UI notification for ticking column (must execute on main thread frame)
        if (this.onStepTick) {
            // Schedule GUI draw slightly ahead to match visual lag
            setTimeout(() => {
                if (this.isPlaying && this.onStepTick) {
                    this.onStepTick(stepIndex);
                }
            }, (time - this.ctx.currentTime) * 1000);
        }

        // 1. Kick Drum
        if (this.grid.kick[stepIndex]) {
            this.triggerKick(time);
        }

        // 2. Snare Drum
        if (this.grid.snare[stepIndex]) {
            this.triggerSnare(time);
        }

        // 3. Hi-Hat
        if (this.grid.hihat[stepIndex]) {
            this.triggerHiHat(time);
        }

        // 4. Bass Track Synth (Notes centered on space-vibes C2/G2)
        if (this.grid.bass[stepIndex]) {
            let notes = ['C3', 'E3', 'G3', 'C3', 'F3', 'A3', 'G3', 'E3'];
            if (this.currentPreset === 'cyber-drive') {
                notes = ['F3', 'A3', 'C4', 'A3', 'G3', 'B3', 'D4', 'B3'];
            } else if (this.currentPreset === 'retro-waves') {
                notes = ['C3', 'G3', 'C3', 'G3', 'D3', 'A3', 'D3', 'A3'];
            } else if (this.currentPreset === 'ambient-fog') {
                notes = ['C2', 'G2', 'C3', 'G2', 'F2', 'C3', 'F2', 'C3'];
            }
            const freq = this.frequencies[notes[stepIndex % notes.length]] || 130.81;
            this.triggerSynthNote(freq, time, 0.25);
        }

        // 5. Lead Synth Track (Higher notes C4/E4/G4/A4)
        if (this.grid.lead[stepIndex]) {
            let notes = ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4', 'C4']; // Twinkle Twinkle
            if (this.currentPreset === 'cyber-drive') {
                notes = ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4', 'G3', 'D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'D4', 'A3'];
            } else if (this.currentPreset === 'retro-waves') {
                notes = ['E4', 'G4', 'A4', 'B4', 'A4', 'G4', 'E4', 'D4', 'E4', 'G4', 'A4', 'C5', 'B4', 'A4', 'G4', 'D4'];
            } else if (this.currentPreset === 'ambient-fog') {
                notes = ['C4', 'G4', 'C5', 'G4', 'F4', 'C5', 'F4', 'C4', 'E4', 'B4', 'E5', 'B4', 'D4', 'A4', 'D5', 'A4'];
            }
            const freq = this.frequencies[notes[stepIndex % notes.length]] || 261.63;
            this.triggerSynthNote(freq, time, 0.3);
        }
    }

    /**
     * Toggles sequencer block state
     */
    togglePad(track, stepIndex) {
        if (this.grid[track] !== undefined) {
            this.grid[track][stepIndex] = !this.grid[track][stepIndex];
            return this.grid[track][stepIndex];
        }
        return false;
    }

    /**
     * Clears all sequencer tracks
     */
    clearMatrix() {
        for (let track in this.grid) {
            this.grid[track].fill(false);
        }
    }

    /**
     * Loads preset sequences
     */
    loadPreset(presetName) {
        this.clearMatrix();
        this.currentPreset = presetName;
        
        switch (presetName) {
            case 'space-odyssey':
                this.bpm = 95; // child-friendly calming tempo
                // Kick
                [0, 8].forEach(i => this.grid.kick[i] = true);
                // Snare
                [8].forEach(i => this.grid.snare[i] = true);
                // Hihat
                [2, 6, 10, 14].forEach(i => this.grid.hihat[i] = true);
                // Bass
                [0, 4, 8, 12].forEach(i => this.grid.bass[i] = true);
                // Lead - Sweet Twinkle Twinkle pattern
                [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14].forEach(i => this.grid.lead[i] = true);
                
                // Synth parameters
                this.oscType = 'sine';
                this.adsr = { attack: 0.15, decay: 0.2, sustain: 0.6, release: 0.6 };
                this.filter = { cutoff: 1800, resonance: 1.0 };
                this.delay = { enabled: true, time: 0.3, feedback: 0.4 };
                break;
                
            case 'cyber-drive':
                this.bpm = 105; // playful, not too fast
                // Playful jumpy rhythm
                [0, 4, 8, 12].forEach(i => this.grid.kick[i] = true);
                [4, 12].forEach(i => this.grid.snare[i] = true);
                [2, 6, 10, 14].forEach(i => this.grid.hihat[i] = true);
                // Bass
                [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => this.grid.bass[i] = true);
                // Lead
                [0, 3, 6, 8, 11, 14].forEach(i => this.grid.lead[i] = true);
                
                // Synth parameters
                this.oscType = 'triangle';
                this.adsr = { attack: 0.05, decay: 0.15, sustain: 0.5, release: 0.3 };
                this.filter = { cutoff: 2000, resonance: 1.2 };
                this.delay = { enabled: true, time: 0.2, feedback: 0.3 };
                break;

            case 'retro-waves':
                this.bpm = 100;
                [0, 8].forEach(i => this.grid.kick[i] = true);
                [4, 12].forEach(i => this.grid.snare[i] = true);
                [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => this.grid.hihat[i] = true);
                [0, 4, 8, 12].forEach(i => this.grid.bass[i] = true);
                [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => this.grid.lead[i] = true);
                
                // Synth parameters
                this.oscType = 'triangle';
                this.adsr = { attack: 0.08, decay: 0.2, sustain: 0.6, release: 0.4 };
                this.filter = { cutoff: 2200, resonance: 1.5 };
                this.delay = { enabled: true, time: 0.33, feedback: 0.4 };
                break;

            case 'ambient-fog':
                this.bpm = 80; // slow lullaby
                [0, 8].forEach(i => this.grid.kick[i] = true);
                [4, 12].forEach(i => this.grid.hihat[i] = true);
                [0, 8].forEach(i => this.grid.bass[i] = true);
                [0, 4, 8, 12].forEach(i => this.grid.lead[i] = true);
                
                // Synth parameters
                this.oscType = 'sine';
                this.adsr = { attack: 0.5, decay: 0.8, sustain: 0.7, release: 1.2 };
                this.filter = { cutoff: 1200, resonance: 0.8 };
                this.delay = { enabled: true, time: 0.5, feedback: 0.5 };
                break;
        }
    }
}
