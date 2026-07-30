<script setup lang="ts">
import { CircleDot } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const TAU = Math.PI * 2;
/** 真真空泡成核时刻 */
const NUCLEATE_AT = 1500;
/** 泡吞没镜头（白透定格）时刻 */
const ENGULF_AT = 5800;

/** 法则文本：泡内物理常数被逐行改写 */
const LAW_ROWS = [
  { before: 'c  = 2.9979e8 m/s', after: "c' = 3.3612e8 m/s" },
  { before: 'ħ  = 1.0546e-34 J·s', after: "ħ' = 0.8871e-34 J·s" },
  { before: 'α  = 1/137.036', after: "α' = 1/128.417" },
  { before: 'G  = 6.6743e-11', after: "G' = 7.2185e-11" },
  { before: 'Λ  > 0 (de Sitter)', after: "Λ' < 0 (anti-dS)" },
];

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const w = api.width;
  const h = api.height;
  const px0 = w * 0.42;
  const py0 = h * 0.46;
  const diag = Math.hypot(w, h);
  let now = 0;
  api.onFrame((tMs) => {
    now = tMs;
  });

  const radiusAt = (tMs: number) =>
    tMs < NUCLEATE_AT ? 0 : 12 + Math.pow(Math.min(1, (tMs - NUCLEATE_AT) / 4300), 1.8) * diag * 0.82;

  // ── 旧宇宙星野：泡内的星点被改写为异色并反向漂移 ─────────────
  let conversions = 0;
  for (let i = 0; i < 126; i += 1) {
    const depth = api.rng();
    const drift = api.range(0, TAU);
    const sp = api.range(3, 10);
    const star = api.spawn({
      x: api.rng() * w,
      y: api.rng() * h,
      vx: Math.cos(drift) * sp,
      vy: Math.sin(drift) * sp,
      shape: 'dot',
      size: 0.8 + depth * 2.4,
      maxLife: 7.4,
      color: api.pick(['#f8fafc', '#e2e8f0', '#bae6fd', '#94a3b8']),
      glow: 0.5 + depth * 0.8,
      opacity: 0.35 + depth * 0.55,
      twinkle: api.range(0.3, 1.3),
      fadeIn: 0.05,
      fadeOut: 0.08,
    });
    if (!star) continue;
    let converted = false;
    star.update = (p) => {
      if (converted || now < NUCLEATE_AT) return;
      const d = Math.hypot(p.x - px0, p.y - py0);
      if (d <= radiusAt(now)) {
        // 泡界面掠过：按到中心距离切换为新物理配色 + 反向漂移
        converted = true;
        conversions += 1;
        p.color = api.pick(['#c4b5fd', '#a78bfa', '#8b5cf6', '#67e8f9']);
        p.vx = -p.vx * 1.7;
        p.vy = -p.vy * 1.7;
        p.twinkle = api.range(1.8, 3.4);
        api.spawn({
          x: p.x, y: p.y, shape: 'spark', size: 2 + depth * 2.4, maxLife: 0.3,
          color: '#f0fdfa', glow: 1.8, fadeOut: 0.6,
        });
        if (conversions % 5 === 0) {
          api.spawn({
            x: p.x, y: p.y, shape: 'ring', size: 2, endSize: 20 + depth * 16, maxLife: 0.45,
            color: '#5eead4', opacity: 0.55, fadeOut: 0.6,
          });
        }
      }
    };
  }

  // ── 幕一 · 量子涨落明灭（0-1.5s）────────────────────────────
  api.spawn({
    x: px0,
    y: py0,
    shape: 'dot',
    size: 3,
    maxLife: 1.55,
    color: '#5eead4',
    glow: 2,
    twinkle: 7,
    fadeIn: 0.1,
    fadeOut: 0.15,
    update: (p) => {
      p.size = 2.4 + Math.abs(Math.sin(p.life * 17)) * 2.8;
      p.endSize = p.size;
    },
  });
  api.every(90, () => {
    api.spawn({
      x: px0 + api.range(-26, 26),
      y: py0 + api.range(-26, 26),
      shape: 'spark',
      size: api.range(0.8, 1.8),
      maxLife: api.range(0.16, 0.34),
      color: api.pick(['#5eead4', '#f0fdfa', '#c4b5fd']),
      glow: 1.6,
      fadeOut: 0.5,
    });
  }, { from: 150, until: 1450 });

  // 泡成核：一声轻爆
  api.at(NUCLEATE_AT, () => {
    api.spawn({
      x: px0, y: py0, shape: 'dot', size: 6, endSize: 60, maxLife: 0.5,
      color: '#f0fdfa', glow: 2.2, fadeOut: 0.8,
    });
    api.spawn({
      x: px0, y: py0, shape: 'ring', size: 6, endSize: 90, maxLife: 0.6,
      color: '#5eead4', opacity: 0.8, fadeOut: 0.6,
    });
  });

  // ── 幕二 · 球面泡膨胀：色散界面圆环 + 界面波动闪段 ───────────
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < NUCLEATE_AT || tMs > 6050) return;
    const R = radiusAt(tMs);
    if (R > diag) return;
    const fade = Math.min(1, (tMs - NUCLEATE_AT) / 400) * (tMs > 5700 ? Math.max(0, (6050 - tMs) / 350) : 1);
    if (fade <= 0.01) return;
    // 色散三环：紫 / 白 / 青
    const rings: Array<[number, string, number]> = [
      [-4, `rgba(196, 181, 253, ${0.5 * fade})`, 1.6],
      [0, `rgba(240, 253, 250, ${0.85 * fade})`, 2.4],
      [4, `rgba(94, 234, 212, ${0.55 * fade})`, 1.6],
    ];
    for (const [off, color, lw] of rings) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(px0, py0, Math.max(2, R + off), 0, TAU);
      ctx.stroke();
    }
    // 界面辉光
    ctx.strokeStyle = `rgba(94, 234, 212, ${0.1 * fade})`;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(px0, py0, R, 0, TAU);
    ctx.stroke();
    // 界面波动闪段
    for (let seg = 0; seg < 10; seg += 1) {
      const a0 = (seg / 10) * TAU + tMs / 900;
      const flick = 0.5 + 0.5 * Math.sin(tMs / 90 + seg * 2.4);
      ctx.strokeStyle = `rgba(240, 253, 250, ${0.4 * fade * flick})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px0, py0, R, a0, a0 + 0.16);
      ctx.stroke();
    }
  });
  // 界面流光粒子：始终吸附在膨胀的球面上环流
  api.every(26, () => {
    let a = api.range(0, TAU);
    const flow = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: px0 + Math.cos(a) * radiusAt(now),
      y: py0 + Math.sin(a) * radiusAt(now),
      shape: 'spark',
      size: api.range(1.4, 2.6),
      maxLife: api.range(0.8, 1.3),
      color: api.pick(['#5eead4', '#c4b5fd', '#f0fdfa']),
      glow: 1.25,
      fadeIn: 0.15,
      fadeOut: 0.3,
      update: (p, dt) => {
        const R = radiusAt(now);
        a += flow * (34 / (R + 60)) * 4 * dt;
        p.x = px0 + Math.cos(a) * R;
        p.y = py0 + Math.sin(a) * R;
      },
    });
  }, { from: 1520, until: 5650 });

  // ── 幕三 · 法则文本逐行重写（2.95s 起）──────────────────────
  const rowX = w * 0.07;
  const rowY0 = h * 0.2;
  const MONO_OLD = '500 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const MONO_NEW = '600 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  LAW_ROWS.forEach((row, r) => {
    const y = rowY0 + r * 24;
    const startAt = 2950 + r * 430;
    // 旧法则整行亮起（弱青），重写头抵达即熄灭
    api.at(startAt, () => {
      for (let k = 0; k < row.before.length; k += 1) {
        const ch = row.before[k];
        if (ch === ' ') continue;
        const dieAt = startAt + 260 + k * 30;
        api.spawn({
          x: rowX + k * 8.4, y, shape: 'glyph', glyph: ch, size: 13, font: MONO_OLD,
          color: '#5eead4', opacity: 0.5, glow: 0,
          maxLife: (dieAt - startAt) / 1000, fadeIn: 0.15, fadeOut: 0.25,
        });
      }
    });
    // 重写头扫过：白闪 + 新法则字符（紫）驻留至终幕
    for (let k = 0; k < row.after.length; k += 1) {
      const ch = row.after[k];
      if (ch === ' ') continue;
      const at = startAt + 260 + k * 30;
      api.at(at, () => {
        api.spawn({
          x: rowX + k * 8.4, y, shape: 'spark', size: 2, maxLife: 0.22,
          color: '#f0fdfa', glow: 1.6, fadeOut: 0.6,
        });
        api.spawn({
          x: rowX + k * 8.4, y, shape: 'glyph', glyph: ch, size: 13, font: MONO_NEW,
          color: '#c4b5fd', opacity: 0.92, glow: 0,
          maxLife: (7050 - at) / 1000, fadeIn: 0.03, fadeOut: 0.12,
        });
      });
    }
    // 重写光标沿行推进
    api.at(startAt + 240, () => {
      let kx = 0;
      api.spawn({
        x: rowX,
        y,
        shape: 'rect',
        size: 4,
        maxLife: (row.after.length * 30 + 140) / 1000,
        color: '#f0fdfa',
        opacity: 0.9,
        glow: 0,
        fadeOut: 0.3,
        update: (p, dt) => {
          kx += dt * 280;
          p.x = rowX + Math.min(row.after.length * 8.4, kx);
        },
      });
    });
  });

  // ── 终幕 · 吞没镜头：白透一拍 → 新常数表定格 ─────────────────
  api.at(ENGULF_AT, () => {
    api.spawn({
      x: px0, y: py0, shape: 'dot', size: 100, endSize: diag * 1.2, maxLife: 0.7,
      color: '#f0fdfa', glow: 1.6, opacity: 0.8, fadeOut: 0.85,
    });
  });
  // 新宇宙余韵：紫青星尘微光
  api.every(110, () => {
    api.spawn({
      x: api.rng() * w,
      y: api.rng() * h,
      shape: 'dot',
      size: api.range(0.8, 1.8),
      maxLife: api.range(0.8, 1.3),
      color: api.pick(['#c4b5fd', '#67e8f9', '#5eead4']),
      glow: 1,
      twinkle: api.range(2, 4),
      fadeIn: 0.2,
      fadeOut: 0.4,
    });
  }, { from: ENGULF_AT + 250, until: 7050 });
};
</script>

<template>
  <div class="vacuum-decay-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.vacuumDecay" :scene="scene" />
    <div class="vd-white"></div>
    <div class="vd-hud">QUANTUM FLUCTUATION DETECTED · ΔE·Δt ≥ ħ/2</div>
    <div class="vd-badge">
      <CircleDot :size="42" />
      <strong>真空衰变</strong>
      <small>FALSE VACUUM · BUBBLE @ 1.0c</small>
    </div>
    <div class="vd-caption">CONSTANTS REWRITTEN · VACUUM STATE II</div>
  </div>
</template>

<style scoped lang="scss">
.vacuum-decay-effect {
  @include effect-stage(hidden);
}

.vd-white {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 42% 46%, rgba(240, 253, 250, 0.98), rgba(94, 234, 212, 0.5) 46%, rgba(196, 181, 253, 0.28) 70%, transparent 92%);
  opacity: 0;
  pointer-events: none;
  animation: vd-white 7.5s linear both;
}

.vd-hud {
  position: absolute;
  top: 8%;
  left: 50%;
  color: rgba(94, 234, 212, 0.82);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: vd-hud 7.5s ease both;
}

.vd-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #ccfbf1;
  text-shadow: 0 0 20px rgba(94, 234, 212, 0.6);
  transform: translateX(-50%);
  animation: vd-badge 7.5s ease both;
}

.vd-badge strong {
  font-size: 18px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
}

.vd-badge small {
  color: rgba(196, 181, 253, 0.82);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

.vd-caption {
  position: absolute;
  left: 50%;
  top: 44%;
  border: 1px solid rgba(196, 181, 253, 0.55);
  border-radius: 4px;
  background: rgba(19, 78, 74, 0.42);
  color: #ddd6fe;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.22em;
  padding: 10px 22px;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  animation: vd-caption 7.5s ease both;
}

@keyframes vd-white {
  0%, 76.4% { opacity: 0; }
  78.6% { opacity: 0.92; }
  81% { opacity: 0.2; }
  86%, 100% { opacity: 0; }
}

@keyframes vd-hud {
  0%, 3% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  6% { opacity: 1; transform: translateX(-50%) translateY(0); }
  9% { opacity: 0.35; }
  12%, 17% { opacity: 1; }
  21%, 100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
}

@keyframes vd-badge {
  0%, 46% { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.94); }
  52%, 72% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  77%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes vd-caption {
  0%, 78.5% { opacity: 0; transform: translate(-50%, -50%) scale(1.14); filter: blur(8px); }
  81.5% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
  93% { opacity: 1; }
  98%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.98); }
}
</style>
