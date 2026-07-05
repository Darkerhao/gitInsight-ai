<script setup lang="ts">
import { Cpu } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.16);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const squash = 0.36; // 全息环的透视压扁比

  // 三层全息轨道环：粒子沿倾斜椭圆轨道环绕，各层反向、半径不同
  const orbits = [
    { radius: 130, speed: 1.6, tint: '#c4b5fd', yOffset: 0 },
    { radius: 190, speed: -1.1, tint: '#22d3ee', yOffset: 10 },
    { radius: 250, speed: 0.8, tint: '#a78bfa', yOffset: 22 },
  ];
  for (const orbit of orbits) {
    api.every(44, () => {
      let angle = api.range(0, Math.PI * 2);
      api.spawn({
        x: cx + Math.cos(angle) * orbit.radius,
        y: cy + orbit.yOffset + Math.sin(angle) * orbit.radius * squash,
        shape: 'spark',
        size: api.range(1.6, 2.8),
        maxLife: api.range(1, 1.8),
        color: orbit.tint,
        glow: 1.1,
        fadeIn: 0.12,
        update: (p, dt) => {
          angle += orbit.speed * dt;
          p.x = cx + Math.cos(angle) * orbit.radius;
          p.y = cy + orbit.yOffset + Math.sin(angle) * orbit.radius * squash;
          // 轨道后侧的粒子更暗，制造前后遮挡的立体感
          p.opacity = Math.sin(angle) > 0 ? 1 : 0.45;
        },
      });
    }, { until: api.duration - 800 });
  }

  // 核心能量柱：沿中轴盘旋上升的光粒
  api.every(30, () => {
    let angle = api.range(0, Math.PI * 2);
    const spiralRadius = api.range(16, 44);
    api.spawn({
      x: cx + Math.cos(angle) * spiralRadius,
      y: cy + api.range(60, 140),
      vy: -api.range(120, 220),
      shape: 'spark',
      size: api.range(1.4, 2.4),
      maxLife: api.range(0.9, 1.6),
      color: api.rng() < 0.6 ? '#e9d5ff' : '#67e8f9',
      glow: 1.2,
      twinkle: 8,
      fadeIn: 0.1,
      update: (p, dt) => {
        angle += 6 * dt;
        p.x = cx + Math.cos(angle) * spiralRadius;
      },
    });
  }, { from: 200, until: api.duration - 900 });

  // 全息干涉波纹：椭圆环从核心荡开
  api.every(680, () => {
    api.spawn({
      x: cx,
      y: cy,
      shape: 'ring',
      size: 40,
      endSize: 300,
      maxLife: 1.2,
      color: '#a78bfa',
      opacity: 0.55,
      fadeOut: 0.7,
    });
  }, { from: 400, until: api.duration - 1300 });

  // 上线瞬间：紫色数据爆发
  api.at(260, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 50, endSize: 6, maxLife: 0.5, color: '#ede9fe', glow: 2.2 });
    api.burst({
      x: cx,
      y: cy,
      count: 80,
      speed: [80, 460],
      base: { shape: 'spark', size: 1.8, drag: 0.32, color: '#c4b5fd', twinkle: 8, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 0.8 + rng() * 1;
        if (rng() < 0.3) p.color = '#67e8f9';
      },
    });
  });
};
</script>

<template>
  <div class="holo-core-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.holoCore" :scene="scene" />
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
