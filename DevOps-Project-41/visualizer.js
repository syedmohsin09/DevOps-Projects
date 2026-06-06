/**
 * NEBULASYNTH - AUDIO VISUALIZER ENGINE
 * Renders high-performance, real-time waveform and frequency visuals on HTML5 Canvas.
 */

class Visualizer {
    /**
     * @param {HTMLCanvasElement} canvasElement The canvas DOM node
     * @param {AnalyserNode} analyserNode Web Audio Analyser node reference
     */
    constructor(canvasElement, analyserNode) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.analyser = analyserNode;
        this.mode = 'waveform'; // 'waveform' or 'frequency'
        this.animationId = null;
        
        // Starfield particles reacting to music intensity
        this.stars = [];
        this.numStars = 40;
        this.initStars();
        
        // Handle window resizing
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Resizes canvas buffer size to match client bounding box
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    /**
     * Initializes background starfield particles
     */
    initStars() {
        this.stars = [];
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push({
                x: Math.random() * 400,
                y: Math.random() * 200,
                radius: Math.random() * 1.5 + 0.5,
                speed: Math.random() * 0.5 + 0.1,
                color: Math.random() > 0.5 ? '#00f0ff' : '#ff007f',
                alpha: Math.random() * 0.5 + 0.3
            });
        }
    }

    /**
     * Starts rendering animation loop
     */
    start() {
        if (this.animationId) return;
        this.render();
    }

    /**
     * Stops rendering animation loop
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Updates and draws background stars based on volume/intensity
     * @param {number} intensity Scale from 0 to 1
     */
    drawStars(intensity) {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.stars.forEach(star => {
            // Stars move across screen
            star.x -= star.speed * (1 + intensity * 6);
            if (star.x < 0) {
                star.x = width;
                star.y = Math.random() * height;
            }

            // Draw glowing star
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.radius * (1 + intensity * 1.5), 0, Math.PI * 2);
            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = star.alpha * (0.4 + intensity * 0.6);
            this.ctx.shadowBlur = 8 * intensity;
            this.ctx.shadowColor = star.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0; // reset
        });
        
        this.ctx.globalAlpha = 1.0; // reset alpha
    }

    /**
     * High-speed Canvas loop
     */
    render() {
        this.animationId = requestAnimationFrame(() => this.render());
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        // 1. Clear with slight opacity trail to create a motion blur effect
        this.ctx.fillStyle = 'rgba(4, 5, 13, 0.25)';
        this.ctx.fillRect(0, 0, width, height);

        // Grid lines behind visualizer
        this.drawGrid(width, height);

        if (!this.analyser) {
            // Draw dummy flatline when audio isn't active
            this.drawDummyLine(width, height);
            return;
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Calculate average amplitude (intensity) for particle reactivity
        let averageAmplitude = 0;

        if (this.mode === 'waveform') {
            this.analyser.getByteTimeDomainData(dataArray);
            
            // Calculate average offset from center line (intensity)
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += Math.abs(dataArray[i] - 128);
            }
            averageAmplitude = sum / bufferLength / 64; // normalize roughly to 0.0 - 1.0
            
            // Draw background stars pulsing to music
            this.drawStars(averageAmplitude);
            
            // Draw actual waveform
            this.drawWaveform(dataArray, bufferLength, width, height);
        } else {
            this.analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            averageAmplitude = sum / bufferLength / 255;
            
            this.drawStars(averageAmplitude);
            this.drawSpectrum(dataArray, bufferLength, width, height);
        }
    }

    /**
     * Draws background wireframe grid lines
     */
    drawGrid(width, height) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        this.ctx.lineWidth = 1;
        
        const gridSize = 30;
        
        for (let x = 0; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Draws waveform line
     */
    drawWaveform(dataArray, bufferLength, width, height) {
        this.ctx.lineWidth = 3;
        
        // Gradient stroke
        const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#00f0ff');
        gradient.addColorStop(0.5, '#ab00ff');
        gradient.addColorStop(1, '#ff007f');
        this.ctx.strokeStyle = gradient;

        // Glowing shadow effect
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';

        this.ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // 0.0 to 2.0
            const y = (v * height) / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // reset
    }

    /**
     * Draws frequency bar spectrum
     */
    drawSpectrum(dataArray, bufferLength, width, height) {
        // Limit rendering to active human-hearable spectrum bins (first 65% of buffer)
        const activeBins = Math.floor(bufferLength * 0.65);
        const barWidth = (width / activeBins) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < activeBins; i++) {
            barHeight = (dataArray[i] / 255.0) * height * 0.85;

            // Gradient per bar
            const barGrad = this.ctx.createLinearGradient(0, height, 0, height - barHeight);
            barGrad.addColorStop(0, '#ab00ff');   // purple bottom
            barGrad.addColorStop(0.6, '#ff007f'); // magenta mid
            barGrad.addColorStop(1, '#00f0ff');   // cyan peak

            this.ctx.fillStyle = barGrad;
            
            // Glowing peaks
            if (barHeight > 10) {
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
            }
            
            // Draw bar with slight top rounding
            this.ctx.beginPath();
            this.ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
            this.ctx.fill();
            this.ctx.shadowBlur = 0; // reset

            x += barWidth;
        }
    }

    /**
     * Flatline placeholder when audio engine is uninitialized
     */
    drawDummyLine(width, height) {
        this.drawStars(0);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2);
        
        // Render a subtle idle waving line
        const time = Date.now() * 0.003;
        for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * 0.02 + time) * 3;
            this.ctx.lineTo(x, y);
        }
        
        this.ctx.stroke();
    }
}
