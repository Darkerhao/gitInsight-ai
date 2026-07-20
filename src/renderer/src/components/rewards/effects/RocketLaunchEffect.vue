<script setup lang="ts">
import { Rocket } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const IGNITE_AT = 2600;
const LIFT_AT = 3000;

const scene: SceneFn = (api) => {
  api.setTrail(0.26);
  const cx = api.width / 2;
  const padY = api.height * 0.8;
  const rocketPos = { x: cx, y: padY };

  // 幕一：倒计时 3-2-1（巨型数字 + 冲击环）
  ['3', '2', '1'].forEach((digit, i) => {
    api.at(200 + i * 800, () => {
      api.spawn({
        x: cx, y: api.height * 0.42, shape: 'glyph', glyph: digit,
        size: 96, endSize: 168, maxLife: 0.72, color: '#fff7ed',
        font: '900 96px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.06, fadeOut: 0.5,
      });
      api.spawn({
        x: cx, y: api.height * 0.42, shape: 'ring', size: 40, endSize: 190,
        maxLife: 0.66, color: '#fb923c', opacity: 0.7, fadeOut: 0.6,
      });
    });
  });

  // 幕二：点火 —— 烈焰下喷反溅 + 浓烟横滚
  api.every(14, () => {
    api.burst({
      x: rocketPos.x + api.range(-8, 8), y: Math.min(rocketPos.y + 16, padY + 4),
      count: 7, speed: [140, 420],
      angle: [Math.PI * 0.3, Math.PI * 0.7],
      base: { shape: 'spark', size: 2.6, maxLife: 0.7, glow: 1.2, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() > 0.6 ? '#fff7ed' : rng() > 0.4 ? '#fdba74' : '#f97316';
        // 触地反溅
        p.update = (pt) => {
          if (pt.y > padY + 6 && pt.vy > 0) {
            pt.vy *= -0.42;
            pt.vx *= 1.5;
          }
        };
      },
    });
  }, { from: IGNITE_AT, until: 4400 });
  api.every(60, () => {
    const side = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: rocketPos.x + side * api.range(16, 60), y: padY + api.range(-4, 8),
      vx: side * api.range(50, 150), vy: api.range(-24, -4),
      shape: 'dot', size: api.range(16, 30), endSize: api.range(44, 66),
      maxLife: api.range(1.4, 2.2), color: 'rgba(168, 162, 158, 0.6)', glow: 0,
      opacity: 0.16, drag: 0.5, wander: 20, fadeIn: 0.14, fadeOut: 0.4,
    });
  }, { from: IGNITE_AT, until: 4600 });

  // 幕三：升空 —— 火箭加速冲出屏顶 + 尾焰 + 级段分离
  api.at(LIFT_AT, () => {
    api.spawn({
      x: rocketPos.x, y: rocketPos.y, shape: 'spark', size: 5, maxLife: 2.4,
      color: '#fff7ed', glow: 2, fadeIn: 0.02, fadeOut: 0.08,
      update: (p, dt) => {
        p.vy -= 420 * dt;
        rocketPos.x = p.x;
        rocketPos.y = p.y;
        if (p.y < -40) p.life = p.maxLife;
      },
    });
  });
  api.every(16, () => {
    if (rocketPos.y >= padY || rocketPos.y < -20) return;
    api.spawn({
      x: rocketPos.x + api.range(-3, 3), y: rocketPos.y + 14,
      vy: api.range(120, 300), vx: api.range(-26, 26),
      shape: 'streak', stretch: 0.07, size: api.range(1.8, 3.2), maxLife: 0.6,
      color: api.pick(['#fdba74', '#f97316', '#fff7ed']), glow: 1.2, fadeOut: 0.4,
    });
  }, { from: LIFT_AT + 40, until: 5200 });
  api.at(4300, () => {
    [-1, 1].forEach((side) => {
      api.spawn({
        x: rocketPos.x + side * 8, y: rocketPos.y,
        vx: side * api.range(36, 70), vy: api.range(20, 60),
        shape: 'rect', size: 9, maxLife: 1.8, color: '#e7e5e4', glow: 0,
        composite: 'source-over', opacity: 0.85, ay: 200, spin: side * 3.4,
        flutter: 0.8, drag: 0.6, fadeOut: 0.3,
      });
    });
  });
  // 尾迹凝成贯穿光柱
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < LIFT_AT + 500) return;
    const alpha = Math.min(0.5, (tMs - LIFT_AT - 500) / 1400) * Math.max(0, Math.min(1, (api.duration - 400 - tMs) / 600));
    if (alpha <= 0.02) return;
    const topY = Math.max(-20, rocketPos.y);
    const grad = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
    grad.addColorStop(0, 'rgba(253, 186, 116, 0)');
    grad.addColorStop(0.5, `rgba(255, 247, 237, ${alpha})`);
    grad.addColorStop(1, 'rgba(253, 186, 116, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 12, topY, 24, padY - topY);
  });
};
</script>

<template>
  <div class="rocket-launch-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.rocketLaunch" :scene="scene" />
    <div class="launch-tower">
      <span class="launch-beacon" />
    </div>
    <div class="launch-title">
      <Rocket :size="26" />
      <strong>LIFTOFF</strong>
      <small>DAWN-7 MISSION · T+00:00:04</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rocket-launch-effect {
  @include effect-stage(hidden);
  animation: launch-shake 6.2s ease both;
}

.launch-tower {
  position: absolute;
  left: calc(50% + 60px);
  bottom: 14%;
  width: 26px;
  height: 210px;
  background:
    linear-gradient(90deg, transparent 0 42%, rgba(148, 163, 184, 0.6) 42% 58%, transparent 58%),
    repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.5) 0 2px, transparent 2px 20px);
  animation: launch-tower 6.2s ease both;
}

.launch-beacon {
  position: absolute;
  left: 50%;
  top: -7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f87171;
  box-shadow: 0 0 12px rgba(248, 113, 113, 0.9);
  transform: translateX(-50%);
  animation: launch-beacon 0.9s ease infinite;
}

.launch-title {
  position: absolute;
  left: 50%;
  top: 14%;
  color: #ffedd5;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 18px rgba(249, 115, 22, 0.7);
  transform: translateX(-50%);
  animation: launch-title 6.2s ease both;
}

.launch-title strong {
  font-size: 24px;
  letter-spacing: 0.34em;
}

.launch-title small {
  color: rgba(255, 237, 213, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

@keyframes launch-beacon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.24; }
}

@keyframes launch-tower {
  0%, 8% { opacity: 0; }
  14%, 80% { opacity: 1; }
  92%, 100% { opacity: 0; }
}

@keyframes launch-title {
  0%, 72% { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  80%, 94% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.9; }
}

@keyframes launch-shake {
  0%, 41% { transform: translate(0, 0); }
  43% { transform: translate(-3px, 2px); }
  46% { transform: translate(3px, -2px); }
  49% { transform: translate(-3px, -1px); }
  52% { transform: translate(3px, 2px); }
  55% { transform: translate(-2px, 1px); }
  58% { transform: translate(2px, -1px); }
  61% { transform: translate(-1px, 1px); }
  64%, 100% { transform: translate(0, 0); }
}
</style>
