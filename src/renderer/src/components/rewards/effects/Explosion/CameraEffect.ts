import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { lerp, smoothstep } from './utils';

export class CameraEffect implements ExplosionModule {
  readonly name = 'CameraEffect';
  // 初始更远更高，看到完整蘑菇云
  private readonly basePosition = new THREE.Vector3(0, 3.8, 14.5);
  private readonly target = new THREE.Vector3(0, 1.35, 0);

  mount(context: ExplosionContext) {
    context.camera.position.copy(this.basePosition);
    context.camera.lookAt(this.target);
  }

  update(context: ExplosionContext) {
    const { camera, state, timeline, reducedMotion } = context;
    const t = state.elapsedMs;
    const dolly = smoothstep(timeline.flashAt - 380, timeline.cloudAt + 2100, t);
    const cloudFollow = smoothstep(timeline.cloudAt, timeline.capAt + 1800, t);
    const settle = smoothstep(timeline.durationMs - 1100, timeline.durationMs, t);
    const shakeAmount = reducedMotion ? 0 : state.cameraShake * (1 - settle);
    const highFreq = Math.sin(t * 0.082) * shakeAmount * 0.28;
    const lowFreq = Math.sin(t * 0.021 + 1.7) * shakeAmount * 0.18;

    camera.position.set(
      this.basePosition.x + highFreq + lowFreq,
      // 蘑菇云阶段镜头缓慢上移跟随
      lerp(this.basePosition.y, 4.8, dolly) + Math.cos(t * 0.077) * shakeAmount * 0.18,
      lerp(this.basePosition.z, 11.0, dolly) + Math.sin(t * 0.063) * shakeAmount * 0.26,
    );

    // 镜头目标大幅跟随蘑菇云帽抬升
    this.target.set(0, lerp(1.2, 4.5, cloudFollow), 0);
    camera.lookAt(this.target);
    camera.fov = lerp(context.size.width < 720 ? 52 : 44, context.size.width < 720 ? 48 : 40, dolly * 0.6);
    camera.updateProjectionMatrix();
  }

  dispose() {
    // No GPU resource.
  }
}
