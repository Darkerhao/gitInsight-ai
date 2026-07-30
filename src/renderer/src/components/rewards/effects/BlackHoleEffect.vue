<script setup lang="ts">
import { Eclipse } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const DISK_COLORS = ['#fb923c', '#fdba74', '#f59e0b', '#fde68a'];
const LENS_COLOR = '#93c5fd';
const COLLAPSE_AT = 3350;
const BOUNCE_AT = 3620;

const scene: SceneFn = (api) => {
  api.setTrail(0.16);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const horizonR = 30;
  const tilt = api.range(0.32, 0.46);

  // 星野：远景星点缓慢被引力汲引，白洞反弹时短暂外推（时空回弹）
  for (let i = 0; i < 72; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot',
      size: api.range(0.7, 1.8),
      maxLife: 6,
      color: api.rng() > 0.7 ? LENS_COLOR : '#e2e8f0',
      glow: 0.8,
      opacity: api.range(0.3, 0.8),
      twinkle: api.range(0.4, 1.4),
      fadeIn: 0.06,
      fadeOut: 0.12,
      update: (p, dt) => {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.max(60, Math.hypot(dx, dy));
        const recoil = p.life > 3.62 && p.life < 4.2 ? -3.2 : 1;
        const pull = (860 / dist) * (0.4 + Math.min(1, p.life / 3)) * recoil;
        p.x += (dx / dist) * pull * dt;
        p.y += (dy / dist) * pull * dt;
      },
    });
  }

  // 幕一：吸积盘 —— 远侧压暗 / 近侧增亮的倾斜椭圆 + 多普勒热斑 + 旋转热流
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > COLLAPSE_AT + 120) return;
    const ramp = Math.min(1, tMs / 700) * Math.min(1, Math.max(0, (3450 - tMs) / 400));
    if (ramp <= 0.01) return;
    const surge = 1 + Math.max(0, (tMs - 2600) / 750) * 0.35; // 坍缩前的进食增亮
    ctx.translate(cx, cy);
    ctx.rotate(0.4);
    ctx.scale(1, tilt);
    for (let ring = 0; ring < 6; ring += 1) {
      const r = horizonR + 24 + ring * 20;
      const lw = 9 - ring * 1.2;
      const base = (0.3 - ring * 0.04) * ramp * surge;
      // 远侧（上半）压暗
      ctx.strokeStyle = `rgba(154, 78, 24, ${base * 0.55})`;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();
      // 近侧（下半）增亮
      ctx.strokeStyle = `rgba(251, 146, 60, ${base})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.04, Math.PI * 0.96);
      ctx.stroke();
      // 旋转热流弧：亮段绕行制造角速度感
      const spin = (tMs / 1000) * (2.5 - ring * 0.3) + ring * 1.7;
      ctx.strokeStyle = `rgba(253, 230, 138, ${base * 0.9})`;
      ctx.lineWidth = Math.max(1.4, lw * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, r, spin, spin + Math.PI * 0.5);
      ctx.stroke();
      // 多普勒热斑：左舷固定方位的白热增亮
      ctx.strokeStyle = `rgba(255, 247, 237, ${base * 0.7})`;
      ctx.lineWidth = Math.max(1.2, lw * 0.42);
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.86, Math.PI * 1.14);
      ctx.stroke();
    }
  });

  // 光子环：1.4s 起在视界外缘驻留发亮，坍缩瞬间骤亮，闪爆后消失
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 1400 || tMs > BOUNCE_AT) return;
    let alpha = Math.min(1, (tMs - 1400) / 800) * 0.4;
    if (tMs > COLLAPSE_AT) alpha *= 1 + ((tMs - COLLAPSE_AT) / (BOUNCE_AT - COLLAPSE_AT)) * 1.1;
    ctx.strokeStyle = `rgba(254, 243, 199, ${alpha})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, horizonR + 9, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 幕一：外围星光被引力拉成螺旋坠入（角速度随半径缩小暴增）
  api.every(16, () => {
    let radius = api.range(180, Math.max(api.width, api.height) * 0.52);
    let angle = api.range(0, Math.PI * 2);
    const spinDir = api.rng() > 0.14 ? 1 : -1;
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * (0.62 + tilt),
      shape: 'spark',
      size: api.range(1.3, 2.6),
      maxLife: 2.6,
      color: api.pick(DISK_COLORS),
      glow: 1.1,
      fadeIn: 0.14,
      fadeOut: 0.05,
      update: (p, dt) => {
        const pull = 1 + Math.max(0, 320 - radius) / 60;
        angle += spinDir * api.range(1.5, 1.9) * pull * dt;
        radius -= (radius * 1.15 + 46) * dt;
        if (radius < horizonR - 4) p.life = p.maxLife;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius * (0.62 + tilt);
      },
    });
  }, { until: 3000 });

  // 潮汐撕裂丝：近盘白热流光被拉成弧形长尾（意大利面化）
  api.every(140, () => {
    let radius = api.range(90, 170);
    let angle = api.range(0, Math.PI * 2);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * (0.62 + tilt),
      shape: 'streak', stretch: 0.08, size: 1.7, maxLife: 1.1,
      color: api.rng() > 0.4 ? '#fef3c7' : '#fff7ed', glow: 1.2, fadeIn: 0.12, fadeOut: 0.2,
      update: (p, dt) => {
        const pull = 1 + Math.max(0, 260 - radius) / 46;
        angle += 2.6 * pull * dt;
        radius -= (radius * 0.7 + 30) * dt;
        if (radius < horizonR - 2) p.life = p.maxLife;
        const nx = cx + Math.cos(angle) * radius;
        const ny = cy + Math.sin(angle) * radius * (0.62 + tilt);
        p.vx = (nx - p.x) / Math.max(0.001, dt);
        p.vy = (ny - p.y) / Math.max(0.001, dt);
        p.x = nx;
        p.y = ny;
      },
    });
  }, { from: 900, until: 2900 });

  // 幕二：光子环驻留 → 视界收缩，画面静默半拍
  api.at(2200, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: horizonR + 7, endSize: horizonR + 9,
      maxLife: 1.15, color: '#fef3c7', opacity: 0.95, fadeIn: 0.16, fadeOut: 0.3,
    });
  });
  api.at(COLLAPSE_AT, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 130, endSize: horizonR - 6,
      maxLife: 0.3, color: '#e2e8f0', opacity: 0.7, fadeIn: 0.06, fadeOut: 0.3,
    });
  });
  // 静默中的最后一点收缩白芯
  api.at(3560, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 9, endSize: 2, maxLife: 0.24, color: '#f8fafc', glow: 1.6, fadeOut: 0.5 });
  });

  // 幕三：白洞反弹 —— 闪爆 + 上下相对论喷流 + 三重冲击环 + 引力透镜涟漪
  api.at(BOUNCE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 14, endSize: 330, maxLife: 0.66, color: '#fffbeb', glow: 2.4, fadeOut: 0.9 });
    [-Math.PI / 2, Math.PI / 2].forEach((dir) => {
      api.burst({
        x: cx, y: cy, count: 84, speed: [260, 780],
        angle: [dir - 0.15, dir + 0.15],
        base: {
          shape: 'streak', stretch: 0.09, size: 2.2, maxLife: 1.3,
          color: '#fde68a', glow: 1.2, drag: 0.5, fadeOut: 0.4,
        },
        vary: (p, rng) => {
          if (rng() > 0.62) p.color = LENS_COLOR;
          if (rng() > 0.9) p.color = '#fffbeb';
          p.maxLife = 0.8 + rng() * 0.9;
        },
      });
    });
  });
  [0, 170, 360].forEach((delay, i) => {
    api.at(BOUNCE_AT + delay, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 26,
        endSize: Math.max(api.width, api.height) * (0.42 + i * 0.2),
        maxLife: 1.05, color: i === 1 ? LENS_COLOR : '#fdba74', opacity: 0.85 - i * 0.14, fadeOut: 0.75,
      });
    });
  });
  // 透镜涟漪回波：蓝色低亮双环滞后扩散
  api.at(BOUNCE_AT + 330, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 60, endSize: Math.max(api.width, api.height) * 0.36, maxLife: 0.9, color: LENS_COLOR, opacity: 0.3, fadeOut: 0.8 });
  });

  // 喷流残柱：反弹后 0.8s 内上下光柱渐熄
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BOUNCE_AT || tMs > BOUNCE_AT + 800) return;
    const k = (tMs - BOUNCE_AT) / 800;
    const alpha = Math.sin((1 - k) * Math.PI * 0.5) * 0.55;
    const w = 20 * (1 - k) + 5;
    [-1, 1].forEach((dir) => {
      const g = ctx.createLinearGradient(cx, cy, cx, cy + dir * api.height * 0.52);
      g.addColorStop(0, `rgba(255, 251, 235, ${alpha})`);
      g.addColorStop(0.5, `rgba(253, 230, 138, ${alpha * 0.5})`);
      g.addColorStop(1, 'rgba(147, 197, 253, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - w / 2, dir > 0 ? cy : cy - api.height * 0.52, w, api.height * 0.52);
    });
  });

  // 余烬缓散 + 终章一记透镜回波
  api.every(70, () => {
    api.spawn({
      x: cx + api.range(-170, 170), y: cy + api.range(-130, 130),
      shape: 'dot', size: api.range(1, 2), maxLife: api.range(0.9, 1.6),
      color: api.pick(DISK_COLORS), glow: 1, wander: 34, twinkle: 2.2, fadeOut: 0.5,
    });
  }, { from: 4100, until: 5300 });
  api.at(5050, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: 220, maxLife: 0.8, color: LENS_COLOR, opacity: 0.22, fadeOut: 0.85 });
  });
};
</script>

<template>
  <div class="black-hole-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.blackHole" :scene="scene" />
    <div class="bh-core">
      <Eclipse :size="38" />
      <strong>EVENT HORIZON</strong>
      <small>奇点坍缩 · 视界半径 30″</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.black-hole-effect {
  @include effect-stage(hidden);
  animation: bh-camera 6s cubic-bezier(0.33, 0, 0.2, 1) both;
}

.bh-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background: radial-gradient(circle, #000 0 44%, rgba(2, 6, 23, 0.92) 62%, transparent 74%);
  box-shadow: 0 0 44px rgba(251, 146, 60, 0.4), inset 0 0 26px rgba(0, 0, 0, 0.9);
  color: #fed7aa;
  display: grid;
  gap: 6px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: bh-core 6s cubic-bezier(0.4, 0, 0.3, 1) both;
}

.bh-core strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
}

.bh-core small {
  color: rgba(254, 215, 170, 0.6);
  font-size: 9px;
  letter-spacing: 0.14em;
}

@keyframes bh-core {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  14%, 54% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  59% { opacity: 1; transform: translate(-50%, -50%) scale(0.55); }
  61% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.7); }
  65%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.3); }
}

@keyframes bh-camera {
  0% { transform: scale(1.13); }
  22% { transform: scale(1.05); }
  40% { transform: scale(1.01); }
  50% { transform: scale(1.02); filter: blur(0); }
  56% { transform: scale(0.985); filter: blur(0.6px); }
  60% { transform: scale(0.93); filter: blur(2.2px); }
  63.5% { transform: scale(1.055); filter: blur(0.3px); }
  70% { transform: scale(1.015); filter: blur(0); }
  86% { transform: scale(1.05); }
  100% { opacity: 0; transform: scale(1.1); }
}
</style>
