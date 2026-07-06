import * as THREE from 'three';
import type { ExplosionContext, ExplosionModule } from './types';
import { GLSL_NOISE } from './shaders/noise';
import { disposeObject, smoothstep } from './utils';

// 蘑菇云专用 vertex shader：基于通用 smoke 但增大粒子、更快膨胀
const CLOUD_VERTEX_SHADER = `
${GLSL_NOISE}

attribute vec3 aBase;
attribute vec3 aDrift;
attribute float aBirth;
attribute float aLife;
attribute float aSize;
attribute float aSeed;
attribute float aLayer;

uniform float uTimeMs;
uniform float uGlobalOpacity;

varying float vAlpha;
varying float vLayer;
varying float vSeed;
varying float vAge;

void main() {
  float age = clamp((uTimeMs - aBirth) / aLife, 0.0, 1.25);
  float appear = smoothstep(0.0, 0.14, age);
  float fade = 1.0 - smoothstep(0.72, 1.08, age);
  float lift = age * age;
  float swirl = aSeed * 6.28318530718 + uTimeMs * (0.00024 + aLayer * 0.0001);
  vec3 pos = aBase;
  pos += aDrift * vec3(age * (0.7 + aLayer * 0.4), lift, age * (0.56 + aLayer * 0.22));
  pos.x += cos(swirl) * (0.15 + aLayer * 0.12) * age;
  pos.z += sin(swirl * 1.13) * (0.12 + aLayer * 0.14) * age;
  pos.y += fbm(vec3(pos.xz * 0.3, uTimeMs * 0.00018 + aSeed)) * 0.55 * age;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  // 粒子更快膨胀，初始更大
  float growth = 0.6 + age * (1.8 + aLayer * 0.5);
  gl_PointSize = aSize * growth * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;

  vAlpha = appear * fade * uGlobalOpacity;
  vLayer = aLayer;
  vSeed = aSeed;
  vAge = age;
}
`;

// 蘑菇云专用 fragment shader：强烈火焰内核 + 翻滚烟尘外层，参考真实核爆照片色调
const CLOUD_FRAGMENT_SHADER = `
varying float vAlpha;
varying float vLayer;
varying float vSeed;
varying float vAge;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  float soft = smoothstep(0.5, 0.03, r);
  float inner = smoothstep(0.3, 0.0, r);
  float mid = smoothstep(0.42, 0.12, r);

  // 参考核爆照片的色调梯度：中心白热→金黄→橙红→深棕烟尘
  vec3 hotCore  = vec3(1.0, 0.92, 0.65);    // 白热中心
  vec3 golden   = vec3(1.0, 0.68, 0.22);    // 金色
  vec3 orange   = vec3(0.95, 0.42, 0.08);   // 橙红
  vec3 brown    = vec3(0.52, 0.28, 0.14);   // 棕色烟尘
  vec3 darkAsh  = vec3(0.22, 0.15, 0.1);    // 深灰烟

  // 年轻粒子偏亮偏热，老化后变暗变灰
  float heatFactor = (1.0 - vAge) * (0.5 + vLayer * 0.5);

  // 基础色：从暗灰到棕色
  vec3 baseColor = mix(darkAsh, brown, 0.3 + vSeed * 0.3);
  // 中层：加入橙色
  baseColor = mix(baseColor, orange, mid * heatFactor * 0.8);
  // 内核：加入金色→白热
  baseColor = mix(baseColor, golden, inner * heatFactor);
  baseColor = mix(baseColor, hotCore, inner * inner * heatFactor * 0.6);

  // 发光叠加 — 让内核真正发亮（HDR 范围，触发 bloom）
  vec3 emissive = mix(orange, hotCore, inner) * heatFactor * inner * 1.2;
  baseColor += emissive;

  // 边缘暖色描边 — 模拟逆光热辐射
  float rim = smoothstep(0.18, 0.36, r) * smoothstep(0.48, 0.34, r);
  baseColor += vec3(0.9, 0.4, 0.1) * rim * heatFactor * 0.5;

  // Cap 层额外加亮（蘑菇帽比柄更亮）
  float capBoost = smoothstep(0.6, 1.0, vLayer) * (1.0 - vAge * 0.6) * 0.3;
  baseColor += vec3(1.0, 0.7, 0.3) * capBoost * mid;

  float alpha = soft * vAlpha * (0.58 + inner * 0.35);
  gl_FragColor = vec4(baseColor, alpha);
}
`;

export class MushroomCloud implements ExplosionModule {
  readonly name = 'MushroomCloud';
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;

  mount(context: ExplosionContext) {
    const countScale = context.reducedMotion ? 0.46 : 1;
    const positions: number[] = [];
    const bases: number[] = [];
    const drifts: number[] = [];
    const births: number[] = [];
    const lives: number[] = [];
    const sizes: number[] = [];
    const seeds: number[] = [];
    const layers: number[] = [];

    const push = (base: THREE.Vector3, drift: THREE.Vector3, birth: number, life: number, size: number, layer: number) => {
      positions.push(0, 0, 0);
      bases.push(base.x, base.y, base.z);
      drifts.push(drift.x, drift.y, drift.z);
      births.push(birth);
      lives.push(life);
      sizes.push(size);
      seeds.push(context.rng());
      layers.push(layer);
    };

    // 蘑菇柄 — 更粗壮，从底部升起
    const stemCount = Math.floor(110 * countScale);
    for (let index = 0; index < stemCount; index += 1) {
      const p = index / Math.max(1, stemCount - 1);
      const angle = context.rng() * Math.PI * 2;
      const radius = (0.18 + p * 0.72) * Math.sqrt(context.rng());
      push(
        new THREE.Vector3(Math.cos(angle) * radius, 0.5 + p * 4.2, Math.sin(angle) * radius * 0.72),
        new THREE.Vector3((context.rng() - 0.5) * 0.8, 1.1 + context.rng() * 1.8, (context.rng() - 0.5) * 0.6),
        context.timeline.cloudAt + p * 800 + context.rng() * 200,
        3500 + context.rng() * 2000,
        52 + p * 88 + context.rng() * 36,
        0.18,
      );
    }

    // 蘑菇帽 — 关键形状：更大、更密、更高位置
    const capCount = Math.floor(180 * countScale);
    for (let index = 0; index < capCount; index += 1) {
      const angle = (index / capCount) * Math.PI * 2 + context.rng() * 0.42;
      const radius = 0.85 + Math.pow(context.rng(), 0.42) * 2.8;
      push(
        new THREE.Vector3(Math.cos(angle) * radius, 4.6 + (context.rng() - 0.5) * 0.72, Math.sin(angle) * radius * 0.52),
        new THREE.Vector3(
          Math.cos(angle) * (0.52 + context.rng() * 1.1),
          0.55 + context.rng() * 1.2,
          Math.sin(angle) * (0.42 + context.rng() * 0.85),
        ),
        context.timeline.capAt + context.rng() * 700,
        3800 + context.rng() * 2400,
        88 + context.rng() * 110,
        0.9,
      );
    }

    // 内吸气流 — 底部向中心聚拢
    const intakeCount = Math.floor(72 * countScale);
    for (let index = 0; index < intakeCount; index += 1) {
      const angle = context.rng() * Math.PI * 2;
      const radius = 0.9 + context.rng() * 2.5;
      push(
        new THREE.Vector3(Math.cos(angle) * radius, 0.34 + context.rng() * 0.5, Math.sin(angle) * radius * 0.62),
        new THREE.Vector3(-Math.cos(angle) * (0.35 + context.rng() * 0.9), 1.4 + context.rng() * 1.5, -Math.sin(angle) * (0.24 + context.rng() * 0.7)),
        context.timeline.cloudAt + 300 + context.rng() * 900,
        2800 + context.rng() * 2000,
        56 + context.rng() * 78,
        0.48,
      );
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
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    context.world.add(this.points);
  }

  update(context: ExplosionContext) {
    if (!this.material || !this.points) return;
    const endFade = 1 - smoothstep(context.timeline.durationMs - 900, context.timeline.durationMs, context.state.elapsedMs);
    this.material.uniforms.uTimeMs.value = context.state.elapsedMs;
    this.material.uniforms.uGlobalOpacity.value = context.state.cloud * endFade;
    this.points.rotation.y = Math.sin(context.state.elapsedMs * 0.00018) * 0.08;
  }

  dispose() {
    if (this.points) {
      disposeObject(this.points);
      this.points = null;
    }
    this.material = null;
  }
}
