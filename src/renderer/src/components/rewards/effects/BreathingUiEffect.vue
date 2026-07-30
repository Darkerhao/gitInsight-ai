<script setup lang="ts">
import { Activity } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const BREATH_SECONDS = 3.2; // 与 CSS 卡片呼吸节奏一致；顶点在 1.6s / 4.8s，谷底在 3.2s

const scene: SceneFn = (api) => {
  api.setTrail(0.5);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const duration = api.duration / 1000; // 5.6s
  const breathAt = (t: number) => 0.5 + 0.5 * Math.sin((t / BREATH_SECONDS) * Math.PI * 2 - Math.PI / 2);

  // 呼吸光晕：白热内核 + 主色辉光 + 辅色外缘，随呼吸胀缩
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (duration - t) / 1.1));
    if (envelope <= 0) return;
    const breath = breathAt(t);
    const radius = 190 + breath * 96;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    core.addColorStop(0, `rgba(240, 253, 244, ${(0.05 + breath * 0.06) * envelope})`);
    core.addColorStop(0.32, `rgba(74, 222, 128, ${(0.08 + breath * 0.12) * envelope})`);
    core.addColorStop(0.8, `rgba(56, 189, 248, ${(0.02 + breath * 0.035) * envelope})`);
    core.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // 呼吸标度环：细刻度轨道 + 随吸气填充的进度弧
    const gaugeR = Math.min(api.width, api.height) * 0.36;
    ctx.strokeStyle = `rgba(134, 239, 172, ${0.1 * envelope})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, gaugeR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(74, 222, 128, ${0.34 * envelope})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, gaugeR, -Math.PI / 2, -Math.PI / 2 + breath * Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const a = -Math.PI / 2 + (i / 4) * Math.PI * 2;
      ctx.fillStyle = `rgba(186, 230, 253, ${0.3 * envelope})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * gaugeR, cy + Math.sin(a) * gaugeR, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 底部脉息走线：静息基线上一枚冲激波随呼吸速度巡行
    const traceY = api.height * 0.82;
    const pulseX = ((t * 0.24) % 1.15) * api.width;
    ctx.strokeStyle = `rgba(74, 222, 128, ${0.2 * envelope})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= api.width; x += 12) {
      const d = Math.abs(x - pulseX);
      const spike = d < 42 ? Math.sin((1 - d / 42) * Math.PI) * (10 + breath * 16) : 0;
      const yy = traceY - spike + Math.sin(x * 0.02 + t * 1.4) * 1.6;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  });

  // 萤火虫双层：近层大而亮、远层小而暗，吸气聚拢、呼气散开
  api.every(80, () => {
    const near = api.rng() < 0.55;
    const angle = api.range(0, Math.PI * 2);
    const baseRadius = api.range(140, Math.min(api.width, api.height) * 0.44);
    api.spawn({
      x: cx + Math.cos(angle) * baseRadius,
      y: cy + Math.sin(angle) * baseRadius,
      shape: 'dot',
      size: near ? api.range(1.8, 3) : api.range(0.9, 1.6),
      maxLife: api.range(2.4, 4),
      color: near ? (api.rng() < 0.7 ? '#86efac' : '#bbf7d0') : '#67e8f9',
      opacity: near ? 1 : 0.5,
      twinkle: api.range(1, 3),
      glow: near ? 1.1 : 0.8,
      fadeIn: 0.16,
      fadeOut: 0.2,
      update: (p, dt) => {
        const t = p.life + p.phase;
        const breathVelocity = Math.cos((t / BREATH_SECONDS) * Math.PI * 2) * (near ? 27 : 16);
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        p.x += (dx / dist) * breathVelocity * dt * 3;
        p.y += (dy / dist) * breathVelocity * dt * 3;
        p.x += Math.sin(t * 1.3) * 8 * dt;
        p.y += Math.cos(t * 1.1) * 8 * dt;
      },
    });
  }, { until: api.duration - 1200 });

  // 吸气顶点 1.6s：柔涟漪 + 200ms 后回波环
  api.at(1600, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 130, endSize: 370, maxLife: 1.7,
      color: '#86efac', opacity: 0.5, fadeIn: 0.14, fadeOut: 0.6,
    });
  });
  api.at(1820, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 150, endSize: 420, maxLife: 1.4,
      color: '#38bdf8', opacity: 0.22, fadeIn: 0.2, fadeOut: 0.7,
    });
  });

  // 呼气谷底 3.2s：萤光柔和外散一拍
  api.at(3240, () => {
    api.burst({
      x: cx, y: cy, count: 16, speed: [30, 90],
      base: {
        shape: 'dot', size: 1.8, maxLife: 1.4, color: '#bbf7d0',
        glow: 1, drag: 0.5, wander: 22, twinkle: 2, fadeIn: 0.1, fadeOut: 0.5,
      },
    });
  });

  // 最后一次深呼气 4.6s：光环向内收拢，界面沉入静息
  api.at(4620, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 320, endSize: 60, maxLife: 0.9,
      color: '#4ade80', opacity: 0.3, fadeIn: 0.1, fadeOut: 0.6,
    });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 26, endSize: 4, maxLife: 0.8, color: '#dcfce7', glow: 1.4, opacity: 0.5, fadeOut: 0.7 });
  });
};
</script>

<template>
  <div class="breathing-ui-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.breathingUi" :scene="scene" />
    <div class="breathing-shell">
      <div class="breathing-header">
        <Activity :size="36" />
        <div class="breathing-title">
          <strong>稳态脉息</strong>
          <small>STASIS PULSE · RHYTHM 3.2S</small>
        </div>
      </div>
      <div class="breathing-grid">
        <span
          v-for="card in 9"
          :key="card"
          class="breathing-card"
          :style="{ animationDelay: `${(card - 1) * 110}ms`, '--line-width': `${54 + (card % 3) * 18}%` }"
        />
      </div>
    </div>
    <span class="breathing-aura" />
  </div>
</template>

<style scoped lang="scss">
.breathing-ui-effect {
  @include effect-stage(hidden);
}

.breathing-shell {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 82vw);
  min-height: 320px;
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 0, rgba(34, 197, 94, 0.18), transparent 48%),
    rgba(2, 6, 23, 0.34);
  color: #dcfce7;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 18px;
  padding: 26px 28px;
  transform: translate(-50%, -50%);
  animation: breathing-shell 5.6s ease-in-out both;
}

.breathing-header {
  display: flex;
  align-items: center;
  gap: 14px;
  justify-content: center;
}

.breathing-header svg {
  color: #4ade80;
  filter: drop-shadow(0 0 16px rgba(74, 222, 128, 0.5));
}

.breathing-title {
  display: grid;
  gap: 3px;
}

.breathing-title strong {
  font-size: 18px;
  letter-spacing: 0.14em;
}

.breathing-title small {
  color: rgba(134, 239, 172, 0.6);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.24em;
}

.breathing-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.breathing-card {
  position: relative;
  min-height: 82px;
  border: 1px solid rgba(134, 239, 172, 0.24);
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.07);
  opacity: 0;
  transform: scale(0.92);
  animation: breathing-card 3.2s ease-in-out infinite;
}

.breathing-card::before,
.breathing-card::after {
  content: '';
  position: absolute;
  left: 14px;
  height: 5px;
  border-radius: 999px;
  background: rgba(187, 247, 208, 0.48);
}

.breathing-card::before {
  right: 14px;
  top: 22px;
}

.breathing-card::after {
  top: 40px;
  width: var(--line-width);
  background: rgba(125, 211, 252, 0.4);
}

.breathing-aura {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(560px, 86vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.22), transparent 68%);
  transform: translate(-50%, -50%);
  animation: breathing-aura 5.6s ease-in-out both;
}

@keyframes breathing-shell {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
  14%, 82% { opacity: 1; }
  29% { transform: translate(-50%, -50%) scale(1.035); }
  57% { transform: translate(-50%, -50%) scale(0.975); }
  86% { transform: translate(-50%, -50%) scale(1.02); }
}

@keyframes breathing-card {
  0%, 100% { opacity: 0.55; transform: scale(0.94); }
  50% { opacity: 1; transform: scale(1); }
}

@keyframes breathing-aura {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.72); }
  18%, 78% { opacity: 1; }
  29% { transform: translate(-50%, -50%) scale(1.08); }
  57% { transform: translate(-50%, -50%) scale(0.9); }
  86% { transform: translate(-50%, -50%) scale(1.02); }
}
</style>
