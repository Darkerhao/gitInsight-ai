import * as THREE from 'three';
import type { RewardEffectOption } from '../rewardEffects';
import { createRng } from './particleEngine';

/** Shared depth layer. The player owns the clock and lifecycle; effects keep their own choreography. */
export class CinemaEnvironment {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  private readonly world = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly trails: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly orbits: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private readonly observer: ResizeObserver;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly option: RewardEffectOption,
    seed: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera.position.z = 10;
    this.scene.add(this.world);

    const rng = createRng(seed);
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const accent = new THREE.Color(option.accent);
    const secondary = new THREE.Color(option.secondary);
    const color = new THREE.Color();
    const white = new THREE.Color(0xffffff);
    const streakPositions: number[] = [];

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 3.5 + Math.pow(rng(), 0.65) * 28;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = 5 - rng() * 65;
      positions.set([x, y, z], i * 3);
      sizes[i] = 0.4 + rng() * 1.6;
      color.copy(accent).lerp(secondary, rng()).lerp(white, rng() * 0.65);
      color.toArray(colors, i * 3);
      if (i < 100) streakPositions.push(x, y, z, x, y, z - 0.5 - rng() * 2.5);
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTravel: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSize;
        uniform float uTravel;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vFade;
        void main() {
          vec3 p = position;
          p.z = 5.0 - mod(5.0 - p.z - uTravel, 65.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uPixelRatio * 22.0 / -mv.z, 1.0, 9.0);
          vFade = smoothstep(0.0, 9.0, 5.0 - p.z) * (1.0 - smoothstep(40.0, 65.0, -p.z));
          vColor = color;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vFade;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float glow = exp(-d * d * 24.0);
          gl_FragColor = vec4(vColor, glow * smoothstep(0.5, 0.25, d) * vFade * uOpacity);
          #include <colorspace_fragment>
        }
      `,
    });
    const stars = new THREE.Points(this.geometry, this.material);
    stars.frustumCulled = false; // Positions advance in the vertex shader.
    this.world.add(stars);

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(streakPositions, 3));
    this.trails = new THREE.LineSegments(trailGeometry, new THREE.LineBasicMaterial({
      color: accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.world.add(this.trails);

    for (let i = 0; i < 3; i++) {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(8 + i * 2.8, 0.012 + i * 0.003, 4, 180, Math.PI * (1.15 + i * 0.2)),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? secondary : accent, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      orbit.position.z = -8 - i * 3;
      orbit.rotation.set(0.5 + i * 0.38, -0.25 + i * 0.16, i * 2.1);
      this.orbits.push(orbit);
      this.world.add(orbit);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  setPointer(x: number, y: number) {
    this.pointerTarget.set(x, y);
  }

  render(elapsedMs: number, deltaMs: number) {
    if (this.disposed) return;
    const { entry, loop, exit } = this.option.phases;
    const total = entry + loop + exit;
    const t = elapsedMs / 1000;
    const enter = THREE.MathUtils.smoothstep(elapsedMs, 0, entry);
    const leave = 1 - THREE.MathUtils.smoothstep(elapsedMs, total - exit, total);
    const envelope = enter * leave;
    const velocity = ['warp', 'collapse'].includes(this.option.camera) ? 3.2 : 0.75;

    this.material.uniforms.uTravel.value = t * velocity + (1 - Math.exp(-t * 2)) * 4;
    this.material.uniforms.uOpacity.value = envelope * 0.85;
    this.trails.material.opacity = (1 - enter) * enter * 0.9 + envelope * 0.09;
    this.trails.position.z = Math.min(t * velocity, 6);

    this.pointer.lerp(this.pointerTarget, 1 - Math.exp(-deltaMs / 220));
    this.camera.position.set(this.pointer.x * 0.85, this.pointer.y * 0.5, 10 - enter * 1.2);
    this.camera.lookAt(0, 0, -12);
    this.world.rotation.z = Math.sin(t * 0.09) * 0.06;
    this.orbits.forEach((orbit, i) => {
      orbit.rotation.z = i * 2.1 + t * (i % 2 ? -0.035 : 0.025);
      orbit.material.opacity = envelope * (this.option.tier === 'signal' ? 0.13 : 0.27);
      orbit.scale.setScalar(0.94 + enter * 0.06);
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.geometry.dispose();
    this.material.dispose();
    this.trails.geometry.dispose();
    this.trails.material.dispose();
    this.orbits.forEach(orbit => { orbit.geometry.dispose(); orbit.material.dispose(); });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
