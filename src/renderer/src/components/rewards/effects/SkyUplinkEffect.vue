<script setup lang="ts">
import { CloudUpload } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 云端上行 SKY UPLINK · 5.2s
 * 幕一 0-1100ms   底部 0/1 数据池翻涌沸腾，池面辉光起伏，云核通电
 * 幕二 1100-4050  垂直数据束携字符上行冲击云核；分段进度弧 HUD 逐格充能，命中处涟漪应答；2500ms 突发大包
 * 幕三 4050ms     100% —— 白闪 + 靛/金确认双环 + 金色光雨回洒，余尘飘落
 * 配色：白热核心 + 蓝主色（#93c5fd）辉光 + 靛辅色（#818cf8）点缀，终章金色仅用于确认仪式
 */
const UPLOAD_FROM = 1100;
const DONE_AT = 4050;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cloudX = api.width / 2;
  const cloudY = api.height * 0.22;

  // ── 幕一：底部数据池 —— 0/1 字符翻涌 + 池面辉光 ──
  api.every(28, () => {
    const bright = api.rng() > 0.6;
    api.spawn({
      x: api.rng() * api.width,
      y: api.height - api.rng() * 70,
      vy: api.range(-30, -8),
      shape: 'glyph', glyph: api.rng() > 0.5 ? '1' : '0',
      size: api.range(10, 16), maxLife: api.range(0.8, 1.6),
      color: bright ? '#93c5fd' : api.rng() > 0.5 ? 'rgba(129, 140, 248, 0.6)' : 'rgba(96, 165, 250, 0.5)',
      wander: 30, fadeIn: 0.14, fadeOut: 0.3,
    });
  }, { until: DONE_AT });
  // 池面辉光带：呼吸起伏的水平光晕（onFrame 自定义绘制）
  api.onFrame((tMs, _dt, ctx) => {
    const fade = Math.min(1, tMs / 600) * Math.max(0, Math.min(1, (DONE_AT + 400 - tMs) / 500));
    if (fade <= 0.02) return;
    const yBase = api.height - 44;
    const grad = ctx.createLinearGradient(0, yBase - 40, 0, api.height);
    grad.addColorStop(0, 'rgba(96, 165, 250, 0)');
    grad.addColorStop(1, `rgba(96, 165, 250, ${(0.16 + Math.sin(tMs / 320) * 0.05) * fade})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, yBase - 40, api.width, api.height - yBase + 40);
  });
  // 池面偶发溅花（次级系统）
  api.every(300, () => {
    api.burst({
      x: api.range(api.width * 0.14, api.width * 0.86),
      y: api.height - api.range(30, 60),
      count: 4, speed: [30, 110], angle: [-Math.PI * 0.8, -Math.PI * 0.2],
      base: { shape: 'spark', size: 1.3, maxLife: 0.5, color: '#bfdbfe', glow: 1, drag: 0.4, fadeOut: 0.5 },
    });
  }, { from: 300, until: DONE_AT - 400 });

  // ── 幕二：垂直数据束上行（seed 决定束流位置）──
  const columns = Array.from({ length: 5 }, () => api.width * (0.2 + api.rng() * 0.6));
  api.every(38, () => {
    const colX = api.pick(columns) + api.range(-8, 8);
    const dy = cloudY + 22 - (api.height - 40);
    const speed = api.range(420, 640);
    const dirX = ((cloudX - colX) / Math.abs(dy)) * 0.34;
    api.spawn({
      x: colX, y: api.height - 40,
      vx: dirX * speed, vy: -speed,
      shape: 'streak', stretch: 0.09, size: api.range(1.6, 2.8),
      maxLife: Math.abs(dy) / speed,
      color: api.pick(['#60a5fa', '#93c5fd', '#818cf8', '#38bdf8']),
      glow: 1.05, fadeIn: 0.06, fadeOut: 0.12,
      update: (p, dt) => {
        p.vx += (cloudX - p.x) * 2.4 * dt;
      },
    });
    if (api.rng() > 0.6) {
      api.spawn({
        x: colX, y: api.height - 36,
        vy: -speed * 0.82, vx: dirX * speed * 0.8,
        shape: 'glyph', glyph: api.rng() > 0.5 ? '1' : '0', size: 11,
        maxLife: Math.abs(dy) / (speed * 0.82),
        color: api.rng() > 0.5 ? '#bfdbfe' : '#c7d2fe',
        fadeIn: 0.08, fadeOut: 0.14,
      });
    }
  }, { from: UPLOAD_FROM, until: DONE_AT - 120 });

  // 命中应答：云核底缘微脉冲 + 涟漪小环（回波）
  api.every(340, (i) => {
    api.spawn({
      x: cloudX + api.range(-24, 24), y: cloudY + 26,
      shape: 'spark', size: api.range(2, 3.4), maxLife: 0.4,
      color: '#dbeafe', glow: 1.5, fadeOut: 0.6,
    });
    if (i % 2 === 0) {
      api.spawn({
        x: cloudX, y: cloudY + 18, shape: 'ring', size: 10, endSize: 54,
        maxLife: 0.55, color: '#818cf8', opacity: 0.44, fadeOut: 0.6,
      });
    }
  }, { from: UPLOAD_FROM + 360, until: DONE_AT });

  // 2500ms 突发大包：一束白热粗流 + 云核闪应（中段节拍）
  api.at(2500, () => {
    const colX = columns[2];
    api.spawn({
      x: colX, y: api.height - 40,
      vx: ((cloudX - colX) / (api.height - 40 - cloudY)) * 560, vy: -560,
      shape: 'streak', stretch: 0.12, size: 4.4,
      maxLife: (api.height - 40 - cloudY) / 560,
      color: '#eff6ff', glow: 1.6, fadeIn: 0.05, fadeOut: 0.1,
      update: (p, dt) => {
        p.vx += (cloudX - p.x) * 3 * dt;
      },
    });
  });
  api.at(2820, () => {
    api.spawn({ x: cloudX, y: cloudY, shape: 'dot', size: 10, endSize: 70, maxLife: 0.4, color: '#dbeafe', glow: 1.8, fadeOut: 0.8 });
  });

  // ── 云核分段进度弧 HUD（48 段刻度逐格充能）──
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < UPLOAD_FROM - 300) return;
    const fade = Math.min(1, (tMs - UPLOAD_FROM + 300) / 400) * Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 500));
    if (fade <= 0.02) return;
    const progress = Math.min(1, Math.max(0, (tMs - UPLOAD_FROM) / (DONE_AT - UPLOAD_FROM)));
    const r = 56;
    const segments = 48;
    const lit = Math.floor(progress * segments);
    for (let s = 0; s < segments; s += 1) {
      const a0 = -Math.PI / 2 + (s / segments) * Math.PI * 2 + 0.012;
      const a1 = -Math.PI / 2 + ((s + 1) / segments) * Math.PI * 2 - 0.012;
      const on = s < lit;
      ctx.strokeStyle = on
        ? `rgba(191, 219, 254, ${0.92 * fade})`
        : `rgba(96, 165, 250, ${0.2 * fade})`;
      ctx.lineWidth = on ? 4 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, r, a0, a1);
      ctx.stroke();
    }
    // 等宽 HUD 微文案：百分比 + 状态词
    ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = `rgba(219, 234, 254, ${0.92 * fade})`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(progress * 100)}%`, cloudX, cloudY + r + 24);
    ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = `rgba(147, 197, 253, ${0.6 * fade})`;
    ctx.fillText(progress >= 1 ? 'LINK CONFIRMED' : 'UPLINK ACTIVE', cloudX, cloudY + r + 40);
  });

  // ── 幕三：100% —— 确认仪式与金色光雨 ──
  api.at(DONE_AT, () => {
    api.spawn({ x: cloudX, y: cloudY, shape: 'dot', size: 14, endSize: 180, maxLife: 0.55, color: '#eff6ff', glow: 2, fadeOut: 0.9 });
    [0, 150].forEach((delay, i) => {
      api.at(DONE_AT + delay, () => {
        api.spawn({
          x: cloudX, y: cloudY, shape: 'ring', size: 20, endSize: 210 + i * 90,
          maxLife: 0.9, color: i === 0 ? '#818cf8' : '#fbbf24',
          opacity: 0.85, fadeOut: 0.7,
        });
      });
    });
    api.burst({
      x: cloudX, y: cloudY, count: 96, speed: [90, 330],
      angle: [Math.PI * 0.12, Math.PI * 0.88],
      base: { shape: 'spark', size: 2, maxLife: 1.6, glow: 1.1, ay: 160, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#fbbf24' : rng() > 0.4 ? '#fde68a' : '#93c5fd';
        p.maxLife = 1 + rng() * 0.9;
        if (rng() > 0.8) p.twinkle = 4 + rng() * 4;
      },
    });
  });
  // 金尘余韵：光雨过后缓落的碎金
  api.every(70, () => {
    api.spawn({
      x: api.range(api.width * 0.2, api.width * 0.8),
      y: cloudY + api.range(0, 120),
      vy: api.range(40, 110), vx: api.range(-24, 24),
      shape: 'dot', size: api.range(0.8, 1.7), maxLife: api.range(0.6, 1),
      color: api.pick(['#fde68a', '#fbbf24', '#bfdbfe']),
      glow: 0.9, twinkle: 4, wander: 30, fadeOut: 0.5,
    });
  }, { from: DONE_AT + 300, until: DONE_AT + 750 });
};
</script>

<template>
  <div class="sky-uplink-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.skyUplink" :scene="scene" />
    <div class="uplink-cloud">
      <CloudUpload :size="42" />
      <small>SKY UPLINK · NODE 07</small>
    </div>
    <div class="uplink-done">
      <strong>云端上行</strong>
      <small>SYNC COMPLETE</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sky-uplink-effect {
  @include effect-stage(hidden);
}

.uplink-cloud {
  position: absolute;
  left: 50%;
  top: 22%;
  color: #bfdbfe;
  display: grid;
  gap: 5px;
  place-items: center;
  filter: drop-shadow(0 0 18px rgba(96, 165, 250, 0.7));
  transform: translate(-50%, -58%);
  animation: uplink-cloud 5.2s ease both;
}

.uplink-cloud small {
  color: rgba(191, 219, 254, 0.6);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.2em;
}

.uplink-done {
  position: absolute;
  left: 50%;
  top: 42%;
  display: grid;
  gap: 7px;
  place-items: center;
  color: #eff6ff;
  text-shadow: 0 0 20px rgba(96, 165, 250, 0.8);
  transform: translateX(-50%);
  animation: uplink-done 5.2s ease both;
}

.uplink-done strong {
  font-size: 17px;
  letter-spacing: 0.16em;
}

.uplink-done small {
  color: rgba(191, 219, 254, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3em;
}

@keyframes uplink-cloud {
  0% { opacity: 0; transform: translate(-50%, -58%) scale(0.5); }
  10%, 74% { opacity: 1; transform: translate(-50%, -58%) scale(1); }
  79% { transform: translate(-50%, -58%) scale(1.22); }
  84%, 92% { transform: translate(-50%, -58%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -58%) scale(0.86); }
}

@keyframes uplink-done {
  0%, 78% { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.9); }
  84%, 95% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  100% { opacity: 0.9; }
}
</style>
