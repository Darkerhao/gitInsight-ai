<script setup lang="ts">
import { DatabaseZap } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const STORM_GLYPHS = '01Σ↯$#%&<>'.split('');

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height * 0.48;

  // 数据龙卷：字符与光点绕中心盘旋，半径起伏、垂直漂移
  api.every(17, () => {
    let angle = api.range(0, Math.PI * 2);
    let radius = api.range(90, Math.min(api.width, api.height) * 0.44);
    const angularSpeed = api.range(1.1, 2.2) * (api.rng() < 0.5 ? 1 : -1);
    const wobble = api.range(10, 44);
    const isGlyph = api.rng() < 0.4;
    const hue = api.range(160, 200);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.5,
      shape: isGlyph ? 'glyph' : 'spark',
      glyph: api.pick(STORM_GLYPHS),
      size: isGlyph ? api.range(11, 17) : api.range(1.6, 2.8),
      maxLife: api.range(1.4, 2.6),
      color: `hsl(${Math.round(hue)}, 90%, 66%)`,
      glow: isGlyph ? 0 : 1.1,
      twinkle: isGlyph ? 0 : 6,
      fadeIn: 0.1,
      fadeOut: 0.2,
      update: (p, dt) => {
        angle += angularSpeed * dt;
        p.x = cx + Math.cos(angle) * (radius + Math.sin(p.life * 2.4 + p.phase) * wobble);
        p.y = cy + Math.sin(angle) * (radius + Math.sin(p.life * 2.4 + p.phase) * wobble) * 0.5 + Math.sin(p.life * 1.6) * 18;
      },
    });
  }, { until: api.duration - 900 });

  // 风暴闪电：中心向外的锯齿电弧
  let sceneTime = 0;
  const bolts: Array<{ points: Array<[number, number]>; born: number; life: number }> = [];
  api.every(560, () => {
    const angle = api.range(0, Math.PI * 2);
    const length = api.range(140, 340);
    const segments = 8;
    const points: Array<[number, number]> = [[cx, cy]];
    for (let i = 1; i <= segments; i += 1) {
      const t = i / segments;
      points.push([
        cx + Math.cos(angle) * length * t + api.range(-30, 30) * Math.sin(Math.PI * t),
        cy + Math.sin(angle) * length * t * 0.6 + api.range(-30, 30) * Math.sin(Math.PI * t),
      ]);
    }
    bolts.push({ points, born: sceneTime, life: 0.2 + api.rng() * 0.12 });
    const tip = points[points.length - 1];
    api.burst({
      x: tip[0],
      y: tip[1],
      count: 10,
      speed: [40, 220],
      base: { shape: 'spark', size: 1.6, maxLife: 0.5, drag: 0.3, color: '#99f6e4', glow: 1.2, twinkle: 12 },
    });
  }, { from: 500, until: api.duration - 1200 });

  api.onFrame((tMs, _dt, ctx) => {
    sceneTime = tMs / 1000;
    for (let i = bolts.length - 1; i >= 0; i -= 1) {
      const bolt = bolts[i];
      const age = sceneTime - bolt.born;
      if (age > bolt.life) {
        bolts.splice(i, 1);
        continue;
      }
      const alpha = (1 - age / bolt.life) * 0.95;
      ctx.strokeStyle = `rgba(153, 246, 228, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
      for (const [px, py] of bolt.points.slice(1)) ctx.lineTo(px, py);
      ctx.stroke();
    }
  });

  // 风暴核心的呼吸辉光
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.9) * Math.min(1, Math.max(0, (api.duration / 1000 - t) / 0.9));
    if (envelope <= 0) return;
    const pulse = 1 + 0.2 * Math.sin(t * 4.2);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 110 * pulse);
    gradient.addColorStop(0, `rgba(94, 234, 212, ${0.4 * envelope})`);
    gradient.addColorStop(1, 'rgba(94, 234, 212, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, 110 * pulse, 0, Math.PI * 2);
    ctx.fill();
  });
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
        :style="{ height: `${42 + ((bar * 19) % 78)}px`, animationDelay: `${900 + bar * 90}ms` }"
      />
      <DatabaseZap :size="44" />
      <strong>数据风暴</strong>
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
  border: 1px solid rgba(45, 212, 191, 0.34);
  border-radius: 14px;
  background:
    linear-gradient(rgba(45, 212, 191, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.12) 1px, transparent 1px),
    rgba(2, 6, 23, 0.3);
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
  left: 76px;
  top: 32px;
  font-size: 16px;
}

.data-bar {
  width: 28px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #99f6e4, rgba(20, 184, 166, 0.42));
  box-shadow: 0 0 24px rgba(45, 212, 191, 0.4);
  opacity: 0;
  transform: scaleY(0.1);
  transform-origin: center bottom;
  animation: data-bar 3.2s ease both;
}

@keyframes data-chart {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.88); }
  18%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes data-bar {
  0% { opacity: 0; transform: scaleY(0.1); }
  34%, 82% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(0.86); }
}
</style>
