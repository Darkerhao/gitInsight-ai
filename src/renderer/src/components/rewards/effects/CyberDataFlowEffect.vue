<script setup lang="ts">
import { CircuitBoard } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const NEAR_COLORS = ['#22d3ee', '#7dd3fc', '#a78bfa', '#f472b6'];
const FLOW_GLYPHS = ['01', 'AI', 'OK', 'PR', 'Σ', '↯'];

const scene: SceneFn = (api) => {
  api.setTrail(0.11); // 霓虹长尾：数据包身后拖出电路光轨
  const cx = api.width / 2;
  const cy = api.height / 2;

  // ── 远景母线：暗色电路走线 + 结点（内容层的纵深底图）
  const busY = [0.22, 0.5, 0.78].map((k) => api.height * k);
  const busX = [0.24, 0.5, 0.76].map((k) => api.width * k);
  api.onFrame((tMs, _dt, ctx) => {
    const ramp = Math.min(1, Math.max(0, (tMs - 160) / 420)) * Math.max(0, Math.min(1, (4400 - tMs) / 460));
    if (ramp <= 0.02) return;
    ctx.strokeStyle = `rgba(34, 211, 238, ${0.09 * ramp})`;
    ctx.lineWidth = 1;
    busY.forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(api.width, y);
      ctx.stroke();
    });
    busX.forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, api.height);
      ctx.stroke();
    });
    ctx.fillStyle = `rgba(167, 139, 250, ${0.2 * ramp})`;
    busY.forEach((y) => {
      busX.forEach((x) => {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  });

  // ── 幕一（entry）：总线通电脉冲
  api.at(110, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 14, endSize: 60, maxLife: 0.4, color: '#ecfeff', glow: 1.8, fadeOut: 0.8 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 12, endSize: 150, maxLife: 0.55, color: '#22d3ee', opacity: 0.7, fadeOut: 0.6 });
  });

  // ── 曼哈顿数据包：轴向直行 + 直角折行，拐点留亮结；近远两档纵深
  const packet = (near: boolean) => {
    const speed = near ? api.range(300, 560) : api.range(150, 260);
    const startOnVertical = api.rng() < 0.5;
    let dirX = startOnVertical ? 0 : (api.rng() < 0.5 ? 1 : -1);
    let dirY = startOnVertical ? (api.rng() < 0.5 ? 1 : -1) : 0;
    let untilTurn = api.range(0.18, 0.55);
    api.spawn({
      x: api.range(api.width * 0.06, api.width * 0.94),
      y: api.range(api.height * 0.06, api.height * 0.94),
      vx: dirX * speed,
      vy: dirY * speed,
      shape: 'spark',
      size: near ? api.range(2, 3.2) : api.range(1.1, 1.7),
      maxLife: api.range(1.2, 2),
      color: near ? api.pick(NEAR_COLORS) : 'rgba(14, 116, 144, 0.85)',
      glow: near ? 1.2 : 0.55,
      opacity: near ? 1 : 0.5,
      fadeIn: 0.08,
      fadeOut: 0.18,
      update: (p, dt) => {
        untilTurn -= dt;
        if (untilTurn <= 0) {
          untilTurn = 0.18 + api.rng() * 0.5;
          if (near) {
            // 拐点亮结：结点白闪 + 偶发环形涟漪
            api.spawn({ x: p.x, y: p.y, shape: 'dot', size: 3.6, endSize: 1, maxLife: 0.4, color: p.color, glow: 1.5 });
            if (api.rng() < 0.3) {
              api.spawn({ x: p.x, y: p.y, shape: 'ring', size: 3, endSize: 20, maxLife: 0.34, color: p.color, opacity: 0.55, fadeOut: 0.5 });
            }
          }
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
      onDeath: near
        ? (p, s) => {
            if (s.rng() < 0.24) {
              s.burst({
                x: p.x, y: p.y, count: 4, speed: [30, 110],
                base: { shape: 'spark', size: 1.2, maxLife: 0.32, color: p.color, glow: 1, drag: 0.3, fadeOut: 0.5 },
              });
            }
          }
        : undefined,
    });
  };
  api.every(52, () => packet(true), { from: 260, until: api.duration - 850 });
  api.every(64, () => packet(false), { from: 400, until: api.duration - 950 });

  // ── 字符列车：首字亮、车厢渐暗的横掠数据串
  api.every(250, () => {
    const fromLeft = api.rng() < 0.5;
    const dir = fromLeft ? 1 : -1;
    const y = api.range(api.height * 0.1, api.height * 0.9);
    const speed = dir * api.range(540, 880);
    for (let car = 0; car < 5; car += 1) {
      api.spawn({
        x: (fromLeft ? -30 : api.width + 30) - dir * car * 24,
        y,
        vx: speed,
        shape: 'glyph',
        glyph: api.pick(FLOW_GLYPHS),
        size: car === 0 ? 15 : api.range(10, 13),
        maxLife: 1.5,
        color: car === 0 ? '#ecfeff' : api.rng() < 0.5 ? 'rgba(196, 181, 253, 0.75)' : 'rgba(165, 243, 252, 0.6)',
        glow: 0,
        fadeIn: 0.06,
        fadeOut: 0.1,
      });
    }
  }, { from: 460, until: api.duration - 1050 });

  // ── 青粉双色脉冲交替荡开（主环 + 延迟回波）
  api.every(760, (index) => {
    const color = index % 2 === 0 ? '#22d3ee' : '#f472b6';
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 40,
      endSize: Math.min(api.width, api.height) * 0.56,
      maxLife: 1.2, color, opacity: 0.62, fadeOut: 0.7,
    });
    api.at(760 * index + 640, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 30,
        endSize: Math.min(api.width, api.height) * 0.4,
        maxLife: 0.9, color, opacity: 0.26, fadeOut: 0.8,
      });
    });
  }, { from: 500, until: api.duration - 1500 });

  // ── 高潮节拍：总线冲刷 —— 中带横向光矢齐射 + 双色同心爆
  api.at(3150, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 18, endSize: 120, maxLife: 0.45, color: '#ecfeff', glow: 2, fadeOut: 0.85 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: 300, maxLife: 0.9, color: '#22d3ee', opacity: 0.7, fadeOut: 0.7 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 16, endSize: 220, maxLife: 0.8, color: '#f472b6', opacity: 0.5, fadeOut: 0.7 });
    for (let i = 0; i < 14; i += 1) {
      const up = i % 2 === 0;
      api.spawn({
        x: api.rng() < 0.5 ? -20 : api.width + 20,
        y: cy + api.range(-90, 90),
        vx: 0, shape: 'streak', stretch: 0.1, size: 1.8, maxLife: 0.7,
        color: up ? '#67e8f9' : '#c4b5fd', glow: 0.9, fadeOut: 0.4,
        update: (p, dt) => {
          const dir = p.x < cx ? 1 : -1;
          p.vx += dir * 2600 * dt;
        },
      });
    }
  });

  // ── 幕三（exit）：洪流退潮 —— 收束环内吸 + 残码坠落熄灭
  api.at(4150, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 250, endSize: 8, maxLife: 0.55, color: '#22d3ee', opacity: 0.6, fadeOut: 0.4 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 20, endSize: 3, maxLife: 0.5, color: '#ecfeff', glow: 1.8, fadeOut: 0.6 });
  });
  api.every(70, () => {
    api.spawn({
      x: api.range(api.width * 0.1, api.width * 0.9),
      y: api.range(api.height * 0.1, api.height * 0.6),
      vy: api.range(40, 110), drag: 0.7,
      shape: 'glyph', glyph: api.pick(FLOW_GLYPHS), size: api.range(9, 12),
      maxLife: api.range(0.5, 0.9), color: 'rgba(103, 232, 249, 0.5)',
      opacity: 0.6, fadeOut: 0.5,
    });
  }, { from: 4150, until: api.duration - 260 });
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
        <small class="core-code">DATA TORRENT · BUS 128-BIT</small>
        <CircuitBoard :size="40" />
        <strong>数据洪流</strong>
        <small class="core-meta">THROUGHPUT 9.6 GB/S</small>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cyber-data-flow-effect {
  @include effect-stage(hidden);
}

.cyber-data-flow-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  background:
    linear-gradient(115deg, transparent 0 42%, rgba(125, 249, 255, 0.22) 48%, transparent 55%),
    radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.16), transparent 38%);
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
    linear-gradient(90deg, rgba(34, 211, 238, 0.1), transparent 28% 72%, rgba(167, 139, 250, 0.12)),
    rgba(2, 6, 23, 0.42);
  backdrop-filter: blur(8px);
  box-shadow:
    inset 0 0 42px rgba(34, 211, 238, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 70px rgba(34, 211, 238, 0.26),
    0 0 110px rgba(167, 139, 250, 0.18);
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
  animation: cyber-cell 4.8s ease both;
}

.cyber-frame-grid span:nth-child(3n) {
  animation-delay: 110ms;
}

.cyber-frame-grid span:nth-child(4n) {
  animation-delay: 210ms;
}

.cyber-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 196px;
  height: 138px;
  border: 1px solid rgba(125, 249, 255, 0.24);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.3);
  display: grid;
  gap: 6px;
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
  background: conic-gradient(from 0deg, transparent, rgba(34, 211, 238, 0.58), rgba(167, 139, 250, 0.46), transparent 46%);
  opacity: 0.72;
  filter: blur(1px);
  animation: cyber-core-orbit 2.4s linear infinite;
}

.cyber-core svg,
.cyber-core strong,
.cyber-core small {
  position: relative;
  z-index: 1;
}

.cyber-core strong {
  font-size: 16px;
  letter-spacing: 0.14em;
}

.cyber-core small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.2em;
  color: rgba(165, 243, 252, 0.66);
}

.core-meta {
  color: rgba(196, 181, 253, 0.72);
}

@keyframes cyber-screen-sweep {
  0% { opacity: 0; transform: translateX(-30%); }
  18% { opacity: 1; }
  100% { opacity: 0; transform: translateX(30%); }
}

@keyframes cyber-frame {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  10%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes cyber-cell {
  0% { opacity: 0; transform: scale(0.72); }
  16%, 80% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.96); }
}

@keyframes cyber-core {
  0%, 100% { opacity: 0; filter: blur(8px); }
  14%, 66% { opacity: 1; filter: blur(0) brightness(1); }
  68% { opacity: 1; filter: blur(0) brightness(1.5); }
  72%, 84% { opacity: 1; filter: blur(0) brightness(1.02); }
}

@keyframes cyber-core-orbit {
  to { transform: rotate(360deg); }
}
</style>
