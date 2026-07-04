<script setup lang="ts">
import { Gauge } from 'lucide-vue-next';

const tickMarks = Array.from({ length: 48 }, (_, index) => ({
  id: index,
  angle: `${index * 7.5}deg`,
  long: index % 4 === 0,
}));
const panels = [
  { id: 1, label: 'SYS', value: '98%', x: '16%', y: '24%', delay: '80ms' },
  { id: 2, label: 'NAV', value: 'LOCK', x: '72%', y: '22%', delay: '180ms' },
  { id: 3, label: 'AI', value: 'READY', x: '12%', y: '66%', delay: '280ms' },
  { id: 4, label: 'CORE', value: 'SYNC', x: '70%', y: '68%', delay: '360ms' },
];
const scanLines = Array.from({ length: 10 }, (_, index) => ({
  id: index,
  top: `${10 + index * 8}%`,
  delay: `${index * 70}ms`,
}));
</script>

<template>
  <div class="cockpit-effect">
    <span v-for="line in scanLines" :key="line.id" class="hud-scan-line" :style="{ top: line.top, animationDelay: line.delay }" />
    <div class="hud-reticle">
      <span v-for="tick in tickMarks" :key="tick.id" :class="{ long: tick.long }" :style="{ '--tick-angle': tick.angle }" />
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

.hud-scan-line {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.48), transparent);
  opacity: 0;
  animation: scan-line 1.8s ease-in-out infinite;
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

@keyframes scan-line {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-16px);
  }
  46% {
    opacity: 1;
    transform: translateX(16px);
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
