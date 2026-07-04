<script setup lang="ts">
import { ScanLine } from 'lucide-vue-next';

const columns = Array.from({ length: 20 }, (_, index) => ({
  id: index,
  left: `${index * 5}%`,
  delay: `${(index % 8) * 120}ms`,
  duration: `${2100 + (index % 5) * 260}ms`,
  glyphs: Array.from({ length: 12 }, (_, glyphIndex) => ['AI', 'Git', '01', 'PR', 'OK', 'TS'][(index + glyphIndex) % 6]),
}));
const nodes = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 37) % 84)}%`,
  top: `${12 + ((index * 29) % 70)}%`,
  delay: `${(index % 7) * 110}ms`,
}));
</script>

<template>
  <div class="matrix-effect">
    <span
      v-for="column in columns"
      :key="column.id"
      class="matrix-column"
      :style="{ left: column.left, animationDelay: column.delay, animationDuration: column.duration }"
    >
      <i v-for="(glyph, glyphIndex) in column.glyphs" :key="`${column.id}-${glyphIndex}`">{{ glyph }}</i>
    </span>
    <span
      v-for="node in nodes"
      :key="node.id"
      class="matrix-node"
      :style="{ left: node.left, top: node.top, animationDelay: node.delay }"
    />
    <div class="matrix-console">
      <ScanLine :size="42" />
      <strong>代码矩阵</strong>
    </div>
  </div>
</template>

<style scoped>
.matrix-effect {
  position: absolute;
  inset: 0;
}

.matrix-column {
  position: absolute;
  top: -36%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: rgba(167, 243, 208, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  opacity: 0;
  text-shadow: 0 0 12px rgba(52, 211, 153, 0.68);
  animation: matrix-rain 2.8s linear both;
}

.matrix-column i {
  font-style: normal;
}

.matrix-node {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 1px solid rgba(52, 211, 153, 0.7);
  border-radius: 2px;
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.58);
  opacity: 0;
  animation: matrix-node 1.6s ease both;
}

.matrix-console {
  position: absolute;
  left: 50%;
  top: 50%;
  min-width: 190px;
  border: 1px solid rgba(52, 211, 153, 0.36);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.62);
  color: #a7f3d0;
  display: grid;
  gap: 10px;
  place-items: center;
  padding: 22px 26px;
  box-shadow:
    inset 0 0 26px rgba(52, 211, 153, 0.12),
    0 24px 70px rgba(2, 6, 23, 0.28);
  transform: translate(-50%, -50%);
  animation: matrix-console 4.6s ease both;
}

.matrix-console::after {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  top: 12px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #34d399, transparent);
  animation: matrix-scan 1.4s ease-in-out infinite;
}

.matrix-console strong {
  font-size: 18px;
}

@keyframes matrix-rain {
  0% {
    opacity: 0;
    transform: translateY(-12vh);
  }
  12%,
  72% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(120vh);
  }
}

@keyframes matrix-node {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.4) rotate(0deg);
  }
  44% {
    opacity: 1;
    transform: scale(1) rotate(90deg);
  }
}

@keyframes matrix-console {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.94);
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

@keyframes matrix-scan {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(92px);
  }
}
</style>
