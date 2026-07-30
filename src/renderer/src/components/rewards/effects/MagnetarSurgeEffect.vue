<script setup lang="ts">
import { Magnet } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const TAU = Math.PI * 2;
/** 星震三波崩断节拍 */
const SNAP_WAVES = [2850, 3300, 3750];
/** X 射线热斑扫射窗口 */
const SWEEP_FROM = 3900;
const SWEEP_TO = 5400;
/** 磁场重联时刻 */
const RECONNECT_AT = 5450;

const scene: SceneFn = (api) => {
  api.setTrail(0.45);
  const w = api.width;
  const h = api.height;
  const cx = w / 2;
  const cy = h / 2;
  const R0 = 48;
  const maxR = Math.max(w, h);
  let now = 0;
  api.onFrame((tMs) => {
    now = tMs;
  });

  // 磁力线：两侧各 7 条，外层先崩断，最内层常存
  const lines = [] as Array<{ side: number; spread: number; seed: number; snapAt: number }>;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i += 1) {
      const spread = 52 + i * 25 + api.range(-7, 7);
      const snapAt = i >= 4
        ? SNAP_WAVES[0] + api.range(-60, 60)
        : i >= 2
          ? SNAP_WAVES[1] + api.range(-60, 60)
          : i === 1
            ? SNAP_WAVES[2] + api.range(-40, 40)
            : Infinity;
      lines.push({ side, spread, seed: api.range(0, TAU), snapAt });
    }
  }
  const p0y = cy - R0 + 8;
  const p2y = cy + R0 - 8;

  // 远景星野
  for (let i = 0; i < 56; i += 1) {
    api.spawn({
      x: api.rng() * w,
      y: api.rng() * h,
      shape: 'dot',
      size: api.range(0.7, 1.9),
      maxLife: 7.1,
      color: api.rng() > 0.7 ? '#7dd3fc' : '#e2e8f0',
      glow: 0.7,
      opacity: api.range(0.2, 0.5),
      twinkle: api.range(0.4, 1.4),
      fadeIn: 0.06,
      fadeOut: 0.1,
    });
  }

  // ── 幕一/二 · 磁力线绷紧震颤 → 崩断残迹 → 重联（onFrame 贝塞尔）──
  api.onFrame((tMs, _dt, ctx) => {
    const ramp = Math.min(1, tMs / 800);
    const globalFade = tMs > 6950 ? Math.max(0, 1 - (tMs - 6950) / 250) : 1;
    if (globalFade <= 0) return;
    // 磁赤道暗环
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.1 * ramp * globalFade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R0 * 1.7, R0 * 0.4, 0, 0, TAU);
    ctx.stroke();
    for (const ln of lines) {
      const snapped = tMs >= ln.snapAt;
      const depthAlpha = 0.34 - ((ln.spread - 52) / 175) * 0.16;
      if (!snapped) {
        // 绷紧 + 震颤（重联期归于平静）
        const tension = 1 - 0.24 * Math.min(1, Math.max(0, (tMs - 850) / 2000));
        const recon = tMs > RECONNECT_AT ? Math.min(1, (tMs - RECONNECT_AT) / 600) : 0;
        const trembleAmp = recon > 0
          ? 2 * (1 - recon)
          : Math.min(1, Math.max(0, (tMs - 600) / 2200)) * 11;
        const wob = Math.sin(tMs / 43 + ln.seed * 9) * trembleAmp;
        const cpx = cx + ln.side * ln.spread * (tension + recon * 0.24) * 2.1 + wob;
        ctx.strokeStyle = `rgba(125, 211, 252, ${depthAlpha * ramp * globalFade})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, p0y);
        ctx.quadraticCurveTo(cpx, cy + wob * 0.4, cx, p2y);
        ctx.stroke();
      } else if (tMs < ln.snapAt + 380) {
        // 崩断瞬间：两截断弧向外甩出淡去
        const k = (tMs - ln.snapAt) / 380;
        const fling = k * 130;
        ctx.strokeStyle = `rgba(244, 114, 182, ${0.5 * (1 - k) * globalFade})`;
        ctx.lineWidth = 2;
        const cpx = cx + ln.side * (ln.spread * 0.76 * 2.1 + fling);
        ctx.beginPath();
        ctx.moveTo(cx, p0y);
        ctx.quadraticCurveTo(cpx, cy - 30 - fling * 0.4, cx + ln.side * fling * 0.5, cy - 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, p2y);
        ctx.quadraticCurveTo(cpx, cy + 30 + fling * 0.4, cx + ln.side * fling * 0.5, cy + 6);
        ctx.stroke();
      } else if (tMs > RECONNECT_AT) {
        // 磁场重联：新磁力线淡入归位
        const recon = Math.min(1, (tMs - RECONNECT_AT) / 700);
        const cpx = cx + ln.side * ln.spread * 0.9 * 2.1;
        ctx.strokeStyle = `rgba(125, 211, 252, ${depthAlpha * 0.9 * recon * globalFade})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx, p0y);
        ctx.quadraticCurveTo(cpx, cy, cx, p2y);
        ctx.stroke();
      }
    }
  });

  // 幕一 · 壳层应力：星面裂纹火花
  api.every(70, () => {
    const a = api.range(0, TAU);
    api.spawn({
      x: cx + Math.cos(a) * R0 * api.range(0.86, 1),
      y: cy + Math.sin(a) * R0 * api.range(0.86, 1),
      vx: Math.cos(a) * api.range(20, 70),
      vy: Math.sin(a) * api.range(20, 70),
      shape: 'spark',
      size: api.range(1, 2.2),
      maxLife: api.range(0.3, 0.6),
      color: api.pick(['#7dd3fc', '#f8fafc', '#f472b6']),
      glow: 1.3,
      drag: 0.5,
      fadeOut: 0.5,
    });
  }, { from: 400, until: 2800 });

  // ── 幕二 · 星震崩断：等离子鞭（streak 链）+ 磁暴环外扩 ────────
  for (const ln of lines) {
    if (!Number.isFinite(ln.snapAt)) continue;
    api.at(ln.snapAt, () => {
      const apexX = cx + ln.side * ln.spread * 0.76 * 1.05;
      api.spawn({
        x: apexX, y: cy, shape: 'spark', size: 5, maxLife: 0.3,
        color: '#ffffff', glow: 2.2, fadeOut: 0.7,
      });
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: R0 + 8,
        endSize: maxR * api.range(0.5, 0.85), maxLife: 0.9,
        color: api.rng() > 0.5 ? '#7dd3fc' : '#f472b6', opacity: 0.55, fadeOut: 0.7,
      });
    });
    // 等离子鞭：沿弧线连锁甩出，中段甩得最远
    for (let k = 0; k < 14; k += 1) {
      api.at(ln.snapAt + 14 * k, () => {
        const s = k / 13;
        const cpx = cx + ln.side * ln.spread * 0.76 * 2.1;
        const qx = (1 - s) * (1 - s) * cx + 2 * (1 - s) * s * cpx + s * s * cx;
        const qy = (1 - s) * (1 - s) * p0y + 2 * (1 - s) * s * cy + s * s * p2y;
        api.spawn({
          x: qx,
          y: qy,
          vx: ln.side * api.range(320, 520) * (0.5 + Math.sin(s * Math.PI)),
          vy: (s - 0.5) * api.range(140, 320),
          shape: 'streak',
          stretch: 0.1,
          size: 2.6,
          maxLife: api.range(0.7, 1.1),
          color: api.pick(['#7dd3fc', '#f472b6', '#e0f2fe']),
          glow: 1.25,
          drag: 0.55,
          fadeOut: 0.4,
        });
      });
    }
  }
  // 首波星震：全星白闪
  api.at(SNAP_WAVES[0], () => {
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 26, endSize: 220, maxLife: 0.5,
      color: '#f0f9ff', glow: 2.2, fadeOut: 0.85,
    });
  });

  // ── 幕三 · X 射线热斑绕星扫射（3.9-5.4s）────────────────────
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < SWEEP_FROM || tMs > RECONNECT_AT) return;
    const fade = Math.min(1, (tMs - SWEEP_FROM) / 250) * Math.min(1, Math.max(0, (RECONNECT_AT - tMs) / 250));
    for (const o of [0, Math.PI]) {
      const a = tMs / 340 + o;
      const sx = cx + Math.cos(a) * (R0 + 4);
      const sy = cy + Math.sin(a) * (R0 + 4);
      const ex = cx + Math.cos(a) * maxR * 0.62;
      const ey = cy + Math.sin(a) * maxR * 0.62;
      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, `rgba(224, 242, 254, ${0.4 * fade})`);
      grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  });
  api.every(30, () => {
    for (const o of [0, Math.PI]) {
      const a = now / 340 + o;
      api.spawn({
        x: cx + Math.cos(a) * (R0 + 6),
        y: cy + Math.sin(a) * (R0 + 6),
        vx: Math.cos(a) * api.range(120, 260),
        vy: Math.sin(a) * api.range(120, 260),
        shape: 'spark',
        size: api.range(1.6, 2.8),
        maxLife: 0.55,
        color: '#e0f2fe',
        glow: 1.5,
        drag: 0.5,
        fadeOut: 0.5,
      });
    }
  }, { from: SWEEP_FROM, until: SWEEP_TO });

  // ── 幕四 · 重联极冠双辉（5.5s 起）───────────────────────────
  api.at(RECONNECT_AT + 50, () => {
    for (const vdir of [-1, 1]) {
      api.spawn({
        x: cx,
        y: cy + vdir * (R0 - 2),
        shape: 'dot',
        size: 9,
        maxLife: 1.5,
        color: vdir < 0 ? '#7dd3fc' : '#f472b6',
        glow: 2,
        fadeIn: 0.2,
        fadeOut: 0.3,
        update: (p) => {
          p.size = 9 + Math.sin(p.life * 6) * 2.4;
          p.endSize = p.size;
        },
      });
    }
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: R0 + 4, endSize: R0 + 26, maxLife: 1.1,
      color: '#e0f2fe', opacity: 0.6, fadeIn: 0.15, fadeOut: 0.4,
    });
  });
  // 极冠辉光粒子沿极轴升腾
  api.every(70, () => {
    const vdir = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: cx + api.range(-14, 14),
      y: cy + vdir * (R0 + api.range(0, 10)),
      vx: api.range(-12, 12),
      vy: vdir * api.range(30, 80),
      shape: 'spark',
      size: api.range(1, 2),
      maxLife: api.range(0.5, 0.9),
      color: vdir < 0 ? '#a5f3fc' : '#fbcfe8',
      glow: 1.2,
      fadeOut: 0.55,
    });
  }, { from: RECONNECT_AT + 60, until: 6800 });

  // 退场余韵：最后一圈微弱磁暴环
  api.at(6350, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 70, endSize: maxR * 0.8, maxLife: 0.95,
      color: '#7dd3fc', opacity: 0.2, fadeOut: 0.85,
    });
  });
};
</script>

<template>
  <div class="magnetar-surge-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.magnetarSurge" :scene="scene" />
    <div class="ms-core"></div>
    <div class="ms-hud">CRUST STRESS 97% · B = 1E11 TESLA</div>
    <div class="ms-badge">
      <Magnet :size="42" />
      <strong>磁星风暴</strong>
      <small>MAGNETAR TEMPEST · SGR EVENT</small>
    </div>
    <div class="ms-caption">FIELD RECONNECTED · FLUX NOMINAL</div>
  </div>
</template>

<style scoped lang="scss">
.magnetar-surge-effect {
  @include effect-stage(hidden);
}

.ms-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 96px;
  height: 96px;
  margin: -48px 0 0 -48px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 30%, rgba(186, 230, 253, 0.5), rgba(12, 30, 56, 0.9) 46%, rgba(2, 6, 23, 0.98) 78%);
  box-shadow: 0 0 44px rgba(125, 211, 252, 0.4), inset -8px -10px 30px rgba(2, 6, 23, 0.9);
  animation: ms-core 7.2s ease both;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 10% 6%;
    border-radius: 50%;
    background:
      linear-gradient(64deg, transparent 46%, rgba(244, 114, 182, 0.85) 49%, transparent 52%),
      linear-gradient(-38deg, transparent 55%, rgba(125, 211, 252, 0.8) 58%, transparent 61%);
    opacity: 0;
    animation: ms-crack 7.2s linear both;
  }

  &::after {
    transform: rotate(74deg);
    animation-delay: 0.12s;
  }
}

.ms-hud {
  position: absolute;
  top: 8%;
  left: 50%;
  color: rgba(125, 211, 252, 0.82);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: ms-hud 7.2s ease both;
}

.ms-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #e0f2fe;
  text-shadow: 0 0 20px rgba(125, 211, 252, 0.6);
  transform: translateX(-50%);
  animation: ms-badge 7.2s ease both;
}

.ms-badge strong {
  font-size: 18px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
}

.ms-badge small {
  color: rgba(244, 114, 182, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

.ms-caption {
  position: absolute;
  left: 50%;
  top: 27%;
  border: 1px solid rgba(125, 211, 252, 0.5);
  border-radius: 4px;
  background: rgba(12, 74, 110, 0.42);
  color: #bae6fd;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.2em;
  padding: 8px 20px;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: ms-caption 7.2s step-end both;
}

@keyframes ms-core {
  0% { opacity: 0; transform: scale(0.6); }
  8%, 82% { opacity: 1; transform: scale(1); }
  39.5% { transform: scale(1.06); }
  40.5% { transform: scale(0.97); }
  94%, 100% { opacity: 0; transform: scale(0.9); }
}

@keyframes ms-crack {
  0%, 8% { opacity: 0; }
  20% { opacity: 0.35; }
  32% { opacity: 0.7; }
  38% { opacity: 1; filter: brightness(1.8); }
  40% { opacity: 1; filter: brightness(2.4); }
  52% { opacity: 0.5; filter: brightness(1); }
  70% { opacity: 0.26; }
  84%, 100% { opacity: 0; }
}

@keyframes ms-hud {
  0%, 4% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  8% { opacity: 1; transform: translateX(-50%) translateY(0); }
  12% { opacity: 0.35; }
  16%, 24% { opacity: 1; }
  28%, 100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
}

@keyframes ms-badge {
  0%, 50% { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.94); }
  56%, 84% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  92%, 100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

@keyframes ms-caption {
  0%, 77% { opacity: 0; }
  78.5% { opacity: 1; }
  80.5% { opacity: 0.35; }
  82.5%, 92% { opacity: 1; }
  95%, 100% { opacity: 0; }
}
</style>
