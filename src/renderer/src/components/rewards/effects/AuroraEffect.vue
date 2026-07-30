<script setup lang="ts">
import { Gem } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/** 电离风暴涌动：两次亮波横掠光帘（毫秒） */
const SURGES = [
  { from: 1500, span: 1050, dir: 1 },
  { from: 2850, span: 1000, dir: -1 },
] as const;

const scene: SceneFn = (api) => {
  api.setTrail(0.42);
  const W = api.width;
  const H = api.height;
  const horizonY = H * 0.82;
  const D = api.duration / 1000; // 5.2s

  // 远景山脊折线（seed 生成，一次采样整场复用）
  const ridgeStep = 26;
  const ridge: number[] = [];
  let ry = horizonY - api.range(10, 30);
  for (let x = 0; x <= W + ridgeStep * 2; x += ridgeStep) {
    ry += api.range(-16, 16);
    ry = Math.min(horizonY + 8, Math.max(horizonY - 54, ry));
    ridge.push(ry);
  }

  // 星野双层：远层细小慢闪 + 近层明亮微视差漂移（纵深）
  for (let i = 0; i < 46; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * horizonY * 0.92,
      shape: 'dot', size: api.range(0.5, 1.2), maxLife: D,
      color: '#e2e8f0', glow: 0.6, opacity: api.range(0.2, 0.5),
      twinkle: api.range(0.3, 1), fadeIn: 0.12, fadeOut: 0.14,
    });
  }
  for (let i = 0; i < 20; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * horizonY * 0.78, vx: api.range(2, 6),
      shape: 'dot', size: api.range(1.2, 2.1), maxLife: D,
      color: api.rng() > 0.7 ? '#bae6fd' : '#ffffff', glow: 0.9,
      opacity: api.range(0.5, 0.9), twinkle: api.range(0.8, 2.2), fadeIn: 0.1, fadeOut: 0.14,
    });
  }

  // 三层光帘：正弦摆动 + 竖纹光矢，入场自地平线升起、退场垂落收拢
  const layers = [
    { hue: 150, amp: api.range(36, 50), speed: 0.46, base: 0.3, height: 0.3, freq: 0.0058, alpha: 0.15, ray: 4 },
    { hue: 172, amp: api.range(46, 64), speed: -0.34, base: 0.38, height: 0.26, freq: 0.0044, alpha: 0.125, ray: 3 },
    { hue: 204, amp: api.range(28, 44), speed: 0.26, base: 0.24, height: 0.21, freq: 0.0072, alpha: 0.095, ray: 5 },
  ];
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const riseIn = Math.min(1, t / 0.95);
    const lift = 1 - Math.pow(1 - riseIn, 3);
    const settle = t > 4.3 ? Math.max(0, 1 - (t - 4.3) / 0.85) : 1;
    const envelope = lift * (0.3 + 0.7 * settle);
    if (envelope <= 0.012) return;
    // 冕冠时刻 3.6s：全幕短暂增亮
    const crown = t > 3.55 && t < 4.1 ? 1 + Math.sin(((t - 3.55) / 0.55) * Math.PI) * 0.42 : 1;
    // 涌动亮带头部位置
    let surgeX = -1;
    for (const s of SURGES) {
      if (tMs >= s.from && tMs <= s.from + s.span) {
        const k = (tMs - s.from) / s.span;
        surgeX = (s.dir > 0 ? k : 1 - k) * W;
      }
    }
    const drop = (1 - settle) * H * 0.15 + (1 - lift) * H * 0.3;
    const step = 20;
    for (const layer of layers) {
      let col = 0;
      for (let x = -step; x <= W + step; x += step, col += 1) {
        const phase = x * layer.freq + t * layer.speed;
        const y = H * layer.base + drop + Math.sin(phase) * layer.amp + Math.sin(phase * 0.37 + 1.7) * layer.amp * 0.7;
        const bandH = H * layer.height * (0.68 + 0.32 * Math.sin(phase * 0.6 + t * 0.4));
        const hue = layer.hue + Math.sin(x * 0.0018 + t * 0.5) * 16;
        let a = layer.alpha * envelope * crown;
        if (surgeX >= 0) a *= 1 + Math.max(0, 1 - Math.abs(x - surgeX) / 140) * 0.9;
        const g = ctx.createLinearGradient(0, y, 0, y + bandH);
        g.addColorStop(0, `hsla(${hue}, 88%, 70%, 0)`);
        g.addColorStop(0.6, `hsla(${hue}, 84%, 62%, ${a * 0.55})`);
        g.addColorStop(0.94, `hsla(${hue}, 88%, 66%, ${a})`);
        g.addColorStop(1, `hsla(${hue}, 82%, 58%, ${a * 0.2})`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, step + 1, bandH);
        // 幕帘竖纹光矢：每隔数列拉出一根更亮的细光柱
        if (col % layer.ray === 0) ctx.fillRect(x + step * 0.3, y - bandH * 0.14, 2.2, bandH * 1.26);
      }
    }
    // 远景山脊压暗（地面剪影 → 天幕纵深）
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(2, 6, 23, ${0.84 * lift})`;
    ctx.beginPath();
    ctx.moveTo(-4, H + 4);
    ridge.forEach((yy, i) => ctx.lineTo(i * ridgeStep - 4, yy));
    ctx.lineTo(W + 4, H + 4);
    ctx.closePath();
    ctx.fill();
    // 山脊上缘的地平线反照辉光
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(0, horizonY - 60, 0, horizonY + 6);
    hg.addColorStop(0, 'rgba(74, 222, 128, 0)');
    hg.addColorStop(1, `rgba(74, 222, 128, ${0.09 * envelope * crown})`);
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizonY - 60, W, 66);
  });

  // 起幕微光：地平线迸起细碎绿尘，宣告光帘升起
  api.at(260, () => {
    for (let i = 0; i < 16; i += 1) {
      api.spawn({
        x: api.rng() * W, y: horizonY - api.range(0, 20), vy: -api.range(12, 44),
        shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.8, 1.5),
        color: '#86efac', glow: 1, fadeOut: 0.5,
      });
    }
  });

  // 极光尘：整个 loop 沿光带缓缓上升
  api.every(110, () => {
    api.spawn({
      x: api.rng() * W, y: H * api.range(0.3, 0.6),
      vx: api.range(-14, 14), vy: api.range(-32, -10),
      shape: 'dot', size: api.range(0.9, 2), maxLife: api.range(1.6, 2.6),
      color: api.pick(['#86efac', '#5eead4', '#a7f3d0']),
      twinkle: api.range(2, 4.5), wander: 24, glow: 1, fadeIn: 0.14, fadeOut: 0.4,
    });
  }, { from: 700, until: 4200 });

  // 涌动波前：亮带头部掠过处激起白绿电离火花
  SURGES.forEach((s) => {
    api.every(70, (i) => {
      const k = Math.min(1, (i * 70) / s.span);
      const x = (s.dir > 0 ? k : 1 - k) * W + api.range(-30, 30);
      api.spawn({
        x, y: H * api.range(0.3, 0.52), vy: -api.range(40, 90),
        shape: 'spark', size: api.range(1, 1.9), maxLife: api.range(0.7, 1.2),
        color: api.rng() > 0.4 ? '#d1fae5' : '#a7f3d0', glow: 1.1, fadeOut: 0.5,
      });
    }, { from: s.from, until: s.from + s.span });
  });

  // 流星三发：白热核 + 长曳尾，坠灭时炸出二次噼啪
  [1850, 3050, 4050].forEach((tm, idx) => {
    api.at(tm, () => {
      const fromX = W * api.range(0.3, 0.85);
      const fromY = api.range(H * 0.04, H * 0.18);
      const vx = -api.range(360, 520);
      const vy = api.range(150, 240);
      api.spawn({
        x: fromX, y: fromY, vx, vy, shape: 'streak', stretch: 0.14, size: 2.4,
        maxLife: idx === 2 ? 0.7 : 0.95, color: '#f0f9ff', glow: 1.5, fadeIn: 0.06, fadeOut: 0.3,
        onDeath: (p, a) => {
          a.burst({
            x: p.x, y: p.y, count: 7, speed: [20, 90],
            base: { shape: 'spark', size: 1.2, maxLife: 0.5, color: '#bae6fd', glow: 1, fadeOut: 0.6 },
          });
        },
      });
      api.spawn({ x: fromX, y: fromY, vx, vy, shape: 'dot', size: 2, maxLife: 0.4, color: '#ffffff', glow: 1.6, fadeOut: 0.6 });
    });
  });

  // 冕冠时刻：天幕之巅荡开一环柔光
  api.at(3600, () => {
    api.spawn({
      x: W * 0.5, y: H * 0.3, shape: 'ring', size: 60, endSize: Math.max(W, H) * 0.5,
      maxLife: 1.1, color: 'rgba(134, 239, 172, 0.8)', opacity: 0.4, fadeIn: 0.1, fadeOut: 0.7,
    });
  });

  // 终章：光帘垂落后星野最后一次明灭
  api.at(4550, () => {
    for (let i = 0; i < 10; i += 1) {
      api.spawn({
        x: api.rng() * W, y: api.rng() * horizonY * 0.8,
        shape: 'dot', size: api.range(1, 2), maxLife: api.range(0.4, 0.65),
        color: '#ffffff', glow: 1.2, twinkle: 6, fadeOut: 0.5,
      });
    }
  });
};
</script>

<template>
  <div class="aurora-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.aurora" :scene="scene" />
    <div class="aurora-badge">
      <Gem :size="40" />
      <strong>极光天幕</strong>
      <small>AURORA VEIL · IONO-STORM 04</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.aurora-effect {
  @include effect-stage(hidden);
}

.aurora-badge {
  position: absolute;
  left: 50%;
  bottom: 21%;
  color: #d1fae5;
  display: grid;
  gap: 7px;
  place-items: center;
  text-align: center;
  text-shadow: 0 0 22px rgba(34, 197, 94, 0.5);
  transform: translateX(-50%);
  animation: aurora-badge 5.2s ease both;
}

.aurora-badge svg {
  color: #86efac;
  filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.6));
}

.aurora-badge strong {
  font-size: 18px;
  letter-spacing: 0.14em;
}

.aurora-badge small {
  color: rgba(167, 243, 208, 0.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.26em;
}

@keyframes aurora-badge {
  0%, 46% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  56%, 84% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}
</style>
