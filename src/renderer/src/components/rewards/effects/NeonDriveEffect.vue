<script setup lang="ts">
import { Zap } from 'lucide-vue-next';

const speedLines = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  top: `${8 + ((index * 17) % 82)}%`,
  delay: `${(index % 11) * 54}ms`,
  length: `${70 + (index % 5) * 42}px`,
  side: index % 2 === 0 ? 'left' : 'right',
}));
const roadMarks = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  delay: `${index * 90}ms`,
}));
</script>

<template>
  <div class="neon-drive-effect">
    <div class="neon-skyline">
      <span v-for="index in 18" :key="index" :style="{ '--tower': `${34 + (index % 6) * 18}px` }" />
    </div>
    <div class="neon-road">
      <span v-for="mark in roadMarks" :key="mark.id" class="road-mark" :style="{ animationDelay: mark.delay }" />
    </div>
    <span
      v-for="line in speedLines"
      :key="line.id"
      class="speed-line"
      :class="line.side"
      :style="{ top: line.top, width: line.length, animationDelay: line.delay }"
    />
    <div class="neon-dashboard">
      <Zap :size="46" />
      <strong>霓虹疾驰</strong>
      <small>NITRO DRIVE</small>
    </div>
  </div>
</template>

<style scoped>
.neon-drive-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, transparent 0 52%, rgba(244, 114, 182, 0.12) 52% 100%),
    radial-gradient(circle at 50% 76%, rgba(34, 211, 238, 0.2), transparent 38%);
}

.neon-skyline {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 44%;
  display: flex;
  align-items: end;
  justify-content: space-between;
  opacity: 0;
  animation: skyline-in 5.2s ease both;
}

.neon-skyline span {
  width: 3.4%;
  height: var(--tower);
  border: 1px solid rgba(34, 211, 238, 0.24);
  background:
    repeating-linear-gradient(180deg, rgba(244, 114, 182, 0.36) 0 2px, transparent 2px 8px),
    rgba(15, 23, 42, 0.42);
  box-shadow: 0 0 18px rgba(244, 114, 182, 0.2);
}

.neon-road {
  position: absolute;
  left: 50%;
  bottom: -12%;
  width: min(780px, 120vw);
  height: 58vh;
  transform: translateX(-50%) perspective(520px) rotateX(62deg);
  transform-origin: center bottom;
  background:
    linear-gradient(90deg, transparent 0 13%, rgba(34, 211, 238, 0.55) 13.4%, transparent 14%, transparent 86%, rgba(244, 114, 182, 0.55) 86.6%, transparent 87%),
    repeating-linear-gradient(90deg, transparent 0 64px, rgba(34, 211, 238, 0.22) 65px 66px),
    repeating-linear-gradient(0deg, transparent 0 42px, rgba(244, 114, 182, 0.24) 43px 44px);
  filter: drop-shadow(0 0 22px rgba(34, 211, 238, 0.32));
  animation: road-pulse 5.2s ease both;
}

.road-mark {
  position: absolute;
  left: 50%;
  top: 0;
  width: 8px;
  height: 74px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.56);
  opacity: 0;
  transform: translateX(-50%);
  animation: road-mark 760ms linear infinite;
}

.speed-line {
  position: absolute;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.92), rgba(244, 114, 182, 0.78));
  opacity: 0;
  animation: speed-line 820ms cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.speed-line.left {
  left: -12%;
}

.speed-line.right {
  right: -12%;
  transform: rotate(180deg);
}

.neon-dashboard {
  position: absolute;
  left: 50%;
  top: 48%;
  min-width: 210px;
  border: 1px solid rgba(244, 114, 182, 0.36);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.42);
  color: #fbcfe8;
  display: grid;
  gap: 7px;
  place-items: center;
  padding: 20px 28px;
  text-align: center;
  box-shadow:
    inset 0 0 28px rgba(244, 114, 182, 0.12),
    0 24px 70px rgba(34, 211, 238, 0.16);
  transform: translate(-50%, -50%);
  animation: dashboard-pop 5.2s ease both;
}

.neon-dashboard svg {
  color: #f472b6;
  filter: drop-shadow(0 0 24px rgba(244, 114, 182, 0.64));
}

.neon-dashboard strong {
  font-size: 19px;
}

.neon-dashboard small {
  color: #67e8f9;
  font-weight: 800;
  letter-spacing: 0.12em;
}

@keyframes skyline-in {
  0%,
  100% {
    opacity: 0;
    transform: translateY(18px);
  }
  18%,
  82% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes road-pulse {
  0%,
  100% {
    opacity: 0;
  }
  16%,
  84% {
    opacity: 1;
  }
}

@keyframes road-mark {
  0% {
    opacity: 0;
    transform: translate(-50%, -40px) scaleY(0.4);
  }
  24% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 58vh) scaleY(1.5);
  }
}

@keyframes speed-line {
  0% {
    opacity: 0;
    transform: translateX(0) scaleX(0.3);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(62vw) scaleX(1);
  }
}

@keyframes dashboard-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.9);
  }
  18%,
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}
</style>
