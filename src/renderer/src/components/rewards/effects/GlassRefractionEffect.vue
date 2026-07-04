<script setup lang="ts">
import { Layers } from 'lucide-vue-next';

const layers = Array.from({ length: 5 }, (_, index) => ({
  id: index,
  x: `${(index - 2) * 34}px`,
  y: `${(index - 2) * -18}px`,
  rotate: `${(index - 2) * 4}deg`,
  delay: `${index * 110}ms`,
}));
const prisms = Array.from({ length: 11 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 19) % 82)}%`,
  delay: `${index * 95}ms`,
}));
</script>

<template>
  <div class="glass-refraction-effect">
    <span
      v-for="prism in prisms"
      :key="prism.id"
      class="glass-prism"
      :style="{ left: prism.left, animationDelay: prism.delay }"
    />
    <div class="glass-stack">
      <span
        v-for="layer in layers"
        :key="layer.id"
        class="glass-layer"
        :style="{
          '--layer-x': layer.x,
          '--layer-y': layer.y,
          '--layer-rotate': layer.rotate,
          animationDelay: layer.delay,
        }"
      />
      <div class="glass-refraction-label">
        <Layers :size="50" />
        <strong>玻璃折射层</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-refraction-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.glass-stack {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 78vw);
  height: min(330px, 56vh);
  transform: translate(-50%, -50%);
  animation: glass-stack 5.2s ease both;
}

.glass-layer {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 16px;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.22), transparent 32% 68%, rgba(125, 249, 255, 0.18)),
    rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px) saturate(1.2);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.36),
    0 26px 70px rgba(2, 6, 23, 0.22);
  opacity: 0;
  transform: translate(var(--layer-x), var(--layer-y)) rotate(var(--layer-rotate)) scale(0.92);
  animation: glass-layer 4.8s ease both;
}

.glass-layer::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    105deg,
    transparent 0 20px,
    rgba(255, 255, 255, 0.14) 21px 23px,
    transparent 24px 44px
  );
  transform: translateX(-24px);
  animation: glass-shift 1.8s ease-in-out infinite alternate;
}

.glass-prism {
  position: absolute;
  top: -12%;
  width: 2px;
  height: 124vh;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.42), rgba(34, 211, 238, 0.24), transparent);
  opacity: 0;
  transform: rotate(18deg);
  animation: glass-prism 3.4s ease both;
}

.glass-refraction-label {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #f0f9ff;
  transform: translate(-50%, -50%);
  animation: glass-label 5.2s ease both;
}

.glass-refraction-label strong {
  font-size: 16px;
}

@keyframes glass-stack {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.86); }
  18%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes glass-layer {
  0%, 100% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(0.86); }
  24%, 78% { opacity: 1; transform: translate(var(--layer-x), var(--layer-y)) rotate(var(--layer-rotate)) scale(1); }
}

@keyframes glass-shift {
  to { transform: translateX(24px); }
}

@keyframes glass-prism {
  0%, 100% { opacity: 0; transform: translateX(-16vw) rotate(18deg); }
  24%, 76% { opacity: 0.8; }
  100% { transform: translateX(18vw) rotate(18deg); }
}

@keyframes glass-label {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) scale(0.88); }
  22%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
