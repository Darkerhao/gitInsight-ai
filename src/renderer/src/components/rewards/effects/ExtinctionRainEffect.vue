<script setup lang="ts">
import { Flame } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const FIRE = ['#fdba74', '#fb923c', '#f97316', '#fde68a', '#fff7ed'];
const ASH = ['#44403c', '#57534e', '#5b3a29'];
/** 陨石着弹节拍（轻重错落，末陨最重；phases: 800 / 5600 / 1000，总 7400ms）：[撞击时刻, 落点x比例, 量级] */
const DROPS: Array<[number, number, number]> = [
  [1350, 0.64, 0.7],
  [1900, 0.3, 1],
  [2320, 0.76, 0.55],
  [2540, 0.48, 0.85],
  [3050, 0.2, 1.2],
  [3520, 0.68, 0.55],
  [3760, 0.4, 0.9],
  [4300, 0.8, 1.25],
  [4780, 0.32, 0.6],
  [5000, 0.56, 0.8],
  [5380, 0.24, 0.65],
  [6000, 0.5, 1.6],
];
const FLIGHT = 460;

const scene: SceneFn = (api) => {
  api.setTrail(0.32);
  const groundY = api.height * 0.78;
  const state = { fire: 0, glow: 0 };

  // ── 幕一：首陨划破天幕（高空横掠，拖烟不着弹） ──
  api.at(240, () => {
    api.spawn({
      x: -60, y: api.height * 0.1, vx: 1380, vy: 300,
      shape: 'streak', stretch: 0.1, size: 4, maxLife: 0.8,
      color: '#fff7ed', glow: 1.6, fadeIn: 0.05, fadeOut: 0.1,
    });
  });
  for (let k = 0; k < 9; k += 1) {
    api.at(280 + k * 56, () => {
      const tt = (280 + k * 56 - 240) / 1000;
      api.spawn({
        x: -60 + 1380 * tt + api.range(-8, 8), y: api.height * 0.1 + 300 * tt + api.range(-6, 6),
        vx: api.range(-12, 12), vy: -api.range(4, 18),
        shape: 'dot', size: api.range(2, 4), endSize: api.range(9, 15), maxLife: api.range(0.9, 1.4),
        color: api.pick(ASH), composite: 'source-over', glow: 0,
        opacity: api.range(0.25, 0.42), wander: 22, fadeIn: 0.1, fadeOut: 0.45,
      });
    });
  }

  // 远天持续掠过的小流星（不着弹的背景雨）
  api.every(150, () => {
    const x0 = api.range(0.15, 1.15) * api.width;
    api.spawn({
      x: x0, y: -20, vx: -api.range(220, 330), vy: api.range(430, 560),
      shape: 'streak', stretch: 0.08, size: api.range(1, 1.7), maxLife: api.range(0.4, 0.6),
      color: api.rng() > 0.6 ? '#fca5a5' : '#fdba74', glow: 0.9, opacity: 0.6, fadeOut: 0.3,
    });
  }, { from: 600, until: 6200 });

  // ── 幕二：陨石梯次贯落 ──
  const impact = (x: number, scale: number) => {
    api.spawn({ x, y: groundY - 6, shape: 'dot', size: 10 + scale * 8, endSize: 150 + scale * 240, maxLife: 0.42, color: '#fff7ed', glow: 2.2, fadeOut: 0.88 });
    api.burst({
      x, y: groundY, count: Math.round(24 + scale * 28), speed: [130, 300 + scale * 190],
      angle: [Math.PI, Math.PI * 2],
      base: { shape: 'spark', size: 2 + scale, glow: 1.15, ay: 300, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = FIRE[Math.floor(rng() * FIRE.length)];
        p.maxLife = 0.5 + rng() * 0.8;
        if (rng() > 0.7) {
          p.shape = 'streak';
          p.stretch = 0.06;
        }
      },
    });
    api.spawn({ x, y: groundY, shape: 'ring', size: 20, endSize: 190 + scale * 260, maxLife: 0.7, color: '#fdba74', opacity: 0.8, fadeOut: 0.7 });
    // 尘暴上涌
    const dustN = Math.round(7 + scale * 6);
    for (let i = 0; i < dustN; i += 1) {
      api.spawn({
        x: x + api.range(-44, 44) * scale, y: groundY + api.range(-4, 8),
        vx: api.range(-42, 42), vy: -api.range(30, 90) * (0.6 + scale * 0.5),
        shape: 'dot', size: api.range(4, 9), endSize: api.range(14, 26), maxLife: api.range(1.1, 1.9),
        color: api.pick(ASH), composite: 'source-over', glow: 0,
        opacity: api.range(0.24, 0.42), drag: 0.6, wander: 26, fadeIn: 0.12, fadeOut: 0.45,
      });
    }
    state.fire = Math.min(6, state.fire + scale);
  };

  DROPS.forEach(([hitAt, xf, scale]) => {
    const ix = (xf + api.range(-0.03, 0.03)) * api.width;
    const startX = ix + api.height * 0.4;
    const startY = -40;
    const dur = FLIGHT / 1000;
    const vx = (ix - startX) / dur;
    const vy = (groundY - startY) / dur;
    // 进场拖尾（主体 + 伴飞碎屑）
    api.at(hitAt - FLIGHT, () => {
      api.spawn({
        x: startX, y: startY, vx, vy,
        shape: 'streak', stretch: 0.085, size: 2.4 + scale * 2.2, maxLife: dur,
        color: '#fff7ed', glow: 1.5, fadeIn: 0.06, fadeOut: 0.02,
      });
      for (let i = 0; i < 2; i += 1) {
        api.spawn({
          x: startX + api.range(-18, 18), y: startY + api.range(-14, 4),
          vx: vx * api.range(0.94, 1.02), vy: vy * api.range(0.94, 1.02),
          shape: 'streak', stretch: 0.06, size: api.range(1, 1.8) * scale + 0.6, maxLife: dur,
          color: api.pick(['#fdba74', '#fca5a5']), glow: 1, opacity: 0.7, fadeOut: 0.05,
        });
      }
    });
    // 沿途拖烟
    for (let k = 1; k <= 7; k += 1) {
      api.at(hitAt - FLIGHT + k * 56, () => {
        const tt = (k * 56) / 1000;
        api.spawn({
          x: startX + vx * tt + api.range(-6, 6), y: startY + vy * tt + api.range(-6, 6),
          vx: api.range(-10, 10), vy: -api.range(2, 14),
          shape: 'dot', size: api.range(2, 4) * (0.7 + scale * 0.4), endSize: api.range(8, 14),
          maxLife: api.range(0.8, 1.3), color: api.pick(ASH), composite: 'source-over', glow: 0,
          opacity: api.range(0.2, 0.36), wander: 20, fadeIn: 0.1, fadeOut: 0.45,
        });
      });
    }
    // 着弹：白闪 + 半圆火幕 + 冲击环 + 尘暴
    api.at(hitAt, () => impact(ix, scale));
  });

  // 末陨最大一击的额外排场：全屏暖闪 + 双重巨环 + 尘墙
  api.at(6000, () => {
    api.spawn({ x: api.width / 2, y: groundY, shape: 'dot', size: 30, endSize: Math.max(api.width, api.height) * 1.1, maxLife: 0.8, color: '#ffedd5', glow: 2.3, fadeOut: 0.94 });
  });
  [90, 260].forEach((delay, i) => {
    api.at(6000 + delay, () => {
      api.spawn({
        x: api.width / 2, y: groundY, shape: 'ring', size: 40,
        endSize: Math.max(api.width, api.height) * (0.55 + i * 0.3),
        maxLife: 1, color: i === 0 ? '#fff7ed' : '#fb923c', opacity: 0.8, fadeOut: 0.75,
      });
    });
  });

  // 地表火线蔓延（onFrame 画地平线火光，强度随着弹次数增长）
  const segs: Array<{ ph: number; sp: number; amp: number }> = [];
  const SEG_N = 36;
  for (let i = 0; i < SEG_N; i += 1) {
    segs.push({ ph: api.range(0, Math.PI * 2), sp: api.range(5, 11), amp: api.range(0.4, 1) });
  }
  api.onFrame((tMs, dt, ctx) => {
    const level = Math.min(1, state.fire / 4);
    state.glow += (level - state.glow) * Math.min(1, dt * 2.2);
    const fade = Math.min(1, Math.max(0, (7400 - tMs) / 800));
    const g0 = state.glow * fade;
    if (g0 <= 0.02) return;
    // 地平线基底辉光
    const grad = ctx.createLinearGradient(0, groundY - 64, 0, groundY + 4);
    grad.addColorStop(0, 'rgba(249, 115, 22, 0)');
    grad.addColorStop(1, `rgba(249, 115, 22, ${0.3 * g0})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY - 64, api.width, 68);
    // 分段火舌
    const segW = api.width / SEG_N;
    for (let i = 0; i < SEG_N; i += 1) {
      const s = segs[i];
      const flick = 0.55 + 0.45 * Math.sin((tMs / 1000) * s.sp + s.ph);
      const h = (7 + s.amp * 27) * flick * g0;
      ctx.fillStyle = `rgba(251, 146, 60, ${0.22 * g0 * flick})`;
      ctx.fillRect(i * segW + segW * 0.15, groundY - h, segW * 0.7, h + 3);
    }
  });

  // 火线上升的余火飘屑
  api.every(90, () => {
    if (state.fire < 0.5) return;
    api.spawn({
      x: api.rng() * api.width, y: groundY + api.range(-4, 2),
      vx: api.range(10, 50), vy: -api.range(40, 120),
      shape: 'spark', size: api.range(1, 2), maxLife: api.range(0.8, 1.4),
      color: api.pick(FIRE), glow: 1, drag: 0.7, wander: 30, twinkle: api.range(0, 2), fadeOut: 0.5,
    });
  }, { from: 2400, until: 6300 });

  // ── 幕三：余烬横飘定格 EXTINCTION EVENT ──
  api.every(64, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.range(groundY - 180, groundY),
      vx: api.range(40, 110), vy: api.range(-24, -6),
      shape: 'spark', size: api.range(1, 2), maxLife: api.range(0.7, 1.2),
      color: api.pick(['#fdba74', '#fca5a5', '#fde68a']), glow: 1,
      twinkle: 2.5, drag: 0.85, wander: 18, fadeOut: 0.5,
    });
  }, { from: 6300, until: 7150 });
  api.every(140, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.range(groundY - 240, groundY - 20),
      vx: api.range(24, 70), vy: api.range(-14, 0),
      shape: 'dot', size: api.range(2, 5), maxLife: api.range(0.8, 1.3),
      color: api.pick(ASH), composite: 'source-over', glow: 0,
      opacity: api.range(0.18, 0.32), wander: 16, fadeOut: 0.5,
    });
  }, { from: 6300, until: 7050 });
};
</script>

<template>
  <div class="extinction-rain-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.extinctionRain" :scene="scene" />
    <div class="er-alarm" />
    <div class="er-haze" />
    <div class="er-ground" />
    <div class="er-badge">
      <Flame :size="38" />
      <strong>灭世陨雨 · 天幕焚尽</strong>
      <small>EXTINCTION EVENT // IMPACT WINTER</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.extinction-rain-effect {
  @include effect-stage(hidden);
}

.er-alarm {
  position: absolute;
  inset: -10% -40%;
  background: linear-gradient(100deg, transparent 34%, rgba(248, 113, 113, 0.3) 48%, rgba(220, 38, 38, 0.42) 50%, rgba(248, 113, 113, 0.3) 52%, transparent 66%);
  opacity: 0;
  animation: er-alarm 7.4s ease-in-out both;
  pointer-events: none;
}

.er-haze {
  position: absolute;
  inset: 0 0 40% 0;
  background: linear-gradient(180deg, rgba(127, 29, 29, 0.5), transparent 82%);
  opacity: 0;
  animation: er-haze 7.4s ease both;
  pointer-events: none;
}

.er-ground {
  position: absolute;
  inset: 76% 0 0 0;
  background: linear-gradient(180deg, rgba(12, 10, 9, 0.1), rgba(12, 10, 9, 0.86) 34%, #0c0a09 90%);
  opacity: 0;
  animation: er-ground 7.4s ease both;
  pointer-events: none;
}

.er-badge {
  position: absolute;
  left: 50%;
  bottom: 13%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #fed7aa;
  text-shadow: 0 0 20px rgba(249, 115, 22, 0.7);
  transform: translateX(-50%);
  animation: er-badge 7.4s ease both;
}

.er-badge strong {
  font-size: 16px;
  letter-spacing: 0.14em;
}

.er-badge small {
  color: rgba(254, 202, 202, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
}

@keyframes er-alarm {
  0% { opacity: 0; transform: translateX(-46%); }
  4% { opacity: 1; }
  8% { opacity: 0.35; transform: translateX(0%); }
  12% { opacity: 1; }
  16% { opacity: 0; transform: translateX(46%); }
  100% { opacity: 0; transform: translateX(46%); }
}

@keyframes er-haze {
  0%, 10% { opacity: 0; }
  40% { opacity: 0.42; }
  82% { opacity: 0.66; }
  100% { opacity: 0.2; }
}

@keyframes er-ground {
  0% { opacity: 0; }
  9%, 92% { opacity: 1; }
  100% { opacity: 0.55; }
}

@keyframes er-badge {
  0%, 85% { opacity: 0; transform: translateX(-50%) translateY(14px) scale(0.96); }
  90%, 100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
</style>
