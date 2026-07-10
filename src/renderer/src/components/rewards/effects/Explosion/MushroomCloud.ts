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
  // aSize 已是屏幕像素语义，透视补偿必须克制；300 会把单粒子放大到上千像素。
  gl_PointSize = clamp(aSize * growth * (42.0 / -mvPosition.z), 2.0, 260.0);
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
  private silhouette = new THREE.Group();
  private blobGeometry: THREE.SphereGeometry | null = null;
  private blobs: Array<{
    mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
    basePosition: THREE.Vector3;
    baseScale: THREE.Vector3;
    birth: number;
    role: 'stem' | 'cap' | 'crown';
    drift: number;
  }> = [];
  private readonly hotColor = new THREE.Color(0xffc56f);
  private readonly warmColor = new THREE.Color(0xd65a1d);
  private readonly ashColor = new THREE.Color(0x3b241b);
  private readonly tempColor = new THREE.Color();

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

    this.createSilhouette(context);
  }

  update(context: ExplosionContext) {
    if (!this.material || !this.points) return;
    const endFade = 1 - smoothstep(context.timeline.durationMs - 900, context.timeline.durationMs, context.state.elapsedMs);
    this.material.uniforms.uTimeMs.value = context.state.elapsedMs;
    // 点云只负责翻滚细节，实体云柱/云冠负责在任何分辨率下都能读出蘑菇轮廓。
    this.material.uniforms.uGlobalOpacity.value = Math.min(1, context.state.cloud * 1.55) * endFade;
    this.points.rotation.y = Math.sin(context.state.elapsedMs * 0.00018) * 0.08;

    const t = context.state.elapsedMs;
    const capActivation = smoothstep(context.timeline.capAt - 520, context.timeline.capAt + 560, t);
    this.blobs.forEach((blob, index) => {
      const local = smoothstep(blob.birth, blob.birth + 520, t);
      const activation = blob.role === 'stem' ? context.state.cloud : capActivation;
      const visible = local * activation * endFade;
      const expansion = 0.12 + (1 - Math.pow(1 - local, 4)) * (blob.role === 'stem' ? 0.98 : 1.08);
      const breathe = 1 + Math.sin(t * 0.0011 + index * 1.73) * 0.035 * local;
      blob.mesh.scale.set(
        blob.baseScale.x * expansion * breathe,
        blob.baseScale.y * expansion * (1 + local * (blob.role === 'stem' ? 0.12 : 0.05)),
        blob.baseScale.z * expansion * breathe,
      );
      blob.mesh.position.copy(blob.basePosition);
      blob.mesh.position.y += local * blob.drift;
      blob.mesh.rotation.y = Math.sin(t * 0.00034 + index) * 0.22;
      blob.mesh.rotation.z = Math.sin(t * 0.00028 + index * 0.7) * 0.08;

      const smokeCooling = Math.min(1, context.state.smoke * (blob.role === 'stem' ? 1.05 : 0.72));
      this.tempColor.copy(blob.role === 'crown' ? this.hotColor : this.warmColor).lerp(this.ashColor, smokeCooling);
      blob.mesh.material.color.copy(this.tempColor);
      blob.mesh.material.emissive.copy(this.tempColor).multiplyScalar(0.72);
      blob.mesh.material.emissiveIntensity = (0.72 - smokeCooling * 0.5) * visible;
      blob.mesh.material.opacity = visible * (blob.role === 'stem' ? 0.5 : blob.role === 'cap' ? 0.58 : 0.54);
    });

    this.silhouette.rotation.y = Math.sin(t * 0.00016) * 0.045;
  }

  dispose() {
    if (this.points) {
      disposeObject(this.points);
      this.points = null;
    }
    this.material = null;
    disposeObject(this.silhouette);
    this.silhouette.clear();
    this.blobGeometry = null;
    this.blobs = [];
  }

  private createSilhouette(context: ExplosionContext) {
    this.blobGeometry = new THREE.SphereGeometry(1, context.reducedMotion ? 18 : 32, context.reducedMotion ? 12 : 22);
    const positions = this.blobGeometry.getAttribute('position') as THREE.BufferAttribute;
    const vertex = new THREE.Vector3();
    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index);
      const ripple = 1
        + Math.sin(vertex.x * 5.7 + vertex.y * 2.9) * 0.075
        + Math.sin(vertex.z * 7.1 - vertex.y * 4.3) * 0.055
        + Math.sin((vertex.x + vertex.z) * 9.4) * 0.035;
      vertex.multiplyScalar(ripple);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
    positions.needsUpdate = true;
    this.blobGeometry.computeVertexNormals();

    const addBlob = (
      role: 'stem' | 'cap' | 'crown',
      position: THREE.Vector3,
      scale: THREE.Vector3,
      birth: number,
      drift: number,
    ) => {
      if (!this.blobGeometry) return;
      const material = new THREE.MeshStandardMaterial({
        color: role === 'crown' ? 0xe87922 : 0x9a3412,
        emissive: role === 'crown' ? 0xc2410c : 0x7c2d12,
        emissiveIntensity: 0,
        roughness: 0.94,
        metalness: 0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.blobGeometry, material);
      mesh.position.copy(position);
      mesh.scale.setScalar(0.01);
      mesh.renderOrder = role === 'stem' ? 2 : 3;
      this.silhouette.add(mesh);
      this.blobs.push({ mesh, basePosition: position.clone(), baseScale: scale, birth, role, drift });
    };

    // 粗壮连续云柱：重叠椭球确保中段不会因点粒子透明而断裂。
    for (let index = 0; index < 11; index += 1) {
      const p = index / 10;
      const y = 0.52 + p * 4.18;
      const width = 0.34 + Math.sin(p * Math.PI) * 0.2 + p * 0.14;
      addBlob(
        'stem',
        new THREE.Vector3((context.rng() - 0.5) * 0.22, y, (context.rng() - 0.5) * 0.12),
        new THREE.Vector3(width, 0.58 + p * 0.14, width * 0.76),
        context.timeline.cloudAt - 120 + index * 62,
        0.18 + p * 0.38,
      );
    }

    // 云冠主体：中央扁平体积 + 椭圆环状翻滚云团，宽度显著大于云柱。
    addBlob(
      'cap',
      new THREE.Vector3(0, 4.86, 0),
      new THREE.Vector3(1.86, 0.54, 1.04),
      context.timeline.capAt - 520,
      0.42,
    );
    const capCount = context.reducedMotion ? 10 : 16;
    for (let index = 0; index < capCount; index += 1) {
      const angle = (index / capCount) * Math.PI * 2;
      const radius = 1.08 + context.rng() * 0.54;
      addBlob(
        'cap',
        new THREE.Vector3(Math.cos(angle) * radius, 4.82 + Math.sin(angle * 2) * 0.16, Math.sin(angle) * radius * 0.46),
        new THREE.Vector3(0.58 + context.rng() * 0.3, 0.46 + context.rng() * 0.2, 0.48 + context.rng() * 0.22),
        context.timeline.capAt - 440 + context.rng() * 360,
        0.38 + context.rng() * 0.32,
      );
    }

    // 上翻云冠：形成经典蘑菇帽顶部的团簇与内焰亮边。
    const crownCount = context.reducedMotion ? 6 : 10;
    for (let index = 0; index < crownCount; index += 1) {
      const angle = (index / crownCount) * Math.PI * 2 + 0.28;
      const radius = 0.34 + context.rng() * 0.72;
      addBlob(
        'crown',
        new THREE.Vector3(Math.cos(angle) * radius, 5.35 + context.rng() * 0.55, Math.sin(angle) * radius * 0.5),
        new THREE.Vector3(0.52 + context.rng() * 0.3, 0.48 + context.rng() * 0.26, 0.46 + context.rng() * 0.24),
        context.timeline.capAt - 260 + context.rng() * 420,
        0.42 + context.rng() * 0.4,
      );
    }

    context.world.add(this.silhouette);
  }
}
