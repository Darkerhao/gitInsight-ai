<script setup lang="ts">
import { Sunrise } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { Particle, SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const TAU = Math.PI * 2;
/** 暴涨起爆时刻（entry 900ms 奇点蓄势 → 2.25s 撕开虚无） */
const BANG_AT = 2250;
/** 引力开始收拢星尘的时刻 */
const GRAVITY_AT = 3400;

/** 三波次原初粒子：色温从白热 → 金 → 紫逐波冷却 */
const PRIMORDIAL_WAVES = [
  { at: BANG_AT + 30, count: 148, speed: [380, 940] as [number, number], colors: ['#fff7ed', '#fffbeb', '#fef3c7'], streak: true, life: [0.7, 1.3] as [number, number] },
  { at: BANG_AT + 310, count: 128, speed: [240, 680] as [number, number], colors: ['#fde68a', '#fbbf24', '#f59e0b'], streak: false, life: [2.2, 4] as [number, number] },
  { at: BANG_AT + 610, count: 108, speed: [170, 520] as [number, number], colors: ['#c4b5fd', '#a78bfa', '#8b5cf6'], streak: false, life: [2.4, 4.2] as [number, number] },
];

const scene: SceneFn = (api) => {
  api.setTrail(0.28);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const maxR = Math.max(api.width, api.height);
  let now = 0;
  api.onFrame((tMs) => {
    now = tMs;
  });

  // 新生星系群：位置 / 倾角 / 旋向 / 尺度（seed 可复现）
  const galaxies = Array.from({ length: 3 }, (_, i) => {
    const baseAngle = (i / 3) * TAU + api.range(-0.5, 0.5);
    return {
      x: cx + Math.cos(baseAngle) * api.range(0.17, 0.29) * api.width,
      y: cy + Math.sin(baseAngle) * api.range(0.15, 0.25) * api.height,
      tilt: api.range(0.52, 0.82),
      dir: api.rng() > 0.5 ? 1 : -1,
      size: api.range(58, 92),
      phase: api.range(0, TAU),
    };
  });
  const nearestGalaxy = (x: number, y: number) => {
    let best = galaxies[0];
    let bestD = Infinity;
    for (const g of galaxies) {
      const d = (g.x - x) ** 2 + (g.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  };
  /** 星尘引力收拢：向心加速 + 切向速度，绕最近星系成盘 */
  const gravitate = (p: Particle, dt: number) => {
    if (now < GRAVITY_AT) return;
    const g = nearestGalaxy(p.x, p.y);
    const dx = g.x - p.x;
    const dy = g.y - p.y;
    const dist = Math.hypot(dx, dy) + 6;
    const pull = Math.min(300, 5200 / Math.sqrt(dist));
    p.vx += ((dx / dist) * pull + (-dy / dist) * g.dir * 46) * dt;
    p.vy += ((dy / dist) * pull + (dx / dist) * g.dir * 46) * dt;
  };

  // 太初深空：极暗远景星野
  for (let i = 0; i < 54; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot',
      size: api.range(0.6, 1.5),
      maxLife: 7.3,
      color: api.rng() > 0.72 ? '#c4b5fd' : '#e2e8f0',
      glow: 0.6,
      opacity: api.range(0.14, 0.32),
      twinkle: api.range(0.4, 1.2),
      fadeIn: 0.08,
      fadeOut: 0.1,
    });
  }

  // ── 幕一 · 奇点呼吸蓄势（0-2.05s）────────────────────────────
  api.spawn({
    x: cx,
    y: cy,
    shape: 'dot',
    size: 4.5,
    maxLife: 2.05,
    color: '#fde68a',
    glow: 2.2,
    fadeIn: 0.1,
    fadeOut: 0.05,
    update: (p) => {
      const beat = Math.sin(p.life * 4.6);
      p.size = 4 + beat * beat * 3.2 + p.life * 3.6;
      p.endSize = p.size;
    },
  });
  // 心跳三拍：金色脉环逐拍增幅
  [430, 1050, 1670].forEach((t, i) => {
    api.at(t, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 10, endSize: 54 + i * 26, maxLife: 0.5,
        color: '#fde68a', opacity: 0.7, fadeOut: 0.55,
      });
    });
  });
  // 引力涟漪逐圈向内收拢
  api.every(560, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: api.range(220, 300), endSize: 10, maxLife: 0.72,
      color: '#a78bfa', opacity: 0.42, fadeIn: 0.22, fadeOut: 0.3,
    });
  }, { from: 180, until: 1900 });
  // 虚无被吸入：向心光缕
  api.every(22, () => {
    const angle = api.range(0, TAU);
    const radius = api.range(170, maxR * 0.55);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * (radius * 1.35 + 70),
      vy: -Math.sin(angle) * (radius * 1.35 + 70),
      shape: 'streak',
      stretch: 0.055,
      size: 1.5,
      maxLife: 0.52,
      color: api.pick(['#fde68a', '#c4b5fd', '#e2e8f0']),
      glow: 0.85,
      fadeIn: 0.16,
      fadeOut: 0.24,
    });
  }, { until: 1980 });

  // 临界坍缩：收缩白闪 + 一拍静默（2.05-2.25s 无任何新粒子）
  api.at(2050, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 46, endSize: 3, maxLife: 0.2,
      color: '#f8fafc', opacity: 0.95, fadeOut: 0.4,
    });
  });

  // ── 幕二 · 暴涨（2.25s）：白金激波撕开虚无──────────────────
  api.at(BANG_AT, () => {
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 16, endSize: maxR * 0.72, maxLife: 0.85,
      color: '#fffbeb', glow: 2.4, fadeOut: 0.88,
    });
  });
  [0, 150, 330].forEach((delay, i) => {
    api.at(BANG_AT + delay, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 22,
        endSize: maxR * (0.42 + i * 0.24), maxLife: 0.95,
        color: ['#fffbeb', '#fde68a', '#a78bfa'][i], opacity: 0.85, fadeOut: 0.7,
      });
    });
  });
  PRIMORDIAL_WAVES.forEach((wave, w) => {
    api.at(wave.at, () => {
      api.burst({
        x: cx,
        y: cy,
        count: wave.count,
        speed: wave.speed,
        base: {
          shape: wave.streak ? 'streak' : 'spark',
          stretch: 0.075,
          size: 2.6 - w * 0.5,
          glow: 1.15,
          drag: 0.42,
          fadeOut: 0.42,
        },
        vary: (p, rng) => {
          p.color = wave.colors[Math.floor(rng() * wave.colors.length)];
          p.maxLife = wave.life[0] + rng() * (wave.life[1] - wave.life[0]);
          if (rng() > 0.8) p.twinkle = 2.5 + rng() * 4;
          if (w > 0) p.update = gravitate; // 金/紫两波余烬被后续引力接管
        },
      });
    });
  });

  // ── 幕三 · 星尘受向心引力聚成旋臂星系群（3.3s 起）──────────
  api.every(14, () => {
    const g = api.pick(galaxies);
    const arm = api.rng() > 0.5 ? 0 : Math.PI;
    let radius = api.range(14, g.size * 2.1);
    let angle = arm + radius * 0.042 * g.dir + api.range(-0.55, 0.55) + g.phase;
    api.spawn({
      x: g.x + Math.cos(angle) * radius,
      y: g.y + Math.sin(angle) * radius * g.tilt,
      shape: api.rng() > 0.86 ? 'spark' : 'dot',
      size: api.range(0.8, 2.3),
      maxLife: api.range(1.8, 2.7),
      color: api.pick(['#fde68a', '#fbbf24', '#c4b5fd', '#e2e8f0', '#f8fafc']),
      glow: 0.9,
      twinkle: api.range(0, 2.4),
      fadeIn: 0.18,
      fadeOut: 0.34,
      update: (p, dt) => {
        // 缓旋定格：角速度随时间衰减
        const calm = Math.max(0.22, 1 - Math.max(0, now - GRAVITY_AT) / 3400);
        angle += g.dir * (34 / (radius + 26)) * 2.1 * calm * dt;
        radius = Math.max(6, radius - radius * 0.06 * dt);
        p.x = g.x + Math.cos(angle) * radius;
        p.y = g.y + Math.sin(angle) * radius * g.tilt;
      },
    });
  }, { from: 3300, until: 5300 });

  // 星系核心辉光
  api.at(3500, () => {
    for (const g of galaxies) {
      api.spawn({
        x: g.x, y: g.y, shape: 'dot', size: 7, maxLife: 3.3, color: '#fef3c7', glow: 2,
        fadeIn: 0.2, fadeOut: 0.3,
        update: (p) => {
          p.size = 7 + Math.sin(p.life * 2.4 + g.phase) * 1.6;
          p.endSize = p.size;
        },
      });
    }
  });

  // 旋臂弧线：对数螺旋逐渐显影，转速衰减至定格
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 3600) return;
    const alpha = Math.min(1, (tMs - 3600) / 900) * (tMs > 6600 ? Math.max(0, 1 - (tMs - 6600) / 640) : 1);
    if (alpha <= 0.01) return;
    const spin = 1.15 * (1 - Math.exp(-(tMs - 3600) / 2100));
    for (const g of galaxies) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(1, g.tilt);
      for (let arm = 0; arm < 2; arm += 1) {
        ctx.save();
        ctx.rotate(arm * Math.PI + g.phase + spin * g.dir);
        ctx.strokeStyle = arm === 0
          ? `rgba(253, 230, 138, ${0.18 * alpha})`
          : `rgba(196, 181, 253, ${0.16 * alpha})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let s = 0; s <= 30; s += 1) {
          const th = s * 0.15;
          const r = g.size * 0.12 * Math.exp(0.5 * th);
          const px = Math.cos(th * g.dir) * r;
          const py = Math.sin(th * g.dir) * r;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  });

  // 旋臂上第一代恒星点火
  api.every(120, () => {
    const g = api.pick(galaxies);
    const th = api.range(0.6, 4.4);
    const r = g.size * 0.12 * Math.exp(0.5 * th);
    const rot = api.pick([0, Math.PI]) + g.phase;
    api.spawn({
      x: g.x + Math.cos(th * g.dir + rot) * r,
      y: g.y + Math.sin(th * g.dir + rot) * r * g.tilt,
      shape: 'spark',
      size: api.range(1.2, 2.4),
      maxLife: 0.9,
      color: '#fffbeb',
      glow: 1.4,
      fadeOut: 0.6,
    });
  }, { from: 3900, until: 6050 });

  // ── 退场 · 宇宙微波余晖 FIRST LIGHT ─────────────────────────
  api.at(6400, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 80, endSize: maxR * 1.05, maxLife: 1,
      color: '#fde68a', opacity: 0.3, fadeOut: 0.8,
    });
  });
  api.at(6650, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 60, endSize: maxR * 0.8, maxLife: 0.9,
      color: '#a78bfa', opacity: 0.24, fadeOut: 0.8,
    });
  });
};
</script>

<template>
  <div class="genesis-bang-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.genesisBang" :scene="scene" />
    <div class="gb-flash"></div>
    <div class="gb-hud">SINGULARITY PRIMED · INFLATION IN 3 BEATS</div>
    <div class="gb-badge">
      <Sunrise :size="44" />
      <strong>创世纪元</strong>
      <small>GENESIS DAWN · FIRST LIGHT +380KYR</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.genesis-bang-effect {
  @include effect-stage(hidden);
}

.gb-flash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 251, 235, 0.95), rgba(253, 230, 138, 0.45) 36%, rgba(167, 139, 250, 0.18) 62%, transparent 78%);
  opacity: 0;
  pointer-events: none;
  animation: gb-flash 7.4s linear both;
}

.gb-hud {
  position: absolute;
  top: 8%;
  left: 50%;
  color: rgba(253, 230, 138, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: gb-hud 7.4s ease both;
}

.gb-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #fef3c7;
  text-shadow: 0 0 20px rgba(253, 230, 138, 0.6);
  transform: translateX(-50%);
  animation: gb-badge 7.4s ease both;
}

.gb-badge strong {
  font-size: 18px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
}

.gb-badge small {
  color: rgba(196, 181, 253, 0.82);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

@keyframes gb-flash {
  0%, 29.4% { opacity: 0; }
  31.4% { opacity: 0.8; }
  34.5% { opacity: 0.24; }
  39%, 100% { opacity: 0; }
}

@keyframes gb-hud {
  0%, 4% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  8% { opacity: 1; transform: translateX(-50%) translateY(0); }
  12% { opacity: 0.35; }
  16%, 24% { opacity: 1; }
  28%, 100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
}

@keyframes gb-badge {
  0%, 56% { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.94); }
  63%, 88% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  95%, 100% { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(1.02); }
}
</style>
