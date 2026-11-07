import React from 'react';
import { InteractionState, AnimationQuality, AudioReactionMetrics } from '../../types/jarvis';

interface NeuralNetworkCoreProps {
  interactionState: InteractionState;
  getAudioMetrics: () => AudioReactionMetrics;
  goldIntensity: number;
  animationQuality: AnimationQuality;
  performanceMode: 'auto' | '60fps' | 'power-saver';
  reducedMotion: boolean;
  showOrbRings?: boolean;
  showNetworkFilaments?: boolean;
  showHolographicParticles?: boolean;
  onCoreTap: () => void;
  onCoreHoldStart?: () => void;
  onCoreHoldEnd?: () => void;
  touchMode: 'tap-toggle' | 'hold-to-talk';
  onFpsReport?: (fps: number, activeNodes: number, activeFilaments: number) => void;
}

export const NeuralNetworkCore: React.FC<NeuralNetworkCoreProps> = ({
  interactionState, reducedMotion, showOrbRings = true,
  showNetworkFilaments = true, showHolographicParticles = true,
  onCoreTap, onCoreHoldStart, onCoreHoldEnd, touchMode,
}) => {
  const active = interactionState === 'listening' || interactionState === 'speaking';
  return (
    <div className={`jarvis-frequency-stage ${reducedMotion ? 'motion-reduced' : ''}`}>
      <button type="button" className={`jarvis-frequency-orb state-${interactionState}`}
        aria-label={active ? 'JARVIS AI frequency core active' : 'JARVIS AI frequency core. Tap to speak'}
        onPointerDown={() => { if (touchMode === 'hold-to-talk') onCoreHoldStart?.(); }}
        onPointerUp={() => { if (touchMode === 'hold-to-talk') onCoreHoldEnd?.(); else onCoreTap(); }}
        onPointerCancel={() => onCoreHoldEnd?.()}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCoreTap(); } }}>
        <span className="frequency-aura" />
        {showOrbRings && <><span className="frequency-ring ring-one" /><span className="frequency-ring ring-two" /><span className="frequency-ring ring-three" /></>}
        {showNetworkFilaments && <svg className="frequency-waveform" viewBox="0 0 320 180" role="presentation">
          <defs><linearGradient id="frequencyGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#258EDB" stopOpacity=".12" /><stop offset="48%" stopColor="#8B9DF0" stopOpacity=".9" /><stop offset="100%" stopColor="#E9A5C5" stopOpacity=".18" />
          </linearGradient></defs>
          <path className="wave wave-back" d="M8 90 C32 90 35 68 54 68 S76 112 96 112 S119 40 140 40 S163 137 184 137 S208 64 229 64 S251 104 270 104 S292 90 312 90" />
          <path className="wave wave-front" d="M8 90 C32 90 35 80 54 80 S76 100 96 100 S119 57 140 57 S163 122 184 122 S208 78 229 78 S251 96 270 96 S292 90 312 90" />
        </svg>}
        <span className="frequency-core"><span className="frequency-core-inner" /><span className="frequency-core-glint" /></span>
        {showHolographicParticles && <><i className="frequency-particle particle-a" /><i className="frequency-particle particle-b" /><i className="frequency-particle particle-c" /><i className="frequency-particle particle-d" /></>}
      </button>
    </div>
  );
};
