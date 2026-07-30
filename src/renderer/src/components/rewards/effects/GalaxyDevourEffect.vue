<script setup lang="ts">
import { Shell } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const CLOUD_A = ['#a5b4fc', '#c7d2fe', '#e0e7ff'];
const CLOUD_B = ['#f0abfc', '#f5d0fe', '#fbcfe8'];
/** 双核并合时刻（phases: 900 / 5600 / 1100，总 7600ms） */
const MERGE_AT = 6000;
const BURSTS = [2350, 3150, 3850, 4500, 5100, 5550];

const scene: SceneFn = (api) => {
  api.setTrail(0.28);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const minDim = Math.min(api.width, api.height);
  const sep0 = minDim * 0.34;
  const theta0 = api.range(0.55, 0.95);
  const state = { x1: cx, y1: cy, x2: cx, y2: cy, rot1: 0, rot2: 0, u: 0 };

  // 双体轨道：对角入场 → 互绕 → 逐圈加速靠近（解析式，逐帧确定）
  const orbit = (tMs: number) => {
    const u = Math.min(1, Math.max(0, tMs / MERGE_AT));
    const entry = Math.min(1, tMs / 900);
    const ease = 1 - Math.pow(1 - entry, 3);
    const sep = sep0 * Math.pow(1 - u, 1.12) + 10;
    const ang = theta0 + Math.PI * 2 * (0.9 * u + 1.9 * u * u * u);
    const reach = 1 + (1 - ease) * 1.9;
    const ox = Math.cos(ang) * sep * reach;
    const oy = Math.sin(ang) * sep * 0.62 * reach;
    state.x1 = cx + ox;
    state.y1 = cy + oy;
    state.x2 = cx - ox;
    state.y2 = cy - oy;
    const spin = (tMs / 1000) * (0.85 + u * 1.5);
    state.rot1 = spin;
    state.rot2 = -spin * 0.9 + 1.2;
    state.u = u;
  };

  // 远景星野
  for (let i = 0; i < 56; i += 1) {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height,
      shape: 'dot', size: api.range(0.6, 1.6), maxLife: 7.4,
      color: api.rng() > 0.72 ? '#a5b4fc' : '#e2e8f0', glow: 0.7,
      opacity: api.range(0.25, 0.7), twinkle: api.range(0.4, 1.3), fadeIn: 0.05, fadeOut: 0.1,
    });
  }

  // 旋臂骨架点（seed 抖动，onFrame 逐帧绘制双旋臂 + 核心辉光）
  const armPts: Array<{ f: number; jx: number; jy: number; s: number }> = [];
  for (let i = 0; i < 30; i += 1) {
    armPts.push({ f: (i + api.rng() * 0.8) / 30, jx: api.range(-7, 7), jy: api.range(-7, 7), s: api.range(1, 2.4) });
  }
  const drawGalaxy = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, rot: number, dir: number,
    alpha: number, scale: number, coreRgb: string, armRgb: string
  ) => {
    if (alpha <= 0.02) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 34 * scale);
    g.addColorStop(0, `rgba(248, 250, 252, ${0.85 * alpha})`);
    g.addColorStop(0.3, `rgba(${coreRgb}, ${0.55 * alpha})`);
    g.addColorStop(1, `rgba(${coreRgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 34 * scale, 0, Math.PI * 2);
    ctx.fill();
    for (const armBase of [0, Math.PI]) {
      for (const pt of armPts) {
        const r = (12 + pt.f * 130) * scale;
        const a = rot + armBase + pt.f * 2.7 * dir;
        ctx.globalAlpha = alpha * (1 - pt.f * 0.72) * 0.8;
        ctx.fillStyle = `rgba(${armRgb}, 0.9)`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r + pt.jx, y + Math.sin(a) * r * 0.62 + pt.jy, pt.s * (1.7 - pt.f), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  api.onFrame((tMs, _dt, ctx) => {
    orbit(tMs);
    const fadeAll = Math.min(1, Math.max(0, (7600 - tMs) / 650));
    if (tMs < MERGE_AT) {
      const appear = Math.min(1, tMs / 500);
      drawGalaxy(ctx, state.x1, state.y1, state.rot1, 1, appear * fadeAll, 1, '165, 180, 252', '199, 210, 254');
      drawGalaxy(ctx, state.x2, state.y2, state.rot2, -1, appear * fadeAll, 0.88, '240, 171, 252', '245, 208, 254');
    } else {
      // 并合后的单一新星系：缓旋、渐稳
      const born = Math.min(1, (tMs - MERGE_AT) / 700);
      drawGalaxy(ctx, cx, cy, (tMs / 1000) * 0.5, 1, born * fadeAll, 1.22, '196, 181, 253', '221, 214, 254');
    }
  });

  // 星点云：跟随各自星系旋臂公转
  const cloud = (which: 1 | 2) => {
    const f = api.rng();
    const r0 = 16 + f * 122;
    const dir = which === 1 ? 1 : -1;
    const offsetAngle = (api.rng() > 0.5 ? 0 : Math.PI) + f * 2.7 * dir;
    const jx = api.range(-10, 10);
    const jy = api.range(-8, 8);
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: api.range(0.8, 2), maxLife: api.range(1.6, 3),
      color: which === 1 ? api.pick(CLOUD_A) : api.pick(CLOUD_B),
      glow: 0.8, opacity: api.range(0.35, 0.85), twinkle: api.range(0.6, 2), fadeIn: 0.2, fadeOut: 0.3,
      update: (p) => {
        const gx = which === 1 ? state.x1 : state.x2;
        const gy = which === 1 ? state.y1 : state.y2;
        const rot = which === 1 ? state.rot1 : state.rot2;
        const a = rot + offsetAngle;
        p.x = gx + Math.cos(a) * r0 + jx;
        p.y = gy + Math.sin(a) * r0 * 0.62 + jy;
      },
    });
  };
  api.every(30, () => {
    cloud(1);
    cloud(2);
  }, { until: 5450 });

  // 潮汐星尾：臂端剥离出的两条 streak 星流
  api.every(36, () => {
    ([1, 2] as const).forEach((which) => {
      const gx = which === 1 ? state.x1 : state.x2;
      const gy = which === 1 ? state.y1 : state.y2;
      const rot = which === 1 ? state.rot1 : state.rot2;
      const dir = which === 1 ? 1 : -1;
      const tipA = rot + 2.7 * dir + api.range(-0.3, 0.3);
      const px = gx + Math.cos(tipA) * api.range(104, 132);
      const py = gy + Math.sin(tipA) * api.range(104, 132) * 0.62;
      const ox = which === 1 ? state.x2 : state.x1;
      const oy = which === 1 ? state.y2 : state.y1;
      const dx = px - ox;
      const dy = py - oy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = api.range(46, 110);
      api.spawn({
        x: px, y: py,
        vx: (dx / d) * sp + Math.cos(tipA + Math.PI / 2) * dir * 30,
        vy: (dy / d) * sp + Math.sin(tipA + Math.PI / 2) * dir * 30,
        shape: 'streak', stretch: 0.5, size: api.range(1, 1.7), maxLife: api.range(1, 1.8),
        color: which === 1 ? '#c7d2fe' : '#f5d0fe', glow: 0.7, opacity: 0.55,
        drag: 0.85, wander: 14, fadeIn: 0.12, fadeOut: 0.4,
      });
    });
  }, { from: 1700, until: 5500 });

  // 旋臂交错穿插：星暴蓝闪簇
  BURSTS.forEach((t) => {
    api.at(t, () => {
      const mx = (state.x1 + state.x2) / 2 + api.range(-40, 40);
      const my = (state.y1 + state.y2) / 2 + api.range(-30, 30);
      for (let i = 0; i < 3; i += 1) {
        const fx = mx + api.range(-52, 52);
        const fy = my + api.range(-38, 38);
        api.spawn({ x: fx, y: fy, shape: 'dot', size: 3, endSize: api.range(26, 46), maxLife: 0.4, color: '#dbeafe', glow: 1.8, fadeOut: 0.8 });
        api.burst({
          x: fx, y: fy, count: 10, speed: [40, 170],
          base: { shape: 'spark', size: 1.6, maxLife: 0.6, color: '#93c5fd', glow: 1.2, drag: 0.4, fadeOut: 0.5 },
          vary: (p, rng) => {
            if (rng() > 0.7) p.color = '#e0f2fe';
          },
        });
      }
    });
  });

  // 并合：白闪成单核 + 混色抛射 + 三重冲击环
  api.at(MERGE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 24, endSize: Math.max(api.width, api.height) * 1.05, maxLife: 0.8, color: '#f8fafc', glow: 2.4, fadeOut: 0.94 });
    api.burst({
      x: cx, y: cy, count: 118, speed: [180, 640],
      base: { shape: 'streak', stretch: 0.09, size: 2.2, maxLife: 1.2, glow: 1.15, drag: 0.4, fadeOut: 0.45 },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#a5b4fc' : '#f0abfc';
        p.maxLife = 0.7 + rng() * 0.8;
      },
    });
  });
  [0, 170, 360].forEach((delay, i) => {
    api.at(MERGE_AT + delay, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 28,
        endSize: Math.max(api.width, api.height) * (0.4 + i * 0.22),
        maxLife: 1.05, color: i === 1 ? '#f0abfc' : '#a5b4fc', opacity: 0.85, fadeOut: 0.75,
      });
    });
  });

  // 余韵：新星系尘埃驻留缓旋
  api.every(70, () => {
    const a = api.range(0, Math.PI * 2);
    const r = api.range(20, 150);
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.62,
      shape: 'dot', size: api.range(0.8, 1.8), maxLife: api.range(0.8, 1.5),
      color: api.pick(['#c7d2fe', '#f5d0fe', '#e2e8f0']),
      glow: 0.9, twinkle: 2, wander: 16, fadeOut: 0.5,
    });
  }, { from: MERGE_AT + 500, until: 7100 });
};
</script>

<template>
  <div class="galaxy-devour-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.galaxyDevour" :scene="scene" />
    <div class="gd-veil" />
    <div class="gd-badge">
      <Shell :size="38" />
      <strong>星系相吞 · 并合完成</strong>
      <small>GALACTIC DEVOUR // MERGER COMPLETE</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.galaxy-devour-effect {
  @include effect-stage(hidden);
}

.gd-veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(248, 250, 252, 0.95), rgba(199, 210, 254, 0.5) 46%, transparent 78%);
  opacity: 0;
  animation: gd-veil 7.6s ease-out both;
}

.gd-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #ddd6fe;
  text-shadow: 0 0 18px rgba(129, 140, 248, 0.65);
  transform: translateX(-50%);
  animation: gd-badge 7.6s ease both;
}

.gd-badge strong {
  font-size: 16px;
  letter-spacing: 0.12em;
}

.gd-badge small {
  color: rgba(221, 214, 254, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
}

@keyframes gd-veil {
  0%, 77.5% { opacity: 0; }
  80% { opacity: 0.9; }
  85% { opacity: 0; }
  100% { opacity: 0; }
}

@keyframes gd-badge {
  0%, 82% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  87%, 96% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
}
</style>
