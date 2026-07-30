<script setup lang="ts">
import { Atom } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const GHOST_HUES = [246, 252, 258, 264, 190];

/**
 * 量子隧穿 QUANTUM TUNNEL · 4800ms（entry 450 / loop 3600 / exit 750）
 * 三幕：核心光云聚拢 + 首簇隧穿 → 成对瞬现瞬灭（湮灭端/重现端）+ 电弧缠绕 → 五相位坍缩合一
 */
const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const cy = H * 0.48;
  const K = Math.min(W, H) / 460;
  const COLLAPSE_AT = api.duration - 750; // 4050ms
  const phasePts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    return { x: cx + Math.cos(a) * 128 * K, y: cy + Math.sin(a) * 128 * K * 0.82 };
  });

  // ── 原子核心：三条倾斜椭圆轨道 + 白热概率云（偶发量子抖动） ──
  const orbits = [
    { rx: 74 * K, tilt: 0.4, omega: 2.7, dir: 1 },
    { rx: 104 * K, tilt: -0.7, omega: 2.1, dir: -1 },
    { rx: 138 * K, tilt: 1.1, omega: 1.6, dir: 1 },
  ];
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const env = Math.min(1, t / 0.45) * Math.min(1, Math.max(0, (api.duration / 1000 - t) / 0.55));
    if (env <= 0) return;
    for (const o of orbits) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(o.tilt);
      ctx.scale(1, 0.36);
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.1 * env})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, o.rx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const jitter = api.rng() < 0.05 ? 0.3 : 0;
    const pulse = 1 + 0.13 * Math.sin(t * 4.8) + jitter;
    const r = 24 * K * pulse;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * env})`);
    grad.addColorStop(0.16, `rgba(196, 181, 253, ${0.55 * env})`);
    grad.addColorStop(0.5, `rgba(167, 139, 250, ${0.16 * env})`);
    grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  // 电子：白热头沿轨道参数化运行（中层一颗辅色点缀）
  orbits.forEach((o, oi) => {
    [0, Math.PI].forEach((offset, ei) => {
      api.spawn({
        x: cx, y: cy, shape: 'spark', size: 2.1, glow: 1.5,
        maxLife: (COLLAPSE_AT - 250) / 1000,
        color: oi === 1 && ei === 1 ? '#a5f3fc' : ei === 0 ? '#f5f3ff' : '#c4b5fd',
        fadeIn: 0.05, fadeOut: 0.06,
        update: (p) => {
          const a = offset + oi * 1.3 + p.life * o.omega * o.dir;
          const ex = Math.cos(a) * o.rx;
          const ey = Math.sin(a) * o.rx * 0.36;
          const cos = Math.cos(o.tilt);
          const sin = Math.sin(o.tilt);
          p.x = cx + ex * cos - ey * sin;
          p.y = cy + ex * sin + ey * cos;
        },
      });
    });
  });

  // ── 隧穿事件：成对「湮灭端 → 重现端」（近大远小的纵深缩放 + 位错闪痕） ──
  function tunnelPair(tAbs: number, forced?: { x: number; y: number }) {
    const ax = forced?.x ?? api.range(W * 0.16, W * 0.84);
    const ay = forced?.y ?? api.range(H * 0.16, H * 0.8);
    const dir = api.range(0, Math.PI * 2);
    const dist = api.range(90, 210);
    const bx = Math.min(W * 0.9, Math.max(W * 0.1, ax + Math.cos(dir) * dist));
    const by = Math.min(H * 0.86, Math.max(H * 0.12, ay + Math.sin(dir) * dist * 0.7));
    const sA = 0.6 + (ay / H) * 0.55;
    const sB = 0.6 + (by / H) * 0.55;
    // 湮灭端：内收环 + 吸入噼啪
    api.spawn({ x: ax, y: ay, shape: 'ring', size: 44 * sA, endSize: 3, maxLife: 0.28, color: '#a78bfa', opacity: 0.7, fadeOut: 0.4 });
    api.spawn({ x: ax, y: ay, shape: 'dot', size: 10 * sA, endSize: 1.5, maxLife: 0.22, color: '#ede9fe', glow: 1.6, fadeIn: 0, fadeOut: 0.7 });
    for (let i = 0; i < 6; i += 1) {
      const a = api.range(0, Math.PI * 2);
      const r0 = api.range(20, 34) * sA;
      api.spawn({
        x: ax + Math.cos(a) * r0, y: ay + Math.sin(a) * r0,
        vx: -Math.cos(a) * r0 * 5, vy: -Math.sin(a) * r0 * 5,
        shape: 'spark', size: 1.3 * sA, maxLife: 0.2, color: '#c4b5fd', glow: 1, fadeOut: 0.4,
      });
    }
    // 重现端：延迟 110ms 白闪 + 环 + 噼啪 + 沿 A→B 撕出的位错细线
    api.at(tAbs + 110, () => {
      api.spawn({ x: bx, y: by, shape: 'dot', size: 17 * sB, endSize: 2, maxLife: 0.26, color: '#f5f3ff', glow: 2, fadeIn: 0, fadeOut: 0.9 });
      api.spawn({ x: bx, y: by, shape: 'ring', size: 4, endSize: 62 * sB, maxLife: 0.48, color: '#a78bfa', opacity: 0.8, fadeOut: 0.6 });
      api.burst({
        x: bx, y: by, count: 13, speed: [30 * sB, 220 * sB],
        base: { shape: 'spark', size: 1.7 * sB, drag: 0.24, twinkle: 11, glow: 1.1 },
        vary: (p, rng) => {
          p.maxLife = 0.35 + rng() * 0.45;
          p.color = rng() < 0.22 ? '#67e8f9' : rng() < 0.55 ? '#c4b5fd' : '#e0e7ff';
        },
      });
      const len = Math.hypot(bx - ax, by - ay) || 1;
      api.spawn({
        x: ax, y: ay, vx: ((bx - ax) / len) * 1500, vy: ((by - ay) / len) * 1500,
        shape: 'streak', stretch: 0.07, size: 1.6, maxLife: len / 1500,
        color: '#e0e7ff', glow: 1.1, fadeIn: 0, fadeOut: 0.35,
      });
    });
  }

  // 首簇：核心附近三连隧穿爆点
  [120, 210, 300].forEach((when, i) => {
    api.at(when, () => {
      const a = api.range(0, Math.PI * 2);
      tunnelPair(when, { x: cx + Math.cos(a) * (70 + i * 30) * K, y: cy + Math.sin(a) * (60 + i * 24) * K });
    });
  });
  // 频率先快后慢（观测衰减）
  api.every(290, (i) => tunnelPair(520 + i * 290), { from: 520, until: 2300 });
  api.every(430, (i) => tunnelPair(2320 + i * 430), { from: 2320, until: 3700 });

  // 2400ms：退相干涌动 —— 四相位同时隧穿 + 中心白闪
  api.at(2400, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 2, maxLife: 0.24, color: '#ffffff', glow: 2, fadeIn: 0, fadeOut: 0.7 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 10, endSize: 170 * K, maxLife: 0.5, color: '#67e8f9', opacity: 0.5, fadeOut: 0.6 });
    for (let i = 0; i < 4; i += 1) tunnelPair(2400, phasePts[i]);
  });

  // ── 电弧：中心附近抖动折线缠绕，端点微噼啪 ──
  let sceneTime = 0;
  const arcs: Array<{ points: Array<[number, number]>; born: number; life: number; hue: number }> = [];
  const spawnArc = () => {
    const angleA = api.range(0, Math.PI * 2);
    const angleB = angleA + api.range(0.8, 2.4);
    const radiusA = api.range(60, 190) * K;
    const radiusB = api.range(60, 190) * K;
    const from: [number, number] = [cx + Math.cos(angleA) * radiusA, cy + Math.sin(angleA) * radiusA * 0.7];
    const to: [number, number] = [cx + Math.cos(angleB) * radiusB, cy + Math.sin(angleB) * radiusB * 0.7];
    const segments = 7;
    const points: Array<[number, number]> = [from];
    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      points.push([
        from[0] + (to[0] - from[0]) * t + api.range(-24, 24),
        from[1] + (to[1] - from[1]) * t + api.range(-24, 24),
      ]);
    }
    points.push(to);
    arcs.push({ points, born: sceneTime, life: 0.14 + api.rng() * 0.1, hue: api.range(248, 268) });
    for (const [ex, ey] of [from, to]) {
      api.spawn({ x: ex, y: ey, shape: 'spark', size: 1.4, maxLife: 0.2, color: '#e0e7ff', glow: 1, fadeOut: 0.5 });
    }
  };
  api.every(300, spawnArc, { from: 480, until: 3300 });
  api.every(170, spawnArc, { from: 3300, until: 3940 });
  api.onFrame((tMs, _dt, ctx) => {
    sceneTime = tMs / 1000;
    for (let i = arcs.length - 1; i >= 0; i -= 1) {
      const arc = arcs[i];
      const age = sceneTime - arc.born;
      if (age > arc.life) {
        arcs.splice(i, 1);
        continue;
      }
      const alpha = (1 - age / arc.life) * 0.85;
      ctx.strokeStyle = `hsla(${arc.hue}, 95%, 78%, ${alpha})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(arc.points[0][0], arc.points[0][1]);
      for (const [px, py] of arc.points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  });

  // 五重残影相位标记：步进巡回点亮
  api.every(400, (i) => {
    const pt = phasePts[i % 5];
    api.spawn({ x: pt.x, y: pt.y, shape: 'ring', size: 6, endSize: 28, maxLife: 0.36, color: i % 5 === 4 ? '#67e8f9' : '#a78bfa', opacity: 0.4, fadeOut: 0.5 });
  }, { from: 1300, until: 3560 });

  // ── 坍缩合一：五相位残光依次收束 → 白热合一闪 + 辅色回波 + 余尘 ──
  phasePts.forEach((pt, i) => {
    api.at(COLLAPSE_AT + i * 50, () => {
      const sx = pt.x;
      const sy = pt.y;
      const travel = 0.42;
      api.spawn({ x: sx, y: sy, shape: 'ring', size: 26, endSize: 4, maxLife: 0.28, color: '#a78bfa', opacity: 0.5, fadeOut: 0.4 });
      api.spawn({
        x: sx, y: sy, shape: 'spark', size: 3, glow: 1.6, maxLife: travel,
        color: i === 4 ? '#a5f3fc' : '#e9d5ff', fadeIn: 0.05, fadeOut: 0.1,
        update: (p) => {
          const k = Math.min(1, p.life / travel);
          const e = k * k * (3 - 2 * k);
          p.x = sx + (cx - sx) * e;
          p.y = sy + (cy - sy) * e;
        },
      });
    });
  });
  api.at(COLLAPSE_AT + 440, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 18, endSize: 3, maxLife: 0.14, color: '#ffffff', glow: 2.2, fadeIn: 0, fadeOut: 0.5 });
  });
  api.at(COLLAPSE_AT + 500, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 8, endSize: 180, maxLife: 0.35, color: '#f5f3ff', glow: 2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 12, endSize: 240, maxLife: 0.4, color: '#67e8f9', opacity: 0.55, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 24, speed: [60, 300],
      base: { shape: 'spark', size: 1.6, drag: 0.3, glow: 1.1, twinkle: 9 },
      vary: (p, rng) => {
        p.maxLife = 0.28 + rng() * 0.35;
        p.color = rng() < 0.3 ? '#67e8f9' : '#c4b5fd';
      },
    });
  });
  api.every(60, () => {
    api.spawn({
      x: cx + api.range(-70, 70), y: cy + api.range(-56, 56),
      vy: api.range(-24, -8), shape: 'dot', size: api.range(0.8, 1.5),
      maxLife: 0.3, color: '#c4b5fd', glow: 0.9, twinkle: 8, fadeOut: 0.6,
    });
  }, { from: COLLAPSE_AT + 540, until: api.duration - 160 });
};
</script>

<template>
  <div class="quantum-flicker-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.quantumFlicker" :scene="scene" />
    <div class="quantum-stack">
      <span
        v-for="ghost in 5"
        :key="ghost"
        class="quantum-ghost"
        :style="{
          '--ghost-x': `${(ghost - 3) * 24}px`,
          '--ghost-y': `${((ghost % 3) - 1) * 18}px`,
          '--ghost-hue': `${GHOST_HUES[ghost - 1]}`,
          animationDelay: `${ghost * 60}ms`,
        }"
      >
        <Atom :size="40" />
      </span>
      <strong>量子隧穿</strong>
      <small>QUANTUM TUNNEL · |ψ|² COLLAPSE</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.quantum-flicker-effect {
  @include effect-stage(hidden);
}

.quantum-stack {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 250px;
  height: 190px;
  display: grid;
  place-items: center;
  color: #ede9fe;
  transform: translate(-50%, -50%);
  animation: quantum-stack 4.8s ease both;
}

.quantum-stack strong {
  position: absolute;
  bottom: 22px;
  font-size: 16px;
  letter-spacing: 0.14em;
  text-shadow: 0 0 16px rgba(167, 139, 250, 0.6);
}

.quantum-stack small {
  position: absolute;
  bottom: 6px;
  color: rgba(196, 181, 253, 0.68);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.22em;
}

.quantum-ghost {
  position: absolute;
  width: 110px;
  height: 84px;
  border: 1px solid hsl(var(--ghost-hue), 92%, 72%, 0.4);
  border-radius: 12px;
  background:
    radial-gradient(circle at 50% 38%, hsl(var(--ghost-hue), 92%, 66%, 0.2), transparent 48%),
    rgba(2, 6, 23, 0.22);
  display: grid;
  place-items: center;
  color: hsl(var(--ghost-hue), 92%, 80%);
  opacity: 0;
  mix-blend-mode: screen;
  transform: translate(var(--ghost-x), var(--ghost-y)) scale(0.9);
  animation: quantum-ghost 4.8s steps(3, end) both;
}

@keyframes quantum-stack {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.84); filter: blur(9px); }
  12%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
  94% { opacity: 0.5; }
}

@keyframes quantum-ghost {
  0%, 8% { opacity: 0; transform: translate(var(--ghost-x), var(--ghost-y)) scale(0.9); }
  14%, 62% { opacity: 0.7; transform: translate(var(--ghost-x), var(--ghost-y)) scale(1); }
  78% { opacity: 0.55; transform: translate(var(--ghost-x), var(--ghost-y)) scale(0.97); }
  86% { opacity: 0.9; transform: translate(0, 0) scale(1.02); }
  92% { opacity: 1; transform: translate(0, 0) scale(0.6); }
  100% { opacity: 0; transform: translate(0, 0) scale(0.2); }
}
</style>
