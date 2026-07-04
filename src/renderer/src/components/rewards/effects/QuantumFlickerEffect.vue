<script setup lang="ts">
import { Atom } from 'lucide-vue-next';

const ghosts = Array.from({ length: 7 }, (_, index) => ({
  id: index,
  x: `${(index - 3) * 18}px`,
  y: `${((index % 3) - 1) * 16}px`,
  hue: `${220 + index * 18}`,
  delay: `${index * 60}ms`,
}));
const particles = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  angle: `${index * 13.85}deg`,
  distance: `${96 + (index % 6) * 14}px`,
}));
</script>

<template>
  <div class="quantum-flicker-effect">
    <span
      v-for="particle in particles"
      :key="particle.id"
      class="quantum-particle"
      :style="{ '--particle-angle': particle.angle, '--particle-distance': particle.distance }"
    />
    <div class="quantum-stack">
      <span
        v-for="ghost in ghosts"
        :key="ghost.id"
        class="quantum-ghost"
        :style="{
          '--ghost-x': ghost.x,
          '--ghost-y': ghost.y,
          '--ghost-hue': ghost.hue,
          animationDelay: ghost.delay,
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

.quantum-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c4b5fd;
  box-shadow: 0 0 20px rgba(167, 139, 250, 0.88);
  opacity: 0;
  transform: rotate(var(--particle-angle)) translateY(0);
  animation: quantum-particle 2.4s ease both;
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

@keyframes quantum-particle {
  0% { opacity: 0; transform: rotate(var(--particle-angle)) translateY(calc(var(--particle-distance) * -1)) scale(0.5); }
  22%, 62% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--particle-angle)) translateY(0) scale(0.2); }
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
