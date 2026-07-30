<script setup lang="ts">
import { Sun } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 日冕风暴 CLASS-X FLARE · 5.6s
 * 幕一 0-700ms    左下巨日边缘显影，日面颗粒对流沸腾，日冕霞光呼吸
 * 幕二 1150-2400  四条磁力线弧梯次升起，足点灼烧、弧顶噼啪；2400ms 磁重联白闪 →
 *                 CME 大团抛射冲向对角（激波前沿环 + 等离子团 + 丝状拖尾），2650ms 二次噼啪
 * 幕三 3400-4750  三层纵深粒子风横掠全屏，右上泛起蓝青极光帘余韵
 * 配色：白热核心 + 橙主色（#fb923c）辉光 + 蓝辅色（#93c5fd）点缀
 */
const SNAP_AT = 2400;

const scene: SceneFn = (api) => {
  api.setTrail(0.24);
  // 巨日圆心在屏外左下
  const sunX = -api.width * 0.14;
  const sunY = api.height * 1.16;
  const sunR = Math.min(api.width, api.height) * 0.66;

  // ── 幕一：日面边缘（双层弧 + 呼吸日冕霞光）──
  api.onFrame((tMs, _dt, ctx) => {
    const fade = Math.min(1, tMs / 500) * Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 600));
    if (fade <= 0.02) return;
    const breathe = 1 + Math.sin(tMs / 640) * 0.14;
    ctx.strokeStyle = `rgba(251, 146, 60, ${0.7 * fade})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, -0.9, 0.3);
    ctx.stroke();
    ctx.strokeStyle = `rgba(254, 215, 170, ${0.24 * breathe * fade})`;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR + 15, -0.86, 0.24);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 247, 237, ${0.1 * breathe * fade})`;
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR + 40, -0.8, 0.18);
    ctx.stroke();
  });
  // 颗粒对流：日面沸腾微火花
  api.every(28, () => {
    const a = api.range(-0.82, 0.2);
    api.spawn({
      x: sunX + Math.cos(a) * (sunR + api.range(-8, 10)),
      y: sunY + Math.sin(a) * (sunR + api.range(-8, 10)),
      vx: Math.cos(a) * api.range(14, 60),
      vy: Math.sin(a) * api.range(14, 60),
      shape: 'spark', size: api.range(1.4, 2.8), maxLife: api.range(0.4, 0.9),
      color: api.pick(['#fdba74', '#fb923c', '#fde68a']),
      glow: 1.1, drag: 0.4, fadeOut: 0.4,
    });
  }, { until: api.duration - 900 });
  // 日珥：limb 随机小腾起（次级系统）
  api.every(420, () => {
    const a = api.range(-0.78, 0.14);
    api.burst({
      x: sunX + Math.cos(a) * (sunR + 4),
      y: sunY + Math.sin(a) * (sunR + 4),
      count: 6, speed: [50, 170],
      angle: [a - 0.5, a + 0.5],
      base: { shape: 'spark', size: 1.8, maxLife: 0.7, color: '#fed7aa', glow: 1.2, drag: 0.42, ay: 30, fadeOut: 0.5 },
    });
  }, { from: 300, until: 2100 });

  // ── 幕二：磁力线弧（四条梯次升起，smoothstep 缓动）──
  const loops = Array.from({ length: 4 }, (_, i) => {
    const a = api.range(-0.66, -0.04) + i * 0.05;
    const a2 = a + api.range(0.1, 0.18);
    const mid = (a + a2) / 2;
    const h = api.range(120, 210) + i * 34;
    return {
      foot1: { x: sunX + Math.cos(a) * sunR, y: sunY + Math.sin(a) * sunR },
      foot2: { x: sunX + Math.cos(a2) * sunR, y: sunY + Math.sin(a2) * sunR },
      apex: { x: sunX + Math.cos(mid) * (sunR + h), y: sunY + Math.sin(mid) * (sunR + h) },
      ctrl: { x: sunX + Math.cos(mid) * (sunR + h * 2.1), y: sunY + Math.sin(mid) * (sunR + h * 2.1) },
      riseAt: 1150 + i * 300,
    };
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 1150 || tMs > SNAP_AT + 150) return;
    for (const loop of loops) {
      if (tMs < loop.riseAt) continue;
      const raw = Math.min(1, (tMs - loop.riseAt) / 420);
      const rise = raw * raw * (3 - 2 * raw); // smoothstep 升起
      const snap = tMs > SNAP_AT ? Math.max(0, 1 - (tMs - SNAP_AT) / 150) : 1;
      const grad = ctx.createLinearGradient(loop.foot1.x, loop.foot1.y, loop.apex.x, loop.apex.y);
      grad.addColorStop(0, `rgba(251, 146, 60, ${0.3 * rise * snap})`);
      grad.addColorStop(1, `rgba(254, 240, 217, ${0.76 * rise * snap})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(loop.foot1.x, loop.foot1.y);
      ctx.quadraticCurveTo(
        loop.foot1.x + (loop.ctrl.x - loop.foot1.x) * rise,
        loop.foot1.y + (loop.ctrl.y - loop.foot1.y) * rise,
        loop.foot2.x, loop.foot2.y
      );
      ctx.stroke();
    }
  });
  // 足点灼烧：已升起弧的足点持续冒火
  api.every(110, (i) => {
    const now = 1300 + i * 110;
    const risen = loops.filter((l) => l.riseAt + 160 < now);
    if (risen.length === 0) return;
    const loop = api.pick(risen);
    const foot = api.rng() > 0.5 ? loop.foot1 : loop.foot2;
    api.spawn({
      x: foot.x + api.range(-4, 4), y: foot.y + api.range(-4, 4),
      vx: api.range(-30, 30), vy: api.range(-70, -20),
      shape: 'spark', size: api.range(1.4, 2.4), maxLife: 0.5,
      color: '#fff7ed', glow: 1.3, drag: 0.4, fadeOut: 0.5,
    });
  }, { from: 1300, until: SNAP_AT });
  // 弧顶噼啪：断裂前的应力预兆
  api.every(190, (i) => {
    const now = 1700 + i * 190;
    const risen = loops.filter((l) => l.riseAt + 260 < now);
    if (risen.length === 0) return;
    const loop = api.pick(risen);
    api.burst({
      x: loop.apex.x + api.range(-8, 8), y: loop.apex.y + api.range(-8, 8),
      count: 3, speed: [20, 90],
      base: { shape: 'spark', size: 1.2, maxLife: 0.4, color: '#fde68a', glow: 1, drag: 0.4, fadeOut: 0.6 },
    });
  }, { from: 1700, until: SNAP_AT - 60 });

  // ── 2400ms 磁重联：白闪 + CME 大团抛射 + 激波前沿 ──
  api.at(SNAP_AT, () => {
    const apex = loops[1].apex;
    api.spawn({ x: apex.x, y: apex.y, shape: 'dot', size: 14, endSize: 230, maxLife: 0.6, color: '#fff7ed', glow: 2.2, fadeOut: 0.9 });
    api.spawn({
      x: apex.x, y: apex.y, shape: 'ring', size: 30,
      endSize: Math.max(api.width, api.height) * 0.85,
      maxLife: 1.1, color: '#fdba74', opacity: 0.8, fadeOut: 0.75,
    });
    // 等离子体主浪：丝状拖尾冲向右上对角
    api.burst({
      x: apex.x, y: apex.y, count: 130, speed: [180, 660],
      angle: [-1.1, -0.2],
      base: { shape: 'streak', stretch: 0.09, size: 2.4, maxLife: 1.5, glow: 1.15, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#fb923c' : rng() > 0.45 ? '#fde68a' : '#fff7ed';
        p.maxLife = 0.8 + rng() * 1.1;
        if (rng() > 0.85) p.twinkle = 3 + rng() * 4;
      },
    });
    // 等离子团：大颗辉光核团随浪同行（近大远小的"团块"层）
    api.burst({
      x: apex.x, y: apex.y, count: 8, speed: [220, 420],
      angle: [-0.95, -0.35],
      base: { shape: 'dot', size: 7, maxLife: 1.5, color: '#fdba74', glow: 1.5, drag: 0.55, wander: 40, fadeOut: 0.5 },
      vary: (p, rng) => {
        p.size = 5 + rng() * 9;
        p.endSize = p.size * 0.5;
        if (rng() > 0.7) p.color = '#fed7aa';
      },
    });
  });
  // 2650ms 二次噼啪：邻弧连锁断裂的小抛射
  api.at(2650, () => {
    const apex = loops[2].apex;
    api.spawn({ x: apex.x, y: apex.y, shape: 'dot', size: 8, endSize: 110, maxLife: 0.45, color: '#ffedd5', glow: 1.8, fadeOut: 0.85 });
    api.burst({
      x: apex.x, y: apex.y, count: 44, speed: [140, 460],
      angle: [-1.05, -0.3],
      base: { shape: 'streak', stretch: 0.08, size: 1.8, maxLife: 1.1, color: '#fdba74', glow: 1, drag: 0.5, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() > 0.6) p.color = '#fde68a';
      },
    });
  });

  // ── 幕三：三层纵深粒子风横掠（近亮大快 / 远暗小慢）──
  const spawnWind = (depth: number) => {
    api.spawn({
      x: api.range(-30, api.width * 0.3),
      y: api.height * (0.42 + api.rng() * 0.55),
      vx: api.range(320, 620) * (0.5 + depth * 0.6),
      vy: api.range(-260, -140) * (0.5 + depth * 0.6),
      shape: 'streak',
      stretch: 0.05 + depth * 0.025,
      size: api.range(1, 1.8) * (0.6 + depth * 0.7),
      opacity: 0.3 + depth * 0.7,
      maxLife: 1.1,
      color: depth > 0.85 ? api.pick(['#fff7ed', '#fdba74']) : api.pick(['#fdba74', '#fb923c', '#fde68a']),
      glow: 0.5 + depth * 0.5,
      fadeIn: 0.08, fadeOut: 0.2,
    });
  };
  api.every(22, () => spawnWind(api.pick([0.5, 0.8, 1])), { from: 3400, until: api.duration - 900 });

  // 极光帘：右上蓝青正弦光带（辅色余韵）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 3700) return;
    const fade = Math.min(1, (tMs - 3700) / 600) * Math.max(0, Math.min(1, (api.duration - 300 - tMs) / 500));
    if (fade <= 0.02) return;
    const tints = ['147, 197, 253', '165, 243, 252', '110, 231, 183'];
    for (let band = 0; band < 3; band += 1) {
      ctx.strokeStyle = `rgba(${tints[band]}, ${(0.2 - band * 0.05) * fade})`;
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
  // 极光尘：帘下缓浮的蓝色微尘
  api.every(150, () => {
    api.spawn({
      x: api.range(api.width * 0.52, api.width * 0.96),
      y: api.height * api.range(0.1, 0.26),
      vy: api.range(-24, -8), vx: api.range(-10, 10),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.7, 1.2),
      color: api.pick(['#93c5fd', '#a5f3fc']),
      glow: 0.9, twinkle: 3, wander: 26, fadeOut: 0.5,
    });
  }, { from: 3900, until: api.duration - 900 });
};
</script>

<template>
  <div class="solar-flare-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.solarFlare" :scene="scene" />
    <div class="flare-hud">
      <Sun :size="24" />
      <strong>日冕风暴</strong>
      <small>CLASS-X FLARE · X9.3</small>
      <small class="flare-hud-dim">CME 2100 KM/S · VECTOR LOCKED</small>
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
  gap: 4px;
  justify-items: start;
  padding: 12px 18px;
  backdrop-filter: blur(4px);
  animation: flare-hud 5.6s ease both;
}

.flare-hud strong {
  font-size: 15px;
  letter-spacing: 0.16em;
}

.flare-hud small {
  color: rgba(254, 215, 170, 0.82);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
}

.flare-hud .flare-hud-dim {
  color: rgba(254, 215, 170, 0.52);
  font-size: 9px;
}

@keyframes flare-hud {
  0%, 30% { opacity: 0; transform: translateX(18px); }
  40%, 88% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; }
}

@keyframes flare-camera {
  0% { opacity: 0; transform: scale(1.08); }
  8% { opacity: 1; }
  36% { transform: scale(1); }
  42% { transform: scale(0.985); }
  46% { transform: scale(1.05); }
  50% { transform: scale(1.03); }
  56% { transform: scale(1.01); }
  100% { opacity: 0; transform: scale(1.05); }
}
</style>
