<script setup lang="ts">
import { Eclipse } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const DISK_COLORS = ['#fb923c', '#fdba74', '#f59e0b', '#fde68a'];
const LENS_COLOR = '#93c5fd';

const scene: SceneFn = (api) => {
  api.setTrail(0.16);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const horizonR = 30;
  const tilt = api.range(0.32, 0.46);

  // 星野：远景星点缓慢闪烁
  for (let i = 0; i < 64; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot',
      size: api.range(0.7, 1.8),
      maxLife: 6,
      color: api.rng() > 0.7 ? LENS_COLOR : '#e2e8f0',
      glow: 0.8,
      opacity: api.range(0.3, 0.8),
      twinkle: api.range(0.4, 1.4),
      fadeIn: 0.06,
      fadeOut: 0.12,
    });
  }

  // 幕一：吸积盘（倾斜椭圆多层旋转）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > 3600) return;
    const ramp = Math.min(1, tMs / 700) * Math.min(1, Math.max(0, (3600 - tMs) / 400));
    ctx.translate(cx, cy);
    for (let ring = 0; ring < 5; ring += 1) {
      const r = horizonR + 26 + ring * 22;
      const spin = tMs / 1000 * (2.4 - ring * 0.32) + ring * 1.7;
      ctx.save();
      ctx.rotate(0.4);
      ctx.scale(1, tilt);
      ctx.rotate(spin);
      ctx.strokeStyle = `rgba(251, 146, 60, ${(0.34 - ring * 0.05) * ramp})`;
      ctx.lineWidth = 10 - ring * 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0.2, Math.PI * 1.62);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 幕一：外围星光被引力拉成螺旋坠入（角速度随半径缩小暴增）
  api.every(16, () => {
    let radius = api.range(180, Math.max(api.width, api.height) * 0.52);
    let angle = api.range(0, Math.PI * 2);
    const spinDir = api.rng() > 0.14 ? 1 : -1;
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * (0.62 + tilt),
      shape: 'spark',
      size: api.range(1.3, 2.6),
      maxLife: 2.6,
      color: api.pick(DISK_COLORS),
      glow: 1.1,
      fadeIn: 0.14,
      fadeOut: 0.05,
      update: (p, dt) => {
        const pull = 1 + Math.max(0, 320 - radius) / 60;
        angle += spinDir * api.range(1.5, 1.9) * pull * dt;
        radius -= (radius * 1.15 + 46) * dt;
        if (radius < horizonR - 4) p.life = p.maxLife;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius * (0.62 + tilt);
      },
    });
  }, { until: 3200 });

  // 幕二：光子环驻留
  api.at(2200, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: horizonR + 7, endSize: horizonR + 9,
      maxLife: 1.3, color: '#fef3c7', opacity: 0.95, fadeIn: 0.16, fadeOut: 0.3,
    });
  });

  // 幕三：白洞反弹 —— 闪爆 + 上下相对论喷流 + 冲击环
  api.at(3600, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 14, endSize: 320, maxLife: 0.66, color: '#fffbeb', glow: 2.4, fadeOut: 0.9 });
    [-Math.PI / 2, Math.PI / 2].forEach((dir) => {
      api.burst({
        x: cx, y: cy, count: 90, speed: [260, 760],
        angle: [dir - 0.16, dir + 0.16],
        base: {
          shape: 'streak', stretch: 0.09, size: 2.2, maxLife: 1.3,
          color: '#fde68a', glow: 1.2, drag: 0.5, fadeOut: 0.4,
        },
        vary: (p, rng) => {
          if (rng() > 0.6) p.color = LENS_COLOR;
          p.maxLife = 0.8 + rng() * 0.9;
        },
      });
    });
    [0, 160, 340].forEach((delay, i) => {
      api.at(3600 + delay, () => {
        api.spawn({
          x: cx, y: cy, shape: 'ring', size: 26,
          endSize: Math.max(api.width, api.height) * (0.42 + i * 0.2),
          maxLife: 1.05, color: i === 1 ? LENS_COLOR : '#fdba74', opacity: 0.85, fadeOut: 0.75,
        });
      });
    });
  });

  // 余烬缓散
  api.every(70, () => {
    api.spawn({
      x: cx + api.range(-160, 160), y: cy + api.range(-120, 120),
      shape: 'dot', size: api.range(1, 2), maxLife: api.range(0.9, 1.6),
      color: api.pick(DISK_COLORS), glow: 1, wander: 34, twinkle: 2.2, fadeOut: 0.5,
    });
  }, { from: 4000, until: api.duration - 700 });
};
</script>

<template>
  <div class="black-hole-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.blackHole" :scene="scene" />
    <div class="bh-core">
      <Eclipse :size="40" />
      <strong>EVENT HORIZON</strong>
    </div>
  </div>
</template>

<style scoped>
.black-hole-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: bh-camera 6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.bh-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background: radial-gradient(circle, #000 0 44%, rgba(2, 6, 23, 0.92) 62%, transparent 74%);
  box-shadow: 0 0 44px rgba(251, 146, 60, 0.4), inset 0 0 26px rgba(0, 0, 0, 0.9);
  color: #fed7aa;
  display: grid;
  gap: 7px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: bh-core 6s ease both;
}

.bh-core strong {
  font-size: 10px;
  letter-spacing: 0.16em;
}

@keyframes bh-core {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  16%, 56% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  60% { transform: translate(-50%, -50%) scale(0.62); }
  66% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
  74%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
}

@keyframes bh-camera {
  0% { transform: scale(1.12); }
  36% { transform: scale(1); }
  58% { transform: scale(1.05); filter: blur(0); }
  62% { transform: scale(0.9); filter: blur(3px); }
  70% { transform: scale(1.06); filter: blur(0); }
  100% { transform: scale(1.14); opacity: 0; }
}
</style>
