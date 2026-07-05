<script setup lang="ts">
import { Slice } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const RUNES = ['ᚠ', 'ᚱ', 'ᛟ', 'ᛝ', 'ᛉ', 'ᚹ', 'ᛗ', 'ᛞ'];
const TEAR_AT = 1600;
const SEAL_AT = 4200;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // seed 生成裂缝折线（沿对角方向锯齿蔓延）
  const span = Math.min(api.width, api.height) * 0.62;
  const tiltAngle = api.range(-0.5, 0.5) + Math.PI / 2.6;
  const dirX = Math.cos(tiltAngle);
  const dirY = Math.sin(tiltAngle);
  const points: Array<{ x: number; y: number }> = [];
  const segs = 14;
  for (let i = 0; i <= segs; i += 1) {
    const along = (i / segs - 0.5) * span;
    const jitter = i === 0 || i === segs ? 0 : api.range(-26, 26);
    points.push({
      x: cx + dirX * along - dirY * jitter,
      y: cy + dirY * along + dirX * jitter,
    });
  }

  const drawCrack = (ctx: CanvasRenderingContext2D, fraction: number, width: number, alpha: number) => {
    const visible = Math.max(2, Math.round(points.length * fraction));
    const strokes: Array<[string, number]> = [
      [`rgba(192, 132, 252, ${alpha * 0.5})`, width * 3.2],
      [`rgba(192, 132, 252, ${alpha * 0.9})`, width * 1.5],
      [`rgba(248, 250, 252, ${alpha})`, width * 0.55],
    ];
    for (const [style, w] of strokes) {
      ctx.strokeStyle = style;
      ctx.lineWidth = Math.max(0.6, w);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < visible; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
  };

  // 幕一：应力前兆 —— 细光缝蔓延 + 暗紫微粒聚集
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 400) return;
    if (tMs < TEAR_AT) {
      drawCrack(ctx, (tMs - 400) / (TEAR_AT - 400), 0.8, 0.55);
      return;
    }
    // 幕二/幕三：撕开（宽度脉动）→ 缝合（长度回退）
    const sealing = tMs > SEAL_AT ? Math.max(0, 1 - (tMs - SEAL_AT) / 1300) : 1;
    if (sealing <= 0.01) return;
    const openness = Math.min(1, (tMs - TEAR_AT) / 420);
    const pulse = 1 + Math.sin(tMs / 90) * 0.18;
    drawCrack(ctx, sealing, (3.4 + openness * 4.4) * pulse * sealing, 0.95);
  });
  api.every(50, () => {
    const p = points[Math.floor(api.rng() * points.length)];
    api.spawn({
      x: p.x + api.range(-70, 70), y: p.y + api.range(-70, 70),
      shape: 'dot', size: api.range(1, 2), maxLife: 1,
      color: '#a855f7', glow: 1, opacity: 0.6, wander: 60, fadeOut: 0.5,
      update: (pt, dt) => {
        pt.vx += (p.x - pt.x) * 1.6 * dt;
        pt.vy += (p.y - pt.y) * 1.6 * dt;
      },
    });
  }, { until: TEAR_AT });

  // 幕二：撕裂瞬间 —— 白闪 + 缝缘迸溅 + 符文与碎片涌出
  api.at(TEAR_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 300, maxLife: 0.6, color: '#f5f3ff', glow: 2.2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 24, endSize: Math.max(api.width, api.height) * 0.6, maxLife: 0.9, color: '#c084fc', opacity: 0.85, fadeOut: 0.7 });
  });
  api.every(46, () => {
    const idx = Math.floor(api.rng() * (points.length - 1));
    const p = points[idx];
    const outward = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: p.x, y: p.y,
      vx: -dirY * outward * api.range(30, 120) + api.range(-20, 20),
      vy: dirX * outward * api.range(30, 120) + api.range(-20, 20),
      shape: 'spark', size: api.range(1.4, 2.6), maxLife: api.range(0.5, 1),
      color: api.pick(['#c084fc', '#e9d5ff', '#f0abfc']), glow: 1.1, drag: 0.5, fadeOut: 0.4,
    });
  }, { from: TEAR_AT, until: SEAL_AT });
  api.every(240, () => {
    const p = points[Math.floor(api.rng() * points.length)];
    const outward = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: p.x, y: p.y,
      vx: -dirY * outward * api.range(24, 60), vy: dirX * outward * api.range(24, 60),
      shape: 'glyph', glyph: api.pick(RUNES), size: api.range(15, 26),
      maxLife: api.range(1.4, 2.2), color: '#e9d5ff', drag: 0.4,
      spin: api.range(-1.2, 1.2), twinkle: 2, fadeIn: 0.12, fadeOut: 0.4,
    });
  }, { from: TEAR_AT + 100, until: SEAL_AT - 300 });
  api.every(320, () => {
    const p = points[Math.floor(api.rng() * points.length)];
    api.spawn({
      x: p.x, y: p.y, vx: api.range(-30, 30), vy: api.range(-46, -14),
      shape: 'rect', size: api.range(5, 11), maxLife: api.range(1.6, 2.4),
      color: '#c4b5fd', glow: 0, ay: -6, spin: api.range(-2, 2), flutter: api.range(0.6, 1.4),
      composite: 'source-over', opacity: 0.8, fadeOut: 0.4,
    });
  }, { from: TEAR_AT + 200, until: SEAL_AT - 400 });

  // 幕三：缝合 —— 光点沿缝走线扫过闭合 + 回弹波纹
  api.at(SEAL_AT, () => {
    let progress = 0;
    api.spawn({
      x: points[points.length - 1].x, y: points[points.length - 1].y,
      shape: 'spark', size: 4, maxLife: 1.2, color: '#f8fafc', glow: 1.8, fadeOut: 0.2,
      update: (p, dt) => {
        progress = Math.min(1, progress + dt / 1.1);
        const pos = (1 - progress) * (points.length - 1);
        const i = Math.min(points.length - 2, Math.floor(pos));
        const frac = pos - i;
        p.x = points[i].x + (points[i + 1].x - points[i].x) * frac;
        p.y = points[i].y + (points[i + 1].y - points[i].y) * frac;
      },
    });
  });
  api.at(SEAL_AT + 1100, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 16, endSize: 280, maxLife: 0.8, color: '#e9d5ff', opacity: 0.7, fadeOut: 0.7 });
  });
};
</script>

<template>
  <div class="rift-tear-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.riftTear" :scene="scene" />
    <div class="rift-label">
      <Slice :size="28" />
      <strong>时空裂隙</strong>
      <small>DIMENSIONAL BREACH · Δ-7</small>
    </div>
  </div>
</template>

<style scoped>
.rift-tear-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: rift-stress 6s ease both;
}

.rift-label {
  position: absolute;
  left: 50%;
  bottom: 13%;
  color: #ede9fe;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 20px rgba(192, 132, 252, 0.7);
  transform: translateX(-50%);
  animation: rift-label 6s ease both;
}

.rift-label strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.rift-label small {
  color: rgba(233, 213, 255, 0.68);
  font-size: 10px;
  letter-spacing: 0.24em;
}

@keyframes rift-label {
  0%, 32% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  42%, 84% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}

@keyframes rift-stress {
  0%, 10% { transform: translate(0, 0) scale(1.02); }
  14% { transform: translate(-3px, 2px) scale(1.02); }
  18% { transform: translate(3px, -2px) scale(1.03); }
  22% { transform: translate(-2px, -2px) scale(1.03); }
  26% { transform: translate(2px, 2px) scale(1.04); }
  27% { transform: translate(0, 0) scale(1.05); }
  30% { transform: scale(0.98); }
  40%, 68% { transform: scale(1); }
  74% { transform: scale(1.015); }
  100% { transform: scale(1.05); opacity: 0; }
}
</style>
