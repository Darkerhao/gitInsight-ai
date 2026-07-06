import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { SMOKE_FRAGMENT_SHADER, SMOKE_VERTEX_SHADER } from './shaders/particles';
import { disposeObject, smoothstep } from './utils';

export class Smoke implements ExplosionModule {
  readonly name = 'Smoke';
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;

  mount(context: ExplosionContext) {
    const count = context.reducedMotion ? 150 : 420;
    const positions: number[] = [];
    const bases: number[] = [];
    const drifts: number[] = [];
    const births: number[] = [];
    const lives: number[] = [];
    const sizes: number[] = [];
    const seeds: number[] = [];
    const layers: number[] = [];

    for (let index = 0; index < count; index += 1) {
      const angle = context.rng() * Math.PI * 2;
      const radius = 0.8 + Math.pow(context.rng(), 0.55) * 6.4;
      const sideWind = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle) * 0.62);
      positions.push(0, 0, 0);
      bases.push(
        Math.cos(angle) * radius,
        0.18 + context.rng() * 0.82,
        Math.sin(angle) * radius * 0.68,
      );
      drifts.push(
        sideWind.x * (0.7 + context.rng() * 1.8),
        0.18 + context.rng() * 0.8,
        sideWind.z * (0.5 + context.rng() * 1.4),
      );
      births.push(context.timeline.smokeAt + context.rng() * 1900);
      lives.push(3600 + context.rng() * 2800);
      sizes.push(54 + context.rng() * 116);
      seeds.push(context.rng());
      layers.push(0.08 + context.rng() * 0.34);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aBase', new THREE.Float32BufferAttribute(bases, 3));
    geometry.setAttribute('aDrift', new THREE.Float32BufferAttribute(drifts, 3));
    geometry.setAttribute('aBirth', new THREE.Float32BufferAttribute(births, 1));
    geometry.setAttribute('aLife', new THREE.Float32BufferAttribute(lives, 1));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geometry.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTimeMs: { value: 0 },
        uGlobalOpacity: { value: 0 },
      },
      vertexShader: SMOKE_VERTEX_SHADER,
      fragmentShader: SMOKE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    context.world.add(this.points);
  }

  update(context: ExplosionContext) {
    if (!this.material || !this.points) return;
    const fade = 1 - smoothstep(context.timeline.durationMs - 850, context.timeline.durationMs, context.state.elapsedMs);
    this.material.uniforms.uTimeMs.value = context.state.elapsedMs;
    this.material.uniforms.uGlobalOpacity.value = context.state.smoke * fade * 0.92;
    this.points.rotation.y = Math.sin(context.state.elapsedMs * 0.00012) * 0.05;
  }

  dispose() {
    if (this.points) {
      disposeObject(this.points);
      this.points = null;
    }
    this.material = null;
  }
}
