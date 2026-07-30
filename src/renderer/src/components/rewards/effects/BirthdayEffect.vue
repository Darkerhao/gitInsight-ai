<script setup lang="ts">
import { Cake } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneApi, SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/** 克制配色：粉主色 + 金辅色 + 白热高光 + 一点冰蓝点缀，拒绝廉价彩虹 */
const NEAR_CONFETTI = ['#f9a8d4', '#ec4899', '#fbbf24', '#fde68a', '#f8fafc', '#93c5fd'];
const FAR_CONFETTI = ['#f472b6', '#fbbf24', '#e0e7ff'];

/** 舷侧礼炮：白热炮口闪 + 近/远两层彩屑（近大远小）+ 少量长绶带 */
function cannon(api: SceneApi, fromLeft: boolean, power: number) {
  const x = fromLeft ? -12 : api.width + 12;
  const y = api.height * 0.9;
  const baseAngle = fromLeft ? -Math.PI / 3.1 : Math.PI + Math.PI / 3.1;
  api.spawn({ x, y, shape: 'dot', size: 30, endSize: 5, maxLife: 0.26, color: '#fff7ed', glow: 2.2, fadeOut: 0.7 });
  api.spawn({ x, y, shape: 'dot', size: 16, endSize: 62, maxLife: 0.5, color: '#fbbf24', glow: 1.2, opacity: 0.4, fadeOut: 0.8 });
  api.burst({
    x, y, count: Math.round(52 * power), speed: [430, 940 * power],
    angle: [baseAngle - 0.22, baseAngle + 0.22],
    base: { shape: 'rect', composite: 'source-over', ay: 430, drag: 0.26, glow: 0, fadeIn: 0, fadeOut: 0.2 },
    vary: (p, rng) => {
      p.color = NEAR_CONFETTI[Math.floor(rng() * NEAR_CONFETTI.length)];
      p.size = 6 + rng() * 6.5;
      p.maxLife = 2.3 + rng() * 1.3;
      p.rotation = rng() * Math.PI;
      p.spin = (rng() - 0.5) * 15;
      p.flutter = 1.6 + rng() * 2.8;
      p.wander = 64;
    },
  });
  api.burst({
    x, y, count: Math.round(24 * power), speed: [240, 520],
    angle: [baseAngle - 0.3, baseAngle + 0.3],
    base: { shape: 'rect', composite: 'source-over', ay: 250, drag: 0.3, glow: 0, opacity: 0.42, fadeOut: 0.3 },
    vary: (p, rng) => {
      p.color = FAR_CONFETTI[Math.floor(rng() * FAR_CONFETTI.length)];
      p.size = 2.6 + rng() * 2.6;
      p.maxLife = 2.6 + rng() * 1.2;
      p.rotation = rng() * Math.PI;
      p.spin = (rng() - 0.5) * 9;
      p.flutter = 1.2 + rng() * 2;
      p.wander = 40;
    },
  });
  api.burst({
    x, y, count: 4, speed: [380, 720],
    angle: [baseAngle - 0.16, baseAngle + 0.16],
    base: { shape: 'streak', stretch: 0.1, size: 2.6, maxLife: 1.4, color: '#f9a8d4', glow: 0.9, ay: 240, drag: 0.4, wander: 120, fadeOut: 0.35 },
    vary: (p, rng) => {
      if (rng() > 0.5) p.color = '#fde68a';
    },
  });
}

/** 粉金星光爆点：白热闪心 + 扩散环 + 火花，部分火花坠灭时二次噼啪 */
function starPop(api: SceneApi, fx: number, fy: number, scale: number) {
  const x = api.width * fx;
  const y = api.height * fy;
  api.spawn({ x, y, shape: 'dot', size: 12 * scale, endSize: 2, maxLife: 0.32, color: '#ffffff', glow: 2, fadeOut: 0.7 });
  api.spawn({ x, y, shape: 'ring', size: 6, endSize: 96 * scale, maxLife: 0.7, color: '#f9a8d4', opacity: 0.75, fadeOut: 0.7 });
  api.burst({
    x, y, count: Math.round(22 * scale), speed: [50, 230 * scale],
    base: { shape: 'spark', size: 2, ay: 120, drag: 0.4, color: '#f9a8d4', twinkle: 5, glow: 1.15, fadeOut: 0.4 },
    vary: (p, rng) => {
      p.maxLife = 0.8 + rng() * 0.7;
      if (rng() < 0.4) p.color = '#fde68a';
      if (rng() < 0.16) {
        p.color = '#ffffff';
        p.onDeath = (dp, a) => {
          a.burst({
            x: dp.x, y: dp.y, count: 5, speed: [30, 110],
            base: { shape: 'spark', size: 1.3, maxLife: 0.4, color: '#fde68a', glow: 1, ay: 90, fadeOut: 0.6 },
          });
        };
      }
    },
  });
}

const scene: SceneFn = (api) => {
  api.setTrail(0.55);
  const W = api.width;
  const H = api.height;
  const D = api.duration / 1000; // 4.6s

  // 远景光斑（bokeh 底层，整场极缓漂移 → 舞台纵深）
  for (let i = 0; i < 18; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * H * 0.8,
      vx: api.range(-5, 5), vy: api.range(-6, 6),
      shape: 'dot', size: api.range(6, 14), maxLife: D,
      color: api.rng() > 0.5 ? '#f9a8d4' : '#fde68a',
      glow: 1.4, opacity: 0.14, twinkle: api.range(0.3, 0.9), fadeIn: 0.14, fadeOut: 0.16,
    });
  }

  // 首轮齐射：左右错拍 90ms，更有临场感
  api.at(140, () => cannon(api, true, 1.05));
  api.at(230, () => cannon(api, false, 1.05));
  // 第二轮交替
  api.at(1250, () => cannon(api, true, 0.85));
  api.at(1480, () => cannon(api, false, 0.85));
  // 终场双响
  api.at(2650, () => {
    cannon(api, true, 1);
    cannon(api, false, 1);
  });

  // 星光爆点：对角呼应的精确踩点
  api.at(680, () => starPop(api, 0.36, 0.3, 1));
  api.at(1060, () => starPop(api, 0.66, 0.24, 0.85));
  api.at(1780, () => starPop(api, 0.3, 0.4, 0.9));
  api.at(2200, () => starPop(api, 0.7, 0.36, 1));
  api.at(3050, () => starPop(api, 0.5, 0.26, 1.15));

  // 顶部持续飘落的细彩屑（近景层）
  api.every(85, () => {
    api.spawn({
      x: api.range(0, W), y: -12,
      vx: api.range(-30, 30), vy: api.range(90, 190), ay: 60,
      shape: 'rect', composite: 'source-over',
      color: api.pick(NEAR_CONFETTI), size: api.range(4, 8),
      maxLife: api.range(2.2, 3.4), rotation: api.range(0, Math.PI),
      spin: api.range(-8, 8), flutter: api.range(1.4, 3.4), wander: 70, glow: 0, fadeOut: 0.16,
    });
  }, { until: 3450 });

  // 终场之后：金雨自顶心洒落
  api.every(30, () => {
    api.spawn({
      x: W * 0.5 + api.range(-W * 0.3, W * 0.3), y: -8,
      vx: api.range(-40, 40), vy: api.range(180, 320),
      shape: 'spark', size: api.range(1.2, 2), maxLife: api.range(1, 1.8),
      color: api.pick(['#fde68a', '#fbbf24', '#fff7ed']), glow: 1.1, twinkle: 4, fadeOut: 0.35,
    });
  }, { from: 2750, until: 3600 });

  // 余韵：残余金尘缓浮，彩屑落定
  api.every(150, () => {
    api.spawn({
      x: api.rng() * W, y: H * api.range(0.4, 0.85),
      vy: -api.range(8, 26), shape: 'dot', size: api.range(0.9, 1.8),
      maxLife: api.range(0.6, 1), color: '#fde68a', glow: 1, wander: 30, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: 3600, until: 4200 });
};
</script>

<template>
  <div class="birthday-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.birthday" :scene="scene" />
    <div class="birthday-card-effect">
      <span class="birthday-card-glow" />
      <small class="birthday-card-code">STELLAR GALA // CYCLE +1</small>
      <Cake :size="46" />
      <strong>生日快乐</strong>
      <small class="birthday-card-sub">星诞庆典 · HAPPY BIRTHDAY</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.birthday-effect {
  @include effect-stage(hidden);
  display: grid;
  place-items: center;
}

.birthday-card-effect {
  position: relative;
  min-width: min(360px, calc(100vw - 42px));
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(255, 245, 252, 0.9)),
    linear-gradient(90deg, rgba(236, 72, 153, 0.2), transparent);
  color: #1f2937;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 34px;
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
  background: conic-gradient(from 120deg, transparent, rgba(236, 72, 153, 0.22), rgba(251, 191, 36, 0.16), transparent);
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
  letter-spacing: 0.08em;
}

.birthday-card-code {
  color: #db2777;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3em;
  opacity: 0.72;
}

.birthday-card-sub {
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.12em;
}

:root[data-theme='dark'] .birthday-card-effect {
  border-color: rgba(122, 162, 255, 0.24);
  background: rgba(22, 29, 41, 0.9);
  color: var(--c-text);
}

:root[data-theme='dark'] .birthday-card-sub {
  color: var(--c-text-muted);
}

@keyframes birthday-card-pop {
  0%, 9% {
    opacity: 0;
    transform: translateY(28px) scale(0.9);
  }
  16% {
    opacity: 1;
    transform: translateY(-4px) scale(1.02);
  }
  22%, 80% {
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
