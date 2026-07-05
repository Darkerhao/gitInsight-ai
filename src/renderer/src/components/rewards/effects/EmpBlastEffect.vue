<script setup lang="ts">
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const GLITCH_CHARS = '▓▒░#@%&$?!01'.split('');
const PULSE_AT = 1600;

const scene: SceneFn = (api) => {
  api.setTrail(0.36);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 幕一：充能 —— 核心电弧（每 80ms 重掷折线）+ 电荷汇聚
  let boltSeed = 0;
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > PULSE_AT) return;
    const ramp = Math.min(1, tMs / 500);
    const frame = Math.floor(tMs / 80);
    if (frame !== boltSeed) boltSeed = frame;
    const bolts = 3 + (frame % 2);
    for (let b = 0; b < bolts; b += 1) {
      // 以帧号+序号做伪随机，保证同帧稳定、换帧跳变
      const noise = (n: number) => {
        const v = Math.sin(boltSeed * 37.7 + b * 91.3 + n * 13.1) * 43758.5453;
        return v - Math.floor(v);
      };
      const targetA = noise(0) * Math.PI * 2;
      const targetR = 60 + noise(1) * 90;
      ctx.strokeStyle = `rgba(251, 191, 36, ${(0.5 + noise(2) * 0.4) * ramp})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let px = cx;
      let py = cy;
      for (let s = 1; s <= 5; s += 1) {
        px = cx + Math.cos(targetA) * (targetR * s / 5) + (noise(s + 3) - 0.5) * 30;
        py = cy + Math.sin(targetA) * (targetR * s / 5) + (noise(s + 9) - 0.5) * 30;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  });
  api.spawn({
    x: cx, y: cy, shape: 'dot', size: 10, maxLife: PULSE_AT / 1000,
    color: '#fde68a', glow: 1.8, fadeIn: 0.1, fadeOut: 0.06,
    update: (p) => {
      p.size = 10 + Math.sin(p.life * 16) * 3 + p.life * 8;
      p.endSize = p.size;
    },
  });
  api.every(40, () => {
    const a = api.range(0, Math.PI * 2);
    const r = api.range(130, 320);
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      vx: -Math.cos(a) * api.range(120, 260), vy: -Math.sin(a) * api.range(120, 260),
      shape: 'spark', size: 1.8, maxLife: r / 200, color: '#fbbf24', glow: 1, fadeOut: 0.2,
    });
  }, { until: PULSE_AT - 100 });

  // 幕二：脉冲爆发 —— 畸变环扩散，波前炸出乱码与火花雨
  api.at(PULSE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 300, maxLife: 0.55, color: '#fef9c3', glow: 2.2, fadeOut: 0.9 });
    [0, 130].forEach((delay, i) => {
      api.at(PULSE_AT + delay, () => {
        api.spawn({
          x: cx, y: cy, shape: 'ring', size: 26,
          endSize: Math.max(api.width, api.height) * (0.62 + i * 0.2),
          maxLife: 0.8, color: i === 0 ? '#fbbf24' : '#fef3c7', opacity: 0.9, fadeOut: 0.7,
        });
      });
    });
  });
  api.every(30, (index) => {
    const waveR = 40 + index * 30 * 0.9;
    for (let i = 0; i < 4; i += 1) {
      const a = api.range(0, Math.PI * 2);
      api.spawn({
        x: cx + Math.cos(a) * waveR, y: cy + Math.sin(a) * waveR,
        vx: Math.cos(a) * api.range(30, 90), vy: Math.sin(a) * api.range(30, 90) + 40,
        shape: 'glyph', glyph: api.pick(GLITCH_CHARS), size: api.range(10, 17),
        maxLife: api.range(0.5, 0.9), color: api.rng() > 0.4 ? '#fbbf24' : '#a8a29e',
        fadeOut: 0.4,
      });
    }
  }, { from: PULSE_AT + 40, until: 2400 });

  // 幕三：电网瘫痪 —— 四角残余电弧偶发闪跳
  [[0.08, 0.1], [0.92, 0.12], [0.1, 0.9], [0.9, 0.88]].forEach(([fx, fy], i) => {
    api.at(2700 + i * 420 + api.range(0, 240), () => {
      api.burst({
        x: api.width * fx, y: api.height * fy, count: 10, speed: [40, 180],
        base: { shape: 'spark', size: 1.6, maxLife: 0.4, color: '#fde68a', glow: 1.2, drag: 0.4, fadeOut: 0.5 },
      });
    });
  });
  api.every(70, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height * 0.4,
      vy: api.range(80, 180), shape: 'glyph', glyph: api.pick(GLITCH_CHARS),
      size: api.range(9, 13), maxLife: 1.2, color: 'rgba(168, 162, 158, 0.5)', fadeOut: 0.5,
    });
  }, { from: 2600, until: 4200 });
};
</script>

<template>
  <div class="emp-blast-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.empBlast" :scene="scene" />
    <div class="emp-glitch" data-text="⚠ EMP DISCHARGE">⚠ EMP DISCHARGE</div>
  </div>
</template>

<style scoped>
.emp-blast-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.emp-glitch {
  position: absolute;
  left: 50%;
  top: 20%;
  color: #fef3c7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.24em;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: emp-glitch-show 5s step-end both;
}

.emp-glitch::before,
.emp-glitch::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  opacity: 0.8;
}

.emp-glitch::before {
  color: #22d3ee;
  clip-path: inset(12% 0 58% 0);
  animation: emp-glitch-shift 0.42s steps(3) infinite;
}

.emp-glitch::after {
  color: #f87171;
  clip-path: inset(62% 0 8% 0);
  animation: emp-glitch-shift 0.36s steps(3) infinite reverse;
}

@keyframes emp-glitch-shift {
  0% { transform: translate(0, 0); }
  34% { transform: translate(-5px, 2px); }
  67% { transform: translate(4px, -2px); }
  100% { transform: translate(0, 0); }
}

@keyframes emp-glitch-show {
  0%, 30% { opacity: 0; }
  32% { opacity: 1; }
  36% { opacity: 0.2; }
  38% { opacity: 1; }
  44% { opacity: 0.4; }
  46%, 72% { opacity: 1; }
  80%, 100% { opacity: 0; }
}
</style>
