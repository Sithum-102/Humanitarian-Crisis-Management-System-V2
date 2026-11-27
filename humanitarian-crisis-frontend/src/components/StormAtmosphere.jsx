import React, { useEffect, useRef, useState, useCallback } from 'react';
import './StormAtmosphere.css';

/**
 * HUMANAID Realistic Storm & Rain Atmosphere Simulation:
 * - Natural 3D multi-depth particle rain with fluid physics and wind sway
 * - Soft ground droplet splashes
 * - Dimmed, realistic lightning flashes with branching fractal bolts
 * - Soft ambient sky illumination (no harsh blinding glare)
 * - Rain drops dynamically catch lightning flash illumination
 * - Synthesized low-frequency thunder rumble & ambient rain wash via Web Audio API
 */

// Web Audio API Synthesizer for Rain and Thunder
class StormAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.rainGain = null;
    this.rainSource = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  async resumeContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  async startRain() {
    await this.resumeContext();
    if (!this.ctx) return;
    if (this.rainSource) return;

    // Generate continuous natural pink/brown rain noise buffer
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 0.45;
    }

    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = buffer;
    this.rainSource.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(180, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.rainGain.gain.exponentialRampToValueAtTime(0.18, this.ctx.currentTime + 1.2);

    this.rainSource.connect(rainFilter);
    rainFilter.connect(highpass);
    highpass.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    this.rainSource.start(0);
  }

  stopRain() {
    if (!this.ctx || !this.rainGain) return;
    try {
      this.rainGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
      setTimeout(() => {
        if (this.rainSource) {
          try { this.rainSource.stop(); } catch (_) { }
          this.rainSource.disconnect();
          this.rainSource = null;
        }
      }, 500);
    } catch (_) { }
  }

  stopAll() {
    this.stopRain();
  }

  // Realistic synthesized multi-stage thunder rumble
  playThunder(intensity = 0.5) {
    if (!this.ctx || this.ctx.state === 'suspended') return;

    try {
      const now = this.ctx.currentTime;
      const duration = 2.4 + Math.random() * 1.8;

      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140 + intensity * 80, now);
      filter.frequency.exponentialRampToValueAtTime(45, now + duration);

      const thunderGain = this.ctx.createGain();
      thunderGain.gain.setValueAtTime(0.001, now);
      thunderGain.gain.exponentialRampToValueAtTime(0.32 * intensity, now + 0.12);
      thunderGain.gain.exponentialRampToValueAtTime(0.22 * intensity, now + 0.55);
      thunderGain.gain.exponentialRampToValueAtTime(0.16 * intensity, now + 1.1);
      thunderGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noiseSource.connect(filter);
      filter.connect(thunderGain);
      thunderGain.connect(this.masterGain);

      noiseSource.start(now);

      // Low rumble sub-bass
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(52, now);
      subOsc.frequency.exponentialRampToValueAtTime(26, now + 1.6);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.exponentialRampToValueAtTime(0.25 * intensity, now + 0.15);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);

      subOsc.start(now);
      subOsc.stop(now + 1.6);
    } catch (_) { }
  }
}

const audioSingleton = new StormAudioEngine();

export default function StormAtmosphere({ enabled = true, flashOnMount = false }) {
  const canvasRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      return localStorage.getItem('humanaid_storm_sound') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [lightningFlash, setLightningFlash] = useState(0); // 0 to 1 opacity
  const lightningFlashRef = useRef(0);
  const [stormLevel, setStormLevel] = useState('storm'); // 'storm' | 'calm' | 'off'
  const [minimized, setMinimized] = useState(true);

  const updateLightningFlash = (val) => {
    lightningFlashRef.current = val;
    setLightningFlash(val);
  };

  // Toggle Sound
  const toggleAudio = useCallback(async () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    try {
      localStorage.setItem('humanaid_storm_sound', String(nextState));
    } catch (_) { }

    if (nextState) {
      await audioSingleton.startRain();
    } else {
      audioSingleton.stopRain();
    }
  }, [audioEnabled]);

  // Audio lifecycle
  useEffect(() => {
    if (!audioEnabled || stormLevel === 'off') {
      audioSingleton.stopRain();
    } else if (audioEnabled && stormLevel !== 'off') {
      audioSingleton.startRain();
    }
  }, [audioEnabled, stormLevel]);

  // Main Canvas Animation: Realistic Multi-Depth Rain & Lightning Simulation
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

    // Realistic Raindrop Generator with 3D Depth Layers (Background, Midground, Foreground)
    // Slower, graceful, peaceful rain speed
    const isMobile = width < 768;
    const totalDrops = isMobile ? (stormLevel === 'storm' ? 70 : 35) : (stormLevel === 'storm' ? 145 : 70);

    const drops = [];
    for (let i = 0; i < totalDrops; i++) {
      // 3 Layers: 0 = Far (tiny, very slow), 1 = Mid (calm, steady), 2 = Near (gentle foreground)
      const layer = Math.random() < 0.45 ? 0 : Math.random() < 0.8 ? 1 : 2;

      drops.push({
        layer,
        x: Math.random() * (width + 100) - 50,
        y: Math.random() * height,
        speed: layer === 0 ? (1.6 + Math.random() * 1.1) : layer === 1 ? (2.7 + Math.random() * 1.5) : (4.0 + Math.random() * 1.8),
        len: layer === 0 ? (7 + Math.random() * 5) : layer === 1 ? (11 + Math.random() * 7) : (18 + Math.random() * 8),
        baseOpacity: layer === 0 ? (0.07 + Math.random() * 0.05) : layer === 1 ? (0.13 + Math.random() * 0.07) : (0.19 + Math.random() * 0.08),
        width: layer === 0 ? 0.75 : layer === 1 ? 0.95 : 1.25,
      });
    }

    // Ground splash particles (slow, gentle droplets)
    const splashes = [];
    const addSplash = (x, y, layer) => {
      if (splashes.length > 35) return;
      const count = layer === 2 ? 2 : 1;
      for (let s = 0; s < count; s++) {
        splashes.push({
          x,
          y,
          vx: (Math.random() - 0.5) * (layer === 2 ? 1.4 : 0.9),
          vy: -Math.random() * (layer === 2 ? 1.3 : 0.8) - 0.4,
          radius: layer === 0 ? 0.5 : 0.8,
          alpha: 0.45,
        });
      }
    };

    // Lightning bolt procedural structure
    let activeBolt = null;

    const createLightningBolt = (startX, startY, endX, endY, branchLevel = 0) => {
      const segments = [];
      const distance = Math.hypot(endX - startX, endY - startY);
      const steps = Math.max(6, Math.floor(distance / 28));
      let curX = startX;
      let curY = startY;

      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const targetX = startX + (endX - startX) * progress;
        const targetY = startY + (endY - startY) * progress;
        const sway = (Math.random() - 0.5) * 40 * (1 - branchLevel * 0.25);
        const nextX = targetX + sway;
        const nextY = targetY;

        segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

        if (branchLevel < 2 && Math.random() < 0.25 && i > 2 && i < steps - 1) {
          const forkAngle = (Math.random() - 0.5) * 1.1;
          const forkLen = (1 - progress) * distance * 0.45;
          const forkEndX = nextX + Math.sin(forkAngle) * forkLen;
          const forkEndY = nextY + Math.cos(forkAngle) * forkLen;
          segments.push(...createLightningBolt(nextX, nextY, forkEndX, forkEndY, branchLevel + 1));
        }

        curX = nextX;
        curY = nextY;
      }
      return segments;
    };

    // Lightning strike scheduler with dimmed, soft flashes and occasional timing
    let lightningTimer = null;
    let mountTimer = null;
    let lastInteractionTime = 0;

    const triggerLightning = (clickX = null, clickY = null, isUserInteraction = false) => {
      if (stormLevel === 'off') return;

      // Dimmed intensity (never blinding or harsh)
      const strikeIntensity = isUserInteraction ? 0.20 : (0.18 + Math.random() * 0.10);
      const startX = clickX !== null
        ? Math.max(40, Math.min(width - 40, clickX + (Math.random() - 0.5) * 60))
        : width * (0.2 + Math.random() * 0.6);
      const endX = clickX !== null ? clickX : startX + (Math.random() - 0.5) * width * 0.35;
      const endY = clickY !== null ? Math.max(height * 0.35, clickY) : height * (0.55 + Math.random() * 0.25);

      const showFlash = (intensity, withBolt, durationMs) => {
        if (withBolt) {
          activeBolt = {
            segments: createLightningBolt(startX, 0, endX, endY),
            alpha: 0.28,
          };
        }
        updateLightningFlash(intensity);
        setTimeout(() => {
          updateLightningFlash(0);
          if (withBolt) activeBolt = null;
        }, durationMs);
      };

      if (isUserInteraction) {
        // Immediate, soft & dimmed response on click or tap (~180ms total duration)
        showFlash(0.14 * strikeIntensity, false, 70);
        setTimeout(() => {
          showFlash(0.24 * strikeIntensity, true, 130);
        }, 75);

        if (audioEnabled) {
          setTimeout(() => {
            if (audioEnabled) audioSingleton.playThunder(0.16);
          }, 450);
        }
        return;
      }

      // Natural occasional environmental lightning (dimmed, serene, occasional)
      // 1. Initial faint preliminary sheet flash (100ms)
      showFlash(0.12 * strikeIntensity, false, 100);

      // PAUSE (420ms of calm darkness)

      // 2. Soft, dimmed lightning strike with delicate fractal bolt (160ms)
      setTimeout(() => {
        showFlash(0.22 * strikeIntensity, true, 160);
      }, 520);

      // Low, gentle thunder rumble
      if (audioEnabled) {
        const soundDelay = 650 + Math.random() * 450;
        setTimeout(() => {
          if (audioEnabled) {
            audioSingleton.playThunder(strikeIntensity * 0.5);
          }
        }, soundDelay);
      }
    };

    // Global listener: triggers lightning flash immediately whenever someone clicks or taps anywhere
    const handleDocumentInteraction = (event) => {
      // Don't flash if toggling the audio/storm controller widget
      if (event.target && event.target.closest && event.target.closest('.storm-controller')) {
        return;
      }
      const now = Date.now();
      if (now - lastInteractionTime < 280) return; // Prevent rapid multi-tap strobing
      lastInteractionTime = now;

      const clientX = event.clientX ?? (event.touches && event.touches[0] ? event.touches[0].clientX : null);
      const clientY = event.clientY ?? (event.touches && event.touches[0] ? event.touches[0].clientY : null);
      triggerLightning(clientX, clientY, true);
    };

    window.addEventListener('pointerdown', handleDocumentInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', handleDocumentInteraction, { capture: true, passive: true });

    // Flash immediately when requested on mount (e.g., login page opened)
    if (flashOnMount) {
      mountTimer = setTimeout(() => {
        triggerLightning(null, null, true);
      }, 250);
    }

    // Schedule next random lightning strike (occasional, spaced out with peaceful quiet intervals)
    const scheduleNextStrike = () => {
      const minInterval = stormLevel === 'storm' ? 45000 : 65000;
      const randomRange = stormLevel === 'storm' ? 40000 : 55000;
      const delay = minInterval + Math.random() * randomRange;

      lightningTimer = setTimeout(() => {
        triggerLightning();
        scheduleNextStrike();
      }, delay);
    };

    scheduleNextStrike();

    // Natural gentle wind oscillation (~8 to 12 degrees)
    let time = 0;

    const render = () => {
      time += 0.007; // Gentle, slow wind sway
      ctx.clearRect(0, 0, width, height);

      const windAngle = 0.18 + Math.sin(time * 0.35) * 0.03;
      const windX = Math.sin(windAngle);
      const windY = Math.cos(windAngle);

      // 1. Draw Realistic Slow-Falling Raindrops
      ctx.strokeStyle = '#cbe4ff';
      ctx.lineCap = 'round';

      const curFlash = lightningFlashRef.current;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        ctx.lineWidth = d.width;
        // Drops slightly illuminate when lightning flashes
        const dynamicAlpha = Math.min(0.65, d.baseOpacity + curFlash * 0.25);
        ctx.globalAlpha = dynamicAlpha;

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + windX * d.len, d.y + windY * d.len);
        ctx.stroke();

        d.x += windX * d.speed;
        d.y += windY * d.speed;

        // Reset if reached bottom
        if (d.y > height) {
          if (Math.random() < 0.18) {
            addSplash(d.x, height - 2, d.layer);
          }
          d.y = -d.len - Math.random() * 20;
          d.x = Math.random() * (width + 100) - 50;
        }
        if (d.x > width + 60) {
          d.x = -60;
        }
      }

      // 2. Draw Ground Splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.globalAlpha = s.alpha * 0.45;
        ctx.fillStyle = '#d8ecff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.08; // slow gravity
        s.alpha -= 0.035;

        if (s.alpha <= 0 || s.y > height) {
          splashes.splice(i, 1);
        }
      }

      // 3. Draw Lightning Bolt (soft, dimmed & non-distracting)
      if (activeBolt && activeBolt.segments) {
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 5;
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.0;
        ctx.globalAlpha = (activeBolt.alpha || 0.25) * 0.5;

        ctx.beginPath();
        for (const seg of activeBolt.segments) {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        }
        ctx.stroke();

        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 0.6;
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
      window.removeEventListener('pointerdown', handleDocumentInteraction, { capture: true });
      window.removeEventListener('touchstart', handleDocumentInteraction, { capture: true });
      if (lightningTimer) clearTimeout(lightningTimer);
      if (mountTimer) clearTimeout(mountTimer);
    };
  }, [enabled, stormLevel, audioEnabled, flashOnMount]);

  if (!enabled) return null;

  return (
    <>
      {/* Visual Canvas for Realistic Rain & Lightning Bolt */}
      <canvas ref={canvasRef} className="storm-canvas" aria-hidden="true" />

      {/* Screen flash layer with soft, dimmed opacity */}
      {lightningFlash > 0 && (
        <div
          className="storm-lightning-flash"
          style={{ opacity: lightningFlash }}
          aria-hidden="true"
        />
      )}

      {/* Interactive Controls Widget (floating pill button at bottom-left) */}
      <div className="storm-controller">
        {minimized ? (
          <button
            type="button"
            className="storm-pill-btn"
            onClick={() => setMinimized(false)}
            aria-label="Toggle Storm Atmosphere controls"
            title="Storm Atmosphere Settings (Rain & Lightning)"
          >
            <span className="storm-icon">⛈️</span>
            <span className="storm-label">Storm FX</span>
            {audioEnabled && <span className="storm-sound-dot" title="Rain & Thunder audio active" />}
          </button>
        ) : (
          <div className="storm-panel">
            <div className="storm-panel-header">
              <div className="storm-panel-title">
                <span>⛈️</span>
                <strong>Storm Atmosphere</strong>
              </div>
              <button
                type="button"
                className="storm-close-btn"
                onClick={() => setMinimized(true)}
                aria-label="Close atmosphere settings"
              >
                ✕
              </button>
            </div>

            <p className="storm-panel-desc">
              Realistic multi-depth rain shower with dimmed lightning flashes and synthesized audio.
            </p>

            <div className="storm-actions">
              <button
                type="button"
                className={`storm-audio-toggle ${audioEnabled ? 'is-active' : ''}`}
                onClick={toggleAudio}
                aria-pressed={audioEnabled}
              >
                <span>{audioEnabled ? '🔊' : '🔇'}</span>
                <span>{audioEnabled ? 'Rain & Thunder Audio: ON' : 'Audio Muted (Tap to enable)'}</span>
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
                    🌧️ Steady Rain
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
