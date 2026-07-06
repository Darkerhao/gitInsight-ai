import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import {
  DUST_RING_FRAGMENT_SHADER,
  DUST_RING_VERTEX_SHADER,
  SHOCKWAVE_FRAGMENT_SHADER,
  SHOCKWAVE_VERTEX_SHADER,
} from './shaders/shockwave';
import { disposeObject, easeOutExpo, smoothstep } from './utils';

export class Shockwave implements ExplosionModule {
  readonly name = 'Shockwave';
  private group = new THREE.Group();
  private shellMaterial: THREE.ShaderMaterial | null = null;
  private shell: THREE.Mesh | null = null;
  private dustMaterial: THREE.ShaderMaterial | null = null;
  private dust: THREE.Points | null = null;

  mount(context: ExplosionContext) {
    this.shellMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uThickness: { value: 0.45 },
        uCameraPosition: { value: context.camera.position.clone() },
      },
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), this.shellMaterial);
    this.shell.position.set(0, 0.7, 0);
    this.group.add(this.shell);

    const dustCount = context.reducedMotion ? 180 : 520;
    const dustGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    const seeds = new Float32Array(dustCount);
    const radii = new Float32Array(dustCount);
    const heights = new Float32Array(dustCount);
    for (let index = 0; index < dustCount; index += 1) {
      positions[index * 3] = 0;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = 0;
      seeds[index] = context.rng();
      radii[index] = 0.6 + Math.pow(context.rng(), 0.42) * 6.8;
      heights[index] = 0.06 + context.rng() * 0.82;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    dustGeometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    dustGeometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));

    this.dustMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
      },
      vertexShader: DUST_RING_VERTEX_SHADER,
      fragmentShader: DUST_RING_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.dust = new THREE.Points(dustGeometry, this.dustMaterial);
    this.group.add(this.dust);

    context.world.add(this.group);
  }

  update(context: ExplosionContext) {
    if (!this.shell || !this.shellMaterial || !this.dustMaterial) return;

    const t = context.state.elapsedMs;
    const p = smoothstep(context.timeline.shockwaveAt, context.timeline.shockwaveAt + 2200, t);
    const eased = easeOutExpo(p);
    const opacity = smoothstep(context.timeline.shockwaveAt, context.timeline.shockwaveAt + 140, t) * (1 - smoothstep(0.56, 1, p));

    this.shell.scale.setScalar(0.34 + eased * 8.4);
    this.shell.position.y = 0.55 + p * 0.54;
    this.shellMaterial.uniforms.uTime.value = t * 0.001;
    // 冲击波更透明，不抢蘑菇云的风头
    this.shellMaterial.uniforms.uOpacity.value = opacity * 0.3;
    this.shellMaterial.uniforms.uThickness.value = 0.3 + p * 0.38;
    this.shellMaterial.uniforms.uCameraPosition.value.copy(context.camera.position);

    this.dustMaterial.uniforms.uTime.value = t * 0.001;
    this.dustMaterial.uniforms.uProgress.value = p;
  }

  dispose() {
    disposeObject(this.group);
    this.group.clear();
    this.shell = null;
    this.dust = null;
    this.shellMaterial = null;
    this.dustMaterial = null;
  }
}
