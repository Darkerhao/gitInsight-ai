<script setup lang="ts">
import { ScanLine } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const MATRIX_CHARS = 'アイウエオカキクケコサシスセソﾀﾁﾂﾃﾄ01<>{}=/+*#$&%'.split('');
const REWARD_WORDS = ['Git', 'PR', 'OK', 'AI', 'TS', 'fix', 'feat'];

const scene: SceneFn = (api) => {
  api.setTrail(0.07); // 极长残留：字符雨的经典渐隐尾迹
  const cell = 21;
  const columns = Math.max(8, Math.floor(api.width / cell));
  const duration = api.duration / 1000;

  // 每列一个"雨头"：按格步进下落、随机换字，尾迹由画布残留自然形成
  for (let col = 0; col < columns; col += 1) {
    if (api.rng() > 0.88) continue;
    const stepTime = api.range(0.038, 0.095);
    const isGold = api.rng() < 0.06;
    let acc = api.range(0, stepTime);
    api.spawn({
      x: col * cell + cell / 2,
      y: -api.range(0, api.height * 1.4),
      shape: 'glyph',
      glyph: api.pick(MATRIX_CHARS),
      size: api.range(13, 17),
      color: isGold ? '#fde68a' : '#c7fbdd',
      glow: 0,
      maxLife: duration,
      fadeIn: 0,
      fadeOut: 0.05,
      update: (p, dt) => {
        acc += dt;
        if (acc >= stepTime) {
          acc = 0;
          p.y += cell;
          p.glyph = api.rng() < 0.12 && isGold ? api.pick(REWARD_WORDS) : api.pick(MATRIX_CHARS);
          if (p.y > api.height + cell) {
            p.y = -cell * api.range(1, 14);
          }
        }
      },
    });
  }

  // 数据节点闪烁：网格交点上的绿色光斑
  api.every(160, () => {
    api.spawn({
      x: Math.floor(api.range(0, columns)) * cell + cell / 2,
      y: Math.floor(api.range(0, api.height / cell)) * cell,
      shape: 'dot',
      size: api.range(2, 4),
      endSize: 1,
      maxLife: api.range(0.4, 0.9),
      color: '#34d399',
      glow: 1.4,
      twinkle: 10,
    });
  }, { from: 300, until: api.duration - 900 });

  // 周期性的横向扫描波
  const waves: number[] = [];
  let sceneTime = 0;
  api.every(1400, () => waves.push(sceneTime), { from: 900, until: api.duration - 1800 });
  api.onFrame((tMs, _dt, ctx) => {
    sceneTime = tMs;
    for (let i = waves.length - 1; i >= 0; i -= 1) {
      const age = (tMs - waves[i]) / 900;
      if (age > 1) {
        waves.splice(i, 1);
        continue;
      }
      const y = age * api.height;
      const alpha = 0.5 * Math.sin(Math.PI * Math.min(1, age * 1.06));
      const gradient = ctx.createLinearGradient(0, y - 26, 0, y + 4);
      gradient.addColorStop(0, 'rgba(110, 231, 183, 0)');
      gradient.addColorStop(1, `rgba(110, 231, 183, ${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y - 26, api.width, 30);
    }
  });
};
</script>

<template>
  <div class="matrix-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.matrix" :scene="scene" />
    <div class="matrix-console">
      <ScanLine :size="42" />
      <strong>代码矩阵</strong>
    </div>
  </div>
</template>

<style scoped>
.matrix-effect {
  position: absolute;
  inset: 0;
}

.matrix-console {
  position: absolute;
  left: 50%;
  top: 50%;
  min-width: 190px;
  border: 1px solid rgba(52, 211, 153, 0.36);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.62);
  color: #a7f3d0;
  display: grid;
  gap: 10px;
  place-items: center;
  padding: 22px 26px;
  box-shadow:
    inset 0 0 26px rgba(52, 211, 153, 0.12),
    0 24px 70px rgba(2, 6, 23, 0.28);
  transform: translate(-50%, -50%);
  animation: matrix-console 4.6s ease both;
}

.matrix-console::after {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  top: 12px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #34d399, transparent);
  animation: matrix-scan 1.4s ease-in-out infinite;
}

.matrix-console strong {
  font-size: 18px;
}

@keyframes matrix-console {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.94);
  }
  18%,
  76% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}

@keyframes matrix-scan {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(92px);
  }
}
</style>
