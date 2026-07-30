<script setup lang="ts">
import { Atom } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const PARTICLE_SYMBOLS = ['μ', 'π', 'γ', 'ν', 'Ψ', 'τ', 'Ξ'];
const COLLIDE_AT = 2400;

const scene: SceneFn = (api) => {
  api.setTrail(0.18);
  const TAU = Math.PI * 2;
  const cx = api.width / 2;
  const cy = api.height / 2;
  const trackR = Math.min(api.width, api.height) * 0.36;
  const squash = 0.88; // 透视椭圆：顶部对撞顶点为近端
  const pos = (a: number) => ({ x: cx + Math.cos(a) * trackR, y: cy + Math.sin(a) * trackR * squash });
  const depth = (a: number) => 0.68 + 0.48 * (0.5 - Math.sin(a) / 2); // 顶近底远
  const vertex = pos(-Math.PI / 2);
  const cavities = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
  // 束流角程：φ(t) = 1.6t + 0.6308t³，t=2.4s 时恰为 4π（两整圈后顶点对撞）
  const phi = (tSec: number) => 1.6 * tSec + 0.6308 * tSec * tSec * tSec;

  // ── 远景：探测器剖面（同心暗环 + 辐条，纵深压暗）
  api.onFrame((tMs, _dt, ctx) => {
    const ramp = Math.min(1, tMs / 700) * Math.max(0, Math.min(1, (api.duration - 600 - tMs) / 700));
    if (ramp <= 0.02) return;
    ctx.translate(cx, cy);
    ctx.scale(1, squash);
    ctx.strokeStyle = `rgba(34, 211, 238, ${0.07 * ramp})`;
    ctx.lineWidth = 1;
    [trackR * 1.32, trackR * 1.62].forEach((r) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    });
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * trackR * 1.32, Math.sin(a) * trackR * 1.32);
      ctx.lineTo(Math.cos(a) * trackR * 1.62, Math.sin(a) * trackR * 1.62);
      ctx.stroke();
    }
  });

  // ── 幕一（entry）：双轨自顶点向两侧描画显影 + 四段加速腔依次上电
  api.onFrame((tMs, _dt, ctx) => {
    const ramp = Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 600));
    if (ramp <= 0.02) return;
    const reveal = Math.min(1, tMs / 560);
    const surge = tMs > COLLIDE_AT ? Math.exp(-(tMs - COLLIDE_AT) / 200) : 0;
    ctx.translate(cx, cy);
    ctx.scale(1, squash);
    [trackR - 7, trackR + 7].forEach((r) => {
      ctx.strokeStyle = `rgba(45, 212, 191, ${(0.28 + surge * 0.55) * ramp})`;
      ctx.lineWidth = 1.4 + surge * 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2 - reveal * Math.PI, -Math.PI / 2 + reveal * Math.PI);
      ctx.stroke();
    });
    cavities.forEach((a, i) => {
      const boot = Math.min(1, Math.max(0, (tMs - 200 - i * 140) / 220));
      if (boot <= 0) return;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(tMs / 240 + i));
      ctx.strokeStyle = `rgba(94, 234, 212, ${(0.55 * pulse * boot + surge * 0.4) * ramp})`;
      ctx.lineWidth = 8 * boot;
      ctx.beginPath();
      ctx.arc(0, 0, trackR, a - 0.07, a + 0.07);
      ctx.stroke();
    });
  });
  cavities.forEach((a, i) => {
    api.at(200 + i * 140, () => {
      const p = pos(a);
      api.spawn({ x: p.x, y: p.y, shape: 'dot', size: 9, endSize: 2, maxLife: 0.34, color: '#ccfbf1', glow: 1.8 });
      api.spawn({ x: p.x, y: p.y, shape: 'ring', size: 4, endSize: 34, maxLife: 0.4, color: '#5eead4', opacity: 0.7, fadeOut: 0.5 });
    });
  });

  // ── 幕二：双束反向逐圈加速（近大远小 + 速度渐亮 + 高速段拖影）
  api.every(16, (index) => {
    const tSec = (index * 16) / 1000;
    const progress = Math.min(1, (index * 16) / COLLIDE_AT);
    const angleGain = phi(tSec);
    [1, -1].forEach((dir) => {
      const a = -Math.PI / 2 + dir * angleGain;
      const p = pos(a);
      const d = depth(a);
      api.spawn({
        x: p.x, y: p.y,
        shape: 'spark',
        size: (1.7 + progress * 1.9) * d,
        maxLife: 0.42,
        color: dir > 0 ? '#67e8f9' : '#5eead4',
        glow: (0.9 + progress * 0.9) * d,
        opacity: Math.min(1, 0.6 + d * 0.4),
        fadeIn: 0.05,
        fadeOut: 0.5,
      });
      if (progress > 0.35) {
        const speed = (1.6 + 1.9 * progress * progress) * trackR;
        api.spawn({
          x: p.x, y: p.y,
          vx: -Math.sin(a) * speed * dir * 0.06,
          vy: Math.cos(a) * speed * dir * 0.06 * squash,
          shape: 'streak', stretch: 0.16, size: 1.4 * d, maxLife: 0.22,
          color: dir > 0 ? 'rgba(103, 232, 249, 0.7)' : 'rgba(94, 234, 212, 0.7)',
          glow: 0.5, fadeOut: 0.6,
        });
      }
      // 加速腔踢束：束流掠过腔体瞬间迸出射频火花
      cavities.forEach((ca) => {
        const dist = Math.abs(((a - ca) % TAU + TAU) % TAU);
        if (Math.min(dist, TAU - dist) < 0.055 && api.rng() < 0.5) {
          api.spawn({ x: p.x, y: p.y, shape: 'dot', size: 5, endSize: 1, maxLife: 0.24, color: '#f0fdfa', glow: 1.6 });
        }
      });
    });
  }, { until: COLLIDE_AT - 30 });

  // ── 幕三：顶点对撞 —— 白热闪心 + 双重冲击环 + 锥形喷注 + 磁偏转螺旋径迹
  api.at(COLLIDE_AT, () => {
    api.spawn({ x: vertex.x, y: vertex.y, shape: 'dot', size: 16, endSize: 300, maxLife: 0.6, color: '#f0fdfa', glow: 2.6, fadeOut: 0.9 });
    api.spawn({ x: vertex.x, y: vertex.y, shape: 'ring', size: 18, endSize: 320, maxLife: 0.8, color: '#5eead4', opacity: 0.9, fadeOut: 0.7 });
    for (let jet = 0; jet < 6; jet += 1) {
      const jetAngle = (jet / 6) * TAU + api.range(-0.2, 0.2);
      api.burst({
        x: vertex.x, y: vertex.y, count: 22, speed: [180, 580],
        angle: [jetAngle - 0.13, jetAngle + 0.13],
        base: { shape: 'streak', stretch: 0.08, size: 1.8, maxLife: 1.1, glow: 1, drag: 0.5, fadeOut: 0.4 },
        vary: (p, rng) => {
          p.color = rng() < 0.44 ? '#67e8f9' : rng() < 0.7 ? '#5eead4' : rng() < 0.9 ? '#f0fdfa' : '#fbbf24';
          p.maxLife = 0.7 + rng() * 0.7;
        },
      });
    }
    // 云室径迹：磁场持续旋转速度方向 → 螺旋
    api.burst({
      x: vertex.x, y: vertex.y, count: 26, speed: [60, 200],
      base: { shape: 'spark', size: 1.8, maxLife: 2, glow: 1, fadeOut: 0.3 },
      vary: (p, rng) => {
        const omega = (rng() > 0.5 ? 1 : -1) * (1.6 + rng() * 4.2);
        p.color = rng() > 0.5 ? '#99f6e4' : '#a5f3fc';
        p.update = (pt, dt) => {
          const cos = Math.cos(omega * dt);
          const sin = Math.sin(omega * dt);
          const vx = pt.vx * cos - pt.vy * sin;
          pt.vy = pt.vx * sin + pt.vy * cos;
          pt.vx = vx;
        };
      },
    });
    // 顶点残辉
    api.spawn({ x: vertex.x, y: vertex.y, shape: 'dot', size: 10, endSize: 4, maxLife: 1.3, color: '#ccfbf1', glow: 1.6, fadeOut: 0.6 });
  });
  api.at(COLLIDE_AT + 140, () => {
    api.spawn({ x: vertex.x, y: vertex.y, shape: 'ring', size: 40, endSize: 430, maxLife: 1.05, color: '#22d3ee', opacity: 0.45, fadeOut: 0.8 });
  });
  // 二次噼啪：喷注余波在顶点附近连锁炸裂
  [260, 560].forEach((delay) => {
    api.at(COLLIDE_AT + delay, () => {
      api.burst({
        x: vertex.x + api.range(-46, 46), y: vertex.y + api.range(-30, 36),
        count: 10, speed: [60, 240],
        base: { shape: 'spark', size: 1.5, maxLife: 0.5, color: '#99f6e4', glow: 1.3, drag: 0.3, twinkle: 11, fadeOut: 0.5 },
      });
    });
  });

  // 能级弧线：对撞后自顶点外扩的驻留弧，缓慢消散
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < COLLIDE_AT + 200) return;
    const age = (tMs - COLLIDE_AT - 200) / 1000;
    const fade = Math.max(0, 1 - age / 2.7);
    if (fade <= 0.02) return;
    for (let i = 0; i < 3; i += 1) {
      const r = 60 + i * 34 + age * 26;
      ctx.strokeStyle = `rgba(94, 234, 212, ${(0.2 - i * 0.05) * fade})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(vertex.x, vertex.y, r, Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();
    }
  });

  // ── 余韵（exit）：发现的粒子符号发光漂浮 + 尘埃退场
  api.every(230, () => {
    api.spawn({
      x: vertex.x + api.range(-150, 150), y: vertex.y + api.range(-50, 140),
      vy: api.range(-28, -10), shape: 'glyph', glyph: api.pick(PARTICLE_SYMBOLS),
      size: api.range(14, 26), maxLife: api.range(1.3, 2), color: '#ccfbf1',
      twinkle: 1.8, wander: 16, fadeIn: 0.16, fadeOut: 0.4,
    });
  }, { from: COLLIDE_AT + 400, until: api.duration - 800 });
  api.every(90, () => {
    api.spawn({
      x: vertex.x + api.range(-120, 120), y: vertex.y + api.range(-60, 120),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.8, 1.3),
      color: 'rgba(153, 246, 228, 0.5)', glow: 0.7, wander: 26, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: api.duration - 850, until: api.duration - 300 });
};
</script>

<template>
  <div class="collider-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.collider" :scene="scene" />
    <div class="collider-badge">
      <small class="badge-code">HADRON IGNITION · RUN 5600</small>
      <span class="badge-main">
        <Atom :size="22" />
        <strong>对撞顶点 · 新粒子确认</strong>
      </span>
      <small class="badge-meta">√s = 13.6 TeV · σ 5.2 · CL 99.99997%</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.collider-effect {
  @include effect-stage(hidden);
}

.collider-badge {
  position: absolute;
  left: 50%;
  bottom: 13%;
  border: 1px solid rgba(45, 212, 191, 0.4);
  border-radius: 10px;
  background: rgba(4, 32, 28, 0.5);
  color: #ccfbf1;
  display: grid;
  gap: 6px;
  place-items: center;
  padding: 12px 26px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: collider-badge 5.6s ease both;
}

.badge-main {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.collider-badge strong {
  font-size: 15px;
  letter-spacing: 0.14em;
}

.collider-badge small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.2em;
}

.badge-code {
  color: rgba(94, 234, 212, 0.78);
  font-size: 9px;
}

.badge-meta {
  color: rgba(153, 246, 228, 0.66);
  font-size: 10px;
}

@keyframes collider-badge {
  0%, 54% { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.92); }
  62%, 90% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}
</style>
