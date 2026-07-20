<script setup lang="ts">
import { Clock3 } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const REWIND_AT = 2200; // 时间倒流的瞬间
const RESUME_AT = 3600; // 时间恢复正向

const scene: SceneFn = (api) => {
  api.setTrail(0.14);
  const cx = api.width / 2;
  const cy = api.height / 2;
  let timeDir = 1;

  api.at(REWIND_AT, () => {
    timeDir = -1;
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 50, endSize: 4, maxLife: 0.45, color: '#dbeafe', glow: 2.2 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 240, endSize: 20, maxLife: 0.8, color: '#93c5fd', opacity: 0.9, fadeIn: 0.06 });
  });
  api.at(RESUME_AT, () => {
    timeDir = 1;
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 280, maxLife: 0.8, color: '#bfdbfe', opacity: 0.9 });
  });

  // 秒针粒子流：绕表盘旋转，倒流时整体反向
  api.every(26, () => {
    let angle = api.range(0, Math.PI * 2);
    const radius = api.range(112, 150);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'spark',
      size: api.range(1.6, 2.8),
      maxLife: api.range(0.8, 1.4),
      color: api.rng() < 0.7 ? '#93c5fd' : '#e0e7ff',
      glow: 1.1,
      fadeIn: 0.1,
      update: (p, dt) => {
        angle += 2.8 * timeDir * dt;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius;
      },
    });
  }, { until: api.duration - 800 });

  // 时之砂：正向时下落，倒流时上升
  api.every(38, () => {
    const goingUp = timeDir < 0;
    api.spawn({
      x: api.range(0, api.width),
      y: goingUp ? api.height + 8 : -8,
      vy: goingUp ? api.range(-260, -120) : api.range(120, 260),
      vx: api.range(-20, 20),
      shape: 'dot',
      size: api.range(1, 2.2),
      maxLife: api.range(1.2, 2.2),
      color: goingUp ? '#bfdbfe' : '#93c5fd',
      twinkle: api.range(3, 7),
      wander: 30,
      glow: 1,
    });
  }, { until: api.duration - 900 });

  // 时间涟漪：正向外扩、倒流内收
  api.every(460, () => {
    const outward = timeDir > 0;
    api.spawn({
      x: cx,
      y: cy,
      shape: 'ring',
      size: outward ? 90 : 300,
      endSize: outward ? 320 : 60,
      maxLife: 1.1,
      color: '#93c5fd',
      opacity: 0.5,
      fadeIn: 0.1,
      fadeOut: 0.5,
    });
  }, { from: 300, until: api.duration - 1200 });

  // 残像刻度：表盘周围闪现的罗马数字
  api.every(240, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(170, 260);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'glyph',
      glyph: api.pick(['Ⅻ', 'Ⅲ', 'Ⅵ', 'Ⅸ', '∞', '⧖']),
      size: api.range(14, 24),
      maxLife: api.range(0.6, 1),
      color: 'rgba(191, 219, 254, 0.9)',
      spin: api.range(-0.8, 0.8) * timeDir,
      fadeIn: 0.2,
      fadeOut: 0.4,
    });
  }, { from: 400, until: api.duration - 1000 });
};
</script>

<template>
  <div class="time-fold-effect">
    <div class="time-fold-stage">
      <span
        v-for="fold in 9"
        :key="fold"
        class="time-fold-panel"
        :style="{ animationDelay: `${fold * 90}ms`, '--fold-shade': `${0.16 + (fold % 3) * 0.08}` }"
      />
    </div>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.timeFold" :scene="scene" />
    <div class="time-fold-clock">
      <span v-for="tick in 18" :key="tick" :style="{ '--tick-angle': `${tick * 20}deg` }" />
      <Clock3 :size="54" />
      <strong>时间折叠过渡</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.time-fold-effect {
  @include effect-stage(hidden);
  perspective: 900px;
}

.time-fold-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(680px, 88vw);
  height: min(410px, 68vh);
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  transform: translate(-50%, -50%);
}

.time-fold-panel {
  border: 1px solid rgba(147, 197, 253, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, var(--fold-shade)), rgba(96, 165, 250, 0.08)),
    rgba(15, 23, 42, 0.28);
  box-shadow: inset 0 0 36px rgba(96, 165, 250, 0.12);
  opacity: 0;
  transform-origin: center top;
  animation: time-fold-panel 4.9s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.time-fold-panel:nth-child(odd) {
  transform-origin: center bottom;
}

.time-fold-clock {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 210px;
  height: 210px;
  border: 1px solid rgba(191, 219, 254, 0.46);
  border-radius: 50%;
  color: #dbeafe;
  display: grid;
  gap: 8px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: time-fold-clock 4.9s ease both;
}

.time-fold-clock::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(96, 165, 250, 0.34), transparent 40%);
  animation: time-fold-spin 1.5s linear infinite;
}

.time-fold-clock span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 14px;
  border-radius: 999px;
  background: rgba(191, 219, 254, 0.72);
  transform: rotate(var(--tick-angle)) translateY(-96px);
  transform-origin: center 96px;
}

.time-fold-clock svg,
.time-fold-clock strong {
  position: relative;
  z-index: 1;
}

.time-fold-clock strong {
  font-size: 15px;
}

@keyframes time-fold-panel {
  0% { opacity: 0; transform: rotateX(82deg) scaleY(0.08); filter: blur(10px); }
  30% { opacity: 1; transform: rotateX(0deg) scaleY(1); filter: blur(0); }
  64% { opacity: 1; transform: rotateX(0deg) scaleY(1); }
  100% { opacity: 0; transform: rotateX(-74deg) scaleY(0.1); filter: blur(8px); }
}

@keyframes time-fold-clock {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.62) rotate(-20deg); }
  20%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
}

@keyframes time-fold-spin {
  to { transform: rotate(360deg); }
}
</style>
