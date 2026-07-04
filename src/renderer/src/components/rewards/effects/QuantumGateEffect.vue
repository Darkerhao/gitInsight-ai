<script setup lang="ts">
import { Orbit } from 'lucide-vue-next';

const rings = Array.from({ length: 9 }, (_, index) => ({
  id: index,
  size: `${92 + index * 48}px`,
  delay: `${index * 105}ms`,
  rotate: `${index % 2 === 0 ? 1 : -1}`,
}));
const particles = Array.from({ length: 56 }, (_, index) => ({
  id: index,
  angle: `${index * 6.43}deg`,
  delay: `${(index % 14) * 54}ms`,
  radius: `${90 + (index % 7) * 20}px`,
  hue: `${220 + (index % 5) * 18}`,
}));
</script>

<template>
  <div class="quantum-gate-effect">
    <span
      v-for="ring in rings"
      :key="ring.id"
      class="quantum-ring"
      :style="{ width: ring.size, height: ring.size, animationDelay: ring.delay, '--ring-rotate': ring.rotate }"
    />
    <span
      v-for="particle in particles"
      :key="particle.id"
      class="quantum-particle"
      :style="{
        '--particle-angle': particle.angle,
        '--particle-radius': particle.radius,
        '--particle-hue': particle.hue,
        animationDelay: particle.delay,
      }"
    />
    <div class="quantum-core">
      <Orbit :size="56" />
      <strong>量子虫洞</strong>
    </div>
  </div>
</template>

<style scoped>
.quantum-gate-effect {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.quantum-gate-effect::before {
  content: '';
  position: absolute;
  width: min(440px, 76vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.72) 0 4%, rgba(129, 140, 248, 0.34) 8%, transparent 58%),
    conic-gradient(from 0deg, rgba(129, 140, 248, 0.04), rgba(34, 211, 238, 0.32), rgba(244, 114, 182, 0.24), rgba(129, 140, 248, 0.04));
  filter: blur(1px);
  opacity: 0;
  animation: quantum-core-light 5.6s ease both;
}

.quantum-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border: 1px solid rgba(129, 140, 248, 0.38);
  border-radius: 50%;
  box-shadow:
    inset 0 0 18px rgba(129, 140, 248, 0.16),
    0 0 28px rgba(34, 211, 238, 0.16);
  opacity: 0;
  transform: translate(-50%, -50%) rotateX(72deg) rotateZ(0deg);
  animation: quantum-ring 5.6s ease both;
}

.quantum-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--particle-hue), 92%, 70%);
  box-shadow: 0 0 18px hsl(var(--particle-hue), 92%, 66%);
  opacity: 0;
  transform: rotate(var(--particle-angle)) translateX(var(--particle-radius));
  transform-origin: center;
  animation: quantum-particle 2.2s ease-in-out both;
}

.quantum-core {
  position: relative;
  z-index: 1;
  min-width: 202px;
  border: 1px solid rgba(129, 140, 248, 0.4);
  border-radius: 10px;
  background: rgba(30, 27, 75, 0.5);
  color: #e0e7ff;
  display: grid;
  gap: 10px;
  place-items: center;
  padding: 24px 30px;
  box-shadow:
    inset 0 0 30px rgba(129, 140, 248, 0.16),
    0 28px 80px rgba(129, 140, 248, 0.2);
  animation: quantum-panel 5.6s ease both;
}

.quantum-core svg {
  color: #a5b4fc;
  filter: drop-shadow(0 0 26px rgba(129, 140, 248, 0.7));
}

.quantum-core strong {
  font-size: 19px;
}

@keyframes quantum-core-light {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.62) rotate(0deg);
  }
  18%,
  82% {
    opacity: 1;
  }
  100% {
    transform: scale(1.12) rotate(180deg);
  }
}

@keyframes quantum-ring {
  0%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotateX(72deg) rotateZ(0deg) scale(0.82);
  }
  18%,
  82% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotateX(72deg) rotateZ(calc(120deg * var(--ring-rotate))) scale(1.08);
  }
}

@keyframes quantum-particle {
  0% {
    opacity: 0;
    transform: rotate(var(--particle-angle)) translateX(calc(var(--particle-radius) * 0.36)) scale(0.4);
  }
  44% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(calc(var(--particle-angle) + 126deg)) translateX(var(--particle-radius)) scale(1);
  }
}

@keyframes quantum-panel {
  0% {
    opacity: 0;
    transform: scale(0.88);
  }
  18%,
  78% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.96);
  }
}
</style>
