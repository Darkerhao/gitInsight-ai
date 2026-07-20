<script setup lang="ts">
import { Expand } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const JUMP_COLORS = ['#c7d2fe', '#818cf8', '#22d3ee', '#f0abfc'];

const scene: SceneFn = (api) => {
  api.setTrail(0.22);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 第一幕（0-1.5s）：能量向中心汇聚（吸入螺旋）
  api.every(16, () => {
    let radius = api.range(220, Math.max(api.width, api.height) * 0.55);
    let angle = api.range(0, Math.PI * 2);
    const angularSpeed = api.range(1.2, 2.6);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'spark',
      size: api.range(1.4, 2.6),
      maxLife: 1.5,
      color: api.pick(JUMP_COLORS),
      glow: 1.1,
      fadeIn: 0.12,
      fadeOut: 0.06,
      update: (p, dt) => {
        angle += angularSpeed * dt * (1 + (260 - Math.min(radius, 260)) / 90);
        radius -= (radius * 1.6 + 60) * dt;
        if (radius < 10) p.life = p.maxLife;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius;
      },
    });
  }, { until: 1450 });

  // 第二幕（1.55s）：跃迁闪爆
  api.at(1550, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 300, maxLife: 0.7, color: '#eef2ff', glow: 2.2, fadeOut: 0.9 });
    [0, 120, 260].forEach((delay, i) => {
      api.at(1550 + delay, () => {
        api.spawn({
          x: cx,
          y: cy,
          shape: 'ring',
          size: 20,
          endSize: Math.max(api.width, api.height) * (0.5 + i * 0.18),
          maxLife: 1,
          color: i === 1 ? '#22d3ee' : '#a5b4fc',
          opacity: 0.9,
          fadeOut: 0.8,
        });
      });
    });
  });

  // 第三幕（1.7s+）：穿越隧道，星流全速外冲
  api.every(11, () => {
    const angle = api.range(0, Math.PI * 2);
    const startRadius = api.range(4, 44);
    api.spawn({
      x: cx + Math.cos(angle) * startRadius,
      y: cy + Math.sin(angle) * startRadius,
      vx: Math.cos(angle) * api.range(60, 140),
      vy: Math.sin(angle) * api.range(60, 140),
      shape: 'streak',
      stretch: 0.11,
      size: api.range(1.6, 3),
      maxLife: api.range(0.8, 1.4),
      color: api.pick(JUMP_COLORS),
      glow: 1.05,
      fadeIn: 0.1,
      fadeOut: 0.08,
      update: (p, dt) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        p.vx += dx * 4.6 * dt;
        p.vy += dy * 4.6 * dt;
      },
    });
  }, { from: 1700, until: api.duration - 650 });
};
</script>

<template>
  <div class="space-jump-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.spaceJump" :scene="scene" />
    <div class="space-capsule">
      <Expand :size="56" />
      <strong>空间跃迁</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.space-jump-effect {
  @include effect-stage(hidden);
  animation: space-camera 5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.space-jump-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(620px, 82vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    conic-gradient(from 0deg, rgba(129, 140, 248, 0), rgba(129, 140, 248, 0.44), rgba(34, 211, 238, 0.32), rgba(129, 140, 248, 0));
  filter: blur(18px);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: space-lens 5s ease both;
}

.space-capsule {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.28), rgba(2, 6, 23, 0.3) 68%, transparent);
  color: #e0e7ff;
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: space-capsule 5s ease both;
}

.space-capsule::before {
  content: '';
  position: absolute;
  inset: -22px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(129, 140, 248, 0.66), rgba(255, 255, 255, 0.6), transparent 45%);
  opacity: 0.74;
  animation: space-capsule-orbit 1.6s linear infinite;
}

.space-capsule svg,
.space-capsule strong {
  position: relative;
  z-index: 1;
}

.space-capsule strong {
  font-size: 16px;
}

@keyframes space-lens {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); }
  24%, 76% { opacity: 1; }
  58% { transform: translate(-50%, -50%) scale(1.2) rotate(140deg); }
}

@keyframes space-camera {
  0% { filter: blur(0); transform: scale(1.18); }
  28% { filter: blur(2px); transform: scale(0.74); }
  54% { filter: blur(6px); transform: scale(1.46); }
  78% { filter: blur(0); transform: scale(1); }
  100% { filter: blur(8px); transform: scale(1.28); opacity: 0; }
}

@keyframes space-capsule {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.68); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  48% { transform: translate(-50%, -50%) scale(0.72); }
  62% { transform: translate(-50%, -50%) scale(1.22); }
}

@keyframes space-capsule-orbit {
  to { transform: rotate(360deg); }
}
</style>
