<script setup lang="ts">
import { Rocket } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 曙光发射 DAWN ASCENT · 6200ms（entry 1000 / loop 4300 / exit 900）
 * 三幕：倒计时冲击（数字 + 双色环 + 排气）→ 点火反溅浓烟 + 拖焰升空（马赫环/级段抛离/Max-Q）→ 尾迹光柱定格
 */
const IGNITE_AT = 2200;
const LIFT_AT = 3050;

const scene: SceneFn = (api) => {
  api.setTrail(0.26);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const padY = H * 0.8;
  const rocketPos = { x: cx, y: padY };

  // ── 幕一：倒计时 3-2-1 —— 巨型等宽数字缩放冲击 + 主辅双色环 + 刻度火花 ──
  ['3', '2', '1'].forEach((digit, i) => {
    const when = 150 + i * 700;
    api.at(when, () => {
      api.spawn({
        x: cx, y: H * 0.4, shape: 'glyph', glyph: digit,
        size: 100, endSize: 176, maxLife: 0.66, color: '#fff7ed',
        font: '900 100px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.05, fadeOut: 0.5,
      });
      api.spawn({
        x: cx, y: H * 0.4, shape: 'ring', size: 40, endSize: 190,
        maxLife: 0.6, color: '#fb923c', opacity: 0.7, fadeOut: 0.6,
      });
      api.burst({
        x: cx, y: H * 0.4, count: 8, speed: [60, 160],
        base: { shape: 'spark', size: 1.5, maxLife: 0.4, color: '#fdba74', glow: 1, drag: 0.4, fadeOut: 0.5 },
      });
    });
    api.at(when + 90, () => {
      api.spawn({
        x: cx, y: H * 0.4, shape: 'ring', size: 60, endSize: 240,
        maxLife: 0.5, color: '#93c5fd', opacity: 0.4, fadeOut: 0.7,
      });
    });
  });

  // 1900ms：低温排气 —— 箭体两侧喷出冷蓝白汽（预示点火临近）
  api.every(60, () => {
    const side = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: cx + side * api.range(8, 16), y: padY - api.range(20, 70),
      vx: side * api.range(20, 56), vy: api.range(-8, 10),
      shape: 'dot', size: api.range(4, 8), endSize: api.range(12, 20),
      maxLife: api.range(0.5, 0.9), color: 'rgba(191, 219, 254, 0.7)', glow: 0.4,
      opacity: 0.3, drag: 0.5, wander: 16, fadeIn: 0.2, fadeOut: 0.4,
    });
  }, { from: 1900, until: 2150 });

  // ── 幕二：点火 —— 白闪 + 贴地冲击 + 高密度橙白火花触地反溅 + 浓烟横滚 ──
  api.at(IGNITE_AT, () => {
    api.spawn({ x: cx, y: padY + 6, shape: 'dot', size: 16, endSize: 120, maxLife: 0.4, color: '#fffbeb', glow: 2.2, fadeOut: 0.85 });
    [-1, 1].forEach((dir) => {
      api.burst({
        x: cx, y: padY + 2, count: 8, speed: [220, 520],
        angle: dir > 0 ? [-0.08, 0.1] : [Math.PI - 0.1, Math.PI + 0.08],
        base: { shape: 'streak', stretch: 0.06, size: 1.8, maxLife: 0.45, color: '#fed7aa', glow: 1, drag: 0.45, fadeOut: 0.4 },
      });
    });
  });
  api.every(14, () => {
    api.burst({
      x: rocketPos.x + api.range(-8, 8), y: Math.min(rocketPos.y + 16, padY + 4),
      count: 7, speed: [140, 430],
      angle: [Math.PI * 0.3, Math.PI * 0.7],
      base: { shape: 'spark', size: 2.6, maxLife: 0.7, glow: 1.2, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() > 0.6 ? '#fff7ed' : rng() > 0.4 ? '#fdba74' : '#f97316';
        p.update = (pt) => {
          if (pt.y > padY + 6 && pt.vy > 0) {
            pt.vy *= -0.42;
            pt.vx *= 1.5;
          }
        };
      },
    });
  }, { from: IGNITE_AT, until: 4300 });
  api.every(55, () => {
    const side = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: rocketPos.x + side * api.range(16, 64), y: padY + api.range(-4, 8),
      vx: side * api.range(50, 160), vy: api.range(-26, -4),
      shape: 'dot', size: api.range(16, 30), endSize: api.range(44, 68),
      maxLife: api.range(1.4, 2.2), color: 'rgba(168, 162, 158, 0.6)', glow: 0,
      opacity: 0.16, composite: 'source-over', drag: 0.5, wander: 20, fadeIn: 0.14, fadeOut: 0.4,
    });
  }, { from: IGNITE_AT, until: 4500 });

  // ── 幕三：升空 —— 白热箭体加速冲顶，长尾焰 + 马赫环 + 级段抛离 + Max-Q ──
  api.at(LIFT_AT, () => {
    api.spawn({
      x: rocketPos.x, y: rocketPos.y, shape: 'spark', size: 5, maxLife: 2.4,
      color: '#fff7ed', glow: 2, fadeIn: 0.02, fadeOut: 0.08,
      update: (p, dt) => {
        p.vy -= 440 * dt;
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
  // 马赫环：尾焰中周期出现的蓝白激波亮斑
  api.every(120, (i) => {
    if (rocketPos.y >= padY - 30 || rocketPos.y < 0) return;
    api.spawn({
      x: rocketPos.x, y: rocketPos.y + 26 + (i % 3) * 13,
      shape: 'dot', size: 2.4, endSize: 1, maxLife: 0.26,
      color: i % 2 === 0 ? '#bfdbfe' : '#fffbeb', glow: 1.4, fadeIn: 0, fadeOut: 0.5,
    });
  }, { from: LIFT_AT + 200, until: 4900 });
  // 3900ms：Max-Q —— 白闪脉冲 + 音速环
  api.at(3900, () => {
    api.spawn({ x: rocketPos.x, y: rocketPos.y, shape: 'dot', size: 8, endSize: 40, maxLife: 0.3, color: '#f0f9ff', glow: 2, fadeOut: 0.8 });
    api.spawn({ x: rocketPos.x, y: rocketPos.y, shape: 'ring', size: 8, endSize: 90, maxLife: 0.45, color: '#93c5fd', opacity: 0.55, fadeOut: 0.7 });
  });
  // 4400ms：级段分离 —— 双侧箭段翻滚抛离 + 分离气浪
  api.at(4400, () => {
    api.spawn({ x: rocketPos.x, y: rocketPos.y + 6, shape: 'dot', size: 6, endSize: 26, maxLife: 0.3, color: 'rgba(219, 234, 254, 0.7)', glow: 1.2, fadeOut: 0.7 });
    [-1, 1].forEach((side) => {
      api.spawn({
        x: rocketPos.x + side * 8, y: rocketPos.y,
        vx: side * api.range(40, 76), vy: api.range(20, 60),
        shape: 'rect', size: 9, maxLife: 1.7, color: '#e7e5e4', glow: 0,
        composite: 'source-over', opacity: 0.85, ay: 210, spin: side * 3.4,
        flutter: 0.8, drag: 0.6, fadeOut: 0.3,
      });
      api.burst({
        x: rocketPos.x + side * 10, y: rocketPos.y, count: 5, speed: [40, 120],
        base: { shape: 'spark', size: 1.4, maxLife: 0.4, color: '#fdba74', glow: 1, drag: 0.5, fadeOut: 0.5 },
      });
    });
  });

  // 尾迹凝成贯穿光柱（宽度微呼吸），发射台余烬驻留
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < LIFT_AT + 500) return;
    const alpha = Math.min(0.5, (tMs - LIFT_AT - 500) / 1400) * Math.max(0, Math.min(1, (api.duration - 400 - tMs) / 600));
    if (alpha <= 0.02) return;
    const topY = Math.max(-20, rocketPos.y);
    const w = 12 + Math.sin(tMs / 160) * 2;
    const grad = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    grad.addColorStop(0, 'rgba(253, 186, 116, 0)');
    grad.addColorStop(0.5, `rgba(255, 247, 237, ${alpha})`);
    grad.addColorStop(1, 'rgba(253, 186, 116, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w, topY, w * 2, padY - topY);
  });
  api.at(4600, () => {
    for (let i = 0; i < 22; i += 1) {
      api.spawn({
        x: cx + api.range(-90, 90), y: padY + api.range(-10, 10),
        vy: api.range(-20, -6), shape: 'dot', size: api.range(0.9, 1.8),
        maxLife: api.range(0.9, 1.5), color: api.rng() < 0.5 ? '#fb923c' : '#fbbf24',
        glow: 1, wander: 18, twinkle: api.range(2, 4), fadeIn: 0.12, fadeOut: 0.4,
      });
    }
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
      <strong>曙光发射</strong>
      <small>DAWN ASCENT · LIFTOFF CONFIRMED · T+00:03</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rocket-launch-effect {
  @include effect-stage(hidden);
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
  animation: launch-beacon 0.7s ease infinite;
}

.launch-title {
  position: absolute;
  left: 50%;
  top: 13%;
  color: #ffedd5;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(249, 115, 22, 0.7);
  transform: translateX(-50%);
  animation: launch-title 6.2s ease both;
}

.launch-title strong {
  font-size: 20px;
  letter-spacing: 0.3em;
}

.launch-title small {
  color: rgba(255, 237, 213, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.22em;
}

@keyframes launch-beacon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.24; }
}

@keyframes launch-tower {
  0%, 6% { opacity: 0; }
  12%, 80% { opacity: 1; }
  92%, 100% { opacity: 0; }
}

@keyframes launch-title {
  0%, 70% { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  78%, 94% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.9; }
}
</style>
