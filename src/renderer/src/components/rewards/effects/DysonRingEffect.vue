<script setup lang="ts">
import { Globe } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const BUILD_FROM = 1250;
const ONLINE_AT = 4650;

const scene: SceneFn = (api) => {
  api.setTrail(0.22);
  const TAU = Math.PI * 2;
  const cx = api.width / 2;
  const cy = api.height / 2;
  const rx = Math.min(api.width, api.height) * 0.4;
  const ry = rx * 0.3;

  // ── 远景星野：缓漂暗星
  for (let i = 0; i < 34; i += 1) {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height,
      vx: api.range(-4, -1), shape: 'dot', size: api.range(0.6, 1.4),
      maxLife: api.range(4, 5.6), color: api.rng() < 0.2 ? '#fde68a' : '#e2e8f0',
      glow: 0.5, opacity: api.range(0.14, 0.4), twinkle: api.range(0.4, 1.2),
      fadeIn: 0.1, fadeOut: 0.16,
    });
  }

  // ── 幕一（entry）：恒星点燃 —— 白芯闪 + 冕环荡开 + 对流沸腾
  api.at(150, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 10, endSize: 90, maxLife: 0.5, color: '#fffbeb', glow: 2.2, fadeOut: 0.85 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 130, maxLife: 0.6, color: '#facc15', opacity: 0.8, fadeOut: 0.6 });
  });
  api.spawn({
    x: cx, y: cy, shape: 'dot', size: 30, maxLife: api.duration / 1000,
    color: '#fcd34d', glow: 2, fadeIn: 0.05, fadeOut: 0.12,
    update: (p) => {
      p.size = 30 + Math.sin(p.life * 3.4) * 4;
      p.endSize = p.size;
    },
  });
  api.every(60, () => {
    const angle = api.range(0, TAU);
    api.spawn({
      x: cx + Math.cos(angle) * 32, y: cy + Math.sin(angle) * 32,
      vx: Math.cos(angle) * api.range(12, 40), vy: Math.sin(angle) * api.range(12, 40),
      shape: 'spark', size: api.range(1.2, 2.4), maxLife: api.range(0.4, 0.9),
      color: api.pick(['#fde68a', '#fb923c', '#fef9c3']), glow: 1.1, drag: 0.4, fadeOut: 0.4,
    });
  }, { until: api.duration - 800 });
  // 日珥：两次弧状喷发后被引力拽回
  [1900, 3300].forEach((t0) => {
    api.at(t0, () => {
      const a = api.range(0, TAU);
      api.burst({
        x: cx + Math.cos(a) * 34, y: cy + Math.sin(a) * 34,
        count: 16, speed: [90, 220],
        angle: [a - 0.4, a + 0.4],
        base: { shape: 'spark', size: 1.8, maxLife: 1.1, color: '#fb923c', glow: 1.2, drag: 0.24, fadeOut: 0.4 },
        vary: (p, rng) => {
          p.ax = -(p.x - cx) * 1.6;
          p.ay = -(p.y - cy) * 1.6;
          p.maxLife = 0.7 + rng() * 0.6;
        },
      });
    });
  });
  // 施工无人机就位：四架自画面边缘滑入环带待命位
  for (let d = 0; d < 4; d += 1) {
    api.at(420 + d * 130, () => {
      const a = (d / 4) * TAU + 0.4;
      const tx = cx + Math.cos(a) * rx;
      const ty = cy + Math.sin(a) * ry;
      api.spawn({
        x: d % 2 === 0 ? -16 : api.width + 16, y: api.range(api.height * 0.2, api.height * 0.8),
        shape: 'streak', stretch: 0.07, size: 1.9, maxLife: 0.9,
        color: '#a5f3fc', glow: 1, fadeIn: 0.1, fadeOut: 0.2,
        update: (p, dt) => {
          p.vx += (tx - p.x) * 4.6 * dt;
          p.vy += (ty - p.y) * 4.6 * dt;
        },
      });
    });
  }

  // ── 环带构件：seed 打乱点亮次序，近大远小伪 3D
  const SEG_COUNT = 36;
  const order: number[] = Array.from({ length: SEG_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(api.rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const bootAt = (seg: number) => BUILD_FROM + (order.indexOf(seg) / SEG_COUNT) * (ONLINE_AT - BUILD_FROM - 350);
  const segPos = (seg: number) => {
    const a = (seg / SEG_COUNT) * TAU;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, front: Math.sin(a) > 0, a };
  };

  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BUILD_FROM - 150) return;
    const online = tMs > ONLINE_AT ? Math.min(1, (tMs - ONLINE_AT) / 300) : 0;
    const fadeOutAll = Math.max(0, Math.min(1, (api.duration - 280 - tMs) / 520));
    const segSpan = TAU / SEG_COUNT;
    for (let seg = 0; seg < SEG_COUNT; seg += 1) {
      const boot = Math.min(1, Math.max(0, (tMs - bootAt(seg)) / 260));
      if (boot <= 0) continue;
      const { front, a } = segPos(seg);
      const depth = front ? 1 : 0.42;
      // 建造期脚手架频闪，落成后转入稳定辉光
      const flicker = boot < 1 ? 0.55 + 0.45 * Math.sin(tMs / 36 + seg * 2.1) : 1;
      const alpha = (0.26 + boot * 0.52) * flicker * depth * fadeOutAll + online * 0.32 * depth;
      ctx.strokeStyle = `rgba(250, 204, 21, ${Math.min(0.95, alpha)})`;
      ctx.lineWidth = (front ? 6 : 3.2) * (0.6 + boot * 0.4) + online * 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, a + segSpan * 0.09, a + segSpan * 0.86);
      ctx.stroke();
    }
    // 合拢供能：全环白热脉冲外扩
    if (online > 0) {
      const age = Math.min(1, (tMs - ONLINE_AT) / 520);
      const grow = 1 + age * 0.24;
      ctx.strokeStyle = `rgba(255, 251, 235, ${(1 - age) * 0.8 * fadeOutAll})`;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * grow, ry * grow, 0, 0, TAU);
      ctx.stroke();
    }
  });

  // 焊接确认：每段落成瞬间的火花 + 环上微涟漪
  for (let seg = 0; seg < SEG_COUNT; seg += 1) {
    const done = bootAt(seg) + 260;
    const { x, y, front } = segPos(seg);
    api.at(done, () => {
      api.burst({
        x, y, count: front ? 5 : 3, speed: [30, 130],
        base: {
          shape: 'spark', size: front ? 1.6 : 1.1, maxLife: 0.45,
          color: '#fef08a', glow: front ? 1.3 : 0.7, opacity: front ? 1 : 0.55,
          drag: 0.3, twinkle: 10, fadeOut: 0.5,
        },
      });
      if (front && api.rng() < 0.4) {
        api.spawn({ x, y, shape: 'ring', size: 3, endSize: 22, maxLife: 0.4, color: '#facc15', opacity: 0.5, fadeOut: 0.6 });
      }
    });
  }

  // 无人机穿梭补给：恒星 ↔ 下一待建段的拖尾航线，抵达迸出装配闪光
  api.every(180, (index) => {
    const seg = order[Math.min(SEG_COUNT - 1, index % SEG_COUNT)];
    const target = segPos(seg);
    api.spawn({
      x: cx + api.range(-20, 20), y: cy + api.range(-20, 20),
      shape: 'streak', stretch: 0.08, size: target.front ? 2 : 1.4, maxLife: 0.9,
      color: '#a5f3fc', glow: target.front ? 1 : 0.6, opacity: target.front ? 1 : 0.6,
      fadeIn: 0.1, fadeOut: 0.24,
      update: (p, dt) => {
        p.vx += (target.x - p.x) * 5.4 * dt;
        p.vy += (target.y - p.y) * 5.4 * dt;
      },
      onDeath: (p, s) => {
        if (s.rng() < 0.5) {
          s.spawn({ x: p.x, y: p.y, shape: 'dot', size: 4, endSize: 1, maxLife: 0.3, color: '#f0f9ff', glow: 1.4 });
        }
      },
    });
  }, { from: BUILD_FROM, until: ONLINE_AT - 420 });

  // 已建环带上的能量尘：沿轨道环流（前亮后暗）
  api.every(130, () => {
    let a = api.range(0, TAU);
    const w = api.range(0.5, 0.9);
    api.spawn({
      x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry,
      shape: 'dot', size: 1.8, maxLife: api.range(1.2, 2),
      color: '#fde047', glow: 1, fadeIn: 0.14, fadeOut: 0.3,
      update: (p, dt) => {
        a += w * dt;
        const front = 0.5 + 0.5 * Math.sin(a);
        p.x = cx + Math.cos(a) * rx;
        p.y = cy + Math.sin(a) * ry;
        p.size = 1 + front * 1.4;
        p.opacity = 0.3 + front * 0.7;
      },
    });
  }, { from: 2300, until: ONLINE_AT - 200 });

  // ── 幕三（exit 交界）：MEGASTRUCTURE ONLINE —— 泛白合拢 + 双向能量束扫出
  api.at(ONLINE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 26, endSize: 220, maxLife: 0.55, color: '#fffbeb', glow: 2.2, fadeOut: 0.9 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: 320, maxLife: 0.9, color: '#fef9c3', opacity: 0.9, fadeOut: 0.7 });
    [-1, 1].forEach((dir) => {
      api.burst({
        x: cx + dir * rx * 0.9, y: cy, count: 42,
        speed: [240, 640], angle: [dir > 0 ? -0.28 : Math.PI - 0.28, dir > 0 ? 0.28 : Math.PI + 0.28],
        base: { shape: 'streak', stretch: 0.1, size: 2, maxLife: 1, color: '#fde047', glow: 1.1, drag: 0.55, fadeOut: 0.4 },
        vary: (p, rng) => {
          if (rng() < 0.24) p.color = '#fffbeb';
          if (rng() < 0.14) p.color = '#fb923c';
          p.maxLife = 0.7 + rng() * 0.5;
        },
      });
    });
    // 输能金雨点缀
    api.burst({
      x: cx, y: cy, count: 40, speed: [60, 280],
      base: { shape: 'spark', size: 1.6, maxLife: 1, color: '#fcd34d', glow: 1.1, drag: 0.4, twinkle: 8, fadeOut: 0.4 },
    });
  });
  // 二次回响：延迟冲击环 + 残余电花
  api.at(ONLINE_AT + 220, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 60, endSize: 420, maxLife: 1, color: '#fb923c', opacity: 0.42, fadeOut: 0.75 });
    api.burst({
      x: cx + api.range(-rx * 0.5, rx * 0.5), y: cy + api.range(-30, 30),
      count: 10, speed: [40, 180],
      base: { shape: 'spark', size: 1.3, maxLife: 0.5, color: '#fef08a', glow: 1.2, twinkle: 12, drag: 0.3, fadeOut: 0.5 },
    });
  });
  // 余韵金尘缓散
  api.every(80, () => {
    api.spawn({
      x: cx + api.range(-rx, rx), y: cy + api.range(-ry * 2.2, ry * 2.2),
      shape: 'dot', size: api.range(0.9, 1.8), maxLife: api.range(0.6, 1),
      color: api.pick(['#fcd34d', '#fde68a', '#fb923c']), glow: 0.9,
      wander: 26, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: ONLINE_AT + 180, until: api.duration - 300 });
};
</script>

<template>
  <div class="dyson-ring-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.dysonRing" :scene="scene" />
    <div class="dyson-hud">
      <small class="hud-code">DYSON ARRAY · SEG 36/36</small>
      <span class="hud-main">
        <Globe :size="22" />
        <strong>戴森星环 · 合拢供能</strong>
      </span>
      <small class="hud-meta">OUTPUT 3.8×10²⁶ W · MEGASTRUCTURE ONLINE</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dyson-ring-effect {
  @include effect-stage(hidden);
}

.dyson-hud {
  position: absolute;
  left: 50%;
  bottom: 12%;
  border: 1px solid rgba(250, 204, 21, 0.36);
  border-radius: 10px;
  background: rgba(30, 20, 2, 0.46);
  color: #fef3c7;
  display: grid;
  gap: 6px;
  place-items: center;
  padding: 12px 26px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: dyson-hud 5.8s ease both;
}

.hud-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dyson-hud strong {
  font-size: 14px;
  letter-spacing: 0.14em;
}

.dyson-hud small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.18em;
}

.hud-code {
  color: rgba(253, 224, 71, 0.72);
  font-size: 9px;
}

.hud-meta {
  color: rgba(254, 243, 199, 0.7);
  font-size: 10px;
}

@keyframes dyson-hud {
  0%, 72% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  80%, 93% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}
</style>
