<script setup lang="ts">
import { Layers } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * PRISM FACET · 棱镜析光（5200ms = 650 entry + 3700 loop + 850 exit）
 * 三幕：五层玻璃错位展开、首道析光束入射 → 冷谱色散光带斜扫（青→紫受限色域 + 白色焦散芯线），
 * 棱角折射闪四拍踩点（星芒爆点 + 双向析出光谱碎钻 + 回波环），棱缘微光沿斜纹滑行 →
 * 终幕白鞘掠过合拢，光尘熄灭。
 * 配色：白热焦散 + 青色主辉光（#22d3ee 族）+ 紫色辅点缀（#a78bfa 族）——冷谱段色散，杜绝全彩虹。
 */
const ICE = ['#7dd3fc', '#22d3ee', '#a5f3fc', '#a78bfa', '#c4b5fd'];
const TILT = 0.32; // 与 CSS 棱镜条纹一致的斜角

const scene: SceneFn = (api) => {
  api.setTrail(0.22);
  const duration = api.duration / 1000;
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 幕二主体：冷谱色散光带 —— 色相锁定在 190°-280°（青→紫），中心叠白色焦散芯线
  const rays = Array.from({ length: 5 }, (_, i) => ({
    offset: api.range(-0.18, 0.18) + i * 0.21,
    speed: api.range(0.09, 0.19),
    huePhase: api.range(0, 90),
    hueSpeed: api.range(14, 30),
    width: api.range(26, 62),
  }));
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const envelope = Math.min(1, t / 0.75) * Math.min(1, Math.max(0, (duration - t) / 0.85));
    if (envelope <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(TILT);
    for (const ray of rays) {
      const x = (((ray.offset + t * ray.speed) % 1.2) - 0.6) * api.width;
      const hue = 190 + ((ray.huePhase + t * ray.hueSpeed) % 90); // 受限冷谱段
      const gradient = ctx.createLinearGradient(x - ray.width, 0, x + ray.width, 0);
      gradient.addColorStop(0, `hsla(${hue}, 88%, 70%, 0)`);
      gradient.addColorStop(0.5, `hsla(${hue}, 88%, 70%, ${0.2 * envelope})`);
      gradient.addColorStop(1, `hsla(${Math.min(285, hue + 55)}, 88%, 72%, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - ray.width, -api.height, ray.width * 2, api.height * 2);
      // 白色焦散芯线：光带中心的白热窄脊
      const core = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
      core.addColorStop(0, 'rgba(255, 255, 255, 0)');
      core.addColorStop(0.5, `rgba(255, 255, 255, ${0.13 * envelope})`);
      core.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = core;
      ctx.fillRect(x - 4, -api.height, 8, api.height * 2);
    }
    ctx.restore();
  });

  // 幕一：开场入射 —— 白光自左上折入，析出第一束碎钻
  api.at(260, () => {
    api.spawn({
      x: api.width * 0.3, y: api.height * 0.3, shape: 'dot',
      size: 10, endSize: 60, maxLife: 0.55, color: '#f0f9ff', glow: 2, fadeOut: 0.85,
    });
    api.burst({
      x: api.width * 0.3, y: api.height * 0.3, count: 14, speed: [90, 260],
      angle: [TILT - 0.35, TILT + 0.35],
      base: { shape: 'streak', stretch: 0.07, size: 1.8, maxLife: 0.7, color: '#a5f3fc', glow: 1.1, drag: 0.42, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() > 0.6) p.color = '#c4b5fd';
      },
    });
  });

  // 光谱碎钻：冷谱闪尘，双层纵深（近大远小）
  api.every(64, () => {
    const depth = api.rng();
    api.spawn({
      x: api.range(0, api.width), y: api.range(0, api.height),
      vx: api.range(-20, 20), vy: api.range(-38, -8),
      shape: 'dot', size: 0.8 + depth * 1.9, maxLife: api.range(1, 2.2),
      color: api.pick(ICE), twinkle: api.range(4, 10), wander: 30,
      glow: 0.7 + depth * 0.6, opacity: 0.35 + depth * 0.6,
    });
  }, { until: api.duration - 950 });

  // 折射星芒：玻璃棱角上的 + 形闪光，冷谱配色
  api.every(390, () => {
    api.spawn({
      x: cx + api.range(-api.width * 0.24, api.width * 0.24),
      y: cy + api.range(-api.height * 0.2, api.height * 0.2),
      shape: 'glyph', glyph: api.rng() > 0.5 ? '+' : '✦',
      size: api.range(15, 32), endSize: 7, maxLife: api.range(0.6, 1),
      color: api.rng() > 0.3 ? api.pick(ICE) : '#f0f9ff',
      spin: api.range(-1, 1), fadeIn: 0.22, fadeOut: 0.4,
    });
  }, { from: 450, until: api.duration - 1000 });

  // 棱缘微光：沿斜纹方向滑行的细碎光屑（呼应 CSS 玻璃条纹）
  api.every(150, () => {
    const along = api.range(-0.4, 0.4);
    const x0 = cx + Math.cos(TILT + Math.PI / 2) * along * api.width * 0.5 + api.range(-30, 30);
    const y0 = cy + Math.sin(TILT + Math.PI / 2) * along * api.height * 0.5 + api.range(-30, 30);
    const speed = api.range(60, 150) * (api.rng() > 0.5 ? 1 : -1);
    api.spawn({
      x: x0, y: y0, vx: Math.cos(TILT) * speed, vy: Math.sin(TILT) * speed,
      shape: 'streak', stretch: 0.06, size: 1.3, maxLife: api.range(0.6, 1.1),
      color: api.rng() > 0.6 ? '#c4b5fd' : '#a5f3fc', glow: 0.9, opacity: 0.65,
      fadeIn: 0.2, fadeOut: 0.3,
    });
  }, { from: 700, until: api.duration - 1050 });

  // 幕二节拍：四拍折射爆闪 —— 星芒白闪 + 双向析出 + 慢速回波环
  [950, 1850, 2750, 3650].forEach((at, beat) => {
    api.at(at, () => {
      const fx = cx + api.range(-api.width * 0.2, api.width * 0.2);
      const fy = cy + api.range(-api.height * 0.17, api.height * 0.17);
      api.spawn({ x: fx, y: fy, shape: 'dot', size: 8, endSize: 46, maxLife: 0.4, color: '#f8fafc', glow: 2, fadeOut: 0.85 });
      api.spawn({
        x: fx, y: fy, shape: 'glyph', glyph: '✦', size: 34, endSize: 10,
        maxLife: 0.6, color: '#f0f9ff', spin: api.range(-0.8, 0.8), fadeIn: 0.06, fadeOut: 0.5,
      });
      // 双向析出：沿棱镜斜轴正反两个方向劈出冷谱扇
      [TILT, TILT + Math.PI].forEach((dir) => {
        api.burst({
          x: fx, y: fy, count: 11, speed: [110, 320],
          angle: [dir - 0.26, dir + 0.26],
          base: { shape: 'streak', stretch: 0.075, size: 1.7, maxLife: 0.8, glow: 1.1, drag: 0.4, fadeOut: 0.42 },
          vary: (p, rng) => {
            p.color = ICE[Math.floor(rng() * ICE.length)];
            p.maxLife = 0.5 + rng() * 0.5;
          },
        });
      });
      // 慢速回波环：偶数拍青、奇数拍紫
      api.spawn({
        x: fx, y: fy, shape: 'ring', size: 10, endSize: 120 + beat * 14,
        maxLife: 0.9, color: beat % 2 ? '#a78bfa' : '#22d3ee', opacity: 0.5, fadeIn: 0.14, fadeOut: 0.6,
      });
    });
  });

  // 幕三：终幕白鞘 —— 一道白色宽光沿斜轴快速掠过后全场合拢
  api.at(api.duration - 830, () => {
    api.burst({
      x: cx - Math.cos(TILT) * api.width * 0.45, y: cy - Math.sin(TILT) * api.width * 0.45,
      count: 16, speed: [520, 680],
      angle: [TILT - 0.06, TILT + 0.06],
      base: { shape: 'streak', stretch: 0.1, size: 2.2, maxLife: 0.8, color: '#f0f9ff', glow: 1.3, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() > 0.68) p.color = '#a5f3fc';
        p.maxLife = 0.55 + rng() * 0.35;
      },
    });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: Math.max(api.width, api.height) * 0.5, maxLife: 0.8, color: '#e0f2fe', opacity: 0.4, fadeOut: 0.7 });
  });
};
</script>

<template>
  <div class="glass-refraction-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.glassRefraction" :scene="scene" />
    <div class="glass-stack">
      <span
        v-for="layer in 5"
        :key="layer"
        class="glass-layer"
        :style="{
          '--layer-x': `${(layer - 3) * 34}px`,
          '--layer-y': `${(layer - 3) * -18}px`,
          '--layer-rotate': `${(layer - 3) * 4}deg`,
          animationDelay: `${(layer - 1) * 110}ms`,
        }"
      />
      <div class="glass-refraction-label">
        <Layers :size="46" />
        <small>PRISM FACET · λ 400-700nm</small>
        <strong>棱镜析光</strong>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.glass-refraction-effect {
  @include effect-stage(hidden);
}

.glass-stack {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 78vw);
  height: min(330px, 56vh);
  transform: translate(-50%, -50%);
  animation: glass-stack 5.2s ease both;
}

.glass-layer {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 16px;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.22), transparent 32% 68%, rgba(125, 249, 255, 0.18)),
    rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px) saturate(1.2);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.36),
    0 26px 70px rgba(2, 6, 23, 0.22);
  opacity: 0;
  transform: translate(var(--layer-x), var(--layer-y)) rotate(var(--layer-rotate)) scale(0.92);
  animation: glass-layer 4.8s ease both;
}

.glass-layer::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    105deg,
    transparent 0 20px,
    rgba(255, 255, 255, 0.14) 21px 23px,
    transparent 24px 44px
  );
  transform: translateX(-24px);
  animation: glass-shift 1.8s ease-in-out infinite alternate;
}

.glass-refraction-label {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 7px;
  place-items: center;
  color: #f0f9ff;
  transform: translate(-50%, -50%);
  animation: glass-label 5.2s ease both;
}

.glass-refraction-label small {
  color: rgba(165, 243, 252, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.26em;
}

.glass-refraction-label strong {
  font-size: 16px;
  letter-spacing: 0.2em;
}

@keyframes glass-stack {
  0%, 100% { opacity: 0; transform: translate(-50%, -44%) scale(0.86); }
  18%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes glass-layer {
  0%, 100% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(0.86); }
  24%, 78% { opacity: 1; transform: translate(var(--layer-x), var(--layer-y)) rotate(var(--layer-rotate)) scale(1); }
}

@keyframes glass-shift {
  to { transform: translateX(24px); }
}

@keyframes glass-label {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) scale(0.88); }
  22%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
