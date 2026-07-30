<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 鎏金流光 LUMEN TIDE · 3.6s
 * 幕一 0-450ms   金环荡开 + 光尘迸发，蓝辉回波
 * 幕二 450-2950  三条纵深光河横流（远暗小慢 → 近亮大快），波峰碎金 + 金尘上浮 + 四芒星踩点
 * 幕三 2950-3600 白金尾波流出画面，余尘落定
 */
const scene: SceneFn = (api) => {
  api.setTrail(0.13); // 长拖尾成就"流光"质感
  const cx = api.width / 2;
  const cy = api.height / 2;

  // ── 幕一：金环荡开 + 光尘迸发（白热核心 + 金色辉光 + 蓝色点缀）──
  api.at(120, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 130, maxLife: 0.5, color: '#fffbeb', glow: 2.1, fadeOut: 0.85 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 28, endSize: 260, maxLife: 0.9, color: '#fbbf24', opacity: 0.9, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 62, speed: [70, 330],
      base: { shape: 'spark', size: 1.9, drag: 0.3, color: '#fcd34d', twinkle: 6, glow: 1.2, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.maxLife = 0.8 + rng() * 0.9;
        if (rng() < 0.22) p.color = '#fffbeb';
        else if (rng() < 0.16) p.color = '#93c5fd';
      },
    });
  });
  // 蓝辉回波：辅色第二环，略滞后荡开
  api.at(330, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 64, endSize: 330, maxLife: 0.8, color: '#93c5fd', opacity: 0.36, fadeOut: 0.7 });
  });

  // ── 幕二：三条纵深光河（depth 决定尺寸/亮度/速度 → 近大远小视差）──
  const rivers = [
    { band: 0.26, depth: 0.6 }, // 远景河
    { band: 0.5, depth: 1 }, // 近景主河
    { band: 0.72, depth: 0.8 }, // 中景河
  ].map(({ band, depth }) => ({
    y: api.height * (band + api.range(-0.04, 0.04)),
    amp: api.range(46, 116) * depth,
    freq: api.range(0.005, 0.009),
    phase: api.range(0, Math.PI * 2),
    speed: api.range(430, 660) * (0.55 + depth * 0.5),
    depth,
  }));
  api.every(24, () => {
    const river = api.pick(rivers);
    const warm = api.range(40, 52);
    api.spawn({
      x: -24,
      y: river.y,
      vx: river.speed * api.range(0.85, 1.15),
      shape: 'streak',
      stretch: 0.055 + river.depth * 0.03,
      size: api.range(1.1, 2.1) * river.depth + (river.depth > 0.9 ? 0.8 : 0),
      opacity: 0.36 + river.depth * 0.64,
      maxLife: (api.width + 60) / river.speed,
      color: `hsl(${Math.round(warm)}, ${api.rng() < 0.22 ? 42 : 94}%, ${Math.round(api.range(60, 82))}%)`,
      glow: 0.65 + river.depth * 0.5,
      fadeIn: 0.06,
      fadeOut: 0.1,
      update: (p) => {
        p.vy = Math.sin(p.x * river.freq + river.phase) * river.amp;
      },
    });
  }, { from: 360, until: 2960 });

  // 波峰碎金：主河波峰偶发白热小噼啪（次级系统）
  api.every(220, () => {
    const river = rivers[1];
    const x = api.range(api.width * 0.22, api.width * 0.9);
    const y = river.y + Math.sin(x * river.freq + river.phase) * river.amp * 0.18;
    api.burst({
      x, y, count: 5, speed: [30, 130],
      base: { shape: 'spark', size: 1.3, maxLife: 0.5, color: '#fffbeb', glow: 1, drag: 0.3, fadeOut: 0.5 },
    });
  }, { from: 920, until: 2740 });

  // 金尘上浮 + 少量蓝色微尘点缀
  api.every(64, () => {
    const blue = api.rng() < 0.15;
    api.spawn({
      x: api.range(0, api.width),
      y: api.range(api.height * 0.2, api.height),
      vx: api.range(-12, 12),
      vy: api.range(-34, -10),
      shape: 'dot',
      size: blue ? api.range(0.7, 1.4) : api.range(0.9, 2),
      maxLife: api.range(1.2, 2.2),
      color: blue ? '#93c5fd' : '#fcd34d',
      twinkle: api.range(3, 8),
      glow: 1,
      wander: 30,
      fadeOut: 0.4,
    });
  }, { from: 240, until: 3100 });

  // 四芒星闪：api.at 精确踩点，金主蓝辅克制交替
  [700, 1150, 1520, 1980, 2360, 2700].forEach((when, i) => {
    api.at(when, () => {
      api.spawn({
        x: api.range(api.width * 0.14, api.width * 0.86),
        y: api.range(api.height * 0.14, api.height * 0.78),
        shape: 'glyph',
        glyph: '+',
        size: api.range(20, 40),
        endSize: 6,
        maxLife: api.range(0.7, 1),
        color: i % 3 === 2 ? '#93c5fd' : '#fffbeb',
        spin: api.range(-1.2, 1.2),
        fadeIn: 0.2,
        fadeOut: 0.4,
        glow: 0,
      });
    });
  });

  // 中段回波：金环再荡一次呼应开场
  api.at(1800, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 40, endSize: 300, maxLife: 1, color: '#fbbf24', opacity: 0.4, fadeOut: 0.8 });
  });

  // ── 幕三：白金尾波流出画面，余尘落定 ──
  api.at(3000, () => {
    const river = rivers[1];
    api.spawn({
      x: -30, y: river.y, vx: 900,
      shape: 'streak', stretch: 0.1, size: 3.4,
      maxLife: (api.width + 80) / 900,
      color: '#fffbeb', glow: 1.5, fadeIn: 0.05, fadeOut: 0.12,
      update: (p) => {
        p.vy = Math.sin(p.x * river.freq + river.phase) * river.amp * 0.8;
      },
    });
  });
  api.every(90, () => {
    api.spawn({
      x: api.range(0, api.width),
      y: api.range(api.height * 0.3, api.height * 0.9),
      vy: api.range(-18, -6),
      shape: 'dot', size: api.range(0.7, 1.4), maxLife: 0.8,
      color: '#fde68a', glow: 0.8, twinkle: 5, fadeOut: 0.6,
    });
  }, { from: 3040, until: 3320 });
};
</script>

<template>
  <div class="sparkle-effect">
    <span class="sparkle-sash sash-one" />
    <span class="sparkle-sash sash-two" />
    <span class="sparkle-sash sash-three" />
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.sparkle" :scene="scene" />
    <div class="sparkle-medallion">
      <span class="sparkle-medallion-ring"><Sparkles :size="34" /></span>
      <strong>鎏金流光</strong>
      <small>LUMEN TIDE · FLOW 03/03</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sparkle-effect {
  @include effect-stage(hidden);
}

.sparkle-sash {
  position: absolute;
  left: -18%;
  right: -18%;
  height: 16vh;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.3), rgba(255, 255, 255, 0.36), rgba(147, 197, 253, 0.14), transparent);
  filter: blur(11px);
  transform: rotate(-12deg) translateX(-30%);
  opacity: 0;
  animation: sparkle-sash 3.6s cubic-bezier(0.33, 1, 0.68, 1) both;
}

.sash-one {
  top: 16%;
}

.sash-two {
  top: 42%;
  animation-delay: 150ms;
}

.sash-three {
  top: 67%;
  animation-delay: 300ms;
}

.sparkle-medallion {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 7px;
  place-items: center;
  color: #fef3c7;
  text-shadow: 0 0 18px rgba(245, 158, 11, 0.55);
  transform: translate(-50%, -50%);
  animation: sparkle-medallion 3.6s ease both;
}

.sparkle-medallion-ring {
  width: 84px;
  height: 84px;
  border: 1px solid rgba(251, 191, 36, 0.4);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.16), rgba(15, 23, 42, 0.34) 74%);
  color: #fde68a;
  display: grid;
  place-items: center;
  box-shadow:
    0 0 0 12px rgba(251, 191, 36, 0.07),
    0 0 46px rgba(245, 158, 11, 0.32);
}

.sparkle-medallion strong {
  font-size: 16px;
  letter-spacing: 0.14em;
}

.sparkle-medallion small {
  color: rgba(254, 243, 199, 0.68);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.24em;
}

@keyframes sparkle-sash {
  0% {
    opacity: 0;
    transform: rotate(-12deg) translateX(-30%);
  }
  22%,
  74% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(-12deg) translateX(30%);
  }
}

@keyframes sparkle-medallion {
  0%,
  38% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.82) rotate(-8deg);
  }
  48%,
  80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.92) rotate(6deg);
  }
}
</style>
