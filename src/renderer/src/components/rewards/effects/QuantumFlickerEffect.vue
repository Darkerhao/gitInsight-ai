<script setup lang="ts">
import { Atom } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneApi, SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

// 量子隧穿：粒子团在随机位置瞬现瞬灭，伴随电弧与位错闪痕
function teleportPop(api: SceneApi) {
  const x = api.range(api.width * 0.16, api.width * 0.84);
  const y = api.range(api.height * 0.16, api.height * 0.8);
  const hue = api.range(230, 300);
  const color = `hsl(${Math.round(hue)}, 92%, 74%)`;

  api.spawn({ x, y, shape: 'dot', size: 20, endSize: 2, maxLife: 0.26, color: '#f5f3ff', glow: 2, fadeIn: 0, fadeOut: 0.9 });
  api.spawn({ x, y, shape: 'ring', size: 4, endSize: 66, maxLife: 0.5, color, opacity: 0.85 });
  api.burst({
    x,
    y,
    count: 20,
    speed: [30, 240],
    base: { shape: 'spark', size: 1.8, drag: 0.24, color, twinkle: 12, glow: 1.1 },
    vary: (p, rng) => {
      p.maxLife = 0.4 + rng() * 0.5;
      if (rng() < 0.3) p.color = '#e0e7ff';
    },
  });
  // 水平位错闪痕（glitch 划线）
  if (api.rng() < 0.7) {
    api.spawn({
      x: x + api.range(-40, 40),
      y: y + api.range(-30, 30),
      vx: api.range(600, 1300) * (api.rng() < 0.5 ? -1 : 1),
      shape: 'streak',
      stretch: 0.06,
      size: api.range(1.4, 2.6),
      maxLife: 0.24,
      color: '#c4b5fd',
      glow: 1.2,
      fadeIn: 0,
      fadeOut: 0.5,
    });
  }
}

const scene: SceneFn = (api) => {
  api.setTrail(0.34);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 电弧：中心附近点对之间的抖动折线
  let sceneTime = 0;
  const arcs: Array<{ points: Array<[number, number]>; born: number; life: number; hue: number }> = [];
  api.every(300, () => {
    const angleA = api.range(0, Math.PI * 2);
    const angleB = angleA + api.range(0.8, 2.4);
    const radiusA = api.range(70, 210);
    const radiusB = api.range(70, 210);
    const from: [number, number] = [cx + Math.cos(angleA) * radiusA, cy + Math.sin(angleA) * radiusA * 0.7];
    const to: [number, number] = [cx + Math.cos(angleB) * radiusB, cy + Math.sin(angleB) * radiusB * 0.7];
    const segments = 7;
    const points: Array<[number, number]> = [from];
    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      points.push([
        from[0] + (to[0] - from[0]) * t + api.range(-26, 26),
        from[1] + (to[1] - from[1]) * t + api.range(-26, 26),
      ]);
    }
    points.push(to);
    arcs.push({ points, born: sceneTime, life: 0.16 + api.rng() * 0.1, hue: api.range(240, 290) });
  }, { from: 400, until: api.duration - 1100 });

  api.onFrame((tMs, _dt, ctx) => {
    sceneTime = tMs / 1000;
    for (let i = arcs.length - 1; i >= 0; i -= 1) {
      const arc = arcs[i];
      const age = sceneTime - arc.born;
      if (age > arc.life) {
        arcs.splice(i, 1);
        continue;
      }
      const alpha = (1 - age / arc.life) * 0.9;
      ctx.strokeStyle = `hsla(${arc.hue}, 95%, 78%, ${alpha})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(arc.points[0][0], arc.points[0][1]);
      for (const [px, py] of arc.points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  });

  // 瞬现粒子团：频率先快后慢
  api.every(200, () => teleportPop(api), { from: 100, until: 1900 });
  api.every(340, () => teleportPop(api), { from: 1900, until: api.duration - 1000 });

  // 中心原子核心：亮点云环绕
  api.every(50, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(36, 90);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.72,
      shape: 'dot',
      size: api.range(1, 2),
      maxLife: api.range(0.5, 1),
      color: '#c4b5fd',
      twinkle: 14,
      glow: 1,
    });
  }, { until: api.duration - 900 });
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
          '--ghost-x': `${(ghost - 3) * 20}px`,
          '--ghost-y': `${((ghost % 3) - 1) * 16}px`,
          '--ghost-hue': `${220 + ghost * 22}`,
          animationDelay: `${ghost * 70}ms`,
        }"
      >
        <Atom :size="42" />
      </span>
      <strong>量子闪烁</strong>
    </div>
  </div>
</template>

<style scoped>
.quantum-flicker-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.quantum-stack {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 240px;
  height: 170px;
  display: grid;
  place-items: center;
  color: #ede9fe;
  transform: translate(-50%, -50%);
  animation: quantum-stack 4.8s ease both;
}

.quantum-stack strong {
  position: absolute;
  bottom: 18px;
  font-size: 16px;
}

.quantum-ghost {
  position: absolute;
  width: 116px;
  height: 88px;
  border: 1px solid hsl(var(--ghost-hue), 92%, 72%, 0.42);
  border-radius: 12px;
  background:
    radial-gradient(circle at 50% 38%, hsl(var(--ghost-hue), 92%, 66%, 0.22), transparent 48%),
    rgba(2, 6, 23, 0.22);
  display: grid;
  place-items: center;
  color: hsl(var(--ghost-hue), 92%, 78%);
  opacity: 0;
  mix-blend-mode: screen;
  transform: translate(var(--ghost-x), var(--ghost-y)) scale(0.92);
  animation: quantum-ghost 4.2s steps(2, end) both;
}

@keyframes quantum-stack {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); filter: blur(10px); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
}

@keyframes quantum-ghost {
  0% { opacity: 0; transform: translate(var(--ghost-x), var(--ghost-y)) scale(0.92); }
  18%, 58% { opacity: 0.72; transform: translate(var(--ghost-x), var(--ghost-y)) scale(1); }
  72% { opacity: 1; transform: translate(0, 0) scale(1.04); }
  100% { opacity: 0; transform: translate(0, 0) scale(0.92); }
}
</style>
