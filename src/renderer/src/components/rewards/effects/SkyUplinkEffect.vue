<script setup lang="ts">
import { CloudUpload } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const UPLOAD_FROM = 1200;
const DONE_AT = 4000;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cloudX = api.width / 2;
  const cloudY = api.height * 0.22;

  // 幕一：底部数据池 —— 0/1 字符翻涌
  api.every(30, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.height - api.rng() * 70,
      vy: api.range(-30, -8), shape: 'glyph', glyph: api.rng() > 0.5 ? '1' : '0',
      size: api.range(10, 16), maxLife: api.range(0.8, 1.6),
      color: api.rng() > 0.6 ? '#93c5fd' : 'rgba(96, 165, 250, 0.55)',
      wander: 30, fadeIn: 0.14, fadeOut: 0.3,
    });
  }, { until: DONE_AT });

  // 幕二：上载 —— 数据束冲向云核（seed 决定束流位置）
  const columns = Array.from({ length: 5 }, () => api.width * (0.2 + api.rng() * 0.6));
  api.every(40, () => {
    const colX = api.pick(columns) + api.range(-8, 8);
    const dy = cloudY + 22 - (api.height - 40);
    const speed = api.range(420, 640);
    const dirX = (cloudX - colX) / Math.abs(dy) * 0.34;
    api.spawn({
      x: colX, y: api.height - 40,
      vx: dirX * speed, vy: -speed,
      shape: 'streak', stretch: 0.09, size: api.range(1.6, 2.8),
      maxLife: Math.abs(dy) / speed, color: api.pick(['#60a5fa', '#93c5fd', '#38bdf8']),
      glow: 1.05, fadeIn: 0.06, fadeOut: 0.12,
      update: (p, dt) => {
        p.vx += (cloudX - p.x) * 2.4 * dt;
      },
    });
    if (api.rng() > 0.6) {
      api.spawn({
        x: colX, y: api.height - 36, vy: -speed * 0.82, vx: dirX * speed * 0.8,
        shape: 'glyph', glyph: api.rng() > 0.5 ? '1' : '0', size: 11,
        maxLife: Math.abs(dy) / (speed * 0.82), color: '#bfdbfe', fadeIn: 0.08, fadeOut: 0.14,
      });
    }
  }, { from: UPLOAD_FROM, until: DONE_AT - 100 });
  // 束流命中云核的微脉冲
  api.every(360, () => {
    api.spawn({
      x: cloudX + api.range(-24, 24), y: cloudY + 26, shape: 'spark',
      size: api.range(2, 3.4), maxLife: 0.4, color: '#dbeafe', glow: 1.5, fadeOut: 0.6,
    });
  }, { from: UPLOAD_FROM + 400, until: DONE_AT });

  // 云核环形进度弧
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < UPLOAD_FROM - 300) return;
    const fade = Math.min(1, (tMs - UPLOAD_FROM + 300) / 400) * Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 500));
    if (fade <= 0.02) return;
    const progress = Math.min(1, Math.max(0, (tMs - UPLOAD_FROM) / (DONE_AT - UPLOAD_FROM)));
    const r = 54;
    ctx.strokeStyle = `rgba(96, 165, 250, ${0.24 * fade})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cloudX, cloudY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(191, 219, 254, ${0.9 * fade})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cloudX, cloudY, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    // 进度百分比
    ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = `rgba(219, 234, 254, ${0.9 * fade})`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(progress * 100)}%`, cloudX, cloudY + r + 22);
  });

  // 幕三：100% —— 确认环 + 金色光雨回洒
  api.at(DONE_AT, () => {
    api.spawn({ x: cloudX, y: cloudY, shape: 'dot', size: 14, endSize: 170, maxLife: 0.55, color: '#eff6ff', glow: 2, fadeOut: 0.9 });
    [0, 150].forEach((delay, i) => {
      api.at(DONE_AT + delay, () => {
        api.spawn({
          x: cloudX, y: cloudY, shape: 'ring', size: 20, endSize: 200 + i * 90,
          maxLife: 0.9, color: i === 0 ? '#60a5fa' : '#fbbf24', opacity: 0.85, fadeOut: 0.7,
        });
      });
    });
    api.burst({
      x: cloudX, y: cloudY, count: 90, speed: [90, 320],
      angle: [Math.PI * 0.12, Math.PI * 0.88],
      base: { shape: 'spark', size: 2, maxLife: 1.6, glow: 1.1, ay: 160, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#fbbf24' : rng() > 0.4 ? '#fde68a' : '#93c5fd';
        p.maxLife = 1 + rng() * 0.9;
      },
    });
  });
};
</script>

<template>
  <div class="sky-uplink-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.skyUplink" :scene="scene" />
    <div class="uplink-cloud">
      <CloudUpload :size="44" />
    </div>
    <div class="uplink-done">SYNC COMPLETE</div>
  </div>
</template>

<style scoped>
.sky-uplink-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.uplink-cloud {
  position: absolute;
  left: 50%;
  top: 22%;
  color: #bfdbfe;
  filter: drop-shadow(0 0 18px rgba(96, 165, 250, 0.7));
  transform: translate(-50%, -50%);
  animation: uplink-cloud 5.2s ease both;
}

.uplink-done {
  position: absolute;
  left: 50%;
  top: 40%;
  color: #eff6ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.3em;
  text-shadow: 0 0 20px rgba(96, 165, 250, 0.8);
  transform: translateX(-50%);
  animation: uplink-done 5.2s ease both;
}

@keyframes uplink-cloud {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  10%, 74% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  77% { transform: translate(-50%, -50%) scale(1.24); }
  82%, 92% { transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
}

@keyframes uplink-done {
  0%, 76% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.9); }
  82%, 94% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  100% { opacity: 0.9; }
}
</style>
