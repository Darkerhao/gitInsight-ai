<script setup lang="ts">
import { Boxes } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const EXPLODE_AT = 1600;
const MERGE_AT = 3800;

const scene: SceneFn = (api) => {
  const cx = api.width / 2;
  const cy = api.height / 2;
  // 拆解后三层部件的悬浮位（与 DOM 关键帧一致：上 / 中 / 下）
  const partAnchors = [
    { x: cx, y: cy - 128 },
    { x: cx, y: cy },
    { x: cx, y: cy + 128 },
  ];

  // 幕一：通电成型 —— 检修弧线环绕
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > EXPLODE_AT) return;
    const ramp = Math.min(1, tMs / 400);
    const spin = tMs / 1000 * 2.2;
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.6 * ramp})`;
    ctx.lineWidth = 2;
    for (let s = 0; s < 2; s += 1) {
      const a = spin + s * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, 96, a, a + 1.1);
      ctx.stroke();
    }
  });
  api.every(160, () => {
    api.spawn({
      x: cx + api.range(-70, 70), y: cy + api.range(-70, 70),
      shape: 'spark', size: api.range(1.4, 2.4), maxLife: 0.5,
      color: '#bae6fd', glow: 1.2, fadeOut: 0.5,
    });
  }, { until: EXPLODE_AT });

  // 幕二：拆解 —— 每层剥离时迸出碎屑 + 引出标注线 + 部件编号
  partAnchors.forEach((anchor, i) => {
    api.at(EXPLODE_AT + i * 180, () => {
      api.burst({
        x: cx, y: cy, count: 22, speed: [60, 240],
        base: { shape: 'rect', size: 5, maxLife: 1.1, color: '#7dd3fc', glow: 0, composite: 'source-over', opacity: 0.8, spin: 3, flutter: 1, drag: 0.4, ay: 40, fadeOut: 0.4 },
        vary: (p, rng) => {
          p.size = 3 + rng() * 6;
          p.spin = (rng() - 0.5) * 7;
        },
      });
      api.spawn({
        x: anchor.x + 150, y: anchor.y, shape: 'glyph', glyph: `PRT-0${i + 1}`,
        size: 12, maxLife: (MERGE_AT - EXPLODE_AT - i * 180) / 1000, color: '#bae6fd',
        font: '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.14, fadeOut: 0.2,
      });
    });
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < EXPLODE_AT + 260 || tMs > MERGE_AT) return;
    const fade = Math.min(1, (tMs - EXPLODE_AT - 260) / 300) * Math.max(0, Math.min(1, (MERGE_AT - tMs) / 240));
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.5 * fade})`;
    ctx.lineWidth = 1;
    partAnchors.forEach((anchor) => {
      ctx.beginPath();
      ctx.moveTo(anchor.x + 66, anchor.y);
      ctx.lineTo(anchor.x + 118, anchor.y);
      ctx.stroke();
    });
  });

  // 幕三：重组 —— 合体瞬间冲击环 + 纵向光柱
  api.at(MERGE_AT + 500, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 14, endSize: 220, maxLife: 0.55, color: '#f0f9ff', glow: 2.2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 300, maxLife: 0.9, color: '#7dd3fc', opacity: 0.85, fadeOut: 0.7 });
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < MERGE_AT + 500 || tMs > MERGE_AT + 1300) return;
    const life = (tMs - MERGE_AT - 500) / 800;
    const alpha = Math.sin(life * Math.PI) * 0.7;
    const grad = ctx.createLinearGradient(cx - 30, 0, cx + 30, 0);
    grad.addColorStop(0, 'rgba(125, 211, 252, 0)');
    grad.addColorStop(0.5, `rgba(224, 242, 254, ${alpha})`);
    grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 30, 0, 60, api.height);
  });
};
</script>

<template>
  <div class="holo-dis-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.holoDisassemble" :scene="scene" />
    <div class="holo-parts">
      <div class="holo-part is-top"><Boxes :size="26" /></div>
      <div class="holo-part is-mid"><strong>CORE</strong></div>
      <div class="holo-part is-bottom"><small>BASE MODULE</small></div>
    </div>
    <div class="holo-version">UPGRADED → v2.0</div>
  </div>
</template>

<style scoped lang="scss">
.holo-dis-effect {
  @include effect-stage(hidden);
}

.holo-parts {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
}

.holo-part {
  position: absolute;
  width: 128px;
  height: 84px;
  border: 1px solid rgba(125, 211, 252, 0.66);
  border-radius: 10px;
  background: rgba(12, 74, 110, 0.24);
  box-shadow: 0 0 22px rgba(125, 211, 252, 0.3), inset 0 0 18px rgba(125, 211, 252, 0.14);
  color: #bae6fd;
  display: grid;
  place-items: center;
  backdrop-filter: blur(2px);
  transform: translate(-50%, -50%);
  left: 50%;
  top: 50%;
}

.holo-part.is-top { animation: holo-top 5.6s cubic-bezier(0.3, 0, 0.2, 1) both; }
.holo-part.is-mid { animation: holo-mid 5.6s cubic-bezier(0.3, 0, 0.2, 1) both; }
.holo-part.is-bottom { animation: holo-bottom 5.6s cubic-bezier(0.3, 0, 0.2, 1) both; }

.holo-part strong { font-size: 15px; letter-spacing: 0.24em; }
.holo-part small { font-size: 10px; letter-spacing: 0.18em; }

.holo-version {
  position: absolute;
  left: 50%;
  bottom: 13%;
  color: #e0f2fe;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 15px;
  letter-spacing: 0.2em;
  text-shadow: 0 0 16px rgba(125, 211, 252, 0.7);
  transform: translateX(-50%);
  animation: holo-version 5.6s ease both;
}

/* 0-1.5s 成型 → 1.6-3.8s 分层悬浮 → 4.3s 合体 → 尾声淡出 */
@keyframes holo-top {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
  12%, 27% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  36%, 66% { opacity: 1; transform: translate(-50%, calc(-50% - 128px)) rotate(-7deg); }
  77%, 88% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
}

@keyframes holo-mid {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
  12%, 27% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  36%, 66% { opacity: 1; transform: translate(-50%, -50%) rotate(4deg) scale(1.06); }
  77%, 88% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
}

@keyframes holo-bottom {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
  12%, 27% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  36%, 66% { opacity: 1; transform: translate(-50%, calc(-50% + 128px)) rotate(6deg); }
  77%, 88% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
}

@keyframes holo-version {
  0%, 80% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  88%, 96% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.9; }
}
</style>
