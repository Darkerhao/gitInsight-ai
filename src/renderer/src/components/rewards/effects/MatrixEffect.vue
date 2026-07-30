<script setup lang="ts">
import { ScanLine } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const MATRIX_CHARS = 'アイウエオカキクケコサシスセソﾀﾁﾂﾃﾄ01<>{}=/+*#$&%'.split('');
const REWARD_WORDS = ['GIT', 'PUSH', 'SYNC', 'OK', 'AI', 'MERGE'];
// 节拍表（总 4600ms = entry 500 + loop 3350 + exit 750）
const WAVE_BEATS = [900, 2050, 3200]; // 扫描波精确踩点
const LOCK_AT = 2450; // 奖励关键字锁定确认
const THIN_AT = 3850; // exit：雨幕稀疏熄灭

const scene: SceneFn = (api) => {
  api.setTrail(0.07); // 极长残留：字符雨的经典渐隐尾迹
  const cell = 21;
  const columns = Math.max(8, Math.floor(api.width / cell));
  const duration = api.duration / 1000;
  const cx = api.width / 2;
  const cy = api.height / 2;

  // exit 期熄灭概率（由节拍推高，雨头逐步随机熄灭）
  let extinction = 0;
  api.at(THIN_AT, () => { extinction = 0.05; });
  api.at(THIN_AT + 300, () => { extinction = 0.22; });

  // 每列一个"雨头"：三层纵深 —— 远列小暗慢 / 中列 / 近列大亮快（白热雨头）
  for (let col = 0; col < columns; col += 1) {
    if (api.rng() > 0.9) continue;
    const depthRoll = api.rng();
    const tier = depthRoll < 0.34 ? 0 : depthRoll < 0.8 ? 1 : 2; // 0 远 1 中 2 近
    const stepTime = tier === 0 ? api.range(0.1, 0.14) : tier === 1 ? api.range(0.065, 0.095) : api.range(0.042, 0.06);
    const isGold = api.rng() < 0.07;
    let acc = api.range(0, stepTime);
    api.spawn({
      x: col * cell + cell / 2,
      y: -api.range(0, api.height * 1.4),
      shape: 'glyph',
      glyph: api.pick(MATRIX_CHARS),
      size: tier === 0 ? api.range(10, 12) : tier === 1 ? api.range(13, 16) : api.range(17, 20),
      color: isGold ? '#fde68a' : tier === 0 ? '#4ade80' : tier === 1 ? '#a7f3d0' : '#eafff5',
      opacity: tier === 0 ? 0.34 : tier === 1 ? 0.7 : 1,
      glow: 0,
      maxLife: duration,
      fadeIn: 0,
      fadeOut: 0.05,
      update: (p, dt, sceneApi) => {
        acc += dt;
        if (acc >= stepTime) {
          acc = 0;
          p.y += cell;
          const swapWord = isGold && sceneApi.rng() < 0.14;
          p.glyph = swapWord ? sceneApi.pick(REWARD_WORDS) : sceneApi.pick(MATRIX_CHARS);
          if (swapWord && tier === 2) {
            sceneApi.spawn({ x: p.x, y: p.y, shape: 'dot', size: 3.4, endSize: 1, maxLife: 0.3, color: '#fde68a', glow: 1.5, fadeOut: 0.6 });
          }
          if (extinction > 0 && sceneApi.rng() < extinction) {
            p.maxLife = p.life + 0.16;
          }
          if (p.y > api.height + cell) {
            p.y = -cell * sceneApi.range(1, 14);
          }
        }
      },
    });
  }

  // entry：屏顶微光帘 —— 码域通电的第一缕
  api.at(70, () => {
    for (let i = 0; i < 16; i += 1) {
      api.spawn({
        x: api.rng() * api.width, y: api.range(-8, 24), vy: api.range(50, 130),
        shape: 'spark', size: api.range(1.2, 2), maxLife: api.range(0.4, 0.8),
        color: '#6ee7b7', glow: 1, fadeOut: 0.5,
      });
    }
  });

  // 数据节点闪烁：网格交点上的绿色光斑（近亮远暗两色）
  api.every(150, () => {
    api.spawn({
      x: Math.floor(api.range(0, columns)) * cell + cell / 2,
      y: Math.floor(api.range(0, api.height / cell)) * cell,
      shape: 'dot',
      size: api.range(2, 4),
      endSize: 1,
      maxLife: api.range(0.4, 0.9),
      color: api.rng() < 0.75 ? '#34d399' : '#22d3ee',
      glow: 1.4,
      twinkle: 10,
    });
  }, { from: 300, until: 3700 });

  // 扫描波：节拍触发 —— 白热前沿线 + 渐隐拖带，沿途迸出解码微光
  const waves: number[] = [];
  WAVE_BEATS.forEach((beat) => {
    api.at(beat, () => waves.push(beat));
    for (let k = 0; k < 6; k += 1) {
      api.at(beat + 120 + k * 130, () => {
        api.spawn({
          x: api.rng() * api.width,
          y: ((120 + k * 130) / 900) * api.height,
          shape: 'spark', size: api.range(1.2, 2), maxLife: 0.4,
          color: '#a7f3d0', glow: 1.1, fadeOut: 0.5,
        });
      });
    }
  });
  api.onFrame((tMs, _dt, ctx) => {
    for (let i = waves.length - 1; i >= 0; i -= 1) {
      const age = (tMs - waves[i]) / 900;
      if (age > 1) {
        waves.splice(i, 1);
        continue;
      }
      const y = age * api.height;
      const alpha = 0.5 * Math.sin(Math.PI * Math.min(1, age * 1.06));
      const gradient = ctx.createLinearGradient(0, y - 28, 0, y + 4);
      gradient.addColorStop(0, 'rgba(110, 231, 183, 0)');
      gradient.addColorStop(1, `rgba(110, 231, 183, ${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y - 28, api.width, 32);
      ctx.fillStyle = `rgba(240, 253, 250, ${alpha * 0.9})`;
      ctx.fillRect(0, y - 0.8, api.width, 1.6);
    }
  });

  // 关键字锁定确认：金色微文案 + 白热闪心 + 同心确认环 + 二次噼啪
  api.at(LOCK_AT, () => {
    api.spawn({ x: cx, y: cy - 118, shape: 'dot', size: 12, endSize: 3, maxLife: 0.3, color: '#fffbeb', glow: 1.8 });
    api.spawn({ x: cx, y: cy - 118, shape: 'ring', size: 6, endSize: 96, maxLife: 0.6, color: '#fde68a', opacity: 0.7, fadeOut: 0.6 });
    api.spawn({
      x: cx, y: cy - 118, vy: -16, shape: 'glyph', glyph: 'KEYWORD LOCKED',
      size: 11, maxLife: 1.3, color: '#fde68a',
      font: '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fadeIn: 0.12, fadeOut: 0.3,
    });
    api.burst({
      x: cx, y: cy - 118, count: 14, speed: [50, 220],
      base: { shape: 'spark', size: 1.4, maxLife: 0.5, color: '#fde68a', glow: 1.1, drag: 0.35, fadeOut: 0.5 },
      vary: (p, rng) => { if (rng() < 0.4) p.color = '#6ee7b7'; },
    });
  });
  api.at(LOCK_AT + 180, () => {
    api.spawn({ x: cx, y: cy - 118, shape: 'ring', size: 40, endSize: 150, maxLife: 0.5, color: '#34d399', opacity: 0.3, fadeOut: 0.6 });
  });

  // exit：末次绿闪落幕 + 残余码尘明灭
  api.at(4000, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 18, endSize: 110, maxLife: 0.45, color: '#d1fae5', glow: 1.8, fadeOut: 0.85 });
  });
  api.every(90, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height,
      shape: 'dot', size: api.range(0.7, 1.4), maxLife: api.range(0.35, 0.6),
      color: '#34d399', glow: 0.9, wander: 26, twinkle: 5, fadeOut: 0.5,
    });
  }, { from: 4050, until: 4400 });
};
</script>

<template>
  <div class="matrix-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.matrix" :scene="scene" />
    <div class="matrix-console">
      <small class="mx-code">NEURAL CODE FIELD</small>
      <ScanLine :size="40" />
      <strong>神经码域</strong>
      <span class="mx-status">TRACE 100% · 关键字已锁定</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.matrix-effect {
  @include effect-stage(hidden);
}

.matrix-console {
  position: absolute;
  left: 50%;
  top: 50%;
  min-width: 196px;
  border: 1px solid rgba(52, 211, 153, 0.36);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.64);
  color: #a7f3d0;
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 18px 26px 14px;
  box-shadow:
    inset 0 0 26px rgba(52, 211, 153, 0.12),
    0 24px 70px rgba(2, 6, 23, 0.28);
  transform: translate(-50%, -50%);
  animation: matrix-console 4.6s ease both;
}

.matrix-console::after {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  top: 12px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #34d399, transparent);
  animation: matrix-scan 1.4s ease-in-out infinite;
}

.matrix-console svg {
  filter: drop-shadow(0 0 18px rgba(52, 211, 153, 0.6));
}

.matrix-console strong {
  font-size: 19px;
  letter-spacing: 0.14em;
}

.mx-code {
  color: rgba(110, 231, 183, 0.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.26em;
}

.mx-status {
  width: 100%;
  border-top: 1px solid rgba(52, 211, 153, 0.26);
  color: #6ee7b7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-align: center;
  padding-top: 8px;
  animation: mx-status 4.6s ease both;
}

@keyframes matrix-console {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.94);
    filter: brightness(1.8);
  }
  11%,
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    filter: brightness(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -60%) scale(0.95);
    filter: brightness(0.5);
  }
}

@keyframes mx-status {
  0%,
  56% {
    opacity: 0;
    transform: translateY(5px);
  }
  64%,
  88% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
  }
}

@keyframes matrix-scan {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(88px);
  }
}
</style>
