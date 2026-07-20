<script setup lang="ts">
import { Gem } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.4);
  const duration = api.duration / 1000;

  // 星野：整场存在的闪烁星点
  for (let i = 0; i < 70; i += 1) {
    api.spawn({
      x: api.range(0, api.width),
      y: api.range(0, api.height * 0.85),
      shape: 'dot',
      size: api.range(0.6, 1.8),
      maxLife: duration,
      color: api.rng() < 0.2 ? '#bae6fd' : '#ffffff',
      twinkle: api.range(0.4, 2.4),
      glow: 0.9,
      fadeIn: 0.1,
      fadeOut: 0.12,
    });
  }

  // 流动的极光幕帘：三层正弦光带逐帧绘制
  const layers = [
    { hue: 152, amp: api.range(34, 52), speed: 0.5, base: 0.26, height: 0.3, freq: 0.006, alpha: 0.16 },
    { hue: 176, amp: api.range(46, 68), speed: -0.36, base: 0.34, height: 0.26, freq: 0.0045, alpha: 0.13 },
    { hue: 262, amp: api.range(30, 48), speed: 0.28, base: 0.2, height: 0.22, freq: 0.0075, alpha: 0.1 },
  ];
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 1.1) * Math.min(1, Math.max(0, (duration - t) / 1));
    if (envelope <= 0) return;
    const step = 16;
    for (const layer of layers) {
      for (let x = -step; x <= api.width + step; x += step) {
        const phase = x * layer.freq + t * layer.speed;
        const y =
          api.height * layer.base +
          Math.sin(phase) * layer.amp +
          Math.sin(phase * 0.37 + 1.7) * layer.amp * 0.7;
        const bandHeight = api.height * layer.height * (0.7 + 0.3 * Math.sin(phase * 0.6 + t * 0.4));
        const hue = layer.hue + Math.sin(x * 0.002 + t * 0.5) * 22;
        const gradient = ctx.createLinearGradient(0, y, 0, y + bandHeight);
        gradient.addColorStop(0, `hsla(${hue}, 85%, 65%, 0)`);
        gradient.addColorStop(0.22, `hsla(${hue}, 85%, 62%, ${layer.alpha * envelope})`);
        gradient.addColorStop(1, `hsla(${hue}, 85%, 60%, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, step + 1, bandHeight);
      }
    }
  });

  // 极光尘：沿光带缓缓上升的绿色微粒
  api.every(90, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.height * api.range(0.24, 0.55),
      vx: api.range(-16, 16),
      vy: api.range(-34, -10),
      shape: 'dot',
      size: api.range(1, 2.2),
      maxLife: api.range(1.6, 2.8),
      color: `hsl(${Math.round(api.range(140, 190))}, 85%, 70%)`,
      twinkle: api.range(2, 5),
      wander: 26,
      glow: 1,
    });
  }, { until: api.duration - 900 });

  // 偶发流星
  api.every(1150, () => {
    const fromX = api.range(api.width * 0.2, api.width * 0.9);
    api.spawn({
      x: fromX,
      y: api.range(-10, api.height * 0.2),
      vx: api.range(-520, -300),
      vy: api.range(180, 300),
      shape: 'streak',
      stretch: 0.12,
      size: 2.2,
      maxLife: api.range(0.7, 1),
      color: '#e0f2fe',
      glow: 1.4,
      fadeIn: 0.08,
      fadeOut: 0.3,
    });
  }, { from: 700, until: api.duration - 1200 });
};
</script>

<template>
  <div class="aurora-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.aurora" :scene="scene" />
    <div class="aurora-core">
      <Gem :size="46" />
      <strong>极光天幕</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.aurora-effect {
  @include effect-stage;
}

.aurora-core {
  position: absolute;
  left: 50%;
  top: 50%;
  color: #d1fae5;
  display: grid;
  gap: 9px;
  place-items: center;
  text-shadow: 0 0 24px rgba(34, 197, 94, 0.45);
  transform: translate(-50%, -50%);
  animation: aurora-core 5.2s ease both;
}

.aurora-core svg {
  color: #86efac;
  filter: drop-shadow(0 0 24px rgba(34, 197, 94, 0.58));
}

.aurora-core strong {
  font-size: 18px;
}

@keyframes aurora-core {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.88);
  }
  18%,
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.94);
  }
}
</style>
