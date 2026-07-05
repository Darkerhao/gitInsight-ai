<script setup lang="ts">
import { Zap } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.16);
  const vpX = api.width / 2; // 消失点
  const vpY = api.height * 0.55;

  // 合成波落日：地平线上的呼吸光球
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 1) * Math.min(1, Math.max(0, (api.duration / 1000 - t) / 0.9));
    if (envelope <= 0) return;
    const radius = 90 + Math.sin(t * 1.4) * 8;
    const gradient = ctx.createRadialGradient(vpX, vpY - 20, 0, vpX, vpY - 20, radius);
    gradient.addColorStop(0, `rgba(253, 186, 116, ${0.5 * envelope})`);
    gradient.addColorStop(0.5, `rgba(244, 114, 182, ${0.3 * envelope})`);
    gradient.addColorStop(1, 'rgba(244, 114, 182, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(vpX, vpY - 20, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // 高速掠过的霓虹光轨：从消失点向两侧加速飞出
  api.every(15, () => {
    const side = api.rng() < 0.5 ? -1 : 1;
    const angle = side > 0 ? api.range(-0.5, 0.5) : Math.PI + api.range(-0.5, 0.5);
    const pitch = api.rng() < 0.6 ? api.range(0.05, 0.5) : api.range(-0.3, 0.05);
    api.spawn({
      x: vpX + Math.cos(angle) * 20,
      y: vpY + pitch * 30,
      vx: Math.cos(angle) * api.range(60, 130),
      vy: pitch * api.range(120, 260),
      shape: 'streak',
      stretch: 0.09,
      size: api.range(1.6, 3),
      maxLife: api.range(0.9, 1.5),
      color: api.rng() < 0.5 ? '#f472b6' : '#22d3ee',
      glow: 1.1,
      fadeIn: 0.14,
      fadeOut: 0.08,
      update: (p, dt) => {
        p.vx += (p.x - vpX) * 3.6 * dt;
        p.vy += (p.y - vpY) * 3.6 * dt;
      },
    });
  }, { until: api.duration - 700 });

  // 路面氮气火花：底部向上蹿起的粉色火花
  api.every(140, () => {
    api.spawn({
      x: vpX + api.range(-api.width * 0.2, api.width * 0.2),
      y: api.height + 6,
      vx: api.range(-40, 40),
      vy: api.range(-300, -160),
      ay: 260,
      shape: 'spark',
      size: api.range(1.4, 2.4),
      maxLife: api.range(0.8, 1.4),
      color: api.rng() < 0.5 ? '#f9a8d4' : '#67e8f9',
      twinkle: 8,
      glow: 1.2,
    });
  }, { from: 400, until: api.duration - 1000 });

  // 氮气爆发：周期性的速度冲击波
  api.every(1200, () => {
    api.spawn({
      x: vpX,
      y: vpY,
      shape: 'ring',
      size: 16,
      endSize: Math.max(api.width, api.height) * 0.6,
      maxLife: 0.9,
      color: '#f472b6',
      opacity: 0.6,
      fadeOut: 0.75,
    });
  }, { from: 800, until: api.duration - 1400 });
};
</script>

<template>
  <div class="neon-drive-effect">
    <div class="neon-skyline">
      <span v-for="index in 18" :key="index" :style="{ '--tower': `${34 + (index % 6) * 18}px` }" />
    </div>
    <div class="neon-road">
      <span v-for="mark in 12" :key="mark" class="road-mark" :style="{ animationDelay: `${mark * 90}ms` }" />
    </div>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.neonDrive" :scene="scene" />
    <div class="neon-dashboard">
      <Zap :size="46" />
      <strong>霓虹疾驰</strong>
      <small>NITRO DRIVE</small>
    </div>
  </div>
</template>

<style scoped>
.neon-drive-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, transparent 0 52%, rgba(244, 114, 182, 0.12) 52% 100%),
    radial-gradient(circle at 50% 76%, rgba(34, 211, 238, 0.2), transparent 38%);
}

.neon-skyline {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 44%;
  display: flex;
  align-items: end;
  justify-content: space-between;
  opacity: 0;
  animation: skyline-in 5.2s ease both;
}

.neon-skyline span {
  width: 3.4%;
  height: var(--tower);
  border: 1px solid rgba(34, 211, 238, 0.24);
  background:
    repeating-linear-gradient(180deg, rgba(244, 114, 182, 0.36) 0 2px, transparent 2px 8px),
    rgba(15, 23, 42, 0.42);
  box-shadow: 0 0 18px rgba(244, 114, 182, 0.2);
}

.neon-road {
  position: absolute;
  left: 50%;
  bottom: -12%;
  width: min(780px, 120vw);
  height: 58vh;
  transform: translateX(-50%) perspective(520px) rotateX(62deg);
  transform-origin: center bottom;
  background:
    linear-gradient(90deg, transparent 0 13%, rgba(34, 211, 238, 0.55) 13.4%, transparent 14%, transparent 86%, rgba(244, 114, 182, 0.55) 86.6%, transparent 87%),
    repeating-linear-gradient(90deg, transparent 0 64px, rgba(34, 211, 238, 0.22) 65px 66px),
    repeating-linear-gradient(0deg, transparent 0 42px, rgba(244, 114, 182, 0.24) 43px 44px);
  filter: drop-shadow(0 0 22px rgba(34, 211, 238, 0.32));
  animation: road-pulse 5.2s ease both;
}

.road-mark {
  position: absolute;
  left: 50%;
  top: 0;
  width: 8px;
  height: 74px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.56);
  opacity: 0;
  transform: translateX(-50%);
  animation: road-mark 760ms linear infinite;
}

.neon-dashboard {
  position: absolute;
  left: 50%;
  top: 48%;
  min-width: 210px;
  border: 1px solid rgba(244, 114, 182, 0.36);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.42);
  color: #fbcfe8;
  display: grid;
  gap: 7px;
  place-items: center;
  padding: 20px 28px;
  text-align: center;
  box-shadow:
    inset 0 0 28px rgba(244, 114, 182, 0.12),
    0 24px 70px rgba(34, 211, 238, 0.16);
  transform: translate(-50%, -50%);
  animation: dashboard-pop 5.2s ease both;
}

.neon-dashboard svg {
  color: #f472b6;
  filter: drop-shadow(0 0 24px rgba(244, 114, 182, 0.64));
}

.neon-dashboard strong {
  font-size: 19px;
}

.neon-dashboard small {
  color: #67e8f9;
  font-weight: 800;
  letter-spacing: 0.12em;
}

@keyframes skyline-in {
  0%,
  100% {
    opacity: 0;
    transform: translateY(18px);
  }
  18%,
  82% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes road-pulse {
  0%,
  100% {
    opacity: 0;
  }
  16%,
  84% {
    opacity: 1;
  }
}

@keyframes road-mark {
  0% {
    opacity: 0;
    transform: translate(-50%, -40px) scaleY(0.4);
  }
  24% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 58vh) scaleY(1.5);
  }
}

@keyframes dashboard-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.9);
  }
  18%,
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}
</style>
