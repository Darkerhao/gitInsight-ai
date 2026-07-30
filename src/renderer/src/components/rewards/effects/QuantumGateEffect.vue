<script setup lang="ts">
import { Orbit } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 量子虫洞 WORMHOLE GATE · 5600ms（entry 600 / loop 4100 / exit 900）
 * 三幕：奇点光核 + 首圈波纹坠入 → 吸积螺旋（前后遮挡 + 色相偏移）+ 三次喷流对射 → 洞口收拢湮灭
 */
const scene: SceneFn = (api) => {
  api.setTrail(0.18);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const cy = H / 2;
  const squash = 0.42; // 洞口透视压扁比
  const horizonR = 30;
  const COLLAPSE_AT = 4700; // 洞口开始收拢（exit 900ms）

  // ── 远景星野：被引力缓慢牵引向洞口（纵深底噪） ──
  for (let i = 0; i < 40; i += 1) {
    const sx = api.rng() * W;
    const sy = api.rng() * H;
    const dx = cx - sx;
    const dy = cy - sy;
    const d = Math.hypot(dx, dy) || 1;
    api.spawn({
      x: sx, y: sy, vx: (dx / d) * api.range(4, 14), vy: (dy / d) * api.range(4, 14),
      shape: 'dot', size: api.range(0.6, 1.5), maxLife: 5.4,
      color: api.rng() > 0.75 ? '#a5b4fc' : '#e2e8f0', glow: 0.7,
      opacity: api.range(0.25, 0.6), twinkle: api.range(0.4, 1.2), fadeIn: 0.08, fadeOut: 0.15,
    });
  }

  // ── 吸积螺旋：越近越快，色相自紫向青偏移，背面粒子压暗（遮挡纵深），坠入白闪 ──
  const spawnInfall = (rNear?: number) => {
    let radius = api.range(rNear ?? 170, Math.min(W, H) * 0.52);
    let angle = api.range(0, Math.PI * 2);
    const angularSpeed = api.range(1.4, 2.4);
    const hue0 = api.range(248, 275);
    const baseSize = api.range(1.5, 2.9);
    let plunged = false;
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * squash,
      shape: 'spark', size: baseSize, maxLife: 2.4,
      color: `hsl(${Math.round(hue0)}, 92%, 68%)`,
      glow: 1.1, fadeIn: 0.1, fadeOut: 0.05,
      update: (p, dt) => {
        const pull = 1 + (300 - Math.min(radius, 300)) / 105;
        angle += angularSpeed * pull * dt;
        radius -= (34 + (300 - Math.min(radius, 300)) * 1.2) * dt;
        if (radius < horizonR * 0.42) {
          plunged = true;
          p.life = p.maxLife;
        }
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius * squash;
        const depth = 0.5 + 0.5 * Math.sin(angle); // 1=前景 0=背面
        p.opacity = 0.4 + 0.6 * depth;
        p.size = baseSize * (0.8 + 0.35 * depth);
        const shift = Math.max(0, 300 - radius);
        p.color = `hsl(${Math.round(hue0 - shift * 0.28)}, 92%, ${Math.round(64 + shift * 0.055)}%)`;
      },
      onDeath: (p) => {
        // 坠越视界：奇点边缘的白热吞噬闪点
        if (plunged) {
          api.spawn({ x: p.x, y: p.y, shape: 'dot', size: 2.6, endSize: 0.6, maxLife: 0.16, color: '#f8fafc', glow: 1.6, fadeIn: 0, fadeOut: 0.6 });
        }
      },
    });
  };
  api.every(15, () => spawnInfall(), { until: COLLAPSE_AT });
  // 3200ms：近日点涌动 —— 内圈进料短时加倍
  api.every(15, () => spawnInfall(120), { from: 3200, until: 3650 });
  api.at(3200, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 14, endSize: 40, maxLife: 0.4, color: '#e0e7ff', glow: 2, fadeOut: 0.8 });
  });

  // ── 奇点呼吸光核 + 光子环（洞口收拢时半径塌缩） ──
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (api.duration / 1000 - t) / 0.75));
    if (envelope <= 0) return;
    const shrink = tMs > COLLAPSE_AT ? Math.max(0.06, 1 - (tMs - COLLAPSE_AT) / 620) : 1;
    const pulse = (1 + 0.16 * Math.sin(t * 3.2)) * shrink;
    const coreRadius = 46 * pulse;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 3);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.85 * envelope})`);
    gradient.addColorStop(0.14, `rgba(165, 180, 252, ${0.5 * envelope})`);
    gradient.addColorStop(0.45, `rgba(129, 140, 248, ${0.16 * envelope})`);
    gradient.addColorStop(1, 'rgba(129, 140, 248, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius * 3, 0, Math.PI * 2);
    ctx.fill();
    // 光子环：白亮细缘 + 淡紫外晕（椭圆透视）
    ctx.translate(cx, cy);
    ctx.scale(1, squash);
    const ringR = horizonR * (1.15 + 0.05 * Math.sin(t * 5.1)) * shrink;
    ctx.strokeStyle = `rgba(165, 180, 252, ${0.35 * envelope})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, ringR + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(245, 243, 255, ${0.8 * envelope})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ── 引力波纹：透视椭圆环周期收缩坠入（onFrame 手绘保证压扁） ──
  const ripples: number[] = [];
  let now = 0;
  api.every(650, () => ripples.push(now), { from: 250, until: COLLAPSE_AT - 1150 });
  api.at(COLLAPSE_AT, () => ripples.push(now)); // 末圈波纹
  api.onFrame((tMs, _dt, ctx) => {
    now = tMs;
    const R0 = Math.min(W, H) * 0.46;
    ctx.translate(cx, cy);
    ctx.scale(1, squash);
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const k = (tMs - ripples[i]) / 1150;
      if (k >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      const ease = k * k * (3 - 2 * k);
      const r = R0 * (1 - ease) + 12;
      const alpha = Math.sin(Math.PI * Math.min(1, k)) * 0.5;
      ctx.strokeStyle = `rgba(165, 180, 252, ${alpha})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // ── 相对论喷流：三次垂直对射（白热芯束 + 青色鞘层 + 基部闪光） ──
  [1400, 2700, 3900].forEach((when) => {
    api.at(when, () => {
      api.spawn({ x: cx, y: cy, shape: 'dot', size: 10, endSize: 26, maxLife: 0.3, color: '#e0e7ff', glow: 2, fadeOut: 0.7 });
      [-Math.PI / 2, Math.PI / 2].forEach((dir) => {
        api.burst({
          x: cx, y: cy, count: 12, speed: [300, 700],
          angle: [dir - 0.09, dir + 0.09],
          base: { shape: 'streak', stretch: 0.09, size: 2.2, maxLife: 0.7, color: '#f5f3ff', glow: 1.3, drag: 0.55, fadeOut: 0.35 },
        });
        api.burst({
          x: cx, y: cy, count: 9, speed: [220, 520],
          angle: [dir - 0.2, dir + 0.2],
          base: { shape: 'streak', stretch: 0.07, size: 1.7, maxLife: 0.8, color: '#22d3ee', glow: 1.1, drag: 0.55, fadeOut: 0.4 },
        });
      });
    });
  });

  // ── 收拢湮灭：白热内爆 → 辅色回波环 → 残余量子尘归寂 ──
  api.at(4980, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 18, endSize: 2, maxLife: 0.2, color: '#ffffff', glow: 2.2, fadeIn: 0, fadeOut: 0.5 });
  });
  api.at(5060, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 6, endSize: 120, maxLife: 0.35, color: '#e0e7ff', glow: 1.8, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 10, endSize: 200, maxLife: 0.42, color: '#22d3ee', opacity: 0.5, fadeOut: 0.7 });
  });
  api.every(70, () => {
    api.spawn({
      x: cx + api.range(-90, 90), y: cy + api.range(-50, 50),
      vy: api.range(-18, -6), shape: 'dot', size: api.range(0.7, 1.4),
      maxLife: 0.32, color: api.rng() < 0.3 ? '#67e8f9' : '#c4b5fd',
      glow: 0.9, twinkle: 7, wander: 16, fadeOut: 0.6,
    });
  }, { from: 5080, until: api.duration - 160 });
};
</script>

<template>
  <div class="quantum-gate-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.quantumGate" :scene="scene" />
    <div class="gate-badge">
      <Orbit :size="40" />
      <strong>量子虫洞</strong>
      <small>WORMHOLE GATE · EINSTEIN–ROSEN LINK</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.quantum-gate-effect {
  @include effect-stage(hidden);
}

.gate-badge {
  position: absolute;
  left: 50%;
  bottom: 11%;
  color: #e0e7ff;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(129, 140, 248, 0.65);
  transform: translateX(-50%);
  animation: gate-badge 5.6s ease both;
}

.gate-badge svg {
  color: #a5b4fc;
  filter: drop-shadow(0 0 20px rgba(129, 140, 248, 0.7));
  animation: gate-orbit 5.6s linear both;
}

.gate-badge strong {
  font-size: 18px;
  letter-spacing: 0.16em;
}

.gate-badge small {
  color: rgba(165, 180, 252, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.22em;
}

@keyframes gate-badge {
  0%, 44% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  54%, 84% { opacity: 1; transform: translateX(-50%) translateY(0); }
  94%, 100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

@keyframes gate-orbit {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(220deg); }
}
</style>
