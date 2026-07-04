<script setup lang="ts">
import { Rocket } from 'lucide-vue-next';

const rays = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  angle: `${index * 8.57}deg`,
  delay: `${(index % 9) * 44}ms`,
  length: `${120 + (index % 6) * 42}px`,
}));
const rings = Array.from({ length: 5 }, (_, index) => ({
  id: index,
  delay: `${index * 220}ms`,
}));
</script>

<template>
  <div class="warp-effect">
    <span
      v-for="ray in rays"
      :key="ray.id"
      class="warp-ray"
      :style="{ '--warp-angle': ray.angle, '--warp-length': ray.length, animationDelay: ray.delay }"
    />
    <span
      v-for="ring in rings"
      :key="ring.id"
      class="warp-ring"
      :style="{ animationDelay: ring.delay }"
    />
    <div class="warp-ship">
      <Rocket :size="54" />
    </div>
  </div>
</template>

<style scoped>
.warp-effect {
  position: absolute;
  inset: 0;
}

.warp-ray {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--warp-length);
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.92), rgba(96, 165, 250, 0.72), transparent);
  opacity: 0;
  transform: rotate(var(--warp-angle)) translateX(0) scaleX(0.08);
  transform-origin: left center;
  animation: warp-ray 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.warp-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 120px;
  height: 120px;
  border: 1px solid rgba(147, 197, 253, 0.78);
  border-radius: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.34);
  box-shadow: 0 0 36px rgba(96, 165, 250, 0.36);
  animation: warp-ring 2.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.warp-ship {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.36);
  color: #bfdbfe;
  display: grid;
  place-items: center;
  box-shadow:
    0 0 0 18px rgba(96, 165, 250, 0.08),
    0 0 70px rgba(96, 165, 250, 0.34);
  transform: translate(-50%, -50%);
  animation: warp-ship 4.2s ease both;
}

@keyframes warp-ray {
  0% {
    opacity: 0;
    transform: rotate(var(--warp-angle)) translateX(0) scaleX(0.06);
  }
  28% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--warp-angle)) translateX(28vw) scaleX(1);
  }
}

@keyframes warp-ring {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.34);
  }
  20% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(5.8);
  }
}

@keyframes warp-ship {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.78) rotate(-18deg);
  }
  18%,
  68% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + 160px), calc(-50% - 120px)) scale(0.52) rotate(16deg);
  }
}
</style>
