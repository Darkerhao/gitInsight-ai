<script setup lang="ts">
import { Slice } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const RUNES = ['ᚠ', 'ᚱ', 'ᛟ', 'ᛝ', 'ᛉ', 'ᚹ', 'ᛗ', 'ᛞ'];

/**
 * 时空裂隙 DIMENSION TEAR · 6000ms（entry 700 / loop 4350 / exit 950）
 * 三幕：应力光缝蔓延（主缝 + 支缝）→ 裂缝张开露出异次元内腔（符文/碎片/跨缝放电）→ 缝合回弹
 */
const TEAR_AT = 1750;
const SEAL_AT = 4500;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const cy = H / 2;

  // ── seed 生成裂缝：主折线 + 两条支缝（沿对角锯齿蔓延） ──
  const span = Math.min(W, H) * 0.62;
  const tiltAngle = api.range(-0.5, 0.5) + Math.PI / 2.6;
  const dirX = Math.cos(tiltAngle);
  const dirY = Math.sin(tiltAngle);
  const segs = 14;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= segs; i += 1) {
    const along = (i / segs - 0.5) * span;
    const jitter = i === 0 || i === segs ? 0 : api.range(-26, 26);
    points.push({ x: cx + dirX * along - dirY * jitter, y: cy + dirY * along + dirX * jitter });
  }
  const branches = [0, 1].map((side) => {
    const startIdx = 4 + Math.floor(api.rng() * (segs - 7));
    const sway = side === 0 ? -1 : 1;
    const bpts: Array<{ x: number; y: number }> = [{ ...points[startIdx] }];
    let bx = bpts[0].x;
    let by = bpts[0].y;
    for (let s = 1; s <= 4; s += 1) {
      bx += dirX * api.range(14, 30) - dirY * sway * api.range(16, 34);
      by += dirY * api.range(14, 30) + dirX * sway * api.range(16, 34);
      bpts.push({ x: bx, y: by });
    }
    return bpts;
  });

  const strokePath = (
    ctx: CanvasRenderingContext2D,
    pts: Array<{ x: number; y: number }>,
    fraction: number, width: number, alpha: number
  ) => {
    const visible = Math.max(2, Math.round(pts.length * fraction));
    const layers: Array<[string, number]> = [
      [`rgba(192, 132, 252, ${alpha * 0.5})`, width * 3.2],
      [`rgba(216, 180, 254, ${alpha * 0.85})`, width * 1.5],
      [`rgba(248, 250, 252, ${alpha})`, width * 0.55],
    ];
    for (const [style, w] of layers) {
      ctx.strokeStyle = style;
      ctx.lineWidth = Math.max(0.6, w);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < visible; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  };

  // 缝腔多边形（两缘按正弦宽度张开，端点收窄）
  const fillRift = (ctx: CanvasRenderingContext2D, openW: number, scaleW: number, color: string) => {
    const n = points.length;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const w = openW * scaleW * Math.sin(Math.PI * (i / (n - 1)));
      const x = points[i].x - dirY * w;
      const y = points[i].y + dirX * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i -= 1) {
      const w = openW * scaleW * Math.sin(Math.PI * (i / (n - 1)));
      ctx.lineTo(points[i].x + dirY * w, points[i].y - dirX * w);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  // ── 主绘制：应力缝蔓延 → 张开（异次元内腔）→ 缝合回退 ──
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 380) return;
    if (tMs < TEAR_AT) {
      const grow = (tMs - 380) / (TEAR_AT - 380);
      const flick = Math.min(0.9, 0.42 + 0.3 * Math.sin(tMs / 58) + (api.rng() < 0.12 ? 0.25 : 0));
      strokePath(ctx, points, grow, 0.8, flick * 0.75);
      if (grow > 0.55) {
        for (const b of branches) strokePath(ctx, b, (grow - 0.55) / 0.45, 0.5, flick * 0.45);
      }
      return;
    }
    const sealing = tMs > SEAL_AT ? Math.max(0, 1 - (tMs - SEAL_AT) / 1050) : 1;
    if (sealing <= 0.01) return;
    const openness = Math.min(1, (tMs - TEAR_AT) / 420);
    const pulse = 1 + Math.sin(tMs / 90) * 0.15;
    const openW = 10 * openness * pulse * sealing;
    fillRift(ctx, openW, 1, `rgba(216, 180, 254, ${0.3 * sealing})`);
    fillRift(ctx, openW, 0.45, `rgba(250, 245, 255, ${0.85 * sealing})`);
    strokePath(ctx, points, sealing, (2.6 + openness * 3.4) * pulse * sealing, 0.95 * sealing);
    for (const b of branches) strokePath(ctx, b, sealing, (1 + openness * 1.4) * sealing, 0.55 * sealing);
  });

  // ── 幕一：暗紫微粒被应力吸聚 + 三次应力预震白点 ──
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
  [700, 1150, 1480].forEach((when) => {
    api.at(when, () => {
      const p = points[Math.floor(api.rng() * points.length)];
      api.spawn({ x: p.x, y: p.y, shape: 'dot', size: 5, endSize: 1, maxLife: 0.22, color: '#faf5ff', glow: 1.6, fadeIn: 0, fadeOut: 0.6 });
      api.spawn({ x: p.x, y: p.y, shape: 'ring', size: 4, endSize: 34, maxLife: 0.32, color: '#c084fc', opacity: 0.5, fadeOut: 0.5 });
    });
  });

  // ── 幕二：撕裂 —— 白闪 + 主辅双环 + 全缝缘同时迸溅 ──
  api.at(TEAR_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 300, maxLife: 0.6, color: '#f5f3ff', glow: 2.2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 24, endSize: Math.max(W, H) * 0.6, maxLife: 0.9, color: '#c084fc', opacity: 0.85, fadeOut: 0.7 });
    for (let i = 1; i < points.length - 1; i += 1) {
      const outward = api.rng() > 0.5 ? 1 : -1;
      api.spawn({
        x: points[i].x, y: points[i].y,
        vx: -dirY * outward * api.range(60, 180), vy: dirX * outward * api.range(60, 180),
        shape: 'spark', size: api.range(1.4, 2.4), maxLife: api.range(0.4, 0.8),
        color: api.pick(['#c084fc', '#e9d5ff', '#f0abfc']), glow: 1.1, drag: 0.45, fadeOut: 0.4,
      });
    }
  });
  api.at(TEAR_AT + 140, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: Math.max(W, H) * 0.44, maxLife: 0.7, color: '#f472b6', opacity: 0.5, fadeOut: 0.7 });
  });

  // 缝缘持续迸溅火花
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

  // 缝内异次元辉尘：自内腔渗出漂浮
  api.every(90, () => {
    const idx = Math.floor(api.rng() * points.length);
    const p = points[idx];
    const off = api.range(-4, 4);
    api.spawn({
      x: p.x - dirY * off, y: p.y + dirX * off,
      vx: api.range(-12, 12), vy: api.range(-16, 4),
      shape: 'dot', size: api.range(0.8, 1.8), maxLife: api.range(0.8, 1.4),
      color: api.pick(['#f0abfc', '#e9d5ff', '#fbcfe8']), glow: 1,
      wander: 26, twinkle: api.range(3, 7), fadeIn: 0.12, fadeOut: 0.4,
    });
  }, { from: TEAR_AT + 150, until: SEAL_AT - 150 });

  // 沿缝奔走的缘火：光点贴缝走线
  api.every(420, () => {
    const forward = api.rng() < 0.5;
    let pos = forward ? 0 : points.length - 1;
    api.spawn({
      x: points[pos].x, y: points[pos].y, shape: 'spark', size: 2.4, maxLife: 0.6,
      color: '#f8fafc', glow: 1.4, fadeIn: 0.06, fadeOut: 0.2,
      update: (p) => {
        const k = Math.min(1, p.life / 0.6);
        const idxF = (forward ? k : 1 - k) * (points.length - 1);
        const i = Math.min(points.length - 2, Math.floor(idxF));
        const frac = idxF - i;
        p.x = points[i].x + (points[i + 1].x - points[i].x) * frac;
        p.y = points[i].y + (points[i + 1].y - points[i].y) * frac;
      },
    });
  }, { from: TEAR_AT + 260, until: SEAL_AT - 500 });

  // 跨缝放电：粉色微电弧横跳两缘
  let sceneTime = 0;
  const sparks: Array<{ pts: Array<[number, number]>; born: number; life: number }> = [];
  api.every(650, () => {
    const idx = 2 + Math.floor(api.rng() * (points.length - 4));
    const p = points[idx];
    const w = api.range(10, 18);
    const from: [number, number] = [p.x - dirY * w, p.y + dirX * w];
    const to: [number, number] = [p.x + dirY * w, p.y - dirX * w];
    const mid: [number, number] = [
      (from[0] + to[0]) / 2 + api.range(-8, 8),
      (from[1] + to[1]) / 2 + api.range(-8, 8),
    ];
    sparks.push({ pts: [from, mid, to], born: sceneTime, life: 0.16 });
    api.spawn({ x: to[0], y: to[1], shape: 'spark', size: 1.3, maxLife: 0.2, color: '#f9a8d4', glow: 1, fadeOut: 0.5 });
  }, { from: TEAR_AT + 300, until: SEAL_AT - 400 });
  api.onFrame((tMs, _dt, ctx) => {
    sceneTime = tMs / 1000;
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      const age = sceneTime - s.born;
      if (age > s.life) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(244, 114, 182, ${(1 - age / s.life) * 0.85})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      ctx.lineTo(s.pts[1][0], s.pts[1][1]);
      ctx.lineTo(s.pts[2][0], s.pts[2][1]);
      ctx.stroke();
    }
  });

  // 异界符文被吸出：近大远小（随机景深缩放），旋转悬浮偶发闪烁
  api.every(240, () => {
    const p = points[Math.floor(api.rng() * points.length)];
    const outward = api.rng() > 0.5 ? 1 : -1;
    const depth = api.range(0.65, 1.4);
    api.spawn({
      x: p.x, y: p.y,
      vx: -dirY * outward * api.range(24, 60) * depth, vy: dirX * outward * api.range(24, 60) * depth,
      shape: 'glyph', glyph: api.pick(RUNES), size: api.range(14, 22) * depth,
      maxLife: api.range(1.4, 2.2), color: depth > 1.1 ? '#f5d0fe' : '#d8b4fe',
      opacity: 0.45 + depth * 0.4, drag: 0.4,
      spin: api.range(-1.2, 1.2), twinkle: 2, fadeIn: 0.12, fadeOut: 0.4,
    });
  }, { from: TEAR_AT + 100, until: SEAL_AT - 300 });
  // 空间碎片：哑光菱片翻滚上飘（遮挡层次）
  api.every(320, () => {
    const p = points[Math.floor(api.rng() * points.length)];
    api.spawn({
      x: p.x, y: p.y, vx: api.range(-30, 30), vy: api.range(-46, -14),
      shape: 'rect', size: api.range(5, 11), maxLife: api.range(1.6, 2.4),
      color: '#c4b5fd', glow: 0, ay: -6, spin: api.range(-2, 2), flutter: api.range(0.6, 1.4),
      composite: 'source-over', opacity: 0.8, fadeOut: 0.4,
    });
  }, { from: TEAR_AT + 200, until: SEAL_AT - 400 });

  // ── 幕三：缝合 —— 光点携拉链火花沿缝扫过，回弹双环 + 空间弹响白闪 ──
  api.at(SEAL_AT, () => {
    let progress = 0;
    api.spawn({
      x: points[points.length - 1].x, y: points[points.length - 1].y,
      shape: 'spark', size: 4, maxLife: 1.1, color: '#f8fafc', glow: 1.8, fadeOut: 0.2,
      update: (p, dt) => {
        progress = Math.min(1, progress + dt / 1);
        const pos = (1 - progress) * (points.length - 1);
        const i = Math.min(points.length - 2, Math.floor(pos));
        const frac = pos - i;
        p.x = points[i].x + (points[i + 1].x - points[i].x) * frac;
        p.y = points[i].y + (points[i + 1].y - points[i].y) * frac;
        if (api.rng() < 0.3) {
          api.spawn({
            x: p.x + api.range(-4, 4), y: p.y + api.range(-4, 4),
            vx: api.range(-40, 40), vy: api.range(-40, 40),
            shape: 'spark', size: 1.2, maxLife: 0.28, color: '#e9d5ff', glow: 1, fadeOut: 0.5,
          });
        }
      },
    });
  });
  api.at(SEAL_AT + 1040, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 10, endSize: 2, maxLife: 0.18, color: '#ffffff', glow: 2, fadeIn: 0, fadeOut: 0.5 });
  });
  api.at(SEAL_AT + 1100, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 16, endSize: 290, maxLife: 0.6, color: '#e9d5ff', opacity: 0.7, fadeOut: 0.7 });
  });
  api.at(SEAL_AT + 1180, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 12, endSize: 210, maxLife: 0.5, color: '#f472b6', opacity: 0.4, fadeOut: 0.7 });
  });
  // 残余暗尘缓散
  api.every(120, () => {
    api.spawn({
      x: cx + api.range(-160, 160), y: cy + api.range(-120, 120),
      vy: api.range(-14, -4), shape: 'dot', size: api.range(0.7, 1.4),
      maxLife: 0.36, color: '#c084fc', glow: 0.8, opacity: 0.5,
      wander: 20, twinkle: 5, fadeOut: 0.6,
    });
  }, { from: SEAL_AT + 1100, until: api.duration - 220 });
};
</script>

<template>
  <div class="rift-tear-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.riftTear" :scene="scene" />
    <div class="rift-label">
      <Slice :size="26" />
      <strong>时空裂隙</strong>
      <small class="rift-tag-open">DIMENSION TEAR · BREACH Δ-7</small>
      <small class="rift-tag-seal">RIFT SEALED · CONTINUUM RESTORED</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rift-tear-effect {
  @include effect-stage(hidden);
}

.rift-label {
  position: absolute;
  left: 50%;
  bottom: 12%;
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
  letter-spacing: 0.16em;
}

.rift-label small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.24em;
}

.rift-tag-open {
  color: rgba(233, 213, 255, 0.72);
  animation: rift-tag-open 6s step-end both;
}

.rift-tag-seal {
  margin-top: -16px;
  color: rgba(249, 168, 212, 0.85);
  animation: rift-tag-seal 6s ease both;
}

@keyframes rift-label {
  0%, 30% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  38%, 93% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}

@keyframes rift-tag-open {
  0%, 30% { opacity: 0; }
  33%, 35% { opacity: 1; }
  36% { opacity: 0.3; }
  37%, 74% { opacity: 1; }
  75%, 100% { opacity: 0; }
}

@keyframes rift-tag-seal {
  0%, 88% { opacity: 0; }
  91%, 97% { opacity: 1; }
  100% { opacity: 0.8; }
}
</style>
