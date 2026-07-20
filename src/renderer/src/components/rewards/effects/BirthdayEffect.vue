<script setup lang="ts">
import { Cake } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneApi, SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const CONFETTI_COLORS = ['#3b6cf6', '#16a34a', '#f59e0b', '#ef4444', '#ec4899', '#22c55e', '#8b5cf6', '#fbbf24'];

function cannon(api: SceneApi, fromLeft: boolean, power: number) {
  const x = fromLeft ? -10 : api.width + 10;
  const y = api.height * 0.92;
  const baseAngle = fromLeft ? -Math.PI / 3.2 : Math.PI + Math.PI / 3.2;
  api.burst({
    x,
    y,
    count: Math.round(70 * power),
    speed: [420, 980 * power],
    angle: [baseAngle - 0.24, baseAngle + 0.24],
    base: {
      shape: 'rect',
      composite: 'source-over',
      ay: 420,
      drag: 0.24,
      glow: 0,
      fadeIn: 0,
      fadeOut: 0.22,
    },
    vary: (p, rng) => {
      p.color = CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)];
      p.size = 6 + rng() * 7;
      p.maxLife = 2.4 + rng() * 1.4;
      p.rotation = rng() * Math.PI;
      p.spin = (rng() - 0.5) * 14;
      p.flutter = 1.6 + rng() * 2.6;
      p.wander = 60;
    },
  });
  // 炮口金色闪光
  api.spawn({ x, y, shape: 'dot', size: 26, endSize: 4, maxLife: 0.3, color: '#fde68a', glow: 2 });
}

function starPop(api: SceneApi) {
  const x = api.width * api.range(0.3, 0.7);
  const y = api.height * api.range(0.2, 0.45);
  api.spawn({ x, y, shape: 'ring', size: 4, endSize: 90, maxLife: 0.7, color: '#f9a8d4', opacity: 0.8 });
  api.burst({
    x,
    y,
    count: 26,
    speed: [40, 220],
    base: { shape: 'spark', size: 2, ay: 130, drag: 0.4, color: '#f9a8d4', twinkle: 6, glow: 1.2 },
    vary: (p, rng) => {
      p.maxLife = 0.9 + rng() * 0.8;
      if (rng() < 0.4) p.color = '#fde68a';
    },
  });
}

const scene: SceneFn = (api) => {
  api.setTrail(0.55); // 轻微拖尾，让纸屑更顺滑

  // 三轮左右交替礼炮
  api.at(120, () => {
    cannon(api, true, 1.05);
    cannon(api, false, 1.05);
  });
  api.at(1250, () => cannon(api, true, 0.85));
  api.at(1500, () => cannon(api, false, 0.85));
  api.at(2650, () => {
    cannon(api, true, 0.95);
    cannon(api, false, 0.95);
  });

  // 中场粉金星光爆点
  api.every(520, () => starPop(api), { from: 500, until: 3300 });

  // 顶部持续飘落细碎彩屑
  api.every(70, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: -12,
      vx: api.range(-30, 30),
      vy: api.range(90, 190),
      ay: 60,
      shape: 'rect',
      composite: 'source-over',
      color: api.pick(CONFETTI_COLORS),
      size: api.range(4, 8),
      maxLife: api.range(2.2, 3.4),
      rotation: api.range(0, Math.PI),
      spin: api.range(-8, 8),
      flutter: api.range(1.4, 3.4),
      wander: 70,
      glow: 0,
      fadeOut: 0.16,
    });
  }, { until: 3400 });
};
</script>

<template>
  <div class="birthday-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.birthday" :scene="scene" />
    <div class="birthday-card-effect">
      <span class="birthday-card-glow" />
      <Cake :size="52" />
      <strong>生日快乐</strong>
      <small>Happy Birthday</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.birthday-effect {
  @include effect-stage;
  display: grid;
  place-items: center;
}

.birthday-card-effect {
  position: relative;
  min-width: min(360px, calc(100vw - 42px));
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(255, 245, 252, 0.9)),
    linear-gradient(90deg, rgba(236, 72, 153, 0.2), transparent);
  color: #1f2937;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 34px;
  text-align: center;
  box-shadow:
    0 30px 80px rgba(31, 41, 55, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  overflow: hidden;
  animation: birthday-card-pop 4.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.birthday-card-glow {
  position: absolute;
  inset: -40% -20%;
  background: conic-gradient(from 120deg, transparent, rgba(236, 72, 153, 0.24), rgba(59, 108, 246, 0.18), transparent);
  opacity: 0.76;
  animation: birthday-card-glow 4.6s linear both;
}

.birthday-card-effect svg,
.birthday-card-effect strong,
.birthday-card-effect small {
  position: relative;
}

.birthday-card-effect svg {
  color: #ec4899;
  filter: drop-shadow(0 10px 20px rgba(236, 72, 153, 0.28));
}

.birthday-card-effect strong {
  font-size: 34px;
  line-height: 1.1;
}

.birthday-card-effect small {
  color: #64748b;
  font-size: 14px;
}

:root[data-theme='dark'] .birthday-card-effect {
  border-color: rgba(122, 162, 255, 0.24);
  background: rgba(22, 29, 41, 0.9);
  color: var(--c-text);
}

:root[data-theme='dark'] .birthday-card-effect small {
  color: var(--c-text-muted);
}

@keyframes birthday-card-pop {
  0% {
    opacity: 0;
    transform: translateY(28px) scale(0.9);
  }
  14%,
  78% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-18px) scale(0.98);
  }
}

@keyframes birthday-card-glow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(260deg);
  }
}
</style>
