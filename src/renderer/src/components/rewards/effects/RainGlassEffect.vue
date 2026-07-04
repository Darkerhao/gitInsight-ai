<script setup lang="ts">
import { CloudRain } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref } from 'vue';

type RainDrop = {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
};

const canvasRef = ref<HTMLCanvasElement | null>(null);
let drops: RainDrop[] = [];
let frameId = 0;
let resizeObserver: ResizeObserver | null = null;

function seedDrops(width: number, height: number) {
  drops = Array.from({ length: 86 }, (_, index) => ({
    x: (index * 137) % Math.max(width, 1),
    y: (index * 83) % Math.max(height, 1),
    speed: 2.2 + (index % 7) * 0.42,
    length: 28 + (index % 6) * 9,
    alpha: 0.24 + (index % 5) * 0.08,
  }));
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const ratio = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  const context = canvas.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  seedDrops(width, height);
}

function drawRain() {
  const canvas = canvasRef.value;
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;

  const { width, height } = canvas.getBoundingClientRect();
  context.clearRect(0, 0, width, height);
  context.lineCap = 'round';

  drops.forEach((drop) => {
    const gradient = context.createLinearGradient(drop.x, drop.y, drop.x - 16, drop.y + drop.length);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${drop.alpha})`);
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
    context.strokeStyle = gradient;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(drop.x, drop.y);
    context.lineTo(drop.x - 16, drop.y + drop.length);
    context.stroke();

    drop.x -= 0.42;
    drop.y += drop.speed;
    if (drop.y > height + drop.length) {
      drop.y = -drop.length;
      drop.x = (drop.x + width * 0.37 + drop.length * 7) % Math.max(width, 1);
    }
  });

  frameId = window.requestAnimationFrame(drawRain);
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  resizeCanvas(canvas);
  resizeObserver = new ResizeObserver(() => resizeCanvas(canvas));
  resizeObserver.observe(canvas);
  frameId = window.requestAnimationFrame(drawRain);
});

onBeforeUnmount(() => {
  if (frameId) {
    window.cancelAnimationFrame(frameId);
  }
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="rain-glass-effect">
    <canvas ref="canvasRef" class="rain-canvas" />
    <div class="rain-glass-pane">
      <CloudRain :size="54" />
      <strong>雨夜玻璃 UI</strong>
      <span />
      <span />
      <span />
    </div>
  </div>
</template>

<style scoped>
.rain-glass-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.rain-glass-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 18%, rgba(14, 165, 233, 0.28), transparent 30%),
    radial-gradient(circle at 76% 72%, rgba(99, 102, 241, 0.2), transparent 36%);
  opacity: 0;
  animation: rain-night 5.4s ease both;
}

.rain-glass-effect::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(110deg, transparent 0 46%, rgba(255, 255, 255, 0.82) 49%, transparent 52%),
    radial-gradient(circle at 68% 28%, rgba(125, 211, 252, 0.34), transparent 26%);
  opacity: 0;
  mix-blend-mode: screen;
  animation: rain-lightning 5.4s ease both;
}

.rain-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 10px rgba(125, 211, 252, 0.26));
}

.rain-glass-pane {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(420px, 76vw);
  min-height: 260px;
  border: 1px solid rgba(226, 232, 240, 0.34);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.04)),
    rgba(15, 23, 42, 0.22);
  color: #e0f2fe;
  display: grid;
  gap: 12px;
  place-items: center;
  align-content: center;
  backdrop-filter: blur(14px) saturate(1.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 28px 80px rgba(2, 6, 23, 0.38);
  overflow: hidden;
  transform: translate(-50%, -50%);
  animation: rain-glass-pane 5.4s ease both;
}

.rain-glass-pane::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 0 42%, rgba(255, 255, 255, 0.28) 48%, transparent 56%);
  transform: translateX(-120%);
  animation: rain-glare 2.2s ease-in-out 600ms both;
}

.rain-glass-pane::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 24%, rgba(255, 255, 255, 0.42) 0 3px, transparent 4px),
    radial-gradient(circle at 76% 30%, rgba(255, 255, 255, 0.32) 0 2px, transparent 3px),
    radial-gradient(circle at 64% 76%, rgba(255, 255, 255, 0.28) 0 3px, transparent 4px),
    linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.08));
  opacity: 0;
  animation: rain-droplets 5.4s ease both;
}

.rain-glass-pane svg,
.rain-glass-pane strong,
.rain-glass-pane span {
  position: relative;
  z-index: 1;
}

.rain-glass-pane strong {
  font-size: 16px;
}

.rain-glass-pane span {
  width: 68%;
  height: 6px;
  border-radius: 999px;
  background: rgba(186, 230, 253, 0.34);
}

.rain-glass-pane span:nth-of-type(2) {
  width: 46%;
}

.rain-glass-pane span:nth-of-type(3) {
  width: 58%;
}

@keyframes rain-night {
  0%, 100% { opacity: 0; }
  12%, 86% { opacity: 1; }
}

@keyframes rain-lightning {
  0%, 20%, 34%, 100% { opacity: 0; }
  24% { opacity: 0.62; }
  27% { opacity: 0.08; }
  31% { opacity: 0.38; }
}

@keyframes rain-glass-pane {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.9); filter: blur(8px); }
  20%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
}

@keyframes rain-glare {
  to { transform: translateX(120%); }
}

@keyframes rain-droplets {
  0%, 100% { opacity: 0; transform: translateY(-12px); }
  24%, 82% { opacity: 1; }
  100% { transform: translateY(24px); }
}
</style>
