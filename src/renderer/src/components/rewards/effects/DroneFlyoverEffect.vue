<script setup lang="ts">
import { Plane } from 'lucide-vue-next';

const towers = Array.from({ length: 48 }, (_, index) => ({
  id: index,
  height: `${18 + ((index * 17) % 78)}px`,
  delay: `${(index % 8) * 52}ms`,
}));
const hudMarks = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  left: `${10 + ((index * 19) % 78)}%`,
  top: `${12 + ((index * 31) % 72)}%`,
}));
</script>

<template>
  <div class="drone-flyover-effect">
    <span
      v-for="mark in hudMarks"
      :key="mark.id"
      class="drone-mark"
      :style="{ left: mark.left, top: mark.top }"
    />
    <div class="drone-city">
      <span
        v-for="tower in towers"
        :key="tower.id"
        class="drone-tower"
        :style="{ height: tower.height, animationDelay: tower.delay }"
      />
    </div>
    <div class="drone-camera">
      <Plane :size="56" />
      <strong>无人机飞行视角</strong>
    </div>
  </div>
</template>

<style scoped>
.drone-flyover-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  perspective: 800px;
}

.drone-city {
  position: absolute;
  left: 50%;
  top: 58%;
  width: min(820px, 92vw);
  height: min(440px, 64vh);
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: end;
  gap: 9px;
  padding: 24px;
  transform: translate(-50%, -50%) rotateX(62deg) translateZ(-80px);
  transform-origin: center bottom;
  animation: drone-city 5.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.drone-city::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(45, 212, 191, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.18) 1px, transparent 1px);
  background-size: 44px 44px;
}

.drone-tower {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(45, 212, 191, 0.36), rgba(14, 165, 233, 0.08));
  box-shadow: 0 0 22px rgba(45, 212, 191, 0.14);
  opacity: 0;
  transform-origin: center bottom;
  animation: drone-tower 3.2s ease both;
}

.drone-mark {
  position: absolute;
  width: 36px;
  height: 24px;
  border: 1px solid rgba(125, 249, 255, 0.5);
  border-radius: 5px;
  opacity: 0;
  animation: drone-mark 1.8s ease-in-out infinite;
}

.drone-mark::before,
.drone-mark::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 1px;
  background: rgba(125, 249, 255, 0.72);
}

.drone-mark::before {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.drone-mark::after {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
}

.drone-camera {
  position: absolute;
  left: 50%;
  top: 38%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #ccfbf1;
  transform: translate(-50%, -50%);
  animation: drone-camera 5.2s ease both;
}

.drone-camera strong {
  font-size: 16px;
}

@keyframes drone-city {
  0% { opacity: 0; transform: translate(-50%, -8%) rotateX(62deg) translateZ(-260px) scale(1.42); }
  20%, 80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -74%) rotateX(62deg) translateZ(100px) scale(0.76); }
}

@keyframes drone-tower {
  0% { opacity: 0; transform: scaleY(0.18); }
  28%, 84% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(0.86); }
}

@keyframes drone-mark {
  0%, 100% { opacity: 0; transform: scale(0.86); }
  50% { opacity: 0.9; transform: scale(1); }
}

@keyframes drone-camera {
  0%, 100% { opacity: 0; transform: translate(-50%, -40%) scale(0.82); }
  18%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
