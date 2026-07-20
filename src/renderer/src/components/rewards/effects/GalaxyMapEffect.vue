<script setup lang="ts">
import { Telescope } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const LINK_FROM = 1600;
const LOCK_AT = 4000;

const scene: SceneFn = (api) => {
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 幕一：星点从底部升起入场，按深度分层漂移
  for (let i = 0; i < 130; i += 1) {
    const depth = api.rng();
    api.spawn({
      x: api.rng() * api.width, y: api.height + api.rng() * 120,
      vy: -(40 + depth * 90), shape: 'dot',
      size: 0.8 + depth * 1.8, maxLife: 5.4,
      color: depth > 0.72 ? '#c7d2fe' : '#94a3b8', glow: 0.7 + depth * 0.5,
      opacity: 0.35 + depth * 0.5, twinkle: api.range(0.4, 1.6),
      drag: 0.22, wander: 8, fadeIn: 0.06, fadeOut: 0.16,
      update: (p) => {
        if (p.vy < -4) return;
        p.vy = 0;
      },
    });
  }

  // seed 生成 2-3 组星座（顶点 + 连线 + 代号）
  type Constellation = { pts: Array<{ x: number; y: number }>; code: string };
  const constellations: Constellation[] = [];
  const groups = 2 + Math.floor(api.rng() * 2);
  for (let g = 0; g < groups; g += 1) {
    const baseX = api.width * (0.2 + api.rng() * 0.6);
    const baseY = api.height * (0.2 + api.rng() * 0.42);
    const n = 4 + Math.floor(api.rng() * 3);
    const pts = Array.from({ length: n }, () => ({
      x: baseX + api.range(-130, 130),
      y: baseY + api.range(-95, 95),
    }));
    constellations.push({ pts, code: `NGC-${1000 + Math.floor(api.rng() * 9000)}` });
  }
  // 星座顶点用更亮的星
  constellations.forEach((c) => {
    c.pts.forEach((pt) => {
      api.spawn({
        x: pt.x, y: pt.y, shape: 'spark', size: 2.6, maxLife: 4.6,
        color: '#a5b4fc', glow: 1.3, twinkle: 1.2, fadeIn: 0.24, fadeOut: 0.18,
      });
    });
  });

  // 幕二：连线逐段生长
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < LINK_FROM) return;
    const fadeAll = Math.max(0, Math.min(1, (api.duration - 600 - tMs) / 500));
    if (fadeAll <= 0.02) return;
    ctx.lineWidth = 1.2;
    constellations.forEach((c, gi) => {
      const totalSegs = c.pts.length - 1;
      const progress = Math.min(totalSegs, ((tMs - LINK_FROM - gi * 260) / 420));
      if (progress <= 0) return;
      ctx.strokeStyle = `rgba(165, 180, 252, ${0.55 * fadeAll})`;
      ctx.beginPath();
      ctx.moveTo(c.pts[0].x, c.pts[0].y);
      const full = Math.floor(progress);
      for (let s = 1; s <= full && s <= totalSegs; s += 1) ctx.lineTo(c.pts[s].x, c.pts[s].y);
      if (full < totalSegs) {
        const frac = progress - full;
        const a = c.pts[full];
        const b = c.pts[full + 1];
        ctx.lineTo(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac);
      }
      ctx.stroke();
    });
  });
  constellations.forEach((c, gi) => {
    api.at(LINK_FROM + 500 + gi * 300, () => {
      api.spawn({
        x: c.pts[0].x + 16, y: c.pts[0].y - 18, shape: 'glyph', glyph: c.code,
        size: 11, maxLife: 2.8, color: 'rgba(199, 210, 254, 0.85)',
        font: '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.14, fadeOut: 0.24,
      });
    });
  });

  // 幕三：目标锁定 —— 随机顶点脉冲 + 三重锁定环 + 坐标
  api.at(LOCK_AT, () => {
    const c = constellations[Math.floor(api.rng() * constellations.length)];
    const target = c.pts[Math.floor(api.rng() * c.pts.length)];
    api.spawn({ x: target.x, y: target.y, shape: 'dot', size: 4, endSize: 30, maxLife: 0.8, color: '#e0e7ff', glow: 2, fadeOut: 0.7 });
    [0, 140, 300].forEach((delay, i) => {
      api.at(LOCK_AT + delay, () => {
        api.spawn({
          x: target.x, y: target.y, shape: 'ring', size: 10, endSize: 60 + i * 34,
          maxLife: 0.85, color: i === 1 ? '#22d3ee' : '#818cf8', opacity: 0.9, fadeOut: 0.6,
        });
      });
    });
    const ra = `RA ${Math.floor(api.rng() * 24)}h ${Math.floor(api.rng() * 60)}m`;
    const dec = `DEC ${api.rng() > 0.5 ? '+' : '-'}${Math.floor(api.rng() * 80)}°`;
    api.spawn({
      x: target.x, y: target.y + 40, shape: 'glyph', glyph: `${ra} · ${dec}`,
      size: 12, maxLife: 1.5, color: '#c7d2fe',
      font: '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fadeIn: 0.16, fadeOut: 0.3,
    });
  });
};
</script>

<template>
  <div class="galaxy-map-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.galaxyMap" :scene="scene" />
    <div class="gmap-frame">
      <Telescope :size="22" />
      <strong>DEEP SKY SURVEY</strong>
      <small>全息星图 · 采样 130 光点</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.galaxy-map-effect {
  @include effect-stage(hidden);
  animation: gmap-camera 5.6s ease both;
}

.gmap-frame {
  position: absolute;
  left: 7%;
  bottom: 10%;
  border-left: 2px solid rgba(129, 140, 248, 0.6);
  color: #c7d2fe;
  display: grid;
  gap: 4px;
  padding-left: 14px;
  animation: gmap-frame 5.6s ease both;
}

.gmap-frame strong {
  font-size: 13px;
  letter-spacing: 0.22em;
}

.gmap-frame small {
  color: rgba(199, 210, 254, 0.66);
  font-size: 11px;
}

@keyframes gmap-frame {
  0%, 16% { opacity: 0; transform: translateY(12px); }
  26%, 86% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; }
}

@keyframes gmap-camera {
  0% { opacity: 0; transform: scale(1.06) translateY(12px); }
  10% { opacity: 1; }
  40% { transform: scale(1) translateY(0); }
  92% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.03) translateY(-14px); }
}
</style>
