import * as THREE from 'three';
import { Ash } from './Ash';
import { CameraEffect } from './CameraEffect';
import { Debris } from './Debris';
import { Fireball } from './Fireball';
import { FlameParticles } from './FlameParticles';
import { Flash } from './Flash';
import { LightEffect } from './LightEffect';
import { MushroomCloud } from './MushroomCloud';
import { PostProcessing } from './PostProcessing';
import { Shockwave } from './Shockwave';
import { Smoke } from './Smoke';
import { DEFAULT_TIMELINE } from './types';
import type { ExplosionContext, ExplosionModule, ExplosionOptions, ExplosionSize, ExplosionState } from './types';
import { createRng, disposeObject, lerp, smoothstep } from './utils';

interface BuildingDestructionState {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotationY: number;
  fallX: number;
  fallZ: number;
  impactAt: number;
  outward: THREE.Vector3;
}

export class Explosion {
  private readonly context: ExplosionContext;
  private readonly modules: ExplosionModule[];
  private readonly postProcessing: PostProcessing;
  private readonly resizeObserver: ResizeObserver;
  private rafId = 0;
  private startedAt = 0;
  private previousAt = 0;
  private disposed = false;
  private buildings: THREE.InstancedMesh | null = null;
  private buildingStates: BuildingDestructionState[] = [];
  private groundMaterial: THREE.MeshStandardMaterial | null = null;
  private gridMaterial: THREE.Material | null = null;
  private readonly environmentTemp = new THREE.Object3D();
  private readonly groundBaseColor = new THREE.Color(0x21140f);
  private readonly groundScorchColor = new THREE.Color(0x090403);
  private readonly groundBaseEmissive = new THREE.Color(0x150704);
  private readonly groundHotEmissive = new THREE.Color(0x8f2108);

  constructor(options: ExplosionOptions) {
    const timeline = {
      ...DEFAULT_TIMELINE,
      durationMs: options.durationMs ?? DEFAULT_TIMELINE.durationMs,
    };
    const size = this.measure(options.canvas);
    const renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(size.pixelRatio);
    renderer.setSize(size.width, size.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !options.reducedMotion;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    // 浓雾 + 暗色背景，让蘑菇云的橙红色火焰在深暗天空中突出（参考真实核试验照片）
    scene.fog = new THREE.FogExp2(0x0a0604, 0.04);

    const camera = new THREE.PerspectiveCamera(size.width < 720 ? 50 : 42, size.width / size.height, 0.1, 90);
    camera.position.set(0, 4.4, 12.2);

    const world = new THREE.Group();
    scene.add(world);

    const lights = {
      ambient: new THREE.HemisphereLight(0xffead2, 0x140a08, 0.95),
      sun: new THREE.DirectionalLight(0xffdfb8, 1.1),
      blast: new THREE.PointLight(0xffb15c, 0, 32, 1.25),
    };
    lights.sun.position.set(-4.4, 8.2, 6.8);
    lights.sun.castShadow = !options.reducedMotion;
    lights.sun.shadow.mapSize.set(1024, 1024);
    scene.add(lights.ambient, lights.sun, lights.blast);

    const seed = options.seed ?? 1;
    const rng = createRng(seed + 0x7f4a7c15);
    const state = this.createInitialState();
    const context: ExplosionContext = {
      seed,
      reducedMotion: options.reducedMotion ?? false,
      quality: options.quality ?? 'high',
      timeline,
      size,
      scene,
      world,
      camera,
      renderer,
      lights,
      rng,
      state,
    };
    this.context = context;

    this.createEnvironment();

    this.modules = [
      new LightEffect(),
      new CameraEffect(),
      new Flash(),
      new Fireball(),
      new FlameParticles(),
      new Shockwave(),
      new MushroomCloud(),
      new Smoke(),
      new Debris(),
      new Ash(),
    ];
    this.modules.forEach((module) => module.mount(this.context));

    this.postProcessing = new PostProcessing(this.context);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.canvas.parentElement ?? options.canvas);
    this.resize();
  }

  start() {
    this.stop();
    this.startedAt = performance.now();
    this.previousAt = this.startedAt;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  resize() {
    if (this.disposed) return;
    const nextSize = this.measure(this.context.renderer.domElement);
    this.context.size = nextSize;
    this.context.renderer.setPixelRatio(nextSize.pixelRatio);
    this.context.renderer.setSize(nextSize.width, nextSize.height, false);
    this.context.camera.aspect = nextSize.width / nextSize.height;
    this.context.camera.fov = nextSize.width < 720 ? 50 : 42;
    this.context.camera.updateProjectionMatrix();
    this.postProcessing.resize(this.context);
    this.modules.forEach((module) => module.resize?.(this.context));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    this.modules.forEach((module) => module.dispose());
    this.postProcessing.dispose();
    disposeObject(this.context.scene);
    this.context.renderer.dispose();
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const elapsedMs = now - this.startedAt;
    const deltaMs = Math.min(64, now - this.previousAt);
    this.previousAt = now;

    this.updateState(elapsedMs, deltaMs);
    this.modules.forEach((module) => module.update(this.context));
    this.updateEnvironment();
    this.context.renderer.toneMappingExposure = this.context.state.exposure;
    this.postProcessing.render(this.context);

    // 结束后不要把过曝的最后一帧冻结在画布上：继续渲染一段淡出尾，让 exposure/bloom/fireball
    // 平滑归零，再停止 RAF。否则 ACES 压不住的高 HDR 残帧会卡成"白屏不恢复"。
    if (elapsedMs < this.context.timeline.durationMs + 500) {
      this.rafId = window.requestAnimationFrame(this.tick);
    } else {
      this.stop();
      // 最后清一帧，避免任何残影
      this.context.renderer.clear();
    }
  };

  private measure(canvas: HTMLCanvasElement): ExplosionSize {
    const rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width || window.innerWidth)),
      height: Math.max(1, Math.floor(rect.height || window.innerHeight)),
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75),
    };
  }

  private createInitialState(): ExplosionState {
    return {
      elapsedMs: 0,
      deltaMs: 0,
      progress: 0,
      flash: 0,
      fireball: 0,
      shockwave: 0,
      cloud: 0,
      cap: 0,
      smoke: 0,
      ash: 0,
      heat: 0,
      cameraShake: 0,
      bloomStrength: 0,
      exposure: 1.05,
    };
  }

  private updateState(elapsedMs: number, deltaMs: number) {
    const t = elapsedMs;
    const { timeline, state } = this.context;
    // Flash 极短脉冲：~150ms 即过，绝不允许长时间刷白画面
    const flash = smoothstep(timeline.flashAt - 50, timeline.flashAt, t) * (1 - smoothstep(timeline.flashAt + 20, timeline.flashAt + 150, t));
    // 火球：快速亮起后迅速让位给蘑菇云。~600ms 内冷却到 0
    const fireballRise = smoothstep(timeline.fireballAt, timeline.fireballAt + 420, t);
    const fireballCool = 1 - smoothstep(timeline.cloudAt - 100, timeline.cloudAt + 500, t);
    const fireball = fireballRise * fireballCool;
    const shockwave = smoothstep(timeline.shockwaveAt, timeline.shockwaveAt + 2100, t);
    // 云柱和云冠必须在爆闪消退后立即接管画面，避免“白爆 → 黑屏”的视觉断层。
    const cloud = smoothstep(timeline.cloudAt - 120, timeline.cloudAt + 720, t);
    const cap = smoothstep(timeline.capAt - 520, timeline.capAt + 780, t);
    const smoke = smoothstep(timeline.smokeAt, timeline.durationMs - 700, t);
    const ash = smoothstep(timeline.ashAt, timeline.durationMs - 1000, t);
    const endFade = smoothstep(timeline.durationMs - 900, timeline.durationMs, t);
    const shockKick = smoothstep(timeline.shockwaveAt, timeline.shockwaveAt + 180, t) * (1 - smoothstep(timeline.shockwaveAt + 180, timeline.shockwaveAt + 1400, t));

    state.elapsedMs = elapsedMs;
    state.deltaMs = deltaMs;
    state.progress = Math.min(1, elapsedMs / timeline.durationMs);
    state.flash = flash;
    state.fireball = fireball;
    state.shockwave = shockwave;
    state.cloud = cloud;
    state.cap = cap;
    state.smoke = smoke;
    state.ash = ash;
    state.heat = Math.max(flash * 0.3, fireball * 0.45, shockKick * 0.4, smoke * 0.2) * (1 - endFade);
    state.cameraShake = (flash * 2.4 + shockKick * 1.35 + fireball * 0.22) * (this.context.reducedMotion ? 0 : 1);
    // Bloom 大幅削弱：峰值从 1.58 降到 ~0.9，蘑菇云阶段保留微弱 bloom 增强发光感
    state.bloomStrength = (0.14 + flash * 0.38 + fireball * 0.24 + shockKick * 0.1 + cloud * 0.2 + cap * 0.12) * (1 - endFade);
    const rawExposure = lerp(0.96, 1.08, flash) + fireball * 0.04 + cloud * 0.06 - smoke * 0.04;
    state.exposure = lerp(rawExposure, 1.0, endFade);
  }

  private createEnvironment() {
    const { world, scene, rng, reducedMotion, quality } = this.context;

    const skyMaterial = new THREE.ShaderMaterial({
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color(0x020408) },
        uHorizon: { value: new THREE.Color(0x2a0c04) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          vec3 color = mix(uHorizon, uTop, smoothstep(0.08, 0.86, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(38, 48, 24), skyMaterial);
    scene.add(sky);

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x21140f,
      roughness: 0.86,
      metalness: 0.02,
      emissive: 0x150704,
      emissiveIntensity: 0.18,
    });
    this.groundMaterial = groundMaterial;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(26, 18, 32, 18), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !reducedMotion;
    world.add(ground);

    const grid = new THREE.GridHelper(26, 34, 0x7c2d12, 0x3f1b12);
    grid.position.y = 0.018;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.16;
    this.gridMaterial = gridMaterial;
    world.add(grid);

    const count = quality === 'low' ? 70 : 128;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1b1412,
      roughness: 0.72,
      metalness: 0.12,
      emissive: 0x120603,
      vertexColors: true,
    });
    const buildings = new THREE.InstancedMesh(geometry, material, count);
    buildings.castShadow = !reducedMotion;
    buildings.receiveShadow = true;
    const temp = new THREE.Object3D();
    const color = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      const lane = index % 16;
      const row = Math.floor(index / 16);
      const x = -7.8 + lane * 1.04 + (rng() - 0.5) * 0.32;
      const z = -4.8 + row * 0.62 + (rng() - 0.5) * 0.22;
      const height = (0.42 + Math.pow(rng(), 0.66) * 1.9) * (1 - Math.abs(x) / 18);
      temp.position.set(x, height / 2, z);
      temp.rotation.y = (rng() - 0.5) * 0.18;
      temp.scale.set(0.22 + rng() * 0.32, height, 0.24 + rng() * 0.38);
      temp.updateMatrix();
      buildings.setMatrixAt(index, temp.matrix);
      const distance = Math.hypot(x, z);
      const outward = new THREE.Vector3(x, 0, z).normalize();
      this.buildingStates.push({
        position: temp.position.clone(),
        scale: temp.scale.clone(),
        rotationY: temp.rotation.y,
        fallX: (rng() - 0.5) * 1.7,
        fallZ: (rng() - 0.5) * 1.7,
        impactAt: this.context.timeline.shockwaveAt + 120 + distance * 115 + rng() * 180,
        outward,
      });
      color.set(0x1b1412).lerp(new THREE.Color(0x4f2417), rng() * 0.28);
      buildings.setColorAt(index, color);
    }
    buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.buildings = buildings;
    world.add(buildings);
  }

  private updateEnvironment() {
    const t = this.context.state.elapsedMs;
    const { timeline, state } = this.context;

    if (this.buildings) {
      this.buildingStates.forEach((building, index) => {
        const hit = smoothstep(building.impactAt, building.impactAt + 420, t);
        const obliterate = smoothstep(building.impactAt + 260, building.impactAt + 1180, t);
        const blastLift = Math.sin(Math.min(1, hit) * Math.PI) * (0.12 + building.scale.y * 0.18);
        this.environmentTemp.position.copy(building.position).addScaledVector(building.outward, hit * hit * 1.15);
        this.environmentTemp.position.y = Math.max(0.02, building.position.y - building.scale.y * 0.48 * obliterate + blastLift);
        this.environmentTemp.rotation.set(
          building.fallX * hit,
          building.rotationY + hit * 0.45,
          building.fallZ * hit,
        );
        const survival = Math.max(0.018, 1 - obliterate * obliterate * 0.985);
        this.environmentTemp.scale.set(
          building.scale.x * (1 + hit * 0.18) * survival,
          building.scale.y * Math.max(0.015, 1 - obliterate * 0.99),
          building.scale.z * (1 + hit * 0.12) * survival,
        );
        this.environmentTemp.updateMatrix();
        this.buildings?.setMatrixAt(index, this.environmentTemp.matrix);
      });
      this.buildings.instanceMatrix.needsUpdate = true;
    }

    const scorch = smoothstep(timeline.shockwaveAt + 180, timeline.smokeAt + 1150, t);
    if (this.groundMaterial) {
      this.groundMaterial.color.copy(this.groundBaseColor).lerp(this.groundScorchColor, scorch);
      this.groundMaterial.emissive.copy(this.groundBaseEmissive).lerp(this.groundHotEmissive, state.fireball * 0.48 + state.shockwave * 0.24);
      this.groundMaterial.emissiveIntensity = 0.18 + state.fireball * 0.7 + state.shockwave * 0.26;
    }
    if (this.gridMaterial) {
      this.gridMaterial.opacity = 0.16 * (1 - smoothstep(timeline.shockwaveAt, timeline.shockwaveAt + 1700, t));
    }
  }
}
