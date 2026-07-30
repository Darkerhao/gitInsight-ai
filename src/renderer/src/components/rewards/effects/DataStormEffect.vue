<script setup lang="ts">
import { DatabaseZap } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const STORM_GLYPHS = '01Σ↯$#%&<>'.split('');
const VORTEX_COLORS = ['#34d399', '#6ee7b7', '#22d3ee', '#5eead4'];
const STRIKE_BEATS = [1250, 2050, 2850, 3650];

const scene: SceneFn = (api) => {
  api.setTrail(0.18);
  const TAU = Math.PI * 2;
  const cx = api.width / 2;
  const cy = api.height * 0.48;

  // ── 远景尘埃：风暴外围的暗色悬浮微粒
  for (let i = 0; i < 26; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot',
      size: api.range(0.7, 1.4),
      maxLife: api.range(3.2, 4.6),
      color: '#0d9488',
      glow: 0.6,
      opacity: api.range(0.14, 0.3),
      twinkle: api.range(0.5, 1.2),
      wander: 12,
      fadeIn: 0.16,
      fadeOut: 0.24,
    });
  }

  // ── 幕一（entry）：风眼点亮 —— 呼吸辉光 + 首环荡开
  api.at(170, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 16, endSize: 150, maxLife: 0.6, color: '#34d399', opacity: 0.7, fadeOut: 0.6 });
  });
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (api.duration / 1000 - 0.35 - t) / 0.9));
    if (envelope <= 0) return;
    const pulse = 1 + 0.2 * Math.sin(t * 4.2);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 112 * pulse);
    gradient.addColorStop(0, `rgba(52, 211, 153, ${0.4 * envelope})`);
    gradient.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, 112 * pulse, 0, TAU);
    ctx.fill();
    // 眼壁：双层反向旋转的弧
    for (let k = 0; k < 2; k += 1) {
      const dir = k === 0 ? 1 : -1;
      const spin = t * dir * (1.6 + k * 0.7);
      ctx.strokeStyle = `rgba(94, 234, 212, ${(0.26 - k * 0.08) * envelope})`;
      ctx.lineWidth = 2.2 - k * 0.8;
      for (let arc = 0; arc < 3; arc += 1) {
        const a0 = spin + (arc / 3) * TAU;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 62 + k * 18, (62 + k * 18) * 0.52, 0, a0, a0 + 1.3);
        ctx.stroke();
      }
    }
  });

  // ── 涡旋主体：字符与光点绕核椭圆盘旋，半径起伏；后半圈压暗缩小（纵深遮挡）
  api.every(17, () => {
    let angle = api.range(0, TAU);
    const radius = api.range(90, Math.min(api.width, api.height) * 0.44);
    const angularSpeed = api.range(1.2, 2.2) * (api.rng() < 0.82 ? 1 : -1);
    const wobble = api.range(10, 44);
    const isGlyph = api.rng() < 0.38;
    const baseSize = isGlyph ? api.range(11, 17) : api.range(1.6, 2.8);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.5,
      shape: isGlyph ? 'glyph' : 'spark',
      glyph: api.pick(STORM_GLYPHS),
      size: baseSize,
      maxLife: api.range(1.4, 2.6),
      color: api.pick(VORTEX_COLORS),
      glow: isGlyph ? 0 : 1.1,
      twinkle: isGlyph ? 0 : 6,
      fadeIn: 0.1,
      fadeOut: 0.2,
      update: (p, dt) => {
        angle += angularSpeed * dt;
        const r = radius + Math.sin(p.life * 2.4 + p.phase) * wobble;
        const front = 0.5 + 0.5 * Math.sin(angle);
        p.x = cx + Math.cos(angle) * r;
        p.y = cy + Math.sin(angle) * r * 0.5 + Math.sin(p.life * 1.6) * 18;
        p.size = baseSize * (0.62 + front * 0.5);
        p.opacity = 0.3 + front * 0.7;
      },
    });
  }, { from: 250, until: 4150 });

  // ── 锯齿闪电：精确节拍劈出，白芯 + 翠色辉边，端点炸花 + 二次回闪
  const bolts: Array<{ points: Array<[number, number]>; born: number; life: number; width: number }> = [];
  const forge = (angle: number, length: number, ox: number, oy: number) => {
    const segments = 8;
    const points: Array<[number, number]> = [[cx + ox, cy + oy]];
    for (let i = 1; i <= segments; i += 1) {
      const t = i / segments;
      points.push([
        cx + ox + Math.cos(angle) * length * t + api.range(-30, 30) * Math.sin(Math.PI * t),
        cy + oy + Math.sin(angle) * length * t * 0.6 + api.range(-30, 30) * Math.sin(Math.PI * t),
      ]);
    }
    return points;
  };
  const strike = (atMs: number, major: boolean) => {
    api.at(atMs, () => {
      const angle = api.range(0, TAU);
      const length = major ? api.range(260, 380) : api.range(150, 300);
      const points = forge(angle, length, 0, 0);
      bolts.push({ points, born: atMs / 1000, life: 0.22 + api.rng() * 0.1, width: major ? 2.8 : 2 });
      // 分叉支流
      const mid = points[4];
      bolts.push({
        points: [[mid[0], mid[1]], ...forge(angle + api.range(-0.9, 0.9), length * 0.4, mid[0] - cx, mid[1] - cy).slice(1, 5)],
        born: atMs / 1000,
        life: 0.16,
        width: 1.2,
      });
      // 风眼过载白闪 + 端点炸花
      api.spawn({ x: cx, y: cy, shape: 'dot', size: major ? 22 : 14, endSize: 3, maxLife: 0.3, color: '#f0fdfa', glow: 2, fadeOut: 0.7 });
      const tip = points[points.length - 1];
      api.burst({
        x: tip[0], y: tip[1], count: major ? 16 : 10, speed: [40, 240],
        base: { shape: 'spark', size: 1.6, maxLife: 0.5, drag: 0.3, color: '#99f6e4', glow: 1.2, twinkle: 12 },
        vary: (p, rng) => {
          if (rng() < 0.3) p.color = '#22d3ee';
        },
      });
      api.spawn({ x: tip[0], y: tip[1], shape: 'ring', size: 4, endSize: major ? 90 : 54, maxLife: 0.5, color: '#5eead4', opacity: 0.6, fadeOut: 0.6 });
    });
    // 二次噼啪：残枝回闪
    api.at(atMs + 90, () => {
      const angle = api.range(0, TAU);
      bolts.push({ points: forge(angle, api.range(80, 150), 0, 0), born: (atMs + 90) / 1000, life: 0.12, width: 1.1 });
    });
  };
  STRIKE_BEATS.forEach((beat, i) => strike(beat, i === STRIKE_BEATS.length - 1));

  api.onFrame((tMs, _dt, ctx) => {
    const now = tMs / 1000;
    for (let i = bolts.length - 1; i >= 0; i -= 1) {
      const bolt = bolts[i];
      const age = now - bolt.born;
      if (age < 0) continue;
      if (age > bolt.life) {
        bolts.splice(i, 1);
        continue;
      }
      const alpha = 1 - age / bolt.life;
      ctx.lineCap = 'round';
      // 辉边 + 白芯双描
      ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * 0.5})`;
      ctx.lineWidth = bolt.width * 3;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
      for (const [px, py] of bolt.points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
      ctx.strokeStyle = `rgba(240, 253, 250, ${alpha * 0.95})`;
      ctx.lineWidth = bolt.width;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
      for (const [px, py] of bolt.points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  });

  // 涡缘甩码：字符被离心甩出、坠入下方
  api.every(140, () => {
    const a = api.range(0, TAU);
    const r = api.range(140, 240);
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.5,
      vx: -Math.sin(a) * api.range(60, 140), vy: Math.cos(a) * api.range(30, 70) + 40,
      ay: 160, drag: 0.7,
      shape: 'glyph', glyph: api.pick(STORM_GLYPHS), size: api.range(9, 13),
      maxLife: api.range(0.8, 1.3), color: 'rgba(110, 231, 183, 0.66)',
      spin: api.range(-2, 2), fadeIn: 0.1, fadeOut: 0.4,
    });
  }, { from: 1300, until: 3900 });

  // ── 幕三（exit）：涡旋散逸 —— 风眼塌陷 + 环流余尘外漂
  api.at(4280, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 130, endSize: 8, maxLife: 0.45, color: '#34d399', opacity: 0.6, fadeOut: 0.4 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 2, maxLife: 0.4, color: '#ecfdf5', glow: 1.6, fadeOut: 0.6 });
  });
  api.every(70, () => {
    const a = api.range(0, TAU);
    const r = api.range(60, 200);
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.5,
      vx: Math.cos(a) * api.range(20, 70), vy: Math.sin(a) * api.range(12, 40),
      drag: 0.5, shape: 'dot', size: api.range(0.9, 1.9),
      maxLife: api.range(0.6, 1), color: api.pick(VORTEX_COLORS),
      glow: 0.9, wander: 26, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: 4280, until: api.duration - 280 });
};
</script>

<template>
  <div class="data-storm-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.dataStorm" :scene="scene" />
    <div class="data-chart">
      <span
        v-for="bar in 7"
        :key="bar"
        class="data-bar"
        :style="{ height: `${42 + ((bar * 19) % 78)}px`, animationDelay: `${860 + bar * 110}ms` }"
      />
      <DatabaseZap :size="40" />
      <strong>数据风暴</strong>
      <small class="chart-code">DATA MAELSTROM · CAT-5</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.data-storm-effect {
  @include effect-stage(hidden);
}

.data-chart {
  position: absolute;
  left: 50%;
  top: 55%;
  width: min(460px, 78vw);
  height: 250px;
  border: 1px solid rgba(52, 211, 153, 0.34);
  border-radius: 14px;
  background:
    linear-gradient(rgba(52, 211, 153, 0.11) 1px, transparent 1px),
    linear-gradient(90deg, rgba(52, 211, 153, 0.11) 1px, transparent 1px),
    rgba(2, 6, 23, 0.32);
  background-size: 34px 34px;
  color: #ccfbf1;
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 14px;
  padding: 28px 32px 54px;
  transform: translate(-50%, -50%);
  animation: data-chart 5s ease both;
}

.data-chart svg {
  position: absolute;
  left: 24px;
  top: 20px;
}

.data-chart strong {
  position: absolute;
  left: 72px;
  top: 24px;
  font-size: 16px;
  letter-spacing: 0.12em;
}

.chart-code {
  position: absolute;
  left: 72px;
  top: 47px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.2em;
  color: rgba(110, 231, 183, 0.62);
}

.data-bar {
  width: 28px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #a7f3d0, rgba(13, 148, 136, 0.42));
  box-shadow: 0 0 24px rgba(52, 211, 153, 0.4);
  opacity: 0;
  transform: scaleY(0.1);
  transform-origin: center bottom;
  animation: data-bar 3.4s ease both;
}

@keyframes data-chart {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.88); }
  12%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  86% { opacity: 1; transform: translate(-50%, -51%) scale(0.99); }
}

@keyframes data-bar {
  0% { opacity: 0; transform: scaleY(0.1); }
  30%, 84% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(0.82); }
}
</style>
