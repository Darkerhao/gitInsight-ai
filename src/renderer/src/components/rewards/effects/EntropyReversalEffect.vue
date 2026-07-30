<script setup lang="ts">
import { Undo2 } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 熵逆狂潮 · ENTROPY REVERSAL（创世级 666）
 * 幕一 0-900ms    死寂灰烬悬浮，熵计量表读数濒临 MAX
 * 幕二 900-6300ms 四道逆熵波自屏心荡开：所过处灰烬点亮回燃（灰 → 绿金）、
 *                 碎片倒飞聚合成晶格与星体（弹簧引力）、熵条逐段倒退、负熵流环场奔涌
 * 幕三 6300-7400ms 万物齐明一拍 ENTROPY REVERSED，宇宙重新呼吸
 */
const TAU = Math.PI * 2;
const ASH_COLORS = ['#57534e', '#6b7280', '#4b5563', '#78716c'] as const;
const LIT_COLORS = ['#6ee7b7', '#34d399', '#a7f3d0', '#fde68a'] as const;

const scene: SceneFn = (api) => {
  api.setTrail(0.22);
  const W = api.width;
  const H = api.height;
  const minDim = Math.min(W, H);
  const cx = W / 2;
  const cy = H * 0.5;
  const waves = [1000, 2300, 3600, 4900];
  const waveSpeed = minDim * 0.62; // px/s
  const waveR = (t: number, t0: number) => ((t - t0) / 1000) * waveSpeed;

  let nowT = 0;
  api.onFrame((tMs) => { nowT = tMs; });

  // ---------- 幕一：死寂灰烬悬浮（每颗认领一道逆熵波，逐波点亮回燃） ----------
  for (let i = 0; i < 128; i += 1) {
    const myWave = waves[i % waves.length];
    let lit = false;
    api.spawn({
      x: api.rng() * W, y: api.rng() * H,
      vx: api.range(-4, 4), vy: api.range(3, 12),
      shape: 'dot', size: api.range(1, 2.6), maxLife: 7.2,
      color: api.pick(ASH_COLORS), glow: 0.35, opacity: api.range(0.35, 0.6),
      wander: 6, fadeIn: 0.06, fadeOut: 0.14,
      update: (p) => {
        if (lit || nowT < myWave) return;
        const dist = Math.hypot(p.x - cx, p.y - cy);
        if (dist < waveR(nowT, myWave) + 10) {
          lit = true;
          p.color = api.pick(LIT_COLORS);
          p.glow = 1.35;
          p.opacity = 0.95;
          p.twinkle = api.range(1.4, 3);
          p.vy = -api.range(6, 22);
          p.wander = 24;
        }
      },
    });
  }

  // ---------- 逆熵波：扩张环（绿辉主环 + 白热前锋） ----------
  api.onFrame((tMs, _dt, ctx) => {
    for (const t0 of waves) {
      const age = (tMs - t0) / 1000;
      if (age <= 0 || age > 2.1) continue;
      const r = age * waveSpeed;
      const a = Math.max(0, 1 - age / 2.1);
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.26 * a})`;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(236, 253, 245, ${0.5 * a})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 5, 0, TAU);
      ctx.stroke();
    }
  });
  // 每道波荡开的一瞬：屏心轻闪
  waves.forEach((t0) => {
    api.at(t0, () => {
      api.spawn({ x: cx, y: cy, shape: 'dot', size: 8, endSize: 60, maxLife: 0.4, color: '#d1fae5', glow: 1.8, opacity: 0.7, fadeOut: 0.8 });
    });
  });

  // ---------- 幕二：碎片倒飞聚合成晶格与星体 ----------
  const pts: Array<{ x: number; y: number }> = [{ x: cx, y: cy }];
  const r1 = minDim * 0.075;
  const r2 = minDim * 0.15;
  for (let i = 0; i < 6; i += 1) {
    pts.push({ x: cx + Math.cos((i * TAU) / 6) * r1, y: cy + Math.sin((i * TAU) / 6) * r1 });
  }
  for (let i = 0; i < 12; i += 1) {
    pts.push({ x: cx + Math.cos((i * TAU) / 12 + TAU / 24) * r2, y: cy + Math.sin((i * TAU) / 12 + TAU / 24) * r2 });
  }
  const segs: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < r1 * 1.25) segs.push([i, j]);
    }
  }
  api.at(1150, () => {
    for (let i = 0; i < 76; i += 1) {
      const base = pts[i % pts.length];
      const tx = base.x + api.range(-4, 4);
      const ty = base.y + api.range(-4, 4);
      const sa = api.range(0, TAU);
      const sd = api.range(150, 400);
      let arrived = false;
      api.spawn({
        x: tx + Math.cos(sa) * sd, y: ty + Math.sin(sa) * sd,
        vx: api.range(-24, 24), vy: api.range(-24, 24),
        shape: api.rng() > 0.5 ? 'rect' : 'spark',
        size: api.range(1.6, 3.2), maxLife: 5.6,
        color: api.pick(['#9ca3af', '#a8a29e', '#94a3b8']),
        glow: 0.7, spin: api.range(-2.6, 2.6), flutter: api.range(0, 1.2),
        opacity: 0.85, fadeIn: 0.06, fadeOut: 0.12,
        update: (p, dt) => {
          const k = 3 + Math.min(1, Math.max(0, (p.life - 1) / 2.2)) * 33;
          p.vx += (tx - p.x) * k * dt;
          p.vy += (ty - p.y) * k * dt;
          const damp = Math.pow(0.05, dt);
          p.vx *= damp;
          p.vy *= damp;
          if (!arrived && p.life > 3.2 && Math.hypot(tx - p.x, ty - p.y) < 5) {
            arrived = true;
            p.spin = 0;
            p.color = '#6ee7b7';
            p.glow = 1.3;
            p.twinkle = api.range(1, 2.2);
          }
        },
      });
    }
  });
  // 晶格连线成形（onFrame 画六方网格）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 4700) return;
    const ramp = Math.min(1, (tMs - 4700) / 650);
    const fade = Math.min(1, Math.max(0, (7350 - tMs) / 420));
    const a = ramp * fade * (0.3 + 0.1 * Math.sin(tMs / 240));
    if (a <= 0.01) return;
    ctx.strokeStyle = `rgba(52, 211, 153, ${a})`;
    ctx.lineWidth = 1.2;
    for (const [i, j] of segs) {
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(167, 243, 208, ${a * 1.4})`;
    for (const pt of pts) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.8, 0, TAU);
      ctx.fill();
    }
  });
  // 晶格核心成星：辉光 + 脉冲环
  api.at(5400, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 10, endSize: 46, maxLife: 1.7, color: '#a7f3d0', glow: 1.9, opacity: 0.6, fadeIn: 0.14, fadeOut: 0.5 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: r2 * 1.1, endSize: r2 * 2.4, maxLife: 0.9, color: '#6ee7b7', opacity: 0.6, fadeOut: 0.7 });
  });

  // ---------- 负熵流环场奔涌（环形 streak 流） ----------
  api.every(34, () => {
    let ang = api.range(0, TAU);
    const Rx = minDim * 0.46;
    const Ry = minDim * 0.34;
    api.spawn({
      x: cx + Math.cos(ang) * Rx, y: cy + Math.sin(ang) * Ry,
      shape: 'streak', stretch: 0.16, size: api.range(1.4, 2.4), maxLife: 1.5,
      color: api.pick(['#6ee7b7', '#34d399', '#93c5fd']), glow: 1, fadeIn: 0.1, fadeOut: 0.3,
      update: (p, dt) => {
        ang += 1.9 * dt;
        p.x = cx + Math.cos(ang) * Rx;
        p.y = cy + Math.sin(ang) * Ry;
        p.vx = -Math.sin(ang) * Rx * 1.9;
        p.vy = Math.cos(ang) * Ry * 1.9;
      },
    });
  }, { from: 3150, until: 6050 });

  // ---------- 幕三：万物齐明一拍，宇宙重新呼吸 ----------
  api.at(6300, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 20, endSize: Math.max(W, H) * 0.85, maxLife: 0.55, color: '#ecfdf5', glow: 2.2, opacity: 0.85, fadeOut: 0.9 });
    [0, 150].forEach((d, i) => {
      api.at(6300 + d, () => {
        api.spawn({
          x: cx, y: cy, shape: 'ring', size: 26,
          endSize: Math.max(W, H) * (0.44 + i * 0.2), maxLife: 1,
          color: i === 0 ? '#6ee7b7' : '#93c5fd', opacity: 0.75, fadeOut: 0.72,
        });
      });
    });
  });
  // 复苏余烬：绿金光点升腾（宇宙重新呼吸）
  api.every(55, () => {
    api.spawn({
      x: api.rng() * W, y: H * api.range(0.45, 0.95),
      vy: -api.range(16, 46), shape: 'dot', size: api.range(0.9, 1.8),
      maxLife: api.range(0.8, 1.2), color: api.pick(LIT_COLORS), glow: 1,
      wander: 18, twinkle: api.range(1.6, 3), fadeIn: 0.14, fadeOut: 0.45,
    });
  }, { from: 6350, until: 7050 });
};
</script>

<template>
  <div class="entropy-reversal-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.entropyReversal" :scene="scene" />
    <div class="er-meter">
      <small>ENTROPY 熵值</small>
      <span class="er-track"><i class="er-fill" /></span>
      <em class="er-max">S ≈ S_MAX</em>
      <em class="er-zero">ΔS &lt; 0</em>
    </div>
    <div class="er-breath" />
    <div class="er-badge">
      <Undo2 :size="38" />
      <strong>熵逆狂潮</strong>
      <small>ENTROPY REVERSAL · PROTOCOL 666</small>
    </div>
    <div class="er-caption">
      <strong>ENTROPY REVERSED</strong>
      <small>时间之矢倒指 · 万物齐明</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.entropy-reversal-effect {
  @include effect-stage(hidden);
  animation: er-camera 7.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}

// ---------- 熵计量表：读数濒临 MAX → 逐段倒退 ----------
.er-meter {
  position: absolute;
  left: 7%;
  top: 13%;
  width: 190px;
  color: #d1fae5;
  animation: er-meter 7.4s ease both;
}

.er-meter small {
  display: block;
  margin-bottom: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.24em;
  color: rgba(209, 250, 229, 0.75);
}

.er-track {
  position: relative;
  display: block;
  height: 8px;
  border: 1px solid rgba(110, 231, 183, 0.4);
  border-radius: 4px;
  background: rgba(2, 44, 34, 0.55);
  overflow: hidden;
}

.er-fill {
  position: absolute;
  inset: 1px;
  border-radius: 3px;
  background: linear-gradient(90deg, #34d399, #fbbf24 55%, #f87171 90%);
  transform-origin: left center;
  animation: er-fill 7.4s linear both;
}

.er-meter em {
  position: absolute;
  right: 0;
  top: 34px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0.18em;
}

.er-max {
  color: #fca5a5;
  animation: er-max 7.4s linear both;
}

.er-zero {
  color: #6ee7b7;
  animation: er-zero 7.4s linear both;
}

// 呼吸辉光：结尾宇宙重新呼吸
.er-breath {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(52, 211, 153, 0.22), transparent 55%);
  opacity: 0;
  pointer-events: none;
  animation: er-breath 7.4s ease-in-out both;
}

.er-badge {
  position: absolute;
  left: 50%;
  bottom: 11%;
  color: #d1fae5;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(52, 211, 153, 0.65);
  transform: translateX(-50%);
  animation: er-badge 7.4s ease both;
}

.er-badge strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.er-badge small {
  color: rgba(209, 250, 229, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
}

.er-caption {
  position: absolute;
  left: 50%;
  top: 22%;
  color: #ecfdf5;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 22px rgba(110, 231, 183, 0.8);
  transform: translateX(-50%);
  animation: er-caption 7.4s ease both;
}

.er-caption strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 19px;
  letter-spacing: 0.28em;
}

.er-caption small {
  color: rgba(147, 197, 253, 0.85);
  font-size: 11px;
  letter-spacing: 0.3em;
}

@keyframes er-meter {
  0% { opacity: 0; transform: translateY(-10px); }
  5%, 86% { opacity: 1; transform: translateY(0); }
  93%, 100% { opacity: 0; transform: translateY(-6px); }
}

// 熵条逐段倒退：每道逆熵波过后急降一段
@keyframes er-fill {
  0%, 14% { transform: scaleX(0.97); }
  17%, 30% { transform: scaleX(0.8); }
  33%, 48% { transform: scaleX(0.55); }
  51%, 65% { transform: scaleX(0.31); }
  68%, 80% { transform: scaleX(0.09); }
  85%, 100% { transform: scaleX(0.03); }
}

@keyframes er-max {
  0% { opacity: 1; }
  4% { opacity: 0.3; }
  8% { opacity: 1; }
  12% { opacity: 0.4; }
  16%, 40% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

@keyframes er-zero {
  0%, 56% { opacity: 0; }
  62%, 86% { opacity: 1; }
  93%, 100% { opacity: 0; }
}

@keyframes er-breath {
  0%, 84% { opacity: 0; transform: scale(1); }
  89% { opacity: 0.4; transform: scale(1.04); }
  93% { opacity: 0.14; transform: scale(1); }
  97% { opacity: 0.34; transform: scale(1.05); }
  100% { opacity: 0; transform: scale(1.02); }
}

@keyframes er-badge {
  0%, 30% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  36%, 78% { opacity: 1; transform: translateX(-50%) translateY(0); }
  85%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes er-caption {
  0%, 85% { opacity: 0; transform: translateX(-50%) scale(0.94); }
  89%, 98% { opacity: 1; transform: translateX(-50%) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.01); }
}

@keyframes er-camera {
  0% { transform: scale(1.07); }
  13% { transform: scale(1.02); }
  30% { transform: scale(1.035); }
  47% { transform: scale(1.015); }
  64% { transform: scale(1.03); }
  84% { transform: scale(1.01); }
  87% { transform: scale(1.05); }
  100% { transform: scale(1.03); opacity: 0; }
}
</style>
