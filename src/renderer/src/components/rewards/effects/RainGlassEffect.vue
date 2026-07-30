<script setup lang="ts">
import { CloudRain } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 雨幕舷窗 STORMGLASS · 5400ms（entry 700 / loop 3800 / exit 900）
 * 三幕：夜色显影 + 雨幕渐起 → 三层视差雨 + 玻璃水珠 + 双闪电（预闪/分叉/回声）→ 雨势层层收歇
 */
const scene: SceneFn = (api) => {
  api.setTrail(0.4);
  const W = api.width;
  const H = api.height;

  // ── 三层视差雨幕：远层细暗慢 / 中层 / 近层粗亮快（近层落地溅花 + 涟漪） ──
  const rainLayer = (
    interval: number, from: number, until: number,
    speed: [number, number], size: [number, number],
    color: string, glow: number, opacity: number, splash: boolean
  ) => {
    api.every(interval, () => {
      const v = api.range(speed[0], speed[1]);
      api.spawn({
        x: api.range(-40, W + 60), y: -20,
        vx: -v * 0.14, vy: v,
        shape: 'streak', stretch: 0.035,
        size: api.range(size[0], size[1]),
        maxLife: (H + 60) / v,
        color, glow, opacity,
        fadeIn: 0.04, fadeOut: 0.06,
        onDeath: splash
          ? (p, sceneApi) => {
              if (sceneApi.rng() < 0.32) {
                sceneApi.burst({
                  x: p.x, y: H - 4, count: 4, speed: [30, 150],
                  angle: [Math.PI + 0.3, Math.PI * 2 - 0.3],
                  base: { shape: 'spark', size: 1, maxLife: 0.3, ay: 520, color: 'rgba(186, 230, 253, 0.8)', glow: 0.7 },
                });
                sceneApi.spawn({
                  x: p.x, y: H - 5, shape: 'ring', size: 2, endSize: 12,
                  maxLife: 0.3, color: 'rgba(125, 211, 252, 0.5)', opacity: 0.45, fadeOut: 0.6,
                });
              }
            }
          : undefined,
      });
    }, { from, until });
  };
  rainLayer(26, 300, api.duration - 800, [480, 720], [0.7, 1.1], 'rgba(148, 197, 233, 0.5)', 0.3, 0.5, false);
  rainLayer(14, 420, api.duration - 1200, [800, 1150], [1, 1.5], 'rgba(186, 230, 253, 0.7)', 0.45, 0.75, false);
  rainLayer(10, 650, api.duration - 950, [1200, 1700], [1.4, 2], 'rgba(224, 242, 254, 0.85)', 0.6, 0.9, true);

  // 2450ms：一阵横风 —— 雨丝短暂被吹斜掠过玻璃
  api.every(22, () => {
    api.spawn({
      x: api.range(-30, W * 0.7), y: api.range(0, H * 0.8),
      vx: api.range(700, 1100), vy: api.range(140, 260),
      shape: 'streak', stretch: 0.045, size: api.range(0.8, 1.4), maxLife: 0.34,
      color: 'rgba(165, 213, 245, 0.55)', glow: 0.4, opacity: 0.5, fadeIn: 0.06, fadeOut: 0.3,
    });
  }, { from: 2450, until: 2680 });

  // ── 玻璃水珠：蠕行下滑（拖出细亮痕），偶发急滑；冷凝微珠驻留闪烁 ──
  api.every(150, () => {
    let slide = api.range(4, 16);
    api.spawn({
      x: api.range(W * 0.08, W * 0.92), y: api.range(H * 0.04, H * 0.6),
      vy: slide, shape: 'streak', stretch: 0.03,
      size: api.range(1.4, 2.9), maxLife: api.range(1.6, 3),
      color: 'rgba(224, 242, 254, 0.85)', glow: 0.7,
      fadeIn: 0.2, fadeOut: 0.3,
      update: (p, dt) => {
        if (api.rng() < 0.004) slide = api.range(140, 320); // 突然急滑
        slide = Math.max(4, slide - slide * 0.7 * dt); // 滑落后再减速蠕行
        p.vy = slide;
        p.x += Math.sin(p.life * 3 + p.phase) * 5 * dt;
      },
    });
  }, { from: 500, until: api.duration - 1100 });
  api.at(820, () => {
    for (let i = 0; i < 22; i += 1) {
      api.spawn({
        x: api.rng() * W, y: api.rng() * H * 0.9,
        shape: 'dot', size: api.range(0.7, 1.5), maxLife: api.range(1.8, 3.4),
        color: 'rgba(207, 233, 252, 0.7)', glow: 0.5, opacity: api.range(0.25, 0.5),
        twinkle: api.range(0.8, 2), fadeIn: 0.2, fadeOut: 0.3,
      });
    }
  });

  // ── 闪电：预闪 → 分叉锯齿主干 → 端点炸花 → 180ms 回声闪 ──
  let sceneTime = 0;
  const bolts: Array<{ points: Array<[number, number]>; born: number; life: number; width: number }> = [];
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
      ctx.lineWidth = bolt.width;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
      for (const [px, py] of bolt.points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  });
  const strike = (when: number) => {
    // 预闪：云层深处的暗弱泛光
    api.at(when - 140, () => {
      api.spawn({ x: api.range(W * 0.3, W * 0.7), y: 40, shape: 'dot', size: 90, endSize: 40, maxLife: 0.16, color: 'rgba(199, 226, 245, 0.3)', glow: 1.6, fadeIn: 0, fadeOut: 0.7 });
    });
    api.at(when, () => {
      let x = api.range(W * 0.2, W * 0.8);
      let y = -10;
      const main: Array<[number, number]> = [[x, y]];
      while (y < H * api.range(0.42, 0.64)) {
        x += api.range(-60, 60);
        y += api.range(30, 80);
        main.push([x, y]);
      }
      bolts.push({ points: main, born: sceneTime, life: 0.34, width: 2.2 });
      // 分叉支线：自主干中段岔出两条细枝
      for (let b = 0; b < 2; b += 1) {
        const start = main[Math.max(1, Math.floor(api.range(1, main.length - 1)))];
        let bx = start[0];
        let by = start[1];
        const branch: Array<[number, number]> = [[bx, by]];
        const drift = api.rng() < 0.5 ? -1 : 1;
        for (let s = 0; s < 3; s += 1) {
          bx += drift * api.range(18, 52);
          by += api.range(20, 48);
          branch.push([bx, by]);
        }
        bolts.push({ points: branch, born: sceneTime, life: 0.24, width: 1.1 });
      }
      api.spawn({ x: main[0][0], y: 60, shape: 'dot', size: 120, endSize: 30, maxLife: 0.3, color: 'rgba(224, 242, 254, 0.5)', glow: 2, fadeIn: 0, fadeOut: 0.8 });
      const tip = main[main.length - 1];
      api.burst({
        x: tip[0], y: tip[1], count: 12, speed: [60, 280],
        base: { shape: 'spark', size: 1.4, maxLife: 0.5, drag: 0.3, color: '#bae6fd', glow: 1.1, twinkle: 10 },
      });
      // 玻璃上的反光水珠齐闪一瞬
      api.spawn({ x: tip[0], y: tip[1], shape: 'ring', size: 8, endSize: 90, maxLife: 0.4, color: 'rgba(186, 230, 253, 0.6)', opacity: 0.55, fadeOut: 0.6 });
    });
    // 回声闪：主干消隐后的余光
    api.at(when + 180, () => {
      api.spawn({ x: api.range(W * 0.3, W * 0.7), y: 50, shape: 'dot', size: 70, endSize: 26, maxLife: 0.18, color: 'rgba(214, 237, 251, 0.35)', glow: 1.6, fadeIn: 0, fadeOut: 0.7 });
    });
  };
  strike(1450);
  strike(3250);

  // ── 尾声：雨歇雾散 —— 玻璃雾气上浮消散 ──
  api.every(110, () => {
    api.spawn({
      x: api.range(W * 0.2, W * 0.8), y: api.range(H * 0.5, H * 0.9),
      vy: api.range(-26, -10), shape: 'dot', size: api.range(10, 20), endSize: api.range(26, 40),
      maxLife: api.range(0.7, 1.1), color: 'rgba(148, 184, 216, 0.5)', glow: 0,
      opacity: 0.1, composite: 'source-over', wander: 14, fadeIn: 0.25, fadeOut: 0.45,
    });
  }, { from: api.duration - 950, until: api.duration - 350 });
};
</script>

<template>
  <div class="rain-glass-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.rainGlass" :scene="scene" />
    <div class="rain-glass-pane">
      <CloudRain :size="50" />
      <strong>雨幕舷窗</strong>
      <small>STORMGLASS · CABIN 07 · ΔP NOMINAL</small>
      <span />
      <span />
      <span />
    </div>
  </div>
</template>

<style scoped lang="scss">
.rain-glass-effect {
  @include effect-stage(hidden);
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
  gap: 10px;
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
  animation: rain-glare 2.2s ease-in-out 700ms both;
}

.rain-glass-pane::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 24%, rgba(255, 255, 255, 0.42) 0 3px, transparent 4px),
    radial-gradient(circle at 76% 30%, rgba(255, 255, 255, 0.32) 0 2px, transparent 3px),
    radial-gradient(circle at 64% 76%, rgba(255, 255, 255, 0.28) 0 3px, transparent 4px),
    radial-gradient(circle at 34% 64%, rgba(255, 255, 255, 0.24) 0 2px, transparent 3px),
    linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.08));
  opacity: 0;
  animation: rain-droplets 5.4s ease both;
}

.rain-glass-pane svg,
.rain-glass-pane strong,
.rain-glass-pane small,
.rain-glass-pane span {
  position: relative;
  z-index: 1;
}

.rain-glass-pane strong {
  font-size: 16px;
  letter-spacing: 0.14em;
}

.rain-glass-pane small {
  color: rgba(186, 230, 253, 0.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.22em;
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
  13%, 84% { opacity: 1; }
}

/* 与 canvas 双闪电对齐：26.9%（预闪 24.3%）与 60.2%（回声 63.5%） */
@keyframes rain-lightning {
  0%, 23%, 33%, 58%, 68%, 100% { opacity: 0; }
  24.5% { opacity: 0.14; }
  27% { opacity: 0.62; }
  29% { opacity: 0.08; }
  30.5% { opacity: 0.3; }
  60.5% { opacity: 0.55; }
  62% { opacity: 0.1; }
  63.5% { opacity: 0.28; }
}

@keyframes rain-glass-pane {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.9); filter: blur(8px); }
  17%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
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
