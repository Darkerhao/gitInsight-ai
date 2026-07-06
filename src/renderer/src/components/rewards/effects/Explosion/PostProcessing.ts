import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HEAT_DISTORTION_SHADER } from './shaders/post';
import type { ExplosionContext } from './types';

export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private heatPass: ShaderPass;
  private outputPass: OutputPass;

  constructor(context: ExplosionContext) {
    this.composer = new EffectComposer(context.renderer);
    this.composer.addPass(new RenderPass(context.scene, context.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(context.size.width, context.size.height),
      0.3,       // strength — 从蘑菇云内核提取微光即可，不刷白
      0.42,      // radius
      0.52,      // threshold — 稍高，只让真正亮的区域（火焰核心）产生 bloom
    );
    this.composer.addPass(this.bloomPass);

    this.heatPass = new ShaderPass(HEAT_DISTORTION_SHADER);
    this.heatPass.uniforms.uResolution.value = new THREE.Vector2(context.size.width, context.size.height);
    this.composer.addPass(this.heatPass);

    // 关键：EffectComposer 的工作 RT 是线性空间，renderer 的 toneMapping / outputColorSpace
    // 不会自动应用到 pass 链上。必须以 OutputPass 收尾做 ACES tone map + sRGB 转换，
    // 否则 HDR 火球+flash+bloom 在线性空间直接爆表 → 全程白屏。
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  resize(context: ExplosionContext) {
    this.composer.setSize(context.size.width, context.size.height);
    this.bloomPass.setSize(context.size.width, context.size.height);
    this.heatPass.uniforms.uResolution.value.set(context.size.width, context.size.height);
  }

  render(context: ExplosionContext) {
    this.bloomPass.strength = context.state.bloomStrength;
    this.bloomPass.radius = 0.36 + context.state.heat * 0.12;
    this.bloomPass.threshold = 0.46;

    this.heatPass.uniforms.uTime.value = context.state.elapsedMs * 0.001;
    this.heatPass.uniforms.uHeat.value = context.state.heat;
    this.heatPass.uniforms.uFlash.value = context.state.flash;

    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
  }
}
