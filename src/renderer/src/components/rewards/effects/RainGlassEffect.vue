<script setup lang="ts">
import { CloudRain } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  api.setTrail(0.4);

  // 倾斜的雨幕：密集雨丝 + 落地溅花
  api.every(9, () => {
    const speed = api.range(900, 1500);
    api.spawn({
      x: api.range(-40, api.width + 60),
      y: -20,
      vx: -speed * 0.14,
      vy: speed,
      shape: 'streak',
      stretch: 0.035,
      size: api.range(1, 1.7),
      maxLife: (api.height + 60) / speed,
      color: api.rng() < 0.8 ? 'rgba(186, 230, 253, 0.75)' : 'rgba(255, 255, 255, 0.8)',
      glow: 0.5,
      fadeIn: 0.04,
      fadeOut: 0.06,
      onDeath: (p, sceneApi) => {
        if (sceneApi.rng() < 0.3) {
          sceneApi.burst({
            x: p.x,
            y: api.height - 4,
            count: 4,
            speed: [30, 140],
            angle: [Math.PI + 0.3, Math.PI * 2 - 0.3],
            base: { shape: 'spark', size: 1, maxLife: 0.3, ay: 500, color: 'rgba(186, 230, 253, 0.8)', glow: 0.7 },
          });
        }
      },
    });
  }, { until: api.duration - 700 });

  // 玻璃上的水珠：缓慢蠕动下滑，偶尔加速滑落
  api.every(160, () => {
    let slideSpeed = api.range(4, 16);
    api.spawn({
      x: api.range(api.width * 0.1, api.width * 0.9),
      y: api.range(api.height * 0.05, api.height * 0.6),
      shape: 'dot',
      size: api.range(1.4, 3),
      maxLife: api.range(1.6, 3),
      color: 'rgba(224, 242, 254, 0.85)',
      glow: 0.7,
      fadeIn: 0.2,
      fadeOut: 0.3,
      update: (p, dt) => {
        if (api.rng() < 0.004) slideSpeed = api.range(120, 300); // 突然滑落
        p.y += slideSpeed * dt;
        p.x += Math.sin(p.life * 3 + p.phase) * 5 * dt;
      },
    });
  }, { until: api.duration - 1000 });

  // 闪电：亮闪 + 锯齿主干（配合 CSS 的 rain-lightning 泛光）
  let sceneTime = 0;
  const bolts: Array<{ points: Array<[number, number]>; born: number; life: number }> = [];
  api.onFrame((tMs, _dt, ctx) => {
    sceneTime = tMs / 1000;
    for (let i = bolts.length - 1; i >= 0; i -= 1) {
      const bolt = bolts[i];
      const age = sceneTime - bolt.born;
      if (age > bolt.life) {
        bolts.splice(i, 1);
        continue;
      }
      const flicker = api.rng() < 0.2 ? 0.3 : 1;
      const alpha = (1 - age / bolt.life) * 0.9 * flicker;
      ctx.strokeStyle = `rgba(240, 249, 255, ${alpha})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
      for (const [px, py] of bolt.points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  });
  [1250, 3300].forEach((when) => {
    api.at(when, () => {
      let x = api.range(api.width * 0.2, api.width * 0.8);
      let y = -10;
      const points: Array<[number, number]> = [[x, y]];
      while (y < api.height * api.range(0.4, 0.62)) {
        x += api.range(-60, 60);
        y += api.range(30, 80);
        points.push([x, y]);
      }
      bolts.push({ points, born: sceneTime, life: 0.34 });
      api.spawn({ x: points[0][0], y: 60, shape: 'dot', size: 120, endSize: 30, maxLife: 0.3, color: 'rgba(224, 242, 254, 0.5)', glow: 2, fadeIn: 0, fadeOut: 0.8 });
      const tip = points[points.length - 1];
      api.burst({
        x: tip[0],
        y: tip[1],
        count: 12,
        speed: [60, 280],
        base: { shape: 'spark', size: 1.4, maxLife: 0.5, drag: 0.3, color: '#bae6fd', glow: 1.1, twinkle: 10 },
      });
    });
  });
};
</script>

<template>
  <div class="rain-glass-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.rainGlass" :scene="scene" />
    <div class="rain-glass-pane">
      <CloudRain :size="54" />
      <strong>雨夜玻璃 UI</strong>
      <span />
      <span />
      <span />
    </div>
  </div>
</template>

<style scoped>
.rain-glass-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.rain-glass-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 18%, rgba(14, 165, 233, 0.28), transparent 30%),
    radial-gradient(circle at 76% 72%, rgba(99, 102, 241, 0.2), transparent 36%);
  opacity: 0;
  animation: rain-night 5.4s ease both;
}

.rain-glass-effect::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(110deg, transparent 0 46%, rgba(255, 255, 255, 0.82) 49%, transparent 52%),
    radial-gradient(circle at 68% 28%, rgba(125, 211, 252, 0.34), transparent 26%);
  opacity: 0;
  mix-blend-mode: screen;
  animation: rain-lightning 5.4s ease both;
}

.rain-glass-pane {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(420px, 76vw);
  min-height: 260px;
  border: 1px solid rgba(226, 232, 240, 0.34);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.04)),
    rgba(15, 23, 42, 0.22);
  color: #e0f2fe;
  display: grid;
  gap: 12px;
  place-items: center;
  align-content: center;
  backdrop-filter: blur(14px) saturate(1.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 28px 80px rgba(2, 6, 23, 0.38);
  overflow: hidden;
  transform: translate(-50%, -50%);
  animation: rain-glass-pane 5.4s ease both;
}

.rain-glass-pane::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 0 42%, rgba(255, 255, 255, 0.28) 48%, transparent 56%);
  transform: translateX(-120%);
  animation: rain-glare 2.2s ease-in-out 600ms both;
}

.rain-glass-pane::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 24%, rgba(255, 255, 255, 0.42) 0 3px, transparent 4px),
    radial-gradient(circle at 76% 30%, rgba(255, 255, 255, 0.32) 0 2px, transparent 3px),
    radial-gradient(circle at 64% 76%, rgba(255, 255, 255, 0.28) 0 3px, transparent 4px),
    linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.08));
  opacity: 0;
  animation: rain-droplets 5.4s ease both;
}

.rain-glass-pane svg,
.rain-glass-pane strong,
.rain-glass-pane span {
  position: relative;
  z-index: 1;
}

.rain-glass-pane strong {
  font-size: 16px;
}

.rain-glass-pane span {
  width: 68%;
  height: 6px;
  border-radius: 999px;
  background: rgba(186, 230, 253, 0.34);
}

.rain-glass-pane span:nth-of-type(2) {
  width: 46%;
}

.rain-glass-pane span:nth-of-type(3) {
  width: 58%;
}

@keyframes rain-night {
  0%, 100% { opacity: 0; }
  12%, 86% { opacity: 1; }
}

@keyframes rain-lightning {
  0%, 20%, 34%, 100% { opacity: 0; }
  24% { opacity: 0.62; }
  27% { opacity: 0.08; }
  31% { opacity: 0.38; }
}

@keyframes rain-glass-pane {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.9); filter: blur(8px); }
  20%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
}

@keyframes rain-glare {
  to { transform: translateX(120%); }
}

@keyframes rain-droplets {
  0%, 100% { opacity: 0; transform: translateY(-12px); }
  24%, 82% { opacity: 1; }
  100% { transform: translateY(24px); }
}
</style>
