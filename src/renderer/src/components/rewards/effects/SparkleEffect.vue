<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.14); // 长拖尾成就"流光"质感

  // 三条金色光河：正弦轨迹横穿屏幕
  const rivers = [0.3, 0.52, 0.72].map((band) => ({
    y: api.height * (band + api.range(-0.05, 0.05)),
    amp: api.range(50, 130),
    freq: api.range(0.005, 0.009),
    phase: api.range(0, Math.PI * 2),
    speed: api.range(430, 720),
  }));

  api.every(26, () => {
    const river = api.pick(rivers);
    const warm = api.range(38, 52);
    api.spawn({
      x: -24,
      y: river.y,
      vx: river.speed * api.range(0.82, 1.15),
      shape: 'streak',
      stretch: 0.075,
      size: api.range(1.6, 3),
      maxLife: (api.width + 60) / river.speed,
      color: `hsl(${Math.round(warm)}, ${api.rng() < 0.3 ? 40 : 96}%, ${Math.round(api.range(62, 82))}%)`,
      glow: 1.1,
      fadeIn: 0.06,
      fadeOut: 0.1,
      update: (p) => {
        p.vy = Math.sin(p.x * river.freq + river.phase) * river.amp;
      },
    });
  }, { until: 3100 });

  // 漂浮金尘
  api.every(70, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.range(0, api.height),
      vx: api.range(-14, 14),
      vy: api.range(-30, -8),
      shape: 'dot',
      size: api.range(0.9, 2),
      maxLife: api.range(1.2, 2.4),
      color: '#fcd34d',
      twinkle: api.range(3, 8),
      glow: 1,
      wander: 30,
    });
  }, { until: 3200 });

  // 四芒星大闪点
  api.every(340, () => {
    api.spawn({
      x: api.range(api.width * 0.12, api.width * 0.88),
      y: api.range(api.height * 0.12, api.height * 0.82),
      shape: 'glyph',
      glyph: '✦',
      size: api.range(18, 42),
      endSize: 6,
      maxLife: api.range(0.7, 1.1),
      color: api.rng() < 0.5 ? '#fde68a' : '#fffbeb',
      spin: api.range(-1.4, 1.4),
      fadeIn: 0.22,
      fadeOut: 0.4,
      glow: 0,
    });
  }, { from: 260, until: 3100 });

  // 开场：中心涌出的金色环与光尘爆发
  api.at(140, () => {
    const cx = api.width / 2;
    const cy = api.height / 2;
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 40, endSize: 260, maxLife: 1, color: '#fbbf24', opacity: 0.9 });
    api.burst({
      x: cx,
      y: cy,
      count: 70,
      speed: [60, 340],
      base: { shape: 'spark', size: 1.8, drag: 0.3, color: '#fcd34d', twinkle: 6, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 0.9 + rng() * 1;
        if (rng() < 0.3) p.color = '#fffbeb';
      },
    });
  });
};
</script>

<template>
  <div class="sparkle-effect">
    <span class="sparkle-sash sash-one" />
    <span class="sparkle-sash sash-two" />
    <span class="sparkle-sash sash-three" />
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.sparkle" :scene="scene" />
    <div class="sparkle-medallion">
      <Sparkles :size="44" />
    </div>
  </div>
</template>

<style scoped>
.sparkle-effect {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, transparent 0 34%, rgba(255, 255, 255, 0.22) 45%, transparent 56%),
    linear-gradient(120deg, transparent 18%, rgba(251, 191, 36, 0.2) 48%, transparent 78%);
  animation: sparkle-sweep 3.6s ease both;
}

.sparkle-sash {
  position: absolute;
  left: -18%;
  right: -18%;
  height: 18vh;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.34), rgba(255, 255, 255, 0.38), transparent);
  filter: blur(10px);
  transform: rotate(-12deg) translateX(-28%);
  opacity: 0;
  animation: sparkle-sash 3.6s ease both;
}

.sash-one {
  top: 18%;
}

.sash-two {
  top: 42%;
  animation-delay: 160ms;
}

.sash-three {
  top: 66%;
  animation-delay: 320ms;
}

.sparkle-medallion {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 88px;
  height: 88px;
  border: 1px solid rgba(251, 191, 36, 0.34);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  color: #d97706;
  display: grid;
  place-items: center;
  box-shadow:
    0 0 0 14px rgba(251, 191, 36, 0.08),
    0 24px 62px rgba(217, 119, 6, 0.18);
  animation: reward-medallion 3.6s ease both;
}

:root[data-theme='dark'] .sparkle-medallion {
  border-color: rgba(122, 162, 255, 0.24);
  background: rgba(22, 29, 41, 0.9);
  color: var(--c-text);
}

@keyframes sparkle-sweep {
  0% {
    opacity: 0;
    transform: translateX(-18%);
  }
  16%,
  78% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(18%);
  }
}

@keyframes sparkle-sash {
  0% {
    opacity: 0;
    transform: rotate(-12deg) translateX(-28%);
  }
  24%,
  76% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(-12deg) translateX(28%);
  }
}

@keyframes reward-medallion {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.78) rotate(-12deg);
  }
  18%,
  76% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9) rotate(8deg);
  }
}
</style>
