<script setup lang="ts">
import { Sun } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SNAP_AT = 2400;

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  // 巨日圆心在屏外左下
  const sunX = -api.width * 0.14;
  const sunY = api.height * 1.16;
  const sunR = Math.min(api.width, api.height) * 0.66;

  // 幕一：日面边缘 + 对流沸腾
  api.onFrame((tMs, _dt, ctx) => {
    const fade = Math.min(1, tMs / 500) * Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 600));
    if (fade <= 0.02) return;
    ctx.strokeStyle = `rgba(251, 146, 60, ${0.7 * fade})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, -0.9, 0.3);
    ctx.stroke();
    ctx.strokeStyle = `rgba(254, 215, 170, ${0.26 * fade})`;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR + 15, -0.86, 0.24);
    ctx.stroke();
  });
  api.every(28, () => {
    const a = api.range(-0.82, 0.2);
    api.spawn({
      x: sunX + Math.cos(a) * (sunR + api.range(-8, 10)),
      y: sunY + Math.sin(a) * (sunR + api.range(-8, 10)),
      vx: Math.cos(a) * api.range(14, 60), vy: Math.sin(a) * api.range(14, 60),
      shape: 'spark', size: api.range(1.4, 2.8), maxLife: api.range(0.4, 0.9),
      color: api.pick(['#fdba74', '#fb923c', '#fde68a']), glow: 1.1, drag: 0.4, fadeOut: 0.4,
    });
  }, { until: api.duration - 800 });

  // 幕二：磁力线弧逐条亮起 → 断裂抛射
  const loops = Array.from({ length: 3 }, (_, i) => {
    const a = api.range(-0.66, 0.02);
    const foot1 = { x: sunX + Math.cos(a) * sunR, y: sunY + Math.sin(a) * sunR };
    const a2 = a + api.range(0.1, 0.2);
    const foot2 = { x: sunX + Math.cos(a2) * sunR, y: sunY + Math.sin(a2) * sunR };
    const mid = (a + a2) / 2;
    const h = api.range(120, 230) + i * 30;
    const apex = { x: sunX + Math.cos(mid) * (sunR + h), y: sunY + Math.sin(mid) * (sunR + h) };
    return { foot1, foot2, apex, riseAt: 1200 + i * 320 };
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 1200 || tMs > SNAP_AT + 140) return;
    for (const loop of loops) {
      if (tMs < loop.riseAt) continue;
      const rise = Math.min(1, (tMs - loop.riseAt) / 380);
      const snap = tMs > SNAP_AT ? Math.max(0, 1 - (tMs - SNAP_AT) / 140) : 1;
      ctx.strokeStyle = `rgba(253, 186, 116, ${0.66 * rise * snap})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(loop.foot1.x, loop.foot1.y);
      ctx.quadraticCurveTo(
        loop.foot1.x + (loop.apex.x - loop.foot1.x) * rise * 2 - (loop.foot2.x - loop.foot1.x) / 2,
        loop.foot1.y + (loop.apex.y - loop.foot1.y) * rise * 2 - (loop.foot2.y - loop.foot1.y) / 2,
        loop.foot2.x, loop.foot2.y
      );
      ctx.stroke();
    }
  });
  api.at(SNAP_AT, () => {
    const apex = loops[1].apex;
    api.spawn({ x: apex.x, y: apex.y, shape: 'dot', size: 14, endSize: 220, maxLife: 0.6, color: '#fff7ed', glow: 2.2, fadeOut: 0.9 });
    // CME 抛射：大团等离子体冲向右上
    api.burst({
      x: apex.x, y: apex.y, count: 150, speed: [180, 640],
      angle: [-1.1, -0.2],
      base: { shape: 'streak', stretch: 0.09, size: 2.4, maxLife: 1.5, glow: 1.15, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#fb923c' : rng() > 0.5 ? '#fde68a' : '#fecaca';
        p.maxLife = 0.8 + rng() * 1.1;
        if (rng() > 0.8) {
          p.shape = 'dot';
          p.size = 5 + rng() * 8;
          p.glow = 1.4;
        }
      },
    });
  });

  // 幕三：粒子风横掠 + 右上极光帘泛起
  api.every(20, () => {
    api.spawn({
      x: api.range(-30, api.width * 0.3), y: api.height * (0.5 + api.rng() * 0.55),
      vx: api.range(320, 620), vy: api.range(-260, -140),
      shape: 'streak', stretch: 0.07, size: api.range(1.2, 2.2), maxLife: 1.1,
      color: api.pick(['#fdba74', '#fca5a5', '#fde68a']), glow: 0.9, fadeIn: 0.08, fadeOut: 0.2,
    });
  }, { from: 3600, until: api.duration - 800 });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 3700) return;
    const fade = Math.min(1, (tMs - 3700) / 600) * Math.max(0, Math.min(1, (api.duration - 300 - tMs) / 500));
    if (fade <= 0.02) return;
    for (let band = 0; band < 3; band += 1) {
      ctx.strokeStyle = `rgba(${band === 1 ? '134, 239, 172' : '110, 231, 183'}, ${(0.2 - band * 0.05) * fade})`;
      ctx.lineWidth = 24 - band * 6;
      ctx.beginPath();
      for (let s = 0; s <= 30; s += 1) {
        const x = api.width * (0.5 + (s / 30) * 0.5);
        const y = api.height * 0.14 + band * 22 + Math.sin(s / 3.4 + tMs / 460 + band) * 20;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
};
</script>

<template>
  <div class="solar-flare-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.solarFlare" :scene="scene" />
    <div class="flare-hud">
      <Sun :size="26" />
      <strong>SOLAR STORM · CLASS X9.3</strong>
      <small>CME 速度 2100 km/s · 抵达预计 T-0</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.solar-flare-effect {
  @include effect-stage(hidden);
  animation: flare-camera 5.6s ease both;
}

.flare-hud {
  position: absolute;
  right: 7%;
  top: 12%;
  border: 1px solid rgba(251, 146, 60, 0.42);
  border-radius: 10px;
  background: rgba(58, 22, 2, 0.44);
  color: #ffedd5;
  display: grid;
  gap: 5px;
  justify-items: start;
  padding: 12px 18px;
  backdrop-filter: blur(4px);
  animation: flare-hud 5.6s ease both;
}

.flare-hud strong {
  font-size: 13px;
  letter-spacing: 0.14em;
}

.flare-hud small {
  color: rgba(254, 215, 170, 0.72);
  font-size: 11px;
}

@keyframes flare-hud {
  0%, 38% { opacity: 0; transform: translateX(18px); }
  48%, 88% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; }
}

@keyframes flare-camera {
  0% { opacity: 0; transform: scale(1.08); }
  8% { opacity: 1; }
  36% { transform: scale(1); }
  43% { transform: scale(0.985); }
  47% { transform: scale(1.05); }
  56% { transform: scale(1.01); }
  100% { opacity: 0; transform: scale(1.05); }
}
</style>
