import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { createRadialTexture, disposeObject, smoothstep } from './utils';

export class Flash implements ExplosionModule {
  readonly name = 'Flash';
  private group = new THREE.Group();
  private texture: THREE.Texture | null = null;
  private coreMaterial: THREE.SpriteMaterial | null = null;
  private horizonMaterial: THREE.MeshBasicMaterial | null = null;
  private horizon: THREE.Mesh | null = null;

  mount(context: ExplosionContext) {
    this.texture = createRadialTexture([
      [0, 'rgba(255,255,255,0.78)'],
      [0.16, 'rgba(255,252,235,0.56)'],
      [0.42, 'rgba(255,206,128,0.24)'],
      [1, 'rgba(255,115,35,0)'],
    ]);

    this.coreMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Sprite(this.coreMaterial);
    core.position.set(0, 0.9, 0);
    core.scale.set(0.01, 0.01, 1);
    this.group.add(core);

    this.horizonMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe8c2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.horizon = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 128), this.horizonMaterial);
    this.horizon.rotation.x = Math.PI / 2;
    this.horizon.position.y = 0.08;
    this.group.add(this.horizon);

    context.world.add(this.group);
  }

  update(context: ExplosionContext) {
    const { elapsedMs } = context.state;
    const { timeline } = context;
    // Flash 更短更克制，不吞噬整个画面
    const flashIn = smoothstep(timeline.flashAt - 60, timeline.flashAt, elapsedMs);
    const flashOut = 1 - smoothstep(timeline.flashAt + 30, timeline.flashAt + 200, elapsedMs);
    const flash = flashIn * flashOut;
    // 闪光扩散范围更小
    const blastScale = 1 + smoothstep(timeline.flashAt, timeline.flashAt + 400, elapsedMs) * 3.2;

    const core = this.group.children[0] as THREE.Sprite | undefined;
    if (core && this.coreMaterial) {
      core.scale.setScalar(1.1 * blastScale);
      this.coreMaterial.opacity = flash * 0.18;
    }

    if (this.horizon && this.horizonMaterial) {
      const ringProgress = smoothstep(timeline.flashAt + 60, timeline.flashAt + 600, elapsedMs);
      this.horizon.scale.setScalar(1 + ringProgress * 4.5);
      this.horizonMaterial.opacity = (1 - ringProgress) * flashIn * 0.16;
    }
  }

  dispose() {
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
    disposeObject(this.group);
    this.group.clear();
  }
}
