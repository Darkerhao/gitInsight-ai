<script setup lang="ts">
import { Plane } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const vpX = api.width / 2; // 地平线消失点
  const vpY = api.height * 0.34;

  // 掠过的城市灯光：从地平线向下方两侧加速飞出（前进视差）
  api.every(16, () => {
    const angle = api.range(Math.PI * 0.12, Math.PI * 0.88); // 只向下半平面
    const startRadius = api.range(8, 50);
    api.spawn({
      x: vpX + Math.cos(angle) * startRadius,
      y: vpY + Math.sin(angle) * startRadius * 0.7,
      vx: Math.cos(angle) * api.range(40, 90),
      vy: Math.sin(angle) * api.range(40, 90),
      shape: 'streak',
      stretch: 0.09,
      size: api.range(1.2, 2.6),
      maxLife: api.range(1.1, 1.9),
      color: api.pick(['#5eead4', '#99f6e4', '#fef08a', '#a5f3fc']),
      glow: 1,
      fadeIn: 0.18,
      fadeOut: 0.1,
      update: (p, dt) => {
        p.vx += (p.x - vpX) * 2.6 * dt;
        p.vy += (p.y - vpY) * 2.6 * dt;
      },
    });
  }, { until: api.duration - 800 });

  // 航空信标：红/绿闪烁的导航灯
  api.every(500, () => {
    api.spawn({
      x: api.range(api.width * 0.1, api.width * 0.9),
      y: api.range(api.height * 0.42, api.height * 0.85),
      shape: 'dot',
      size: api.range(2.4, 3.6),
      maxLife: api.range(1, 1.8),
      color: api.rng() < 0.5 ? '#f87171' : '#4ade80',
      glow: 1.5,
      twinkle: 3,
      fadeIn: 0.2,
      fadeOut: 0.3,
    });
  }, { from: 400, until: api.duration - 1100 });

  // 目标锁定框：HUD 括号锁定 + 确认闪光
  api.every(900, () => {
    const x = api.range(api.width * 0.2, api.width * 0.8);
    const y = api.range(api.height * 0.4, api.height * 0.78);
    api.spawn({ x, y, shape: 'ring', size: 50, endSize: 16, maxLife: 0.5, color: '#7dd3fc', opacity: 0.9 });
    api.spawn({
      x,
      y,
      shape: 'glyph',
      glyph: '⌖',
      size: 26,
      maxLife: 1,
      color: '#e0f2fe',
      fadeIn: 0.25,
      fadeOut: 0.35,
    });
  }, { from: 900, until: api.duration - 1300 });

  // 螺旋桨气流：底部两侧持续卷起的气流粒子
  api.every(40, () => {
    const onLeft = api.rng() < 0.5;
    api.spawn({
      x: api.width * (onLeft ? api.range(0.06, 0.24) : api.range(0.76, 0.94)),
      y: api.height + 8,
      vx: (onLeft ? 1 : -1) * api.range(20, 70),
      vy: -api.range(90, 220),
      drag: 0.6,
      shape: 'dot',
      size: api.range(1, 2),
      maxLife: api.range(1, 2),
      color: '#99f6e4',
      twinkle: api.range(4, 8),
      wander: 60,
      glow: 0.9,
    });
  }, { until: api.duration - 900 });
};
</script>

<template>
  <div class="drone-flyover-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.droneFlyover" :scene="scene" />
    <div class="drone-city">
      <span
        v-for="tower in 48"
        :key="tower"
        class="drone-tower"
        :style="{ height: `${18 + ((tower * 17) % 78)}px`, animationDelay: `${(tower % 8) * 52}ms` }"
      />
    </div>
    <div class="drone-camera">
      <Plane :size="56" />
      <strong>无人机飞行视角</strong>
    </div>
  </div>
</template>

<style scoped>
.drone-flyover-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  perspective: 800px;
}

.drone-city {
  position: absolute;
  left: 50%;
  top: 58%;
  width: min(820px, 92vw);
  height: min(440px, 64vh);
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: end;
  gap: 9px;
  padding: 24px;
  transform: translate(-50%, -50%) rotateX(62deg) translateZ(-80px);
  transform-origin: center bottom;
  animation: drone-city 5.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.drone-city::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(45, 212, 191, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.18) 1px, transparent 1px);
  background-size: 44px 44px;
}

.drone-tower {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(45, 212, 191, 0.36), rgba(14, 165, 233, 0.08));
  box-shadow: 0 0 22px rgba(45, 212, 191, 0.14);
  opacity: 0;
  transform-origin: center bottom;
  animation: drone-tower 3.2s ease both;
}

.drone-camera {
  position: absolute;
  left: 50%;
  top: 38%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #ccfbf1;
  transform: translate(-50%, -50%);
  animation: drone-camera 5.2s ease both;
}

.drone-camera strong {
  font-size: 16px;
}

@keyframes drone-city {
  0% { opacity: 0; transform: translate(-50%, -8%) rotateX(62deg) translateZ(-260px) scale(1.42); }
  20%, 80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -74%) rotateX(62deg) translateZ(100px) scale(0.76); }
}

@keyframes drone-tower {
  0% { opacity: 0; transform: scaleY(0.18); }
  28%, 84% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(0.86); }
}

@keyframes drone-camera {
  0%, 100% { opacity: 0; transform: translate(-50%, -40%) scale(0.82); }
  18%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
