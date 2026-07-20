<script setup lang="ts">
import { Layers } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const duration = api.duration / 1000;

  // 棱镜色散光束：斜向扫过屏幕、颜色随时间循环的光带
  const rays = Array.from({ length: 4 }, (_, i) => ({
    offset: api.range(-0.2, 0.2) + i * 0.24,
    speed: api.range(0.1, 0.2),
    hueSpeed: api.range(30, 70),
    huePhase: api.range(0, 360),
    width: api.range(24, 60),
  }));
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 1) * Math.min(1, Math.max(0, (duration - t) / 0.9));
    if (envelope <= 0) return;
    ctx.save();
    ctx.translate(api.width / 2, api.height / 2);
    ctx.rotate(0.32); // 与 CSS 棱镜条纹一致的斜角
    for (const ray of rays) {
      const x = ((ray.offset + t * ray.speed) % 1.2 - 0.6) * api.width;
      const hue = (ray.huePhase + t * ray.hueSpeed) % 360;
      const gradient = ctx.createLinearGradient(x - ray.width, 0, x + ray.width, 0);
      gradient.addColorStop(0, `hsla(${hue}, 90%, 70%, 0)`);
      gradient.addColorStop(0.5, `hsla(${hue}, 90%, 70%, ${0.22 * envelope})`);
      gradient.addColorStop(1, `hsla(${(hue + 60) % 360}, 90%, 70%, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - ray.width, -api.height, ray.width * 2, api.height * 2);
    }
    ctx.restore();
  });

  // 光谱碎钻：彩虹色相的闪烁光尘
  api.every(60, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.range(0, api.height),
      vx: api.range(-24, 24),
      vy: api.range(-40, -8),
      shape: 'dot',
      size: api.range(1, 2.4),
      maxLife: api.range(1, 2.2),
      color: `hsl(${Math.round(api.range(0, 360))}, 92%, 72%)`,
      twinkle: api.range(4, 10),
      wander: 34,
      glow: 1,
    });
  }, { until: api.duration - 900 });

  // 折射闪光：玻璃棱角上的星芒
  api.every(420, () => {
    api.spawn({
      x: api.width / 2 + api.range(-api.width * 0.24, api.width * 0.24),
      y: api.height / 2 + api.range(-api.height * 0.2, api.height * 0.2),
      shape: 'glyph',
      glyph: '✦',
      size: api.range(16, 34),
      endSize: 8,
      maxLife: api.range(0.6, 1),
      color: `hsl(${Math.round(api.range(0, 360))}, 85%, 80%)`,
      spin: api.range(-1, 1),
      fadeIn: 0.24,
      fadeOut: 0.4,
    });
  }, { from: 400, until: api.duration - 1000 });
};
</script>

<template>
  <div class="glass-refraction-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.glassRefraction" :scene="scene" />
    <div class="glass-stack">
      <span
        v-for="layer in 5"
        :key="layer"
        class="glass-layer"
        :style="{
          '--layer-x': `${(layer - 3) * 34}px`,
          '--layer-y': `${(layer - 3) * -18}px`,
          '--layer-rotate': `${(layer - 3) * 4}deg`,
          animationDelay: `${(layer - 1) * 110}ms`,
        }"
      />
      <div class="glass-refraction-label">
        <Layers :size="50" />
        <strong>玻璃折射层</strong>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.glass-refraction-effect {
  @include effect-stage(hidden);
}

.glass-stack {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 78vw);
  height: min(330px, 56vh);
  transform: translate(-50%, -50%);
  animation: glass-stack 5.2s ease both;
}

.glass-layer {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 16px;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.22), transparent 32% 68%, rgba(125, 249, 255, 0.18)),
    rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px) saturate(1.2);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.36),
    0 26px 70px rgba(2, 6, 23, 0.22);
  opacity: 0;
  transform: translate(var(--layer-x), var(--layer-y)) rotate(var(--layer-rotate)) scale(0.92);
  animation: glass-layer 4.8s ease both;
}

.glass-layer::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    105deg,
    transparent 0 20px,
    rgba(255, 255, 255, 0.14) 21px 23px,
    transparent 24px 44px
  );
  transform: translateX(-24px);
  animation: glass-shift 1.8s ease-in-out infinite alternate;
}

.glass-refraction-label {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #f0f9ff;
  transform: translate(-50%, -50%);
  animation: glass-label 5.2s ease both;
}

.glass-refraction-label strong {
  font-size: 16px;
}

@keyframes glass-stack {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.86); }
  18%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes glass-layer {
  0%, 100% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(0.86); }
  24%, 78% { opacity: 1; transform: translate(var(--layer-x), var(--layer-y)) rotate(var(--layer-rotate)) scale(1); }
}

@keyframes glass-shift {
  to { transform: translateX(24px); }
}

@keyframes glass-label {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) scale(0.88); }
  22%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
