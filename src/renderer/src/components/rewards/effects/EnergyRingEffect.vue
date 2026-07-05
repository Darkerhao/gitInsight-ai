<script setup lang="ts">
import { CircleDashed } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const CHARGE_MS = 3200; // 与 CSS 的 energy-complete-wave 时刻对齐

const scene: SceneFn = (api) => {
  api.setTrail(0.18);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const orbitRadius = Math.min(160, Math.min(api.width, api.height) * 0.3);

  // 充能阶段：能量从四周被吸入，汇入轨道环
  api.every(24, () => {
    const angle = api.range(0, Math.PI * 2);
    let radius = api.range(orbitRadius + 140, Math.min(api.width, api.height) * 0.55);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'spark',
      size: api.range(1.4, 2.6),
      maxLife: 1.1,
      color: api.rng() < 0.5 ? '#93c5fd' : '#5eead4',
      glow: 1.1,
      fadeIn: 0.14,
      fadeOut: 0.1,
      update: (p, dt) => {
        radius -= (radius - orbitRadius + 30) * 2.2 * dt;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius;
      },
    });
  }, { until: CHARGE_MS - 300 });

  // 轨道环上的高速环流粒子：越接近放电越快
  api.every(30, () => {
    let angle = api.range(0, Math.PI * 2);
    api.spawn({
      x: cx + Math.cos(angle) * orbitRadius,
      y: cy + Math.sin(angle) * orbitRadius,
      shape: 'spark',
      size: api.range(1.8, 3),
      maxLife: api.range(0.7, 1.2),
      color: api.pick(['#93c5fd', '#5eead4', '#f9a8d4']),
      glow: 1.2,
      fadeIn: 0.08,
      update: (p, dt) => {
        const chargeBoost = 1 + Math.min(2.4, p.life * 2);
        angle += 3.2 * chargeBoost * dt;
        p.x = cx + Math.cos(angle) * orbitRadius;
        p.y = cy + Math.sin(angle) * orbitRadius;
      },
    });
  }, { until: CHARGE_MS - 120 });

  // 放电：白光爆闪 + 全向火花喷射 + 多重冲击环
  api.at(CHARGE_MS, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 70, endSize: 6, maxLife: 0.5, color: '#eff6ff', glow: 2.4, fadeOut: 0.9 });
    api.burst({
      x: cx,
      y: cy,
      count: 150,
      speed: [180, 720],
      base: { shape: 'spark', size: 2, drag: 0.36, color: '#93c5fd', twinkle: 8, glow: 1.2, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.maxLife = 0.8 + rng() * 1;
        const roll = rng();
        if (roll < 0.3) p.color = '#5eead4';
        else if (roll < 0.45) p.color = '#f9a8d4';
        else if (roll < 0.6) p.color = '#e0f2fe';
      },
    });
    [0, 140, 300].forEach((delay) => {
      api.at(CHARGE_MS + delay, () => {
        api.spawn({
          x: cx,
          y: cy,
          shape: 'ring',
          size: orbitRadius * 0.4,
          endSize: Math.max(api.width, api.height) * 0.55,
          maxLife: 1,
          color: '#bfdbfe',
          opacity: 0.85,
          fadeOut: 0.8,
        });
      });
    });
  });

  // 余韵：放电后飘散的电荷微粒
  api.every(60, () => {
    api.spawn({
      x: cx + api.range(-orbitRadius, orbitRadius),
      y: cy + api.range(-orbitRadius, orbitRadius),
      vx: api.range(-40, 40),
      vy: api.range(-70, -20),
      shape: 'dot',
      size: api.range(1, 2),
      maxLife: api.range(0.8, 1.4),
      color: '#bfdbfe',
      twinkle: 12,
      glow: 1,
    });
  }, { from: CHARGE_MS + 400, until: api.duration - 600 });
};
</script>

<template>
  <div class="energy-ring-effect">
    <svg class="energy-rings" viewBox="0 0 240 240" aria-hidden="true">
      <circle class="energy-ring outer" cx="120" cy="120" r="92" />
      <circle class="energy-ring middle" cx="120" cy="120" r="68" />
      <circle class="energy-ring inner" cx="120" cy="120" r="42" />
    </svg>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.energyRing" :scene="scene" />
    <div class="energy-core">
      <CircleDashed :size="54" />
      <strong>能量加载环</strong>
    </div>
  </div>
</template>

<style scoped>
.energy-ring-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.energy-ring-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 78vw);
  aspect-ratio: 1;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, rgba(96, 165, 250, 0.3), rgba(45, 212, 191, 0.18) 38%, transparent 68%);
  filter: blur(12px);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: energy-aura 4.8s ease both;
}

.energy-rings {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(420px, 72vw);
  transform: translate(-50%, -50%) rotate(-90deg);
  filter:
    drop-shadow(0 0 26px rgba(96, 165, 250, 0.52))
    drop-shadow(0 0 48px rgba(45, 212, 191, 0.22));
  animation: energy-stage 4.8s ease both;
}

.energy-ring {
  fill: none;
  stroke: rgba(147, 197, 253, 0.86);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 90 620;
  animation: energy-ring 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.energy-ring.middle {
  stroke: rgba(45, 212, 191, 0.86);
  animation-delay: 120ms;
  animation-direction: reverse;
}

.energy-ring.inner {
  stroke: rgba(244, 114, 182, 0.86);
  animation-delay: 220ms;
}

.energy-core {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #eff6ff;
  transform: translate(-50%, -50%);
  animation: energy-core 4.8s ease both;
}

.energy-core::before {
  content: '';
  position: absolute;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22), rgba(96, 165, 250, 0.2) 36%, transparent 68%);
  animation: energy-core-breath 1.3s ease-in-out infinite;
}

.energy-core svg,
.energy-core strong {
  position: relative;
  z-index: 1;
}

.energy-core strong {
  font-size: 16px;
}

@keyframes energy-aura {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.56); }
  16%, 82% { opacity: 1; }
  70% { transform: translate(-50%, -50%) scale(0.78); }
  84% { transform: translate(-50%, -50%) scale(1.18); }
}

@keyframes energy-stage {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotate(-90deg) scale(0.64); }
  14%, 84% { opacity: 1; transform: translate(-50%, -50%) rotate(-90deg) scale(1); }
  70% { transform: translate(-50%, -50%) rotate(-90deg) scale(0.78); }
}

@keyframes energy-ring {
  0% { stroke-dasharray: 60 620; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 220 620; }
  100% { stroke-dasharray: 60 620; stroke-dashoffset: -680; }
}

@keyframes energy-core {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.74); }
  16%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  72% { transform: translate(-50%, -50%) scale(0.9); }
  82% { transform: translate(-50%, -50%) scale(1.18); }
}

@keyframes energy-core-breath {
  0%, 100% { opacity: 0.48; transform: scale(0.9); }
  50% { opacity: 0.9; transform: scale(1.12); }
}
</style>
