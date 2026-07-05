<script setup lang="ts">
import { Dna } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const HELIX_FROM = 1400;
const HELIX_UNTIL = 3800;
const VERIFY_AT = 3800;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cx = api.width / 2;

  // 幕一：扫描光带自上而下 + 沿途网格火花
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > HELIX_FROM) return;
    const y = (tMs / HELIX_FROM) * api.height;
    const grad = ctx.createLinearGradient(0, y - 26, 0, y + 26);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0)');
    grad.addColorStop(0.5, 'rgba(52, 211, 153, 0.34)');
    grad.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 26, api.width, 52);
  });
  api.every(60, (index) => {
    const y = (index * 60 / HELIX_FROM) * api.height;
    for (let i = 0; i < 3; i += 1) {
      api.spawn({
        x: Math.round(api.rng() * (api.width / 42)) * 42, y,
        shape: 'spark', size: api.range(1.2, 2), maxLife: 0.5,
        color: '#6ee7b7', glow: 1, fadeOut: 0.5,
      });
    }
  }, { until: HELIX_FROM });

  // 幕二：DNA 双螺旋对旋上升 + 碱基横杠
  const helixR = Math.min(140, api.width * 0.16);
  const rise = 130;
  api.every(22, () => {
    [0, Math.PI].forEach((side) => {
      api.spawn({
        x: cx, y: api.height + 12, vy: -rise,
        shape: 'dot', size: 3, maxLife: (api.height + 40) / rise,
        color: side === 0 ? '#34d399' : '#22d3ee', glow: 1.15,
        fadeIn: 0.04, fadeOut: 0.1, phase: side,
        update: (p) => {
          p.x = cx + Math.sin((api.height - p.y) / 46 + p.phase) * helixR;
        },
      });
    });
  }, { from: HELIX_FROM, until: HELIX_UNTIL });
  api.every(150, () => {
    const y = api.height + 6;
    const phase = (api.height - y) / 46;
    api.spawn({
      x: cx, y, vy: -rise, shape: 'rect', size: 4, maxLife: (api.height + 30) / rise,
      color: 'rgba(167, 243, 208, 0.65)', glow: 0, opacity: 0.6,
      fadeIn: 0.05, fadeOut: 0.1,
      update: (p) => {
        const t = (api.height - p.y) / 46;
        const x1 = Math.sin(t + phase) * helixR;
        p.x = cx + x1 * 0.5;
        p.rotation = Math.PI / 2;
        p.size = Math.max(2, Math.abs(x1));
      },
    });
  }, { from: HELIX_FROM + 120, until: HELIX_UNTIL - 200 });

  // 幕三：收束成光柱 + 认证通过
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < VERIFY_AT || tMs > VERIFY_AT + 900) return;
    const life = (tMs - VERIFY_AT) / 900;
    const alpha = Math.sin(life * Math.PI) * 0.8;
    const grad = ctx.createLinearGradient(cx - 26, 0, cx + 26, 0);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0)');
    grad.addColorStop(0.5, `rgba(209, 250, 229, ${alpha})`);
    grad.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 26, 0, 52, api.height);
  });
  api.at(VERIFY_AT + 300, () => {
    const cy = api.height / 2;
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 260, maxLife: 0.9, color: '#34d399', opacity: 0.85, fadeOut: 0.7 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 12, endSize: 170, maxLife: 0.8, color: '#a7f3d0', opacity: 0.7, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 46, speed: [80, 260],
      base: { shape: 'spark', size: 2, maxLife: 1, color: '#6ee7b7', glow: 1.1, drag: 0.4, fadeOut: 0.4 },
    });
  });
};
</script>

<template>
  <div class="bio-scan-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.bioScan" :scene="scene" />
    <div class="bio-verdict">
      <Dna :size="26" />
      <strong>IDENTITY VERIFIED ✓</strong>
      <small>基因序列匹配 99.98%</small>
    </div>
  </div>
</template>

<style scoped>
.bio-scan-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.bio-verdict {
  position: absolute;
  left: 50%;
  bottom: 13%;
  border: 1px solid rgba(52, 211, 153, 0.44);
  border-radius: 10px;
  background: rgba(2, 44, 34, 0.5);
  color: #d1fae5;
  display: grid;
  gap: 5px;
  place-items: center;
  padding: 12px 24px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: bio-verdict 5.4s ease both;
}

.bio-verdict strong {
  font-size: 14px;
  letter-spacing: 0.16em;
}

.bio-verdict small {
  color: rgba(167, 243, 208, 0.72);
  font-size: 11px;
}

@keyframes bio-verdict {
  0%, 74% { opacity: 0; transform: translateX(-50%) translateY(14px) scale(0.92); }
  82%, 94% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  100% { opacity: 0.9; }
}
</style>
