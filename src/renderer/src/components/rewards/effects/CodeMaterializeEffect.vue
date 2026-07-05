<script setup lang="ts">
import { Code2 } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const codeLines = [
  'const scene = build(tokens)',
  'nodes.map(render)',
  'mesh.extrude(depth)',
  'commit.reward.play()',
  'return structure',
];

const GLYPHS = '{}<>()=;/+*01#$fnconstletif'.split('');

const scene: SceneFn = (api) => {
  api.setTrail(0.16);
  // 汇聚目标：与右下角 code-model 面板对齐
  const targetX = api.width * 0.82;
  const targetY = api.height * 0.72;

  // 字符从四周被"吸附"飞向模型，接近时收缩并闪光——实体化
  api.every(24, () => {
    const edge = Math.floor(api.range(0, 4));
    const x = edge === 0 ? -16 : edge === 1 ? api.width + 16 : api.range(0, api.width);
    const y = edge === 2 ? -16 : edge === 3 ? api.height + 16 : api.range(0, api.height);
    const travel = api.range(0.9, 1.6);
    api.spawn({
      x,
      y,
      vx: api.range(-40, 40),
      vy: api.range(-40, 40),
      shape: 'glyph',
      glyph: api.pick(GLYPHS),
      size: api.range(12, 20),
      endSize: 4,
      maxLife: travel,
      color: api.rng() < 0.24 ? '#99f6e4' : '#86efac',
      spin: api.range(-1.2, 1.2),
      fadeIn: 0.12,
      fadeOut: 0.12,
      update: (p, dt) => {
        const remaining = Math.max(0.08, p.maxLife - p.life);
        // 指向目标的追踪加速度：越接近死亡越强，保证准时抵达
        p.vx += ((targetX - p.x) / remaining - p.vx) * Math.min(1, dt * 6);
        p.vy += ((targetY - p.y) / remaining - p.vy) * Math.min(1, dt * 6);
      },
      onDeath: (p, sceneApi) => {
        if (sceneApi.rng() < 0.3) {
          sceneApi.spawn({ x: p.x, y: p.y, shape: 'dot', size: 6, endSize: 1, maxLife: 0.3, color: '#bbf7d0', glow: 1.6 });
        }
      },
    });
  }, { until: api.duration - 1100 });

  // 模型处的能量积聚脉冲
  api.every(900, () => {
    api.spawn({ x: targetX, y: targetY, shape: 'ring', size: 10, endSize: 120, maxLife: 0.9, color: '#4ade80', opacity: 0.75 });
  }, { from: 700, until: api.duration - 1300 });

  // 构建完成：绿色确认爆发
  api.at(api.duration - 1150, () => {
    api.spawn({ x: targetX, y: targetY, shape: 'dot', size: 40, endSize: 4, maxLife: 0.5, color: '#dcfce7', glow: 2 });
    api.burst({
      x: targetX,
      y: targetY,
      count: 60,
      speed: [80, 360],
      base: { shape: 'spark', size: 1.8, drag: 0.3, ay: 90, color: '#4ade80', twinkle: 8, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 0.7 + rng() * 0.8;
        if (rng() < 0.3) p.color = '#99f6e4';
      },
    });
  });
};
</script>

<template>
  <div class="code-materialize-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.codeMaterialize" :scene="scene" />
    <div class="code-lines">
      <span v-for="(line, index) in codeLines" :key="line" :style="{ animationDelay: `${index * 130}ms` }">
        {{ line }}
      </span>
    </div>
    <div class="code-model">
      <Code2 :size="52" />
      <strong>代码实体化</strong>
    </div>
  </div>
</template>

<style scoped>
.code-materialize-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  perspective: 900px;
}

.code-lines {
  position: absolute;
  left: 8%;
  top: 18%;
  display: grid;
  gap: 10px;
  color: rgba(187, 247, 208, 0.86);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 800;
  text-shadow: 0 0 14px rgba(34, 197, 94, 0.56);
}

.code-lines span {
  opacity: 0;
  transform: translateX(-18px);
  animation: code-line 3.8s ease both;
}

.code-model {
  position: absolute;
  right: 12%;
  bottom: 18%;
  width: 210px;
  height: 152px;
  border: 1px solid rgba(34, 197, 94, 0.36);
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.34);
  color: #dcfce7;
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  transform: perspective(800px) rotateX(58deg) rotateZ(-28deg);
  animation: code-model 5s ease both;
}

.code-model strong {
  font-size: 16px;
}

@keyframes code-line {
  0% { opacity: 0; transform: translateX(-18px); }
  24%, 68% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translate(54vw, 28vh) scale(0.28); }
}

@keyframes code-model {
  0%, 100% { opacity: 0; filter: blur(8px); }
  24%, 78% { opacity: 1; filter: blur(0); }
}
</style>
