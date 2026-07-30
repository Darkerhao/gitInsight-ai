<script setup lang="ts">
import { Boxes } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

// 节拍表（总 5600ms = entry 600 + loop 4150 + exit 850）
// 与 DOM 关键帧对齐：0-1.5s 成型 → 1.6s 起分层剥离 → 3.8s 回吸 → 4.3s 合体
const EXPLODE_AT = 1600;
const PULL_AT = 3800;
const MERGE_AT = 4300;

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height / 2;
  // 拆解后三层部件的悬浮位（与 DOM 关键帧一致：上 / 中 / 下）
  const partAnchors = [
    { x: cx, y: cy - 128 },
    { x: cx, y: cy },
    { x: cx, y: cy + 128 },
  ];

  // 远景蓝图尘：极暗青点铺底（纵深）
  for (let i = 0; i < 30; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot',
      size: api.range(0.6, 1.4),
      maxLife: 5.4,
      color: api.rng() > 0.75 ? '#a78bfa' : '#7dd3fc',
      glow: 0.7,
      opacity: api.range(0.14, 0.36),
      twinkle: api.range(0.5, 1.5),
      fadeIn: 0.08,
      fadeOut: 0.14,
    });
  }

  // ── 幕一：通电成型 —— 能量收束 + 检修弧线 + 校准刻度 ──
  api.every(26, () => {
    const angle = api.range(0, Math.PI * 2);
    const r = api.range(140, 280);
    api.spawn({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: -Math.cos(angle) * r * 2.4,
      vy: -Math.sin(angle) * r * 2.4,
      shape: 'streak',
      stretch: 0.06,
      size: 1.5,
      maxLife: 0.4,
      color: api.rng() < 0.75 ? '#bae6fd' : '#c4b5fd',
      glow: 1,
      fadeIn: 0.12,
      fadeOut: 0.25,
    });
  }, { until: 480 });
  api.at(520, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 150, maxLife: 0.6, color: '#7dd3fc', opacity: 0.7, fadeOut: 0.65 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 26, endSize: 6, maxLife: 0.4, color: '#f0f9ff', glow: 2, fadeOut: 0.8 });
  });

  // 检修弧线 + 12 格校准刻度盘（onFrame，剥离前收走）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > EXPLODE_AT) return;
    const ramp = Math.min(1, tMs / 420) * Math.min(1, Math.max(0, (EXPLODE_AT - tMs) / 240));
    if (ramp <= 0.01) return;
    const spin = (tMs / 1000) * 2.2;
    ctx.lineWidth = 2;
    for (let s = 0; s < 2; s += 1) {
      const a = spin + s * Math.PI;
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.55 * ramp})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 96, a, a + 1.05);
      ctx.stroke();
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.3 * ramp})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 112, -a * 0.7, -a * 0.7 + 0.6);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.32 * ramp})`;
    ctx.lineWidth = 1;
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2 + spin * 0.15;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 124, cy + Math.sin(a) * 124);
      ctx.lineTo(cx + Math.cos(a) * 130, cy + Math.sin(a) * 130);
      ctx.stroke();
    }
  });
  api.every(150, () => {
    api.spawn({
      x: cx + api.range(-70, 70), y: cy + api.range(-70, 70),
      shape: 'spark', size: api.range(1.3, 2.3), maxLife: 0.5,
      color: '#bae6fd', glow: 1.2, fadeOut: 0.5,
    });
  }, { until: EXPLODE_AT });

  // ── 幕二：分层剥离 —— 碎屑迸出 + 标注线 + 部件编号（逐一浮现）──
  partAnchors.forEach((anchor, i) => {
    api.at(EXPLODE_AT + i * 180, () => {
      api.spawn({ x: cx, y: cy, shape: 'ring', size: 24, endSize: 120, maxLife: 0.55, color: '#7dd3fc', opacity: 0.6, fadeOut: 0.6 });
      // 深浅两层碎屑：暗色 rect 走 source-over（近景遮挡感），亮火花走 lighter
      api.burst({
        x: cx, y: cy, count: 16, speed: [60, 230],
        base: { shape: 'rect', size: 5, maxLife: 1.1, color: '#7dd3fc', glow: 0, composite: 'source-over', opacity: 0.75, spin: 3, flutter: 1, drag: 0.4, ay: 46, fadeOut: 0.4 },
        vary: (p, rng) => {
          p.size = 3 + rng() * 6;
          p.spin = (rng() - 0.5) * 7;
          if (rng() < 0.3) p.color = '#a78bfa';
        },
      });
      api.burst({
        x: cx, y: cy, count: 10, speed: [120, 320],
        base: { shape: 'spark', size: 1.6, maxLife: 0.55, color: '#e0f2fe', glow: 1.2, drag: 0.35, fadeOut: 0.5 },
      });
      // 编号主标签 + 延迟浮现的确认副标签（等宽微文案）
      api.spawn({
        x: anchor.x + 152, y: anchor.y - 7, shape: 'glyph', glyph: `PRT-0${i + 1}`,
        size: 12, maxLife: (PULL_AT - EXPLODE_AT - i * 180) / 1000, color: '#e0f2fe',
        font: '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.14, fadeOut: 0.2,
      });
      api.at(EXPLODE_AT + i * 180 + 340, () => {
        api.spawn({
          x: anchor.x + 152, y: anchor.y + 8, shape: 'glyph', glyph: 'LOCK OK',
          size: 9, maxLife: (PULL_AT - EXPLODE_AT - i * 180 - 340) / 1000, color: 'rgba(167, 139, 250, 0.9)',
          font: '600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fadeIn: 0.18, fadeOut: 0.22,
        });
      });
    });
  });

  // 标注引线：肘形折线 + 端点节点（onFrame）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < EXPLODE_AT + 240 || tMs > PULL_AT + 160) return;
    const fade = Math.min(1, (tMs - EXPLODE_AT - 240) / 300) * Math.max(0, Math.min(1, (PULL_AT + 160 - tMs) / 240));
    if (fade <= 0.01) return;
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.5 * fade})`;
    ctx.lineWidth = 1;
    partAnchors.forEach((anchor, i) => {
      const grow = Math.min(1, Math.max(0, (tMs - EXPLODE_AT - i * 180 - 240) / 260));
      if (grow <= 0) return;
      ctx.beginPath();
      ctx.moveTo(anchor.x + 66, anchor.y);
      ctx.lineTo(anchor.x + 66 + 40 * grow, anchor.y);
      if (grow >= 1) {
        ctx.lineTo(anchor.x + 118, anchor.y);
        ctx.moveTo(anchor.x + 118, anchor.y - 5);
        ctx.lineTo(anchor.x + 118, anchor.y + 5);
      }
      ctx.stroke();
      if (grow >= 1) {
        ctx.fillStyle = `rgba(224, 242, 254, ${0.8 * fade})`;
        ctx.beginPath();
        ctx.arc(anchor.x + 66, anchor.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });

  // 悬浮期：检视扫描线（横向细光带在拆解体上往复）+ 部件缘微尘
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 2100 || tMs > PULL_AT) return;
    const env = Math.min(1, (tMs - 2100) / 300) * Math.min(1, Math.max(0, (PULL_AT - tMs) / 260));
    const y = cy + Math.sin((tMs / 1000) * 1.7) * 170;
    const grad = ctx.createLinearGradient(cx - 170, 0, cx + 170, 0);
    grad.addColorStop(0, 'rgba(125, 211, 252, 0)');
    grad.addColorStop(0.5, `rgba(224, 242, 254, ${0.22 * env})`);
    grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 170, y - 1, 340, 2);
  });
  api.every(130, () => {
    const anchor = api.pick(partAnchors);
    api.spawn({
      x: anchor.x + api.range(-66, 66), y: anchor.y + api.range(-40, 44),
      vy: -api.range(8, 26), shape: 'dot', size: api.range(0.8, 1.6),
      maxLife: api.range(0.6, 1.1), color: api.rng() < 0.7 ? '#bae6fd' : '#c4b5fd',
      glow: 0.9, wander: 20, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: EXPLODE_AT + 500, until: PULL_AT });

  // ── 幕三：回吸合体 —— 吸入流 → 白热闪 + 冲击环 + 纵向光柱 + 回波 ──
  api.every(15, () => {
    const angle = api.range(0, Math.PI * 2);
    const r = api.range(150, 280);
    api.spawn({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: -Math.cos(angle) * r * 3.2,
      vy: -Math.sin(angle) * r * 3.2,
      shape: 'streak',
      stretch: 0.07,
      size: 1.7,
      maxLife: 0.32,
      color: api.rng() < 0.65 ? '#bae6fd' : '#c4b5fd',
      glow: 1,
      fadeIn: 0.1,
      fadeOut: 0.2,
    });
  }, { from: PULL_AT, until: MERGE_AT - 60 });

  api.at(MERGE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 240, maxLife: 0.55, color: '#f0f9ff', glow: 2.2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 310, maxLife: 0.9, color: '#7dd3fc', opacity: 0.85, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 36, speed: [140, 420],
      angle: [-Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35],
      base: { shape: 'streak', stretch: 0.08, size: 1.9, maxLife: 0.8, color: '#e0f2fe', glow: 1.2, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() < 0.5) { p.vy = -p.vy; }
        if (rng() < 0.3) p.color = '#a78bfa';
      },
    });
  });
  api.at(MERGE_AT + 320, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 60, endSize: 220, maxLife: 0.7, color: '#a78bfa', opacity: 0.32, fadeOut: 0.6 });
  });
  // 纵向光柱（白热核心 + 青色辉光缘）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < MERGE_AT || tMs > MERGE_AT + 900) return;
    const life = (tMs - MERGE_AT) / 900;
    const alpha = Math.sin(life * Math.PI);
    const grad = ctx.createLinearGradient(cx - 34, 0, cx + 34, 0);
    grad.addColorStop(0, 'rgba(125, 211, 252, 0)');
    grad.addColorStop(0.5, `rgba(125, 211, 252, ${0.5 * alpha})`);
    grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 34, 0, 68, api.height);
    const core = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
    core.addColorStop(0, 'rgba(240, 249, 255, 0)');
    core.addColorStop(0.5, `rgba(255, 255, 255, ${0.75 * alpha})`);
    core.addColorStop(1, 'rgba(240, 249, 255, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(cx - 7, 0, 14, api.height);
  });

  // 余韵：合体后残尘明灭
  api.every(80, () => {
    api.spawn({
      x: cx + api.range(-120, 120), y: cy + api.range(-140, 140),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.5, 0.9),
      color: api.rng() < 0.7 ? '#bae6fd' : '#c4b5fd', glow: 0.9,
      wander: 28, twinkle: 3.5, fadeOut: 0.5,
    });
  }, { from: MERGE_AT + 320, until: 5300 });
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
    <div class="holo-version">
      <small>EXPLODED VIEW · REASSEMBLY COMPLETE</small>
      <strong>UPGRADED → v2.0</strong>
    </div>
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
  bottom: 12%;
  display: grid;
  gap: 5px;
  place-items: center;
  color: #e0f2fe;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-shadow: 0 0 16px rgba(125, 211, 252, 0.7);
  transform: translateX(-50%);
  animation: holo-version 5.6s ease both;
}

.holo-version small {
  color: rgba(186, 230, 253, 0.68);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.holo-version strong {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.2em;
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
  0%, 78% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  86%, 96% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.9; }
}
</style>
