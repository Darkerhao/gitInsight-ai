<script setup lang="ts">
import { BrainCircuit } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

interface NeuralNode {
  x: number;
  y: number;
  charge: number;
  born: number;
  deg: number;
}

/**
 * 突触风暴 SYNAPSE STORM · 5200ms（entry 600 / loop 3750 / exit 850）
 * 三幕：拓扑显影（近/远双层）→ 思考脉冲级联加密 + 枢纽齐发 → 收束顿悟全网齐亮
 */
const scene: SceneFn = (api) => {
  api.setTrail(0.22);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const cy = H * 0.46;
  const INSIGHT_AT = api.duration - 850; // 4350ms 顿悟时刻

  // ── 拓扑生成：近/远双层神经网络（远层压暗缩小 + 视差漂移 → 纵深） ──
  const makeLayer = (count: number, inset: number, yTop: number, yBottom: number): NeuralNode[] =>
    Array.from({ length: count }, () => ({
      x: api.range(W * inset, W * (1 - inset)),
      y: api.range(H * yTop, H * yBottom),
      charge: 0,
      born: api.range(0.06, 0.56),
      deg: 0,
    }));
  const near = makeLayer(22, 0.08, 0.1, 0.86);
  const far = makeLayer(13, 0.14, 0.07, 0.66);

  const linkLayer = (nodes: NeuralNode[], extra: number): Array<[number, number]> => {
    const edges: Array<[number, number]> = [];
    nodes.forEach((node, i) => {
      const targets = nodes
        .map((other, j) => ({ j, dist: (other.x - node.x) ** 2 + (other.y - node.y) ** 2 }))
        .filter(({ j }) => j !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2 + Math.floor(api.rng() * extra));
      for (const { j } of targets) {
        if (!edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) edges.push([i, j]);
      }
    });
    for (const [a, b] of edges) {
      nodes[a].deg += 1;
      nodes[b].deg += 1;
    }
    return edges;
  };
  const nearEdges = linkLayer(near, 2);
  const farEdges = linkLayer(far, 1);
  const hub = near.reduce((best, node, i) => (node.deg > near[best].deg ? i : best), 0);

  // ── 底图：双层网络显影（边沿出生时刻生长），节点充能呼吸辉光 ──
  api.onFrame((tMs, dt, ctx) => {
    const t = tMs / 1000;
    const env = Math.min(1, t / 0.55) * Math.min(1, Math.max(0, (api.duration / 1000 - t) / 0.7));
    if (env <= 0) return;
    const drift = Math.sin(t * 0.5) * 6; // 远层缓慢视差

    const drawLayer = (
      nodes: NeuralNode[],
      edges: Array<[number, number]>,
      dx: number,
      lineAlpha: number,
      glowScale: number,
      tint: [string, string]
    ) => {
      ctx.lineWidth = 1;
      for (const [a, b] of edges) {
        const grow = Math.min(1, Math.max(0, (t - Math.max(nodes[a].born, nodes[b].born)) / 0.5));
        if (grow <= 0) continue;
        const lit = Math.min(0.5, (nodes[a].charge + nodes[b].charge) * 0.2);
        ctx.strokeStyle = `rgba(167, 139, 250, ${(lineAlpha + lit) * env})`;
        ctx.beginPath();
        ctx.moveTo(nodes[a].x + dx, nodes[a].y);
        ctx.lineTo(
          nodes[a].x + dx + (nodes[b].x - nodes[a].x) * grow,
          nodes[a].y + (nodes[b].y - nodes[a].y) * grow
        );
        ctx.stroke();
      }
      for (const node of nodes) {
        node.charge = Math.max(0, node.charge - dt * 1.5);
        const reveal = Math.min(1, Math.max(0, (t - node.born) / 0.4));
        if (reveal <= 0) continue;
        const breath = 1 + 0.18 * Math.sin(t * 2.4 + node.born * 40);
        const radius = (2.4 + node.deg * 0.35 + node.charge * 5) * glowScale * breath;
        const alpha = (0.3 + node.charge * 0.7) * env * reveal;
        const gradient = ctx.createRadialGradient(node.x + dx, node.y, 0, node.x + dx, node.y, radius * 4);
        gradient.addColorStop(0, `rgba(${tint[0]}, ${alpha})`);
        gradient.addColorStop(0.3, `rgba(${tint[1]}, ${alpha * 0.55})`);
        gradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x + dx, node.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawLayer(far, farEdges, drift, 0.06, 0.62, ['196, 181, 253', '109, 90, 205']);
    drawLayer(near, nearEdges, 0, 0.15, 1, ['237, 233, 254', '167, 139, 250']);
  });

  // ── 思考脉冲：白热头沿边奔跑，级联加深换色（主色 → 辅色顿悟径），命中回波 ──
  const PULSE_TINTS = ['#ede9fe', '#c4b5fd', '#67e8f9'];
  function firePulse(edgeIndex: number, reverse: boolean, chained: number) {
    const [a, b] = nearEdges[edgeIndex];
    const from = near[reverse ? b : a];
    const to = near[reverse ? a : b];
    const toIndex = reverse ? a : b;
    const travel = api.range(0.3, 0.55);
    api.spawn({
      x: from.x,
      y: from.y,
      shape: 'spark',
      size: 2.9 - chained * 0.4,
      maxLife: travel,
      color: PULSE_TINTS[Math.min(chained, 2)],
      glow: 1.6,
      fadeIn: 0.06,
      fadeOut: 0.08,
      update: (p) => {
        const k = Math.min(1, p.life / travel);
        const ease = k * k * (3 - 2 * k);
        p.x = from.x + (to.x - from.x) * ease;
        p.y = from.y + (to.y - from.y) * ease;
      },
      onDeath: () => {
        to.charge = Math.min(1.5, to.charge + 0.9 + chained * 0.2);
        // 命中回波：级联抵达荡开微环 + 二次噼啪
        if (chained > 0) {
          api.spawn({
            x: to.x, y: to.y, shape: 'ring', size: 3, endSize: 24 + chained * 10,
            maxLife: 0.4, color: chained > 1 ? '#67e8f9' : '#c4b5fd', opacity: 0.55, fadeOut: 0.5,
          });
        }
        api.burst({
          x: to.x, y: to.y, count: 3, speed: [16, 70],
          base: { shape: 'spark', size: 1.2, maxLife: 0.3, color: '#a78bfa', glow: 1, drag: 0.3, fadeOut: 0.5 },
        });
        if (chained < 3 && api.rng() < 0.6) {
          const nextEdges = nearEdges
            .map((edge, idx) => ({ edge, idx }))
            .filter(({ edge, idx }) => idx !== edgeIndex && (edge[0] === toIndex || edge[1] === toIndex));
          if (nextEdges.length > 0) {
            const nextPick = nextEdges[Math.floor(api.rng() * nextEdges.length)];
            firePulse(nextPick.idx, nextPick.edge[1] === toIndex, chained + 1);
          }
        }
      },
    });
  }

  // 节拍：首簇三连发 → 三段变速加密（思绪逐渐沸腾）
  api.at(650, () => {
    for (let i = 0; i < 3; i += 1) firePulse(Math.floor(api.rng() * nearEdges.length), api.rng() < 0.5, 0);
  });
  api.every(320, () => firePulse(Math.floor(api.rng() * nearEdges.length), api.rng() < 0.5, 0), { from: 760, until: 1700 });
  api.every(180, () => firePulse(Math.floor(api.rng() * nearEdges.length), api.rng() < 0.5, 0), { from: 1700, until: 2900 });
  api.every(115, () => firePulse(Math.floor(api.rng() * nearEdges.length), api.rng() < 0.5, 0), { from: 2900, until: 3880 });

  // 2350ms：意识聚焦 —— 枢纽节点全边齐发
  api.at(2350, () => {
    const center = near[hub];
    center.charge = 1.4;
    api.spawn({ x: center.x, y: center.y, shape: 'ring', size: 6, endSize: 72, maxLife: 0.55, color: '#c4b5fd', opacity: 0.7, fadeOut: 0.55 });
    nearEdges.forEach((edge, idx) => {
      if (edge[0] === hub) firePulse(idx, false, 1);
      else if (edge[1] === hub) firePulse(idx, true, 1);
    });
  });

  // 3950ms：顿悟前奏 —— 收缩环 + 全网能量向中心收束
  api.at(3950, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: Math.min(W, H) * 0.42, endSize: 18,
      maxLife: 0.42, color: '#a5b4fc', opacity: 0.5, fadeIn: 0.1, fadeOut: 0.3,
    });
    for (const node of near) {
      const dx = cx - node.x;
      const dy = cy - node.y;
      const dist = Math.hypot(dx, dy) || 1;
      api.spawn({
        x: node.x, y: node.y, vx: (dx / dist) * dist * 2.6, vy: (dy / dist) * dist * 2.6,
        shape: 'streak', stretch: 0.06, size: 1.6, maxLife: 0.38,
        color: '#c4b5fd', glow: 1, fadeIn: 0.08, fadeOut: 0.25,
      });
    }
  });

  // 4350ms：顿悟 —— 白热闪心 + 主色环 + 辅色回波环 + 顿悟符号升起
  api.at(INSIGHT_AT, () => {
    for (const node of near) node.charge = 1.5;
    for (const node of far) node.charge = 1.1;
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 300, maxLife: 0.6, color: '#f5f3ff', glow: 2.2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: Math.max(W, H) * 0.5, maxLife: 0.9, color: '#a78bfa', opacity: 0.85, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 46, speed: [90, 380],
      base: { shape: 'spark', size: 1.9, drag: 0.34, glow: 1.2, twinkle: 7 },
      vary: (p, rng) => {
        p.color = rng() < 0.28 ? '#67e8f9' : rng() < 0.6 ? '#a78bfa' : '#ede9fe';
        p.maxLife = 0.6 + rng() * 0.7;
      },
    });
    ['Σ', 'Δ', 'ψ', 'λ', '∇'].forEach((glyph, i) => {
      api.spawn({
        x: cx + (i - 2) * 34 + api.range(-8, 8), y: cy + api.range(-6, 10),
        vy: api.range(-46, -26), vx: api.range(-8, 8),
        shape: 'glyph', glyph, size: api.range(13, 18), maxLife: api.range(0.9, 1.3),
        color: i % 2 === 0 ? '#e9d5ff' : '#a5f3fc', drag: 0.6, twinkle: 3, fadeIn: 0.14, fadeOut: 0.4,
      });
    });
  });
  api.at(INSIGHT_AT + 150, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 20, endSize: Math.max(W, H) * 0.62,
      maxLife: 0.8, color: '#22d3ee', opacity: 0.45, fadeOut: 0.75,
    });
  });

  // 余韵：突触余尘自节点升腾闪灭
  api.every(90, () => {
    const node = near[Math.floor(api.rng() * near.length)];
    api.spawn({
      x: node.x + api.range(-6, 6), y: node.y + api.range(-6, 6),
      vy: api.range(-30, -12), shape: 'dot', size: api.range(0.8, 1.6),
      maxLife: api.range(0.4, 0.7), color: api.rng() < 0.25 ? '#67e8f9' : '#c4b5fd',
      glow: 0.9, wander: 22, twinkle: 4, fadeOut: 0.5,
    });
  }, { from: INSIGHT_AT + 180, until: api.duration - 320 });
};
</script>

<template>
  <div class="neural-think-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.neuralThink" :scene="scene" />
    <div class="neural-core">
      <BrainCircuit :size="40" />
      <strong>突触风暴</strong>
      <small>SYNAPSE STORM · CASCADE DEPTH 03</small>
      <span class="neural-status">INSIGHT CONFIRMED</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.neural-think-effect {
  @include effect-stage(hidden);
}

.neural-core {
  position: absolute;
  left: 50%;
  bottom: 10%;
  color: #ede9fe;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(167, 139, 250, 0.6);
  transform: translateX(-50%);
  animation: neural-core 5.2s ease both;
}

.neural-core svg {
  color: #c4b5fd;
  filter: drop-shadow(0 0 14px rgba(167, 139, 250, 0.7));
}

.neural-core strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.neural-core small {
  color: rgba(196, 181, 253, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.24em;
}

.neural-status {
  margin-top: 2px;
  border: 1px solid rgba(103, 232, 249, 0.4);
  border-radius: 5px;
  background: rgba(8, 51, 68, 0.42);
  color: #a5f3fc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  padding: 3px 10px;
  animation: neural-status 5.2s step-end both;
}

@keyframes neural-core {
  0%, 42% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  52%, 88% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes neural-status {
  0%, 83% { opacity: 0; }
  84%, 86% { opacity: 1; }
  87% { opacity: 0.3; }
  88%, 96% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
