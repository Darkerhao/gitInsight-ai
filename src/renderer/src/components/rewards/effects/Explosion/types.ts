import * as THREE from 'three';

export type ExplosionQuality = 'low' | 'high';

export interface ExplosionTimeline {
  durationMs: number;
  flashAt: number;
  fireballAt: number;
  shockwaveAt: number;
  cloudAt: number;
  capAt: number;
  smokeAt: number;
  ashAt: number;
}

export interface ExplosionOptions {
  canvas: HTMLCanvasElement;
  seed?: number;
  durationMs?: number;
  reducedMotion?: boolean;
  quality?: ExplosionQuality;
}

export interface ExplosionSize {
  width: number;
  height: number;
  pixelRatio: number;
}

export interface ExplosionLights {
  ambient: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  blast: THREE.PointLight;
}

export interface ExplosionState {
  elapsedMs: number;
  deltaMs: number;
  progress: number;
  flash: number;
  fireball: number;
  shockwave: number;
  cloud: number;
  cap: number;
  smoke: number;
  ash: number;
  heat: number;
  cameraShake: number;
  bloomStrength: number;
  exposure: number;
}

export interface ExplosionContext {
  seed: number;
  reducedMotion: boolean;
  quality: ExplosionQuality;
  timeline: ExplosionTimeline;
  size: ExplosionSize;
  scene: THREE.Scene;
  world: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  lights: ExplosionLights;
  rng: () => number;
  state: ExplosionState;
}

export interface ExplosionModule {
  readonly name: string;
  mount: (context: ExplosionContext) => void;
  update: (context: ExplosionContext) => void;
  resize?: (context: ExplosionContext) => void;
  dispose: () => void;
}

export const DEFAULT_TIMELINE: ExplosionTimeline = {
  durationMs: 6600,
  flashAt: 1080,
  fireballAt: 1120,
  shockwaveAt: 1180,
  cloudAt: 1420,
  capAt: 2180,
  smokeAt: 2600,
  ashAt: 3800,
};
