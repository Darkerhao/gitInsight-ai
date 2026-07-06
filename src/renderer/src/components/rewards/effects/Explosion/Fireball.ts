import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { FIREBALL_FRAGMENT_SHADER, FIREBALL_VERTEX_SHADER } from './shaders/fireball';
import { disposeObject, easeOutExpo, smoothstep } from './utils';

export class Fireball implements ExplosionModule {
  readonly name = 'Fireball';
  private group = new THREE.Group();
  private coreMaterial: THREE.ShaderMaterial | null = null;
  private shellMaterial: THREE.ShaderMaterial | null = null;
  private core: THREE.Mesh | null = null;
  private shell: THREE.Mesh | null = null;

  mount(context: ExplosionContext) {
    const geometry = new THREE.SphereGeometry(1, context.reducedMotion ? 48 : 96, context.reducedMotion ? 32 : 64);
    const sharedUniforms = {
      uTime: { value: 0 },
      uGrowth: { value: 0 },
      uTurbulence: { value: 0.72 },
      uOpacity: { value: 0 },
      uCooling: { value: 0 },
      uCameraPosition: { value: context.camera.position.clone() },
    };

    this.coreMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(sharedUniforms),
      vertexShader: FIREBALL_VERTEX_SHADER,
      fragmentShader: FIREBALL_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.shellMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(sharedUniforms),
      vertexShader: FIREBALL_VERTEX_SHADER,
      fragmentShader: FIREBALL_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.BackSide,
    });

    this.core = new THREE.Mesh(geometry, this.coreMaterial);
    this.shell = new THREE.Mesh(geometry.clone(), this.shellMaterial);
    this.core.position.set(0, 0.75, 0);
    this.shell.position.copy(this.core.position);
    this.group.add(this.shell, this.core);
    context.world.add(this.group);
  }

  update(context: ExplosionContext) {
    if (!this.core || !this.shell || !this.coreMaterial || !this.shellMaterial) return;

    const { state, timeline, camera } = context;
    const t = state.elapsedMs;
    const growth = easeOutExpo((t - timeline.fireballAt) / 1000);
    // 火球迅速冷却退场：cloudAt 时已开始冷却，800ms 内彻底透明
    const cooling = smoothstep(timeline.cloudAt - 100, timeline.cloudAt + 700, t);
    const lift = smoothstep(timeline.cloudAt, timeline.capAt + 1200, t);
    const finalFade = 1 - smoothstep(timeline.durationMs - 1300, timeline.durationMs, t);
    // 火球半径更小（峰值 ~1.5 而非 ~3.0），冷却时缩到 30%
    const shrink = 1 - cooling * 0.7;
    const radius = (0.15 + growth * 1.4 + lift * 0.35) * shrink;

    this.group.position.y = lift * 1.5;
    this.core.scale.setScalar(radius);
    this.shell.scale.setScalar(radius * (1.12 + state.shockwave * 0.08));
    this.core.rotation.y = t * 0.00032;
    this.core.rotation.x = Math.sin(t * 0.00042) * 0.16;
    this.shell.rotation.y = -t * 0.0002;

    this.coreMaterial.uniforms.uTime.value = t * 0.001;
    this.coreMaterial.uniforms.uGrowth.value = growth;
    this.coreMaterial.uniforms.uTurbulence.value = 0.52 + growth * 0.5 + state.smoke * 0.12;
    const flashDim = 1 - state.flash * 0.7;
    // 火球透明度：冷却后迅速归零
    this.coreMaterial.uniforms.uOpacity.value = state.fireball * finalFade * (1 - cooling * 0.85) * flashDim;
    this.coreMaterial.uniforms.uCooling.value = cooling;
    this.coreMaterial.uniforms.uCameraPosition.value.copy(camera.position);

    this.shellMaterial.uniforms.uTime.value = t * 0.001 + 3.7;
    this.shellMaterial.uniforms.uGrowth.value = growth;
    this.shellMaterial.uniforms.uTurbulence.value = 0.82 + growth * 0.7;
    this.shellMaterial.uniforms.uOpacity.value = state.fireball * finalFade * (1 - cooling * 0.75) * 0.35;
    this.shellMaterial.uniforms.uCooling.value = cooling;
    this.shellMaterial.uniforms.uCameraPosition.value.copy(camera.position);
  }

  dispose() {
    disposeObject(this.group);
    this.group.clear();
    this.core = null;
    this.shell = null;
    this.coreMaterial = null;
    this.shellMaterial = null;
  }
}
