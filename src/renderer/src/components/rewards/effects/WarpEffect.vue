<script setup lang="ts">
import { Rocket } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 星际跃迁 WARP TRANSIT · 4.2s
 * 幕一 0-450ms   引擎充能：星光被拽向跃迁点 → 点火白闪 + 首圈脉冲环
 * 幕二 450-3400  星光隧道：近/远双层星流透视外冲（近大远小），脉冲环交替推进，两次超频踩点
 * 幕三 3400-4200 白蓝闪光收束，全向光条爆散后星尘归寂
 */
const STAR_NEAR = ['#ffffff', '#dbeafe', '#93c5fd'];
const TEAL = '#5eead4'; // secondary #2dd4bf 的高光延展

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // ── 幕一：充能 —— 外围星光被拉向跃迁点 ──
  api.every(18, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(150, Math.max(api.width, api.height) * 0.5);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * radius * 2.4,
      vy: -Math.sin(angle) * radius * 2.4,
      shape: 'streak', stretch: 0.06, size: 1.6, maxLife: 0.4,
      color: '#bfdbfe', glow: 0.9, fadeIn: 0.12, fadeOut: 0.2,
    });
  }, { until: 340 });
  // 点火：白闪 + 首圈脉冲环
  api.at(380, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 58, endSize: 6, maxLife: 0.5, color: '#eff6ff', glow: 2.4, fadeOut: 0.6 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 16, endSize: 250, maxLife: 0.7, color: '#93c5fd', opacity: 0.9, fadeOut: 0.7 });
  });

  // ── 幕二：星光隧道（near 亮大快 / far 暗小慢 → 透视纵深）──
  const spawnStar = (near: boolean) => {
    const angle = api.range(0, Math.PI * 2);
    const startRadius = api.range(6, 54);
    const boost = near ? 1 : 0.55;
    api.spawn({
      x: cx + Math.cos(angle) * startRadius,
      y: cy + Math.sin(angle) * startRadius * 0.92,
      vx: Math.cos(angle) * api.range(26, 90) * boost,
      vy: Math.sin(angle) * api.range(26, 90) * boost,
      shape: 'streak',
      stretch: near ? 0.11 : 0.07,
      size: near ? api.range(1.8, 3) : api.range(1, 1.7),
      opacity: near ? 1 : 0.55,
      maxLife: api.range(1, 1.7),
      color: near ? api.pick(STAR_NEAR) : api.rng() < 0.2 ? TEAL : '#93c5fd',
      glow: near ? 1.1 : 0.6,
      fadeIn: 0.12,
      fadeOut: 0.08,
      update: (p, dt) => {
        // 距中心越远越快，模拟穿越隧道的透视加速
        const accel = near ? 3.8 : 2.6;
        p.vx += (p.x - cx) * accel * dt;
        p.vy += (p.y - cy) * accel * dt;
      },
    });
  };
  api.every(15, () => spawnStar(true), { from: 430, until: 3320 });
  api.every(26, () => spawnStar(false), { from: 520, until: 3260 });

  // 脉冲环：主辅色交替周期推向舰首
  api.every(560, (i) => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 26,
      endSize: Math.max(api.width, api.height) * 0.64,
      maxLife: 1.05,
      color: i % 2 === 0 ? '#93c5fd' : TEAL,
      opacity: 0.6, fadeIn: 0.05, fadeOut: 0.7,
    });
  }, { from: 520, until: 2900 });

  // 两次超频脉冲：白闪踩点 + 短促星涌（隧道换挡的节拍感）
  [1500, 2500].forEach((when) => {
    api.at(when, () => {
      api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 120, maxLife: 0.4, color: '#eff6ff', glow: 1.8, fadeOut: 0.8 });
    });
    api.every(8, () => spawnStar(true), { from: when, until: when + 190 });
  });

  // ── 幕三：收束闪爆 —— 全向光条爆散后归寂 ──
  api.at(3430, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 280, maxLife: 0.85, color: '#eff6ff', glow: 2.2, fadeOut: 0.85 });
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 20,
      endSize: Math.max(api.width, api.height) * 0.8,
      maxLife: 0.9, color: '#bfdbfe', opacity: 0.9, fadeOut: 0.75,
    });
    api.burst({
      x: cx, y: cy, count: 80, speed: [220, 760],
      base: { shape: 'streak', stretch: 0.08, size: 2, maxLife: 0.9, color: '#bfdbfe', glow: 1.1, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() < 0.3) p.color = TEAL;
        else if (rng() < 0.24) p.color = '#ffffff';
        p.maxLife = 0.5 + rng() * 0.7;
      },
    });
  });
  // 余韵：残余星尘缓漂明灭
  api.every(80, () => {
    api.spawn({
      x: cx + api.range(-180, 180),
      y: cy + api.range(-140, 140),
      shape: 'dot', size: api.range(0.8, 1.8), maxLife: api.range(0.6, 1),
      color: api.pick(['#93c5fd', '#dbeafe', TEAL]),
      glow: 0.9, wander: 30, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: 3560, until: 3880 });
};
</script>

<template>
  <div class="warp-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.warp" :scene="scene" />
    <div class="warp-ship">
      <Rocket :size="46" />
      <strong>星际跃迁</strong>
      <small>WARP TRANSIT · FTL 1.0c</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.warp-effect {
  @include effect-stage(hidden);
}

.warp-ship {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 158px;
  height: 158px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 165, 250, 0.2), rgba(15, 23, 42, 0.34) 66%, transparent);
  color: #dbeafe;
  display: grid;
  gap: 6px;
  place-items: center;
  align-content: center;
  box-shadow:
    0 0 0 16px rgba(96, 165, 250, 0.07),
    0 0 66px rgba(96, 165, 250, 0.32);
  text-shadow: 0 0 16px rgba(96, 165, 250, 0.7);
  transform: translate(-50%, -50%);
  animation: warp-ship 4.2s cubic-bezier(0.33, 1, 0.68, 1) both;
}

.warp-ship strong {
  font-size: 15px;
  letter-spacing: 0.12em;
}

.warp-ship small {
  color: rgba(191, 219, 254, 0.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

@keyframes warp-ship {
  0%,
  16% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.72) rotate(-14deg);
  }
  28%,
  66% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.06);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + 150px), calc(-50% - 110px)) scale(0.5) rotate(14deg);
    filter: blur(2px);
  }
}
</style>
