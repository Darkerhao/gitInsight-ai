<script setup lang="ts">
import { PartyPopper } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneApi, SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const HUES = [38, 328, 205, 168, 268, 12, 52];

function explode(api: SceneApi, x: number, y: number, hue: number, scale: number) {
  const color = `hsl(${Math.round(hue)}, 100%, 66%)`;
  const hot = `hsl(${Math.round(hue)}, 100%, 82%)`;

  // 白热闪光核心 + 冲击环
  api.spawn({ x, y, shape: 'dot', size: 30 * scale, endSize: 2, maxLife: 0.34, color: '#ffffff', glow: 2.2, fadeOut: 0.9 });
  api.spawn({ x, y, shape: 'ring', size: 8, endSize: 190 * scale, maxLife: 0.85, color, fadeOut: 0.85, opacity: 0.85 });

  // 主爆裂：带重力与空气阻力的火花球
  api.burst({
    x,
    y,
    count: Math.round(150 * scale),
    speed: [30, 430 * scale],
    base: {
      shape: 'spark',
      size: api.range(1.7, 2.5),
      ay: 210,
      drag: 0.3,
      color,
      twinkle: 7,
      glow: 1.15,
      fadeOut: 0.55,
    },
    vary: (p, rng) => {
      p.maxLife = 1.2 + rng() * 1.2;
      if (rng() < 0.24) p.color = hot;
      if (rng() < 0.1) p.color = '#fff7e6';
    },
  });

  // 慢速余烬：少量长寿命金色余星，坠落时二次噼啪
  api.burst({
    x,
    y,
    count: Math.round(16 * scale),
    speed: [40, 190 * scale],
    base: { shape: 'spark', size: 2.6, ay: 150, drag: 0.42, color: hot, twinkle: 3.5, glow: 1.4, fadeOut: 0.3 },
    vary: (p, rng) => {
      p.maxLife = 1.6 + rng() * 0.9;
      p.onDeath = (dead, sceneApi) => {
        sceneApi.burst({
          x: dead.x,
          y: dead.y,
          count: 5,
          speed: [10, 80],
          base: { shape: 'spark', size: 1.4, maxLife: 0.5, ay: 120, color: '#ffe9a8', glow: 1, twinkle: 10 },
        });
      };
    },
  });
}

function launchRocket(api: SceneApi, scale = 1) {
  const x = api.width * api.range(0.14, 0.86);
  const targetY = api.height * api.range(0.16, 0.44);
  const flight = api.range(0.7, 1.05);
  const hue = api.pick(HUES) + api.range(-12, 12);
  api.spawn({
    x,
    y: api.height + 16,
    vx: api.range(-36, 36),
    vy: -(api.height + 16 - targetY) / flight,
    shape: 'spark',
    size: 2.4,
    maxLife: flight,
    color: `hsl(${Math.round(hue)}, 90%, 78%)`,
    glow: 1.4,
    fadeIn: 0,
    fadeOut: 0.08,
    onDeath: (p, sceneApi) => explode(sceneApi, p.x, p.y, hue, scale),
  });
}

const scene: SceneFn = (api) => {
  api.setTrail(0.2); // 长拖尾：火箭轨迹与火花尾焰

  api.at(60, () => launchRocket(api, 1.05));
  api.at(340, () => launchRocket(api, 0.85));
  api.every(430, () => launchRocket(api, api.range(0.75, 1.1)), { from: 750, until: 2350 });
  // 终场齐射
  api.at(2600, () => {
    launchRocket(api, 1.2);
    launchRocket(api, 1);
    launchRocket(api, 0.9);
  });
};
</script>

<template>
  <div class="fireworks-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.fireworks" :scene="scene" />
    <div class="effect-signature">
      <PartyPopper :size="28" />
      <strong>臻彩烟花</strong>
    </div>
  </div>
</template>

<style scoped>
.fireworks-effect {
  position: absolute;
  inset: 0;
}

.effect-signature {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.46);
  color: #fff;
  padding: 10px 16px;
  transform: translateX(-50%);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
  animation: reward-label 4.2s ease both;
}

.effect-signature strong {
  font-size: 16px;
}

@keyframes reward-label {
  0% {
    opacity: 0;
    transform: translate(-50%, 16px) scale(0.94);
  }
  18%,
  78% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -10px) scale(0.98);
  }
}
</style>
