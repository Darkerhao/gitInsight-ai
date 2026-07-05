<script setup lang="ts">
import { Star } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const WAVE_COLORS: string[][] = [
  ['#fde68a', '#f59e0b', '#fbbf24'],
  ['#67e8f9', '#22d3ee', '#a5f3fc'],
  ['#f0abfc', '#e879f9', '#f5d0fe'],
];

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 幕一：恒星呼吸膨胀（核心辉光 + 表面对流沸腾）
  api.spawn({
    x: cx, y: cy, shape: 'dot', size: 26, maxLife: 2.05,
    color: '#fcd34d', glow: 2, fadeIn: 0.12, fadeOut: 0.04,
    update: (p) => {
      p.size = 26 + Math.sin(p.life * 5.2) * 7 + p.life * 9;
      p.endSize = p.size;
    },
  });
  api.every(36, () => {
    const angle = api.range(0, Math.PI * 2);
    const r = 30 + api.range(0, 16);
    api.spawn({
      x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r,
      vx: Math.cos(angle) * api.range(18, 60), vy: Math.sin(angle) * api.range(18, 60),
      shape: 'spark', size: api.range(1.4, 2.8), maxLife: api.range(0.4, 0.8),
      color: api.pick(['#fde68a', '#fb923c', '#fff7ed']), glow: 1.2, drag: 0.4, fadeOut: 0.4,
    });
  }, { until: 1950 });

  // 幕二：坍缩 —— 300ms 内全场吸入 + 收缩环，静默一拍
  api.at(2050, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 130, endSize: 6, maxLife: 0.34,
      color: '#f8fafc', opacity: 0.9, fadeIn: 0.05, fadeOut: 0.3,
    });
  });
  api.every(14, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(120, Math.max(api.width, api.height) * 0.5);
    api.spawn({
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * radius * 3.1, vy: -Math.sin(angle) * radius * 3.1,
      shape: 'streak', stretch: 0.07, size: 1.8, maxLife: 0.32,
      color: '#e0f2fe', glow: 0.9, fadeIn: 0.1, fadeOut: 0.2,
    });
  }, { from: 2050, until: 2350 });

  // 幕三：三波次光谱爆发
  WAVE_COLORS.forEach((palette, wave) => {
    api.at(2550 + wave * 220, () => {
      if (wave === 0) {
        api.spawn({ x: cx, y: cy, shape: 'dot', size: 18, endSize: 380, maxLife: 0.72, color: '#fffbeb', glow: 2.4, fadeOut: 0.92 });
      }
      api.burst({
        x: cx, y: cy, count: 120 - wave * 15, speed: [140 + wave * 90, 460 + wave * 130],
        base: {
          shape: wave === 2 ? 'streak' : 'spark', stretch: 0.08,
          size: 2.6 - wave * 0.5, maxLife: 1.5, glow: 1.15,
          ay: 26, drag: 0.32, fadeOut: 0.45,
        },
        vary: (p, rng) => {
          p.color = palette[Math.floor(rng() * palette.length)];
          p.maxLife = 1 + rng() * 1.1;
          if (rng() > 0.82) p.twinkle = 3 + rng() * 4;
        },
      });
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 24,
        endSize: Math.max(api.width, api.height) * (0.4 + wave * 0.22),
        maxLife: 1, color: palette[0], opacity: 0.8, fadeOut: 0.7,
      });
    });
  });

  // 残骸凝成星云：低速漂移尘埃驻留
  api.at(3150, () => {
    for (let i = 0; i < 90; i += 1) {
      const angle = api.range(0, Math.PI * 2);
      const radius = api.range(40, 280);
      api.spawn({
        x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.8,
        vx: Math.cos(angle) * api.range(4, 18), vy: Math.sin(angle) * api.range(4, 18),
        shape: 'dot', size: api.range(0.8, 2.2), maxLife: api.range(1.6, 2.6),
        color: api.pick(['#fbbf24', '#67e8f9', '#f0abfc', '#e2e8f0']),
        glow: 0.9, wander: 26, twinkle: api.range(1, 3), fadeIn: 0.14, fadeOut: 0.4,
      });
    }
  });
};
</script>

<template>
  <div class="supernova-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.supernova" :scene="scene" />
    <div class="sn-badge">
      <Star :size="46" />
      <strong>超新星爆发</strong>
      <small>SN 2026-JX · TYPE II</small>
    </div>
  </div>
</template>

<style scoped>
.supernova-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: sn-camera 5.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sn-badge {
  position: absolute;
  left: 50%;
  bottom: 14%;
  color: #fef3c7;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(245, 158, 11, 0.65);
  transform: translateX(-50%);
  animation: sn-badge 5.8s ease both;
}

.sn-badge strong {
  font-size: 17px;
  letter-spacing: 0.12em;
}

.sn-badge small {
  color: rgba(254, 243, 199, 0.72);
  font-size: 11px;
  letter-spacing: 0.22em;
}

@keyframes sn-badge {
  0%, 46% { opacity: 0; transform: translateX(-50%) translateY(18px); }
  56%, 88% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

@keyframes sn-camera {
  0% { transform: scale(1.06); }
  30% { transform: scale(1); }
  35% { transform: scale(0.97); }
  43% { transform: scale(1.1); }
  52% { transform: scale(1.02); }
  100% { transform: scale(1.08); opacity: 0; }
}
</style>
