import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  AnimationQuality,
  AudioReactionMetrics,
  InteractionState,
} from '../../types/jarvis';

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

interface NeuronNode {
  baseX: number;
  baseY: number;
  baseZ: number;
  curX: number;
  curY: number;
  curZ: number;
  expandDirX: number;
  expandDirY: number;
  expandDirZ: number;
  elasticity: number;
  easeRate: number;
  currentExpansion: number;
  currentWordGlow: number;
  size: number;
  baseBrightness: number;
  pulsePhase: number;
  pulseSpeed: number;
  fireEnergy: number;
  driftFreqX: number;
  driftFreqY: number;
  driftFreqZ: number;
  driftPhase: number;
  colorVariant: number;
}

interface SynapticConnection {
  nodeA: number;
  nodeB: number;
  midOffsetX: number;
  midOffsetY: number;
  midOffsetZ: number;
  archDirX: number;
  archDirY: number;
  archDirZ: number;
  subBranchOffsetX: number;
  subBranchOffsetY: number;
  subBranchOffsetZ: number;
  hasSubBranch: boolean;
  baseAlpha: number;
  plasticityPhase: number;
  plasticitySpeed: number;
  signalBoost: number;
}

interface TravelingPulse {
  connIndex: number;
  t: number;
  speed: number;
  direction: 1 | -1;
  intensity: number;
  size: number;
}

function pseudoNoise3D(x: number, y: number, z: number): number {
  const n = Math.sin(x * 1.37 + y * 2.41 + z * 1.93) * 43758.5453;
  return n - Math.floor(n);
}

export const NeuralNetworkCore: React.FC<NeuralNetworkCoreProps> = ({
  interactionState,
  getAudioMetrics,
  goldIntensity,
  animationQuality,
  performanceMode,
  reducedMotion,
  showOrbRings = true,
  showNetworkFilaments = true,
  showHolographicParticles = true,
  onCoreTap,
  onCoreHoldStart,
  onCoreHoldEnd,
  touchMode,
  onFpsReport,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef<InteractionState>(interactionState);
  const goldRef = useRef<number>(goldIntensity);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const perfModeRef = useRef(performanceMode);
  const showRingsRef = useRef(showOrbRings);
  const showFilamentsRef = useRef(showNetworkFilaments);
  const showParticlesRef = useRef(showHolographicParticles);
  const audioMetricsGetterRef = useRef(getAudioMetrics);
  const fpsCallbackRef = useRef(onFpsReport);
  const touchRippleRef = useRef<{ x: number; y: number; strength: number }>({
    x: 0,
    y: 0,
    strength: 0,
  });

  useEffect(() => {
    stateRef.current = interactionState;
  }, [interactionState]);

  useEffect(() => {
    goldRef.current = goldIntensity;
  }, [goldIntensity]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    perfModeRef.current = performanceMode;
  }, [performanceMode]);

  useEffect(() => {
    showRingsRef.current = showOrbRings;
  }, [showOrbRings]);

  useEffect(() => {
    showFilamentsRef.current = showNetworkFilaments;
  }, [showNetworkFilaments]);

  useEffect(() => {
    showParticlesRef.current = showHolographicParticles;
  }, [showHolographicParticles]);

  useEffect(() => {
    audioMetricsGetterRef.current = getAudioMetrics;
  }, [getAudioMetrics]);

  useEffect(() => {
    fpsCallbackRef.current = onFpsReport;
  }, [onFpsReport]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    const nodeCount =
      animationQuality === 'ultra' ? 340 : animationQuality === 'balanced' ? 220 : 140;
    const maxPulses =
      animationQuality === 'ultra' ? 220 : animationQuality === 'balanced' ? 140 : 80;
    const dustCount =
      animationQuality === 'ultra' ? 180 : animationQuality === 'balanced' ? 100 : 50;

    // 1. Scene, Camera, Renderer setup on pure #000000 canvas
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.04);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const isPortrait = height > width;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 120);
    camera.position.set(0, -0.35, isPortrait ? 17.5 : 13.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless && animationQuality !== 'battery',
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isHeadless
        ? 1
        : Math.min(window.devicePixelRatio || 1, animationQuality === 'ultra' ? 2 : 1.5)
    );
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Faceless Glowing Golden AI Orb & Neural Network Nodes
    // Uses organic 3D spherical-shell & inner-filament distribution (NO human face, NO robot face, NO character)
    const nodes: NeuronNode[] = [];
    for (let i = 0; i < nodeCount; i++) {
      // Distribute nodes within an organic, holographic 3D AI orb volume with subtle surface & interior filaments
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      // Mix of outer holographic shell (r ~ 2.6..4.1) and internal neural core pathways (r ~ 0.9..2.5)
      const isOuterShell = i < Math.floor(nodeCount * 0.55);
      const baseR = isOuterShell
        ? 2.65 + Math.pow(Math.random(), 1.3) * 1.45
        : 0.85 + Math.random() * 1.85;

      // Add organic 3D turbulence so the orb has living holographic texture
      const turb = (pseudoNoise3D(i * 0.37, theta, phi) - 0.5) * 0.72;
      const r = baseR + turb;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const radialLen = Math.max(0.2, Math.hypot(x, y, z));
      const noiseVecX = (pseudoNoise3D(x * 0.7, y * 0.7, z * 0.7) - 0.5) * 0.55;
      const noiseVecY = (pseudoNoise3D(y * 0.7, z * 0.7, x * 0.7) - 0.5) * 0.55;
      const noiseVecZ = (pseudoNoise3D(z * 0.7, x * 0.7, y * 0.7) - 0.5) * 0.55;

      const rawDirX = x / radialLen + noiseVecX;
      const rawDirY = y / radialLen + noiseVecY;
      const rawDirZ = z / radialLen + noiseVecZ;
      const dirNorm = Math.max(0.001, Math.hypot(rawDirX, rawDirY, rawDirZ));

      const elasticity =
        (0.55 + Math.min(1.4, radialLen * 0.24)) * (0.75 + Math.random() * 0.55);
      const easeRate = 8.0 + Math.random() * 8.0;

      const isMajorSoma = Math.random() < 0.15;
      const size = isMajorSoma
        ? 0.21 + Math.random() * 0.16
        : 0.065 + Math.pow(Math.random(), 1.6) * 0.13;

      const baseBrightness = isMajorSoma
        ? 0.8 + Math.random() * 0.2
        : 0.35 + Math.random() * 0.55;

      const colorRoll = Math.random();
      const colorVariant = colorRoll < 0.55 ? 0 : colorRoll < 0.85 ? 1 : 2;

      nodes.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        curX: x,
        curY: y,
        curZ: z,
        expandDirX: rawDirX / dirNorm,
        expandDirY: rawDirY / dirNorm,
        expandDirZ: rawDirZ / dirNorm,
        elasticity,
        easeRate,
        currentExpansion: 0,
        currentWordGlow: 0,
        size,
        baseBrightness,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.7 + Math.random() * 2.2,
        fireEnergy: Math.random() < 0.2 ? Math.random() * 0.6 : 0,
        driftFreqX: 0.18 + Math.random() * 0.28,
        driftFreqY: 0.15 + Math.random() * 0.26,
        driftFreqZ: 0.16 + Math.random() * 0.25,
        driftPhase: Math.random() * 100,
        colorVariant,
      });
    }

    // 3. Build Interconnected Neural Network Lines inside the Golden AI Orb
    const connections: SynapticConnection[] = [];
    const connectedPairs = new Set<string>();

    const buildConnection = (idx1: number, idx2: number, isLongBridge = false) => {
      const minIdx = Math.min(idx1, idx2);
      const maxIdx = Math.max(idx1, idx2);
      const key = `${minIdx}:${maxIdx}`;
      if (connectedPairs.has(key)) return false;
      connectedPairs.add(key);

      const n1 = nodes[minIdx];
      const n2 = nodes[maxIdx];
      const dx = n2.baseX - n1.baseX;
      const dy = n2.baseY - n1.baseY;
      const dz = n2.baseZ - n1.baseZ;
      const d = Math.max(0.001, Math.hypot(dx, dy, dz));

      const curveScale = isLongBridge ? 0.75 : d * (0.11 + Math.random() * 0.13);
      const midOffX = (Math.random() - 0.5) * curveScale;
      const midOffY = (Math.random() - 0.5) * curveScale;
      const midOffZ = (Math.random() - 0.5) * curveScale;

      const avgDirX = (n1.expandDirX + n2.expandDirX) * 0.5;
      const avgDirY = (n1.expandDirY + n2.expandDirY) * 0.5;
      const avgDirZ = (n1.expandDirZ + n2.expandDirZ) * 0.5;

      const hasSubBranch = isLongBridge ? true : Math.random() < 0.24;

      connections.push({
        nodeA: minIdx,
        nodeB: maxIdx,
        midOffsetX: midOffX,
        midOffsetY: midOffY,
        midOffsetZ: midOffZ,
        archDirX: avgDirX * d * 0.12,
        archDirY: avgDirY * d * 0.12,
        archDirZ: avgDirZ * d * 0.12,
        subBranchOffsetX: (Math.random() - 0.5) * curveScale * 1.7,
        subBranchOffsetY: (Math.random() - 0.5) * curveScale * 1.7,
        subBranchOffsetZ: (Math.random() - 0.5) * curveScale * 1.7,
        hasSubBranch,
        baseAlpha: isLongBridge
          ? 0.16
          : Math.max(0.08, Math.min(0.62, (1 - d / 3.4) * 0.62)),
        plasticityPhase: Math.random() * Math.PI * 2,
        plasticitySpeed: 0.25 + Math.random() * 0.75,
        signalBoost: 0,
      });
      return true;
    };

    for (let i = 0; i < nodeCount; i++) {
      const a = nodes[i];
      const candidates: { idx: number; dist: number }[] = [];
      for (let j = 0; j < nodeCount; j++) {
        if (i === j) continue;
        const b = nodes[j];
        const d = Math.hypot(a.baseX - b.baseX, a.baseY - b.baseY, a.baseZ - b.baseZ);
        if (d > 0.3 && d < 3.1) {
          candidates.push({ idx: j, dist: d });
        }
      }
      candidates.sort((c1, c2) => c1.dist - c2.dist);

      const targetLinks = 2 + (i % 3 === 0 ? 2 : i % 2);
      let made = 0;
      for (let k = 0; k < candidates.length && made < targetLinks; k++) {
        const pickIdx =
          k === 0
            ? candidates[0].idx
            : candidates[Math.min(candidates.length - 1, k + Math.floor(Math.random() * 3))].idx;
        if (buildConnection(i, pickIdx, false)) {
          made++;
        }
      }
    }

    // Cross-core holographic neural bridges
    for (let b = 0; b < 20; b++) {
      const idxA = Math.floor(Math.random() * nodeCount);
      const idxB = Math.floor(Math.random() * nodeCount);
      if (idxA !== idxB) {
        buildConnection(idxA, idxB, true);
      }
    }

    // 4. Holographic Golden Energy Rings around the AI Orb (3 Gyroscopic Shader Rings)
    const ringsGroup = new THREE.Group();
    scene.add(ringsGroup);

    const ringConfigs = [
      { radius: 4.15, tiltX: 0.58, tiltY: 0.22, tiltZ: 0.1, speedX: 0.16, speedY: 0.24, opacity: 0.42 },
      { radius: 4.55, tiltX: -0.45, tiltY: 0.65, tiltZ: -0.3, speedX: -0.19, speedY: 0.15, opacity: 0.28 },
      { radius: 3.72, tiltX: 1.12, tiltY: -0.35, tiltZ: 0.4, speedX: 0.12, speedY: -0.22, opacity: 0.34 },
    ];

    const ringMeshes: {
      line: THREE.LineLoop;
      mat: THREE.ShaderMaterial;
      cfg: (typeof ringConfigs)[0];
    }[] = [];

    for (const cfg of ringConfigs) {
      const segs = 128;
      const rPos = new Float32Array(segs * 3);
      const rAngles = new Float32Array(segs);

      for (let s = 0; s < segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        // Subtle organic wave along the holographic energy ring
        const rippleR = cfg.radius + Math.sin(angle * 5.0) * 0.04;
        rPos[s * 3] = Math.cos(angle) * rippleR;
        rPos[s * 3 + 1] = Math.sin(angle) * rippleR;
        rPos[s * 3 + 2] = Math.sin(angle * 3.0) * 0.08;
        rAngles[s] = angle;
      }

      const rGeo = new THREE.BufferGeometry();
      rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
      rGeo.setAttribute('aAngle', new THREE.BufferAttribute(rAngles, 1));

      const rMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uBaseOpacity: { value: cfg.opacity },
          uGoldIntensity: { value: 1.0 },
          uColor: { value: new THREE.Color('#FFC928') },
        },
        vertexShader: `
          attribute float aAngle;
          varying float vAngle;
          void main() {
            vAngle = aAngle;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying float vAngle;
          uniform float uTime;
          uniform float uBaseOpacity;
          uniform float uGoldIntensity;
          uniform vec3 uColor;

          void main() {
            // Traveling holographic light arcs along the golden energy ring
            float arc1 = pow(0.5 + 0.5 * sin(vAngle * 2.0 - uTime * 2.2), 4.0);
            float arc2 = pow(0.5 + 0.5 * cos(vAngle * 3.0 + uTime * 1.5), 6.0);
            float alpha = uBaseOpacity * (0.22 + 0.78 * max(arc1, arc2)) * uGoldIntensity;
            vec3 col = mix(uColor, vec3(1.0, 0.96, 0.82), arc1 * 0.55);
            gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.88));
          }
        `,
      });

      const loop = new THREE.LineLoop(rGeo, rMat);
      loop.rotation.set(cfg.tiltX, cfg.tiltY, cfg.tiltZ);
      ringsGroup.add(loop);
      ringMeshes.push({ line: loop, mat: rMat, cfg });
    }

    // 5. Volumetric Holographic Golden Glow inside the Orb
    const volumetricCount = 8;
    const volPositions = new Float32Array(volumetricCount * 3);
    const volBasePositions = new Float32Array(volumetricCount * 3);
    const volScales = new Float32Array(volumetricCount);
    const volBaseScales = new Float32Array(volumetricCount);
    const volAlphas = new Float32Array(volumetricCount);

    for (let i = 0; i < volumetricCount; i++) {
      const vx = (Math.random() - 0.5) * 2.6;
      const vy = (Math.random() - 0.5) * 2.6;
      const vz = -0.8 + (Math.random() - 0.5) * 2.0;
      volPositions[i * 3] = vx;
      volPositions[i * 3 + 1] = vy;
      volPositions[i * 3 + 2] = vz;
      volBasePositions[i * 3] = vx;
      volBasePositions[i * 3 + 1] = vy;
      volBasePositions[i * 3 + 2] = vz;

      const s = 12.0 + Math.random() * 6.5;
      volScales[i] = s;
      volBaseScales[i] = s;
      volAlphas[i] = 0.048 + Math.random() * 0.035;
    }

    const volGeo = new THREE.BufferGeometry();
    const volPosAttr = new THREE.BufferAttribute(volPositions, 3);
    volPosAttr.setUsage(THREE.DynamicDrawUsage);
    const volScaleAttr = new THREE.BufferAttribute(volScales, 1);
    volScaleAttr.setUsage(THREE.DynamicDrawUsage);
    volGeo.setAttribute('position', volPosAttr);
    volGeo.setAttribute('aScale', volScaleAttr);
    volGeo.setAttribute('aAlpha', new THREE.BufferAttribute(volAlphas, 1));

    const volMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uIntensity: { value: 1.0 },
        uTintColor: { value: new THREE.Color('#D99B16') },
      },
      vertexShader: `
        attribute float aScale;
        attribute float aAlpha;
        varying float vAlpha;
        uniform float uPixelRatio;

        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aScale * uPixelRatio * (18.0 / max(1.0, -mvPosition.z));
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        uniform float uIntensity;
        uniform vec3 uTintColor;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (dist > 1.0) discard;
          float falloff = pow(1.0 - dist, 2.6);
          gl_FragColor = vec4(uTintColor, falloff * vAlpha * uIntensity);
        }
      `,
    });
    const volumetricCloud = new THREE.Points(volGeo, volMat);
    scene.add(volumetricCloud);

    // 6. Neural Filaments Geometry
    let totalLineSegments = 0;
    for (const c of connections) {
      totalLineSegments += c.hasSubBranch ? 3 : 2;
    }

    const linePositions = new Float32Array(totalLineSegments * 2 * 3);
    const lineColors = new Float32Array(totalLineSegments * 2 * 3);
    const lineAlphas = new Float32Array(totalLineSegments * 2);

    const lineGeo = new THREE.BufferGeometry();
    const linePosAttr = new THREE.BufferAttribute(linePositions, 3);
    linePosAttr.setUsage(THREE.DynamicDrawUsage);
    const lineColorAttr = new THREE.BufferAttribute(lineColors, 3);
    lineColorAttr.setUsage(THREE.DynamicDrawUsage);
    const lineAlphaAttr = new THREE.BufferAttribute(lineAlphas, 1);
    lineAlphaAttr.setUsage(THREE.DynamicDrawUsage);

    lineGeo.setAttribute('position', linePosAttr);
    lineGeo.setAttribute('aColor', lineColorAttr);
    lineGeo.setAttribute('aAlpha', lineAlphaAttr);

    const lineMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uGoldIntensity: { value: 1.0 },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vDepthFade;

        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = -mvPosition.z;
          vDepthFade = smoothstep(28.0, 6.0, depth);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vDepthFade;
        uniform float uGoldIntensity;

        void main() {
          float finalAlpha = clamp(vAlpha * vDepthFade * uGoldIntensity, 0.0, 0.95);
          if (finalAlpha < 0.01) discard;
          gl_FragColor = vec4(vColor, finalAlpha);
        }
      `,
    });

    const filamentLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(filamentLines);

    // 7. Glowing Golden Nodes (`THREE.Points`)
    const nodePositions = new Float32Array(nodeCount * 3);
    const nodeSizes = new Float32Array(nodeCount);
    const nodeBrightness = new Float32Array(nodeCount);
    const nodeColors = new Float32Array(nodeCount * 3);

    const colorGold = new THREE.Color('#FFC928');
    const colorAmber = new THREE.Color('#F59E0B');
    const colorChampagne = new THREE.Color('#FFE89E');
    const colorErrorTint = new THREE.Color('#FF6B35');

    for (let i = 0; i < nodeCount; i++) {
      const n = nodes[i];
      nodePositions[i * 3] = n.curX;
      nodePositions[i * 3 + 1] = n.curY;
      nodePositions[i * 3 + 2] = n.curZ;
      nodeSizes[i] = n.size;
      nodeBrightness[i] = n.baseBrightness;

      const c =
        n.colorVariant === 0 ? colorGold : n.colorVariant === 1 ? colorAmber : colorChampagne;
      nodeColors[i * 3] = c.r;
      nodeColors[i * 3 + 1] = c.g;
      nodeColors[i * 3 + 2] = c.b;
    }

    const nodeGeo = new THREE.BufferGeometry();
    const nodePosAttr = new THREE.BufferAttribute(nodePositions, 3);
    nodePosAttr.setUsage(THREE.DynamicDrawUsage);
    const nodeSizeAttr = new THREE.BufferAttribute(nodeSizes, 1);
    nodeSizeAttr.setUsage(THREE.DynamicDrawUsage);
    const nodeBrightAttr = new THREE.BufferAttribute(nodeBrightness, 1);
    nodeBrightAttr.setUsage(THREE.DynamicDrawUsage);
    const nodeColorAttr = new THREE.BufferAttribute(nodeColors, 3);
    nodeColorAttr.setUsage(THREE.DynamicDrawUsage);

    nodeGeo.setAttribute('position', nodePosAttr);
    nodeGeo.setAttribute('aSize', nodeSizeAttr);
    nodeGeo.setAttribute('aBrightness', nodeBrightAttr);
    nodeGeo.setAttribute('aColor', nodeColorAttr);

    const nodeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uGoldIntensity: { value: 1.0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aBrightness;
        attribute vec3 aColor;
        varying float vBrightness;
        varying vec3 vColor;
        varying float vDepthFade;
        uniform float uPixelRatio;

        void main() {
          vBrightness = aBrightness;
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = max(1.0, -mvPosition.z);
          vDepthFade = smoothstep(29.0, 5.5, depth);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * uPixelRatio * (260.0 / depth);
        }
      `,
      fragmentShader: `
        varying float vBrightness;
        varying vec3 vColor;
        varying float vDepthFade;
        uniform float uGoldIntensity;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;

          float core = exp(-d * d * 14.0);
          float halo = pow(max(0.0, 1.0 - d), 2.4) * 0.58;
          float intensity = (core + halo) * vBrightness * vDepthFade * uGoldIntensity;

          vec3 hotCoreColor = mix(vColor, vec3(1.0, 0.97, 0.86), core * 0.72);
          gl_FragColor = vec4(hotCoreColor, clamp(intensity, 0.0, 0.98));
        }
      `,
    });

    const neuronPoints = new THREE.Points(nodeGeo, nodeMat);
    scene.add(neuronPoints);

    // 8. Traveling Synaptic Action-Potential Particles along Filaments
    const pulses: TravelingPulse[] = [];
    for (let i = 0; i < maxPulses; i++) {
      pulses.push({
        connIndex: Math.floor(Math.random() * Math.max(1, connections.length)),
        t: Math.random(),
        speed: 0.35 + Math.random() * 0.85,
        direction: Math.random() < 0.5 ? 1 : -1,
        intensity: 0.4 + Math.random() * 0.6,
        size: 0.07 + Math.random() * 0.08,
      });
    }

    const pulsePositions = new Float32Array(maxPulses * 3);
    const pulseSizes = new Float32Array(maxPulses);
    const pulseIntensities = new Float32Array(maxPulses);

    const pulseGeo = new THREE.BufferGeometry();
    const pulsePosAttr = new THREE.BufferAttribute(pulsePositions, 3);
    pulsePosAttr.setUsage(THREE.DynamicDrawUsage);
    const pulseSizeAttr = new THREE.BufferAttribute(pulseSizes, 1);
    pulseSizeAttr.setUsage(THREE.DynamicDrawUsage);
    const pulseIntAttr = new THREE.BufferAttribute(pulseIntensities, 1);
    pulseIntAttr.setUsage(THREE.DynamicDrawUsage);

    pulseGeo.setAttribute('position', pulsePosAttr);
    pulseGeo.setAttribute('aSize', pulseSizeAttr);
    pulseGeo.setAttribute('aIntensity', pulseIntAttr);

    const pulseMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uGoldIntensity: { value: 1.0 },
        uPulseColor: { value: new THREE.Color('#FFF0A8') },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aIntensity;
        varying float vIntensity;
        uniform float uPixelRatio;

        void main() {
          vIntensity = aIntensity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = max(1.0, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * uPixelRatio * (240.0 / depth);
        }
      `,
      fragmentShader: `
        varying float vIntensity;
        uniform float uGoldIntensity;
        uniform vec3 uPulseColor;

        void main() {
          if (vIntensity <= 0.01) discard;
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          float spark = exp(-d * d * 10.0) + pow(1.0 - d, 2.2) * 0.5;
          gl_FragColor = vec4(uPulseColor, clamp(spark * vIntensity * uGoldIntensity, 0.0, 1.0));
        }
      `,
    });

    const pulsePoints = new THREE.Points(pulseGeo, pulseMat);
    scene.add(pulsePoints);

    // 9. Suspended Golden Holographic Dust Particles
    const dustPositions = new Float32Array(dustCount * 3);
    const dustAlphas = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 18;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      dustAlphas[i] = 0.08 + Math.random() * 0.25;
    }

    const dustGeo = new THREE.BufferGeometry();
    const dustPosAttr = new THREE.BufferAttribute(dustPositions, 3);
    dustPosAttr.setUsage(THREE.DynamicDrawUsage);
    dustGeo.setAttribute('position', dustPosAttr);
    dustGeo.setAttribute('aAlpha', new THREE.BufferAttribute(dustAlphas, 1));

    const dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uGoldIntensity: { value: 1.0 },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        uniform float uPixelRatio;

        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = uPixelRatio * (26.0 / max(1.0, -mvPosition.z));
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        uniform float uGoldIntensity;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          float glow = pow(1.0 - d, 2.0);
          gl_FragColor = vec4(1.0, 0.79, 0.16, glow * vAlpha * uGoldIntensity);
        }
      `,
    });

    const dustCloud = new THREE.Points(dustGeo, dustMat);
    scene.add(dustCloud);

    renderer.compile(scene, camera);

    // 10. Pointer Parallax & Animation Loop
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let smoothPointerX = 0;
    let smoothPointerY = 0;

    const handlePointerMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        pointerTargetX = ((ev.clientX - rect.left) / rect.width - 0.5) * 2;
        pointerTargetY = -((ev.clientY - rect.top) / rect.height - 0.5) * 2;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.position.z = h > w ? 17.5 : 13.8;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    let isPageHidden = document.hidden;
    const handleVisibilityChange = () => {
      isPageHidden = document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    let animFrameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let frameCounter = 0;
    let fpsAccumulator = 0;
    let dynamicPulseCap = maxPulses;

    let smoothSpeedMult = 1.0;
    let smoothGlowMult = 1.0;
    let smoothActivePulseRatio = 0.32;
    let smoothErrorBlend = 0.0;

    let smoothRms = 0.0;
    let smoothWordEnv = 0.0;
    let smoothSyllableEnv = 0.0;
    let smoothEmphasis = 0.0;
    let smoothCloudExpansion = 0.0;
    let lastFrameRenderTime = 0;

    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);

      if (isPageHidden) {
        lastTime = now;
        return;
      }

      if (perfModeRef.current === 'power-saver' && now - lastFrameRenderTime < 31) {
        return;
      }
      lastFrameRenderTime = now;

      const rawDelta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      frameCounter++;
      fpsAccumulator += rawDelta;
      if (fpsAccumulator >= 1.0) {
        const currentFps = Math.round(frameCounter / fpsAccumulator);
        if (perfModeRef.current === 'auto') {
          if (currentFps < 38 && dynamicPulseCap > 50) {
            dynamicPulseCap = Math.max(50, Math.floor(dynamicPulseCap * 0.75));
          } else if (currentFps > 55 && dynamicPulseCap < maxPulses) {
            dynamicPulseCap = Math.min(maxPulses, dynamicPulseCap + 15);
          }
        }
        if (fpsCallbackRef.current) {
          fpsCallbackRef.current(currentFps, nodeCount, connections.length);
        }
        frameCounter = 0;
        fpsAccumulator = 0;
      }

      const curState = stateRef.current;
      const metrics = audioMetricsGetterRef.current
        ? audioMetricsGetterRef.current()
        : {
            rmsEnergy: 0,
            wordEnvelope: 0,
            syllableEnvelope: 0,
            emphasisLevel: 0,
            wordAttackImpulse: 0,
          };
      const isReduced = reducedMotionRef.current;
      const userGold = goldRef.current;

      // Toggle visibility of optional holographic layers
      ringsGroup.visible = showRingsRef.current;
      filamentLines.visible = showFilamentsRef.current;
      dustCloud.visible = showParticlesRef.current;
      pulsePoints.visible = showParticlesRef.current;

      const isVoiceActive = curState === 'speaking' || curState === 'listening';
      const targetRms = isVoiceActive ? metrics.rmsEnergy : 0;
      const targetWord = isVoiceActive ? metrics.wordEnvelope : 0;
      const targetSyllable = isVoiceActive ? metrics.syllableEnvelope : 0;
      const targetEmphasis = isVoiceActive ? metrics.emphasisLevel : 0;

      smoothRms = THREE.MathUtils.damp(
        smoothRms,
        targetRms,
        targetRms > smoothRms ? 16.0 : 9.0,
        rawDelta
      );
      smoothWordEnv = THREE.MathUtils.damp(
        smoothWordEnv,
        targetWord,
        targetWord > smoothWordEnv ? 12.0 : 7.5,
        rawDelta
      );
      smoothSyllableEnv = THREE.MathUtils.damp(
        smoothSyllableEnv,
        targetSyllable,
        targetSyllable > smoothSyllableEnv ? 15.0 : 10.5,
        rawDelta
      );
      smoothEmphasis = THREE.MathUtils.damp(
        smoothEmphasis,
        targetEmphasis,
        targetEmphasis > smoothEmphasis ? 11.0 : 6.5,
        rawDelta
      );

      // Word-synced 3D expansion & contraction of the golden AI orb & neural network
      const rawVoiceExpansion =
        curState === 'speaking'
          ? (smoothWordEnv * 0.48 + smoothSyllableEnv * 0.52) *
            (0.85 + smoothEmphasis * 0.72) *
            1.45
          : curState === 'listening'
          ? (smoothWordEnv * 0.4 + smoothSyllableEnv * 0.6) * 0.75
          : 0.0;

      const targetCloudExpansion = isReduced ? rawVoiceExpansion * 0.35 : rawVoiceExpansion;
      smoothCloudExpansion = THREE.MathUtils.damp(
        smoothCloudExpansion,
        targetCloudExpansion,
        targetCloudExpansion > smoothCloudExpansion ? 11.5 : 8.0,
        rawDelta
      );

      let targetSpeed = 0.46;
      let targetGlow = 0.88;
      let targetPulseRatio = 0.26;
      let targetError = 0.0;

      if (curState === 'idle') {
        targetSpeed = 0.45;
        targetGlow = 0.88;
        targetPulseRatio = 0.26;
      } else if (curState === 'listening') {
        targetSpeed = 0.95 + smoothRms * 1.15;
        targetGlow = 1.05 + smoothRms * 0.42;
        targetPulseRatio = 0.58 + smoothRms * 0.32;
      } else if (curState === 'thinking' || curState === 'uploading') {
        targetSpeed = 2.1;
        targetGlow = 1.22;
        targetPulseRatio = 0.94;
      } else if (curState === 'speaking') {
        targetSpeed = 0.85 + smoothRms * 1.55 + smoothEmphasis * 0.45;
        targetGlow = 0.96 + smoothSyllableEnv * 0.55 + smoothEmphasis * 0.38;
        targetPulseRatio = 0.45 + smoothRms * 0.52;
      } else if (curState === 'error') {
        targetSpeed = 0.35;
        targetGlow = 0.75;
        targetPulseRatio = 0.2;
        targetError = 0.65;
      }

      if (isReduced) {
        targetSpeed *= 0.25;
      }

      smoothSpeedMult = THREE.MathUtils.damp(smoothSpeedMult, targetSpeed, 5.0, rawDelta);
      smoothGlowMult = THREE.MathUtils.damp(smoothGlowMult, targetGlow, 6.5, rawDelta);
      smoothActivePulseRatio = THREE.MathUtils.damp(
        smoothActivePulseRatio,
        targetPulseRatio,
        5.0,
        rawDelta
      );
      smoothErrorBlend = THREE.MathUtils.damp(smoothErrorBlend, targetError, 5.0, rawDelta);

      elapsed += rawDelta * smoothSpeedMult;

      if (touchRippleRef.current.strength > 0.005) {
        touchRippleRef.current.strength *= Math.exp(-3.2 * rawDelta);
      } else {
        touchRippleRef.current.strength = 0;
      }

      smoothPointerX = THREE.MathUtils.damp(smoothPointerX, pointerTargetX, 2.5, rawDelta);
      smoothPointerY = THREE.MathUtils.damp(smoothPointerY, pointerTargetY, 2.5, rawDelta);

      const organicCamBreathX = isReduced ? 0 : Math.sin(elapsed * 0.23) * 0.38;
      const organicCamBreathY = isReduced ? 0 : Math.cos(elapsed * 0.19) * 0.3;
      camera.position.x = smoothPointerX * 1.05 + organicCamBreathX;
      camera.position.y = -0.35 + smoothPointerY * 0.8 + organicCamBreathY;
      camera.lookAt(smoothPointerX * 0.22, -0.35 + smoothPointerY * 0.18, 0);

      const effectiveIntensity = userGold * smoothGlowMult;
      nodeMat.uniforms.uGoldIntensity.value = effectiveIntensity;
      lineMat.uniforms.uGoldIntensity.value = effectiveIntensity;
      pulseMat.uniforms.uGoldIntensity.value = effectiveIntensity;
      dustMat.uniforms.uGoldIntensity.value = effectiveIntensity * 0.75;
      volMat.uniforms.uIntensity.value =
        effectiveIntensity * (0.8 + smoothCloudExpansion * 0.32);

      // Update Holographic Golden Energy Rings (scale and shimmer with word amplitude)
      for (const rm of ringMeshes) {
        rm.mat.uniforms.uTime.value = elapsed;
        rm.mat.uniforms.uGoldIntensity.value =
          effectiveIntensity * (0.85 + smoothSyllableEnv * 0.55);
        const ringScale = 1.0 + smoothCloudExpansion * 0.18;
        rm.line.scale.set(ringScale, ringScale, ringScale);
        if (!isReduced) {
          rm.line.rotation.x += rawDelta * rm.cfg.speedX * smoothSpeedMult;
          rm.line.rotation.y += rawDelta * rm.cfg.speedY * smoothSpeedMult;
        }
      }

      // Expand volumetric glow with spoken words
      for (let v = 0; v < volumetricCount; v++) {
        const volExpand = 1.0 + smoothCloudExpansion * 0.26;
        volPositions[v * 3] = volBasePositions[v * 3] * volExpand;
        volPositions[v * 3 + 1] = volBasePositions[v * 3 + 1] * volExpand;
        volPositions[v * 3 + 2] = volBasePositions[v * 3 + 2] * volExpand;
        volScales[v] = volBaseScales[v] * (1.0 + smoothCloudExpansion * 0.28);
      }
      volPosAttr.needsUpdate = true;
      volScaleAttr.needsUpdate = true;

      // Update Neurons in sync with word & syllable amplitude
      const ripple = touchRippleRef.current;
      for (let i = 0; i < nodeCount; i++) {
        const n = nodes[i];

        let nx = n.baseX;
        let ny = n.baseY;
        let nz = n.baseZ;

        if (!isReduced) {
          const driftAmp = 0.2;
          nx +=
            Math.sin(elapsed * n.driftFreqX + n.driftPhase) * driftAmp +
            Math.cos(elapsed * 0.31 + n.baseY) * 0.06;
          ny +=
            Math.cos(elapsed * n.driftFreqY + n.driftPhase * 1.3) * driftAmp +
            Math.sin(elapsed * 0.27 + n.baseZ) * 0.06;
          nz += Math.sin(elapsed * n.driftFreqZ + n.driftPhase * 0.7) * driftAmp;
        }

        const organicVariance = 0.85 + 0.3 * Math.sin(elapsed * 1.1 + n.pulsePhase);
        const nodeTargetExpand = smoothCloudExpansion * n.elasticity * organicVariance;

        n.currentExpansion = THREE.MathUtils.damp(
          n.currentExpansion,
          nodeTargetExpand,
          n.easeRate,
          rawDelta
        );

        nx += n.expandDirX * n.currentExpansion;
        ny += n.expandDirY * n.currentExpansion;
        nz += n.expandDirZ * n.currentExpansion;

        n.curX = nx;
        n.curY = ny;
        n.curZ = nz;

        const targetNodeWordGlow =
          (smoothSyllableEnv * 0.65 + smoothEmphasis * 0.55) *
          (0.75 + 0.25 * n.elasticity);
        n.currentWordGlow = THREE.MathUtils.damp(
          n.currentWordGlow,
          targetNodeWordGlow,
          n.easeRate * 1.1,
          rawDelta
        );

        if (ripple.strength > 0.01) {
          const dx = n.curX - ripple.x * 5.5;
          const dy = n.curY - ripple.y * 4.5;
          const d2 = dx * dx + dy * dy;
          if (d2 < 9.0) {
            n.fireEnergy = Math.min(
              1.4,
              n.fireEnergy + (1.0 - d2 / 9.0) * ripple.strength * 0.35
            );
          }
        }

        const wordStartSpark =
          curState === 'speaking' && metrics.wordAttackImpulse > 0.25
            ? metrics.wordAttackImpulse * 0.035
            : 0;
        const fireChance =
          curState === 'thinking' || curState === 'uploading'
            ? 0.022
            : curState === 'speaking'
            ? 0.004 + smoothRms * 0.025 + wordStartSpark
            : curState === 'listening'
            ? 0.007 + smoothRms * 0.02
            : 0.003;

        if (Math.random() < fireChance) {
          n.fireEnergy = Math.min(1.4, n.fireEnergy + 0.5 + Math.random() * 0.55);
        }

        n.fireEnergy *= Math.exp(-3.0 * rawDelta);

        const osc = 0.72 + 0.28 * Math.sin(elapsed * n.pulseSpeed + n.pulsePhase);

        nodePositions[i * 3] = n.curX;
        nodePositions[i * 3 + 1] = n.curY;
        nodePositions[i * 3 + 2] = n.curZ;

        nodeBrightness[i] = Math.min(
          1.85,
          n.baseBrightness * osc + n.fireEnergy * 0.68 + n.currentWordGlow * 0.95
        );
        nodeSizes[i] =
          n.size * (1.0 + n.fireEnergy * 0.32 + n.currentWordGlow * 0.48);

        const baseC =
          n.colorVariant === 0 ? colorGold : n.colorVariant === 1 ? colorAmber : colorChampagne;
        const emphasisHighlight = Math.min(0.68, n.currentWordGlow * 0.55);
        const r = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(baseC.r, colorChampagne.r, emphasisHighlight),
          colorErrorTint.r,
          smoothErrorBlend
        );
        const g = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(baseC.g, colorChampagne.g, emphasisHighlight),
          colorErrorTint.g,
          smoothErrorBlend
        );
        const b = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(baseC.b, colorChampagne.b, emphasisHighlight),
          colorErrorTint.b,
          smoothErrorBlend
        );

        nodeColors[i * 3] = r;
        nodeColors[i * 3 + 1] = g;
        nodeColors[i * 3 + 2] = b;
      }

      nodePosAttr.needsUpdate = true;
      nodeBrightAttr.needsUpdate = true;
      nodeSizeAttr.needsUpdate = true;
      nodeColorAttr.needsUpdate = true;

      // Update Traveling Synaptic Pulses
      const activePulseLimit = Math.floor(dynamicPulseCap * smoothActivePulseRatio);
      for (let pIdx = 0; pIdx < maxPulses; pIdx++) {
        const p = pulses[pIdx];
        if (pIdx >= activePulseLimit || connections.length === 0) {
          pulseIntensities[pIdx] = 0;
          continue;
        }

        const conn = connections[p.connIndex % connections.length];
        const nA = nodes[conn.nodeA];
        const nB = nodes[conn.nodeB];

        const stepSpeed =
          p.speed *
          rawDelta *
          (curState === 'thinking' || curState === 'uploading'
            ? 2.35
            : curState === 'speaking'
            ? 0.95 + smoothSyllableEnv * 1.85 + smoothEmphasis * 0.65
            : curState === 'listening'
            ? 1.15 + smoothRms * 1.4
            : 0.68);

        p.t += stepSpeed * p.direction;

        if (p.t > 1.0 || p.t < 0.0) {
          const targetNode = p.direction === 1 ? nB : nA;
          targetNode.fireEnergy = Math.min(1.35, targetNode.fireEnergy + 0.32);

          p.connIndex = Math.floor(Math.random() * connections.length);
          p.direction = Math.random() < 0.5 ? 1 : -1;
          p.t = p.direction === 1 ? 0.0 : 1.0;
        }

        conn.signalBoost = Math.min(1.0, conn.signalBoost + 0.15);

        const localExpand = (nA.currentExpansion + nB.currentExpansion) * 0.5;
        const midX =
          (nA.curX + nB.curX) * 0.5 +
          conn.midOffsetX +
          conn.archDirX * localExpand +
          Math.sin(elapsed * 0.9 + conn.plasticityPhase) * 0.07;
        const midY =
          (nA.curY + nB.curY) * 0.5 +
          conn.midOffsetY +
          conn.archDirY * localExpand +
          Math.cos(elapsed * 0.85 + conn.plasticityPhase) * 0.07;
        const midZ =
          (nA.curZ + nB.curZ) * 0.5 +
          conn.midOffsetZ +
          conn.archDirZ * localExpand;

        const t = Math.max(0, Math.min(1, p.t));
        const invT = 1 - t;
        const px = invT * invT * nA.curX + 2 * invT * t * midX + t * t * nB.curX;
        const py = invT * invT * nA.curY + 2 * invT * t * midY + t * t * nB.curY;
        const pz = invT * invT * nA.curZ + 2 * invT * t * midZ + t * t * nB.curZ;

        pulsePositions[pIdx * 3] = px;
        pulsePositions[pIdx * 3 + 1] = py;
        pulsePositions[pIdx * 3 + 2] = pz;

        const edgeEnvelope = Math.sin(t * Math.PI);
        const speechSync =
          curState === 'speaking'
            ? 0.65 + smoothSyllableEnv * 0.85 + smoothEmphasis * 0.35
            : 0.85;
        pulseIntensities[pIdx] = p.intensity * edgeEnvelope * speechSync;
        pulseSizes[pIdx] =
          p.size * (1.0 + (curState === 'speaking' ? smoothSyllableEnv * 0.5 : 0));
      }

      pulsePosAttr.needsUpdate = true;
      pulseIntAttr.needsUpdate = true;
      pulseSizeAttr.needsUpdate = true;

      // Update Neural Filaments
      let vCursor = 0;
      for (let cIdx = 0; cIdx < connections.length; cIdx++) {
        const conn = connections[cIdx];
        const nA = nodes[conn.nodeA];
        const nB = nodes[conn.nodeB];

        conn.signalBoost *= Math.exp(-3.4 * rawDelta);

        const plasticityWave = Math.sin(elapsed * conn.plasticitySpeed + conn.plasticityPhase);
        const naturalFade = THREE.MathUtils.smoothstep(plasticityWave, -0.55, 0.65);

        const endpointEnergy = (nA.fireEnergy + nB.fireEnergy) * 0.32;
        const localWordGlow = (nA.currentWordGlow + nB.currentWordGlow) * 0.5;
        const localExpand = (nA.currentExpansion + nB.currentExpansion) * 0.5;

        const alpha =
          (conn.baseAlpha * (0.25 + 0.75 * naturalFade) +
            conn.signalBoost * 0.42 +
            endpointEnergy * 0.32 +
            localWordGlow * 0.48) *
          smoothGlowMult;

        const midX =
          (nA.curX + nB.curX) * 0.5 +
          conn.midOffsetX +
          conn.archDirX * localExpand +
          (isReduced ? 0 : Math.sin(elapsed * 0.9 + conn.plasticityPhase) * 0.07);
        const midY =
          (nA.curY + nB.curY) * 0.5 +
          conn.midOffsetY +
          conn.archDirY * localExpand +
          (isReduced ? 0 : Math.cos(elapsed * 0.85 + conn.plasticityPhase) * 0.07);
        const midZ =
          (nA.curZ + nB.curZ) * 0.5 +
          conn.midOffsetZ +
          conn.archDirZ * localExpand;

        const energyMix = Math.min(1, conn.signalBoost + endpointEnergy + localWordGlow * 0.85);
        const r = 1.0;
        const g = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(0.76, 0.42, smoothErrorBlend),
          0.94,
          energyMix
        );
        const b = THREE.MathUtils.lerp(0.16, 0.64, energyMix);

        linePositions[vCursor * 3] = nA.curX;
        linePositions[vCursor * 3 + 1] = nA.curY;
        linePositions[vCursor * 3 + 2] = nA.curZ;
        lineColors[vCursor * 3] = r;
        lineColors[vCursor * 3 + 1] = g;
        lineColors[vCursor * 3 + 2] = b;
        lineAlphas[vCursor] = alpha;
        vCursor++;

        linePositions[vCursor * 3] = midX;
        linePositions[vCursor * 3 + 1] = midY;
        linePositions[vCursor * 3 + 2] = midZ;
        lineColors[vCursor * 3] = r;
        lineColors[vCursor * 3 + 1] = g;
        lineColors[vCursor * 3 + 2] = b;
        lineAlphas[vCursor] = alpha * 1.12;
        vCursor++;

        linePositions[vCursor * 3] = midX;
        linePositions[vCursor * 3 + 1] = midY;
        linePositions[vCursor * 3 + 2] = midZ;
        lineColors[vCursor * 3] = r;
        lineColors[vCursor * 3 + 1] = g;
        lineColors[vCursor * 3 + 2] = b;
        lineAlphas[vCursor] = alpha * 1.12;
        vCursor++;

        linePositions[vCursor * 3] = nB.curX;
        linePositions[vCursor * 3 + 1] = nB.curY;
        linePositions[vCursor * 3 + 2] = nB.curZ;
        lineColors[vCursor * 3] = r;
        lineColors[vCursor * 3 + 1] = g;
        lineColors[vCursor * 3 + 2] = b;
        lineAlphas[vCursor] = alpha;
        vCursor++;

        if (conn.hasSubBranch) {
          const branchStretch = 1.0 + localExpand * 0.35;
          linePositions[vCursor * 3] = midX;
          linePositions[vCursor * 3 + 1] = midY;
          linePositions[vCursor * 3 + 2] = midZ;
          lineColors[vCursor * 3] = r;
          lineColors[vCursor * 3 + 1] = g;
          lineColors[vCursor * 3 + 2] = b;
          lineAlphas[vCursor] = alpha * 0.65;
          vCursor++;

          linePositions[vCursor * 3] = midX + conn.subBranchOffsetX * branchStretch;
          linePositions[vCursor * 3 + 1] = midY + conn.subBranchOffsetY * branchStretch;
          linePositions[vCursor * 3 + 2] = midZ + conn.subBranchOffsetZ * branchStretch;
          lineColors[vCursor * 3] = r;
          lineColors[vCursor * 3 + 1] = g;
          lineColors[vCursor * 3 + 2] = b;
          lineAlphas[vCursor] = 0.0;
          vCursor++;
        }
      }

      linePosAttr.needsUpdate = true;
      lineColorAttr.needsUpdate = true;
      lineAlphaAttr.needsUpdate = true;

      if (!isReduced) {
        for (let dIdx = 0; dIdx < dustCount; dIdx++) {
          let dy = dustPositions[dIdx * 3 + 1] + rawDelta * 0.14 * smoothSpeedMult;
          if (dy > 7.0) dy = -7.0;
          dustPositions[dIdx * 3 + 1] = dy;
        }
        dustPosAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

      for (const rm of ringMeshes) {
        rm.line.geometry.dispose();
        rm.mat.dispose();
      }
      volGeo.dispose();
      volMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
    };
  }, [animationQuality]);

  const triggerTouchRipple = (clientX: number, clientY: number) => {
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const nx = ((clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = -((clientY - rect.top) / rect.height - 0.5) * 2;
    touchRippleRef.current = { x: nx, y: ny, strength: 1.0 };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    triggerTouchRipple(e.clientX, e.clientY);
    if (touchMode === 'hold-to-talk' && onCoreHoldStart) {
      onCoreHoldStart();
    }
  };

  const handlePointerUp = () => {
    if (touchMode === 'hold-to-talk' && onCoreHoldEnd) {
      onCoreHoldEnd();
    } else if (touchMode === 'tap-toggle') {
      onCoreTap();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      touchRippleRef.current = { x: 0, y: 0, strength: 1.0 };
      onCoreTap();
    }
  };

  return (
    <div
      ref={mountRef}
      role="button"
      tabIndex={0}
      aria-label={
        interactionState === 'listening'
          ? 'JARVIS AI Orb listening. Tap to finish speaking.'
          : interactionState === 'speaking'
          ? 'JARVIS AI Orb speaking. Tap to interrupt.'
          : 'JARVIS AI Orb. Tap the golden orb to speak.'
      }
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 w-full h-full bg-black cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFC928]/40"
    />
  );
};
