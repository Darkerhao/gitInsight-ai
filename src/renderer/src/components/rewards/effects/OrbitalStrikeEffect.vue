<script setup lang="ts">
import { Crosshair } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 天基打击 KINETIC LANCE · 5200ms（entry 700 / loop 3700 / exit 800）
 * 三幕：侦察扫描 + 收拢锁定 → 授权测距 + 炽白光柱贯落（青色电离缘）→ 冲击/余烬/裂纹渐熄
 */
const LOCK_AT = 700;
const BEAM_AT = 1600;
const BEAM_END = 2600;
const IMPACT = BEAM_AT + 70;

const scene: SceneFn = (api) => {
  api.setTrail(0.28);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const gy = H * 0.58; // 落点地表

  // ── 幕一：轨道侦察 —— 双扫描带自穹顶压向地表 + 遥测字符雨 ──
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > 1460) return;
    const bands: Array<[number, number]> = [[0, 1350], [430, 1450]];
    for (const [from, until] of bands) {
      if (tMs < from || tMs > until) continue;
      const k = (tMs - from) / (until - from);
      const y = k * (2 - k) * gy * 0.94;
      const alpha = 0.22 * Math.sin(Math.PI * Math.min(1, k));
      const grad = ctx.createLinearGradient(0, y - 14, 0, y + 14);
      grad.addColorStop(0, 'rgba(248, 113, 113, 0)');
      grad.addColorStop(0.5, `rgba(248, 113, 113, ${alpha})`);
      grad.addColorStop(1, 'rgba(248, 113, 113, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 14, W, 28);
    }
  });
  api.every(90, () => {
    api.spawn({
      x: api.range(W * 0.2, W * 0.8), y: api.range(H * 0.08, H * 0.4),
      vy: api.range(30, 70), shape: 'glyph', glyph: api.pick(['0', '1', '4', '7', 'A', 'F', 'Δ', '▸', '┊']),
      size: api.range(9, 13), maxLife: 0.55, color: '#fca5a5', opacity: 0.38,
      fadeIn: 0.1, fadeOut: 0.3,
    });
  }, { from: 150, until: 1350 });

  // 地表基准线（微光，随全程呼吸）
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const env = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (api.duration / 1000 - t) / 0.6));
    if (env <= 0) return;
    const grad = ctx.createLinearGradient(cx - W * 0.42, gy, cx + W * 0.42, gy);
    grad.addColorStop(0, 'rgba(248, 113, 113, 0)');
    grad.addColorStop(0.5, `rgba(252, 165, 165, ${0.3 * env})`);
    grad.addColorStop(1, 'rgba(248, 113, 113, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.42, gy);
    ctx.lineTo(cx + W * 0.42, gy);
    ctx.stroke();
  });

  // 锁定：主辅双色环收拢 → 白点定标 + 微噼啪
  api.at(320, () => {
    api.spawn({ x: cx, y: gy, shape: 'ring', size: 240, endSize: 16, maxLife: 0.5, color: '#f87171', opacity: 0.65, fadeIn: 0.08, fadeOut: 0.3 });
  });
  api.at(540, () => {
    api.spawn({ x: cx, y: gy, shape: 'ring', size: 160, endSize: 10, maxLife: 0.42, color: '#67e8f9', opacity: 0.55, fadeIn: 0.08, fadeOut: 0.3 });
  });
  api.at(LOCK_AT, () => {
    api.spawn({ x: cx, y: gy, shape: 'dot', size: 9, endSize: 2, maxLife: 0.3, color: '#fff1f2', glow: 1.8, fadeOut: 0.6 });
    api.burst({
      x: cx, y: gy, count: 6, speed: [50, 120],
      base: { shape: 'spark', size: 1.4, maxLife: 0.35, color: '#fca5a5', glow: 1, drag: 0.4, fadeOut: 0.5 },
    });
  });

  // ── 幕二前奏：1150ms 平台授权闪烁走线，1480ms 测距导引脉冲先行贯地 ──
  api.at(1150, () => {
    api.spawn({ x: cx, y: H * 0.05, shape: 'dot', size: 5, endSize: 14, maxLife: 0.5, color: '#e0f2fe', glow: 1.8, twinkle: 9, fadeOut: 0.6 });
    [-1, 1].forEach((dir) => {
      api.spawn({
        x: cx, y: H * 0.05, vx: dir * 900, shape: 'streak', stretch: 0.08,
        size: 1.4, maxLife: 0.3, color: '#67e8f9', glow: 1, fadeOut: 0.4,
      });
    });
  });
  api.at(1480, () => {
    api.spawn({
      x: cx, y: -12, vy: (gy + 20) / 0.14, shape: 'streak', stretch: 0.05,
      size: 1.6, maxLife: 0.14, color: '#f8fafc', glow: 1.2, fadeIn: 0, fadeOut: 0.3,
    });
  });

  // ── 幕二：炽白光柱贯落 —— 青色电离锥 + 主色辉光层 + 白热核心（宽度双频脉冲） ──
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BEAM_AT || tMs > BEAM_END + 220) return;
    const ramp = Math.min(1, (tMs - BEAM_AT) / 110) * Math.max(0, Math.min(1, (BEAM_END + 220 - tMs) / 260));
    if (ramp <= 0) return;
    const w = (15 + Math.sin(tMs / 42) * 5 + Math.sin(tMs / 111) * 3) * ramp;
    ctx.fillStyle = `rgba(103, 232, 249, ${0.14 * ramp})`;
    ctx.beginPath();
    ctx.moveTo(cx - w * 4.6, 0);
    ctx.lineTo(cx + w * 4.6, 0);
    ctx.lineTo(cx + w * 2.6, gy);
    ctx.lineTo(cx - w * 2.6, gy);
    ctx.closePath();
    ctx.fill();
    const grad = ctx.createLinearGradient(cx - w * 2.4, 0, cx + w * 2.4, 0);
    grad.addColorStop(0, 'rgba(248, 113, 113, 0)');
    grad.addColorStop(0.3, `rgba(252, 165, 165, ${0.38 * ramp})`);
    grad.addColorStop(0.5, `rgba(255, 251, 235, ${0.95 * ramp})`);
    grad.addColorStop(0.7, `rgba(252, 165, 165, ${0.38 * ramp})`);
    grad.addColorStop(1, 'rgba(248, 113, 113, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w * 2.4, 0, w * 4.8, gy);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * ramp})`;
    ctx.fillRect(cx - w * 0.5, 0, w, gy);
  });
  // 柱内下行热流（速度纹理）
  api.every(26, () => {
    api.spawn({
      x: cx + api.range(-11, 11), y: -10, vy: api.range(2000, 2600),
      shape: 'streak', stretch: 0.06, size: 1.6, maxLife: (gy + 20) / 2000,
      color: '#fffbeb', glow: 1, fadeIn: 0, fadeOut: 0.3,
    });
  }, { from: BEAM_AT, until: BEAM_END });

  // ── 幕三：冲击 —— 白闪 + 贴地冲击前沿 + 半圆火花溅射（触地反溅）+ 三重环 ──
  api.at(IMPACT, () => {
    api.spawn({ x: cx, y: gy, shape: 'dot', size: 22, endSize: 280, maxLife: 0.55, color: '#fff7ed', glow: 2.4, fadeOut: 0.9 });
    [-1, 1].forEach((dir) => {
      api.burst({
        x: cx, y: gy - 2, count: 10, speed: [260, 720],
        angle: dir > 0 ? [-0.06, 0.06] : [Math.PI - 0.06, Math.PI + 0.06],
        base: { shape: 'streak', stretch: 0.06, size: 2, maxLife: 0.5, color: '#fecaca', glow: 1.1, drag: 0.42, fadeOut: 0.4 },
      });
    });
  });
  api.every(46, () => {
    api.burst({
      x: cx + api.range(-14, 14), y: gy, count: 13, speed: [200, 560],
      angle: [Math.PI + 0.25, Math.PI * 2 - 0.25],
      base: { shape: 'spark', size: 2.2, maxLife: 1.1, glow: 1.1, ay: 340, drag: 0.5, fadeOut: 0.35 },
      vary: (p, rng) => {
        p.color = rng() > 0.55 ? '#fca5a5' : rng() > 0.4 ? '#fdba74' : '#fef3c7';
        p.maxLife = 0.6 + rng() * 0.7;
        p.update = (pt) => {
          if (pt.y > gy + 4 && pt.vy > 0) {
            pt.vy *= -0.38;
            pt.vx *= 1.35;
          }
        };
      },
    });
  }, { from: IMPACT + 30, until: BEAM_END + 150 });
  [0, 170, 380].forEach((delay, i) => {
    api.at(IMPACT + 90 + delay, () => {
      api.spawn({
        x: cx, y: gy, shape: 'ring', size: 20,
        endSize: Math.max(W, H) * (0.32 + i * 0.18),
        maxLife: 0.95, color: i === 1 ? '#67e8f9' : '#f87171', opacity: 0.8, fadeOut: 0.72,
      });
    });
  });

  // 烟尘缓升（远景压暗的哑光灰）+ 驻留余烬 + 热浪上飘
  api.every(120, () => {
    api.spawn({
      x: cx + api.range(-100, 100), y: gy + api.range(-8, 8),
      vy: api.range(-42, -16), vx: api.range(-18, 18),
      shape: 'dot', size: api.range(14, 26), endSize: api.range(38, 56),
      maxLife: api.range(1.4, 2.2), color: 'rgba(120, 113, 108, 0.6)', glow: 0,
      opacity: 0.16, composite: 'source-over', wander: 20, fadeIn: 0.16, fadeOut: 0.42,
    });
  }, { from: IMPACT + 140, until: 3800 });
  api.at(IMPACT + 260, () => {
    for (let i = 0; i < 34; i += 1) {
      api.spawn({
        x: cx + api.range(-170, 170), y: gy + api.range(-6, 14),
        vy: api.range(-26, -6), shape: 'dot', size: api.range(0.9, 1.9),
        maxLife: api.range(1.2, 2.4), color: api.rng() < 0.5 ? '#fb923c' : '#f87171',
        glow: 1, wander: 18, twinkle: api.range(2, 4), fadeIn: 0.1, fadeOut: 0.4,
      });
    }
  });
  api.every(90, () => {
    api.spawn({
      x: cx + api.range(-60, 60), y: gy - api.range(4, 30),
      vy: api.range(-90, -50), shape: 'streak', stretch: 0.04,
      size: 1.2, maxLife: 0.5, color: '#fda4af', glow: 0.7, opacity: 0.2, fadeIn: 0.16, fadeOut: 0.4,
    });
  }, { from: 2700, until: 4100 });

  // 地表裂纹：白热 → 暗红渐熄，随机二次噼啪
  const cracks = Array.from({ length: 6 }, () => {
    const angle = api.range(Math.PI + 0.18, Math.PI * 2 - 0.18);
    const len = api.range(70, 190);
    const pts: Array<[number, number]> = [[cx, gy]];
    let px = cx;
    let py = gy;
    for (let s = 1; s <= 5; s += 1) {
      px += Math.cos(angle) * (len / 5) + api.range(-9, 9);
      py += Math.abs(Math.sin(angle)) * (len / 10) + api.range(1, 5);
      pts.push([px, py]);
    }
    return pts;
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < IMPACT + 120) return;
    const heat = Math.max(0, 1 - (tMs - IMPACT - 120) / 2800);
    if (heat <= 0.02) return;
    ctx.lineJoin = 'round';
    for (const pts of cracks) {
      for (const [style, widthPx] of [
        [`rgba(248, 113, 113, ${0.5 * heat})`, 2.4],
        [`rgba(255, 241, 242, ${0.6 * heat * heat})`, 0.9],
      ] as Array<[string, number]>) {
        ctx.strokeStyle = style;
        ctx.lineWidth = widthPx;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }
  });
  [2950, 3450, 3950].forEach((when) => {
    api.at(when, () => {
      const crack = api.pick(cracks);
      const tip = crack[Math.floor(api.range(1, crack.length))];
      api.spawn({ x: tip[0], y: tip[1], shape: 'dot', size: 4, endSize: 1, maxLife: 0.24, color: '#fff1f2', glow: 1.6, fadeOut: 0.6 });
      api.burst({
        x: tip[0], y: tip[1], count: 7, speed: [60, 200],
        angle: [Math.PI + 0.3, Math.PI * 2 - 0.3],
        base: { shape: 'spark', size: 1.5, maxLife: 0.45, color: '#fb923c', glow: 1, ay: 260, drag: 0.5, fadeOut: 0.4 },
      });
    });
  });

  // 4650ms：警报解除 —— 一圈冷却青环确认
  api.at(4650, () => {
    api.spawn({ x: cx, y: gy, shape: 'ring', size: 10, endSize: 150, maxLife: 0.6, color: '#67e8f9', opacity: 0.5, fadeOut: 0.7 });
  });
};
</script>

<template>
  <div class="orbital-strike-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.orbitalStrike" :scene="scene" />
    <div class="strike-crosshair">
      <Crosshair :size="120" :stroke-width="1" />
    </div>
    <span class="strike-corner is-tl" />
    <span class="strike-corner is-tr" />
    <span class="strike-corner is-bl" />
    <span class="strike-corner is-br" />
    <div class="strike-warning">ORBITAL PLATFORM · TARGET LOCKED · FIRE AUTHORIZED</div>
    <div class="strike-confirm">
      <strong>天基打击</strong>
      <small>KINETIC LANCE · IMPACT CONFIRMED</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.orbital-strike-effect {
  @include effect-stage(hidden);
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

.strike-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 2px solid rgba(248, 113, 113, 0.65);
  animation: strike-corner 5.2s ease both;
}

.strike-corner.is-tl { left: 10%; top: 12%; border-right: 0; border-bottom: 0; }
.strike-corner.is-tr { right: 10%; top: 12%; border-left: 0; border-bottom: 0; }
.strike-corner.is-bl { left: 10%; bottom: 12%; border-right: 0; border-top: 0; }
.strike-corner.is-br { right: 10%; bottom: 12%; border-left: 0; border-top: 0; }

.strike-warning {
  position: absolute;
  left: 50%;
  top: 9%;
  border: 1px solid rgba(248, 113, 113, 0.5);
  border-radius: 6px;
  background: rgba(69, 10, 10, 0.5);
  color: #fecaca;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  padding: 8px 18px;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: strike-warning 5.2s step-end both;
}

.strike-confirm {
  position: absolute;
  left: 50%;
  bottom: 11%;
  color: #fee2e2;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 16px rgba(248, 113, 113, 0.65);
  transform: translateX(-50%);
  animation: strike-confirm 5.2s ease both;
}

.strike-confirm strong {
  font-size: 17px;
  letter-spacing: 0.16em;
}

.strike-confirm small {
  color: rgba(254, 202, 202, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.24em;
}

@keyframes strike-lock {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(3.4) rotate(80deg); }
  6% { opacity: 1; }
  13% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  15% { transform: translate(-50%, -50%) scale(1.12); }
  17%, 29% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  31% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  38%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.82); }
}

@keyframes strike-corner {
  0% { opacity: 0; transform: scale(1.6); }
  8% { opacity: 1; transform: scale(1); }
  12% { opacity: 0.35; }
  16%, 30% { opacity: 1; }
  40%, 100% { opacity: 0; transform: scale(0.9); }
}

@keyframes strike-warning {
  0%, 3% { opacity: 0; }
  5% { opacity: 1; }
  8% { opacity: 0.3; }
  11% { opacity: 1; }
  14% { opacity: 0.4; }
  17%, 74% { opacity: 1; }
  80%, 100% { opacity: 0; }
}

@keyframes strike-confirm {
  0%, 58% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  66%, 88% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}
</style>
