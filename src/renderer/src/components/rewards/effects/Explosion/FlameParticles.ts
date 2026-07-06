import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { FLAME_TRAIL_FRAGMENT_SHADER, FLAME_TRAIL_VERTEX_SHADER } from './shaders/particles';
import { disposeObject } from './utils';

export class FlameParticles implements ExplosionModule {
  readonly name = 'FlameParticles';
  private lines: THREE.LineSegments | null = null;
  private material: THREE.ShaderMaterial | null = null;

  mount(context: ExplosionContext) {
    const count = context.reducedMotion ? 90 : 260;
    const positions: number[] = [];
    const origins: number[] = [];
    const velocities: number[] = [];
    const births: number[] = [];
    const lives: number[] = [];
    const sizes: number[] = [];
    const seeds: number[] = [];
    const trails: number[] = [];

    for (let index = 0; index < count; index += 1) {
      const angle = context.rng() * Math.PI * 2;
      const speed = 2.8 + Math.pow(context.rng(), 0.42) * 8.4;
      const upward = 1.8 + context.rng() * 7.2;
      const origin = new THREE.Vector3((context.rng() - 0.5) * 0.45, 0.62 + context.rng() * 0.42, (context.rng() - 0.5) * 0.45);
      const velocity = new THREE.Vector3(Math.cos(angle) * speed, upward, Math.sin(angle) * speed);
      const birth = context.timeline.fireballAt + context.rng() * 1500;
      const life = 760 + context.rng() * 1500;
      const size = 5 + context.rng() * 16;
      const seed = context.rng();

      for (let vertex = 0; vertex < 2; vertex += 1) {
        positions.push(0, 0, 0);
        origins.push(origin.x, origin.y, origin.z);
        velocities.push(velocity.x, velocity.y, velocity.z);
        births.push(birth);
        lives.push(life);
        sizes.push(size);
        seeds.push(seed);
        trails.push(vertex);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aOrigin', new THREE.Float32BufferAttribute(origins, 3));
    geometry.setAttribute('aVelocity', new THREE.Float32BufferAttribute(velocities, 3));
    geometry.setAttribute('aBirth', new THREE.Float32BufferAttribute(births, 1));
    geometry.setAttribute('aLife', new THREE.Float32BufferAttribute(lives, 1));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geometry.setAttribute('aTrail', new THREE.Float32BufferAttribute(trails, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTimeMs: { value: 0 },
      },
      vertexShader: FLAME_TRAIL_VERTEX_SHADER,
      fragmentShader: FLAME_TRAIL_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(geometry, this.material);
    context.world.add(this.lines);
  }

  update(context: ExplosionContext) {
    if (!this.material || !this.lines) return;
    this.material.uniforms.uTimeMs.value = context.state.elapsedMs;
    // 粒子 birth 最晚 fireballAt+1500，max life = 760+1500=2260ms，全部死亡于 fireballAt+3760
    const maxAlive = context.timeline.fireballAt + 3800;
    this.lines.visible = context.state.elapsedMs > context.timeline.fireballAt
      && context.state.elapsedMs < maxAlive;
  }

  dispose() {
    if (this.lines) {
      disposeObject(this.lines);
      this.lines = null;
    }
    this.material = null;
  }
}
