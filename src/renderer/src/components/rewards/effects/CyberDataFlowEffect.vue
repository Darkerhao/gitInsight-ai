<script setup lang="ts">
import { CircuitBoard } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const PACKET_COLORS = ['#22d3ee', '#f472b6', '#7dd3fc', '#e879f9'];
const FLOW_GLYPHS = ['01', 'AI', 'OK', 'PR', 'Σ', '↯'];

const scene: SceneFn = (api) => {
  api.setTrail(0.11); // 霓虹长尾：数据包身后拖出电路光轨

  // 电路数据包：轴向直行 + 随机 90° 转向，走出印刷电路的曼哈顿路径
  api.every(46, () => {
    const speed = api.range(260, 520);
    const startOnVertical = api.rng() < 0.5;
    let dirX = startOnVertical ? 0 : (api.rng() < 0.5 ? 1 : -1);
    let dirY = startOnVertical ? (api.rng() < 0.5 ? 1 : -1) : 0;
    let untilTurn = api.range(0.2, 0.6);
    api.spawn({
      x: api.range(api.width * 0.06, api.width * 0.94),
      y: api.range(api.height * 0.06, api.height * 0.94),
      vx: dirX * speed,
      vy: dirY * speed,
      shape: 'spark',
      size: api.range(1.8, 3),
      maxLife: api.range(1.2, 2),
      color: api.pick(PACKET_COLORS),
      glow: 1.15,
      fadeIn: 0.08,
      fadeOut: 0.18,
      update: (p, dt) => {
        untilTurn -= dt;
        if (untilTurn <= 0) {
          untilTurn = 0.2 + api.rng() * 0.5;
          // 转向瞬间在拐点留下一个亮结点
          api.spawn({ x: p.x, y: p.y, shape: 'dot', size: 3.4, endSize: 1, maxLife: 0.4, color: p.color, glow: 1.4 });
          if (dirX !== 0) {
            dirY = api.rng() < 0.5 ? 1 : -1;
            dirX = 0;
          } else {
            dirX = api.rng() < 0.5 ? 1 : -1;
            dirY = 0;
          }
          p.vx = dirX * speed;
          p.vy = dirY * speed;
        }
      },
    });
  }, { until: api.duration - 900 });

  // 字符流：横向高速掠过的霓虹数据串
  api.every(210, () => {
    const fromLeft = api.rng() < 0.5;
    api.spawn({
      x: fromLeft ? -30 : api.width + 30,
      y: api.range(api.height * 0.08, api.height * 0.92),
      vx: (fromLeft ? 1 : -1) * api.range(520, 900),
      shape: 'glyph',
      glyph: api.pick(FLOW_GLYPHS),
      size: api.range(12, 17),
      maxLife: 1.4,
      color: api.rng() < 0.5 ? '#a5f3fc' : '#fbcfe8',
      glow: 0,
      fadeIn: 0.06,
      fadeOut: 0.1,
    });
  }, { until: api.duration - 1000 });

  // 核心供能脉冲：从画面中心荡开的青粉双色环
  const cx = api.width / 2;
  const cy = api.height / 2;
  api.every(760, (index) => {
    api.spawn({
      x: cx,
      y: cy,
      shape: 'ring',
      size: 40,
      endSize: Math.min(api.width, api.height) * 0.55,
      maxLife: 1.2,
      color: index % 2 === 0 ? '#22d3ee' : '#f472b6',
      opacity: 0.65,
      fadeOut: 0.7,
    });
  }, { from: 400, until: api.duration - 1400 });
};
</script>

<template>
  <div class="cyber-data-flow-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.cyberDataFlow" :scene="scene" />
    <div class="cyber-frame">
      <div class="cyber-frame-grid">
        <span v-for="index in 12" :key="index" />
      </div>
      <div class="cyber-core">
        <CircuitBoard :size="44" />
        <strong>赛博霓虹数据流</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cyber-data-flow-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.cyber-data-flow-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  background:
    linear-gradient(115deg, transparent 0 42%, rgba(125, 249, 255, 0.22) 48%, transparent 55%),
    radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.18), transparent 38%);
  mix-blend-mode: screen;
  transform: translateX(-30%);
  animation: cyber-screen-sweep 2.4s ease-out both;
}

.cyber-frame {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 76vw);
  height: min(300px, 54vh);
  border: 1px solid rgba(34, 211, 238, 0.48);
  border-radius: 12px;
  background:
    linear-gradient(90deg, rgba(34, 211, 238, 0.1), transparent 28% 72%, rgba(236, 72, 153, 0.1)),
    rgba(2, 6, 23, 0.42);
  backdrop-filter: blur(8px);
  box-shadow:
    inset 0 0 42px rgba(34, 211, 238, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 70px rgba(34, 211, 238, 0.26),
    0 0 110px rgba(236, 72, 153, 0.16);
  overflow: hidden;
  transform: translate(-50%, -50%) scale(0.86);
  animation: cyber-frame 4.8s ease both;
}

.cyber-frame::before,
.cyber-frame::after {
  content: '';
  position: absolute;
  width: 86px;
  height: 86px;
  border-color: rgba(125, 249, 255, 0.76);
}

.cyber-frame::before {
  left: 14px;
  top: 14px;
  border-left: 2px solid;
  border-top: 2px solid;
}

.cyber-frame::after {
  right: 14px;
  bottom: 14px;
  border-right: 2px solid;
  border-bottom: 2px solid;
}

.cyber-frame-grid {
  position: absolute;
  inset: 18px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 10px;
}

.cyber-frame-grid span {
  border: 1px solid rgba(34, 211, 238, 0.26);
  border-radius: 8px;
  background: rgba(34, 211, 238, 0.07);
  opacity: 0;
  animation: cyber-cell 2.8s ease both;
}

.cyber-frame-grid span:nth-child(3n) {
  animation-delay: 120ms;
}

.cyber-frame-grid span:nth-child(4n) {
  animation-delay: 220ms;
}

.cyber-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 172px;
  height: 128px;
  border: 1px solid rgba(125, 249, 255, 0.24);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.28);
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  color: #cffafe;
  transform: translate(-50%, -50%);
  animation: cyber-core 4.8s ease both;
}

.cyber-core::before {
  content: '';
  position: absolute;
  inset: -18px;
  border-radius: inherit;
  background: conic-gradient(from 0deg, transparent, rgba(34, 211, 238, 0.58), rgba(244, 114, 182, 0.42), transparent 46%);
  opacity: 0.72;
  filter: blur(1px);
  animation: cyber-core-orbit 2.4s linear infinite;
}

.cyber-core svg,
.cyber-core strong {
  position: relative;
  z-index: 1;
}

.cyber-core strong {
  font-size: 16px;
}

@keyframes cyber-screen-sweep {
  0% { opacity: 0; transform: translateX(-30%); }
  18% { opacity: 1; }
  100% { opacity: 0; transform: translateX(30%); }
}

@keyframes cyber-frame {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  18%, 76% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes cyber-cell {
  0% { opacity: 0; transform: scale(0.72); }
  42%, 82% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.96); }
}

@keyframes cyber-core {
  0%, 100% { opacity: 0; filter: blur(8px); }
  24%, 78% { opacity: 1; filter: blur(0); }
}

@keyframes cyber-core-orbit {
  to { transform: rotate(360deg); }
}
</style>
