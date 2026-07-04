<script setup lang="ts">
import { Bike } from 'lucide-vue-next';

const trails = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  top: `${18 + ((index * 11) % 62)}%`,
  delay: `${index * 48}ms`,
  width: `${28 + (index % 6) * 8}vw`,
  hue: `${185 + (index % 5) * 28}`,
}));
const shards = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 13) % 84)}%`,
  top: `${18 + ((index * 17) % 62)}%`,
  delay: `${index * 55}ms`,
}));
</script>

<template>
  <div class="velocity-trail-effect">
    <span
      v-for="trail in trails"
      :key="trail.id"
      class="velocity-trail"
      :style="{
        top: trail.top,
        width: trail.width,
        animationDelay: trail.delay,
        '--trail-hue': trail.hue,
      }"
    />
    <span
      v-for="shard in shards"
      :key="shard.id"
      class="velocity-shard"
      :style="{ left: shard.left, top: shard.top, animationDelay: shard.delay }"
    />
    <div class="velocity-road">
      <span v-for="index in 7" :key="index" />
    </div>
    <div class="velocity-bike">
      <Bike :size="62" />
      <strong>骑行速度光轨</strong>
    </div>
  </div>
</template>

<style scoped>
.velocity-trail-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: velocity-shake 220ms linear 8;
}

.velocity-trail {
  position: absolute;
  right: 50%;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, hsl(var(--trail-hue), 94%, 66%), rgba(255, 255, 255, 0.92));
  box-shadow: 0 0 22px hsl(var(--trail-hue), 94%, 62%);
  opacity: 0;
  transform: translateX(-18vw) skewX(-18deg) scaleX(0.18);
  animation: velocity-trail 1.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.velocity-shard {
  position: absolute;
  width: 7px;
  height: 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 14px rgba(34, 211, 238, 0.78);
  opacity: 0;
  transform: rotate(-18deg);
  animation: velocity-shard 1.4s ease-out both;
}

.velocity-road {
  position: absolute;
  left: 50%;
  bottom: 14%;
  width: min(720px, 92vw);
  height: 160px;
  overflow: hidden;
  transform: translateX(-50%) perspective(500px) rotateX(62deg);
}

.velocity-road::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 48%, rgba(34, 211, 238, 0.46) 49% 51%, transparent 52%),
    repeating-linear-gradient(90deg, transparent 0 66px, rgba(244, 114, 182, 0.26) 67px 69px);
  opacity: 0;
  animation: velocity-road 4.8s ease both;
}

.velocity-road span {
  position: absolute;
  left: 50%;
  top: calc(var(--road-index, 1) * 18px);
  width: 58px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  transform: translateX(-50%);
  animation: velocity-road-mark 760ms linear infinite;
}

.velocity-road span:nth-child(1) { --road-index: 1; animation-delay: 0ms; }
.velocity-road span:nth-child(2) { --road-index: 2; animation-delay: 90ms; }
.velocity-road span:nth-child(3) { --road-index: 3; animation-delay: 180ms; }
.velocity-road span:nth-child(4) { --road-index: 4; animation-delay: 270ms; }
.velocity-road span:nth-child(5) { --road-index: 5; animation-delay: 360ms; }
.velocity-road span:nth-child(6) { --road-index: 6; animation-delay: 450ms; }
.velocity-road span:nth-child(7) { --road-index: 7; animation-delay: 540ms; }

.velocity-bike {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #f0f9ff;
  text-shadow: 0 0 20px rgba(14, 165, 233, 0.82);
  transform: translate(-50%, -50%);
  animation: velocity-bike 4.8s ease both;
}

.velocity-bike strong {
  font-size: 16px;
}

@keyframes velocity-trail {
  0% { opacity: 0; transform: translateX(24vw) skewX(-18deg) scaleX(0.18); }
  14%, 78% { opacity: 1; }
  100% { opacity: 0; transform: translateX(-44vw) skewX(-18deg) scaleX(1.15); }
}

@keyframes velocity-shard {
  0% { opacity: 0; transform: translateX(28vw) rotate(-18deg) scaleX(0.4); }
  22%, 68% { opacity: 1; }
  100% { opacity: 0; transform: translateX(-36vw) rotate(-18deg) scaleX(1.4); }
}

@keyframes velocity-road {
  0%, 100% { opacity: 0; }
  16%, 78% { opacity: 1; }
}

@keyframes velocity-road-mark {
  from { transform: translate(-50%, -120px) scaleX(0.48); opacity: 0; }
  40% { opacity: 1; }
  to { transform: translate(-50%, 190px) scaleX(1.7); opacity: 0; }
}

@keyframes velocity-bike {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  44% { transform: translate(calc(-50% + 8px), calc(-50% - 3px)) scale(1.03); }
  58% { transform: translate(calc(-50% - 6px), calc(-50% + 2px)) scale(1); }
}

@keyframes velocity-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  33% { transform: translate3d(1px, -1px, 0); }
  66% { transform: translate3d(-1px, 1px, 0); }
}
</style>
