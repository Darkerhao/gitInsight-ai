<script setup lang="ts">
import { Spline } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 宇宙弦切 · STRING SEVER（创世级 666）
 * 幕一 0-800ms    一根发光细弦横贯屏幕绷紧，星野沿弦微微弯折
 * 幕二 800-6100ms 弦体三次拨振：驻波沿弦奔跑、甩出引力涟漪环；
 *                 4.25s 起 1.9s 弦切掠过 —— 全屏沿切线错位半格，切缝喷出光尘
 * 幕三 6100-7100ms 弦淡出，错位的两半星野永久定格 SPACETIME OFFSET
 */
const TAU = Math.PI * 2;
const CUT_FROM = 4250;
const CUT_SPAN = 1900;

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const W = api.width;
  const H = api.height;
  const minDim = Math.min(W, H);
  const sy = H * 0.5;

  const plucks = [
    { t0: 1150, x0: W * api.range(0.22, 0.3) },
    { t0: 2250, x0: W * api.range(0.58, 0.68) },
    { t0: 3350, x0: W * api.range(0.4, 0.5) },
  ];

  const smooth = (v: number) => v * v * (3 - 2 * v);
  const shearAt = (t: number) => (t <= CUT_FROM ? 0 : 16 * smooth(Math.min(1, (t - CUT_FROM) / CUT_SPAN)));
  // 弦的纵向位移：入场下垂绷紧 + 绷紧余颤 + 三次拨振的行波包
  const waveY = (x: number, t: number) => {
    let y = 0;
    for (const pl of plucks) {
      const a = (t - pl.t0) / 1000;
      if (a <= 0 || a > 1.7) continue;
      const amp = 44 * Math.exp(-a * 1.9);
      for (const dir of [-1, 1]) {
        const c = pl.x0 + dir * a * 540;
        const g = Math.exp(-((x - c) * (x - c)) / 12800);
        y += amp * g * Math.sin((x - pl.x0) * 0.045 - a * 11 * dir);
      }
    }
    if (t < 800) y += Math.sin((Math.PI * x) / W) * 42 * (1 - smooth(Math.min(1, t / 800)));
    else if (t < 1200) y += Math.sin(x * 0.06 + t * 0.09) * 7 * Math.exp(-(t - 800) / 170);
    return y;
  };

  let nowT = 0;
  api.onFrame((tMs) => { nowT = tMs; });

  // ---------- 星野：被弦引力微弯，弦切后两半永久错位 ----------
  for (let i = 0; i < 118; i += 1) {
    const bx = api.rng() * W;
    const by = api.rng() * H;
    api.spawn({
      x: bx, y: by, shape: 'dot', size: api.range(0.7, 2), maxLife: 7.0,
      color: api.pick(['#e2e8f0', '#f5d0fe', '#a5f3fc', '#ffffff']),
      glow: 0.7, opacity: api.range(0.3, 0.8), twinkle: api.range(0.3, 1.3),
      fadeIn: 0.04, fadeOut: 0.12,
      update: (p) => {
        const pull = Math.min(1, nowT / 800) * (nowT < 6100 ? 1 : Math.max(0, 1 - (nowT - 6100) / 520));
        const d = sy - by;
        const bend = pull * 15 * Math.exp(-Math.abs(d) / 110) * Math.sign(d);
        const shear = shearAt(nowT);
        p.x = bx + (by < sy ? -shear : shear);
        p.y = by + bend;
      },
    });
  }

  // ---------- 弦体绘制：驻波奔跑 + 弦切错位 + 切割光结 ----------
  api.onFrame((tMs, _dt, ctx) => {
    const fade = tMs < 6100 ? Math.min(1, tMs / 320) : Math.max(0, 1 - (tMs - 6100) / 520);
    if (fade <= 0.01) return;
    const shear = shearAt(tMs);
    const gap = shear * 0.6;
    const sweep = tMs <= CUT_FROM ? 0 : Math.min(1, (tMs - CUT_FROM) / CUT_SPAN) * W;
    const drawSpan = (x1: number, x2: number, dx: number, dy: number, glowA: number, coreA: number) => {
      for (const pass of [0, 1] as const) {
        ctx.strokeStyle = pass === 0 ? `rgba(240, 171, 252, ${glowA})` : `rgba(255, 255, 255, ${coreA})`;
        ctx.lineWidth = pass === 0 ? 4.6 : 1.4;
        ctx.beginPath();
        for (let x = x1; x <= x2; x += 12) {
          const y = sy + waveY(x, tMs) + dy;
          if (x === x1) ctx.moveTo(x + dx, y);
          else ctx.lineTo(x + dx, y);
        }
        ctx.stroke();
      }
    };
    if (sweep <= 0) {
      drawSpan(0, W, 0, 0, 0.3 * fade, 0.85 * fade);
    } else {
      if (sweep < W) drawSpan(Math.floor(sweep / 12) * 12, W + 12, 0, 0, 0.3 * fade, 0.85 * fade);
      drawSpan(0, Math.ceil(sweep / 12) * 12, -shear, -gap, 0.24 * fade, 0.6 * fade);
      drawSpan(0, Math.ceil(sweep / 12) * 12, shear, gap, 0.24 * fade, 0.6 * fade);
      if (tMs <= CUT_FROM + CUT_SPAN + 140) {
        const kx = Math.min(W, sweep);
        const g = ctx.createRadialGradient(kx, sy, 0, kx, sy, 30);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
        g.addColorStop(0.4, `rgba(245, 208, 254, ${0.5 * fade})`);
        g.addColorStop(1, 'rgba(245, 208, 254, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(kx, sy, 30, 0, TAU);
        ctx.fill();
      }
    }
  });

  // 入场绷紧的一瞬：弦上迸出细碎光屑
  api.at(800, () => {
    for (let i = 0; i < 26; i += 1) {
      const x = (i / 25) * W + api.range(-10, 10);
      api.spawn({
        x, y: sy + api.range(-3, 3), vy: api.range(-40, 40), vx: api.range(-14, 14),
        shape: 'spark', size: api.range(1, 1.8), maxLife: api.range(0.4, 0.7),
        color: api.rng() > 0.5 ? '#f5d0fe' : '#fffbeb', glow: 1.1, drag: 0.5, fadeOut: 0.4,
      });
    }
  });

  // ---------- 三次拨振：引力涟漪环 + 拨点光花 ----------
  plucks.forEach((pl) => {
    [0, 130, 260].forEach((d, j) => {
      api.at(pl.t0 + d, () => {
        api.spawn({
          x: pl.x0, y: sy, shape: 'ring', size: 14,
          endSize: minDim * (0.3 + j * 0.16), maxLife: 0.8,
          color: j === 1 ? '#67e8f9' : '#f5d0fe', opacity: 0.6, fadeOut: 0.7,
        });
      });
    });
    api.at(pl.t0, () => {
      api.burst({
        x: pl.x0, y: sy, count: 30, speed: [80, 300],
        base: { shape: 'spark', size: 1.8, maxLife: 0.8, glow: 1.2, drag: 0.4, fadeOut: 0.4 },
        vary: (p, rng) => { p.color = rng() > 0.5 ? '#f5d0fe' : rng() > 0.4 ? '#67e8f9' : '#fffbeb'; },
      });
    });
  });

  // ---------- 弦切掠过：切缝喷出光尘（上下对喷） ----------
  api.every(12, (idx) => {
    const t = CUT_FROM + idx * 12;
    const sx = Math.min(1, (t - CUT_FROM) / CUT_SPAN) * W;
    for (const dir of [-1, 1]) {
      api.spawn({
        x: sx + api.range(-6, 6), y: sy + dir * api.range(2, 10),
        vx: api.range(-24, 24), vy: dir * api.range(30, 130),
        shape: api.rng() > 0.7 ? 'streak' : 'spark', stretch: 0.1,
        size: api.range(1.2, 2.2), maxLife: api.range(0.4, 0.7),
        color: api.pick(['#f5d0fe', '#fffbeb', '#67e8f9']), glow: 1.1, drag: 0.6, fadeOut: 0.4,
      });
    }
  }, { from: CUT_FROM, until: CUT_FROM + CUT_SPAN - 20 });
  // 切入与切离的双涟漪
  [CUT_FROM, CUT_FROM + CUT_SPAN].forEach((t0, i) => {
    api.at(t0, () => {
      api.spawn({
        x: i === 0 ? 0 : W, y: sy, shape: 'ring', size: 18,
        endSize: minDim * 0.5, maxLife: 0.8, color: '#f5d0fe', opacity: 0.7, fadeOut: 0.7,
      });
    });
  });
  // 弦切完成：右缘光花散场
  api.at(CUT_FROM + CUT_SPAN, () => {
    api.burst({
      x: W - 6, y: sy, count: 36, speed: [120, 420],
      angle: [Math.PI * 0.6, Math.PI * 1.4],
      base: { shape: 'streak', stretch: 0.08, size: 1.8, maxLife: 0.7, glow: 1.2, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => { p.color = rng() > 0.5 ? '#f5d0fe' : '#a5f3fc'; },
    });
  });

  // 余韵：切缝处残余光尘缓浮
  api.every(90, () => {
    api.spawn({
      x: api.rng() * W, y: sy + api.range(-14, 14),
      vy: api.range(-12, 12), shape: 'dot', size: api.range(0.8, 1.6),
      maxLife: api.range(0.6, 1), color: '#f5d0fe', glow: 1,
      twinkle: api.range(2, 4), opacity: 0.7, fadeOut: 0.5,
    });
  }, { from: 6150, until: 6900 });
};
</script>

<template>
  <div class="cosmic-string-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.cosmicString" :scene="scene" />
    <div class="cs-half top" />
    <div class="cs-half bottom" />
    <div class="cs-badge">
      <Spline :size="38" />
      <strong>宇宙弦切</strong>
      <small>STRING SEVER · PROTOCOL 666</small>
    </div>
    <div class="cs-caption">
      <strong>SPACETIME OFFSET</strong>
      <small>空间错位 · 永不复位</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cosmic-string-effect {
  @include effect-stage(hidden);
  animation: cs-camera 7.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}

// 上下两半星幕：弦切掠过后沿切线错位半格并永久定格
.cs-half {
  position: absolute;
  left: -24px;
  right: -24px;
  pointer-events: none;
  background-image:
    radial-gradient(1.6px 1.6px at 12% 34%, rgba(245, 208, 254, 0.9), transparent 100%),
    radial-gradient(1.2px 1.2px at 78% 18%, rgba(165, 243, 252, 0.8), transparent 100%),
    radial-gradient(1.4px 1.4px at 44% 62%, rgba(226, 232, 240, 0.85), transparent 100%),
    radial-gradient(1.1px 1.1px at 88% 74%, rgba(245, 208, 254, 0.7), transparent 100%),
    radial-gradient(1.3px 1.3px at 28% 86%, rgba(226, 232, 240, 0.7), transparent 100%);
  background-repeat: repeat;
  background-size: 240px 200px;
  opacity: 0.5;
}

.cs-half.top {
  top: 0;
  height: 50%;
  box-shadow: inset 0 -18px 30px -24px rgba(245, 208, 254, 0.5);
  animation: cs-shear-top 7.1s cubic-bezier(0.34, 1.2, 0.42, 1) both;
}

.cs-half.bottom {
  bottom: 0;
  height: 50%;
  box-shadow: inset 0 18px 30px -24px rgba(103, 232, 249, 0.4);
  animation: cs-shear-bottom 7.1s cubic-bezier(0.34, 1.2, 0.42, 1) both;
}

.cs-badge {
  position: absolute;
  left: 50%;
  bottom: 11%;
  color: #fae8ff;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(240, 171, 252, 0.65);
  transform: translateX(-50%);
  animation: cs-badge 7.1s ease both;
}

.cs-badge strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.cs-badge small {
  color: rgba(250, 232, 255, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
}

.cs-caption {
  position: absolute;
  left: 50%;
  top: 22%;
  color: #fdf4ff;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 22px rgba(240, 171, 252, 0.8);
  transform: translateX(-50%);
  animation: cs-caption 7.1s ease both;
}

.cs-caption strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 19px;
  letter-spacing: 0.3em;
}

.cs-caption small {
  color: rgba(103, 232, 249, 0.85);
  font-size: 11px;
  letter-spacing: 0.3em;
}

@keyframes cs-shear-top {
  0%, 59% { transform: translateX(0); }
  74% { transform: translateX(-14px); }
  87%, 100% { transform: translateX(-16px); }
}

@keyframes cs-shear-bottom {
  0%, 59% { transform: translateX(0); }
  74% { transform: translateX(14px); }
  87%, 100% { transform: translateX(16px); }
}

@keyframes cs-badge {
  0%, 26% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  32%, 76% { opacity: 1; transform: translateX(-50%) translateY(0); }
  83%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes cs-caption {
  0%, 88% { opacity: 0; transform: translateX(-50%) scale(0.94); }
  92%, 98% { opacity: 1; transform: translateX(-50%) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.01); }
}

@keyframes cs-camera {
  0% { transform: translateX(1.6%) scale(1.05); }
  22% { transform: translateX(-0.6%) scale(1.01); }
  46% { transform: translateX(0.4%) scale(1.02); }
  60% { transform: translateX(-0.5%) scale(1.045); }
  74% { transform: translateX(0.5%) scale(1.03); }
  88% { transform: translateX(0) scale(1.04); }
  100% { transform: translateX(0) scale(1.06); opacity: 0; }
}
</style>
