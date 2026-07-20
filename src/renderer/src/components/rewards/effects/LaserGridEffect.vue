<script setup lang="ts">
import { CircuitBoard } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const duration = api.duration / 1000;

  // 扫描激光束：三横三纵，正弦往复移动，交点即"命中点"
  const hBeams = Array.from({ length: 3 }, () => ({
    speed: api.range(0.3, 0.7) * (api.rng() < 0.5 ? 1 : -1),
    phase: api.range(0, Math.PI * 2),
    color: api.rng() < 0.5 ? '45, 212, 191' : '34, 211, 238',
  }));
  const vBeams = Array.from({ length: 3 }, () => ({
    speed: api.range(0.3, 0.7) * (api.rng() < 0.5 ? 1 : -1),
    phase: api.range(0, Math.PI * 2),
    color: api.rng() < 0.5 ? '45, 212, 191' : '244, 114, 182',
  }));
  const beamY = (beam: (typeof hBeams)[number], t: number) => api.height * (0.5 + 0.4 * Math.sin(t * beam.speed * 2 + beam.phase));
  const beamX = (beam: (typeof vBeams)[number], t: number) => api.width * (0.5 + 0.42 * Math.sin(t * beam.speed * 2 + beam.phase));

  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.7) * Math.min(1, Math.max(0, (duration - t) / 0.8));
    if (envelope <= 0) return;
    for (const beam of hBeams) {
      const y = beamY(beam, t);
      const gradient = ctx.createLinearGradient(0, y - 8, 0, y + 8);
      gradient.addColorStop(0, `rgba(${beam.color}, 0)`);
      gradient.addColorStop(0.5, `rgba(${beam.color}, ${0.55 * envelope})`);
      gradient.addColorStop(1, `rgba(${beam.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y - 8, api.width, 16);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * envelope})`;
      ctx.fillRect(0, y - 0.7, api.width, 1.4);
    }
    for (const beam of vBeams) {
      const x = beamX(beam, t);
      const gradient = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
      gradient.addColorStop(0, `rgba(${beam.color}, 0)`);
      gradient.addColorStop(0.5, `rgba(${beam.color}, ${0.55 * envelope})`);
      gradient.addColorStop(1, `rgba(${beam.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 8, 0, 16, api.height);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * envelope})`;
      ctx.fillRect(x - 0.7, 0, 1.4, api.height);
    }
  });

  // 交点命中：横纵光束的当前交点上炸开火花
  let sceneTime = 0;
  api.onFrame((tMs) => {
    sceneTime = tMs / 1000;
  });
  api.every(280, () => {
    const hBeam = api.pick(hBeams);
    const vBeam = api.pick(vBeams);
    const x = beamX(vBeam, sceneTime);
    const y = beamY(hBeam, sceneTime);
    api.spawn({ x, y, shape: 'dot', size: 12, endSize: 2, maxLife: 0.3, color: '#ffffff', glow: 1.8 });
    api.spawn({ x, y, shape: 'ring', size: 4, endSize: 60, maxLife: 0.5, color: '#5eead4', opacity: 0.9 });
    api.burst({
      x,
      y,
      count: 14,
      speed: [60, 300],
      base: { shape: 'spark', size: 1.6, drag: 0.3, color: '#5eead4', twinkle: 10, glow: 1.1 },
      vary: (p, rng) => {
        p.maxLife = 0.4 + rng() * 0.5;
        if (rng() < 0.4) p.color = '#99f6e4';
      },
    });
  }, { from: 700, until: api.duration - 1000 });

  // 网格粉尘：地面网格上飘起的微光
  api.every(90, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.range(api.height * 0.55, api.height),
      vy: api.range(-60, -20),
      shape: 'dot',
      size: api.range(0.9, 1.8),
      maxLife: api.range(1, 2),
      color: '#2dd4bf',
      twinkle: api.range(4, 9),
      glow: 1,
    });
  }, { until: api.duration - 900 });
};
</script>

<template>
  <div class="laser-grid-effect">
    <div class="laser-floor" />
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.laserGrid" :scene="scene" />
    <div class="laser-console">
      <CircuitBoard :size="48" />
      <strong>激光网格</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.laser-grid-effect {
  @include effect-stage(hidden);
}

.laser-floor {
  position: absolute;
  left: 50%;
  bottom: -20%;
  width: min(900px, 130vw);
  height: 68vh;
  transform: translateX(-50%) perspective(560px) rotateX(64deg);
  transform-origin: center bottom;
  background:
    repeating-linear-gradient(90deg, transparent 0 52px, rgba(45, 212, 191, 0.3) 53px 54px),
    repeating-linear-gradient(0deg, transparent 0 42px, rgba(34, 211, 238, 0.24) 43px 44px);
  filter: drop-shadow(0 0 28px rgba(45, 212, 191, 0.32));
  opacity: 0;
  animation: floor-in 5s ease both;
}

.laser-console {
  position: absolute;
  left: 50%;
  top: 48%;
  min-width: 190px;
  border: 1px solid rgba(45, 212, 191, 0.36);
  border-radius: 10px;
  background: rgba(6, 78, 59, 0.42);
  color: #ccfbf1;
  display: grid;
  gap: 10px;
  place-items: center;
  padding: 22px 28px;
  box-shadow:
    inset 0 0 26px rgba(45, 212, 191, 0.12),
    0 24px 70px rgba(45, 212, 191, 0.16);
  transform: translate(-50%, -50%);
  animation: console-in 5s ease both;
}

.laser-console svg {
  color: #2dd4bf;
  filter: drop-shadow(0 0 22px rgba(45, 212, 191, 0.62));
}

.laser-console strong {
  font-size: 19px;
}

@keyframes floor-in {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-50%) perspective(560px) rotateX(64deg) translateY(40px);
  }
  16%,
  84% {
    opacity: 1;
    transform: translateX(-50%) perspective(560px) rotateX(64deg) translateY(0);
  }
}

@keyframes console-in {
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
