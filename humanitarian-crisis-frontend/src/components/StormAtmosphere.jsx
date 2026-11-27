import React, { useEffect, useRef, useState, useCallback } from 'react';
import './StormAtmosphere.css';

/**
 * Realistic Storm Atmosphere:
 * - Multi-layer particle rain simulation with wind physics & ground splashes
 * - Procedural fractal branching lightning bolts with multi-phase illumination
 * - Web Audio API synthesized ambient rain & thunder rumble (zero external media files)
 * - Touch-friendly audio & intensity controls
 */

// Web Audio API Synthesizers for Rain and Thunder
class StormAudioEngine {
  constructor() {
    this.ctx = null;
    this.rainGain = null;
    this.rainSource = null;
    this.masterGain = null;
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  async startRain() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.rainSource) return;

    // Generate 4 seconds of continuous natural pink/brown rain noise
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Filter towards brown noise for deep rain wash
      lastOut = (lastOut + 0.025 * white) / 1.025;
      output[i] = lastOut * 3.5;
    }

    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = buffer;
    this.rainSource.loop = true;

    // Filter rain frequencies to sound like outdoor heavy downpour
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    // Smooth fade in
    this.rainGain.gain.exponentialRampToValueAtTime(0.22, this.ctx.currentTime + 1.5);

    this.rainSource.connect(rainFilter);
    rainFilter.connect(highpass);
    highpass.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    this.rainSource.start(0);
    this.isPlaying = true;
  }

  stopRain() {
    if (!this.ctx || !this.rainGain) return;
    try {
      this.rainGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6);
      setTimeout(() => {
        if (this.rainSource) {
          try { this.rainSource.stop(); } catch (_) {}
          this.rainSource.disconnect();
          this.rainSource = null;
        }
        this.isPlaying = false;
      }, 700);
    } catch (_) {
      this.isPlaying = false;
    }
  }

  playThunder(intensity = 1.0) {
    if (!this.ctx || !this.isPlaying) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const duration = 2.5 + Math.random() * 2.5 * intensity;

    // 1. Low frequency noise burst for the roaring thunder crackle
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.96 * b1 + white * 0.11;
      b2 = 0.86 * b2 + white * 0.25;
      data[i] = (b0 + b1 + b2) * 0.7;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Resonant lowpass to shape the rolling bass roar
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(45, now + duration);
    filter.Q.setValueAtTime(3.5, now);

    const thunderGain = this.ctx.createGain();
    const peakVolume = Math.min(0.85, 0.45 * intensity);
    thunderGain.gain.setValueAtTime(0.001, now);
    // Sudden shock impact
    thunderGain.gain.exponentialRampToValueAtTime(peakVolume, now + 0.08);
    // Rumbling decay
    thunderGain.gain.exponentialRampToValueAtTime(peakVolume * 0.4, now + 0.6);
    thunderGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(thunderGain);
    thunderGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);

    // 2. Sub-bass resonant sine wave drop (creates that deep physical chest rumble)
    try {
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(90, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 1.2);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(peakVolume * 0.55, now + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);

      subOsc.start(now);
      subOsc.stop(now + 1.6);
    } catch (_) {}
  }
}

const audioSingleton = new StormAudioEngine();

export default function StormAtmosphere({ enabled = true }) {
  const canvasRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      return localStorage.getItem('humanaid_storm_sound') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [lightningFlash, setLightningFlash] = useState(0); // 0 to 1 opacity
  const [stormLevel, setStormLevel] = useState('storm'); // 'storm' | 'calm' | 'off'
  const [minimized, setMinimized] = useState(true);

  // Toggle Sound
  const toggleAudio = useCallback(async () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    try {
      localStorage.setItem('humanaid_storm_sound', String(nextState));
    } catch (_) {}

    if (nextState) {
      await audioSingleton.startRain();
    } else {
      audioSingleton.stopRain();
    }
  }, [audioEnabled]);

  // Main Canvas Animation: Rain drops + Splashes + Lightning Bolts
  useEffect(() => {
    if (!enabled || stormLevel === 'off') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Rain drop generator (fewer particles on mobile for 60fps smoothness)
    const isMobile = width < 768;
    const dropCount = isMobile ? (stormLevel === 'storm' ? 140 : 60) : (stormLevel === 'storm' ? 320 : 130);

    const drops = [];
    for (let i = 0; i < dropCount; i++) {
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 16 + Math.random() * 24,
        len: 18 + Math.random() * 32,
        opacity: 0.2 + Math.random() * 0.55,
        width: Math.random() < 0.2 ? 1.8 : 1.1,
      });
    }

    const splashes = [];
    const addSplash = (x, y) => {
      if (splashes.length > 50) return;
      splashes.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3.5,
        vy: -Math.random() * 3.5 - 1.5,
        radius: 0.8 + Math.random() * 1.5,
        alpha: 0.8,
        life: 1.0,
      });
    };

    // Lightning bolt procedural structure
    let activeBolt = null;

    const createLightningBolt = (startX, startY, endX, endY, branchLevel = 0) => {
      const segments = [];
      const distance = Math.hypot(endX - startX, endY - startY);
      const steps = Math.max(6, Math.floor(distance / 25));
      let curX = startX;
      let curY = startY;

      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const targetX = startX + (endX - startX) * progress;
        const targetY = startY + (endY - startY) * progress;
        // Jagged offset
        const sway = (Math.random() - 0.5) * 45 * (1 - branchLevel * 0.25);
        const nextX = targetX + sway;
        const nextY = targetY;

        segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

        // Branching fork
        if (branchLevel < 2 && Math.random() < 0.28 && i > 2 && i < steps - 1) {
          const forkAngle = (Math.random() - 0.5) * 1.2;
          const forkLen = (1 - progress) * distance * 0.5;
          const forkEndX = nextX + Math.sin(forkAngle) * forkLen;
          const forkEndY = nextY + Math.cos(forkAngle) * forkLen;
          segments.push(...createLightningBolt(nextX, nextY, forkEndX, forkEndY, branchLevel + 1));
        }

        curX = nextX;
        curY = nextY;
      }
      return segments;
    };

    // Lightning strike scheduler
    let lightningTimer = null;

    const triggerLightning = () => {
      if (stormLevel !== 'storm') return;

      const strikeIntensity = 0.6 + Math.random() * 0.4;
      const startX = width * (0.2 + Math.random() * 0.6);
      const endX = startX + (Math.random() - 0.5) * width * 0.4;
      const endY = height * (0.65 + Math.random() * 0.35);

      activeBolt = {
        segments: createLightningBolt(startX, 0, endX, endY),
        alpha: 1.0,
      };

      // Multi-flash sequence (Strike -> Quick dip -> Big second flash -> Fade)
      setLightningFlash(0.65 * strikeIntensity);
      setTimeout(() => setLightningFlash(0.15), 60);
      setTimeout(() => setLightningFlash(0.95 * strikeIntensity), 120);
      setTimeout(() => setLightningFlash(0.35), 230);
      setTimeout(() => {
        setLightningFlash(0);
        activeBolt = null;
      }, 380);

      // Thunder audio with physical speed-of-sound delay (300ms to 1200ms)
      const thunderDelay = 350 + Math.random() * 850;
      setTimeout(() => {
        audioSingleton.playThunder(strikeIntensity);
      }, thunderDelay);

      // Schedule next strike (every 7 to 16 seconds)
      const nextInterval = 7000 + Math.random() * 9000;
      lightningTimer = setTimeout(triggerLightning, nextInterval);
    };

    // First lightning after 3 seconds
    lightningTimer = setTimeout(triggerLightning, 3000);

    // Wind oscillation angle (~14 to 20 degrees)
    let time = 0;

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const windAngle = 0.24 + Math.sin(time * 0.4) * 0.06;
      const windX = Math.sin(windAngle);
      const windY = Math.cos(windAngle);

      // 1. Draw Rain Streaks
      ctx.strokeStyle = '#cbe4ff';
      ctx.lineCap = 'round';

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        ctx.lineWidth = d.width;
        ctx.globalAlpha = d.opacity;

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + windX * d.len, d.y + windY * d.len);
        ctx.stroke();

        // Move drop
        d.x += windX * d.speed;
        d.y += windY * d.speed;

        // Reset if hit ground or out of view
        if (d.y > height) {
          if (Math.random() < 0.25) {
            addSplash(d.x, height - 2);
          }
          d.y = -d.len - Math.random() * 20;
          d.x = Math.random() * (width + 100) - 50;
        }
        if (d.x > width + 50) {
          d.x = -50;
        }
      }

      // 2. Draw Splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.globalAlpha = s.alpha * 0.6;
        ctx.fillStyle = '#d8ecff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.18; // gravity
        s.alpha -= 0.05;

        if (s.alpha <= 0 || s.y > height) {
          splashes.splice(i, 1);
        }
      }

      // 3. Draw Lightning Bolt
      if (activeBolt && activeBolt.segments) {
        ctx.save();
        ctx.shadowColor = '#90e0ef';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.95;

        ctx.beginPath();
        for (const seg of activeBolt.segments) {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        }
        ctx.stroke();

        // Inner glowing core
        ctx.strokeStyle = '#cbf4ff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.globalAlpha = 1.0;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (lightningTimer) clearTimeout(lightningTimer);
    };
  }, [enabled, stormLevel]);

  return (
    <>
      {/* Visual Canvas for Falling Rain & Lightning Bolt */}
      {stormLevel !== 'off' && (
        <canvas
          ref={canvasRef}
          className="storm-canvas"
          aria-hidden="true"
        />
      )}

      {/* Screen Lightning Flash Overlay */}
      <div
        className="storm-lightning-flash"
        style={{
          opacity: lightningFlash,
          transition: lightningFlash > 0.3 ? 'opacity 0.05s ease-out' : 'opacity 0.3s ease-out',
        }}
        aria-hidden="true"
      />

      {/* Interactive Storm Controller Widget */}
      <div className={`storm-controller ${minimized ? 'is-minimized' : ''}`}>
        {minimized ? (
          <button
            type="button"
            className="storm-pill-btn"
            onClick={() => setMinimized(false)}
            title="Storm Atmosphere Settings (Rain, Thunder & Lightning)"
            aria-label="Open storm atmosphere controls"
          >
            <span className="storm-icon">⛈️</span>
            <span className="storm-label">Storm FX</span>
            {audioEnabled && <span className="storm-sound-dot" title="Sound Active" />}
          </button>
        ) : (
          <div className="storm-panel">
            <div className="storm-panel-header">
              <div className="storm-panel-title">
                <span>⛈️</span>
                <strong>Live Storm FX</strong>
              </div>
              <button
                type="button"
                className="storm-close-btn"
                onClick={() => setMinimized(true)}
                aria-label="Minimize storm controls"
              >
                ✕
              </button>
            </div>

            <p className="storm-panel-desc">
              Realistic storm simulation with dynamic rain streaks, thunder rumbling & lightning strikes.
            </p>

            <div className="storm-actions">
              <button
                type="button"
                className={`storm-audio-toggle ${audioEnabled ? 'is-active' : ''}`}
                onClick={toggleAudio}
                aria-pressed={audioEnabled}
              >
                <span>{audioEnabled ? '🔊' : '🔇'}</span>
                <span>{audioEnabled ? 'Thunder & Rain Audio: ON' : 'Audio Muted (Tap to enable)'}</span>
              </button>

              <div className="storm-intensity-group">
                <span className="storm-intensity-label">Atmosphere:</span>
                <div className="storm-intensity-buttons">
                  <button
                    type="button"
                    className={stormLevel === 'storm' ? 'is-selected' : ''}
                    onClick={() => setStormLevel('storm')}
                  >
                    ⛈️ Heavy Storm
                  </button>
                  <button
                    type="button"
                    className={stormLevel === 'calm' ? 'is-selected' : ''}
                    onClick={() => setStormLevel('calm')}
                  >
                    🌧️ Mild Rain
                  </button>
                  <button
                    type="button"
                    className={stormLevel === 'off' ? 'is-selected' : ''}
                    onClick={() => setStormLevel('off')}
                  >
                    ☀️ Off
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
