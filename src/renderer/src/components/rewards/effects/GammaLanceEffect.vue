<script setup lang="ts">
import { Zap } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const TAU = Math.PI * 2;
/** 1.6s 双极喷流贯穿窗口 */
const BEAM_AT = 1600;
const BEAM_END = 3200;
/** 射线风暴横扫窗口 */
const STORM_FROM = 3400;
const STORM_TO = 5450;

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const w = api.width;
  const h = api.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.max(w, h);
  let now = 0;
  api.onFrame((tMs) => {
    now = tMs;
  });

  const stormX = (tMs: number) =>
    Math.pow(Math.min(1, Math.max(0, (tMs - STORM_FROM) / (STORM_TO - STORM_FROM))), 1.1) * (w / 2 + 100);

  // ── 幕一 · 坍缩星急旋蓄势（0-1.6s）──────────────────────────
  // 吸积盘：倾斜椭圆弧转速持续飙升、半径收紧
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > BEAM_AT + 80) return;
    const ramp = Math.min(1, tMs / 500);
    const speedUp = 1 + tMs / 520;
    ctx.translate(cx, cy);
    ctx.rotate(0.18);
    ctx.scale(1, 0.34);
    for (let ring = 0; ring < 5; ring += 1) {
      const rr = (34 + ring * 17) * (1 - tMs / 5200);
      const spin = (tMs / 1000) * (2.2 + ring * 0.4) * speedUp + ring * 2.4;
      ctx.save();
      ctx.rotate(spin);
      ctx.strokeStyle = ring % 2 === 0
        ? `rgba(232, 121, 249, ${(0.4 - ring * 0.055) * ramp})`
        : `rgba(103, 232, 249, ${(0.32 - ring * 0.045) * ramp})`;
      ctx.lineWidth = 9 - ring * 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0.3, Math.PI * 1.72);
      ctx.stroke();
      ctx.restore();
    }
  });
  // 磁力线绞成双极漏斗（随时间收窄）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > BEAM_AT) return;
    const ramp = Math.min(1, tMs / 700);
    const squeeze = 1 - 0.62 * Math.min(1, tMs / BEAM_AT);
    ctx.strokeStyle = `rgba(192, 132, 252, ${0.14 * ramp})`;
    ctx.lineWidth = 1.4;
    for (const vdir of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        const base = (26 + i * 20) * squeeze;
        const topW = (10 + i * 30) * squeeze;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + s * base, cy + vdir * 12);
          ctx.quadraticCurveTo(cx + s * (base + 26), cy + vdir * h * 0.22, cx + s * topW, cy + vdir * h * 0.55);
          ctx.stroke();
        }
      }
    }
  });
  // 物质螺旋坠入
  api.every(18, () => {
    let radius = api.range(120, maxR * 0.5);
    let angle = api.range(0, TAU);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.5,
      shape: 'spark',
      size: api.range(1.2, 2.4),
      maxLife: 1.4,
      color: api.pick(['#e879f9', '#f0abfc', '#67e8f9']),
      glow: 1.05,
      fadeIn: 0.12,
      fadeOut: 0.08,
      update: (p, dt) => {
        angle += (2 + Math.max(0, 260 - radius) / 60) * dt * 2;
        radius -= (radius * 1.5 + 60) * dt;
        if (radius < 12) p.life = p.maxLife;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius * 0.5;
      },
    });
  }, { until: BEAM_AT - 120 });

  // ── 幕二 · 1.6s 双极白紫光柱贯穿 ────────────────────────────
  api.at(1480, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 60, endSize: 4, maxLife: 0.16,
      color: '#fdf4ff', opacity: 0.9, fadeOut: 0.4,
    });
  });
  api.at(BEAM_AT, () => {
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 18, endSize: 360, maxLife: 0.6,
      color: '#fdf4ff', glow: 2.4, fadeOut: 0.9,
    });
  });
  [0, 140, 320].forEach((d, i) => {
    api.at(BEAM_AT + d, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 24, endSize: maxR * (0.3 + i * 0.18), maxLife: 0.8,
        color: ['#fdf4ff', '#e879f9', '#67e8f9'][i], opacity: 0.8, fadeOut: 0.7,
      });
    });
  });
  // 粒子沿光柱高速喷射
  api.every(24, () => {
    for (const vdir of [-1, 1]) {
      api.burst({
        x: cx + api.range(-6, 6),
        y: cy + vdir * 14,
        count: 5,
        speed: [640, 1150],
        angle: [(vdir * Math.PI) / 2 - 0.085, (vdir * Math.PI) / 2 + 0.085],
        base: { shape: 'streak', stretch: 0.1, size: 2.2, maxLife: 0.8, glow: 1.2, fadeOut: 0.35 },
        vary: (p, rng) => {
          p.color = rng() > 0.62 ? '#fdf4ff' : rng() > 0.4 ? '#e879f9' : '#67e8f9';
          p.maxLife = 0.5 + rng() * 0.5;
        },
      });
    }
  }, { from: BEAM_AT + 20, until: BEAM_END - 60 });

  // 沿柱星体：喷流前锋抵达时过曝 → 蒸发成离子雾
  const beamStars = Array.from({ length: 12 }, () => ({
    x: cx + (api.rng() > 0.5 ? 1 : -1) * api.range(18, 85),
    y: cy + (api.rng() > 0.5 ? 1 : -1) * api.range(60, h * 0.5),
    depth: api.rng(),
  }));
  const vaporize = (x: number, y: number, big: boolean) => {
    api.burst({
      x, y, count: big ? 12 : 8, speed: [12, 70],
      base: {
        shape: 'dot', size: 3.4, endSize: 8, maxLife: 2.2, glow: 0.7,
        opacity: 0.4, wander: 36, fadeIn: 0.1, fadeOut: 0.5,
      },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#c084fc' : '#67e8f9';
        p.maxLife = 1.4 + rng() * 1.2;
      },
    });
    api.burst({
      x, y, count: big ? 7 : 5, speed: [60, 190],
      base: { shape: 'spark', size: 1.6, maxLife: 0.6, glow: 1.2, color: '#f0abfc', drag: 0.4, fadeOut: 0.5 },
    });
  };
  beamStars.forEach((s) => {
    const star = api.spawn({
      x: s.x, y: s.y, shape: 'dot', size: 1.6 + s.depth * 2.6, maxLife: 7,
      color: '#f5f3ff', glow: 0.9, opacity: 0.5 + s.depth * 0.45,
      twinkle: api.range(0.5, 1.4), fadeIn: 0.05, fadeOut: 0.1,
    });
    if (!star) return;
    const crossAt = BEAM_AT + 90 + (Math.abs(s.y - cy) / (h * 0.55)) * 480;
    api.at(crossAt, () => {
      star.color = '#ffffff';
      star.glow = 2.2;
      star.size *= 2.2;
      star.endSize = star.size;
      star.twinkle = 0;
    });
    api.at(crossAt + 150, () => {
      star.life = star.maxLife;
      vaporize(star.x, star.y, true);
    });
  });

  // ── 幕三 · 射线风暴横扫余域（3.4-5.45s）─────────────────────
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < STORM_FROM || tMs > STORM_TO + 300) return;
    const fade = Math.min(1, (tMs - STORM_FROM) / 200) * Math.min(1, Math.max(0, (STORM_TO + 300 - tMs) / 300));
    const off = stormX(tMs);
    for (const s of [-1, 1]) {
      const x = cx + s * off;
      const grad = ctx.createLinearGradient(x - s * 90, 0, x + s * 26, 0);
      grad.addColorStop(0, 'rgba(103, 232, 249, 0)');
      grad.addColorStop(0.7, `rgba(192, 132, 252, ${0.1 * fade})`);
      grad.addColorStop(1, `rgba(240, 171, 252, ${0.26 * fade})`);
      ctx.fillStyle = grad;
      ctx.fillRect(Math.min(x - s * 90, x + s * 26), 0, 116, h);
      ctx.fillStyle = `rgba(253, 244, 255, ${0.5 * fade})`;
      ctx.fillRect(x - 1.2, 0, 2.4, h);
    }
  });
  // 风暴前沿横向粒子流
  api.every(36, () => {
    const off = stormX(now);
    for (const s of [-1, 1]) {
      const x = cx + s * off;
      if (x < -40 || x > w + 40) continue;
      api.spawn({
        x,
        y: api.range(0, h),
        vx: s * api.range(260, 520),
        vy: api.range(-30, 30),
        shape: 'streak',
        stretch: 0.09,
        size: api.range(1.2, 2.2),
        maxLife: api.range(0.4, 0.9),
        color: api.pick(['#c084fc', '#67e8f9', '#f0abfc', '#fdf4ff']),
        glow: 1,
        drag: 0.6,
        fadeOut: 0.4,
      });
    }
  }, { from: STORM_FROM, until: STORM_TO });
  // 外域星体：风暴前沿过境时逐一过曝蒸发
  const fieldStars = Array.from({ length: 14 }, () => ({
    x: cx + (api.rng() > 0.5 ? 1 : -1) * api.range(130, w * 0.46),
    y: api.range(h * 0.08, h * 0.92),
    depth: api.rng(),
  }));
  fieldStars.forEach((s) => {
    const star = api.spawn({
      x: s.x, y: s.y, shape: 'dot', size: 1.4 + s.depth * 2.4, maxLife: 7,
      color: '#ede9fe', glow: 0.8, opacity: 0.45 + s.depth * 0.45,
      twinkle: api.range(0.4, 1.2), fadeIn: 0.05, fadeOut: 0.1,
    });
    if (!star) return;
    const u = Math.pow(Math.min(1, Math.abs(s.x - cx) / (w / 2 + 100)), 1 / 1.1);
    const crossAt = STORM_FROM + u * (STORM_TO - STORM_FROM);
    api.at(crossAt, () => {
      star.color = '#ffffff';
      star.glow = 2;
      star.size *= 2;
      star.endSize = star.size;
      star.twinkle = 0;
    });
    api.at(crossAt + 130, () => {
      star.life = star.maxLife;
      vaporize(star.x, star.y, false);
    });
  });
  // 离子雾余辉：全域漂浮的电离薄雾
  api.every(90, () => {
    api.spawn({
      x: api.rng() * w,
      y: api.rng() * h,
      vx: api.range(-10, 10),
      vy: api.range(-14, 6),
      shape: 'dot',
      size: api.range(4, 9),
      endSize: api.range(10, 16),
      maxLife: api.range(1.4, 2.2),
      color: api.pick(['#c084fc', '#67e8f9']),
      glow: 0.6,
      opacity: 0.16,
      wander: 26,
      fadeIn: 0.2,
      fadeOut: 0.45,
    });
  }, { from: 3300, until: 5900 });

  // ── 退场 · 电离余辉──────────────────────────────────────────
  api.at(5600, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 50, endSize: maxR * 0.7, maxLife: 0.9,
      color: '#e879f9', opacity: 0.3, fadeOut: 0.8,
    });
  });
  api.at(6050, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 60, endSize: maxR * 0.9, maxLife: 0.9,
      color: '#c084fc', opacity: 0.22, fadeOut: 0.85,
    });
  });
};
</script>

<template>
  <div class="gamma-lance-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.gammaLance" :scene="scene" />
    <div class="gl-beam gl-beam-up"></div>
    <div class="gl-beam gl-beam-down"></div>
    <div class="gl-hud">COLLAPSAR SPIN-UP · MAGNETIC FUNNEL LOCKED</div>
    <div class="gl-badge">
      <Zap :size="42" />
      <strong>伽马湮灭</strong>
      <small>GAMMA LANCE · DUAL JET 0.99c</small>
    </div>
    <div class="gl-caption">STERILIZATION COMPLETE · R = 1.2 KPC</div>
  </div>
</template>

<style scoped lang="scss">
.gamma-lance-effect {
  @include effect-stage(hidden);
}

.gl-beam {
  position: absolute;
  left: 50%;
  width: 120px;
  margin-left: -60px;
  background:
    linear-gradient(90deg, transparent, rgba(103, 232, 249, 0.25) 22%, rgba(232, 121, 249, 0.55) 38%, rgba(253, 244, 255, 0.98) 50%, rgba(232, 121, 249, 0.55) 62%, rgba(103, 232, 249, 0.25) 78%, transparent);
  opacity: 0;
  pointer-events: none;
  animation: gl-beam 7s linear both;
}

.gl-beam-up {
  top: 0;
  height: 50%;
  transform-origin: 50% 100%;
}

.gl-beam-down {
  bottom: 0;
  height: 50%;
  transform-origin: 50% 0%;
}

.gl-hud {
  position: absolute;
  top: 8%;
  left: 50%;
  color: rgba(240, 171, 252, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: gl-hud 7s ease both;
}

.gl-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #fae8ff;
  text-shadow: 0 0 20px rgba(232, 121, 249, 0.65);
  transform: translateX(-50%);
  animation: gl-badge 7s ease both;
}

.gl-badge strong {
  font-size: 18px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
}

.gl-badge small {
  color: rgba(103, 232, 249, 0.82);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

.gl-caption {
  position: absolute;
  left: 50%;
  top: 30%;
  border: 1px solid rgba(232, 121, 249, 0.5);
  border-radius: 4px;
  background: rgba(59, 7, 100, 0.45);
  color: #f5d0fe;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.2em;
  padding: 8px 20px;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: gl-caption 7s step-end both;
}

@keyframes gl-beam {
  0%, 22.5% { opacity: 0; transform: scaleX(0.05); }
  23.3% { opacity: 1; transform: scaleX(1.16); }
  25% { transform: scaleX(0.9); }
  28% { transform: scaleX(1.08); }
  32% { transform: scaleX(0.94); }
  36% { transform: scaleX(1.05); }
  40% { transform: scaleX(0.9); }
  44% { opacity: 1; transform: scaleX(1); }
  46.5% { opacity: 0.8; transform: scaleX(0.3); }
  48%, 100% { opacity: 0; transform: scaleX(0.02); }
}

@keyframes gl-hud {
  0%, 3% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  7% { opacity: 1; transform: translateX(-50%) translateY(0); }
  11% { opacity: 0.35; }
  14%, 19% { opacity: 1; }
  23%, 100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
}

@keyframes gl-badge {
  0%, 52% { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.94); }
  58%, 86% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  93%, 100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

@keyframes gl-caption {
  0%, 80% { opacity: 0; }
  81.5% { opacity: 1; }
  83.5% { opacity: 0.35; }
  85.5%, 94% { opacity: 1; }
  96%, 100% { opacity: 0; }
}
</style>
