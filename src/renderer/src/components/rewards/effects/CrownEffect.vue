<script setup lang="ts">
import { Crown } from 'lucide-vue-next';

const rays = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  angle: `${index * 12}deg`,
  delay: `${(index % 6) * 58}ms`,
}));
const gems = Array.from({ length: 38 }, (_, index) => ({
  id: index,
  left: `${5 + ((index * 19) % 90)}%`,
  top: `${12 + ((index * 23) % 74)}%`,
  delay: `${(index % 10) * 88}ms`,
  scale: `${0.7 + (index % 5) * 0.09}`,
}));
const halos = Array.from({ length: 4 }, (_, index) => ({
  id: index,
  delay: `${index * 190}ms`,
}));
</script>

<template>
  <div class="crown-effect">
    <span
      v-for="ray in rays"
      :key="ray.id"
      class="crown-ray"
      :style="{ '--crown-angle': ray.angle, animationDelay: ray.delay }"
    />
    <span
      v-for="halo in halos"
      :key="halo.id"
      class="crown-halo"
      :style="{ animationDelay: halo.delay }"
    />
    <span
      v-for="gem in gems"
      :key="gem.id"
      class="crown-gem"
      :style="{ left: gem.left, top: gem.top, animationDelay: gem.delay, '--gem-scale': gem.scale }"
    />
    <div class="crown-emblem">
      <Crown :size="58" />
      <strong>荣耀加冕</strong>
    </div>
  </div>
</template>

<style scoped>
.crown-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.crown-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 76vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(254, 240, 138, 0.38), rgba(250, 204, 21, 0.18) 34%, transparent 70%);
  filter: blur(10px);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.62);
  animation: crown-aura 4.8s ease both;
}

.crown-ray {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 48vh;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(250, 204, 21, 0.78), transparent);
  opacity: 0;
  transform: rotate(var(--crown-angle)) translateY(-8vh) scaleY(0.2);
  transform-origin: center bottom;
  animation: crown-ray 2.4s ease-out both;
}

.crown-halo {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 160px;
  height: 160px;
  border: 1px solid rgba(254, 240, 138, 0.62);
  border-radius: 50%;
  box-shadow:
    inset 0 0 28px rgba(250, 204, 21, 0.2),
    0 0 42px rgba(250, 204, 21, 0.28);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.34);
  animation: crown-halo 2.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.crown-gem {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: #fde68a;
  box-shadow: 0 0 18px rgba(250, 204, 21, 0.86);
  opacity: 0;
  transform: rotate(45deg) scale(var(--gem-scale));
  animation: crown-gem 1.6s ease-in-out both;
}

.crown-emblem {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 198px;
  height: 198px;
  border: 1px solid rgba(250, 204, 21, 0.56);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 32%, rgba(255, 255, 255, 0.98), rgba(254, 243, 199, 0.9) 42%, rgba(202, 138, 4, 0.2) 100%),
    linear-gradient(135deg, rgba(250, 204, 21, 0.28), transparent);
  color: #854d0e;
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  padding: 0;
  box-shadow:
    0 34px 90px rgba(66, 32, 6, 0.28),
    0 0 70px rgba(250, 204, 21, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden;
  transform: translate(-50%, -50%);
  animation: crown-emblem 4.8s ease both;
}

.crown-emblem::before {
  content: '';
  position: absolute;
  inset: -18px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(250, 204, 21, 0.76), rgba(255, 255, 255, 0.74), transparent 42%);
  opacity: 0.72;
  animation: crown-rotate 2.8s linear infinite;
}

.crown-emblem::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 0 38%, rgba(255, 255, 255, 0.72) 47%, transparent 57%);
  transform: translateX(-120%);
  animation: crown-shine 2.1s ease-in-out 560ms both;
}

.crown-emblem svg {
  position: relative;
  z-index: 1;
  color: #ca8a04;
  filter: drop-shadow(0 12px 24px rgba(202, 138, 4, 0.34));
}

.crown-emblem strong {
  position: relative;
  z-index: 1;
  font-size: 18px;
}

:root[data-theme='dark'] .crown-emblem {
  border-color: rgba(250, 204, 21, 0.42);
  background:
    radial-gradient(circle at 50% 30%, rgba(250, 204, 21, 0.28), rgba(22, 29, 41, 0.92) 58%),
    rgba(22, 29, 41, 0.9);
  color: #fde68a;
}

@keyframes crown-aura {
  0%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.62);
  }
  20%,
  80% {
    opacity: 1;
  }
  54% {
    transform: translate(-50%, -50%) scale(1.12);
  }
}

@keyframes crown-ray {
  0% {
    opacity: 0;
    transform: rotate(var(--crown-angle)) translateY(-8vh) scaleY(0.18);
  }
  18%,
  72% {
    opacity: 0.72;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--crown-angle)) translateY(-24vh) scaleY(1);
  }
}

@keyframes crown-halo {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.34);
  }
  18% {
    opacity: 0.92;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(4.2);
  }
}

@keyframes crown-gem {
  0%,
  100% {
    opacity: 0;
    transform: rotate(45deg) scale(0.2);
  }
  42% {
    opacity: 1;
    transform: rotate(45deg) scale(var(--gem-scale));
  }
}

@keyframes crown-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes crown-shine {
  to {
    transform: translateX(120%);
  }
}

@keyframes crown-emblem {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.88);
  }
  18%,
  76% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}
</style>
