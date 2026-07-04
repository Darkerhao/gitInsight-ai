<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';

const blocks = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  height: `${22 + ((index * 13) % 86)}px`,
  delay: `${(index % 7) * 90}ms`,
}));
const beacons = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: `${9 + ((index * 17) % 82)}%`,
  top: `${16 + ((index * 23) % 68)}%`,
  delay: `${index * 120}ms`,
}));
</script>

<template>
  <div class="city-scan-effect">
    <div class="city-map">
      <span
        v-for="block in blocks"
        :key="block.id"
        class="city-block"
        :style="{ height: block.height, animationDelay: block.delay }"
      />
    </div>
    <span
      v-for="beacon in beacons"
      :key="beacon.id"
      class="city-beacon"
      :style="{ left: beacon.left, top: beacon.top, animationDelay: beacon.delay }"
    />
    <div class="city-scan-line" />
    <div class="city-scan-label">
      <Building2 :size="46" />
      <strong>城市扫描线</strong>
    </div>
  </div>
</template>

<style scoped>
.city-scan-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.city-map {
  position: absolute;
  left: 50%;
  bottom: 14%;
  width: min(760px, 88vw);
  height: min(390px, 62vh);
  display: grid;
  grid-template-columns: repeat(14, minmax(0, 1fr));
  align-items: end;
  gap: 10px;
  padding: 22px;
  transform: translateX(-50%) perspective(700px) rotateX(52deg);
  transform-origin: center bottom;
  mask-image: linear-gradient(180deg, transparent 0, #000 14% 88%, transparent 100%);
}

.city-map::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(34, 211, 238, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 211, 238, 0.18) 1px, transparent 1px);
  background-size: 42px 42px;
  opacity: 0;
  animation: city-grid 4.8s ease both;
}

.city-block {
  position: relative;
  z-index: 1;
  min-height: 16px;
  border: 1px solid rgba(34, 211, 238, 0.32);
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.32), rgba(59, 130, 246, 0.1));
  box-shadow: inset 0 0 18px rgba(34, 211, 238, 0.12);
  opacity: 0;
  transform: scaleY(0.18);
  transform-origin: center bottom;
  animation: city-block 3.6s ease both;
}

.city-beacon {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #67e8f9;
  box-shadow:
    0 0 0 0 rgba(103, 232, 249, 0.28),
    0 0 24px rgba(103, 232, 249, 0.72);
  opacity: 0;
  animation: city-beacon 2.8s ease both;
}

.city-scan-line {
  position: absolute;
  left: 0;
  right: 0;
  top: -18%;
  height: 18vh;
  background: linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.36), rgba(255, 255, 255, 0.82), transparent);
  box-shadow: 0 0 42px rgba(34, 211, 238, 0.46);
  opacity: 0;
  animation: city-scan 3.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.city-scan-label {
  position: absolute;
  left: 50%;
  top: 42%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #cffafe;
  transform: translate(-50%, -50%);
  animation: city-label 4.8s ease both;
}

.city-scan-label strong {
  font-size: 16px;
}

@keyframes city-grid {
  0%, 100% { opacity: 0; }
  18%, 78% { opacity: 1; }
}

@keyframes city-block {
  0% { opacity: 0; transform: scaleY(0.18); filter: brightness(0.8); }
  32%, 78% { opacity: 1; transform: scaleY(1); filter: brightness(1.42); }
  100% { opacity: 0; transform: scaleY(0.92); filter: brightness(0.9); }
}

@keyframes city-beacon {
  0%, 100% { opacity: 0; transform: scale(0.4); }
  38%, 72% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 18px rgba(103, 232, 249, 0), 0 0 24px rgba(103, 232, 249, 0.72); }
}

@keyframes city-scan {
  0% { opacity: 0; transform: translateY(0); }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { opacity: 0; transform: translateY(126vh); }
}

@keyframes city-label {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) scale(0.9); }
  20%, 76% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
