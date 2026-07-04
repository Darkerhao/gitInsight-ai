<script setup lang="ts">
import { Cpu } from 'lucide-vue-next';

const rings = Array.from({ length: 6 }, (_, index) => ({
  id: index,
  size: `${118 + index * 54}px`,
  delay: `${index * 120}ms`,
  rotate: `${index % 2 === 0 ? 1 : -1}`,
}));
const shards = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  angle: `${index * 12.86}deg`,
  delay: `${(index % 8) * 90}ms`,
  distance: `${96 + (index % 5) * 18}px`,
}));
</script>

<template>
  <div class="holo-core-effect">
    <span
      v-for="ring in rings"
      :key="ring.id"
      class="holo-ring"
      :style="{ width: ring.size, height: ring.size, animationDelay: ring.delay, '--ring-rotate': ring.rotate }"
    />
    <span
      v-for="shard in shards"
      :key="shard.id"
      class="holo-shard"
      :style="{ '--shard-angle': shard.angle, '--shard-distance': shard.distance, animationDelay: shard.delay }"
    />
    <div class="holo-core">
      <Cpu :size="52" />
      <strong>全息核心</strong>
      <small>HOLO CORE ONLINE</small>
    </div>
  </div>
</template>

<style scoped>
.holo-core-effect {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.holo-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border: 1px solid rgba(167, 139, 250, 0.42);
  border-radius: 50%;
  box-shadow:
    inset 0 0 18px rgba(167, 139, 250, 0.12),
    0 0 32px rgba(167, 139, 250, 0.12);
  opacity: 0;
  transform: translate(-50%, -50%) rotateX(64deg) rotateZ(0deg);
  animation: holo-ring 5.4s ease both;
}

.holo-ring:nth-child(2n) {
  border-color: rgba(34, 211, 238, 0.36);
}

.holo-shard {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 24px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(167, 139, 250, 0.34), transparent);
  opacity: 0;
  transform: rotate(var(--shard-angle)) translateY(0);
  transform-origin: center -4px;
  animation: holo-shard 1.8s ease both;
}

.holo-core {
  position: relative;
  min-width: 210px;
  border: 1px solid rgba(167, 139, 250, 0.36);
  border-radius: 10px;
  background: rgba(30, 27, 75, 0.52);
  color: #ede9fe;
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 24px 30px;
  text-align: center;
  box-shadow:
    inset 0 0 28px rgba(167, 139, 250, 0.14),
    0 0 70px rgba(167, 139, 250, 0.26);
  animation: holo-core 5.4s ease both;
}

.holo-core::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  opacity: 0;
  animation: holo-glint 1.7s ease-in-out infinite;
}

.holo-core svg,
.holo-core strong,
.holo-core small {
  position: relative;
}

.holo-core svg {
  color: #c4b5fd;
  filter: drop-shadow(0 0 24px rgba(167, 139, 250, 0.7));
}

.holo-core strong {
  font-size: 19px;
}

.holo-core small {
  color: #67e8f9;
  font-weight: 800;
  letter-spacing: 0.1em;
}

@keyframes holo-ring {
  0%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotateX(64deg) rotateZ(0deg) scale(0.82);
  }
  18%,
  82% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotateX(64deg) rotateZ(calc(90deg * var(--ring-rotate))) scale(1.06);
  }
}

@keyframes holo-shard {
  0% {
    opacity: 0;
    transform: rotate(var(--shard-angle)) translateY(0) scaleY(0.3);
  }
  36% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--shard-angle)) translateY(calc(var(--shard-distance) * -1)) scaleY(1);
  }
}

@keyframes holo-core {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.88);
  }
  18%,
  78% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-14px) scale(0.96);
  }
}

@keyframes holo-glint {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-26%);
  }
  44% {
    opacity: 0.7;
    transform: translateX(26%);
  }
}
</style>
