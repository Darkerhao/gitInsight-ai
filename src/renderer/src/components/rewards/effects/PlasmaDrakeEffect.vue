<script setup lang="ts">
import { Wind } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 等离子天龙 · PLASMA DRAKE（创世级 666）
 * 幕一 0-850ms    星海漩涡聚集 → 龙首破面跃出拖起水光
 * 幕二 850-6550ms 龙躯正弦长波绕场三匝逐匝抬高，鳞光沿脊线流动；
 *                 2.76s / 4.58s 摆尾甩出青粉极光帘；3.6s 龙吟全场光压低伏一拍
 * 幕三 6550-7600ms 昂首冲天化作星座连线 DRAKE ASCENDED，鳞光散作星雨
 */
const BREACH_AT = 780;
const FLIGHT_FROM = 850;
const FLIGHT_TO = 6550;
const ROAR_AT = 3600;
const TAU = Math.PI * 2;
const SCALE_COLORS = ['#67e8f9', '#a5f3fc', '#22d3ee', '#f0abfc', '#e0f2fe'] as const;

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const undPhase = api.range(0, TAU);

  // ---------- 龙躯路径：正弦长波 + 绕场三匝、每匝抬高 ----------
  const flightPos = (tMs: number) => {
    const u = Math.min(1, Math.max(0, (tMs - FLIGHT_FROM) / (FLIGHT_TO - FLIGHT_FROM)));
    const theta = Math.PI / 2 - u * Math.PI * 6; // 三整匝
    const swim = Math.sin(theta * 3 + undPhase) * H * 0.05 * Math.min(1, u * 5);
    return {
      x: cx + Math.cos(theta) * W * 0.36,
      y: H * (0.56 - 0.23 * u) + Math.sin(theta) * H * (0.17 - 0.05 * u) + swim,
    };
  };
  const headAt = (tMs: number) => {
    if (tMs <= FLIGHT_TO) return flightPos(tMs);
    const k = Math.min(1, (tMs - FLIGHT_TO) / 520) ** 2; // 昂首加速冲天
    const p0 = flightPos(FLIGHT_TO);
    return { x: p0.x + (cx + W * 0.05 - p0.x) * k, y: p0.y + (-90 - p0.y) * k };
  };
  const seaPt = flightPos(FLIGHT_FROM); // 破面点（星海海面）

  // ---------- 远景星野 ----------
  for (let i = 0; i < 56; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * H,
      shape: 'dot', size: api.range(0.7, 1.8), maxLife: 7.4,
      color: api.rng() > 0.75 ? '#67e8f9' : '#e2e8f0', glow: 0.7,
      opacity: api.range(0.25, 0.7), twinkle: api.range(0.4, 1.4), fadeIn: 0.05, fadeOut: 0.1,
    });
  }

  // ---------- 幕一：星海漩涡聚集（透视椭圆涡旋吸入） ----------
  api.every(11, () => {
    let r = api.range(70, 250);
    let a = api.range(0, TAU);
    api.spawn({
      x: seaPt.x + Math.cos(a) * r * 1.2, y: seaPt.y + Math.sin(a) * r * 0.4,
      shape: 'spark', size: api.range(1.2, 2.4), maxLife: 0.9,
      color: api.pick(SCALE_COLORS), glow: 1.1, fadeIn: 0.1, fadeOut: 0.2,
      update: (p, dt) => {
        a += (3.2 + (250 - r) * 0.014) * dt;
        r -= (r * 2.4 + 46) * dt;
        if (r < 8) p.life = p.maxLife;
        p.x = seaPt.x + Math.cos(a) * r * 1.2;
        p.y = seaPt.y + Math.sin(a) * r * 0.4;
      },
    });
  }, { until: 750 });

  // 海面涟漪：破面前收束一环，破面后三环扩散
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > 1900) return;
    ctx.translate(seaPt.x, seaPt.y);
    ctx.scale(1, 0.36);
    ctx.lineWidth = 1.6;
    if (tMs < BREACH_AT) {
      const k = tMs / BREACH_AT;
      ctx.strokeStyle = `rgba(103, 232, 249, ${0.32 * k})`;
      ctx.beginPath();
      ctx.arc(0, 0, 240 - k * 196, 0, TAU);
      ctx.stroke();
    } else {
      for (const d of [0, 260, 520]) {
        const age = (tMs - BREACH_AT - d) / 820;
        if (age <= 0 || age >= 1) continue;
        ctx.strokeStyle = `rgba(103, 232, 249, ${0.4 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(0, 0, 26 + age * 230, 0, TAU);
        ctx.stroke();
      }
    }
  });

  // 龙首破面：白闪 + 水光飞溅（升空后被重力拉回）
  api.at(BREACH_AT, () => {
    api.spawn({ x: seaPt.x, y: seaPt.y, shape: 'dot', size: 12, endSize: 130, maxLife: 0.42, color: '#f0fdff', glow: 2.2, fadeOut: 0.85 });
    api.burst({
      x: seaPt.x, y: seaPt.y, count: 46, speed: [170, 460],
      angle: [-Math.PI * 0.82, -Math.PI * 0.18],
      base: { shape: 'streak', stretch: 0.06, size: 1.9, maxLife: 1.1, ay: 380, drag: 0.6, glow: 1, fadeOut: 0.35 },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#a5f3fc' : rng() > 0.4 ? '#e0f2fe' : '#f0abfc';
        p.maxLife = 0.7 + rng() * 0.7;
      },
    });
  });

  // ---------- 幕二：路径点数组维护 + 脊线光带 + 龙首辉光 ----------
  const trail: Array<{ x: number; y: number }> = [];
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < FLIGHT_FROM - 50) return;
    if (tMs < 7080) {
      const head = headAt(tMs);
      trail.push({ x: head.x, y: head.y });
      if (trail.length > 110) trail.shift();
    }
    let alpha = Math.min(1, (tMs - FLIGHT_FROM + 50) / 380);
    if (tMs > FLIGHT_TO) alpha *= Math.max(0, 1 - (tMs - FLIGHT_TO) / 430);
    const n = trail.length;
    if (alpha <= 0.01 || n < 4) return;

    // 龙躯：尾粉 → 首青的渐变光带，向首端加粗
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i += 1) {
      const f = i / (n - 1);
      const r = Math.round(240 - f * 206);
      const g = Math.round(171 + f * 40);
      const b = Math.round(252 - f * 14);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(0.08 + f * 0.3) * alpha})`;
      ctx.lineWidth = 1.4 + f * f * 12;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    // 白热脊芯（靠近龙首的 40%）
    for (let i = Math.max(1, Math.floor(n * 0.6)); i < n; i += 1) {
      const f = i / (n - 1);
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, f - 0.58) * 0.9 * alpha})`;
      ctx.lineWidth = 1 + f * 2.6;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    // 龙首辉光 + 双角
    const head = trail[n - 1];
    const prev = trail[Math.max(0, n - 4)];
    const heading = Math.atan2(head.y - prev.y, head.x - prev.x);
    const grad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 34);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * alpha})`);
    grad.addColorStop(0.32, `rgba(103, 232, 249, ${0.5 * alpha})`);
    grad.addColorStop(1, 'rgba(103, 232, 249, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 34, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(240, 171, 252, ${0.8 * alpha})`;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      const ha = heading + Math.PI + side * 0.55;
      ctx.beginPath();
      ctx.moveTo(head.x + Math.cos(ha) * 6, head.y + Math.sin(ha) * 6);
      ctx.lineTo(head.x + Math.cos(ha) * 20, head.y + Math.sin(ha) * 20 - 4);
      ctx.stroke();
    }
  });

  // 鳞光粒子沿路径流动
  api.every(26, () => {
    if (trail.length < 8) return;
    const idx = Math.floor(api.range(0, trail.length - 3));
    const p0 = trail[idx];
    const p1 = trail[Math.min(trail.length - 1, idx + 2)];
    let tx = p1.x - p0.x;
    let ty = p1.y - p0.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const drift = api.range(30, 90);
    api.spawn({
      x: p0.x + api.range(-6, 6), y: p0.y + api.range(-6, 6),
      vx: tx * drift - ty * api.range(-16, 16), vy: ty * drift + tx * api.range(-16, 16),
      shape: 'spark', size: api.range(1.2, 2.6), maxLife: api.range(0.6, 1.1),
      color: api.pick(SCALE_COLORS), glow: 1.2, drag: 0.5,
      twinkle: api.rng() > 0.7 ? api.range(2, 5) : 0, fadeOut: 0.4,
    });
  }, { from: 950, until: 6480 });

  // 摆尾甩出青粉极光帘（垂直 streak 幕，踩在换匝节拍上）
  for (const curtainAt of [2760, 4580]) {
    api.at(curtainAt, () => {
      if (trail.length < 30) return;
      const tail = trail[0];
      for (let i = 0; i < 42; i += 1) {
        api.spawn({
          x: tail.x + (i - 21) * 9 + api.range(-4, 4), y: tail.y - api.range(30, 70),
          vy: api.range(85, 150), vx: api.range(-8, 8),
          shape: 'streak', stretch: api.range(0.7, 1.1), size: api.range(1.6, 2.6),
          maxLife: api.range(1.2, 1.8), color: i % 2 === 0 ? '#67e8f9' : '#f0abfc',
          glow: 0.9, opacity: 0.55, ay: -12, drag: 0.9,
          twinkle: api.range(0.8, 1.6), fadeIn: 0.14, fadeOut: 0.42,
        });
      }
    });
  }

  // 龙吟：双环声浪 + 鳞光激荡（全场光压低伏由 DOM 罩层同步演出）
  [0, 140].forEach((d, i) => {
    api.at(ROAR_AT + d, () => {
      const head = headAt(ROAR_AT + d);
      api.spawn({
        x: head.x, y: head.y, shape: 'ring', size: 20,
        endSize: Math.max(W, H) * (0.4 + i * 0.22), maxLife: 0.9,
        color: i === 0 ? '#a5f3fc' : '#f0abfc', opacity: 0.7, fadeOut: 0.7,
      });
    });
  });
  api.at(ROAR_AT, () => {
    const head = headAt(ROAR_AT);
    api.burst({
      x: head.x, y: head.y, count: 44, speed: [120, 380],
      base: { shape: 'spark', size: 2, maxLife: 0.9, glow: 1.2, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => { p.color = rng() > 0.5 ? '#67e8f9' : '#e0f2fe'; },
    });
  });

  // ---------- 幕三：昂首冲天 → 星座连线定格 + 星雨 ----------
  const constellation: Array<{ x: number; y: number }> = [];
  api.at(FLIGHT_TO + 60, () => {
    const n = trail.length;
    if (n < 12) return;
    for (let i = 0; i < 12; i += 1) {
      const p = trail[Math.floor((i / 11) * (n - 1))];
      const pt = { x: p.x + api.range(-6, 6), y: p.y - H * 0.05 + api.range(-6, 6) };
      constellation.push(pt);
      api.spawn({
        x: pt.x, y: pt.y, shape: 'dot', size: i >= 10 ? 3.4 : 2.4,
        maxLife: (api.duration - FLIGHT_TO - 60) / 1000,
        color: i % 3 === 0 ? '#f0abfc' : '#e0f2fe', glow: 1.6,
        twinkle: api.range(1.4, 2.6), fadeIn: 0.12, fadeOut: 0.22,
      });
    }
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 6680 || constellation.length < 12) return;
    const reveal = Math.min(1, (tMs - 6680) / 460);
    const fade = Math.min(1, Math.max(0, (7580 - tMs) / 300));
    const alpha = reveal * fade;
    if (alpha <= 0.01) return;
    ctx.strokeStyle = `rgba(224, 242, 254, ${0.65 * alpha})`;
    ctx.lineWidth = 1.1;
    const segs = constellation.length - 1;
    for (let i = 0; i < segs; i += 1) {
      if (i / segs > reveal) break;
      ctx.beginPath();
      ctx.moveTo(constellation[i].x, constellation[i].y);
      ctx.lineTo(constellation[i + 1].x, constellation[i + 1].y);
      ctx.stroke();
    }
  });
  // 冲天光尾
  api.at(FLIGHT_TO + 120, () => {
    api.burst({
      x: cx + W * 0.05, y: H * 0.2, count: 30, speed: [200, 520],
      angle: [-Math.PI * 0.62, -Math.PI * 0.38],
      base: { shape: 'streak', stretch: 0.08, size: 2, maxLife: 0.6, color: '#a5f3fc', glow: 1.2, fadeOut: 0.4 },
    });
  });
  // 鳞光散作星雨
  api.at(6720, () => {
    for (let i = 0; i < 108; i += 1) {
      api.spawn({
        x: api.rng() * W, y: api.range(-40, H * 0.4),
        vy: api.range(60, 170), vx: api.range(-14, 14),
        shape: 'spark', size: api.range(1, 2.2), maxLife: api.range(0.7, 1.1),
        color: api.pick(SCALE_COLORS), glow: 1, ay: 60,
        twinkle: api.range(1.5, 3.5), fadeIn: 0.1, fadeOut: 0.4,
      });
    }
  });
};
</script>

<template>
  <div class="plasma-drake-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.plasmaDrake" :scene="scene" />
    <div class="drake-hush" />
    <div class="drake-badge">
      <Wind :size="40" />
      <strong>等离子天龙</strong>
      <small>PLASMA DRAKE · PROTOCOL 666</small>
    </div>
    <div class="drake-caption">
      <strong>DRAKE ASCENDED</strong>
      <small>龙升星穹 · 鳞光归雨</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.plasma-drake-effect {
  @include effect-stage(hidden);
  animation: drake-camera 7.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

// 龙吟节拍：全场光压低伏一拍
.drake-hush {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 42%, rgba(2, 6, 23, 0.5), rgba(2, 6, 23, 0.92));
  opacity: 0;
  pointer-events: none;
  animation: drake-hush 7.6s linear both;
}

.drake-badge {
  position: absolute;
  left: 50%;
  bottom: 11%;
  color: #cffafe;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(34, 211, 238, 0.65);
  transform: translateX(-50%);
  animation: drake-badge 7.6s ease both;
}

.drake-badge strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.drake-badge small {
  color: rgba(207, 250, 254, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
}

.drake-caption {
  position: absolute;
  left: 50%;
  top: 23%;
  color: #f0fdff;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 22px rgba(103, 232, 249, 0.8);
  transform: translateX(-50%);
  animation: drake-caption 7.6s ease both;
}

.drake-caption strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 20px;
  letter-spacing: 0.3em;
}

.drake-caption small {
  color: rgba(240, 171, 252, 0.85);
  font-size: 11px;
  letter-spacing: 0.3em;
}

@keyframes drake-hush {
  0%, 45.5% { opacity: 0; }
  48% { opacity: 0.55; }
  50.5% { opacity: 0.4; }
  55%, 100% { opacity: 0; }
}

@keyframes drake-badge {
  0%, 30% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  36%, 78% { opacity: 1; transform: translateX(-50%) translateY(0); }
  84%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes drake-caption {
  0%, 87% { opacity: 0; transform: translateX(-50%) scale(0.92); }
  91%, 97% { opacity: 1; transform: translateX(-50%) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.02); }
}

@keyframes drake-camera {
  0% { transform: translateX(-1.4%) scale(1.06); }
  24% { transform: translateX(1%) scale(1.02); }
  48% { transform: translateX(-0.8%) scale(1.04); }
  70% { transform: translateX(0.6%) scale(1.02); }
  86% { transform: translateX(0) scale(1.05); }
  100% { transform: translateX(0) scale(1.08); opacity: 0; }
}
</style>
