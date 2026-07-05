<script setup lang="ts">
import { Satellite } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const PASS_FROM = 800;
const PASS_TO = 4200;
const BEAM_FROM = 2000;
const BEAM_TO = 3800;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  // 卫星抛物线轨迹（与 DOM 动画同参数）
  const satPos = (tMs: number) => {
    const k = Math.min(1, Math.max(0, (tMs - PASS_FROM) / (PASS_TO - PASS_FROM)));
    return {
      x: api.width * (-0.06 + k * 1.12),
      y: api.height * (0.34 - Math.sin(k * Math.PI) * 0.16),
    };
  };
  const earthTop = api.height * 0.86;
  const ground = { x: api.width * 0.56, y: earthTop };

  // 星野
  for (let i = 0; i < 60; i += 1) {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * earthTop * 0.9,
      shape: 'dot', size: api.range(0.7, 1.6), maxLife: 5.6,
      color: '#e2e8f0', glow: 0.7, opacity: api.range(0.3, 0.7),
      twinkle: api.range(0.5, 1.4), fadeOut: 0.12,
    });
  }

  // 地球弧线 + 大气辉光
  api.onFrame((tMs, _dt, ctx) => {
    const fade = Math.min(1, tMs / 500) * Math.max(0, Math.min(1, (api.duration - 400 - tMs) / 500));
    if (fade <= 0.02) return;
    const r = api.width * 1.4;
    const cyE = earthTop + r;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.55 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(api.width / 2, cyE, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.16 * fade})`;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(api.width / 2, cyE, r + 12, Math.PI * 1.24, Math.PI * 1.76);
    ctx.stroke();
  });

  // 卫星尾迹（跟随 DOM 卫星同一参数轨迹）
  api.every(24, (index) => {
    const tMs = PASS_FROM + index * 24;
    if (tMs > PASS_TO) return;
    const pos = satPos(tMs);
    api.spawn({
      x: pos.x, y: pos.y, shape: 'spark', size: 1.8, maxLife: 0.9,
      color: '#7dd3fc', glow: 1, fadeIn: 0.05, fadeOut: 0.6,
    });
  }, { from: PASS_FROM, until: PASS_TO });

  // 通讯波束（卫星 → 地面站的渐变扇形）+ 数据下行
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BEAM_FROM || tMs > BEAM_TO + 200) return;
    const ramp = Math.min(1, (tMs - BEAM_FROM) / 300) * Math.max(0, Math.min(1, (BEAM_TO + 200 - tMs) / 260));
    const pos = satPos(tMs);
    const grad = ctx.createLinearGradient(pos.x, pos.y, ground.x, ground.y);
    grad.addColorStop(0, `rgba(125, 211, 252, ${0.5 * ramp})`);
    grad.addColorStop(1, 'rgba(125, 211, 252, 0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(ground.x - 46, ground.y);
    ctx.lineTo(ground.x + 46, ground.y);
    ctx.closePath();
    ctx.fill();
  });
  api.every(70, (index) => {
    const tMs = BEAM_FROM + index * 70;
    if (tMs > BEAM_TO) return;
    const pos = satPos(tMs);
    const dx = ground.x - pos.x;
    const dy = ground.y - pos.y;
    const len = Math.hypot(dx, dy);
    api.spawn({
      x: pos.x, y: pos.y, vx: (dx / len) * 340, vy: (dy / len) * 340,
      shape: 'glyph', glyph: api.pick('0101┊▾▾'.split('')), size: api.range(10, 14),
      maxLife: len / 340, color: '#bae6fd', fadeIn: 0.08, fadeOut: 0.16,
    });
  }, { from: BEAM_FROM, until: BEAM_TO });

  // 地面站应答：上行冲击环 + 火花
  api.every(420, () => {
    api.spawn({
      x: ground.x, y: ground.y, shape: 'ring', size: 8, endSize: 90,
      maxLife: 0.8, color: '#38bdf8', opacity: 0.75, fadeOut: 0.6,
    });
    api.burst({
      x: ground.x, y: ground.y, count: 8, speed: [60, 170],
      angle: [Math.PI * 1.15, Math.PI * 1.85],
      base: { shape: 'spark', size: 1.6, maxLife: 0.6, color: '#7dd3fc', glow: 1, drag: 0.4, fadeOut: 0.4 },
    });
  }, { from: 3400, until: 4600 });
};
</script>

<template>
  <div class="satellite-sweep-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.satelliteSweep" :scene="scene" />
    <div class="sat-body">
      <span class="sat-panel is-left" />
      <Satellite :size="30" />
      <span class="sat-panel is-right" />
    </div>
    <div class="sat-hud">UPLINK 100% · SYNCED</div>
  </div>
</template>

<style scoped>
.satellite-sweep-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.sat-body {
  position: absolute;
  left: 0;
  top: 0;
  color: #bae6fd;
  display: flex;
  align-items: center;
  gap: 5px;
  filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.7));
  animation: sat-fly 5.6s linear both;
}

.sat-panel {
  width: 26px;
  height: 12px;
  border: 1px solid rgba(125, 211, 252, 0.8);
  background:
    repeating-linear-gradient(90deg, rgba(56, 189, 248, 0.5) 0 5px, rgba(8, 47, 73, 0.6) 5px 7px);
  transform: scaleX(0);
  animation: sat-unfold 5.6s ease both;
}

.sat-panel.is-left { transform-origin: right; }
.sat-panel.is-right { transform-origin: left; }

.sat-hud {
  position: absolute;
  left: 56%;
  bottom: 9%;
  border: 1px solid rgba(56, 189, 248, 0.44);
  border-radius: 7px;
  background: rgba(8, 47, 73, 0.52);
  color: #e0f2fe;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.16em;
  padding: 8px 16px;
  transform: translateX(-50%);
  animation: sat-hud 5.6s ease both;
}

/* 与 canvas satPos() 同步：14%-75% 时间段横越屏幕，正弦升降 */
@keyframes sat-fly {
  0%, 13% { opacity: 0; transform: translate(-6vw, 34vh); }
  15% { opacity: 1; }
  32% { transform: translate(24vw, 22vh); }
  45% { transform: translate(48vw, 18vh); }
  60% { transform: translate(76vw, 23vh); }
  73% { opacity: 1; }
  76%, 100% { opacity: 0; transform: translate(106vw, 34vh); }
}

@keyframes sat-unfold {
  0%, 15% { transform: scaleX(0); }
  22%, 100% { transform: scaleX(1); }
}

@keyframes sat-hud {
  0%, 62% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  70%, 92% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}
</style>
