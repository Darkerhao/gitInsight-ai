<script setup lang="ts">
import { Rocket } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const STAR_COLORS = ['#ffffff', '#dbeafe', '#93c5fd', '#60a5fa', '#a5f3fc'];

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 超空间星流：星点从中心加速冲出，速度越快光条越长
  api.every(13, () => {
    const angle = api.range(0, Math.PI * 2);
    const startRadius = api.range(6, 60);
    api.spawn({
      x: cx + Math.cos(angle) * startRadius,
      y: cy + Math.sin(angle) * startRadius * 0.9,
      vx: Math.cos(angle) * api.range(30, 90),
      vy: Math.sin(angle) * api.range(30, 90),
      shape: 'streak',
      stretch: 0.1,
      size: api.range(1.4, 2.8),
      maxLife: api.range(1, 1.7),
      color: api.pick(STAR_COLORS),
      glow: 1,
      fadeIn: 0.14,
      fadeOut: 0.08,
      update: (p, dt) => {
        // 距中心越远越快，模拟穿越隧道的透视加速
        const dx = p.x - cx;
        const dy = p.y - cy;
        p.vx += dx * 3.4 * dt;
        p.vy += dy * 3.4 * dt;
      },
    });
  }, { until: api.duration - 700 });

  // 入场引擎点火闪光 + 周期性跃迁脉冲环
  api.at(80, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 60, endSize: 6, maxLife: 0.5, color: '#dbeafe', glow: 2.4 });
  });
  api.every(620, () => {
    api.spawn({
      x: cx,
      y: cy,
      shape: 'ring',
      size: 30,
      endSize: Math.max(api.width, api.height) * 0.62,
      maxLife: 1.1,
      color: '#93c5fd',
      opacity: 0.7,
      fadeIn: 0.05,
      fadeOut: 0.7,
    });
  }, { from: 200, until: api.duration - 1300 });

  // 尾声：巨大白蓝闪光收束
  api.at(api.duration - 1050, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 10, endSize: 240, maxLife: 0.9, color: '#eff6ff', glow: 2, fadeOut: 0.85 });
    api.burst({
      x: cx,
      y: cy,
      count: 60,
      speed: [200, 720],
      base: { shape: 'streak', stretch: 0.08, size: 2, maxLife: 0.8, color: '#bfdbfe', glow: 1.1, fadeOut: 0.4 },
    });
  });
};
</script>

<template>
  <div class="warp-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.warp" :scene="scene" />
    <div class="warp-ship">
      <Rocket :size="54" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.warp-effect {
  @include effect-stage;
}

.warp-ship {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.36);
  color: #bfdbfe;
  display: grid;
  place-items: center;
  box-shadow:
    0 0 0 18px rgba(96, 165, 250, 0.08),
    0 0 70px rgba(96, 165, 250, 0.34);
  transform: translate(-50%, -50%);
  animation: warp-ship 4.2s ease both;
}

@keyframes warp-ship {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.78) rotate(-18deg);
  }
  18%,
  68% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + 160px), calc(-50% - 120px)) scale(0.52) rotate(16deg);
  }
}
</style>
