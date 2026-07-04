<script setup lang="ts">
import { CircuitBoard } from 'lucide-vue-next';

const beams = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  top: `${6 + ((index * 13) % 86)}%`,
  delay: `${(index % 7) * 90}ms`,
  rotate: `${index % 2 === 0 ? -8 : 8}deg`,
}));
const nodes = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  left: `${5 + ((index * 23) % 90)}%`,
  top: `${9 + ((index * 31) % 76)}%`,
  delay: `${(index % 10) * 68}ms`,
}));
</script>

<template>
  <div class="laser-grid-effect">
    <div class="laser-floor" />
    <span
      v-for="beam in beams"
      :key="beam.id"
      class="laser-beam"
      :style="{ top: beam.top, animationDelay: beam.delay, '--beam-rotate': beam.rotate }"
    />
    <span
      v-for="node in nodes"
      :key="node.id"
      class="laser-node"
      :style="{ left: node.left, top: node.top, animationDelay: node.delay }"
    />
    <div class="laser-console">
      <CircuitBoard :size="48" />
      <strong>激光网格</strong>
    </div>
  </div>
</template>

<style scoped>
.laser-grid-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.laser-floor {
  position: absolute;
  left: 50%;
  bottom: -20%;
  width: min(900px, 130vw);
  height: 68vh;
  transform: translateX(-50%) perspective(560px) rotateX(64deg);
  transform-origin: center bottom;
  background:
    repeating-linear-gradient(90deg, transparent 0 52px, rgba(45, 212, 191, 0.3) 53px 54px),
    repeating-linear-gradient(0deg, transparent 0 42px, rgba(34, 211, 238, 0.24) 43px 44px);
  filter: drop-shadow(0 0 28px rgba(45, 212, 191, 0.32));
  opacity: 0;
  animation: floor-in 5s ease both;
}

.laser-beam {
  position: absolute;
  left: -12%;
  width: 124%;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.88), rgba(255, 255, 255, 0.72), transparent);
  box-shadow: 0 0 22px rgba(45, 212, 191, 0.5);
  opacity: 0;
  transform: rotate(var(--beam-rotate)) translateX(-18%);
  animation: beam-sweep 1.2s ease-in-out infinite;
}

.laser-node {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 1px solid rgba(45, 212, 191, 0.86);
  border-radius: 50%;
  box-shadow: 0 0 18px rgba(45, 212, 191, 0.7);
  opacity: 0;
  animation: node-flash 1.5s ease-in-out both;
}

.laser-console {
  position: absolute;
  left: 50%;
  top: 48%;
  min-width: 190px;
  border: 1px solid rgba(45, 212, 191, 0.36);
  border-radius: 10px;
  background: rgba(6, 78, 59, 0.42);
  color: #ccfbf1;
  display: grid;
  gap: 10px;
  place-items: center;
  padding: 22px 28px;
  box-shadow:
    inset 0 0 26px rgba(45, 212, 191, 0.12),
    0 24px 70px rgba(45, 212, 191, 0.16);
  transform: translate(-50%, -50%);
  animation: console-in 5s ease both;
}

.laser-console svg {
  color: #2dd4bf;
  filter: drop-shadow(0 0 22px rgba(45, 212, 191, 0.62));
}

.laser-console strong {
  font-size: 19px;
}

@keyframes floor-in {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-50%) perspective(560px) rotateX(64deg) translateY(40px);
  }
  16%,
  84% {
    opacity: 1;
    transform: translateX(-50%) perspective(560px) rotateX(64deg) translateY(0);
  }
}

@keyframes beam-sweep {
  0% {
    opacity: 0;
    transform: rotate(var(--beam-rotate)) translateX(-18%);
  }
  34% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--beam-rotate)) translateX(18%);
  }
}

@keyframes node-flash {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.4);
  }
  44% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes console-in {
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
