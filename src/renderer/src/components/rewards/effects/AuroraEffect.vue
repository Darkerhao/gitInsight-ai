<script setup lang="ts">
import { Gem } from 'lucide-vue-next';

const bands = Array.from({ length: 6 }, (_, index) => ({
  id: index,
  top: `${12 + index * 10}%`,
  delay: `${index * 160}ms`,
  hue: `${146 + index * 24}`,
  height: `${86 + index * 18}px`,
}));
const stars = Array.from({ length: 44 }, (_, index) => ({
  id: index,
  left: `${4 + ((index * 23) % 92)}%`,
  top: `${8 + ((index * 31) % 76)}%`,
  delay: `${(index % 9) * 120}ms`,
}));
</script>

<template>
  <div class="aurora-effect">
    <span
      v-for="band in bands"
      :key="band.id"
      class="aurora-band"
      :style="{ top: band.top, height: band.height, animationDelay: band.delay, '--aurora-hue': band.hue }"
    />
    <span
      v-for="star in stars"
      :key="star.id"
      class="aurora-star"
      :style="{ left: star.left, top: star.top, animationDelay: star.delay }"
    />
    <div class="aurora-core">
      <Gem :size="46" />
      <strong>极光天幕</strong>
    </div>
  </div>
</template>

<style scoped>
.aurora-effect {
  position: absolute;
  inset: 0;
}

.aurora-band {
  position: absolute;
  left: -14%;
  width: 128%;
  border-radius: 50%;
  background:
    linear-gradient(90deg, transparent, hsla(var(--aurora-hue), 82%, 62%, 0.44), rgba(96, 165, 250, 0.32), transparent);
  filter: blur(16px);
  opacity: 0;
  transform: skewY(-7deg) translateX(-10%);
  animation: aurora-band-flow 5.2s ease-in-out both;
}

.aurora-star {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.84);
  opacity: 0;
  animation: aurora-star 2.2s ease-in-out both;
}

.aurora-core {
  position: absolute;
  left: 50%;
  top: 50%;
  color: #d1fae5;
  display: grid;
  gap: 9px;
  place-items: center;
  text-shadow: 0 0 24px rgba(34, 197, 94, 0.45);
  transform: translate(-50%, -50%);
  animation: aurora-core 5.2s ease both;
}

.aurora-core svg {
  color: #86efac;
  filter: drop-shadow(0 0 24px rgba(34, 197, 94, 0.58));
}

.aurora-core strong {
  font-size: 18px;
}

@keyframes aurora-band-flow {
  0% {
    opacity: 0;
    transform: skewY(-7deg) translateX(-12%) scaleY(0.6);
  }
  18%,
  82% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: skewY(5deg) translateX(12%) scaleY(1.1);
  }
}

@keyframes aurora-star {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.3);
  }
  46% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes aurora-core {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.88);
  }
  18%,
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.94);
  }
}
</style>
