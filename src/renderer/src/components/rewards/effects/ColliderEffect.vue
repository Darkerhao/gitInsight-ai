<script setup lang="ts">
import { Atom } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const PARTICLE_SYMBOLS = ['μ', 'π', 'γ', 'ν', 'Ψ', 'τ', 'Ξ'];
const COLLIDE_AT = 2400;

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const trackR = Math.min(api.width, api.height) * 0.36;
  const collidePoint = { x: cx, y: cy - trackR };

  // 环形加速器轨道 + 四段加速腔
  api.onFrame((tMs, _dt, ctx) => {
    const ramp = Math.min(1, tMs / 600) * Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 600));
    if (ramp <= 0.02) return;
    ctx.strokeStyle = `rgba(45, 212, 191, ${0.3 * ramp})`;
    ctx.lineWidth = 1.4;
    [trackR - 7, trackR + 7].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(tMs / 240 + i));
      ctx.strokeStyle = `rgba(94, 234, 212, ${0.6 * pulse * ramp})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, trackR, a - 0.07, a + 0.07);
      ctx.stroke();
    }
  });

  // 幕一：双束流反向加速（逐圈提速增亮）
  api.every(16, (index) => {
    const progress = Math.min(1, (index * 16) / COLLIDE_AT);
    const lap = 0.9 + progress * progress * 9;
    const theta = -Math.PI / 2 + (index * 0.016) * lap * Math.PI;
    [1, -1].forEach((dir) => {
      api.spawn({
        x: cx + Math.cos(dir * theta - Math.PI / 2 + (dir < 0 ? Math.PI : 0)) * trackR,
        y: cy + Math.sin(dir * theta - Math.PI / 2 + (dir < 0 ? Math.PI : 0)) * trackR,
        shape: 'spark', size: 2 + progress * 1.6, maxLife: 0.4,
        color: dir > 0 ? '#5eead4' : '#93c5fd', glow: 1.1 + progress * 0.6,
        fadeIn: 0.06, fadeOut: 0.5,
      });
    });
  }, { until: COLLIDE_AT - 30 });

  // 幕二：对撞 —— 顶点白闪 + 锥形喷注 + 磁场偏转螺旋径迹（云室质感）
  api.at(COLLIDE_AT, () => {
    api.spawn({ ...collidePoint, shape: 'dot', size: 14, endSize: 260, maxLife: 0.6, color: '#f0fdfa', glow: 2.4, fadeOut: 0.9 });
    api.spawn({ ...collidePoint, shape: 'ring', size: 18, endSize: 300, maxLife: 0.9, color: '#5eead4', opacity: 0.85, fadeOut: 0.7 });
    for (let jet = 0; jet < 5; jet += 1) {
      const jetAngle = api.range(0, Math.PI * 2);
      api.burst({
        ...collidePoint, count: 26, speed: [180, 560],
        angle: [jetAngle - 0.14, jetAngle + 0.14],
        base: { shape: 'streak', stretch: 0.08, size: 1.8, maxLife: 1.1, glow: 1, drag: 0.5, fadeOut: 0.4 },
        vary: (p, rng) => {
          p.color = rng() > 0.5 ? '#5eead4' : rng() > 0.5 ? '#fbbf24' : '#f0abfc';
        },
      });
    }
    // 衰变径迹：速度方向持续旋转 → 螺旋
    api.burst({
      ...collidePoint, count: 26, speed: [60, 190],
      base: { shape: 'spark', size: 1.8, maxLife: 2, glow: 1, fadeOut: 0.3 },
      vary: (p, rng) => {
        const omega = (rng() > 0.5 ? 1 : -1) * (1.6 + rng() * 4);
        p.color = rng() > 0.5 ? '#99f6e4' : '#c4b5fd';
        p.update = (pt, dt) => {
          const cos = Math.cos(omega * dt);
          const sin = Math.sin(omega * dt);
          const vx = pt.vx * cos - pt.vy * sin;
          pt.vy = pt.vx * sin + pt.vy * cos;
          pt.vx = vx;
        };
      },
    });
  });

  // 幕三：发现时刻 —— 粒子符号漂浮
  api.every(220, () => {
    api.spawn({
      x: collidePoint.x + api.range(-140, 140), y: collidePoint.y + api.range(-60, 130),
      vy: api.range(-26, -10), shape: 'glyph', glyph: api.pick(PARTICLE_SYMBOLS),
      size: api.range(15, 26), maxLife: api.range(1.3, 2), color: '#ccfbf1',
      twinkle: 1.8, wander: 16, fadeIn: 0.14, fadeOut: 0.4,
    });
  }, { from: COLLIDE_AT + 400, until: api.duration - 900 });
};
</script>

<template>
  <div class="collider-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.collider" :scene="scene" />
    <div class="collider-badge">
      <Atom :size="26" />
      <strong>NEW PARTICLE DISCOVERED</strong>
      <small>√s = 13.6 TeV · σ 5.2</small>
    </div>
  </div>
</template>

<style scoped>
.collider-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: collider-camera 5.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.collider-badge {
  position: absolute;
  left: 50%;
  bottom: 13%;
  border: 1px solid rgba(45, 212, 191, 0.4);
  border-radius: 10px;
  background: rgba(4, 32, 28, 0.46);
  color: #ccfbf1;
  display: grid;
  gap: 5px;
  place-items: center;
  padding: 12px 24px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: collider-badge 5.6s ease both;
}

.collider-badge strong {
  font-size: 13px;
  letter-spacing: 0.18em;
}

.collider-badge small {
  color: rgba(153, 246, 228, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

@keyframes collider-badge {
  0%, 54% { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.9); }
  62%, 90% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  100% { opacity: 0; }
}

@keyframes collider-camera {
  0% { transform: scale(1.08); }
  34% { transform: scale(1); }
  43% { transform: scale(0.97); }
  47% { transform: scale(1.08); }
  54% { transform: scale(1.01); }
  100% { transform: scale(1.05); opacity: 0; }
}
</style>
