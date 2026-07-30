<script setup lang="ts">
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * EMP CASCADE · 电磁脉冲（5000ms = 700 entry + 3500 loop + 800 exit）
 * 三幕：核球电弧充能（主弧 + 分叉支弧 + 电荷螺旋汇聚 + 加速收拢的临界倒计环 +
 * CRITICAL 警告微文案）→ 1.8s 临界：白闪 + 三重畸变冲击环，波前炸出乱码字符雨与
 * 火花光矛 → 电网瘫痪：字符残雨、四角残弧闪跳（带二次噼啪）、末次微弱复电。
 * 配色：白热弧心 + 金黄主辉光（#facc15 族）+ 橙色辅点缀（#fb923c）+ 熄灭灰乱码。
 */
const GLITCH_CHARS = '▓▒░#@%&$?!01'.split('');
const PULSE_AT = 1800; // 与注册表 motion「1.8s 临界」对齐

const scene: SceneFn = (api) => {
  api.setTrail(0.32);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 幕一：核心电弧 —— 主弧每 72ms 重掷折线，中段随机分叉出支弧
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > PULSE_AT) return;
    const ramp = Math.min(1, tMs / 480);
    const urgency = 1 + Math.max(0, (tMs - 900) / 900); // 临界前弧光更密更亮
    const frame = Math.floor(tMs / 72);
    const noise = (b: number, n: number) => {
      const v = Math.sin(frame * 37.7 + b * 91.3 + n * 13.1) * 43758.5453;
      return v - Math.floor(v);
    };
    const bolts = 3 + (frame % 2) + (tMs > 1200 ? 1 : 0);
    for (let b = 0; b < bolts; b += 1) {
      const targetA = noise(b, 0) * Math.PI * 2;
      const targetR = (58 + noise(b, 1) * 92) * (0.9 + urgency * 0.12);
      ctx.strokeStyle = `rgba(250, 204, 21, ${(0.42 + noise(b, 2) * 0.38) * ramp * Math.min(1.25, urgency)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let px = cx;
      let py = cy;
      let midX = cx;
      let midY = cy;
      for (let s = 1; s <= 5; s += 1) {
        px = cx + Math.cos(targetA) * ((targetR * s) / 5) + (noise(b, s + 3) - 0.5) * 30;
        py = cy + Math.sin(targetA) * ((targetR * s) / 5) + (noise(b, s + 9) - 0.5) * 30;
        ctx.lineTo(px, py);
        if (s === 3) {
          midX = px;
          midY = py;
        }
      }
      ctx.stroke();
      // 分叉支弧：自主弧中段岔出的短弧，更细更暗
      if (noise(b, 20) > 0.45) {
        const subA = targetA + (noise(b, 21) - 0.5) * 1.7;
        ctx.strokeStyle = `rgba(254, 215, 170, ${0.3 * ramp})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        for (let s = 1; s <= 3; s += 1) {
          ctx.lineTo(
            midX + Math.cos(subA) * s * 14 + (noise(b, s + 24) - 0.5) * 16,
            midY + Math.sin(subA) * s * 14 + (noise(b, s + 28) - 0.5) * 16
          );
        }
        ctx.stroke();
      }
    }
  });

  // 核球：呼吸增压的白热心
  api.spawn({
    x: cx, y: cy, shape: 'dot', size: 10, maxLife: PULSE_AT / 1000,
    color: '#fde68a', glow: 1.8, fadeIn: 0.1, fadeOut: 0.05,
    update: (p) => {
      p.size = 10 + Math.sin(p.life * 16) * 3 + p.life * 9;
      p.endSize = p.size;
    },
  });

  // 电荷汇聚：外围电荷沿微螺旋吸入核球
  api.every(38, () => {
    let a = api.range(0, Math.PI * 2);
    let r = api.range(140, 330);
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      shape: 'spark', size: 1.8, maxLife: 1.4, color: '#fbbf24', glow: 1, fadeOut: 0.15,
      update: (p, dt) => {
        a += 2.2 * dt;
        r -= (r * 1.9 + 60) * dt;
        p.x = cx + Math.cos(a) * r;
        p.y = cy + Math.sin(a) * r;
        if (r < 18) p.life = p.maxLife;
      },
    });
  }, { until: PULSE_AT - 140 });

  // 临界倒计：收拢环节拍加速（600/1080/1420/1650），末拍伴 CRITICAL 微文案闪烁
  [600, 1080, 1420, 1650].forEach((at, i) => {
    api.at(at, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 210 - i * 34, endSize: 22,
        maxLife: 0.4 - i * 0.05, color: i % 2 ? '#fb923c' : '#facc15', opacity: 0.55 + i * 0.1, fadeOut: 0.45,
      });
    });
  });
  [1240, 1470, 1660].forEach((at, i) => {
    api.at(at, () => {
      api.spawn({
        x: cx, y: cy - 96, shape: 'glyph', glyph: `CRITICAL ${94 + i * 3}%`,
        size: 11, maxLife: 0.34, color: 'rgba(254, 243, 199, 0.95)',
        font: '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.1, fadeOut: 0.3,
      });
    });
  });

  // 幕二：脉冲爆发 —— 白闪 + 三重畸变环 + 火花光矛
  api.at(PULSE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 320, maxLife: 0.55, color: '#fef9c3', glow: 2.2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 70, endSize: 4, maxLife: 0.42, color: '#fffbeb', glow: 2, fadeOut: 0.85 });
    [0, 120, 260].forEach((delay, i) => {
      api.at(PULSE_AT + delay, () => {
        api.spawn({
          x: cx, y: cy, shape: 'ring', size: 26,
          endSize: Math.max(api.width, api.height) * (0.52 + i * 0.2),
          maxLife: 0.8, color: i === 0 ? '#facc15' : i === 1 ? '#fef3c7' : '#fb923c',
          opacity: 0.9 - i * 0.22, fadeOut: 0.7,
        });
      });
    });
    api.burst({
      x: cx, y: cy, count: 90, speed: [220, 680],
      base: { shape: 'spark', size: 2, maxLife: 0.9, color: '#fbbf24', glow: 1.1, drag: 0.36, twinkle: 6, fadeOut: 0.4 },
      vary: (p, rng) => {
        const roll = rng();
        if (roll < 0.2) p.color = '#fff7ed';
        else if (roll < 0.38) p.color = '#fb923c';
        p.maxLife = 0.55 + rng() * 0.7;
      },
    });
    api.burst({
      x: cx, y: cy, count: 22, speed: [460, 700],
      base: { shape: 'streak', stretch: 0.09, size: 2.2, maxLife: 0.7, color: '#fde68a', glow: 1.25, drag: 0.42, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() > 0.7) p.color = '#fb923c';
        p.maxLife = 0.45 + rng() * 0.4;
      },
    });
  });

  // 波前乱码雨：随畸变环半径炸出的字符，近处大、远处小（波前纵深）
  api.every(30, (index) => {
    const waveR = 46 + index * 30 * 1.05;
    const shrink = Math.max(0.55, 1 - waveR / 900); // 远端字符收小
    for (let i = 0; i < 4; i += 1) {
      const a = api.range(0, Math.PI * 2);
      api.spawn({
        x: cx + Math.cos(a) * waveR, y: cy + Math.sin(a) * waveR,
        vx: Math.cos(a) * api.range(30, 90), vy: Math.sin(a) * api.range(30, 90) + 42,
        shape: 'glyph', glyph: api.pick(GLITCH_CHARS), size: api.range(10, 17) * shrink,
        maxLife: api.range(0.5, 0.9), color: api.rng() > 0.42 ? '#fbbf24' : '#a8a29e',
        fadeOut: 0.4,
      });
    }
  }, { from: PULSE_AT + 40, until: PULSE_AT + 640 });

  // 幕三：电网瘫痪 —— 四角残弧闪跳（主爆 + 慢半拍二次噼啪）
  [
    [0.08, 0.1], [0.92, 0.12], [0.1, 0.9], [0.9, 0.88],
  ].forEach(([fx, fy], i) => {
    const at = 2750 + i * 400 + api.range(0, 220);
    api.at(at, () => {
      api.spawn({ x: api.width * fx, y: api.height * fy, shape: 'dot', size: 6, endSize: 26, maxLife: 0.3, color: '#fef9c3', glow: 1.6, fadeOut: 0.8 });
      api.burst({
        x: api.width * fx, y: api.height * fy, count: 10, speed: [40, 190],
        base: { shape: 'spark', size: 1.6, maxLife: 0.4, color: '#fde68a', glow: 1.2, drag: 0.4, fadeOut: 0.5 },
      });
    });
    api.at(at + 190, () => {
      api.burst({
        x: api.width * fx + api.range(-10, 10), y: api.height * fy + api.range(-10, 10),
        count: 5, speed: [20, 90],
        base: { shape: 'spark', size: 1.2, maxLife: 0.32, color: '#fed7aa', glow: 1, twinkle: 12, fadeOut: 0.5 },
      });
    });
  });

  // 残余字符雨：熄灭电网上飘落的灰金乱码
  api.every(75, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height * 0.4,
      vy: api.range(80, 180), shape: 'glyph', glyph: api.pick(GLITCH_CHARS),
      size: api.range(9, 13), maxLife: 1.2,
      color: api.rng() > 0.8 ? 'rgba(250, 204, 21, 0.5)' : 'rgba(168, 162, 158, 0.5)', fadeOut: 0.5,
    });
  }, { from: 2550, until: 4150 });

  // 末次微弱复电：核球两次残喘微闪 + REBOOT 提示后彻底沉寂
  api.at(4380, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 7, maxLife: 0.5, color: '#fde68a', glow: 1.3, twinkle: 9, opacity: 0.8, fadeOut: 0.5 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 10, endSize: 54, maxLife: 0.45, color: '#facc15', opacity: 0.4, fadeOut: 0.6 });
  });
  api.at(4620, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 4, maxLife: 0.3, color: '#fbbf24', glow: 1, twinkle: 12, opacity: 0.5, fadeOut: 0.6 });
    api.spawn({
      x: cx, y: cy + 34, shape: 'glyph', glyph: 'REBOOT FAILED',
      size: 10, maxLife: 0.34, color: 'rgba(168, 162, 158, 0.7)',
      font: '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fadeIn: 0.15, fadeOut: 0.4,
    });
  });
};
</script>

<template>
  <div class="emp-blast-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.empBlast" :scene="scene" />
    <div class="emp-caption">
      <div class="emp-glitch" data-text="EMP CASCADE">EMP CASCADE</div>
      <strong>电磁脉冲 · 电网瘫痪</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.emp-blast-effect {
  @include effect-stage(hidden);
}

.emp-caption {
  position: absolute;
  left: 50%;
  top: 19%;
  display: grid;
  gap: 8px;
  place-items: center;
  transform: translateX(-50%);
  animation: emp-glitch-show 5s step-end both;
}

.emp-glitch {
  position: relative;
  color: #fef3c7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.24em;
  white-space: nowrap;
}

.emp-caption strong {
  color: rgba(254, 243, 199, 0.82);
  font-size: 13px;
  letter-spacing: 0.3em;
  text-shadow: 0 0 16px rgba(250, 204, 21, 0.4);
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
  0%, 37% { opacity: 0; }
  39% { opacity: 1; }
  43% { opacity: 0.2; }
  45% { opacity: 1; }
  51% { opacity: 0.4; }
  53%, 74% { opacity: 1; }
  82%, 100% { opacity: 0; }
}
</style>
