import React, { useEffect, useRef, useState, useCallback } from 'react';
import './StormAtmosphere.css';

/**
 * HUMANAID Atmosphere Simulation:
 * - Dimmed, realistic lightning flashes with procedural branching fractal bolts
 * - Soft ambient sky illumination (no harsh blinding flashes)
 * - Synthesized low-frequency thunder rumble via Web Audio API (zero external media files)
 * - Zero rain streaks (clean interface background)
 */

// Web Audio API Synthesizer for Thunder Rumble
class StormAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
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

  // Realistic synthesized multi-stage thunder rumble
  playThunder(intensity = 0.5) {
    if (!this.ctx || this.ctx.state === 'suspended') return;

    try {
      const now = this.ctx.currentTime;
      const duration = 2.4 + Math.random() * 1.8;

      // 1. Pink noise burst for thunder cracking/rolling
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

      // Resonant lowpass filter to mimic distance roll
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140 + intensity * 80, now);
      filter.frequency.exponentialRampToValueAtTime(45, now + duration);

      const thunderGain = this.ctx.createGain();
      thunderGain.gain.setValueAtTime(0.001, now);
      // Soft attack
      thunderGain.gain.exponentialRampToValueAtTime(0.35 * intensity, now + 0.12);
      // Secondary rumble rolling swells
      thunderGain.gain.exponentialRampToValueAtTime(0.24 * intensity, now + 0.55);
      thunderGain.gain.exponentialRampToValueAtTime(0.18 * intensity, now + 1.1);
      thunderGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noiseSource.connect(filter);
      filter.connect(thunderGain);
      thunderGain.connect(this.masterGain);

      noiseSource.start(now);

      // 2. Sub-bass oscillator for physical low-frequency room rumble (30-55 Hz)
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 1.6);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.exponentialRampToValueAtTime(0.28 * intensity, now + 0.15);
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
  const [stormLevel, setStormLevel] = useState('storm'); // 'storm' | 'calm' | 'off'
  const [minimized, setMinimized] = useState(true);

  // Toggle Sound
  const toggleAudio = useCallback(async () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    try {
      localStorage.setItem('humanaid_storm_sound', String(nextState));
    } catch (_) { }

    if (nextState) {
      await audioSingleton.resumeContext();
    }
  }, [audioEnabled]);

  // Main Canvas Animation: Clean lightning atmosphere (zero rain streaks)
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

    // Lightning strike scheduler with multi-flash bursts and distinct pauses
    let lightningTimer = null;

    const triggerLightning = (clickX = null, clickY = null) => {
      if (stormLevel === 'off') return;

      const strikeIntensity = 0.45 + Math.random() * 0.25;
      const startX = clickX !== null
        ? Math.max(40, Math.min(width - 40, clickX + (Math.random() - 0.5) * 60))
        : width * (0.2 + Math.random() * 0.6);
      const endX = clickX !== null ? clickX : startX + (Math.random() - 0.5) * width * 0.35;
      const endY = clickY !== null ? Math.max(height * 0.35, clickY) : height * (0.6 + Math.random() * 0.3);

      // Flash execution helper
      const showFlash = (intensity, withBolt, durationMs) => {
        if (withBolt) {
          activeBolt = {
            segments: createLightningBolt(startX, 0, endX, endY),
            alpha: 0.60,
          };
        }
        setLightningFlash(intensity);
        setTimeout(() => {
          setLightningFlash(0);
          if (withBolt) activeBolt = null;
        }, durationMs);
      };

      // 1. Initial preliminary soft sheet flash (140ms)
      showFlash(0.25 * strikeIntensity, false, 140);

      // PAUSE (380ms of darkness)

      // 2. Main lightning strike with visible fractal bolt (240ms) - dimmed
      setTimeout(() => {
        showFlash(0.55 * strikeIntensity, true, 240);
      }, 520);

      // PAUSE (420ms of darkness)

      // 3. Occasional secondary ambient after-flash (gentle, 180ms)
      if (Math.random() < 0.65) {
        setTimeout(() => {
          showFlash(0.20 * strikeIntensity, false, 180);
        }, 1160);
      }

      // Thunder rumble following the main strike with realistic physical delay
      if (audioEnabled) {
        const soundDelay = 580 + Math.random() * 500;
        setTimeout(() => {
          if (audioEnabled) {
            audioSingleton.playThunder(strikeIntensity);
          }
        }, soundDelay);
      }
    };

    // Global click/tap listener to trigger lightning flash on user interaction
    const handleDocumentInteraction = (event) => {
      if (event.target && event.target.closest && event.target.closest('.storm-controller')) {
        return;
      }
      const clientX = event.clientX ?? (event.touches && event.touches[0] ? event.touches[0].clientX : null);
      const clientY = event.clientY ?? (event.touches && event.touches[0] ? event.touches[0].clientY : null);
      triggerLightning(clientX, clientY);
    };

    window.addEventListener('click', handleDocumentInteraction, { passive: true });
    window.addEventListener('touchend', handleDocumentInteraction, { passive: true });

    // Flash immediately when requested on mount (e.g., login page opened)
    if (flashOnMount) {
      setTimeout(() => {
        triggerLightning();
      }, 350);
    }

    // Schedule next random lightning strike (spaced out with calm pauses)
    const scheduleNextStrike = () => {
      const minInterval = stormLevel === 'storm' ? 14000 : 28000;
      const randomRange = stormLevel === 'storm' ? 16000 : 32000;
      const delay = minInterval + Math.random() * randomRange;

      lightningTimer = setTimeout(() => {
        triggerLightning();
        scheduleNextStrike();
      }, delay);
    };

    scheduleNextStrike();

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw Lightning Bolt (soft & dimmed, no rain streaks)
      if (activeBolt && activeBolt.segments) {
        ctx.save();
        ctx.shadowColor = '#90e0ef';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = activeBolt.alpha || 0.6;

        ctx.beginPath();
        for (const seg of activeBolt.segments) {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        }
        ctx.stroke();

        // Inner glowing core
        ctx.strokeStyle = '#cbf4ff';
        ctx.lineWidth = 0.9;
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
      window.removeEventListener('click', handleDocumentInteraction);
      window.removeEventListener('touchend', handleDocumentInteraction);
      if (lightningTimer) clearTimeout(lightningTimer);
    };
  }, [enabled, stormLevel, audioEnabled, flashOnMount]);

  if (!enabled) return null;

  return (
    <>
      {/* Visual Canvas for Lightning Bolt */}
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
            aria-label="Toggle Lightning Atmosphere controls"
            title="Lightning Atmosphere Settings"
          >
            <span className="storm-icon">⚡</span>
            <span className="storm-label">Atmosphere</span>
            {audioEnabled && <span className="storm-sound-dot" title="Thunder audio active" />}
          </button>
        ) : (
          <div className="storm-panel">
            <div className="storm-panel-header">
              <div className="storm-panel-title">
                <span>⚡</span>
                <strong>Lightning Atmosphere</strong>
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
              Realistic atmospheric lightning flashes on click/tap and occasional random strikes with thunder audio.
            </p>

            <div className="storm-actions">
              <button
                type="button"
                className={`storm-audio-toggle ${audioEnabled ? 'is-active' : ''}`}
                onClick={toggleAudio}
                aria-pressed={audioEnabled}
              >
                <span>{audioEnabled ? '🔊' : '🔇'}</span>
                <span>{audioEnabled ? 'Thunder Audio: ON' : 'Audio Muted (Tap to enable)'}</span>
              </button>

              <div className="storm-intensity-group">
                <span className="storm-intensity-label">Lightning Frequency:</span>
                <div className="storm-intensity-buttons">
                  <button
                    type="button"
                    className={stormLevel === 'storm' ? 'is-selected' : ''}
                    onClick={() => setStormLevel('storm')}
                  >
                    ⚡ Active
                  </button>
                  <button
                    type="button"
                    className={stormLevel === 'calm' ? 'is-selected' : ''}
                    onClick={() => setStormLevel('calm')}
                  >
                    🌤️ Calm
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
