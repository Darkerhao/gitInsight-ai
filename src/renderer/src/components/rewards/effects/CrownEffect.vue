<script setup lang="ts">
import { Crown } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 旋转的金色神辉光束（自定义绘制）
  const rayCount = 10;
  const rayPhases = Array.from({ length: rayCount }, () => api.range(0, Math.PI * 2));
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.9) * Math.min(1, Math.max(0, (4.8 - t) / 0.9));
    if (envelope <= 0) return;
    ctx.translate(cx, cy);
    for (let i = 0; i < rayCount; i += 1) {
      const angle = (i / rayCount) * Math.PI * 2 + t * 0.22 + rayPhases[i] * 0.08;
      const flicker = 0.6 + 0.4 * Math.sin(t * 2.4 + rayPhases[i]);
      const length = Math.max(api.width, api.height) * 0.72;
      const halfWidth = 0.055 + 0.02 * Math.sin(t * 1.6 + rayPhases[i]);
      const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
      gradient.addColorStop(0, `rgba(253, 230, 138, ${0.34 * envelope * flicker})`);
      gradient.addColorStop(1, 'rgba(253, 230, 138, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, length, angle - halfWidth, angle + halfWidth);
      ctx.closePath();
      ctx.fill();
    }
  });

  // 开场加冕爆发：金色火花 + 三重光环
  api.at(180, () => {
    api.burst({
      x: cx,
      y: cy,
      count: 130,
      speed: [60, 460],
      base: { shape: 'spark', size: 2, drag: 0.3, ay: 110, color: '#fcd34d', twinkle: 6, glow: 1.3 },
      vary: (p, rng) => {
        p.maxLife = 1 + rng() * 1.3;
        if (rng() < 0.3) p.color = '#fffbeb';
        if (rng() < 0.14) p.color = '#f59e0b';
      },
    });
    [0, 180, 380].forEach((delay, i) => {
      api.at(180 + delay, () => {
        api.spawn({ x: cx, y: cy, shape: 'ring', size: 60, endSize: 300 + i * 120, maxLife: 1.1, color: '#fde68a', opacity: 0.85 });
      });
    });
  });

  // 底部升腾的金色余烬
  api.every(46, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.height + 8,
      vx: api.range(-20, 20),
      vy: api.range(-170, -60),
      drag: 0.7,
      shape: 'spark',
      size: api.range(1.2, 2.6),
      maxLife: api.range(1.8, 3),
      color: api.rng() < 0.25 ? '#fffbeb' : '#fbbf24',
      twinkle: api.range(3, 7),
      wander: 46,
      glow: 1.1,
    });
  }, { until: 3900 });

  // 环绕的宝石菱形闪光
  api.every(300, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(150, Math.min(api.width, api.height) * 0.44);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.8,
      shape: 'glyph',
      glyph: '◆',
      size: api.range(10, 22),
      endSize: 4,
      maxLife: api.range(0.8, 1.2),
      color: api.rng() < 0.5 ? '#fde68a' : '#fef3c7',
      spin: api.range(-2, 2),
      fadeIn: 0.25,
      fadeOut: 0.4,
    });
  }, { from: 500, until: 3900 });

  // 终章金雨
  api.at(3300, () => {
    api.burst({
      x: cx,
      y: cy - api.height * 0.2,
      count: 80,
      speed: [120, 380],
      angle: [Math.PI * 0.15, Math.PI * 0.85],
      base: { shape: 'spark', size: 1.8, ay: 240, drag: 0.5, color: '#fcd34d', twinkle: 8, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 1 + rng() * 0.9;
      },
    });
  });
};
</script>

<template>
  <div class="crown-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.crown" :scene="scene" />
    <div class="crown-emblem">
      <Crown :size="58" />
      <strong>荣耀加冕</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crown-effect {
  @include effect-stage(hidden);
}

.crown-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 76vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(254, 240, 138, 0.38), rgba(250, 204, 21, 0.18) 34%, transparent 70%);
  filter: blur(10px);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.62);
  animation: crown-aura 4.8s ease both;
}

.crown-emblem {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 198px;
  height: 198px;
  border: 1px solid rgba(250, 204, 21, 0.56);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 32%, rgba(255, 255, 255, 0.98), rgba(254, 243, 199, 0.9) 42%, rgba(202, 138, 4, 0.2) 100%),
    linear-gradient(135deg, rgba(250, 204, 21, 0.28), transparent);
  color: #854d0e;
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  padding: 0;
  box-shadow:
    0 34px 90px rgba(66, 32, 6, 0.28),
    0 0 70px rgba(250, 204, 21, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden;
  transform: translate(-50%, -50%);
  animation: crown-emblem 4.8s ease both;
}

.crown-emblem::before {
  content: '';
  position: absolute;
  inset: -18px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(250, 204, 21, 0.76), rgba(255, 255, 255, 0.74), transparent 42%);
  opacity: 0.72;
  animation: crown-rotate 2.8s linear infinite;
}

.crown-emblem::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 0 38%, rgba(255, 255, 255, 0.72) 47%, transparent 57%);
  transform: translateX(-120%);
  animation: crown-shine 2.1s ease-in-out 560ms both;
}

.crown-emblem svg {
  position: relative;
  z-index: 1;
  color: #ca8a04;
  filter: drop-shadow(0 12px 24px rgba(202, 138, 4, 0.34));
}

.crown-emblem strong {
  position: relative;
  z-index: 1;
  font-size: 18px;
}

:root[data-theme='dark'] .crown-emblem {
  border-color: rgba(250, 204, 21, 0.42);
  background:
    radial-gradient(circle at 50% 30%, rgba(250, 204, 21, 0.28), rgba(22, 29, 41, 0.92) 58%),
    rgba(22, 29, 41, 0.9);
  color: #fde68a;
}

@keyframes crown-aura {
  0%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.62);
  }
  20%,
  80% {
    opacity: 1;
  }
  54% {
    transform: translate(-50%, -50%) scale(1.12);
  }
}

@keyframes crown-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes crown-shine {
  to {
    transform: translateX(120%);
  }
}

@keyframes crown-emblem {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.88);
  }
  18%,
  76% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}
</style>
