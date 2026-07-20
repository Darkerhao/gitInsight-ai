<script setup lang="ts">
import { Activity } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const BREATH_SECONDS = 3.2; // 与 CSS 卡片呼吸节奏一致

const scene: SceneFn = (api) => {
  api.setTrail(0.5);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const duration = api.duration / 1000;

  // 呼吸光晕：随呼吸节奏胀缩的柔和绿色光球
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (duration - t) / 1.1));
    if (envelope <= 0) return;
    const breath = 0.5 + 0.5 * Math.sin((t / BREATH_SECONDS) * Math.PI * 2 - Math.PI / 2);
    const radius = 200 + breath * 90;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(74, 222, 128, ${(0.1 + breath * 0.14) * envelope})`);
    gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // 吸气时萤火虫聚拢、呼气时散开
  api.every(70, () => {
    const angle = api.range(0, Math.PI * 2);
    const baseRadius = api.range(140, Math.min(api.width, api.height) * 0.44);
    api.spawn({
      x: cx + Math.cos(angle) * baseRadius,
      y: cy + Math.sin(angle) * baseRadius,
      shape: 'dot',
      size: api.range(1.2, 2.6),
      maxLife: api.range(2.4, 4),
      color: api.rng() < 0.7 ? '#86efac' : '#bbf7d0',
      twinkle: api.range(1, 3),
      glow: 1,
      fadeIn: 0.16,
      fadeOut: 0.2,
      update: (p, dt) => {
        const t = p.life + p.phase;
        const breathVelocity = Math.cos(((t) / BREATH_SECONDS) * Math.PI * 2) * 26;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        p.x += (dx / dist) * breathVelocity * dt * 3;
        p.y += (dy / dist) * breathVelocity * dt * 3;
        p.x += Math.sin(t * 1.3) * 8 * dt;
        p.y += Math.cos(t * 1.1) * 8 * dt;
      },
    });
  }, { until: api.duration - 1200 });

  // 每次呼吸顶点的柔和涟漪
  api.every(BREATH_SECONDS * 1000, () => {
    api.spawn({
      x: cx,
      y: cy,
      shape: 'ring',
      size: 130,
      endSize: 360,
      maxLife: 1.8,
      color: 'rgba(134, 239, 172, 0.6)',
      opacity: 0.5,
      fadeIn: 0.14,
      fadeOut: 0.6,
    });
  }, { from: 1000, until: api.duration - 1800 });
};
</script>

<template>
  <div class="breathing-ui-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.breathingUi" :scene="scene" />
    <div class="breathing-shell">
      <div class="breathing-header">
        <Activity :size="42" />
        <strong>呼吸 UI</strong>
      </div>
      <div class="breathing-grid">
        <span
          v-for="card in 9"
          :key="card"
          class="breathing-card"
          :style="{ animationDelay: `${(card - 1) * 110}ms`, '--line-width': `${54 + (card % 3) * 18}%` }"
        />
      </div>
    </div>
    <span class="breathing-aura" />
  </div>
</template>

<style scoped lang="scss">
.breathing-ui-effect {
  @include effect-stage(hidden);
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
