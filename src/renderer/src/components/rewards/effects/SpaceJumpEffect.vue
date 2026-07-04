<script setup lang="ts">
import { Expand } from 'lucide-vue-next';

const streaks = Array.from({ length: 44 }, (_, index) => ({
  id: index,
  angle: `${index * 8.18}deg`,
  length: `${90 + (index % 7) * 28}px`,
  delay: `${(index % 11) * 34}ms`,
}));
const portals = Array.from({ length: 5 }, (_, index) => ({
  id: index,
  delay: `${index * 160}ms`,
}));
</script>

<template>
  <div class="space-jump-effect">
    <span
      v-for="streak in streaks"
      :key="streak.id"
      class="space-streak"
      :style="{
        '--streak-angle': streak.angle,
        '--streak-length': streak.length,
        animationDelay: streak.delay,
      }"
    />
    <span
      v-for="portal in portals"
      :key="portal.id"
      class="space-portal"
      :style="{ animationDelay: portal.delay }"
    />
    <div class="space-capsule">
      <Expand :size="56" />
      <strong>空间跃迁</strong>
    </div>
  </div>
</template>

<style scoped>
.space-jump-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: space-camera 5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.space-jump-effect::before,
.space-jump-effect::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.space-jump-effect::before {
  width: min(620px, 82vw);
  aspect-ratio: 1;
  background:
    conic-gradient(from 0deg, rgba(129, 140, 248, 0), rgba(129, 140, 248, 0.44), rgba(34, 211, 238, 0.32), rgba(129, 140, 248, 0));
  filter: blur(18px);
  opacity: 0;
  animation: space-lens 5s ease both;
}

.space-jump-effect::after {
  width: min(360px, 58vw);
  aspect-ratio: 1;
  border: 1px solid rgba(224, 231, 255, 0.5);
  box-shadow:
    inset 0 0 40px rgba(129, 140, 248, 0.22),
    0 0 70px rgba(129, 140, 248, 0.36);
  opacity: 0;
  animation: space-lens-ring 2.2s cubic-bezier(0.16, 1, 0.3, 1) 1.2s both;
}

.space-streak {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--streak-length);
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.95), rgba(129, 140, 248, 0.74), transparent);
  box-shadow: 0 0 16px rgba(129, 140, 248, 0.62);
  opacity: 0;
  transform: rotate(var(--streak-angle)) translateX(0) scaleX(0.12);
  transform-origin: left center;
  animation: space-streak 1.65s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.space-portal {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 118px;
  height: 118px;
  border: 1px solid rgba(199, 210, 254, 0.64);
  border-radius: 50%;
  box-shadow:
    inset 0 0 24px rgba(129, 140, 248, 0.2),
    0 0 42px rgba(129, 140, 248, 0.34),
    0 0 90px rgba(34, 211, 238, 0.16);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.28);
  animation: space-portal 2.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.space-capsule {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.28), rgba(2, 6, 23, 0.3) 68%, transparent);
  color: #e0e7ff;
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: space-capsule 5s ease both;
}

.space-capsule::before {
  content: '';
  position: absolute;
  inset: -22px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(129, 140, 248, 0.66), rgba(255, 255, 255, 0.6), transparent 45%);
  opacity: 0.74;
  animation: space-capsule-orbit 1.6s linear infinite;
}

.space-capsule svg,
.space-capsule strong {
  position: relative;
  z-index: 1;
}

.space-capsule strong {
  font-size: 16px;
}

@keyframes space-lens {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); }
  24%, 76% { opacity: 1; }
  58% { transform: translate(-50%, -50%) scale(1.2) rotate(140deg); }
}

@keyframes space-lens-ring {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  20% { opacity: 0.95; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(4.8); }
}

@keyframes space-camera {
  0% { filter: blur(0); transform: scale(1.18); }
  28% { filter: blur(2px); transform: scale(0.74); }
  54% { filter: blur(6px); transform: scale(1.46); }
  78% { filter: blur(0); transform: scale(1); }
  100% { filter: blur(8px); transform: scale(1.28); opacity: 0; }
}

@keyframes space-streak {
  0% { opacity: 0; transform: rotate(var(--streak-angle)) translateX(-10vw) scaleX(0.12); }
  20%, 72% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--streak-angle)) translateX(42vw) scaleX(1.2); }
}

@keyframes space-portal {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.28) rotate(0deg); }
  18%, 74% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(5.4) rotate(140deg); }
}

@keyframes space-capsule {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.68); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  48% { transform: translate(-50%, -50%) scale(0.72); }
  62% { transform: translate(-50%, -50%) scale(1.22); }
}

@keyframes space-capsule-orbit {
  to { transform: rotate(360deg); }
}
</style>
