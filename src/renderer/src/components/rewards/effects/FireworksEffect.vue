<script setup lang="ts">
import { PartyPopper } from 'lucide-vue-next';

const bursts = Array.from({ length: 9 }, (_, index) => ({
  id: index,
  left: `${12 + ((index * 13) % 78)}%`,
  top: `${16 + ((index * 19) % 48)}%`,
  delay: `${index * 145}ms`,
  hue: `${32 + ((index * 47) % 310)}`,
  scale: `${0.86 + (index % 4) * 0.12}`,
}));
const sparks = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  angle: `${index * 12.85}deg`,
  distance: `${74 + (index % 5) * 12}px`,
}));
const trails = Array.from({ length: 7 }, (_, index) => ({
  id: index,
  left: `${10 + ((index * 15) % 82)}%`,
  delay: `${index * 170}ms`,
  hue: `${42 + index * 36}`,
}));
</script>

<template>
  <div class="fireworks-effect">
    <span
      v-for="trail in trails"
      :key="trail.id"
      class="firework-trail"
      :style="{ left: trail.left, animationDelay: trail.delay, '--firework-hue': trail.hue }"
    />
    <span
      v-for="burst in bursts"
      :key="burst.id"
      class="firework-burst"
      :style="{
        left: burst.left,
        top: burst.top,
        animationDelay: burst.delay,
        '--firework-hue': burst.hue,
        '--burst-scale': burst.scale,
      }"
    >
      <i
        v-for="spark in sparks"
        :key="spark.id"
        :style="{ '--spark-angle': spark.angle, '--spark-distance': spark.distance }"
      />
    </span>
    <div class="effect-signature">
      <PartyPopper :size="28" />
      <strong>臻彩烟花</strong>
    </div>
  </div>
</template>

<style scoped>
.fireworks-effect {
  position: absolute;
  inset: 0;
}

.effect-signature {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.46);
  color: #fff;
  padding: 10px 16px;
  transform: translateX(-50%);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
  animation: reward-label 4.2s ease both;
}

.effect-signature strong {
  font-size: 16px;
}

.firework-trail {
  position: absolute;
  bottom: -16%;
  width: 3px;
  height: 34vh;
  border-radius: 999px;
  background: linear-gradient(0deg, transparent, hsl(var(--firework-hue), 96%, 68%));
  filter: drop-shadow(0 0 14px hsl(var(--firework-hue), 96%, 62%));
  opacity: 0;
  transform: translateY(20vh);
  animation: firework-trail-rise 1.1s ease-out both;
}

.firework-burst {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: hsl(var(--firework-hue), 94%, 62%);
  box-shadow:
    0 0 24px hsl(var(--firework-hue), 94%, 62%),
    0 0 62px hsl(var(--firework-hue), 94%, 54%);
  transform: translate(-50%, -50%) scale(0);
  animation: firework-core 1.48s ease-out both;
}

.firework-burst::before,
.firework-burst::after {
  content: '';
  position: absolute;
  inset: -24px;
  border: 1px solid hsl(var(--firework-hue), 94%, 68%);
  border-radius: 50%;
  opacity: 0;
  animation: firework-ring 1.48s ease-out both;
}

.firework-burst::after {
  inset: -42px;
  animation-delay: 120ms;
}

.firework-burst i {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 22px;
  border-radius: 999px;
  background: hsl(var(--firework-hue), 94%, 66%);
  box-shadow: 0 0 14px hsl(var(--firework-hue), 94%, 62%);
  transform: rotate(var(--spark-angle)) translateY(0) scaleY(0.35);
  transform-origin: center -2px;
  animation: firework-spark 1.48s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: inherit;
}

@keyframes reward-label {
  0% {
    opacity: 0;
    transform: translate(-50%, 16px) scale(0.94);
  }
  18%,
  78% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -10px) scale(0.98);
  }
}

@keyframes firework-trail-rise {
  0% {
    opacity: 0;
    transform: translateY(20vh) scaleY(0.4);
  }
  24% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-80vh) scaleY(1);
  }
}

@keyframes firework-core {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(calc(var(--burst-scale) * 1));
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.18);
  }
}

@keyframes firework-ring {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }
  18% {
    opacity: 0.78;
  }
  100% {
    opacity: 0;
    transform: scale(1.7);
  }
}

@keyframes firework-spark {
  0% {
    opacity: 0;
    transform: rotate(var(--spark-angle)) translateY(0) scaleY(0.25);
  }
  16% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--spark-angle)) translateY(calc(var(--spark-distance) * -1)) scaleY(1);
  }
}
</style>
