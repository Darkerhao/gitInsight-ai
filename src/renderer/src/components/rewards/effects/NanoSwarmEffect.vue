<script setup lang="ts">
import { Component as ComponentIcon } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SWARM_COLORS = ['#a3e635', '#bef264', '#4ade80', '#d9f99d'];
const DISBAND_AT = 4400;

/** 离屏 canvas 绘制文字后采样为目标点集 */
function sampleTextPoints(text: string, width: number, height: number): Array<{ x: number; y: number }> {
  const off = document.createElement('canvas');
  const scale = 0.5;
  off.width = Math.max(1, Math.round(width * scale));
  off.height = Math.max(1, Math.round(height * scale));
  const ctx = off.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.round(Math.min(off.width / 4.6, off.height / 3.4))}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, off.width / 2, off.height / 2);
  const data = ctx.getImageData(0, 0, off.width, off.height).data;
  const points: Array<{ x: number; y: number }> = [];
  const step = 4;
  for (let y = 0; y < off.height; y += step) {
    for (let x = 0; x < off.width; x += step) {
      if (data[(y * off.width + x) * 4 + 3] > 128) {
        points.push({ x: x / scale, y: y / scale });
      }
    }
  }
  return points;
}

const scene: SceneFn = (api) => {
  api.setTrail(0.34);
  const points = sampleTextPoints('已签到 ✓', api.width, api.height);
  const count = Math.min(points.length, 380);
  let disband = false;
  api.at(DISBAND_AT, () => {
    disband = true;
  });

  // 幕一：微粒自四边涌入；幕二：弹簧吸附聚形；幕三：炸散逃逸
  for (let i = 0; i < count; i += 1) {
    const target = points[Math.floor(api.rng() * points.length)];
    const edge = Math.floor(api.rng() * 4);
    const x = edge < 2 ? api.rng() * api.width : edge === 2 ? -16 : api.width + 16;
    const y = edge === 0 ? -16 : edge === 1 ? api.height + 16 : api.rng() * api.height;
    api.spawn({
      x, y,
      vx: api.range(-60, 60), vy: api.range(-60, 60),
      shape: 'dot', size: api.range(1.4, 2.6), maxLife: 5.5,
      color: SWARM_COLORS[Math.floor(api.rng() * SWARM_COLORS.length)],
      glow: 1, wander: 90, drag: 0.24,
      fadeIn: 0.05, fadeOut: 0.1,
      update: (p, dt) => {
        if (disband) {
          // 解散：转为 streak 加速逃逸
          if (p.shape !== 'streak') {
            p.shape = 'streak';
            p.stretch = 0.08;
            p.wander = 0;
            const away = Math.atan2(p.y - api.height / 2, p.x - api.width / 2) + (api.rng() - 0.5) * 0.6;
            p.vx = Math.cos(away) * (160 + api.rng() * 300);
            p.vy = Math.sin(away) * (160 + api.rng() * 300);
            p.drag = 1;
            p.maxLife = Math.min(p.maxLife, p.life + 0.9);
          }
          return;
        }
        // 聚形力随时间加强（前 1.4s 自由游弋）
        const ramp = Math.min(1, Math.max(0, (p.life - 1.3) / 0.9));
        if (ramp <= 0) return;
        p.wander = 90 * (1 - ramp) + 7;
        p.vx += (target.x - p.x) * 8.5 * ramp * dt;
        p.vy += (target.y - p.y) * 8.5 * ramp * dt;
        p.vx *= 1 - Math.min(0.9, 3.4 * ramp * dt);
        p.vy *= 1 - Math.min(0.9, 3.4 * ramp * dt);
      },
    });
  }

  // 聚形完成时的确认脉冲
  api.at(2900, () => {
    api.spawn({
      x: api.width / 2, y: api.height / 2, shape: 'ring', size: 60,
      endSize: Math.min(api.width, api.height) * 0.5, maxLife: 0.9,
      color: '#a3e635', opacity: 0.7, fadeOut: 0.7,
    });
  });

  // 解散后的残留萤光
  api.every(90, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height,
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.6, 1.1),
      color: '#bef264', glow: 1, twinkle: 3, wander: 30, fadeOut: 0.5,
    });
  }, { from: DISBAND_AT + 300, until: api.duration - 500 });
};
</script>

<template>
  <div class="nano-swarm-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.nanoSwarm" :scene="scene" />
    <div class="nano-tag">
      <ComponentIcon :size="22" />
      <strong>NANOSWARM PROTOCOL</strong>
      <small>集群单元 380 · 编队完成</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nano-swarm-effect {
  @include effect-stage(hidden);
}

.nano-tag {
  position: absolute;
  left: 50%;
  bottom: 11%;
  color: #d9f99d;
  display: grid;
  gap: 4px;
  place-items: center;
  text-shadow: 0 0 14px rgba(163, 230, 53, 0.55);
  transform: translateX(-50%);
  animation: nano-tag 5.8s ease both;
}

.nano-tag strong {
  font-size: 13px;
  letter-spacing: 0.22em;
}

.nano-tag small {
  color: rgba(217, 249, 157, 0.68);
  font-size: 11px;
}

@keyframes nano-tag {
  0%, 40% { opacity: 0; transform: translateX(-50%) translateY(12px); }
  50%, 72% { opacity: 1; transform: translateX(-50%) translateY(0); }
  82%, 100% { opacity: 0; }
}
</style>
