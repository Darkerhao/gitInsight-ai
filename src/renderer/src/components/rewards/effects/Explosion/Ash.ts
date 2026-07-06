import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { ASH_FRAGMENT_SHADER, ASH_VERTEX_SHADER } from './shaders/particles';
import { disposeObject, smoothstep } from './utils';

export class Ash implements ExplosionModule {
  readonly name = 'Ash';
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;

  mount(context: ExplosionContext) {
    const count = context.reducedMotion ? 260 : 900;
    const positions: number[] = [];
    const bases: number[] = [];
    const seeds: number[] = [];
    const speeds: number[] = [];
    const sizes: number[] = [];

    for (let index = 0; index < count; index += 1) {
      positions.push(0, 0, 0);
      bases.push(
        -8.5 + context.rng() * 17,
        2.2 + context.rng() * 7.4,
        -5.2 + context.rng() * 8.8,
      );
      seeds.push(context.rng());
      speeds.push(0.18 + context.rng() * 0.52);
      sizes.push(2.2 + context.rng() * 5.4);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aBase', new THREE.Float32BufferAttribute(bases, 3));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTimeMs: { value: 0 },
        uStartMs: { value: context.timeline.ashAt },
        uOpacity: { value: 0 },
      },
      vertexShader: ASH_VERTEX_SHADER,
      fragmentShader: ASH_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    context.world.add(this.points);
  }

  update(context: ExplosionContext) {
    if (!this.material) return;
    const endFade = 1 - smoothstep(context.timeline.durationMs - 700, context.timeline.durationMs, context.state.elapsedMs);
    this.material.uniforms.uTimeMs.value = context.state.elapsedMs;
    this.material.uniforms.uOpacity.value = context.state.ash * endFade;
  }

  dispose() {
    if (this.points) {
      disposeObject(this.points);
      this.points = null;
    }
    this.material = null;
  }
}
