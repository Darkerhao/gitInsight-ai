import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { lerp } from './utils';

export class LightEffect implements ExplosionModule {
  readonly name = 'LightEffect';
  private readonly warmColor = new THREE.Color(0xfff3d2);
  private readonly coolColor = new THREE.Color(0xff7a2d);
  private readonly tempColor = new THREE.Color();

  mount(context: ExplosionContext) {
    context.lights.ambient.intensity = 0.95;
    context.lights.sun.intensity = 1.1;
    context.lights.blast.intensity = 0;
    context.lights.blast.position.set(0, 0.9, 0);
  }

  update(context: ExplosionContext) {
    const { state, lights } = context;
    // Flash 灯光削弱，避免照亮整个场景到白色
    const flashKick = state.flash * 3.0;
    const fireGlow = state.fireball * (1 - state.smoke * 0.35);
    // 蘑菇云阶段持续发出暖光
    const cloudGlow = state.cloud * (1 - state.smoke * 0.5) * 2.2;
    const smokeDim = state.smoke * 0.34;

    lights.ambient.intensity = lerp(0.72, 1.2, state.flash) + fireGlow * 0.3 + cloudGlow * 0.15 - smokeDim;
    lights.sun.intensity = lerp(0.9, 1.8, state.flash) + fireGlow * 0.5;
    lights.blast.intensity = flashKick + fireGlow * 3.0 + cloudGlow;
    lights.blast.distance = lerp(14, 28, Math.max(state.flash, state.fireball, state.cloud * 0.6));
    // 蘑菇云阶段灯光升高跟随
    lights.blast.position.y = 0.9 + state.cloud * 3.5;

    this.tempColor.copy(this.warmColor).lerp(this.coolColor, state.smoke);
    lights.blast.color.copy(this.tempColor);
  }

  dispose() {
    // Lights are owned by Explosion.ts and disposed with the scene graph.
  }
}
