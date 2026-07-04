<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';

const beams = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  left: `${5 + ((index * 29) % 90)}%`,
  top: `${8 + ((index * 19) % 78)}%`,
  delay: `${(index % 12) * 90}ms`,
  scale: `${0.66 + (index % 6) * 0.1}`,
}));
</script>

<template>
  <div class="sparkle-effect">
    <span class="sparkle-sash sash-one" />
    <span class="sparkle-sash sash-two" />
    <span class="sparkle-sash sash-three" />
    <span
      v-for="beam in beams"
      :key="beam.id"
      class="sparkle-beam"
      :style="{
        left: beam.left,
        top: beam.top,
        animationDelay: beam.delay,
        '--sparkle-scale': beam.scale,
      }"
    />
    <div class="sparkle-medallion">
      <Sparkles :size="44" />
    </div>
  </div>
</template>

<style scoped>
.sparkle-effect {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, transparent 0 34%, rgba(255, 255, 255, 0.22) 45%, transparent 56%),
    linear-gradient(120deg, transparent 18%, rgba(251, 191, 36, 0.2) 48%, transparent 78%);
  animation: sparkle-sweep 3.6s ease both;
}

.sparkle-sash {
  position: absolute;
  left: -18%;
  right: -18%;
  height: 18vh;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.34), rgba(255, 255, 255, 0.38), transparent);
  filter: blur(10px);
  transform: rotate(-12deg) translateX(-28%);
  opacity: 0;
  animation: sparkle-sash 3.6s ease both;
}

.sash-one {
  top: 18%;
}

.sash-two {
  top: 42%;
  animation-delay: 160ms;
}

.sash-three {
  top: 66%;
  animation-delay: 320ms;
}

.sparkle-beam {
  position: absolute;
  width: 14px;
  height: 14px;
  opacity: 0;
  transform: scale(var(--sparkle-scale));
  animation: sparkle-pulse 1.35s ease-in-out both;
}

.sparkle-beam::before,
.sparkle-beam::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 999px;
  background: #fbbf24;
  box-shadow: 0 0 18px rgba(251, 191, 36, 0.82);
}

.sparkle-beam::before {
  width: 3px;
  height: 22px;
}

.sparkle-beam::after {
  width: 22px;
  height: 3px;
}

.sparkle-medallion {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 88px;
  height: 88px;
  border: 1px solid rgba(251, 191, 36, 0.34);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  color: #d97706;
  display: grid;
  place-items: center;
  box-shadow:
    0 0 0 14px rgba(251, 191, 36, 0.08),
    0 24px 62px rgba(217, 119, 6, 0.18);
  animation: reward-medallion 3.6s ease both;
}

:root[data-theme='dark'] .sparkle-medallion {
  border-color: rgba(122, 162, 255, 0.24);
  background: rgba(22, 29, 41, 0.9);
  color: var(--c-text);
}

@keyframes sparkle-sweep {
  0% {
    opacity: 0;
    transform: translateX(-18%);
  }
  16%,
  78% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(18%);
  }
}

@keyframes sparkle-sash {
  0% {
    opacity: 0;
    transform: rotate(-12deg) translateX(-28%);
  }
  24%,
  76% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(-12deg) translateX(28%);
  }
}

@keyframes sparkle-pulse {
  0%,
  100% {
    opacity: 0;
  }
  42% {
    opacity: 1;
  }
}

@keyframes reward-medallion {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.78) rotate(-12deg);
  }
  18%,
  76% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9) rotate(8deg);
  }
}
</style>
