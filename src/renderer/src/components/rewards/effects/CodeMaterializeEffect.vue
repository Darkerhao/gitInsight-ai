<script setup lang="ts">
import { Code2 } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const CODE_LINES = [
  'const scene = build(tokens)',
  'nodes.map(render)',
  'mesh.extrude(depth)',
  'commit.reward.play()',
  'return structure',
];

const GLYPHS = '{}<>()=;/+*01#$fnconstletif'.split('');
const EMBER_COLORS = ['#34d399', '#6ee7b7', '#a7f3d0'];
const CONFIRM_AT = 3950; // 构建确认爆发（loop 末拍，余韵交给 exit）

const scene: SceneFn = (api) => {
  api.setTrail(0.14);
  const TAU = Math.PI * 2;
  const fx = api.width * 0.82;
  const fy = api.height * 0.72;

  // ── 远景层：暗色字符尘缓浮（纵深压暗的背景码域）
  for (let i = 0; i < 24; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      vy: api.range(-14, -5),
      shape: 'glyph',
      glyph: api.pick(GLYPHS),
      size: api.range(8, 11),
      maxLife: api.range(2.8, 4.4),
      color: 'rgba(52, 211, 153, 0.4)',
      opacity: api.range(0.14, 0.3),
      twinkle: api.range(0.5, 1.3),
      fadeIn: 0.22,
      fadeOut: 0.3,
    });
  }

  // ── 幕一（entry 0-550ms）：铸形台通电
  api.at(140, () => {
    api.spawn({ x: fx, y: fy, shape: 'ring', size: 150, endSize: 10, maxLife: 0.42, color: '#34d399', opacity: 0.85, fadeOut: 0.4 });
  });
  api.at(340, () => {
    api.spawn({ x: fx, y: fy, shape: 'dot', size: 20, endSize: 3, maxLife: 0.4, color: '#ecfdf5', glow: 1.8 });
    api.burst({
      x: fx, y: fy, count: 14, speed: [30, 120],
      angle: [-Math.PI * 0.88, -Math.PI * 0.12],
      base: { shape: 'spark', size: 1.6, maxLife: 0.7, color: '#6ee7b7', glow: 1, drag: 0.4, fadeOut: 0.4 },
    });
  });

  // 铸形台座：透视基座环 + 旋转刻度弧（确认瞬间过载增亮）
  api.onFrame((tMs, _dt, ctx) => {
    const ramp = Math.min(1, Math.max(0, (tMs - 220) / 420)) * Math.min(1, Math.max(0, (api.duration - 260 - tMs) / 480));
    if (ramp <= 0.02) return;
    const surge = tMs > CONFIRM_AT ? Math.exp(-(tMs - CONFIRM_AT) / 260) : 0;
    ctx.translate(fx, fy + 8);
    ctx.scale(1, 0.34);
    const spin = tMs / 1400;
    ctx.strokeStyle = `rgba(52, 211, 153, ${(0.32 + surge * 0.5) * ramp})`;
    ctx.lineWidth = 1.6 + surge * 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `rgba(34, 211, 238, ${(0.2 + surge * 0.34) * ramp})`;
    ctx.lineWidth = 3.2;
    for (let k = 0; k < 3; k += 1) {
      const a0 = spin + (k / 3) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, 86, a0, a0 + 1.05);
      ctx.stroke();
    }
  });

  // ── 幕二（loop）：字符自四周被吸附飞向铸形台，近大远小两档纵深
  const siphon = (near: boolean) => {
    const edge = Math.floor(api.range(0, 4));
    const x = edge === 0 ? -16 : edge === 1 ? api.width + 16 : api.range(0, api.width);
    const y = edge === 2 ? -16 : edge === 3 ? api.height + 16 : api.range(0, api.height);
    const travel = near ? api.range(0.8, 1.3) : api.range(1.2, 1.8);
    api.spawn({
      x, y,
      vx: api.range(-40, 40),
      vy: api.range(-40, 40),
      shape: 'glyph',
      glyph: api.pick(GLYPHS),
      size: near ? api.range(15, 22) : api.range(9, 13),
      endSize: 3,
      maxLife: travel,
      color: near ? (api.rng() < 0.22 ? '#67e8f9' : '#86efac') : 'rgba(52, 211, 153, 0.6)',
      opacity: near ? 1 : 0.55,
      spin: api.range(-1.4, 1.4),
      fadeIn: 0.12,
      fadeOut: 0.1,
      update: (p, dt) => {
        const remaining = Math.max(0.08, p.maxLife - p.life);
        p.vx += ((fx - p.x) / remaining - p.vx) * Math.min(1, dt * 7);
        p.vy += ((fy - p.y) / remaining - p.vy) * Math.min(1, dt * 7);
      },
      onDeath: (p, s) => {
        const roll = s.rng();
        if (roll < 0.3) {
          s.spawn({ x: p.x, y: p.y, shape: 'dot', size: 6, endSize: 1, maxLife: 0.28, color: '#bbf7d0', glow: 1.7 });
        } else if (roll < 0.42) {
          s.spawn({ x: p.x, y: p.y, shape: 'ring', size: 4, endSize: 22, maxLife: 0.34, color: '#34d399', opacity: 0.6, fadeOut: 0.5 });
        }
      },
    });
  };
  api.every(34, () => siphon(api.rng() < 0.6), { from: 550, until: 1900 });
  api.every(20, () => siphon(api.rng() < 0.65), { from: 1900, until: 3760 });

  // 吸积能量环：向台面收缩的进能环
  api.every(680, () => {
    api.spawn({ x: fx, y: fy, shape: 'ring', size: 130, endSize: 8, maxLife: 0.7, color: '#34d399', opacity: 0.55, fadeIn: 0.12, fadeOut: 0.34 });
  }, { from: 900, until: 3500 });

  // 悬浮装配轨道：字符绕台面椭圆环流（前亮后暗的遮挡纵深）
  api.every(96, () => {
    let a = api.range(0, TAU);
    const rr = api.range(52, 88);
    const w = api.range(1.5, 2.5) * (api.rng() < 0.3 ? -1 : 1);
    const baseSize = api.range(9, 14);
    api.spawn({
      x: fx + Math.cos(a) * rr,
      y: fy + Math.sin(a) * rr * 0.36 - 8,
      shape: 'glyph',
      glyph: api.pick(GLYPHS),
      size: baseSize,
      maxLife: api.range(1.2, 2),
      color: api.rng() < 0.2 ? '#67e8f9' : '#6ee7b7',
      fadeIn: 0.16,
      fadeOut: 0.24,
      update: (p, dt) => {
        a += w * dt;
        const depth = 0.5 + 0.5 * Math.sin(a);
        p.x = fx + Math.cos(a) * rr;
        p.y = fy + Math.sin(a) * rr * 0.36 - 8;
        p.size = baseSize * (0.68 + depth * 0.5);
        p.opacity = 0.3 + depth * 0.7;
      },
    });
  }, { from: 1600, until: 3700 });

  // 装配电弧：台缘随机噼啪
  api.every(430, () => {
    const a = api.range(0, TAU);
    api.burst({
      x: fx + Math.cos(a) * 46, y: fy + Math.sin(a) * 18,
      count: 6, speed: [40, 170],
      base: { shape: 'spark', size: 1.4, maxLife: 0.4, color: '#a7f3d0', glow: 1.3, drag: 0.3, twinkle: 12, fadeOut: 0.5 },
    });
  }, { from: 1900, until: 3800 });

  // 中期节拍：装配进度脉冲
  api.at(2500, () => {
    api.spawn({ x: fx, y: fy, shape: 'ring', size: 14, endSize: 170, maxLife: 0.8, color: '#67e8f9', opacity: 0.6, fadeOut: 0.6 });
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * TAU;
      api.spawn({
        x: fx + Math.cos(a) * 30, y: fy + Math.sin(a) * 14,
        vx: Math.cos(a) * 90, vy: Math.sin(a) * 40,
        shape: 'glyph', glyph: api.pick(GLYPHS), size: 11, endSize: 4,
        maxLife: 0.6, color: '#86efac', drag: 0.4, fadeOut: 0.4,
      });
    }
  });

  // ── 幕三：BUILD PASSED —— 白热闪心 + 绿色确认爆发 + 双重冲击环
  api.at(CONFIRM_AT, () => {
    api.spawn({ x: fx, y: fy, shape: 'dot', size: 30, endSize: 250, maxLife: 0.55, color: '#f0fdf4', glow: 2.4, fadeOut: 0.9 });
    api.spawn({ x: fx, y: fy, shape: 'ring', size: 18, endSize: 300, maxLife: 0.9, color: '#34d399', opacity: 0.85, fadeOut: 0.7 });
    api.burst({
      x: fx, y: fy, count: 72, speed: [90, 380],
      base: { shape: 'spark', size: 1.9, drag: 0.32, ay: 90, color: '#4ade80', twinkle: 7, glow: 1.2 },
      vary: (p, rng) => {
        p.maxLife = 0.7 + rng() * 0.8;
        if (rng() < 0.24) p.color = '#67e8f9';
        if (rng() < 0.12) p.color = '#ecfdf5';
      },
    });
  });
  api.at(CONFIRM_AT + 150, () => {
    api.spawn({ x: fx, y: fy, shape: 'ring', size: 30, endSize: 380, maxLife: 1, color: '#22d3ee', opacity: 0.4, fadeOut: 0.8 });
  });
  // 二次噼啪：结构落成后的电荷残响
  api.at(CONFIRM_AT + 320, () => {
    api.burst({
      x: fx + api.range(-30, 30), y: fy + api.range(-16, 10),
      count: 12, speed: [50, 200],
      base: { shape: 'spark', size: 1.5, maxLife: 0.5, color: '#a7f3d0', glow: 1.3, drag: 0.3, twinkle: 10 },
    });
  });

  // 余尘（exit）：升腾的翠色余烬缓散
  api.every(70, () => {
    api.spawn({
      x: fx + api.range(-90, 90), y: fy + api.range(-30, 20),
      vy: api.range(-70, -20), vx: api.range(-24, 24),
      drag: 0.6, shape: 'dot', size: api.range(1, 2.2),
      maxLife: api.range(0.7, 1.1), color: api.pick(EMBER_COLORS),
      glow: 1, wander: 30, twinkle: api.range(2, 5), fadeOut: 0.5,
    });
  }, { from: CONFIRM_AT + 120, until: api.duration - 320 });
};
</script>

<template>
  <div class="code-materialize-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.codeMaterialize" :scene="scene" />
    <div class="code-lines">
      <span v-for="(line, index) in CODE_LINES" :key="line" :style="{ animationDelay: `${index * 120}ms` }">
        {{ line }}
      </span>
    </div>
    <div class="code-model">
      <small class="model-code">CODE FORGE · BUILD 0X7F3A</small>
      <Code2 :size="46" />
      <strong>代码铸形</strong>
      <small class="model-status">ARTIFACT SEALED ✓</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.code-materialize-effect {
  @include effect-stage(hidden);
  perspective: 900px;
}

.code-lines {
  position: absolute;
  left: 8%;
  top: 18%;
  display: grid;
  gap: 10px;
  color: rgba(187, 247, 208, 0.88);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 800;
  text-shadow: 0 0 14px rgba(34, 197, 94, 0.56);
}

.code-lines span {
  opacity: 0;
  transform: translateX(-18px);
  animation: code-line 5s ease both;
}

.code-model {
  position: absolute;
  right: 12%;
  bottom: 18%;
  width: 216px;
  height: 158px;
  border: 1px solid rgba(52, 211, 153, 0.38);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(2, 6, 23, 0.44), rgba(6, 78, 59, 0.2));
  box-shadow: inset 0 0 32px rgba(52, 211, 153, 0.14), 0 0 46px rgba(52, 211, 153, 0.18);
  color: #dcfce7;
  display: grid;
  gap: 7px;
  place-items: center;
  align-content: center;
  transform: perspective(800px) rotateX(56deg) rotateZ(-26deg);
  animation: code-model 5s ease both;
}

.code-model strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.code-model small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.22em;
  color: rgba(167, 243, 208, 0.66);
}

.model-status {
  color: #6ee7b7;
  opacity: 0;
  animation: model-status 5s ease both;
}

@keyframes code-line {
  0% { opacity: 0; transform: translateX(-18px); }
  9%, 64% { opacity: 1; transform: translateX(0); }
  82%, 100% { opacity: 0; transform: translate(56vw, 40vh) scale(0.24); filter: blur(2px); }
}

@keyframes code-model {
  0%, 100% { opacity: 0; filter: blur(8px); }
  12%, 74% { opacity: 1; filter: blur(0) brightness(1); }
  79% { opacity: 1; filter: blur(0) brightness(1.65); }
  84%, 92% { opacity: 1; filter: blur(0) brightness(1.06); }
}

@keyframes model-status {
  0%, 78% { opacity: 0; transform: translateY(4px); }
  84%, 94% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; }
}
</style>
