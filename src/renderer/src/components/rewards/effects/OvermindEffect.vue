<script setup lang="ts">
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/** 万节点三连齐明（phases: 950 / 5500 / 1150，总 7600ms） */
const FLASHES = [5450, 5680, 5910];
const LOYAL_FROM = 2450;

const scene: SceneFn = (api) => {
  api.setTrail(0.5);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // ── 全屏节点网格：逐层显影，随后逐批转红「效忠」 ──
  const SPACING = 78;
  const cols = Math.ceil(api.width / SPACING) + 1;
  const rows = Math.ceil(api.height / SPACING) + 1;
  type GridNode = { x: number; y: number; bootAt: number; loyalAt: number };
  const nodes: GridNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      nodes.push({
        x: c * SPACING + api.range(-12, 12),
        y: r * SPACING + api.range(-12, 12),
        bootAt: (r / rows) * 620 + api.range(0, 220),
        loyalAt: LOYAL_FROM + Math.floor(api.rng() * 5) * 470 + api.range(0, 260),
      });
    }
  }
  const nodeAt = (r: number, c: number) => nodes[r * cols + c];

  api.onFrame((tMs, _dt, ctx) => {
    const fade = Math.min(1, Math.max(0, (7350 - tMs) / 850));
    if (fade <= 0.01) return;
    // 三连齐明的全域增亮
    let boost = 0;
    for (const f of FLASHES) {
      if (tMs >= f) boost = Math.max(boost, Math.max(0, 1 - (tMs - f) / 180));
    }
    // 连线（两遍成批绘制：未效忠 = 冷青，双端效忠 = 暗红）
    for (const loyalPass of [false, true]) {
      ctx.strokeStyle = loyalPass ? 'rgba(244, 63, 94, 0.85)' : 'rgba(103, 232, 249, 0.8)';
      ctx.globalAlpha = (loyalPass ? 0.085 + boost * 0.12 : 0.055) * fade;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const n = nodeAt(r, c);
          if (tMs < n.bootAt) continue;
          for (const nb of [c + 1 < cols ? nodeAt(r, c + 1) : null, r + 1 < rows ? nodeAt(r + 1, c) : null]) {
            if (!nb || tMs < nb.bootAt) continue;
            const bothLoyal = tMs >= n.loyalAt && tMs >= nb.loyalAt;
            if (bothLoyal !== loyalPass) continue;
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(nb.x, nb.y);
          }
        }
      }
      ctx.stroke();
    }
    // 节点
    for (const n of nodes) {
      if (tMs < n.bootAt) continue;
      const bootK = Math.min(1, (tMs - n.bootAt) / 240);
      const loyal = tMs >= n.loyalAt;
      const flipAge = tMs - n.loyalAt;
      let alpha = loyal ? 0.5 : 0.3;
      let size = loyal ? 1.9 : 1.5;
      if (loyal && flipAge < 260) {
        // 倒戈瞬间：红闪一记
        const k = 1 - flipAge / 260;
        alpha = 0.5 + k * 0.5;
        size = 1.9 + k * 2.6;
      }
      alpha = (alpha + boost * 0.5) * bootK * fade;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = loyal ? (boost > 0.1 ? '#fda4af' : '#fb7185') : '#67e8f9';
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + boost * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // ── 幕一：光脉冲沿边汇向屏心 ──
  api.every(30, () => {
    const edge = Math.floor(api.rng() * 4);
    let x = api.rng() * api.width;
    let y = api.rng() * api.height;
    if (edge === 0) y = 0;
    else if (edge === 1) y = api.height;
    else if (edge === 2) x = 0;
    else x = api.width;
    const dx = cx - x;
    const dy = cy - y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = api.range(520, 760);
    api.spawn({
      x, y, vx: (dx / d) * sp, vy: (dy / d) * sp,
      shape: 'streak', stretch: 0.09, size: 1.8, maxLife: d / sp,
      color: '#67e8f9', glow: 1, opacity: 0.8, fadeIn: 0.08, fadeOut: 0.25,
    });
  }, { until: 1600 });

  // ── 幕二：效忠脉冲 —— 转红节点向中枢供奉红色数据流 ──
  api.every(120, () => {
    const n = api.pick(nodes);
    const dx = cx - n.x;
    const dy = cy - n.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = api.range(300, 460);
    api.spawn({
      x: n.x, y: n.y, vx: (dx / d) * sp, vy: (dy / d) * sp,
      shape: 'streak', stretch: 0.07, size: 1.5, maxLife: d / sp,
      color: '#fb7185', glow: 0.9, opacity: 0.55, fadeIn: 0.1, fadeOut: 0.3,
    });
  }, { from: LOYAL_FROM + 150, until: 5300 });

  // 中枢升起时的承托微尘（自下而上的暗红上升流）
  api.every(70, () => {
    api.spawn({
      x: cx + api.range(-70, 70), y: api.height + 10,
      vx: api.range(-8, 8), vy: -api.range(90, 190),
      shape: 'dot', size: api.range(0.8, 1.8), maxLife: api.range(1, 1.9),
      color: api.rng() > 0.7 ? '#fda4af' : '#9f1239', glow: 0.8,
      opacity: api.range(0.3, 0.6), drag: 0.9, wander: 20, fadeOut: 0.4,
    });
  }, { from: 950, until: 2400 });

  // 主宰之瞳睁开：一圈红环波扫出
  api.at(3350, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 40, endSize: Math.min(api.width, api.height) * 0.6, maxLife: 0.9, color: '#f43f5e', opacity: 0.6, fadeOut: 0.7 });
  });

  // ── 幕三：ALL PROTOCOLS SERVE —— 三连齐明，每记一道红色环波 ──
  FLASHES.forEach((t, i) => {
    api.at(t, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 30,
        endSize: Math.max(api.width, api.height) * (0.42 + i * 0.16),
        maxLife: 0.8, color: i === 1 ? '#fda4af' : '#f43f5e', opacity: 0.55, fadeOut: 0.7,
      });
      api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 120 + i * 30, maxLife: 0.32, color: '#fecdd3', glow: 1.6, fadeOut: 0.85 });
    });
  });

  // 退场：闭目沉入黑暗，只余中枢一点残红心跳
  api.at(6620, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 5, endSize: 1.4, maxLife: 0.9, color: '#fb7185', glow: 1.4, fadeIn: 0.1, fadeOut: 0.5 });
  });
};
</script>

<template>
  <div class="overmind-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.overmind" :scene="scene" />
    <div class="om-core">
      <span class="om-ring r1" />
      <span class="om-ring r2" />
      <span class="om-ring r3" />
      <div class="om-eye">
        <span class="om-iris" />
        <span class="om-lid is-top" />
        <span class="om-lid is-bottom" />
      </div>
    </div>
    <div class="om-caption">
      <strong>ALL PROTOCOLS SERVE</strong>
      <small>主宰降临 · 全域节点效忠</small>
    </div>
    <div class="om-veil" />
  </div>
</template>

<style scoped lang="scss">
.overmind-effect {
  @include effect-stage(hidden);
}

.om-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: radial-gradient(circle, #030106 0 46%, rgba(76, 5, 25, 0.55) 66%, transparent 76%);
  box-shadow: 0 0 46px rgba(244, 63, 94, 0.34), inset 0 0 24px rgba(0, 0, 0, 0.9);
  animation: om-core 7.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.om-ring {
  position: absolute;
  border: 1px dashed rgba(244, 63, 94, 0.5);
  border-radius: 50%;
  filter: drop-shadow(0 0 8px rgba(244, 63, 94, 0.35));
}

.om-ring.r1 { inset: -24px; animation: om-r1 7.6s linear both; }
.om-ring.r2 { inset: -48px; border-style: solid; border-color: rgba(244, 63, 94, 0.22); animation: om-r2 7.6s linear both; }
.om-ring.r3 { inset: -74px; animation: om-r3 7.6s linear both; }

.om-eye {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 118px;
  height: 44px;
  overflow: hidden;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, rgba(136, 19, 55, 0.6), rgba(3, 1, 6, 0.9) 72%);
  transform: translate(-50%, -50%);
}

.om-iris {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border-radius: 50%;
  background: radial-gradient(circle, #fecdd3 0 12%, #f43f5e 34%, #881337 68%, transparent 76%);
  box-shadow: 0 0 22px rgba(244, 63, 94, 0.9);
  animation: om-iris 7.6s ease-in-out both;
}

.om-lid {
  position: absolute;
  left: -4%;
  width: 108%;
  height: 52%;
  background: #010208;
  animation-duration: 7.6s;
  animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  animation-fill-mode: both;
}

.om-lid.is-top { top: -1%; transform-origin: top; animation-name: om-lid-top; }
.om-lid.is-bottom { bottom: -1%; transform-origin: bottom; animation-name: om-lid-bottom; }

.om-caption {
  position: absolute;
  left: 50%;
  bottom: 11%;
  display: grid;
  gap: 6px;
  place-items: center;
  transform: translateX(-50%);
  animation: om-caption 7.6s ease both;
}

.om-caption strong {
  color: #fb7185;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 15px;
  letter-spacing: 0.34em;
  text-shadow: 0 0 16px rgba(244, 63, 94, 0.7);
}

.om-caption small {
  color: rgba(253, 164, 175, 0.6);
  font-size: 11px;
  letter-spacing: 0.3em;
}

.om-veil {
  position: absolute;
  inset: 0;
  background: #010104;
  opacity: 0;
  animation: om-veil 7.6s ease-in both;
  pointer-events: none;
}

@keyframes om-core {
  0%, 11% { opacity: 0; transform: translate(-50%, calc(-50% + 44vh)) scale(0.55); }
  27%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, calc(-50% + 18vh)) scale(0.72); }
}

@keyframes om-r1 {
  0%, 15% { opacity: 0; transform: rotate(0deg) scale(0.3); }
  22%, 86% { opacity: 1; }
  50% { transform: rotate(150deg) scale(1); }
  100% { opacity: 0; transform: rotate(300deg) scale(0.8); }
}

@keyframes om-r2 {
  0%, 18% { opacity: 0; transform: rotate(0deg) scale(0.3); }
  25%, 86% { opacity: 1; }
  50% { transform: rotate(-125deg) scale(1); }
  100% { opacity: 0; transform: rotate(-250deg) scale(0.8); }
}

@keyframes om-r3 {
  0%, 21% { opacity: 0; transform: rotate(0deg) scale(0.3); }
  28%, 86% { opacity: 1; }
  50% { transform: rotate(95deg) scale(1); }
  100% { opacity: 0; transform: rotate(190deg) scale(0.8); }
}

@keyframes om-iris {
  0%, 44% { transform: translateX(0) scale(0.9); }
  52% { transform: translateX(-30px) scale(1); }
  62% { transform: translateX(30px) scale(1); }
  68% { transform: translateX(-14px) scale(1); }
  71% { transform: translateX(0) scale(1); filter: brightness(1); }
  72.5% { filter: brightness(1.7); }
  74% { filter: brightness(1); }
  75.5% { filter: brightness(1.7); }
  77% { filter: brightness(1); }
  78.5% { filter: brightness(1.8); transform: translateX(0) scale(1.18); }
  84% { filter: brightness(1); transform: translateX(0) scale(1); }
  100% { transform: translateX(0) scale(0.7); }
}

@keyframes om-lid-top {
  0%, 42% { transform: scaleY(1); }
  46%, 83% { transform: scaleY(0.06); }
  87%, 100% { transform: scaleY(1); }
}

@keyframes om-lid-bottom {
  0%, 42% { transform: scaleY(1); }
  46%, 83% { transform: scaleY(0.06); }
  87%, 100% { transform: scaleY(1); }
}

@keyframes om-caption {
  0%, 69.5% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  71.5% { opacity: 1; transform: translateX(-50%) translateY(0); }
  73% { opacity: 0.45; }
  74.5% { opacity: 1; }
  76% { opacity: 0.5; }
  77.5%, 86% { opacity: 1; }
  93%, 100% { opacity: 0; transform: translateX(-50%) translateY(0); }
}

@keyframes om-veil {
  0%, 85% { opacity: 0; }
  97%, 100% { opacity: 0.92; }
}
</style>
