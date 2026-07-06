import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { clamp, disposeObject, smoothstep } from './utils';

interface DebrisState {
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  birth: number;
  life: number;
  size: number;
  color: THREE.Color;
}

export class Debris implements ExplosionModule {
  readonly name = 'Debris';
  private mesh: THREE.InstancedMesh | null = null;
  private states: DebrisState[] = [];
  private temp = new THREE.Object3D();
  private rotation = new THREE.Quaternion();

  mount(context: ExplosionContext) {
    const count = context.reducedMotion ? 55 : 150;
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6b4e3d,
      roughness: 0.9,
      metalness: 0.08,
      vertexColors: true,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = !context.reducedMotion;
    this.mesh.receiveShadow = true;

    const palette = [0x6b4e3d, 0x3f2d25, 0x8a5a3f, 0x2f343a, 0x5f646b];
    for (let index = 0; index < count; index += 1) {
      const angle = context.rng() * Math.PI * 2;
      const speed = 2.2 + Math.pow(context.rng(), 0.52) * 7.5;
      const originRadius = context.rng() * 0.8;
      const origin = new THREE.Vector3(Math.cos(angle) * originRadius, 0.22 + context.rng() * 0.5, Math.sin(angle) * originRadius);
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        3.2 + context.rng() * 8.5,
        Math.sin(angle) * speed * 0.72,
      );
      const axis = new THREE.Vector3(context.rng() - 0.5, context.rng() - 0.5, context.rng() - 0.5).normalize();
      const birth = context.timeline.shockwaveAt + context.rng() * 860;
      const life = 1300 + context.rng() * 2400;
      const size = 0.035 + Math.pow(context.rng(), 1.8) * 0.16;
      const color = new THREE.Color(palette[Math.floor(context.rng() * palette.length)]);
      this.states.push({ origin, velocity, axis, spin: 4 + context.rng() * 16, birth, life, size, color });
      this.mesh.setColorAt(index, color);
      this.temp.scale.setScalar(0);
      this.temp.updateMatrix();
      this.mesh.setMatrixAt(index, this.temp.matrix);
    }

    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    context.world.add(this.mesh);
  }

  update(context: ExplosionContext) {
    if (!this.mesh) return;
    const t = context.state.elapsedMs;
    const gravity = -7.6;

    this.states.forEach((state, index) => {
      const ageMs = t - state.birth;
      if (ageMs <= 0 || ageMs > state.life) {
        this.temp.scale.setScalar(0);
      } else {
        const seconds = ageMs / 1000;
        const age = clamp(ageMs / state.life);
        const visible = smoothstep(0, 0.08, age) * (1 - smoothstep(0.72, 1, age));
        const y = Math.max(0, state.origin.y + state.velocity.y * seconds + gravity * seconds * seconds * 0.5);
        this.temp.position.set(
          state.origin.x + state.velocity.x * seconds,
          y,
          state.origin.z + state.velocity.z * seconds,
        );
        this.rotation.setFromAxisAngle(state.axis, seconds * state.spin);
        this.temp.quaternion.copy(this.rotation);
        this.temp.scale.setScalar(state.size * visible * (y <= 0.03 ? 1 - smoothstep(0.55, 1, age) : 1));
      }
      this.temp.updateMatrix();
      this.mesh?.setMatrixAt(index, this.temp.matrix);
    });

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    if (this.mesh) {
      disposeObject(this.mesh);
      this.mesh = null;
    }
    this.states = [];
  }
}
