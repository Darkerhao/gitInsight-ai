<script setup lang="ts">
import { CircleDashed } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * CHARGE TORUS · 储能环阵（4800ms = 500 entry + 3600 loop + 700 exit）
 * 三幕：环阵展开、能量被螺旋吸入 → 双车道轨道环流逐级提速，充能刻度环层层收拢，
 * 3.2s 达峰白闪放电（全向火花 + 拖尾光矛 + 三重冲击环 + 回波）→ 电荷微粒飘散收束。
 * 配色：白热核心 + 蓝色主辉光（#60a5fa 族）+ 青绿色辅点缀（#2dd4bf 族）。
 */
const CHARGE_AT = 3200; // 达峰时刻，与注册表 motion「充能 3.2s 达峰」对齐

const scene: SceneFn = (api) => {
  api.setTrail(0.16);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const orbitRadius = Math.min(160, Math.min(api.width, api.height) * 0.3);
  const outerMax = Math.min(api.width, api.height) * 0.56;

  // 幕一（entry）：环阵展开脉冲，能量场苏醒
  api.at(120, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 12, endSize: orbitRadius * 1.7, maxLife: 0.75, color: '#93c5fd', opacity: 0.7, fadeOut: 0.7 });
  });
  api.at(300, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 8, endSize: orbitRadius * 1.15, maxLife: 0.6, color: '#5eead4', opacity: 0.5, fadeOut: 0.7 });
  });

  // 能量吸入：外围粒子沿螺旋弧线坠向轨道环，抵达时迸出白色小闪
  api.every(26, () => {
    let angle = api.range(0, Math.PI * 2);
    let radius = api.range(orbitRadius + 120, outerMax);
    const spin = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'streak', stretch: 0.045,
      size: api.range(1.3, 2.4), maxLife: 1.6,
      color: api.rng() < 0.6 ? '#93c5fd' : '#5eead4',
      glow: 1, fadeIn: 0.12, fadeOut: 0.06,
      update: (p, dt) => {
        // 螺旋牵引：越近吸得越急，切向速度随之增大
        angle += spin * (1.4 + (1 - radius / outerMax) * 3.4) * dt;
        radius -= (radius - orbitRadius + 26) * 2.4 * dt;
        const nx = cx + Math.cos(angle) * radius;
        const ny = cy + Math.sin(angle) * radius;
        p.vx = (nx - p.x) / Math.max(dt, 0.001);
        p.vy = (ny - p.y) / Math.max(dt, 0.001);
        p.x = nx;
        p.y = ny;
        if (radius < orbitRadius + 5) p.life = p.maxLife;
      },
      onDeath: (p, sceneApi) => {
        sceneApi.spawn({ x: p.x, y: p.y, shape: 'dot', size: 3.4, endSize: 1, maxLife: 0.2, color: '#eff6ff', glow: 1.4, fadeOut: 0.7 });
      },
    });
  }, { until: CHARGE_AT - 300 });

  // 轨道双车道环流：内道顺时蓝、外道逆时青，随充能进度逐级提速
  api.every(30, (index) => {
    const outerLane = index % 2 === 1;
    const laneR = orbitRadius * (outerLane ? 1.1 : 0.93);
    const dir = outerLane ? -1 : 1;
    const chargeRatio = Math.min(1, (index * 30) / CHARGE_AT);
    let angle = api.range(0, Math.PI * 2);
    api.spawn({
      x: cx + Math.cos(angle) * laneR,
      y: cy + Math.sin(angle) * laneR,
      shape: 'streak', stretch: 0.05,
      size: api.range(1.7, 2.8), maxLife: api.range(0.7, 1.1),
      color: outerLane ? '#5eead4' : '#93c5fd',
      glow: 1.2, fadeIn: 0.08, fadeOut: 0.2,
      update: (p, dt) => {
        const speed = dir * (2.6 + chargeRatio * 6.5 + Math.min(2, p.life * 2));
        angle += speed * dt;
        const nx = cx + Math.cos(angle) * laneR;
        const ny = cy + Math.sin(angle) * laneR;
        p.vx = (nx - p.x) / Math.max(dt, 0.001);
        p.vy = (ny - p.y) / Math.max(dt, 0.001);
        p.x = nx;
        p.y = ny;
      },
    });
  }, { until: CHARGE_AT - 100 });

  // 充能刻度：四个里程碑收拢环 + 等宽百分比微文案
  [
    { at: 900, label: '027%' },
    { at: 1700, label: '054%' },
    { at: 2450, label: '081%' },
    { at: 3020, label: '098%' },
  ].forEach(({ at, label }, i) => {
    api.at(at, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: orbitRadius * (2 - i * 0.16), endSize: orbitRadius,
        maxLife: 0.5, color: i % 2 ? '#5eead4' : '#93c5fd', opacity: 0.6, fadeOut: 0.55,
      });
      api.spawn({
        x: cx, y: cy - orbitRadius - 30, shape: 'glyph', glyph: `CHG ${label}`,
        size: 11, maxLife: 0.65, color: 'rgba(191, 219, 254, 0.9)',
        font: '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.12, fadeOut: 0.35,
      });
    });
  });

  // 幕二顶点（3200ms）：白闪放电
  api.at(CHARGE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 18, endSize: 300, maxLife: 0.5, color: '#f8fafc', glow: 2.4, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 66, endSize: 4, maxLife: 0.45, color: '#eff6ff', glow: 2, fadeOut: 0.85 });
    // 全向火花
    api.burst({
      x: cx, y: cy, count: 130, speed: [170, 700],
      base: { shape: 'spark', size: 2, drag: 0.35, color: '#93c5fd', twinkle: 8, glow: 1.2, fadeOut: 0.42 },
      vary: (p, rng) => {
        p.maxLife = 0.75 + rng() * 0.95;
        const roll = rng();
        if (roll < 0.3) p.color = '#5eead4';
        else if (roll < 0.42) p.color = '#e0f2fe';
        else if (roll < 0.5) p.color = '#fff7ed'; // 白热少数派
      },
    });
    // 拖尾光矛：撑开放电的骨架方向感
    api.burst({
      x: cx, y: cy, count: 22, speed: [420, 640],
      base: { shape: 'streak', stretch: 0.09, size: 2.2, maxLife: 0.75, color: '#bfdbfe', glow: 1.3, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() > 0.65) p.color = '#5eead4';
        p.maxLife = 0.5 + rng() * 0.45;
      },
    });
    // 三重冲击环
    [0, 140, 300].forEach((delay, i) => {
      api.at(CHARGE_AT + delay, () => {
        api.spawn({
          x: cx, y: cy, shape: 'ring', size: orbitRadius * 0.4,
          endSize: Math.max(api.width, api.height) * (0.42 + i * 0.14),
          maxLife: 1, color: i === 1 ? '#5eead4' : '#bfdbfe', opacity: 0.85 - i * 0.16, fadeOut: 0.8,
        });
      });
    });
    // 回波：慢半拍浮现的暗青余响环
    api.at(CHARGE_AT + 540, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: orbitRadius, endSize: Math.max(api.width, api.height) * 0.5,
        maxLife: 0.9, color: '#2dd4bf', opacity: 0.3, fadeIn: 0.2, fadeOut: 0.6,
      });
    });
  });

  // 幕三（余韵）：放电后电荷微粒上飘 + 轨道残辉缓旋
  api.every(55, () => {
    api.spawn({
      x: cx + api.range(-orbitRadius * 1.2, orbitRadius * 1.2),
      y: cy + api.range(-orbitRadius, orbitRadius),
      vx: api.range(-36, 36), vy: api.range(-75, -22),
      shape: 'dot', size: api.range(0.9, 1.9), maxLife: api.range(0.8, 1.4),
      color: api.rng() > 0.35 ? '#bfdbfe' : '#5eead4', twinkle: 10, glow: 1, wander: 22, fadeOut: 0.5,
    });
  }, { from: CHARGE_AT + 380, until: api.duration - 550 });
  api.every(90, () => {
    let angle = api.range(0, Math.PI * 2);
    api.spawn({
      x: cx + Math.cos(angle) * orbitRadius, y: cy + Math.sin(angle) * orbitRadius,
      shape: 'spark', size: 1.6, maxLife: 0.8, color: '#93c5fd', glow: 0.9, opacity: 0.55, fadeOut: 0.4,
      update: (p, dt) => {
        angle += 1.4 * dt;
        p.x = cx + Math.cos(angle) * orbitRadius;
        p.y = cy + Math.sin(angle) * orbitRadius;
      },
    });
  }, { from: CHARGE_AT + 500, until: api.duration - 650 });
};
</script>

<template>
  <div class="energy-ring-effect">
    <svg class="energy-rings" viewBox="0 0 240 240" aria-hidden="true">
      <circle class="energy-ring outer" cx="120" cy="120" r="92" />
      <circle class="energy-ring middle" cx="120" cy="120" r="68" />
      <circle class="energy-ring inner" cx="120" cy="120" r="42" />
    </svg>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.energyRing" :scene="scene" />
    <div class="energy-core">
      <CircleDashed :size="50" />
      <small>CHARGE TORUS</small>
      <strong>储能环阵</strong>
    </div>
    <div class="energy-confirm">DISCHARGE COMPLETE · 100%</div>
  </div>
</template>

<style scoped lang="scss">
.energy-ring-effect {
  @include effect-stage(hidden);
}

.energy-ring-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 78vw);
  aspect-ratio: 1;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, rgba(96, 165, 250, 0.3), rgba(45, 212, 191, 0.18) 38%, transparent 68%);
  filter: blur(12px);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: energy-aura 4.8s ease both;
}

.energy-rings {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(420px, 72vw);
  transform: translate(-50%, -50%) rotate(-90deg);
  filter:
    drop-shadow(0 0 26px rgba(96, 165, 250, 0.52))
    drop-shadow(0 0 48px rgba(45, 212, 191, 0.22));
  animation: energy-stage 4.8s ease both;
}

.energy-ring {
  fill: none;
  stroke: rgba(147, 197, 253, 0.86);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 90 620;
  animation: energy-ring 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.energy-ring.middle {
  stroke: rgba(45, 212, 191, 0.86);
  animation-delay: 120ms;
  animation-direction: reverse;
}

.energy-ring.inner {
  stroke: rgba(224, 242, 254, 0.9);
  animation-delay: 220ms;
}

.energy-core {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #eff6ff;
  transform: translate(-50%, -50%);
  animation: energy-core 4.8s ease both;
}

.energy-core::before {
  content: '';
  position: absolute;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22), rgba(96, 165, 250, 0.2) 36%, transparent 68%);
  animation: energy-core-breath 1.3s ease-in-out infinite;
}

.energy-core svg,
.energy-core strong,
.energy-core small {
  position: relative;
  z-index: 1;
}

.energy-core small {
  color: rgba(191, 219, 254, 0.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.3em;
}

.energy-core strong {
  font-size: 16px;
  letter-spacing: 0.14em;
}

.energy-confirm {
  position: absolute;
  left: 50%;
  bottom: 13%;
  color: rgba(94, 234, 212, 0.92);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.26em;
  white-space: nowrap;
  text-shadow: 0 0 14px rgba(45, 212, 191, 0.5);
  transform: translateX(-50%);
  animation: energy-confirm 4.8s ease both;
}

@keyframes energy-aura {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.56); }
  16%, 82% { opacity: 1; }
  64% { transform: translate(-50%, -50%) scale(0.78); }
  72% { transform: translate(-50%, -50%) scale(1.2); }
}

@keyframes energy-stage {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotate(-90deg) scale(0.64); }
  14%, 84% { opacity: 1; transform: translate(-50%, -50%) rotate(-90deg) scale(1); }
  62% { transform: translate(-50%, -50%) rotate(-90deg) scale(0.8); }
  70% { transform: translate(-50%, -50%) rotate(-90deg) scale(1.06); }
}

@keyframes energy-ring {
  0% { stroke-dasharray: 60 620; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 220 620; }
  100% { stroke-dasharray: 60 620; stroke-dashoffset: -680; }
}

@keyframes energy-core {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.74); }
  16%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  64% { transform: translate(-50%, -50%) scale(0.88); }
  70% { transform: translate(-50%, -50%) scale(1.16); }
}

@keyframes energy-core-breath {
  0%, 100% { opacity: 0.48; transform: scale(0.9); }
  50% { opacity: 0.9; transform: scale(1.12); }
}

@keyframes energy-confirm {
  0%, 74% { opacity: 0; transform: translate(-50%, 10px); }
  80%, 92% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; }
}
</style>
