<script setup lang="ts">
import { Hourglass } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 纪元归零 · EPOCH ZERO（创世级 666）
 * 幕一 0-900ms    巨型沙漏显影翻转，金色时砂逆流上升
 * 幕二 900-6400ms 全场时间倒卷：星轨反向回绕、碎片逆飞聚合复原成完整星体、
 *                 刻度盘急速回拨，倒卷波每圈收缩留下残像
 * 幕三 6400-7500ms 全画面凝为一枚初始光种，轻轻落入黑暗 EPOCH 0
 */
const TAU = Math.PI * 2;
const SAND_COLORS = ['#fbbf24', '#fde68a', '#f59e0b'] as const;
const STAR_COLORS = ['#bfdbfe', '#93c5fd', '#e0f2fe'] as const;

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const W = api.width;
  const H = api.height;
  const minDim = Math.min(W, H);
  const cx = W / 2;
  const HX = cx;             // 沙漏中心（与 DOM 对位：left 50% / top 46%）
  const HY = H * 0.46;
  const OY = H * 0.48;       // 星轨中心
  const PX = W * 0.72;       // 复原星体位置
  const PY = H * 0.32;
  const RADII = [0.24, 0.34, 0.44].map((k) => minDim * k);

  // ---------- 远景星野 ----------
  for (let i = 0; i < 54; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * H,
      shape: 'dot', size: api.range(0.7, 1.7), maxLife: 7.3,
      color: api.rng() > 0.82 ? '#fbbf24' : '#dbeafe', glow: 0.7,
      opacity: api.range(0.25, 0.65), twinkle: api.range(0.4, 1.3), fadeIn: 0.05, fadeOut: 0.1,
    });
  }

  // ---------- 幕一：金砂逆流上升（自下腔收束穿颈升入上腔） ----------
  api.every(18, () => {
    const dy = api.range(16, 60);
    api.spawn({
      x: HX + api.range(-1, 1) * dy * 0.5, y: HY + dy,
      vy: -api.range(50, 96), ay: -70,
      shape: 'spark', size: api.range(1.2, 2.2), maxLife: 1.35,
      color: api.pick(SAND_COLORS), glow: 0.9, drag: 0.9, fadeIn: 0.1, fadeOut: 0.3,
      update: (p, dt) => {
        p.vx += (HX - p.x) * 9 * dt; // 向沙漏颈收束
        if (p.y < HY - 74) p.life = p.maxLife;
      },
    });
  }, { from: 220, until: 2650 });

  // ---------- 幕二：星轨反向回绕（环形轨道 + 反向亮弧） ----------
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 900 || tMs > 6400) return;
    const ramp = Math.min(1, (tMs - 900) / 500) * Math.min(1, Math.max(0, (6400 - tMs) / 400));
    ctx.translate(cx, OY);
    ctx.scale(1, 0.86);
    RADII.forEach((r, ring) => {
      ctx.strokeStyle = `rgba(147, 197, 253, ${0.08 * ramp})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      const a0 = (-tMs / 1000) * (1.1 + ring * 0.24) + ring * 2.1;
      ctx.strokeStyle = `rgba(191, 219, 254, ${0.26 * ramp})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a0 + 0.85);
      ctx.stroke();
    });
  });
  api.every(44, () => {
    const ring = Math.floor(api.range(0, 3));
    const R = RADII[ring];
    let ang = api.range(0, TAU);
    const omega = -(0.55 + ring * 0.16); // 反向回绕
    api.spawn({
      x: cx + Math.cos(ang) * R, y: OY + Math.sin(ang) * R * 0.86,
      shape: 'streak', stretch: 0.14, size: api.range(1.4, 2.2), maxLife: 1.8,
      color: api.rng() > 0.85 ? '#fbbf24' : api.pick(STAR_COLORS), glow: 1, fadeIn: 0.12, fadeOut: 0.25,
      update: (p, dt) => {
        ang += omega * dt;
        p.x = cx + Math.cos(ang) * R;
        p.y = OY + Math.sin(ang) * R * 0.86;
        p.vx = -Math.sin(ang) * R * omega;
        p.vy = Math.cos(ang) * R * omega * 0.86;
      },
    });
  }, { from: 950, until: 5850 });

  // ---------- 幕二：碎片逆飞聚合，复原成完整星体（burst 的逆过程） ----------
  const PR = minDim * 0.085;
  api.at(1100, () => {
    for (let i = 0; i < 84; i += 1) {
      const ta = api.range(0, TAU);
      const tr = PR * Math.sqrt(api.rng());
      const tx = PX + Math.cos(ta) * tr;
      const ty = PY + Math.sin(ta) * tr * 0.94;
      const sa = api.range(0, TAU);
      const sd = api.range(130, 330);
      let settled = false;
      api.spawn({
        x: tx + Math.cos(sa) * sd, y: ty + Math.sin(sa) * sd,
        vx: api.range(-30, 30), vy: api.range(-30, 30),
        shape: api.rng() > 0.42 ? 'rect' : 'spark',
        size: api.range(1.8, 3.6), maxLife: 5.5,
        color: api.pick(['#93c5fd', '#bfdbfe', '#dbeafe']),
        glow: 0.9, spin: api.range(-2.4, 2.4), flutter: api.range(0, 1.4),
        opacity: 0.85, fadeIn: 0.06, fadeOut: 0.12,
        update: (p, dt) => {
          const k = 3 + Math.min(1, Math.max(0, (p.life - 0.9) / 2.3)) * 32; // 弹簧引力渐强
          p.vx += (tx - p.x) * k * dt;
          p.vy += (ty - p.y) * k * dt;
          const damp = Math.pow(0.05, dt);
          p.vx *= damp;
          p.vy *= damp;
          if (!settled && p.life > 3.4 && Math.hypot(tx - p.x, ty - p.y) < 5) {
            settled = true;
            p.spin = 0;
            p.twinkle = api.range(1, 2.4);
            p.color = '#dbeafe';
          }
        },
      });
    }
  });
  // 星体复原完成：辉光核心 + 光环脉冲
  api.at(4400, () => {
    api.spawn({ x: PX, y: PY, shape: 'dot', size: PR * 0.7, endSize: PR * 1.05, maxLife: 2.0, color: '#93c5fd', glow: 1.7, opacity: 0.5, fadeIn: 0.2, fadeOut: 0.4 });
    api.spawn({ x: PX, y: PY, shape: 'ring', size: PR * 1.2, endSize: PR * 2.6, maxLife: 0.9, color: '#bfdbfe', opacity: 0.6, fadeOut: 0.7 });
  });

  // ---------- 倒卷波：逐圈收缩，残像由拖尾保留 ----------
  [1600, 2700, 3800, 4900, 5800].forEach((t0, i) => {
    api.at(t0, () => {
      api.spawn({
        x: cx, y: OY, shape: 'ring', size: minDim * 0.52, endSize: 8, maxLife: 0.85,
        color: i % 2 === 0 ? '#bfdbfe' : '#fbbf24', opacity: 0.55, fadeIn: 0.08, fadeOut: 0.3,
      });
    });
  });

  // ---------- 幕三：全画面凝为一枚初始光种 ----------
  api.every(13, () => {
    const a = api.range(0, TAU);
    const r = api.range(200, minDim * 0.7);
    api.spawn({
      x: cx + Math.cos(a) * r, y: OY + Math.sin(a) * r,
      vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 3.2,
      shape: 'streak', stretch: 0.07, size: 1.7, maxLife: 0.32,
      color: api.rng() > 0.7 ? '#fef3c7' : '#bfdbfe', glow: 0.9, fadeIn: 0.1, fadeOut: 0.2,
    });
  }, { from: 6400, until: 6720 });
  api.at(6650, () => {
    api.spawn({ x: cx, y: H * 0.4, vy: 26, ay: 14, shape: 'dot', size: 16, endSize: 10, maxLife: 0.85, color: '#93c5fd', glow: 1.5, opacity: 0.35, wander: 6, fadeIn: 0.1, fadeOut: 0.45 });
    api.spawn({ x: cx, y: H * 0.4, vy: 26, ay: 14, shape: 'dot', size: 6.5, endSize: 4, maxLife: 0.85, color: '#fef3c7', glow: 2.5, wander: 6, fadeIn: 0.06, fadeOut: 0.4 });
    for (let i = 0; i < 8; i += 1) {
      api.spawn({
        x: cx + api.range(-26, 26), y: H * 0.4 + api.range(-20, 20),
        vy: api.range(12, 30), shape: 'dot', size: api.range(0.8, 1.4), maxLife: 0.8,
        color: '#fde68a', glow: 1, twinkle: api.range(2, 4), fadeOut: 0.4,
      });
    }
  });
};
</script>

<template>
  <div class="epoch-zero-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.epochZero" :scene="scene" />
    <div class="ez-hourglass">
      <span class="hg-cap top" />
      <span class="hg-bulb top" />
      <span class="hg-bulb bottom" />
      <span class="hg-cap bottom" />
      <span class="hg-neck" />
    </div>
    <div class="ez-dial">
      <span class="dial-face" />
      <span class="dial-needle" />
      <span class="dial-hub" />
      <small>T-AXIS REWIND</small>
    </div>
    <div class="ez-badge">
      <Hourglass :size="36" />
      <strong>纪元归零</strong>
      <small>EPOCH ZERO · PROTOCOL 666</small>
    </div>
    <div class="ez-caption">
      <strong>EPOCH 0</strong>
      <small>纪元零点 · 初始光种</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.epoch-zero-effect {
  @include effect-stage(hidden);
  animation: ez-camera 7.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

// ---------- 巨型沙漏（显影 → 翻转 → 隐没） ----------
.ez-hourglass {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 92px;
  height: 132px;
  filter: drop-shadow(0 0 18px rgba(251, 191, 36, 0.35));
  transform: translate(-50%, -50%);
  animation: ez-hourglass 7.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.ez-hourglass span {
  position: absolute;
  display: block;
}

.hg-cap {
  left: 2%;
  right: 2%;
  height: 5px;
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.2), #fbbf24, rgba(251, 191, 36, 0.2));
}

.hg-cap.top { top: 0; }
.hg-cap.bottom { bottom: 0; }

.hg-bulb.top {
  inset: 7px 8px 50% 8px;
  clip-path: polygon(0 0, 100% 0, 55% 100%, 45% 100%);
  background: linear-gradient(180deg, rgba(191, 219, 254, 0.16), rgba(191, 219, 254, 0.04) 55%, rgba(251, 191, 36, 0.4));
}

.hg-bulb.bottom {
  inset: 50% 8px 7px 8px;
  clip-path: polygon(45% 0, 55% 0, 100% 100%, 0 100%);
  background: linear-gradient(0deg, rgba(251, 191, 36, 0.42), rgba(191, 219, 254, 0.05) 60%, rgba(191, 219, 254, 0.14));
}

.hg-neck {
  left: 50%;
  top: 50%;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: radial-gradient(circle, #fef3c7 0 30%, rgba(251, 191, 36, 0.6) 60%, transparent 75%);
  animation: ez-neck 7.5s linear both;
}

// ---------- 刻度盘急速回拨 ----------
.ez-dial {
  position: absolute;
  left: 22%;
  top: 27%;
  width: 84px;
  height: 84px;
  transform: translate(-50%, -50%);
  animation: ez-dial 7.5s ease both;
}

.ez-dial span {
  position: absolute;
  display: block;
}

.dial-face {
  inset: 0;
  border: 1px solid rgba(147, 197, 253, 0.5);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(2, 6, 23, 0.55) 0 58%, transparent 60%),
    repeating-conic-gradient(rgba(147, 197, 253, 0.35) 0 2deg, transparent 2deg 30deg);
  box-shadow: 0 0 16px rgba(147, 197, 253, 0.25);
}

.dial-needle {
  left: calc(50% - 1px);
  top: calc(50% - 32px);
  width: 2px;
  height: 32px;
  border-radius: 1px;
  background: linear-gradient(180deg, #fbbf24, rgba(251, 191, 36, 0.1));
  transform-origin: 50% 100%;
  animation: ez-needle 7.5s cubic-bezier(0.6, 0, 0.4, 1) both;
}

.dial-hub {
  left: calc(50% - 3px);
  top: calc(50% - 3px);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fde68a;
}

.ez-dial small {
  position: absolute;
  left: 50%;
  bottom: -18px;
  color: rgba(191, 219, 254, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.2em;
  white-space: nowrap;
  transform: translateX(-50%);
}

// ---------- 协议徽章 / 归零字幕 ----------
.ez-badge {
  position: absolute;
  left: 50%;
  bottom: 11%;
  color: #dbeafe;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(147, 197, 253, 0.6);
  transform: translateX(-50%);
  animation: ez-badge 7.5s ease both;
}

.ez-badge strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.ez-badge small {
  color: rgba(219, 234, 254, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
}

.ez-caption {
  position: absolute;
  left: 50%;
  top: 30%;
  color: #fef9c3;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 24px rgba(251, 191, 36, 0.75);
  transform: translateX(-50%);
  animation: ez-caption 7.5s ease both;
}

.ez-caption strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 22px;
  letter-spacing: 0.34em;
}

.ez-caption small {
  color: rgba(191, 219, 254, 0.85);
  font-size: 11px;
  letter-spacing: 0.3em;
}

@keyframes ez-hourglass {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.68) rotate(0deg); }
  4% { opacity: 1; }
  6% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  13%, 52% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(180deg); }
  60%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9) rotate(180deg); }
}

@keyframes ez-neck {
  0%, 5% { opacity: 0; }
  10% { opacity: 1; }
  20% { opacity: 0.5; }
  30% { opacity: 1; }
  40% { opacity: 0.6; }
  52% { opacity: 1; }
  60%, 100% { opacity: 0; }
}

@keyframes ez-dial {
  0%, 8% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  13%, 76% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  84%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
}

@keyframes ez-needle {
  0%, 12% { transform: rotate(0deg); }
  78%, 100% { transform: rotate(-1620deg); }
}

@keyframes ez-badge {
  0%, 30% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  36%, 76% { opacity: 1; transform: translateX(-50%) translateY(0); }
  83%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes ez-caption {
  0%, 89% { opacity: 0; transform: translateX(-50%) scale(0.94); }
  93%, 98% { opacity: 1; transform: translateX(-50%) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.01); }
}

@keyframes ez-camera {
  0% { transform: scale(1.05); }
  21% { transform: scale(1.008); }
  24% { transform: scale(1.022); }
  36% { transform: scale(1.004); }
  39% { transform: scale(1.018); }
  51% { transform: scale(1); }
  54% { transform: scale(1.014); }
  76% { transform: scale(1); filter: blur(0); }
  87% { transform: scale(0.97); filter: blur(2.5px); }
  94% { transform: scale(0.99); filter: blur(0.5px); }
  100% { transform: scale(0.98); filter: blur(2px); opacity: 0; }
}
</style>
