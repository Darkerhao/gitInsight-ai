<script setup lang="ts">
import { Activity } from 'lucide-vue-next';

const cards = Array.from({ length: 9 }, (_, index) => ({
  id: index,
  delay: `${index * 110}ms`,
  width: `${54 + (index % 3) * 18}%`,
}));
</script>

<template>
  <div class="breathing-ui-effect">
    <div class="breathing-shell">
      <div class="breathing-header">
        <Activity :size="42" />
        <strong>呼吸 UI</strong>
      </div>
      <div class="breathing-grid">
        <span
          v-for="card in cards"
          :key="card.id"
          class="breathing-card"
          :style="{ animationDelay: card.delay, '--line-width': card.width }"
        />
      </div>
    </div>
    <span class="breathing-aura" />
  </div>
</template>

<style scoped>
.breathing-ui-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.breathing-shell {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 82vw);
  min-height: 320px;
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 0, rgba(34, 197, 94, 0.18), transparent 48%),
    rgba(2, 6, 23, 0.34);
  color: #dcfce7;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 18px;
  padding: 28px;
  transform: translate(-50%, -50%);
  animation: breathing-shell 5.6s ease-in-out both;
}

.breathing-header {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

.breathing-header strong {
  font-size: 18px;
}

.breathing-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.breathing-card {
  position: relative;
  min-height: 82px;
  border: 1px solid rgba(134, 239, 172, 0.24);
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.07);
  opacity: 0;
  transform: scale(0.92);
  animation: breathing-card 3.2s ease-in-out infinite;
}

.breathing-card::before,
.breathing-card::after {
  content: '';
  position: absolute;
  left: 14px;
  height: 5px;
  border-radius: 999px;
  background: rgba(187, 247, 208, 0.48);
}

.breathing-card::before {
  right: 14px;
  top: 22px;
}

.breathing-card::after {
  top: 40px;
  width: var(--line-width);
}

.breathing-aura {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(560px, 86vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.22), transparent 68%);
  transform: translate(-50%, -50%);
  animation: breathing-aura 5.6s ease-in-out both;
}

@keyframes breathing-shell {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
  14%, 84% { opacity: 1; }
  32% { transform: translate(-50%, -50%) scale(1.035); }
  54% { transform: translate(-50%, -50%) scale(0.98); }
  76% { transform: translate(-50%, -50%) scale(1.02); }
}

@keyframes breathing-card {
  0%, 100% { opacity: 0.55; transform: scale(0.94); }
  50% { opacity: 1; transform: scale(1); }
}

@keyframes breathing-aura {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.72); }
  18%, 82% { opacity: 1; }
  48% { transform: translate(-50%, -50%) scale(1.08); }
}
</style>
