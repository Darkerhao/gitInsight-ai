<script setup lang="ts">
import { Gauge } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const panels = [
  { id: 1, label: 'SYS', value: '98%', x: '16%', y: '24%', delay: '80ms' },
  { id: 2, label: 'NAV', value: 'LOCK', x: '72%', y: '22%', delay: '200ms' },
  { id: 3, label: 'AI', value: 'READY', x: '12%', y: '66%', delay: '320ms' },
  { id: 4, label: 'CORE', value: 'SYNC', x: '70%', y: '68%', delay: '440ms' },
];

const SWEEP_SPEED = 1.9; // rad/s
const SWEEP_START = -Math.PI / 2;

const scene: SceneFn = (api) => {
  api.setTrail(0.12); // 雷达扫掠靠画布残留形成扇形余辉
  const cx = api.width / 2;
  const cy = api.height / 2;
  const radarRadius = Math.min(180, Math.min(api.width, api.height) * 0.34);
  const duration = api.duration / 1000; // 5.2s

  // 空情目标：seed 预置 5 个接触点，仅当扫掠臂真正掠过其方位角时点亮锁定
  const contacts = Array.from({ length: 5 }, (_, i) => {
    let bearing = api.range(0, Math.PI * 2);
    while (bearing < SWEEP_START) bearing += Math.PI * 2;
    return { id: i + 1, bearing, radius: radarRadius * api.range(0.32, 0.9), hits: 0 };
  });

  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (duration - t) / 0.8));
    if (envelope <= 0) return;
    const angle = SWEEP_START + t * SWEEP_SPEED;

    // 距离环 + 方位微标（缓旋）
    ctx.strokeStyle = `rgba(34, 211, 238, ${0.07 * envelope})`;
    ctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach((k) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radarRadius * k, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.fillStyle = `rgba(165, 243, 252, ${0.22 * envelope})`;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + t * 0.06;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * radarRadius, cy + Math.sin(a) * radarRadius, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 扫掠臂：双色渐变 + 白热尖端
    const tipX = cx + Math.cos(angle) * radarRadius;
    const tipY = cy + Math.sin(angle) * radarRadius;
    const gradient = ctx.createLinearGradient(cx, cy, tipX, tipY);
    gradient.addColorStop(0, `rgba(34, 211, 238, ${0.1 * envelope})`);
    gradient.addColorStop(0.72, `rgba(34, 211, 238, ${0.5 * envelope})`);
    gradient.addColorStop(1, `rgba(236, 254, 255, ${0.9 * envelope})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = `rgba(240, 253, 255, ${0.85 * envelope})`;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 扫掠命中：臂掠过接触点方位角 → 锁定序列（收缩环 + 白热点 + 编号 + 回波）
    if (tMs > 500 && tMs < 4300) {
      for (const c of contacts) {
        if (angle >= c.bearing + c.hits * Math.PI * 2) {
          c.hits += 1;
          const x = cx + Math.cos(c.bearing) * c.radius;
          const y = cy + Math.sin(c.bearing) * c.radius;
          api.spawn({ x, y, shape: 'ring', size: 44, endSize: 8, maxLife: 0.55, color: '#67e8f9', opacity: 0.95, fadeIn: 0.06, fadeOut: 0.2 });
          api.spawn({ x, y, shape: 'dot', size: 3.4, maxLife: 1.4, color: '#f0fdff', glow: 1.5, twinkle: 5, fadeIn: 0.16, fadeOut: 0.4 });
          api.spawn({ x, y, shape: 'glyph', glyph: '+', size: 20, endSize: 12, maxLife: 0.9, color: '#e0f2fe', fadeIn: 0.3, fadeOut: 0.4 });
          api.spawn({
            x, y: y + 18, shape: 'glyph', glyph: `TGT-0${c.id}`, size: 10,
            maxLife: 1.1, color: '#a5f3fc', opacity: 0.85, fadeIn: 0.2, fadeOut: 0.35,
          });
          api.at(tMs + 240, () => {
            api.spawn({ x, y, shape: 'ring', size: 10, endSize: 34, maxLife: 0.5, color: '#a78bfa', opacity: 0.45, fadeOut: 0.7 });
          });
        }
      }
    }
  });

  // 舷侧遥测光条：近亮远暗双层上行
  api.every(90, () => {
    const onLeft = api.rng() < 0.5;
    const near = api.rng() < 0.62;
    api.spawn({
      x: api.width * (onLeft ? api.range(0.04, 0.09) : api.range(0.91, 0.96)),
      y: api.height + 10,
      vy: -(near ? api.range(340, 620) : api.range(170, 280)),
      shape: 'streak', stretch: 0.06,
      size: near ? api.range(1.4, 2.1) : api.range(0.9, 1.2),
      maxLife: api.range(0.8, 1.6),
      color: near ? (api.rng() < 0.7 ? '#22d3ee' : '#a5f3fc') : '#155e75',
      glow: near ? 0.9 : 0.5, opacity: near ? 1 : 0.6, fadeIn: 0.1, fadeOut: 0.2,
    });
  }, { until: api.duration - 800 });

  // 遥测读数：舷侧数字随光条上行（等宽微文案质感）
  api.every(260, (i) => {
    const onLeft = i % 2 === 0;
    api.spawn({
      x: api.width * (onLeft ? 0.065 : 0.935), y: api.height * api.range(0.6, 0.9),
      vy: -api.range(60, 110),
      shape: 'glyph', glyph: `${Math.floor(api.range(100, 999))}.${Math.floor(api.range(0, 9))}`,
      size: 10, maxLife: api.range(0.9, 1.4), color: '#67e8f9', opacity: 0.55, fadeIn: 0.14, fadeOut: 0.35,
    });
  }, { from: 700, until: api.duration - 1100 });

  // HUD 星点噪声：舱外掠过的微光
  api.every(60, () => {
    api.spawn({
      x: api.range(0, api.width), y: api.range(0, api.height),
      shape: 'dot', size: api.range(0.7, 1.4), maxLife: api.range(0.4, 1),
      color: '#67e8f9', twinkle: 12, glow: 0.8, opacity: 0.8, fadeOut: 0.4,
    });
  }, { until: api.duration - 700 });

  // 4.15s 航向确认：准星中心白闪 + 双确认环 + 上行确认火花
  api.at(4150, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 46, maxLife: 0.45, color: '#ecfeff', glow: 1.8, fadeOut: 0.8 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: radarRadius * 1.15, maxLife: 0.8, color: '#67e8f9', opacity: 0.8, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 22, speed: [60, 200],
      base: { shape: 'spark', size: 1.7, maxLife: 0.8, color: '#a5f3fc', glow: 1.1, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() < 0.2) p.color = '#c4b5fd';
      },
    });
  });
  api.at(4420, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 40, endSize: radarRadius * 1.4, maxLife: 0.7, color: '#a78bfa', opacity: 0.35, fadeOut: 0.8 });
  });
};
</script>

<template>
  <div class="cockpit-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.cockpit" :scene="scene" />
    <div class="hud-reticle">
      <span v-for="tick in 24" :key="tick" :class="{ long: tick % 6 === 1 }" :style="{ '--tick-angle': `${(tick - 1) * 15}deg` }" />
      <i class="hud-cross x" />
      <i class="hud-cross y" />
    </div>
    <div
      v-for="panel in panels"
      :key="panel.id"
      class="hud-panel"
      :style="{ left: panel.x, top: panel.y, animationDelay: panel.delay }"
    >
      <span>{{ panel.label }}</span>
      <strong>{{ panel.value }}</strong>
    </div>
    <div class="cockpit-core">
      <Gauge :size="44" />
      <strong>轨道座舱</strong>
      <small>ORBITAL COCKPIT · NAV-LOCK 100%</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cockpit-effect {
  @include effect-stage(hidden);
}

.cockpit-effect::before {
  content: '';
  position: absolute;
  inset: 8%;
  border: 1px solid rgba(34, 211, 238, 0.24);
  border-radius: 16px;
  box-shadow:
    inset 0 0 36px rgba(34, 211, 238, 0.12),
    0 0 42px rgba(34, 211, 238, 0.12);
  opacity: 0;
  animation: frame-in 5.2s ease both;
}

.hud-reticle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(360px, 70vw);
  aspect-ratio: 1;
  border: 1px solid rgba(34, 211, 238, 0.38);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow:
    inset 0 0 38px rgba(34, 211, 238, 0.12),
    0 0 42px rgba(34, 211, 238, 0.16);
  opacity: 0;
  animation: reticle-in 5.2s ease both, reticle-spin 5.2s cubic-bezier(0.3, 0, 0.4, 1) both;
}

.hud-reticle span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 12px;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.68);
  transform: rotate(var(--tick-angle)) translateY(-170px);
  transform-origin: center 170px;
}

.hud-reticle span.long {
  height: 22px;
  background: rgba(255, 255, 255, 0.82);
}

.hud-cross {
  position: absolute;
  left: 50%;
  top: 50%;
  background: rgba(34, 211, 238, 0.48);
  transform: translate(-50%, -50%);
}

.hud-cross.x {
  width: 76%;
  height: 1px;
}

.hud-cross.y {
  width: 1px;
  height: 76%;
}

.hud-panel {
  position: absolute;
  min-width: 112px;
  border: 1px solid rgba(34, 211, 238, 0.32);
  border-radius: 8px;
  background: rgba(8, 47, 73, 0.42);
  color: #cffafe;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  box-shadow: inset 0 0 22px rgba(34, 211, 238, 0.12);
  opacity: 0;
  animation: panel-in 5.2s ease both;
}

.hud-panel span {
  color: #67e8f9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.hud-panel strong {
  font-size: 18px;
  letter-spacing: 0.06em;
}

.cockpit-core {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  gap: 8px;
  color: #e0f2fe;
  text-shadow: 0 0 22px rgba(34, 211, 238, 0.5);
  transform: translate(-50%, -50%);
  animation: core-in 5.2s ease both;
}

.cockpit-core svg {
  color: #22d3ee;
  filter: drop-shadow(0 0 24px rgba(34, 211, 238, 0.58));
}

.cockpit-core strong {
  font-size: 17px;
  letter-spacing: 0.2em;
}

.cockpit-core small {
  color: rgba(165, 243, 252, 0.62);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.26em;
}

@keyframes frame-in {
  0%, 100% {
    opacity: 0;
    transform: scale(1.03);
  }
  14%, 86% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes reticle-in {
  0%, 100% {
    opacity: 0;
  }
  14%, 84% {
    opacity: 1;
  }
}

@keyframes reticle-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(32deg);
  }
}

@keyframes panel-in {
  0% {
    opacity: 0;
    transform: translateY(16px);
  }
  16%, 80% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px);
  }
}

@keyframes core-in {
  0%, 44% {
    opacity: 0;
    transform: translate(-50%, -46%) scale(0.92);
  }
  54%, 84% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -56%) scale(0.96);
  }
}
</style>
