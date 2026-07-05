<script setup lang="ts">
import { Bot } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const BOOT_LINES = [
  'REACTOR CORE ........... ONLINE',
  'SERVO MOTORS ........... OK',
  'NEURAL LINK ............ SYNC 98%',
  'WEAPON SYSTEMS ......... ARMED',
];
const EYES_AT = 2200;
const HUD_AT = 3400;

const scene: SceneFn = (api) => {
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 幕一：自检期字符碎屑稀疏坠落
  api.every(90, () => {
    api.spawn({
      x: api.rng() * api.width, y: -12, vy: api.range(60, 140),
      shape: 'glyph', glyph: api.pick('01<>#/\\'.split('')), size: api.range(10, 14),
      maxLife: 2, color: 'rgba(34, 211, 238, 0.6)', fadeIn: 0.1, fadeOut: 0.3,
    });
  }, { until: EYES_AT });

  // 幕二：目镜点亮 —— 双色光缝自中线向两侧展开 + 蒸汽上浮
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < EYES_AT || tMs > HUD_AT + 500) return;
    const open = Math.min(1, (tMs - EYES_AT) / 500);
    const fade = tMs > HUD_AT ? Math.max(0, 1 - (tMs - HUD_AT) / 500) : 1;
    const eyeW = 150 * open;
    const flick = 0.7 + 0.3 * Math.sin(tMs / 36);
    [
      { x: cx - 105, color: `rgba(34, 211, 238, ${0.85 * fade * flick})` },
      { x: cx + 105, color: `rgba(248, 113, 113, ${0.85 * fade * flick})` },
    ].forEach((eye) => {
      const grad = ctx.createLinearGradient(eye.x - eyeW / 2, 0, eye.x + eyeW / 2, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, eye.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(eye.x - eyeW / 2, cy - 60);
      ctx.lineTo(eye.x + eyeW / 2, cy - 60);
      ctx.stroke();
    });
  });
  api.every(120, () => {
    api.spawn({
      x: cx + api.range(-220, 220), y: api.height + 14,
      vy: api.range(-46, -20), shape: 'dot', size: api.range(16, 30), endSize: api.range(40, 60),
      maxLife: api.range(1.6, 2.6), color: 'rgba(148, 163, 184, 0.5)', glow: 0,
      opacity: 0.16, wander: 24, fadeIn: 0.2, fadeOut: 0.4,
    });
  }, { from: EYES_AT, until: HUD_AT + 600 });

  // 幕三：HUD 环序列展开 + 刻度弧旋转 + 边缘电流迸溅
  [70, 118, 168].forEach((r, i) => {
    api.at(HUD_AT + i * 150, () => {
      api.spawn({
        x: cx, y: cy - 40, shape: 'ring', size: 8, endSize: r,
        maxLife: 0.7 + i * 0.12, color: i === 1 ? '#f87171' : '#22d3ee', opacity: 0.8, fadeOut: 0.5,
      });
    });
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < HUD_AT + 300) return;
    const fade = Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 500)) * Math.min(1, (tMs - HUD_AT - 300) / 400);
    if (fade <= 0.02) return;
    const spin = tMs / 1000;
    [88, 150].forEach((r, i) => {
      const dir = i === 0 ? 1 : -1;
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.5 * fade})`;
      ctx.lineWidth = 2.2;
      for (let s = 0; s < 3; s += 1) {
        const a = dir * spin * (0.6 + i * 0.3) + (s / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy - 40, r, a, a + 0.7);
        ctx.stroke();
      }
    });
  });
  api.every(130, () => {
    const edge = Math.floor(api.rng() * 4);
    const x = edge < 2 ? api.rng() * api.width : edge === 2 ? 12 : api.width - 12;
    const y = edge === 0 ? 12 : edge === 1 ? api.height - 12 : api.rng() * api.height;
    api.burst({
      x, y, count: 6, speed: [40, 160],
      base: { shape: 'spark', size: 1.6, maxLife: 0.4, color: '#67e8f9', glow: 1.2, drag: 0.4, fadeOut: 0.5 },
    });
  }, { from: HUD_AT, until: api.duration - 700 });

  // 结尾 power surge
  api.at(5200, () => {
    api.spawn({ x: cx, y: cy - 40, shape: 'dot', size: 20, endSize: 320, maxLife: 0.55, color: '#cffafe', glow: 2, fadeOut: 0.92 });
  });
};
</script>

<template>
  <div class="mecha-boot-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.mechaBoot" :scene="scene" />
    <div class="mecha-terminal">
      <span v-for="(line, i) in BOOT_LINES" :key="line" :style="{ animationDelay: `${260 + i * 420}ms` }">
        {{ line }}
      </span>
    </div>
    <div class="mecha-status">
      <Bot :size="30" />
      <strong>ALL SYSTEMS NOMINAL</strong>
    </div>
  </div>
</template>

<style scoped>
.mecha-boot-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.mecha-terminal {
  position: absolute;
  left: 8%;
  top: 12%;
  color: #67e8f9;
  display: grid;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-shadow: 0 0 12px rgba(34, 211, 238, 0.55);
  animation: mecha-terminal 6s ease both;
}

.mecha-terminal span {
  opacity: 0;
  animation: mecha-line 0.36s steps(6) both;
}

.mecha-status {
  position: absolute;
  left: 50%;
  bottom: 12%;
  border: 1px solid rgba(34, 211, 238, 0.4);
  border-radius: 10px;
  background: rgba(4, 20, 30, 0.5);
  color: #cffafe;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: mecha-status 6s ease both;
}

.mecha-status strong {
  font-size: 14px;
  letter-spacing: 0.2em;
}

@keyframes mecha-line {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes mecha-terminal {
  0%, 60% { opacity: 1; }
  74%, 100% { opacity: 0; }
}

@keyframes mecha-status {
  0%, 82% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  88%, 96% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.9; }
}
</style>
