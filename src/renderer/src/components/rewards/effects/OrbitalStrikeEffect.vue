<script setup lang="ts">
import { Crosshair } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const BEAM_AT = 1600;
const BEAM_END = 2600;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cx = api.width / 2;
  const cy = api.height * 0.58;

  // 幕一：天区扫描线
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > BEAM_AT - 100) return;
    const y = ((tMs % 700) / 700) * api.height * 0.4;
    const grad = ctx.createLinearGradient(0, y - 16, 0, y + 16);
    grad.addColorStop(0, 'rgba(248, 113, 113, 0)');
    grad.addColorStop(0.5, 'rgba(248, 113, 113, 0.2)');
    grad.addColorStop(1, 'rgba(248, 113, 113, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 16, api.width, 32);
  });

  // 幕二：天降光柱（白热核心 + 电离青边，宽度脉冲）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BEAM_AT || tMs > BEAM_END + 200) return;
    const ramp = Math.min(1, (tMs - BEAM_AT) / 120) * Math.max(0, Math.min(1, (BEAM_END + 200 - tMs) / 260));
    const w = (16 + Math.sin(tMs / 46) * 5) * ramp;
    const grad = ctx.createLinearGradient(cx - w * 2.4, 0, cx + w * 2.4, 0);
    grad.addColorStop(0, 'rgba(103, 232, 249, 0)');
    grad.addColorStop(0.28, `rgba(103, 232, 249, ${0.4 * ramp})`);
    grad.addColorStop(0.5, `rgba(255, 251, 235, ${0.95 * ramp})`);
    grad.addColorStop(0.72, `rgba(103, 232, 249, ${0.4 * ramp})`);
    grad.addColorStop(1, 'rgba(103, 232, 249, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w * 2.4, 0, w * 4.8, cy);
  });
  api.at(BEAM_AT + 60, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 20, endSize: 240, maxLife: 0.6, color: '#fff7ed', glow: 2.2, fadeOut: 0.9 });
  });

  // 幕三：地面冲击 —— 上半圆溅射（重力回落）+ 冲击环 + 烟尘 + 地表裂纹
  api.every(50, () => {
    api.burst({
      x: cx + api.range(-14, 14), y: cy, count: 16, speed: [180, 520],
      angle: [Math.PI + 0.25, Math.PI * 2 - 0.25],
      base: { shape: 'spark', size: 2.2, maxLife: 1.2, glow: 1.1, ay: 300, drag: 0.5, fadeOut: 0.35 },
      vary: (p, rng) => {
        p.color = rng() > 0.55 ? '#fca5a5' : rng() > 0.4 ? '#fdba74' : '#fef3c7';
        p.maxLife = 0.7 + rng() * 0.8;
      },
    });
  }, { from: BEAM_AT + 80, until: BEAM_END });
  [0, 180, 400].forEach((delay, i) => {
    api.at(BEAM_AT + 100 + delay, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 20,
        endSize: Math.max(api.width, api.height) * (0.34 + i * 0.18),
        maxLife: 0.95, color: i === 1 ? '#67e8f9' : '#f87171', opacity: 0.8, fadeOut: 0.72,
      });
    });
  });
  api.every(110, () => {
    api.spawn({
      x: cx + api.range(-90, 90), y: cy + api.range(-8, 8),
      vy: api.range(-40, -16), vx: api.range(-16, 16),
      shape: 'dot', size: api.range(14, 26), endSize: api.range(36, 54),
      maxLife: api.range(1.4, 2.2), color: 'rgba(120, 113, 108, 0.6)', glow: 0,
      opacity: 0.16, wander: 20, fadeIn: 0.16, fadeOut: 0.42,
    });
  }, { from: BEAM_AT + 160, until: 3600 });
  // 地表裂纹
  const cracks = Array.from({ length: 5 }, () => ({ angle: api.range(Math.PI + 0.2, Math.PI * 2 - 0.2), len: api.range(60, 170) }));
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BEAM_AT + 160) return;
    const heat = Math.max(0, 1 - (tMs - BEAM_AT - 160) / 2400);
    if (heat <= 0.02) return;
    ctx.strokeStyle = `rgba(248, 113, 113, ${0.55 * heat})`;
    ctx.lineWidth = 1.8;
    for (const c of cracks) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let px = cx;
      let py = cy;
      for (let s = 1; s <= 4; s += 1) {
        px += Math.cos(-c.angle) * (c.len / 4) + Math.sin(s * 7 + c.len) * 8;
        py += Math.abs(Math.sin(-c.angle)) * (c.len / 8) + 3;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  });
};
</script>

<template>
  <div class="orbital-strike-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.orbitalStrike" :scene="scene" />
    <div class="strike-crosshair">
      <Crosshair :size="120" :stroke-width="1" />
    </div>
    <div class="strike-warning">TARGET LOCKED · KINETIC BOMBARDMENT AUTHORIZED</div>
  </div>
</template>

<style scoped lang="scss">
.orbital-strike-effect {
  @include effect-stage(hidden);
  animation: strike-camera 5.2s ease both;
}

.strike-crosshair {
  position: absolute;
  left: 50%;
  top: 58%;
  color: rgba(248, 113, 113, 0.9);
  filter: drop-shadow(0 0 14px rgba(248, 113, 113, 0.6));
  transform: translate(-50%, -50%);
  animation: strike-lock 5.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.strike-warning {
  position: absolute;
  left: 50%;
  top: 9%;
  border: 1px solid rgba(248, 113, 113, 0.5);
  border-radius: 6px;
  background: rgba(69, 10, 10, 0.5);
  color: #fecaca;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.14em;
  padding: 8px 18px;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: strike-warning 5.2s step-end both;
}

@keyframes strike-lock {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(3.4) rotate(80deg); }
  10% { opacity: 1; }
  26% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  29% { transform: translate(-50%, -50%) scale(1.14); }
  31%, 48% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  56%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
}

@keyframes strike-warning {
  0%, 4% { opacity: 0; }
  6% { opacity: 1; }
  10% { opacity: 0.3; }
  14% { opacity: 1; }
  18% { opacity: 0.4; }
  22%, 78% { opacity: 1; }
  84%, 100% { opacity: 0; }
}

@keyframes strike-camera {
  0%, 30% { transform: translate(0, 0); }
  33% { transform: translate(-5px, 4px); }
  36% { transform: translate(5px, -4px); }
  39% { transform: translate(-4px, -3px); }
  42% { transform: translate(4px, 3px); }
  45% { transform: translate(-2px, 2px); }
  48%, 100% { transform: translate(0, 0); }
}
</style>
