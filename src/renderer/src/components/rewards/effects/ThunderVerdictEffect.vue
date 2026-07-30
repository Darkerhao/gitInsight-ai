<script setup lang="ts">
import { CloudLightning } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/** 九道主雷依序劈落 + 终审巨雷（phases: 850 / 5400 / 1000，总 7250ms） */
const STRIKE_TIMES = [1150, 1720, 2260, 2760, 3230, 3670, 4080, 4470, 4840];
const VERDICT_AT = 5350;

const scene: SceneFn = (api) => {
  api.setTrail(0.5);
  const cx = api.width / 2;
  const cyA = api.height * 0.52;
  const groundY = api.height * 0.74;
  const R = Math.min(api.width, api.height) * 0.21;
  const state = { now: 0, flash: 0, lit: 0, verdictAt: 0 };

  type Bolt = { pts: Array<[number, number]>; born: number; life: number; width: number; color: string; seed: number };
  const bolts: Bolt[] = [];
  const makeBolt = (
    x0: number, y0: number, x1: number, y1: number,
    width: number, life: number, born: number,
    color = '#7dd3fc', jag = 999
  ) => {
    const segs = 13;
    const amp = jag === 999 ? Math.hypot(x1 - x0, y1 - y0) * 0.14 : jag;
    const pts: Array<[number, number]> = [[x0, y0]];
    for (let i = 1; i < segs; i += 1) {
      const f = i / segs;
      const bend = Math.sin(f * Math.PI) * amp;
      pts.push([
        x0 + (x1 - x0) * f + api.range(-bend, bend),
        y0 + (y1 - y0) * f + api.range(-bend * 0.4, bend * 0.4),
      ]);
    }
    pts.push([x1, y1]);
    bolts.push({ pts, born, life, width, color, seed: api.range(0, 9) });
    // 支闪分叉
    if (width > 1.8) {
      const forks = 1 + Math.floor(api.rng() * 2);
      for (let fk = 0; fk < forks; fk += 1) {
        const idx = 3 + Math.floor(api.rng() * (segs - 6));
        const [fx, fy] = pts[idx];
        const fpts: Array<[number, number]> = [[fx, fy]];
        const dirX = api.range(-1, 1);
        for (let s = 1; s <= 4; s += 1) {
          fpts.push([
            fx + dirX * s * api.range(14, 30) + api.range(-10, 10),
            fy + s * api.range(12, 26),
          ]);
        }
        bolts.push({ pts: fpts, born, life: life * 0.8, width: width * 0.45, color, seed: api.range(0, 9) });
      }
    }
  };

  // ── 雷雨氛围：稀疏斜雨 + 云内闷闪 ──
  api.every(26, () => {
    api.spawn({
      x: api.range(-0.05, 1.1) * api.width, y: -14,
      vx: -70, vy: api.range(820, 980),
      shape: 'streak', stretch: 0.05, size: 1.1, maxLife: (api.height + 40) / 880,
      color: '#94a3b8', glow: 0, opacity: api.range(0.14, 0.3), fadeIn: 0.06, fadeOut: 0.1,
    });
  }, { from: 450, until: 6600 });
  api.every(640, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.range(6, api.height * 0.14),
      shape: 'dot', size: 6, endSize: api.range(50, 88), maxLife: 0.3,
      color: '#bae6fd', glow: 1.4, opacity: 0.42, fadeOut: 0.8,
    });
  }, { from: 260, until: 5150 });

  // ── onFrame：闪电折线 + 法阵刻度 + 全屏微闪 ──
  const strokePts = (ctx: CanvasRenderingContext2D, pts: Array<[number, number]>) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  api.onFrame((tMs, dt, ctx) => {
    state.now = tMs;
    const fade = Math.min(1, Math.max(0, (7250 - tMs) / 700));
    // 法阵：外环九枚刻度逐环点亮 + 进度弧
    const power = Math.min(1, Math.max(0, (tMs - 350) / 500));
    if (power > 0 && fade > 0.02) {
      for (let i = 0; i < 9; i += 1) {
        const a = -Math.PI / 2 + (i / 9) * Math.PI * 2;
        const tx = cx + Math.cos(a) * R;
        const ty = cyA + Math.sin(a) * R;
        const litOn = i < state.lit;
        let al = litOn ? 0.85 : 0.22;
        if (state.verdictAt > 0 && tMs > state.verdictAt) {
          const vAge = (tMs - state.verdictAt) / 1000;
          if (vAge < 0.7) al = 0.5 + 0.5 * Math.sin(vAge * 40 + i * 2.1);
        }
        ctx.globalAlpha = Math.max(0, al) * fade * power;
        ctx.fillStyle = litOn ? '#a5f3fc' : '#475569';
        ctx.beginPath();
        ctx.arc(tx, ty, litOn ? 3.4 : 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (litOn) {
          ctx.strokeStyle = '#a5f3fc';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (R - 12), cyA + Math.sin(a) * (R - 12));
          ctx.lineTo(cx + Math.cos(a) * (R + 10), cyA + Math.sin(a) * (R + 10));
          ctx.stroke();
        }
      }
      if (state.lit > 0) {
        ctx.globalAlpha = 0.5 * fade * power;
        ctx.strokeStyle = '#c4b5fd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cyA, R - 16, -Math.PI / 2, -Math.PI / 2 + (state.lit / 9) * Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // 锯齿闪电（外辉 + 白芯，带频闪）
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = bolts.length - 1; i >= 0; i -= 1) {
      const b = bolts[i];
      const age = (tMs - b.born) / 1000;
      if (age > b.life) {
        bolts.splice(i, 1);
        continue;
      }
      if (age < 0) continue;
      const k = 1 - age / b.life;
      const flick = 0.72 + 0.28 * Math.sin(tMs * 0.09 + b.seed * 7);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.32 * k * flick * fade;
      ctx.lineWidth = b.width * 3.4;
      strokePts(ctx, b.pts);
      ctx.strokeStyle = '#f8fafc';
      ctx.globalAlpha = 0.95 * k * flick * fade;
      ctx.lineWidth = b.width;
      strokePts(ctx, b.pts);
    }
    ctx.globalAlpha = 1;
    // 全屏微闪（终审时过曝一拍）
    if (state.flash > 0.01) {
      ctx.globalAlpha = Math.min(0.5, state.flash * 0.3) * fade;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(0, 0, api.width, api.height);
      ctx.globalAlpha = 1;
      state.flash *= Math.exp(-dt * 8);
    }
  });

  // ── 幕二：九道主雷依序劈落，命中法阵刻度点 ──
  STRIKE_TIMES.forEach((t, i) => {
    api.at(t, () => {
      const a = -Math.PI / 2 + (i / 9) * Math.PI * 2;
      const tx = cx + Math.cos(a) * R;
      const ty = cyA + Math.sin(a) * R;
      makeBolt(tx + api.range(-150, 150), -24, tx, ty, 2.4 + i * 0.16, 0.3, t);
      state.flash = Math.max(state.flash, 0.3 + i * 0.04);
      state.lit = i + 1;
      // 端点电花球 + 环波
      api.spawn({ x: tx, y: ty, shape: 'dot', size: 6, endSize: 70 + i * 6, maxLife: 0.35, color: '#e0f2fe', glow: 2, fadeOut: 0.85 });
      api.burst({
        x: tx, y: ty, count: 22 + i * 2, speed: [70, 300],
        base: { shape: 'spark', size: 1.8, maxLife: 0.55, glow: 1.25, drag: 0.32, fadeOut: 0.45 },
        vary: (p, rng) => {
          p.color = rng() > 0.6 ? '#c4b5fd' : '#a5f3fc';
          p.maxLife = 0.3 + rng() * 0.5;
        },
      });
      api.spawn({ x: tx, y: ty, shape: 'ring', size: 12, endSize: 150 + i * 14, maxLife: 0.55, color: '#a5f3fc', opacity: 0.8, fadeOut: 0.65 });
      // 链状支闪沿地表游走
      if (i >= 2) {
        const gx = tx + api.range(-30, 30);
        const reach = api.range(130, 260) * (api.rng() > 0.5 ? 1 : -1);
        makeBolt(gx, groundY, gx + reach, groundY + api.range(-10, 8), 1.4, 0.24, t + 40, '#c4b5fd', 22);
        api.burst({
          x: gx + reach * 0.6, y: groundY, count: 8, speed: [40, 140],
          angle: [Math.PI, Math.PI * 2],
          base: { shape: 'spark', size: 1.4, maxLife: 0.4, color: '#c4b5fd', glow: 1, drag: 0.4, fadeOut: 0.5 },
        });
      }
    });
  });

  // ── 终审巨雷：三股并击 + 贯地余脉 + 全屏过曝 ──
  api.at(VERDICT_AT, () => {
    state.lit = 9;
    state.verdictAt = VERDICT_AT;
    state.flash = 1.8;
    for (let s = 0; s < 3; s += 1) {
      makeBolt(cx + api.range(-260, 260), -30, cx + api.range(-12, 12), cyA + api.range(-8, 8), 4.6 - s * 0.9, 0.5, VERDICT_AT, '#a5f3fc');
    }
    makeBolt(cx, cyA, cx + api.range(-60, 60), groundY + 6, 3.2, 0.42, VERDICT_AT + 30, '#c4b5fd');
    api.spawn({ x: cx, y: cyA, shape: 'dot', size: 20, endSize: Math.max(api.width, api.height), maxLife: 0.7, color: '#f8fafc', glow: 2.4, fadeOut: 0.92 });
    api.burst({
      x: cx, y: cyA, count: 88, speed: [160, 620],
      base: { shape: 'spark', size: 2.2, maxLife: 0.9, glow: 1.3, drag: 0.35, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() > 0.55 ? '#a5f3fc' : '#c4b5fd';
        p.maxLife = 0.5 + rng() * 0.7;
        if (rng() > 0.75) p.shape = 'streak';
      },
    });
  });
  [0, 150, 320].forEach((delay, i) => {
    api.at(VERDICT_AT + delay, () => {
      api.spawn({
        x: cx, y: cyA, shape: 'ring', size: 30,
        endSize: Math.max(api.width, api.height) * (0.4 + i * 0.22),
        maxLife: 0.95, color: i === 1 ? '#c4b5fd' : '#a5f3fc', opacity: 0.85, fadeOut: 0.72,
      });
    });
  });

  // ── 幕三：余电噼啪收尾 ──
  api.every(230, () => {
    const x = api.range(cx - R * 1.5, cx + R * 1.5);
    const y = api.rng() > 0.5 ? groundY : cyA + R * api.range(0.6, 1);
    makeBolt(x, y, x + api.range(-90, 90), y + api.range(-34, 18), 1.1, 0.16, state.now, '#a5f3fc', 16);
    api.burst({
      x, y, count: 5, speed: [30, 110],
      base: { shape: 'spark', size: 1.3, maxLife: 0.35, color: '#e0f2fe', glow: 1, drag: 0.35, fadeOut: 0.5 },
    });
  }, { from: 5950, until: 6950 });
};
</script>

<template>
  <div class="thunder-verdict-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.thunderVerdict" :scene="scene" />
    <div class="tv-clouds">
      <span class="tv-cloud c1" />
      <span class="tv-cloud c2" />
      <span class="tv-cloud c3" />
    </div>
    <div class="tv-array" />
    <div class="tv-array-inner" />
    <div class="tv-veil" />
    <div class="tv-badge">
      <CloudLightning :size="38" />
      <strong>雷狱天罚 · 九雷归一</strong>
      <small>THUNDER VERDICT // VERDICT DELIVERED</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.thunder-verdict-effect {
  @include effect-stage(hidden);
}

.tv-clouds {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.tv-cloud {
  position: absolute;
  top: -14%;
  width: 68%;
  height: 40%;
  background: radial-gradient(ellipse at center, rgba(51, 65, 85, 0.66), rgba(15, 23, 42, 0.4) 52%, transparent 72%);
  animation: tv-cloud 7.25s ease-in-out both;
}

.tv-cloud.c1 { left: -12%; }
.tv-cloud.c2 { left: 28%; top: -18%; animation-name: tv-cloud-alt; }
.tv-cloud.c3 { left: 54%; top: -12%; }

.tv-array {
  position: absolute;
  left: 50%;
  top: 52%;
  width: 42vmin;
  height: 42vmin;
  border: 2px solid rgba(125, 211, 252, 0.5);
  border-radius: 50%;
  filter: drop-shadow(0 0 16px rgba(125, 211, 252, 0.5));
  animation: tv-array 7.25s linear both;
}

.tv-array-inner {
  position: absolute;
  left: 50%;
  top: 52%;
  width: 33vmin;
  height: 33vmin;
  border: 1px dashed rgba(196, 181, 253, 0.46);
  border-radius: 50%;
  animation: tv-array-inner 7.25s linear both;
}

.tv-veil {
  position: absolute;
  inset: 0;
  background: #f0f9ff;
  opacity: 0;
  animation: tv-veil 7.25s ease-out both;
  pointer-events: none;
}

.tv-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #bae6fd;
  text-shadow: 0 0 18px rgba(125, 211, 252, 0.7);
  transform: translateX(-50%);
  animation: tv-badge 7.25s ease both;
}

.tv-badge strong {
  font-size: 16px;
  letter-spacing: 0.14em;
}

.tv-badge small {
  color: rgba(186, 230, 253, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
}

@keyframes tv-cloud {
  0% { opacity: 0; transform: translateX(-3%) translateY(-16%); }
  10%, 86% { opacity: 1; transform: translateX(0) translateY(0); }
  46% { transform: translateX(2.4%) translateY(1%); }
  100% { opacity: 0; transform: translateX(4%) translateY(-14%); }
}

@keyframes tv-cloud-alt {
  0% { opacity: 0; transform: translateX(3%) translateY(-16%); }
  10%, 86% { opacity: 1; transform: translateX(0) translateY(0); }
  52% { transform: translateX(-2.6%) translateY(1.4%); }
  100% { opacity: 0; transform: translateX(-4%) translateY(-14%); }
}

@keyframes tv-array {
  0%, 5% { opacity: 0; transform: translate(-50%, -50%) scale(0.82) rotate(0deg); }
  8% { opacity: 0.9; }
  9.5% { opacity: 0.3; }
  12%, 86% { opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1) rotate(22deg); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.06) rotate(44deg); }
}

@keyframes tv-array-inner {
  0%, 6% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg); }
  9% { opacity: 0.8; }
  11% { opacity: 0.3; }
  13%, 86% { opacity: 0.9; }
  50% { transform: translate(-50%, -50%) rotate(-30deg); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(-60deg); }
}

@keyframes tv-veil {
  0%, 73.4% { opacity: 0; }
  74.6% { opacity: 0.96; }
  76.2% { opacity: 0.85; }
  79.5% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes tv-badge {
  0%, 79% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  84%, 94% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
}
</style>
