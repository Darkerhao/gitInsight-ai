<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { startParticleEngine } from '@/components/rewards/engine/particleEngine';
import type { EngineHandle, SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{
  seed?: number;
  duration: number;
  scene: SceneFn;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let engine: EngineHandle | null = null;

onMounted(() => {
  if (!canvasRef.value) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  engine = startParticleEngine(canvasRef.value, {
    seed: (props.seed ?? 0) + 1,
    duration: props.duration,
    scene: props.scene,
  });
});

onBeforeUnmount(() => {
  engine?.destroy();
  engine = null;
});
</script>

<template>
  <canvas ref="canvasRef" class="reward-particle-canvas" />
</template>

<style>
.reward-particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
