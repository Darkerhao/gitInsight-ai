<script setup lang="ts">
import { Radar } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.22);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const orbitRadius = Math.min(200, Math.min(api.width, api.height) * 0.36);

  // 全息尘埃：缓缓上浮的青色微粒
  api.every(46, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.height + 6,
      vy: -api.range(40, 130),
      vx: api.range(-14, 14),
      shape: 'dot',
      size: api.range(0.9, 2),
      maxLife: api.range(1.8, 3.2),
      color: api.rng() < 0.7 ? '#67e8f9' : '#a5f3fc',
      twinkle: api.range(2, 6),
      wander: 24,
      glow: 1,
    });
  }, { until: api.duration - 900 });

  // 环绕准星的轨道流光：椭圆轨道双向环流
  api.every(36, () => {
    let angle = api.range(0, Math.PI * 2);
    const dir = api.rng() < 0.5 ? 1 : -1;
    const radius = orbitRadius * api.range(0.94, 1.1);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.92,
      shape: 'spark',
      size: api.range(1.6, 2.6),
      maxLife: api.range(0.9, 1.6),
      color: dir > 0 ? '#22d3ee' : '#a78bfa',
      glow: 1.1,
      fadeIn: 0.12,
      update: (p, dt) => {
        angle += 1.8 * dir * dt;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius * 0.92;
      },
    });
  }, { until: api.duration - 800 });

  // 面板间数据链路：两点之间射出的光束
  api.every(420, () => {
    const fromX = api.width * api.range(0.16, 0.84);
    const fromY = api.height * api.range(0.16, 0.8);
    const toX = api.width * api.range(0.16, 0.84);
    const toY = api.height * api.range(0.16, 0.8);
    const travel = 0.4;
    api.spawn({
      x: fromX,
      y: fromY,
      shape: 'spark',
      size: 2.6,
      maxLife: travel,
      color: '#7dd3fc',
      glow: 1.3,
      fadeIn: 0.1,
      update: (p) => {
        const progress = Math.min(1, p.life / travel);
        p.x = fromX + (toX - fromX) * progress;
        p.y = fromY + (toY - fromY) * progress;
      },
      onDeath: (p, sceneApi) => {
        sceneApi.spawn({ x: p.x, y: p.y, shape: 'ring', size: 4, endSize: 40, maxLife: 0.4, color: '#7dd3fc', opacity: 0.8 });
      },
    });
  }, { from: 600, until: api.duration - 1100 });

  // 开场展开脉冲
  api.at(200, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: orbitRadius * 1.8, maxLife: 1, color: '#67e8f9', opacity: 0.7 });
  });
};
</script>

<template>
  <div class="floating-hud-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.floatingHud" :scene="scene" />
    <div class="hud-reticle">
      <span v-for="tick in 24" :key="tick" :style="{ '--tick-angle': `${(tick - 1) * 15}deg` }" />
    </div>
    <span
      v-for="panel in 8"
      :key="panel"
      class="hud-panel"
      :style="{
        left: `${14 + (((panel - 1) * 23) % 72)}%`,
        top: `${14 + (((panel - 1) * 19) % 66)}%`,
        '--panel-depth': `${panel % 2 ? 26 : -22}px`,
        animationDelay: `${(panel - 1) * 95}ms`,
      }"
    >
      <i />
      <b />
    </span>
    <div class="hud-cabin">
      <Radar :size="54" />
      <strong>驾驶舱 HUD</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.floating-hud-effect {
  @include effect-stage(hidden);
  perspective: 900px;
}

.floating-hud-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(820px, 92vw);
  height: min(520px, 78vh);
  border: 1px solid rgba(34, 211, 238, 0.28);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateX(62deg);
  opacity: 0;
  animation: hud-orbit 5.2s ease both;
}

.hud-reticle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(360px, 58vw);
  aspect-ratio: 1;
  border: 1px solid rgba(34, 211, 238, 0.44);
  border-radius: 50%;
  box-shadow:
    inset 0 0 30px rgba(34, 211, 238, 0.12),
    0 0 48px rgba(34, 211, 238, 0.16);
  transform: translate(-50%, -50%) rotateX(18deg);
  animation: hud-reticle 5.2s ease both;
}

.hud-reticle span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 24px;
  border-radius: 999px;
  background: rgba(125, 249, 255, 0.74);
  transform: rotate(var(--tick-angle)) translateY(-172px);
  transform-origin: center 172px;
}

.hud-panel {
  position: absolute;
  width: 132px;
  height: 72px;
  border: 1px solid rgba(125, 249, 255, 0.46);
  border-radius: 9px;
  background:
    linear-gradient(135deg, rgba(34, 211, 238, 0.18), transparent 54%),
    rgba(2, 6, 23, 0.32);
  box-shadow: 0 0 32px rgba(34, 211, 238, 0.16);
  opacity: 0;
  transform: translate(-50%, -50%) translateZ(var(--panel-depth)) rotateY(-10deg);
  animation: hud-panel 4.8s ease both;
}

.hud-panel i,
.hud-panel b {
  position: absolute;
  left: 14px;
  right: 14px;
  height: 4px;
  border-radius: 999px;
  background: rgba(125, 249, 255, 0.72);
}

.hud-panel i {
  top: 18px;
}

.hud-panel b {
  top: 34px;
  width: 48%;
}

.hud-cabin {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #e0f2fe;
  transform: translate(-50%, -50%) translateZ(56px);
  animation: hud-cabin 5.2s ease both;
}

.hud-cabin strong {
  font-size: 16px;
}

@keyframes hud-orbit {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotateX(62deg) scale(0.82); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) rotateX(62deg) scale(1); }
}

@keyframes hud-reticle {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotateX(18deg) rotate(0deg) scale(0.76); }
  20%, 78% { opacity: 1; }
  100% { transform: translate(-50%, -50%) rotateX(18deg) rotate(92deg) scale(1.08); }
}

@keyframes hud-panel {
  0%, 100% { opacity: 0; transform: translate(-50%, -38%) translateZ(var(--panel-depth)) rotateY(-18deg) scale(0.86); }
  24%, 78% { opacity: 1; transform: translate(-50%, -50%) translateZ(var(--panel-depth)) rotateY(0deg) scale(1); }
  52% { transform: translate(calc(-50% + 8px), calc(-50% - 4px)) translateZ(var(--panel-depth)) rotateY(5deg) scale(1.02); }
}

@keyframes hud-cabin {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) translateZ(56px) scale(0.86); }
  20%, 78% { opacity: 1; transform: translate(-50%, -50%) translateZ(56px) scale(1); }
}
</style>
