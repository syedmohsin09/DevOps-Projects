/**
 * NEBULASYNTH - CORE APPLICATION COORDINATOR
 * Manages UI interactions, bindings, preset loadings, piano keyboard events,
 * and bridges the Audio Engine and Canvas Visualizer together.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate Audio and Visualizer engines
    const audio = new AudioEngine();
    let visualizer = null;

    // UI Elements Selector Cache
    const matrixContainer = document.getElementById('sequencer-matrix');
    const timelineDotsContainer = document.getElementById('timeline-dots');
    
    // Transport Buttons
    const playBtn = document.getElementById('play-btn');
    const clearBtn = document.getElementById('clear-btn');
    const bpmVal = document.getElementById('bpm-val');
    const bpmMinus = document.getElementById('bpm-minus');
    const bpmPlus = document.getElementById('bpm-plus');

    // Synth Controls
    const oscRadioGroup = document.getElementsByName('osc-type');
    const masterGainSlider = document.getElementById('master-gain');
    const valMasterGain = document.getElementById('val-master-gain');

    // ADSR Faders
    const adsrControls = {
        attack: { input: document.getElementById('adsr-attack'), label: document.getElementById('val-attack'), suffix: 's' },
        decay: { input: document.getElementById('adsr-decay'), label: document.getElementById('val-decay'), suffix: 's' },
        sustain: { input: document.getElementById('adsr-sustain'), label: document.getElementById('val-sustain'), suffix: '' },
        release: { input: document.getElementById('adsr-release'), label: document.getElementById('val-release'), suffix: 's' }
    };

    // Filter Dials
    const filterCutoffInput = document.getElementById('filter-cutoff');
    const filterCutoffPlate = document.getElementById('cutoff-plate');
    const valCutoff = document.getElementById('val-cutoff');
    
    const filterResInput = document.getElementById('filter-resonance');
    const filterResPlate = document.getElementById('res-plate');
    const valRes = document.getElementById('val-res');

    // Space Delay
    const delayToggle = document.getElementById('delay-toggle');
    const delayControls = document.getElementById('delay-controls');
    const delayTimeInput = document.getElementById('delay-time');
    const valDelayTime = document.getElementById('val-delay-time');
    const delayFeedbackInput = document.getElementById('delay-feedback');
    const valDelayFeedback = document.getElementById('val-delay-feedback');

    // Presets
    const presetBtns = document.querySelectorAll('.preset-btn');

    // Audio Start Overlay
    const startOverlay = document.getElementById('start-overlay');
    const initAudioBtn = document.getElementById('init-audio-btn');

    // Visualizer modes
    const visualizerCanvas = document.getElementById('visualizer-canvas');
    const modeBtns = document.querySelectorAll('.mode-btn');

    // Help Modal
    const helpBtn = document.getElementById('help-btn');
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Piano Keyboard
    const pianoKeys = document.querySelectorAll('.key');
    const activeComputerKeys = new Set(); // Tracks currently held keys

    // Tracks Definitions for Sequencer Layout
    const tracksList = [
        { id: 'kick', name: 'Kick', icon: 'fa-drum' },
        { id: 'snare', name: 'Snare', icon: 'fa-scissors' },
        { id: 'hihat', name: 'Hi-Hat', icon: 'fa-bars-staggered' },
        { id: 'bass', name: 'Bass', icon: 'fa-wave-square' },
        { id: 'lead', name: 'Lead', icon: 'fa-wand-magic-sparkles' }
    ];

    /* ==========================================================================
       1. INITIALIZE MATRIX & UI ELEMENTS
       ========================================================================== */

    function createSequencerGrid() {
        matrixContainer.innerHTML = '';
        timelineDotsContainer.innerHTML = '';
        
        // A. Generate Rows
        tracksList.forEach(track => {
            const row = document.createElement('div');
            row.className = `matrix-row row-${track.id}`;
            
            // Track header labels
            const trackInfo = document.createElement('div');
            trackInfo.className = 'track-info';
            trackInfo.innerHTML = `
                <i class="fa-solid ${track.icon} track-icon"></i>
                <span class="track-name">${track.name}</span>
            `;
            row.appendChild(trackInfo);
            
            // 16 step pads
            const padsGrid = document.createElement('div');
            padsGrid.className = 'pads-grid';
            
            for (let step = 0; step < 16; step++) {
                const pad = document.createElement('button');
                pad.className = 'pad';
                pad.dataset.track = track.id;
                pad.dataset.step = step;
                
                // Color accent shading on beat marks (1, 5, 9, 13)
                if (step % 4 === 0) {
                    pad.classList.add('beat-accent');
                }
                
                // Event interaction
                pad.addEventListener('click', () => {
                    audio.resume(); // ensuring audio context starts
                    const isActive = audio.togglePad(track.id, step);
                    pad.classList.toggle('active', isActive);
                    
                    // Synthesize short test preview of the instrument on grid click
                    if (isActive) {
                        previewInstrument(track.id);
                    }
                });
                
                padsGrid.appendChild(pad);
            }
            row.appendChild(padsGrid);
            matrixContainer.appendChild(row);
        });

        // B. Generate Timeline indicators dots
        for (let step = 0; step < 16; step++) {
            const dot = document.createElement('div');
            dot.className = 'timeline-dot';
            timelineDotsContainer.appendChild(dot);
        }
    }

    /**
     * Preview single instrument triggers for audio feedback during programming
     */
    function previewInstrument(trackId) {
        if (!audio.ctx) return;
        const now = audio.ctx.currentTime;
        switch (trackId) {
            case 'kick': audio.triggerKick(now); break;
            case 'snare': audio.triggerSnare(now); break;
            case 'hihat': audio.triggerHiHat(now); break;
            case 'bass': audio.triggerSynthNote(audio.frequencies['C2'], now, 0.15); break;
            case 'lead': audio.triggerSynthNote(audio.frequencies['C4'], now, 0.2); break;
        }
    }

    /**
     * Updates Dial Plate elements visual rotate angles to match range values
     */
    function updateDialRotation(input, plateElement) {
        const val = parseFloat(input.value);
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);
        
        // Percent of total range
        const pct = (val - min) / (max - min);
        // Map 0-1 to -135deg to +135deg rotation
        const deg = -135 + pct * 270;
        
        const indicator = plateElement.querySelector('.dial-indicator');
        if (indicator) {
            indicator.style.transform = `rotate(${deg}deg)`;
        }
    }

    /**
     * Set synth slider panel values to sync engine configuration parameters
     */
    function updateSynthUI() {
        // Osc type
        oscRadioGroup.forEach(radio => {
            radio.checked = (radio.value === audio.oscType);
        });

        // ADSR Faders
        for (let param in adsrControls) {
            const config = adsrControls[param];
            config.input.value = audio.adsr[param];
            config.label.textContent = `${audio.adsr[param]}${config.suffix}`;
        }

        // Filters Cutoff
        filterCutoffInput.value = audio.filter.cutoff;
        valCutoff.textContent = `${audio.filter.cutoff} Hz`;
        updateDialRotation(filterCutoffInput, filterCutoffPlate);

        // Filter Resonance
        filterResInput.value = audio.filter.resonance;
        valRes.textContent = audio.filter.resonance.toFixed(1);
        updateDialRotation(filterResInput, filterResPlate);

        // Delay Toggle
        delayToggle.checked = audio.delay.enabled;
        if (audio.delay.enabled) {
            delayControls.classList.remove('disabled-overlay');
        } else {
            delayControls.classList.add('disabled-overlay');
        }
        delayTimeInput.value = audio.delay.time;
        valDelayTime.textContent = `${audio.delay.time}s`;
        delayFeedbackInput.value = audio.delay.feedback;
        valDelayFeedback.textContent = `${Math.round(audio.delay.feedback * 100)}%`;

        // BPM input
        bpmVal.value = audio.bpm;

        // Sync matrix pads to loaded grid coordinates
        tracksList.forEach(track => {
            const rowPads = document.querySelectorAll(`.row-${track.id} .pad`);
            rowPads.forEach((pad, idx) => {
                const isActive = audio.grid[track.id][idx];
                pad.classList.toggle('active', isActive);
            });
        });
    }

    /* ==========================================================================
       2. EVENT HANDLERS & LISTENERS
       ========================================================================== */

    // A. Start Audio Engine Overlay
    function triggerAudioInit() {
        audio.resume().then(() => {
            // Fade out overlay
            startOverlay.style.opacity = '0';
            setTimeout(() => startOverlay.style.display = 'none', 500);

            // Initialize canvas visualizer
            if (!visualizer) {
                visualizer = new Visualizer(visualizerCanvas, audio.analyser);
                visualizer.start();
            }
        });
    }

    initAudioBtn.addEventListener('click', triggerAudioInit);
    startOverlay.addEventListener('click', triggerAudioInit);

    // B. Transport Commands
    playBtn.addEventListener('click', () => {
        audio.resume();
        if (audio.isPlaying) {
            audio.stopSequencer();
            playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
            playBtn.classList.remove('pause-mode');
            
            // Clear cursor ticks
            document.querySelectorAll('.pad').forEach(p => p.classList.remove('playing'));
            document.querySelectorAll('.timeline-dot').forEach(d => d.classList.remove('active'));
        } else {
            audio.startSequencer();
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            playBtn.classList.add('pause-mode');
        }
    });

    clearBtn.addEventListener('click', () => {
        audio.clearMatrix();
        document.querySelectorAll('.pad').forEach(p => p.classList.remove('active'));
    });

    // BPM Modifiers
    bpmVal.addEventListener('change', () => {
        let val = parseInt(bpmVal.value);
        if (isNaN(val)) val = 120;
        val = Math.max(60, Math.min(240, val));
        bpmVal.value = val;
        audio.bpm = val;
    });

    bpmMinus.addEventListener('click', () => {
        let val = parseInt(bpmVal.value) - 5;
        val = Math.max(60, val);
        bpmVal.value = val;
        audio.bpm = val;
    });

    bpmPlus.addEventListener('click', () => {
        let val = parseInt(bpmVal.value) + 5;
        val = Math.max(val, 60);
        val = Math.min(240, val);
        bpmVal.value = val;
        audio.bpm = val;
    });

    // C. Knobs and Slider Bindings
    oscRadioGroup.forEach(radio => {
        radio.addEventListener('change', () => {
            audio.oscType = radio.value;
        });
    });

    // ADSR Listeners
    for (let param in adsrControls) {
        const config = adsrControls[param];
        config.input.addEventListener('input', () => {
            const val = parseFloat(config.input.value);
            audio.adsr[param] = val;
            config.label.textContent = `${val}${config.suffix}`;
        });
    }

    // Filter Cutoff Dial dragging
    filterCutoffInput.addEventListener('input', () => {
        const val = parseInt(filterCutoffInput.value);
        audio.filter.cutoff = val;
        valCutoff.textContent = `${val} Hz`;
        updateDialRotation(filterCutoffInput, filterCutoffPlate);
    });

    // Filter Resonance Dial dragging
    filterResInput.addEventListener('input', () => {
        const val = parseFloat(filterResInput.value);
        audio.filter.resonance = val;
        valRes.textContent = val.toFixed(1);
        updateDialRotation(filterResInput, filterResPlate);
    });

    // Space Delay toggle & inputs
    delayToggle.addEventListener('change', () => {
        const isEnabled = delayToggle.checked;
        audio.delay.enabled = isEnabled;
        if (isEnabled) {
            delayControls.classList.remove('disabled-overlay');
        } else {
            delayControls.classList.add('disabled-overlay');
        }
    });

    delayTimeInput.addEventListener('input', () => {
        const val = parseFloat(delayTimeInput.value);
        audio.delay.time = val;
        valDelayTime.textContent = `${val}s`;
    });

    delayFeedbackInput.addEventListener('input', () => {
        const val = parseFloat(delayFeedbackInput.value);
        audio.delay.feedback = val;
        valDelayFeedback.textContent = `${Math.round(val * 100)}%`;
    });

    // Master Volume Control
    masterGainSlider.addEventListener('input', () => {
        const val = parseFloat(masterGainSlider.value);
        audio.setVolume(val);
        valMasterGain.textContent = `${Math.round(val * 100)}%`;
    });

    // D. Presets Loading
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const preset = btn.dataset.preset;
            audio.loadPreset(preset);
            updateSynthUI();
        });
    });

    // E. Visualizer Modes Toggling
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (visualizer) {
                visualizer.mode = btn.dataset.mode;
            }
        });
    });

    // F. Help Modals
    helpBtn.addEventListener('click', () => shortcutsModal.classList.add('open'));
    modalCloseBtn.addEventListener('click', () => shortcutsModal.classList.remove('open'));
    
    // Close modal when clicking dark background
    shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) shortcutsModal.classList.remove('open');
    });

    /* ==========================================================================
       3. INTERACTIVE PIANO KEYBOARD & BINDINGS
       ========================================================================== */

    /**
     * Play Note event trigger helper
     */
    function playPianoKey(keyElement) {
        audio.resume();
        const note = keyElement.dataset.note;
        const freq = audio.frequencies[note];
        
        // Trigger sound node
        audio.triggerSynthNote(freq, audio.ctx.currentTime, 0.4);
        keyElement.classList.add('active');
    }

    function releasePianoKey(keyElement) {
        keyElement.classList.remove('active');
    }

    // Keyboard mouse click bindings
    pianoKeys.forEach(key => {
        key.addEventListener('mousedown', (e) => {
            e.preventDefault();
            playPianoKey(key);
        });
        
        key.addEventListener('mouseup', () => releasePianoKey(key));
        key.addEventListener('mouseleave', () => releasePianoKey(key));

        // Touch support
        key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            playPianoKey(key);
        });
        key.addEventListener('touchend', () => releasePianoKey(key));
    });

    // Computer keyboard mappings to keys
    const computerKeysMap = {
        'a': 'C4', 'w': 'C#4', 's': 'D4', 'e': 'D#4', 'd': 'E4',
        'f': 'F4', 't': 'F#4', 'g': 'G4', 'y': 'G#4', 'h': 'A4',
        'u': 'A#4', 'j': 'B4'
    };

    window.addEventListener('keydown', (e) => {
        // Bypass if focus is inside numbers inputs (like BPM input)
        if (document.activeElement.tagName === 'INPUT') return;

        const char = e.key.toLowerCase();
        
        // Keyboard synth notes trigger
        if (computerKeysMap[char] !== undefined) {
            // Prevent note trigger repeat while held down
            if (!activeComputerKeys.has(char)) {
                activeComputerKeys.add(char);
                const note = computerKeysMap[char];
                const keyNode = document.querySelector(`.key[data-note="${note}"]`);
                if (keyNode) {
                    playPianoKey(keyNode);
                }
            }
        }
        
        // Spacebar toggling play transport
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            playBtn.click();
        }
        
        // Escape clearing matrix grid
        if (e.key === 'Escape') {
            e.preventDefault();
            clearBtn.click();
        }
    });

    window.addEventListener('keyup', (e) => {
        const char = e.key.toLowerCase();
        if (computerKeysMap[char] !== undefined) {
            activeComputerKeys.delete(char);
            const note = computerKeysMap[char];
            const keyNode = document.querySelector(`.key[data-note="${note}"]`);
            if (keyNode) {
                releasePianoKey(keyNode);
            }
        }
    });

    /* ==========================================================================
       4. HIGH-PRECISION RUNTIME SYNCRONIZATION
       ========================================================================== */

    // Connect audio tick advancement step directly to UI render
    audio.onStepTick = (stepIndex) => {
        // Schedule UI updates on requestAnimationFrame frame
        requestAnimationFrame(() => {
            // 1. Advance the running column visual glow across pads
            tracksList.forEach(track => {
                const rowPads = document.querySelectorAll(`.row-${track.id} .pad`);
                rowPads.forEach((pad, idx) => {
                    if (idx === stepIndex) {
                        pad.classList.add('playing');
                    } else {
                        pad.classList.remove('playing');
                    }
                });
            });

            // 2. Advance the running timeline dots indicators
            const dots = timelineDotsContainer.querySelectorAll('.timeline-dot');
            dots.forEach((dot, idx) => {
                if (idx === stepIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        });
    };

    /* ==========================================================================
       5. BOOTSTRAP INITIAL LOADING
       ========================================================================== */

    // Build the grid UI
    createSequencerGrid();

    // Load Odyssey preset as default configuration
    audio.loadPreset('space-odyssey');
    
    // Synchronize loaded values on sliders
    updateSynthUI();
});
