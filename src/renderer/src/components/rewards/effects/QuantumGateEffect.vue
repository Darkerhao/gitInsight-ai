<script setup lang="ts">
import { Orbit } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.18);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const squash = 0.42; // 虫洞口的透视压扁比

  // 吸积盘：粒子沿椭圆轨道螺旋坠入虫洞，越近越快、色相偏移
  api.every(15, () => {
    let radius = api.range(170, Math.min(api.width, api.height) * 0.52);
    let angle = api.range(0, Math.PI * 2);
    const angularSpeed = api.range(1.4, 2.4);
    const hue = api.range(210, 330);
    const particle = api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * squash,
      shape: 'spark',
      size: api.range(1.5, 2.8),
      maxLife: 2.4,
      color: `hsl(${Math.round(hue)}, 92%, 70%)`,
      glow: 1.1,
      fadeIn: 0.1,
      fadeOut: 0.05,
      update: (p, dt) => {
        const pull = 1 + (300 - Math.min(radius, 300)) / 110;
        angle += angularSpeed * pull * dt;
        radius -= (34 + (300 - Math.min(radius, 300)) * 1.15) * dt;
        if (radius < 12) {
          p.life = p.maxLife; // 坠入奇点
        }
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius * squash;
        p.color = `hsl(${Math.round(hue + (300 - radius) * 0.25)}, 92%, ${Math.round(66 + (300 - radius) * 0.05)}%)`;
      },
    });
    if (particle && api.rng() < 0.12) particle.size += 1.4;
  }, { until: api.duration - 900 });

  // 奇点呼吸光核
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (api.duration / 1000 - t) / 0.9));
    if (envelope <= 0) return;
    const pulse = 1 + 0.16 * Math.sin(t * 3.2);
    const coreRadius = 46 * pulse;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 3);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.85 * envelope})`);
    gradient.addColorStop(0.14, `rgba(165, 180, 252, ${0.5 * envelope})`);
    gradient.addColorStop(0.45, `rgba(129, 140, 248, ${0.16 * envelope})`);
    gradient.addColorStop(1, 'rgba(129, 140, 248, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius * 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // 引力波纹：周期性椭圆环收缩坠入
  api.every(700, () => {
    api.spawn({
      x: cx,
      y: cy,
      shape: 'ring',
      size: Math.min(api.width, api.height) * 0.46,
      endSize: 14,
      maxLife: 1.3,
      color: '#a5b4fc',
      opacity: 0.7,
      fadeIn: 0.16,
      fadeOut: 0.3,
    });
  }, { from: 300, until: api.duration - 1400 });

  // 偶发能量喷流：从奇点垂直喷出
  api.every(1300, () => {
    [-1, 1].forEach((dir) => {
      api.burst({
        x: cx,
        y: cy,
        count: 16,
        speed: [260, 640],
        angle: [dir * Math.PI / 2 - 0.16, dir * Math.PI / 2 + 0.16],
        base: { shape: 'streak', stretch: 0.09, size: 2, maxLife: 0.8, color: '#22d3ee', glow: 1.2, drag: 0.6, fadeOut: 0.4 },
      });
    });
  }, { from: 1100, until: api.duration - 1500 });
};
</script>

<template>
  <div class="quantum-gate-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.quantumGate" :scene="scene" />
    <div class="quantum-core">
      <Orbit :size="56" />
      <strong>量子虫洞</strong>
    </div>
  </div>
</template>

<style scoped>
.quantum-gate-effect {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.quantum-core {
  position: relative;
  z-index: 1;
  min-width: 202px;
  border: 1px solid rgba(129, 140, 248, 0.4);
  border-radius: 10px;
  background: rgba(30, 27, 75, 0.5);
  color: #e0e7ff;
  display: grid;
  gap: 10px;
  place-items: center;
  padding: 24px 30px;
  box-shadow:
    inset 0 0 30px rgba(129, 140, 248, 0.16),
    0 28px 80px rgba(129, 140, 248, 0.2);
  animation: quantum-panel 5.6s ease both;
}

.quantum-core svg {
  color: #a5b4fc;
  filter: drop-shadow(0 0 26px rgba(129, 140, 248, 0.7));
}

.quantum-core strong {
  font-size: 19px;
}

@keyframes quantum-panel {
  0% {
    opacity: 0;
    transform: scale(0.88);
  }
  18%,
  78% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.96);
  }
}
</style>
