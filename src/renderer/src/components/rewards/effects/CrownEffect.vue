<script setup lang="ts">
import { Crown } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const GOLDS = ['#fcd34d', '#fbbf24', '#fde68a'];

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  const TAU = Math.PI * 2;
  const cx = api.width / 2;
  const cy = api.height / 2;

  // ── 远景层：暗金星尘（低亮度、慢闪，把纵深压出来）
  for (let i = 0; i < 30; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot',
      size: api.range(0.7, 1.5),
      maxLife: api.range(3.4, 4.5),
      color: '#fbbf24',
      glow: 0.7,
      opacity: api.range(0.14, 0.32),
      twinkle: api.range(0.5, 1.4),
      fadeIn: 0.14,
      fadeOut: 0.24,
    });
  }

  // ── 十道神辉光束：依次点燃展开旋转，终章收束
  const rayCount = 10;
  const rayPhases = Array.from({ length: rayCount }, () => api.range(0, TAU));
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const collapse = Math.min(1, Math.max(0, (4420 - tMs) / 420));
    if (collapse <= 0) return;
    ctx.translate(cx, cy);
    for (let i = 0; i < rayCount; i += 1) {
      const ignite = Math.min(1, Math.max(0, (tMs - 90 - i * 38) / 300));
      if (ignite <= 0) continue;
      const envelope = ignite * collapse;
      const angle = (i / rayCount) * TAU + t * 0.22 + rayPhases[i] * 0.08;
      const flicker = 0.6 + 0.4 * Math.sin(t * 2.4 + rayPhases[i]);
      const length = Math.max(api.width, api.height) * 0.72 * (0.5 + ignite * 0.5);
      const halfWidth = 0.052 + 0.02 * Math.sin(t * 1.6 + rayPhases[i]);
      const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
      gradient.addColorStop(0, `rgba(253, 230, 138, ${0.35 * envelope * flicker})`);
      gradient.addColorStop(1, 'rgba(253, 230, 138, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, length, angle - halfWidth, angle + halfWidth);
      ctx.closePath();
      ctx.fill();
    }
  });

  // ── 幕一（entry）：圣所点亮 —— 白芯微闪、徽章落定涟漪
  api.at(120, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 8, endSize: 60, maxLife: 0.45, color: '#fffbeb', glow: 2, fadeOut: 0.8 });
  });
  api.at(430, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 110, endSize: 150, maxLife: 0.6, color: '#fde68a', opacity: 0.6, fadeOut: 0.55 });
  });

  // ── 幕二：加冕爆发 —— 白热闪心 + 金色火花 + 三重光环
  api.at(700, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 20, endSize: 220, maxLife: 0.5, color: '#fffbeb', glow: 2.2, fadeOut: 0.9 });
    api.burst({
      x: cx, y: cy, count: 110, speed: [60, 440],
      base: { shape: 'spark', size: 2, drag: 0.3, ay: 110, color: '#fcd34d', twinkle: 6, glow: 1.3 },
      vary: (p, rng) => {
        p.maxLife = 1 + rng() * 1.2;
        if (rng() < 0.26) p.color = '#fffbeb';
        if (rng() < 0.12) p.color = '#f97316';
      },
    });
    [0, 200, 430].forEach((delay, i) => {
      api.at(700 + delay, () => {
        api.spawn({ x: cx, y: cy, shape: 'ring', size: 60, endSize: 300 + i * 120, maxLife: 1.1, color: i === 2 ? '#f97316' : '#fde68a', opacity: 0.85 - i * 0.14, fadeOut: 0.7 });
      });
    });
  });

  // 底部余烬升腾：近层亮而大、远层暗而小的双层视差
  api.every(52, () => {
    const near = api.rng() < 0.55;
    api.spawn({
      x: api.range(0, api.width),
      y: api.height + 8,
      vx: api.range(-20, 20),
      vy: near ? api.range(-180, -80) : api.range(-90, -40),
      drag: 0.7,
      shape: 'spark',
      size: near ? api.range(1.8, 3) : api.range(0.9, 1.6),
      maxLife: api.range(1.8, 3),
      color: near ? (api.rng() < 0.25 ? '#fffbeb' : '#fbbf24') : 'rgba(180, 83, 9, 0.66)',
      opacity: near ? 1 : 0.5,
      twinkle: api.range(3, 7),
      wander: near ? 46 : 22,
      glow: near ? 1.1 : 0.6,
    });
  }, { until: 3950 });

  // 宝石菱光：绕徽章的倾斜椭圆轨道环流（前亮后暗）
  api.every(240, () => {
    let a = api.range(0, TAU);
    const rr = api.range(150, 214);
    const w = api.range(0.9, 1.5);
    const baseSize = api.range(11, 20);
    api.spawn({
      x: cx + Math.cos(a) * rr,
      y: cy + Math.sin(a) * rr * 0.5,
      shape: 'glyph',
      glyph: '◆',
      size: baseSize,
      maxLife: api.range(1.2, 1.9),
      color: api.rng() < 0.22 ? '#f97316' : '#fde68a',
      spin: api.range(-1.4, 1.4),
      fadeIn: 0.2,
      fadeOut: 0.3,
      update: (p, dt) => {
        a += w * dt;
        const front = 0.5 + 0.5 * Math.sin(a);
        p.x = cx + Math.cos(a) * rr;
        p.y = cy + Math.sin(a) * rr * 0.5;
        p.size = baseSize * (0.62 + front * 0.5);
        p.opacity = 0.28 + front * 0.72;
      },
    });
  }, { from: 1050, until: 3700 });

  // 四芒星闪缀
  api.every(330, () => {
    api.spawn({
      x: cx + api.range(-260, 260), y: cy + api.range(-190, 190),
      shape: 'glyph', glyph: '✦', size: api.range(9, 16), endSize: 3,
      maxLife: api.range(0.7, 1.1), color: api.rng() < 0.5 ? '#fffbeb' : '#fde68a',
      twinkle: 9, fadeIn: 0.2, fadeOut: 0.4,
    });
  }, { from: 900, until: 3900 });

  // 上升冠环：自徽章缓缓浮起的光环
  api.every(780, () => {
    api.spawn({
      x: cx, y: cy + 10, vy: -44, shape: 'ring', size: 66, endSize: 104,
      maxLife: 1.3, color: '#fcd34d', opacity: 0.5, fadeIn: 0.12, fadeOut: 0.5,
    });
  }, { from: 1250, until: 3300 });

  // 中章再度致礼：第二次收束的小爆发
  api.at(2500, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 12, endSize: 130, maxLife: 0.45, color: '#fffbeb', glow: 1.8, fadeOut: 0.85 });
    api.burst({
      x: cx, y: cy, count: 54, speed: [60, 300],
      base: { shape: 'spark', size: 1.8, drag: 0.32, ay: 90, color: '#fcd34d', twinkle: 7, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 0.8 + rng() * 0.9;
        if (rng() < 0.2) p.color = '#f97316';
      },
    });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 40, endSize: 260, maxLife: 0.9, color: '#fde68a', opacity: 0.7, fadeOut: 0.7 });
  });

  // ── 幕三（exit）：终章金雨 + 二次碎光 + 光束收束后的余温
  api.at(3950, () => {
    api.burst({
      x: cx, y: cy - api.height * 0.22, count: 84, speed: [120, 380],
      angle: [Math.PI * 0.16, Math.PI * 0.84],
      base: { shape: 'spark', size: 1.8, ay: 250, drag: 0.5, color: '#fcd34d', twinkle: 8, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 0.7 + rng() * 0.8;
        if (rng() < 0.2) p.color = '#fffbeb';
      },
    });
  });
  api.at(4180, () => {
    api.burst({
      x: cx, y: cy - api.height * 0.12, count: 30, speed: [80, 240],
      angle: [Math.PI * 0.2, Math.PI * 0.8],
      base: { shape: 'spark', size: 1.4, ay: 220, drag: 0.5, color: '#fde68a', twinkle: 10, glow: 1 },
      vary: (p, rng) => {
        p.maxLife = 0.5 + rng() * 0.5;
      },
    });
  });
  api.at(4430, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 40, endSize: 6, maxLife: 0.34, color: '#fde68a', glow: 1.6, fadeOut: 0.6 });
  });
  api.every(90, () => {
    api.spawn({
      x: cx + api.range(-140, 140), y: cy + api.range(-100, 100),
      shape: 'dot', size: api.range(0.9, 1.8), maxLife: api.range(0.6, 1),
      color: api.pick(GOLDS), glow: 0.9, wander: 30, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: 4100, until: api.duration - 260 });
};
</script>

<template>
  <div class="crown-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.crown" :scene="scene" />
    <div class="crown-emblem">
      <small class="crown-code">SOVEREIGN RITE</small>
      <Crown :size="52" />
      <strong>荣耀加冕</strong>
      <small class="crown-meta">CROWN PROTOCOL · AUTH 08</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crown-effect {
  @include effect-stage(hidden);
}

.crown-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 76vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(254, 240, 138, 0.38), rgba(250, 204, 21, 0.18) 34%, transparent 70%);
  filter: blur(10px);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.62);
  animation: crown-aura 4.8s ease both;
}

.crown-emblem {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 202px;
  height: 202px;
  border: 1px solid rgba(250, 204, 21, 0.56);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 32%, rgba(255, 255, 255, 0.98), rgba(254, 243, 199, 0.9) 42%, rgba(202, 138, 4, 0.2) 100%),
    linear-gradient(135deg, rgba(250, 204, 21, 0.28), transparent);
  color: #854d0e;
  display: grid;
  gap: 7px;
  place-items: center;
  align-content: center;
  padding: 0;
  box-shadow:
    0 34px 90px rgba(66, 32, 6, 0.28),
    0 0 70px rgba(250, 204, 21, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden;
  transform: translate(-50%, -50%);
  animation: crown-emblem 4.8s ease both;
}

.crown-emblem::before {
  content: '';
  position: absolute;
  inset: -18px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(250, 204, 21, 0.76), rgba(255, 255, 255, 0.74), transparent 42%);
  opacity: 0.72;
  animation: crown-rotate 2.8s linear infinite;
}

.crown-emblem::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 0 38%, rgba(255, 255, 255, 0.72) 47%, transparent 57%);
  transform: translateX(-120%);
  animation: crown-shine 2.1s ease-in-out 560ms both;
}

.crown-emblem svg {
  position: relative;
  z-index: 1;
  color: #ca8a04;
  filter: drop-shadow(0 12px 24px rgba(202, 138, 4, 0.34));
}

.crown-emblem strong {
  position: relative;
  z-index: 1;
  font-size: 18px;
  letter-spacing: 0.1em;
}

.crown-emblem small {
  position: relative;
  z-index: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.24em;
  color: rgba(133, 77, 14, 0.72);
}

:root[data-theme='dark'] .crown-emblem {
  border-color: rgba(250, 204, 21, 0.42);
  background:
    radial-gradient(circle at 50% 30%, rgba(250, 204, 21, 0.28), rgba(22, 29, 41, 0.92) 58%),
    rgba(22, 29, 41, 0.9);
  color: #fde68a;
}

:root[data-theme='dark'] .crown-emblem small {
  color: rgba(253, 230, 138, 0.6);
}

@keyframes crown-aura {
  0%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.62);
  }
  20%,
  80% {
    opacity: 1;
  }
  54% {
    transform: translate(-50%, -50%) scale(1.12);
  }
}

@keyframes crown-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes crown-shine {
  to {
    transform: translateX(120%);
  }
}

@keyframes crown-emblem {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.88);
  }
  13% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  15% {
    transform: translate(-50%, -50%) scale(1.05);
  }
  18%,
  76% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}
</style>
