<script setup lang="ts">
import { Gauge } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const panels = [
  { id: 1, label: 'SYS', value: '98%', x: '16%', y: '24%', delay: '80ms' },
  { id: 2, label: 'NAV', value: 'LOCK', x: '72%', y: '22%', delay: '180ms' },
  { id: 3, label: 'AI', value: 'READY', x: '12%', y: '66%', delay: '280ms' },
  { id: 4, label: 'CORE', value: 'SYNC', x: '70%', y: '68%', delay: '360ms' },
];

const scene: SceneFn = (api) => {
  api.setTrail(0.12); // 雷达扫掠靠画布残留形成扇形余辉
  const cx = api.width / 2;
  const cy = api.height / 2;
  const radarRadius = Math.min(180, Math.min(api.width, api.height) * 0.34);
  const duration = api.duration / 1000;

  // 雷达扫掠线：只画最亮的前沿，余辉自然拖出扇面
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (duration - t) / 0.8));
    if (envelope <= 0) return;
    const angle = t * 1.9;
    const gradient = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * radarRadius, cy + Math.sin(angle) * radarRadius);
    gradient.addColorStop(0, `rgba(34, 211, 238, ${0.1 * envelope})`);
    gradient.addColorStop(1, `rgba(125, 249, 255, ${0.85 * envelope})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radarRadius, cy + Math.sin(angle) * radarRadius);
    ctx.stroke();
  });

  // 目标锁定：光环收缩锁死 + 十字闪光
  api.every(640, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(radarRadius * 0.3, radarRadius * 0.92);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    api.spawn({ x, y, shape: 'ring', size: 44, endSize: 8, maxLife: 0.55, color: '#67e8f9', opacity: 0.95, fadeIn: 0.06, fadeOut: 0.2 });
    api.spawn({ x, y, shape: 'dot', size: 3.4, maxLife: 1.1, color: '#a5f3fc', glow: 1.4, twinkle: 6, fadeIn: 0.3 });
    api.spawn({
      x,
      y,
      shape: 'glyph',
      glyph: '+',
      size: 20,
      endSize: 12,
      maxLife: 0.9,
      color: '#e0f2fe',
      fadeIn: 0.3,
      fadeOut: 0.4,
    });
  }, { from: 500, until: api.duration - 1100 });

  // 边缘数据流：屏幕两侧竖向掠过的遥测光条
  api.every(90, () => {
    const onLeft = api.rng() < 0.5;
    api.spawn({
      x: api.width * (onLeft ? api.range(0.04, 0.09) : api.range(0.91, 0.96)),
      y: api.height + 10,
      vy: -api.range(300, 620),
      shape: 'streak',
      stretch: 0.06,
      size: api.range(1.2, 2),
      maxLife: api.range(0.8, 1.6),
      color: api.rng() < 0.7 ? '#22d3ee' : '#a5f3fc',
      glow: 0.9,
      fadeIn: 0.1,
      fadeOut: 0.2,
    });
  }, { until: api.duration - 800 });

  // HUD 星点噪声：舱外掠过的微光
  api.every(50, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.range(0, api.height),
      shape: 'dot',
      size: api.range(0.7, 1.4),
      maxLife: api.range(0.4, 1),
      color: '#67e8f9',
      twinkle: 12,
      glow: 0.8,
    });
  }, { until: api.duration - 700 });
};
</script>

<template>
  <div class="cockpit-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.cockpit" :scene="scene" />
    <div class="hud-reticle">
      <span v-for="tick in 48" :key="tick" :class="{ long: tick % 4 === 1 }" :style="{ '--tick-angle': `${(tick - 1) * 7.5}deg` }" />
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
      <Gauge :size="48" />
      <strong>驾驶舱 HUD</strong>
    </div>
  </div>
</template>

<style scoped>
.cockpit-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
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
  animation: reticle-in 5.2s ease both, reticle-spin 5.2s linear both;
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
  font-size: 11px;
  font-weight: 800;
}

.hud-panel strong {
  font-size: 18px;
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

@keyframes frame-in {
  0%,
  100% {
    opacity: 0;
    transform: scale(1.03);
  }
  16%,
  84% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes reticle-in {
  0%,
  100% {
    opacity: 0;
  }
  16%,
  82% {
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
  18%,
  78% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px);
  }
}

@keyframes core-in {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.9);
  }
  18%,
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}
</style>
