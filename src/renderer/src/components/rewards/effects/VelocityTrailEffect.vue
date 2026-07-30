<script setup lang="ts">
import { Bike } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 极速光轨 SLIPSTREAM · 4.8s
 * 幕一 0-450ms   风切白线率先掠过，路面亮起
 * 幕二 450-4050  三层纵深光轨横穿（远暗小慢 → 近亮大快）+ 车轮尾焰 + 三次加速脉冲（白闪/冲击环/粉色回波环）
 * 幕三 4050-4800 尾焰断流，终场白青巨轨冲出画面，余尘散落
 * 配色：白热核心 + 青绿主色（#2dd4bf）辉光 + 粉色（#f472b6）点缀，弃彩虹
 */
const PULSES = [900, 2150, 3400];

const scene: SceneFn = (api) => {
  api.setTrail(0.1); // 重拖尾：速度光轨的灵魂
  const bikeX = api.width / 2;
  const bikeY = api.height / 2;

  // ── 风切碎屑：细小白色速度线，全程铺底 ──
  api.every(32, () => {
    api.spawn({
      x: api.width + 10,
      y: api.range(0, api.height),
      vx: -api.range(1400, 2200),
      shape: 'streak', stretch: 0.04, size: api.range(0.8, 1.6), maxLife: 0.7,
      color: 'rgba(255, 255, 255, 0.85)', glow: 0.6, fadeIn: 0.04, fadeOut: 0.2,
    });
  }, { until: api.duration - 820 });

  // ── 幕二：三层纵深光轨（depth 决定速度/尺寸/亮度）──
  const spawnTrail = (depth: number) => {
    const near = depth > 0.85;
    const pink = near && api.rng() < 0.22;
    const yBand: [number, number] = near ? [0.58, 0.84] : depth > 0.6 ? [0.34, 0.6] : [0.12, 0.36];
    api.spawn({
      x: api.width + 30,
      y: api.height * api.range(yBand[0], yBand[1]),
      vx: -api.range(800, 1200) * (0.5 + depth * 0.85),
      vy: api.range(-24, 24) * depth,
      shape: 'streak',
      stretch: 0.05 + depth * 0.035,
      size: api.range(1.2, 2) * (0.7 + depth * 1),
      opacity: 0.34 + depth * 0.66,
      maxLife: 1.1,
      color: pink ? '#f472b6' : api.pick(['#2dd4bf', '#5eead4', '#99f6e4']),
      glow: 0.6 + depth * 0.6,
      fadeIn: 0.05,
      fadeOut: 0.12,
    });
  };
  api.every(26, () => spawnTrail(api.pick([0.45, 0.7, 1, 1])), { from: 240, until: api.duration - 820 });

  // 双色错位光对：青粉并行的色差拖尾（科技感点缀）
  api.every(430, () => {
    const y = api.height * api.range(0.3, 0.74);
    const vx = -api.range(1300, 1700);
    api.spawn({ x: api.width + 24, y: y - 4, vx, shape: 'streak', stretch: 0.075, size: 2.2, maxLife: 1, color: '#5eead4', glow: 1, fadeOut: 0.14 });
    api.spawn({ x: api.width + 24, y: y + 4, vx: vx * 0.97, shape: 'streak', stretch: 0.075, size: 2, maxLife: 1, color: '#f472b6', glow: 0.9, opacity: 0.8, fadeOut: 0.14 });
  }, { from: 700, until: api.duration - 1000 });

  // 车轮尾焰：青色粒子流持续喷出 + 触地火花（重力弹跳余烬）
  api.every(24, () => {
    api.spawn({
      x: bikeX - 30 + api.range(-10, 10),
      y: bikeY + 30 + api.range(-8, 8),
      vx: -api.range(420, 760),
      vy: api.range(-60, 60),
      drag: 0.4,
      shape: 'spark', size: api.range(1.6, 3), maxLife: api.range(0.5, 1),
      color: api.rng() < 0.62 ? '#2dd4bf' : '#a5f3fc',
      twinkle: 10, glow: 1.2, wander: 90,
    });
  }, { from: 300, until: api.duration - 900 });
  api.every(140, () => {
    api.spawn({
      x: bikeX - api.range(20, 90),
      y: bikeY + 42,
      vx: -api.range(120, 320),
      vy: -api.range(60, 200),
      ay: 620, drag: 0.6,
      shape: 'spark', size: api.range(1, 1.8), maxLife: api.range(0.5, 0.9),
      color: api.rng() < 0.7 ? '#5eead4' : '#fef9c3',
      glow: 0.9, fadeOut: 0.4,
    });
  }, { from: 600, until: api.duration - 1000 });

  // ── 三次加速脉冲：白闪 + 青环 + 粉色回波环 + 密集光轨涌出 + 速度符 ──
  PULSES.forEach((when, n) => {
    api.at(when, () => {
      api.spawn({ x: bikeX, y: bikeY, shape: 'dot', size: 40, endSize: 4, maxLife: 0.4, color: '#f0fdfa', glow: 2 });
      api.spawn({ x: bikeX, y: bikeY, shape: 'ring', size: 20, endSize: 230 + n * 40, maxLife: 0.7, color: '#2dd4bf', opacity: 0.85, fadeOut: 0.6 });
      api.burst({
        x: bikeX - 20, y: bikeY + 20,
        count: 26 + n * 6, speed: [500, 1100 + n * 150],
        angle: [Math.PI - 0.3, Math.PI + 0.3],
        base: { shape: 'streak', stretch: 0.07, size: 2.2, maxLife: 0.8, color: '#5eead4', glow: 1.2, fadeOut: 0.3 },
        vary: (p, rng) => {
          if (rng() < 0.2) p.color = '#f472b6';
          else if (rng() < 0.24) p.color = '#ffffff';
        },
      });
      // 速度符：等宽 '»' 自骑手处向左飞出
      api.spawn({
        x: bikeX + 46, y: bikeY - 26, vx: -420, shape: 'glyph', glyph: '»',
        size: 22, maxLife: 0.7, color: '#99f6e4', fadeIn: 0.08, fadeOut: 0.4,
      });
    });
    // 粉色回波环：滞后 140ms 的第二波（回波次级系统）
    api.at(when + 140, () => {
      api.spawn({ x: bikeX, y: bikeY, shape: 'ring', size: 60, endSize: 300 + n * 40, maxLife: 0.8, color: '#f472b6', opacity: 0.42, fadeOut: 0.7 });
    });
    // 脉冲后的 200ms 光轨涌流
    api.every(9, () => spawnTrail(1), { from: when + 40, until: when + 240 });
  });

  // ── 幕三：终场白青巨轨冲出画面 + 余尘散落 ──
  api.at(4150, () => {
    api.spawn({
      x: api.width + 40, y: bikeY + api.range(-30, 30), vx: -2400,
      shape: 'streak', stretch: 0.09, size: 5, maxLife: 0.62,
      color: '#f0fdfa', glow: 1.6, fadeIn: 0.04, fadeOut: 0.2,
    });
    api.spawn({
      x: api.width + 40, y: bikeY + 10, vx: -2200,
      shape: 'streak', stretch: 0.08, size: 3, maxLife: 0.6,
      color: '#2dd4bf', glow: 1.2, opacity: 0.8, fadeOut: 0.2,
    });
  });
  api.every(70, () => {
    api.spawn({
      x: api.range(api.width * 0.2, api.width * 0.9),
      y: api.range(api.height * 0.3, api.height * 0.8),
      vx: -api.range(30, 90), vy: api.range(-16, 16),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.5, 0.9),
      color: api.pick(['#5eead4', '#99f6e4', '#f9a8d4']),
      glow: 0.8, twinkle: 4, wander: 40, fadeOut: 0.5,
    });
  }, { from: 4150, until: 4460 });
};
</script>

<template>
  <div class="velocity-trail-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.velocityTrail" :scene="scene" />
    <div class="velocity-road">
      <span v-for="index in 7" :key="index" />
    </div>
    <div class="velocity-bike">
      <Bike :size="58" />
      <strong>极速光轨</strong>
      <small>SLIPSTREAM · 412 KM/H</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.velocity-trail-effect {
  @include effect-stage(hidden);
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
    linear-gradient(90deg, transparent 48%, rgba(45, 212, 191, 0.46) 49% 51%, transparent 52%),
    repeating-linear-gradient(90deg, transparent 0 66px, rgba(244, 114, 182, 0.24) 67px 69px);
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
  gap: 8px;
  place-items: center;
  color: #f0fdfa;
  text-shadow: 0 0 20px rgba(45, 212, 191, 0.8);
  transform: translate(-50%, -50%);
  animation: velocity-bike 4.8s ease both;
}

.velocity-bike strong {
  font-size: 16px;
  letter-spacing: 0.12em;
}

.velocity-bike small {
  color: rgba(153, 246, 228, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.22em;
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
  16%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  22% { transform: translate(calc(-50% + 7px), calc(-50% - 3px)) scale(1.03); }
  48% { transform: translate(calc(-50% + 8px), calc(-50% - 3px)) scale(1.04); }
  58% { transform: translate(calc(-50% - 6px), calc(-50% + 2px)) scale(1); }
  74% { transform: translate(calc(-50% + 8px), calc(-50% - 2px)) scale(1.03); }
}

@keyframes velocity-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  33% { transform: translate3d(1px, -1px, 0); }
  66% { transform: translate3d(-1px, 1px, 0); }
}
</style>
