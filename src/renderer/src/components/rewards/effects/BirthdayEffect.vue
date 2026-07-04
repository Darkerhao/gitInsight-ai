<script setup lang="ts">
import { Cake } from 'lucide-vue-next';

const colors = ['#3b6cf6', '#16a34a', '#f59e0b', '#ef4444', '#ec4899', '#22c55e', '#8b5cf6'];
const confettiPieces = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: `${(index * 17) % 100}%`,
  delay: `${(index % 18) * 70}ms`,
  duration: `${2500 + (index % 7) * 170}ms`,
  color: colors[index % colors.length],
  rotate: `${(index * 37) % 180}deg`,
  width: `${7 + (index % 3) * 3}px`,
}));
const ribbons = Array.from({ length: 7 }, (_, index) => ({
  id: index,
  left: `${8 + index * 14}%`,
  delay: `${index * 110}ms`,
  color: colors[(index + 2) % colors.length],
}));
</script>

<template>
  <div class="birthday-effect">
    <span
      v-for="stream in ribbons"
      :key="stream.id"
      class="birthday-ribbon"
      :style="{ left: stream.left, background: stream.color, animationDelay: stream.delay }"
    />
    <span
      v-for="piece in confettiPieces"
      :key="piece.id"
      class="confetti-piece"
      :style="{
        left: piece.left,
        width: piece.width,
        background: piece.color,
        animationDelay: piece.delay,
        animationDuration: piece.duration,
        '--confetti-rotate': piece.rotate,
      }"
    />
    <div class="birthday-card-effect">
      <span class="birthday-card-glow" />
      <Cake :size="52" />
      <strong>生日快乐</strong>
      <small>Happy Birthday</small>
    </div>
  </div>
</template>

<style scoped>
.birthday-effect {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.birthday-card-effect {
  position: relative;
  min-width: min(360px, calc(100vw - 42px));
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(255, 245, 252, 0.9)),
    linear-gradient(90deg, rgba(236, 72, 153, 0.2), transparent);
  color: #1f2937;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 34px;
  text-align: center;
  box-shadow:
    0 30px 80px rgba(31, 41, 55, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  overflow: hidden;
  animation: birthday-card-pop 4.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.birthday-card-glow {
  position: absolute;
  inset: -40% -20%;
  background: conic-gradient(from 120deg, transparent, rgba(236, 72, 153, 0.24), rgba(59, 108, 246, 0.18), transparent);
  opacity: 0.76;
  animation: birthday-card-glow 4.6s linear both;
}

.birthday-card-effect svg,
.birthday-card-effect strong,
.birthday-card-effect small {
  position: relative;
}

.birthday-card-effect svg {
  color: #ec4899;
  filter: drop-shadow(0 10px 20px rgba(236, 72, 153, 0.28));
}

.birthday-card-effect strong {
  font-size: 34px;
  line-height: 1.1;
}

.birthday-card-effect small {
  color: #64748b;
  font-size: 14px;
}

.birthday-ribbon {
  position: absolute;
  top: -24%;
  width: 18px;
  height: 52vh;
  border-radius: 999px;
  opacity: 0;
  filter: blur(0.3px);
  animation: birthday-ribbon-drop 3.4s ease-in both;
}

.confetti-piece {
  position: absolute;
  top: -24px;
  height: 18px;
  border-radius: 3px;
  opacity: 0;
  animation: confetti-fall 2.8s linear both;
}

:root[data-theme='dark'] .birthday-card-effect {
  border-color: rgba(122, 162, 255, 0.24);
  background: rgba(22, 29, 41, 0.9);
  color: var(--c-text);
}

:root[data-theme='dark'] .birthday-card-effect small {
  color: var(--c-text-muted);
}

@keyframes birthday-card-pop {
  0% {
    opacity: 0;
    transform: translateY(28px) scale(0.9);
  }
  14%,
  78% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-18px) scale(0.98);
  }
}

@keyframes birthday-card-glow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(260deg);
  }
}

@keyframes birthday-ribbon-drop {
  0% {
    opacity: 0;
    transform: translateY(-12vh) rotate(8deg);
  }
  18%,
  72% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
    transform: translateY(112vh) rotate(-12deg);
  }
}

@keyframes confetti-fall {
  0% {
    opacity: 0;
    transform: translateY(-12vh) rotate(var(--confetti-rotate));
  }
  8% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(112vh) rotate(calc(var(--confetti-rotate) + 620deg));
  }
}
</style>
