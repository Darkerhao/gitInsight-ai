<script setup lang="ts">
import { Star } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 超新星爆发 NOVA CASCADE · 5.8s
 * 幕一 0-2050ms   恒星呼吸膨胀：白热核搏动 + 对流沸腾 + 日珥腾起 + 1700ms 预震收缩环
 * 幕二 2050-2550  急缩坍缩成白点，全场星尘瞬间吸入，白矮星点搏动 —— 静默一拍
 * 幕三 2550ms+    三波次光谱爆发（金→蓝→玫）+ 冲击环推开星尘；3300ms 起余烬二次噼啪
 * 尾声 3150ms+    残骸凝成星云驻留（尘埃 + 丝状物 + 中心脉冲星），闪烁至熄灭
 * 配色：白热核心 + 金橙主色（#fb923c）辉光 + 蓝辅色（#93c5fd）点缀，玫色仅第三波谱段
 */
const WAVE_COLORS: string[][] = [
  ['#fde68a', '#f59e0b', '#fbbf24'], // 波一：金
  ['#93c5fd', '#67e8f9', '#dbeafe'], // 波二：蓝
  ['#f0abfc', '#e879f9', '#f5d0fe'], // 波三：玫
];

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 远景星野：坍缩时将被引力扯入的暗星（纵深垫底）
  for (let i = 0; i < 60; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot', size: api.range(0.7, 1.7), maxLife: 2.3,
      color: api.rng() > 0.7 ? '#93c5fd' : '#e2e8f0',
      glow: 0.7, opacity: api.range(0.26, 0.66),
      twinkle: api.range(0.5, 1.5), fadeIn: 0.08, fadeOut: 0.14,
    });
  }

  // ── 幕一：恒星呼吸膨胀（白热核 + 沸腾 + 日珥）──
  api.spawn({
    x: cx, y: cy, shape: 'dot', size: 26, maxLife: 2.05,
    color: '#fcd34d', glow: 2, fadeIn: 0.12, fadeOut: 0.04,
    update: (p) => {
      p.size = 26 + Math.sin(p.life * 5.2) * 7 + p.life * 9;
      p.endSize = p.size;
    },
  });
  // 对流沸腾：表面颗粒持续迸出
  api.every(36, () => {
    const angle = api.range(0, Math.PI * 2);
    const r = 30 + api.range(0, 16);
    api.spawn({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: Math.cos(angle) * api.range(18, 60),
      vy: Math.sin(angle) * api.range(18, 60),
      shape: 'spark', size: api.range(1.4, 2.8), maxLife: api.range(0.4, 0.8),
      color: api.pick(['#fde68a', '#fb923c', '#fff7ed']),
      glow: 1.2, drag: 0.4, fadeOut: 0.4,
    });
  }, { until: 1950 });
  // 日珥：随机方位的弧状腾起（次级系统）
  api.every(380, () => {
    const angle = api.range(0, Math.PI * 2);
    api.burst({
      x: cx + Math.cos(angle) * 44,
      y: cy + Math.sin(angle) * 44,
      count: 7, speed: [60, 190],
      angle: [angle - 0.4, angle + 0.4],
      base: { shape: 'spark', size: 1.9, maxLife: 0.8, color: '#fdba74', glow: 1.2, drag: 0.36, fadeOut: 0.5 },
      vary: (p, rng) => {
        if (rng() > 0.7) p.color = '#fff7ed';
      },
    });
  }, { from: 400, until: 1850 });
  // 1700ms 预震：一圈警示性收缩环 —— 坍缩前奏
  api.at(1700, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 200, endSize: 60,
      maxLife: 0.5, color: '#fde68a', opacity: 0.5, fadeIn: 0.08, fadeOut: 0.4,
    });
  });

  // ── 幕二：坍缩 —— 300ms 内全场吸入，静默一拍 ──
  api.at(2050, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 130, endSize: 6, maxLife: 0.34,
      color: '#f8fafc', opacity: 0.9, fadeIn: 0.05, fadeOut: 0.3,
    });
    // 核心急缩：亮核塌成白点
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 30, endSize: 3, maxLife: 0.34,
      color: '#fff7ed', glow: 2.2, fadeOut: 0.2,
    });
  });
  api.every(12, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(120, Math.max(api.width, api.height) * 0.5);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * radius * 3.1,
      vy: -Math.sin(angle) * radius * 3.1,
      shape: 'streak', stretch: 0.07, size: 1.8, maxLife: 0.32,
      color: api.rng() > 0.3 ? '#e0f2fe' : '#fde68a',
      glow: 0.9, fadeIn: 0.1, fadeOut: 0.2,
    });
  }, { from: 2050, until: 2350 });
  // 白矮星点：静默一拍中的孤星搏动（唯一光源）
  api.at(2370, () => {
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 3.4, maxLife: 0.24,
      color: '#f8fafc', glow: 1.8, fadeIn: 0.2, fadeOut: 0.3,
      update: (p) => {
        p.size = 3.4 + Math.sin(p.life * 34) * 1.4;
        p.endSize = p.size;
      },
    });
  });

  // ── 幕三：三波次光谱爆发（api.at 踩点 2550/2770/2990）──
  WAVE_COLORS.forEach((palette, wave) => {
    api.at(2550 + wave * 220, () => {
      if (wave === 0) {
        api.spawn({ x: cx, y: cy, shape: 'dot', size: 18, endSize: 390, maxLife: 0.72, color: '#fffbeb', glow: 2.4, fadeOut: 0.92 });
      }
      api.burst({
        x: cx, y: cy, count: 118 - wave * 14,
        speed: [140 + wave * 90, 460 + wave * 130],
        base: {
          shape: wave === 2 ? 'streak' : 'spark', stretch: 0.08,
          size: 2.6 - wave * 0.5, maxLife: 1.5, glow: 1.15,
          ay: 26, drag: 0.32, fadeOut: 0.45,
        },
        vary: (p, rng) => {
          p.color = palette[Math.floor(rng() * palette.length)];
          p.maxLife = 1 + rng() * 1.1;
          if (rng() > 0.82) p.twinkle = 3 + rng() * 4;
          if (wave === 0 && rng() > 0.86) {
            p.color = '#fff7ed'; // 白热先锋粒子
            p.size += 0.8;
          }
        },
      });
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 24,
        endSize: Math.max(api.width, api.height) * (0.4 + wave * 0.22),
        maxLife: 1, color: palette[0], opacity: 0.8, fadeOut: 0.7,
      });
    });
  });

  // 余烬二次噼啪：抛射壳层中随机的迟发小爆（3300-3950ms）
  api.every(160, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(120, 300);
    api.burst({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.85,
      count: 5, speed: [40, 150],
      base: { shape: 'spark', size: 1.4, maxLife: 0.6, color: '#fde68a', glow: 1.1, drag: 0.4, fadeOut: 0.5 },
      vary: (p, rng) => {
        if (rng() > 0.6) p.color = rng() > 0.5 ? '#93c5fd' : '#fff7ed';
      },
    });
  }, { from: 3300, until: 3950 });

  // ── 尾声：残骸星云驻留 ──
  api.at(3150, () => {
    // 尘埃云
    for (let i = 0; i < 84; i += 1) {
      const angle = api.range(0, Math.PI * 2);
      const radius = api.range(40, 280);
      api.spawn({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.8,
        vx: Math.cos(angle) * api.range(4, 18),
        vy: Math.sin(angle) * api.range(4, 18),
        shape: 'dot', size: api.range(0.8, 2.2), maxLife: api.range(1.8, 2.6),
        color: api.pick(['#fbbf24', '#93c5fd', '#f0abfc', '#e2e8f0']),
        glow: 0.9, wander: 26, twinkle: api.range(1, 3), fadeIn: 0.14, fadeOut: 0.4,
      });
    }
    // 丝状物：缓慢外漂的弧状纤维
    for (let i = 0; i < 14; i += 1) {
      const angle = api.range(0, Math.PI * 2);
      const radius = api.range(90, 240);
      api.spawn({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.8,
        vx: Math.cos(angle) * api.range(14, 30),
        vy: Math.sin(angle) * api.range(14, 30) * 0.8,
        shape: 'streak', stretch: 0.5, size: 1.4, maxLife: api.range(1.6, 2.2),
        color: api.rng() > 0.5 ? '#fdba74' : '#93c5fd',
        glow: 0.7, opacity: 0.6, fadeIn: 0.2, fadeOut: 0.4,
      });
    }
  });
  // 中心脉冲星：星云心跳 —— 微光点 + 周期淡环
  api.at(3500, () => {
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 2.6, maxLife: 1.9,
      color: '#f8fafc', glow: 1.6, twinkle: 2.4, fadeIn: 0.14, fadeOut: 0.3,
    });
  });
  api.every(520, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 8, endSize: 130,
      maxLife: 0.9, color: '#93c5fd', opacity: 0.3, fadeOut: 0.7,
    });
  }, { from: 3600, until: 4800 });
};
</script>

<template>
  <div class="supernova-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.supernova" :scene="scene" />
    <div class="sn-badge">
      <Star :size="42" />
      <strong>超新星爆发</strong>
      <small>NOVA CASCADE · SN 2026-JX</small>
      <small class="sn-badge-dim">TYPE II · REMNANT STABLE</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.supernova-effect {
  @include effect-stage(hidden);
  animation: sn-camera 5.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sn-badge {
  position: absolute;
  left: 50%;
  bottom: 14%;
  color: #fef3c7;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 18px rgba(245, 158, 11, 0.65);
  transform: translateX(-50%);
  animation: sn-badge 5.8s ease both;
}

.sn-badge strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.sn-badge small {
  color: rgba(254, 243, 199, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.22em;
}

.sn-badge .sn-badge-dim {
  color: rgba(254, 243, 199, 0.46);
  font-size: 9px;
}

@keyframes sn-badge {
  0%, 50% { opacity: 0; transform: translateX(-50%) translateY(18px); }
  60%, 88% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

/* 与幕次同步的内容层微镜头：呼吸 → 坍缩吸入 → 爆发反弹 → 星云凝视 */
@keyframes sn-camera {
  0% { transform: scale(1.06); }
  30% { transform: scale(1); }
  35% { transform: scale(0.985); }
  40% { transform: scale(0.955); }
  44% { transform: scale(1.1); }
  50% { transform: scale(1.03); }
  56% { transform: scale(1.015); }
  86% { transform: scale(1.05); }
  100% { transform: scale(1.08); opacity: 0; }
}
</style>
