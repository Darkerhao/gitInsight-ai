<script setup lang="ts">
import { BrainCircuit } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const duration = api.duration / 1000;

  // 生成神经网络拓扑：随机节点 + 每个节点连向最近的 2-3 个邻居
  const nodeCount = 22;
  const nodes = Array.from({ length: nodeCount }, () => ({
    x: api.range(api.width * 0.08, api.width * 0.92),
    y: api.range(api.height * 0.1, api.height * 0.88),
    charge: 0, // 被脉冲击中后的发光余量
  }));
  const edges: Array<[number, number]> = [];
  nodes.forEach((node, i) => {
    const others = nodes
      .map((other, j) => ({ j, dist: (other.x - node.x) ** 2 + (other.y - node.y) ** 2 }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2 + Math.floor(api.rng() * 2));
    for (const { j } of others) {
      if (!edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) {
        edges.push([i, j]);
      }
    }
  });

  // 底图：网络连线与节点呼吸辉光
  api.onFrame((tMs, dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 1) * Math.min(1, Math.max(0, (duration - t) / 0.9));
    if (envelope <= 0) return;
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.16 * envelope})`;
      ctx.beginPath();
      ctx.moveTo(nodes[a].x, nodes[a].y);
      ctx.lineTo(nodes[b].x, nodes[b].y);
      ctx.stroke();
    }
    for (const node of nodes) {
      node.charge = Math.max(0, node.charge - dt * 1.6);
      const radius = 3 + node.charge * 5;
      const alpha = (0.35 + node.charge * 0.65) * envelope;
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 4);
      gradient.addColorStop(0, `rgba(237, 233, 254, ${alpha})`);
      gradient.addColorStop(0.3, `rgba(167, 139, 250, ${alpha * 0.6})`);
      gradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 思考脉冲：光点沿边奔跑，抵达时点亮节点并可能级联
  function firePulse(edgeIndex: number, reverse: boolean, chained: number) {
    const [a, b] = edges[edgeIndex];
    const from = nodes[reverse ? b : a];
    const to = nodes[reverse ? a : b];
    const travel = api.range(0.32, 0.6);
    api.spawn({
      x: from.x,
      y: from.y,
      shape: 'spark',
      size: 2.6,
      maxLife: travel,
      color: chained > 0 ? '#f0abfc' : '#c4b5fd',
      glow: 1.4,
      fadeIn: 0.08,
      fadeOut: 0.1,
      update: (p) => {
        const progress = Math.min(1, p.life / travel);
        const ease = progress * progress * (3 - 2 * progress);
        p.x = from.x + (to.x - from.x) * ease;
        p.y = from.y + (to.y - from.y) * ease;
      },
      onDeath: () => {
        to.charge = Math.min(1.4, to.charge + 1);
        // 级联激活：从到达节点继续沿相邻边传播
        if (chained < 2 && api.rng() < 0.55) {
          const nextEdges = edges
            .map((edge, idx) => ({ edge, idx }))
            .filter(({ edge }) => edge[0] === (reverse ? a : b) || edge[1] === (reverse ? a : b));
          if (nextEdges.length > 0) {
            const next = nextEdges[Math.floor(api.rng() * nextEdges.length)];
            const startIsA = next.edge[0] === (reverse ? a : b);
            firePulse(next.idx, !startIsA, chained + 1);
          }
        }
      },
    });
  }

  api.every(130, () => {
    firePulse(Math.floor(api.rng() * edges.length), api.rng() < 0.5, 0);
  }, { from: 250, until: api.duration - 1000 });

  // 顿悟时刻：全网闪亮 + 中心紫色爆发
  api.at(api.duration - 1500, () => {
    for (const node of nodes) node.charge = 1.4;
    const cx = api.width / 2;
    const cy = api.height / 2;
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: 320, maxLife: 1, color: '#c4b5fd', opacity: 0.85 });
    api.burst({
      x: cx,
      y: cy,
      count: 50,
      speed: [80, 380],
      base: { shape: 'spark', size: 1.8, drag: 0.36, color: '#a78bfa', twinkle: 8, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 0.7 + rng() * 0.7;
        if (rng() < 0.3) p.color = '#f0abfc';
      },
    });
  });
};
</script>

<template>
  <div class="neural-think-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.neuralThink" :scene="scene" />
    <div class="neural-core">
      <BrainCircuit :size="56" />
      <strong>神经网络思考</strong>
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
  top: 50%;
  width: 176px;
  height: 176px;
  border: 1px solid rgba(196, 181, 253, 0.42);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(167, 139, 250, 0.22), rgba(2, 6, 23, 0.24) 62%, transparent);
  color: #ede9fe;
  display: grid;
  gap: 8px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: neural-core 5.2s ease both;
}

.neural-core strong {
  font-size: 15px;
}

@keyframes neural-core {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.72); filter: blur(8px); }
  20%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
  46% { transform: translate(-50%, -50%) scale(1.08); }
}
</style>
