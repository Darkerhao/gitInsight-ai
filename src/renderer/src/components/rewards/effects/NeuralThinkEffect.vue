<script setup lang="ts">
import { BrainCircuit } from 'lucide-vue-next';

const nodes = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  x: 10 + ((index * 31) % 80),
  y: 14 + ((index * 43) % 70),
  delay: `${(index % 8) * 90}ms`,
}));
const links = nodes.map((node, index) => ({
  id: index,
  x1: node.x,
  y1: node.y,
  x2: nodes[(index * 5 + 3) % nodes.length].x,
  y2: nodes[(index * 5 + 3) % nodes.length].y,
  delay: `${(index % 9) * 80}ms`,
}));
</script>

<template>
  <div class="neural-think-effect">
    <svg class="neural-network" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line
        v-for="link in links"
        :key="link.id"
        :x1="link.x1"
        :y1="link.y1"
        :x2="link.x2"
        :y2="link.y2"
        :style="{ animationDelay: link.delay }"
      />
    </svg>
    <span
      v-for="node in nodes"
      :key="node.id"
      class="neural-node"
      :style="{ left: `${node.x}%`, top: `${node.y}%`, animationDelay: node.delay }"
    />
    <div class="neural-core">
      <BrainCircuit :size="56" />
      <strong>神经网络思考</strong>
    </div>
  </div>
</template>

<style scoped>
.neural-think-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.neural-network {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.neural-network line {
  stroke: rgba(167, 139, 250, 0.46);
  stroke-width: 0.24;
  stroke-dasharray: 9 7;
  opacity: 0;
  filter: drop-shadow(0 0 6px rgba(167, 139, 250, 0.64));
  animation: neural-link 2.4s ease both;
}

.neural-node {
  position: absolute;
  width: 13px;
  height: 13px;
  border: 1px solid rgba(196, 181, 253, 0.72);
  border-radius: 50%;
  background: radial-gradient(circle, #f5f3ff, rgba(139, 92, 246, 0.54) 46%, transparent 70%);
  box-shadow:
    0 0 0 0 rgba(167, 139, 250, 0.32),
    0 0 26px rgba(167, 139, 250, 0.66);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.4);
  animation: neural-node 2.7s ease both;
}

.neural-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 176px;
  height: 176px;
  border: 1px solid rgba(196, 181, 253, 0.42);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(167, 139, 250, 0.22), rgba(2, 6, 23, 0.24) 62%, transparent);
  color: #ede9fe;
  display: grid;
  gap: 8px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: neural-core 5.2s ease both;
}

.neural-core strong {
  font-size: 15px;
}

@keyframes neural-link {
  0% { opacity: 0; stroke-dashoffset: 42; }
  28%, 76% { opacity: 1; }
  100% { opacity: 0; stroke-dashoffset: -42; }
}

@keyframes neural-node {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  30%, 72% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  48% { box-shadow: 0 0 0 22px rgba(167, 139, 250, 0), 0 0 26px rgba(167, 139, 250, 0.66); }
}

@keyframes neural-core {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.72); filter: blur(8px); }
  20%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
  46% { transform: translate(-50%, -50%) scale(1.08); }
}
</style>
