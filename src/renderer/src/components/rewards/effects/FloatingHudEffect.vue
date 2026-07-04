<script setup lang="ts">
import { Radar } from 'lucide-vue-next';

const panels = Array.from({ length: 8 }, (_, index) => ({
  id: index,
  left: `${14 + ((index * 23) % 72)}%`,
  top: `${14 + ((index * 19) % 66)}%`,
  delay: `${index * 95}ms`,
  depth: `${index % 2 ? 26 : -22}px`,
}));
const ticks = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  angle: `${index * 15}deg`,
}));
</script>

<template>
  <div class="floating-hud-effect">
    <div class="hud-reticle">
      <span v-for="tick in ticks" :key="tick.id" :style="{ '--tick-angle': tick.angle }" />
    </div>
    <span
      v-for="panel in panels"
      :key="panel.id"
      class="hud-panel"
      :style="{ left: panel.left, top: panel.top, '--panel-depth': panel.depth, animationDelay: panel.delay }"
    >
      <i />
      <b />
    </span>
    <div class="hud-cabin">
      <Radar :size="54" />
      <strong>驾驶舱 HUD</strong>
    </div>
  </div>
</template>

<style scoped>
.floating-hud-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  perspective: 900px;
}

.floating-hud-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(820px, 92vw);
  height: min(520px, 78vh);
  border: 1px solid rgba(34, 211, 238, 0.28);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateX(62deg);
  opacity: 0;
  animation: hud-orbit 5.2s ease both;
}

.hud-reticle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(360px, 58vw);
  aspect-ratio: 1;
  border: 1px solid rgba(34, 211, 238, 0.44);
  border-radius: 50%;
  box-shadow:
    inset 0 0 30px rgba(34, 211, 238, 0.12),
    0 0 48px rgba(34, 211, 238, 0.16);
  transform: translate(-50%, -50%) rotateX(18deg);
  animation: hud-reticle 5.2s ease both;
}

.hud-reticle span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 24px;
  border-radius: 999px;
  background: rgba(125, 249, 255, 0.74);
  transform: rotate(var(--tick-angle)) translateY(-172px);
  transform-origin: center 172px;
}

.hud-panel {
  position: absolute;
  width: 132px;
  height: 72px;
  border: 1px solid rgba(125, 249, 255, 0.46);
  border-radius: 9px;
  background:
    linear-gradient(135deg, rgba(34, 211, 238, 0.18), transparent 54%),
    rgba(2, 6, 23, 0.32);
  box-shadow: 0 0 32px rgba(34, 211, 238, 0.16);
  opacity: 0;
  transform: translate(-50%, -50%) translateZ(var(--panel-depth)) rotateY(-10deg);
  animation: hud-panel 4.8s ease both;
}

.hud-panel i,
.hud-panel b {
  position: absolute;
  left: 14px;
  right: 14px;
  height: 4px;
  border-radius: 999px;
  background: rgba(125, 249, 255, 0.72);
}

.hud-panel i {
  top: 18px;
}

.hud-panel b {
  top: 34px;
  width: 48%;
}

.hud-cabin {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #e0f2fe;
  transform: translate(-50%, -50%) translateZ(56px);
  animation: hud-cabin 5.2s ease both;
}

.hud-cabin strong {
  font-size: 16px;
}

@keyframes hud-orbit {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotateX(62deg) scale(0.82); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) rotateX(62deg) scale(1); }
}

@keyframes hud-reticle {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotateX(18deg) rotate(0deg) scale(0.76); }
  20%, 78% { opacity: 1; }
  100% { transform: translate(-50%, -50%) rotateX(18deg) rotate(92deg) scale(1.08); }
}

@keyframes hud-panel {
  0%, 100% { opacity: 0; transform: translate(-50%, -38%) translateZ(var(--panel-depth)) rotateY(-18deg) scale(0.86); }
  24%, 78% { opacity: 1; transform: translate(-50%, -50%) translateZ(var(--panel-depth)) rotateY(0deg) scale(1); }
  52% { transform: translate(calc(-50% + 8px), calc(-50% - 4px)) translateZ(var(--panel-depth)) rotateY(5deg) scale(1.02); }
}

@keyframes hud-cabin {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) translateZ(56px) scale(0.86); }
  20%, 78% { opacity: 1; transform: translate(-50%, -50%) translateZ(56px) scale(1); }
}
</style>
