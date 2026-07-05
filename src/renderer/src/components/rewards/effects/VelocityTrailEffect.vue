<script setup lang="ts">
import { Bike } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.1); // 重拖尾：速度光轨的灵魂
  const bikeX = api.width / 2;
  const bikeY = api.height / 2;

  // 主光轨：从右侧呼啸而过的彩色拖尾光带
  api.every(24, () => {
    const hue = api.range(180, 320);
    api.spawn({
      x: api.width + 30,
      y: api.range(api.height * 0.14, api.height * 0.82),
      vx: -api.range(900, 1700),
      vy: api.range(-30, 30),
      shape: 'streak',
      stretch: 0.08,
      size: api.range(2, 4),
      maxLife: 1.1,
      color: `hsl(${Math.round(hue)}, 94%, 66%)`,
      glow: 1.15,
      fadeIn: 0.05,
      fadeOut: 0.12,
    });
  }, { until: api.duration - 800 });

  // 风切碎屑：细小白色速度线
  api.every(30, () => {
    api.spawn({
      x: api.width + 10,
      y: api.range(0, api.height),
      vx: -api.range(1400, 2200),
      shape: 'streak',
      stretch: 0.04,
      size: api.range(0.8, 1.6),
      maxLife: 0.7,
      color: 'rgba(255, 255, 255, 0.85)',
      glow: 0.6,
      fadeIn: 0.04,
      fadeOut: 0.2,
    });
  }, { until: api.duration - 800 });

  // 车轮尾焰：从骑手身后持续喷出的青色粒子流
  api.every(22, () => {
    api.spawn({
      x: bikeX - 30 + api.range(-10, 10),
      y: bikeY + 30 + api.range(-8, 8),
      vx: -api.range(420, 760),
      vy: api.range(-60, 60),
      drag: 0.4,
      shape: 'spark',
      size: api.range(1.6, 3),
      maxLife: api.range(0.5, 1),
      color: api.rng() < 0.6 ? '#22d3ee' : '#a5f3fc',
      twinkle: 10,
      glow: 1.2,
      wander: 90,
    });
  }, { from: 300, until: api.duration - 900 });

  // 冲刺爆发：三次加速脉冲，白光一闪 + 密集光轨
  [900, 2200, 3400].forEach((when) => {
    api.at(when, () => {
      api.spawn({ x: bikeX, y: bikeY, shape: 'dot', size: 40, endSize: 4, maxLife: 0.4, color: '#e0f2fe', glow: 2 });
      api.spawn({ x: bikeX, y: bikeY, shape: 'ring', size: 20, endSize: 220, maxLife: 0.7, color: '#38bdf8', opacity: 0.8 });
      api.burst({
        x: bikeX - 20,
        y: bikeY + 20,
        count: 30,
        speed: [500, 1100],
        angle: [Math.PI - 0.3, Math.PI + 0.3],
        base: { shape: 'streak', stretch: 0.07, size: 2.2, maxLife: 0.8, color: '#7dd3fc', glow: 1.2, fadeOut: 0.3 },
      });
    });
  });
};
</script>

<template>
  <div class="velocity-trail-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.velocityTrail" :scene="scene" />
    <div class="velocity-road">
      <span v-for="index in 7" :key="index" />
    </div>
    <div class="velocity-bike">
      <Bike :size="62" />
      <strong>骑行速度光轨</strong>
    </div>
  </div>
</template>

<style scoped>
.velocity-trail-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: velocity-shake 220ms linear 8;
}

.velocity-road {
  position: absolute;
  left: 50%;
  bottom: 14%;
  width: min(720px, 92vw);
  height: 160px;
  overflow: hidden;
  transform: translateX(-50%) perspective(500px) rotateX(62deg);
}

.velocity-road::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 48%, rgba(34, 211, 238, 0.46) 49% 51%, transparent 52%),
    repeating-linear-gradient(90deg, transparent 0 66px, rgba(244, 114, 182, 0.26) 67px 69px);
  opacity: 0;
  animation: velocity-road 4.8s ease both;
}

.velocity-road span {
  position: absolute;
  left: 50%;
  top: calc(var(--road-index, 1) * 18px);
  width: 58px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  transform: translateX(-50%);
  animation: velocity-road-mark 760ms linear infinite;
}

.velocity-road span:nth-child(1) { --road-index: 1; animation-delay: 0ms; }
.velocity-road span:nth-child(2) { --road-index: 2; animation-delay: 90ms; }
.velocity-road span:nth-child(3) { --road-index: 3; animation-delay: 180ms; }
.velocity-road span:nth-child(4) { --road-index: 4; animation-delay: 270ms; }
.velocity-road span:nth-child(5) { --road-index: 5; animation-delay: 360ms; }
.velocity-road span:nth-child(6) { --road-index: 6; animation-delay: 450ms; }
.velocity-road span:nth-child(7) { --road-index: 7; animation-delay: 540ms; }

.velocity-bike {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #f0f9ff;
  text-shadow: 0 0 20px rgba(14, 165, 233, 0.82);
  transform: translate(-50%, -50%);
  animation: velocity-bike 4.8s ease both;
}

.velocity-bike strong {
  font-size: 16px;
}

@keyframes velocity-road {
  0%, 100% { opacity: 0; }
  16%, 78% { opacity: 1; }
}

@keyframes velocity-road-mark {
  from { transform: translate(-50%, -120px) scaleX(0.48); opacity: 0; }
  40% { opacity: 1; }
  to { transform: translate(-50%, 190px) scaleX(1.7); opacity: 0; }
}

@keyframes velocity-bike {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  44% { transform: translate(calc(-50% + 8px), calc(-50% - 3px)) scale(1.03); }
  58% { transform: translate(calc(-50% - 6px), calc(-50% + 2px)) scale(1); }
}

@keyframes velocity-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  33% { transform: translate3d(1px, -1px, 0); }
  66% { transform: translate3d(-1px, 1px, 0); }
}
</style>
