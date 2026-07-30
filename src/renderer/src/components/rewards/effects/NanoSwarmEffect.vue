<script setup lang="ts">
import { Component as ComponentIcon } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SWARM_COLORS = ['#4ade80', '#a3e635', '#bef264', '#d9f99d'];
// 节拍表（总 5800ms = entry 650 + loop 4250 + exit 900）
const WAVE_BEATS = [0, 150, 300, 450]; // 四路虫群分波涌入（上/下/左/右）
const LOCK_AT = 2350; // 聚形锁定确认脉冲
const CRACKLE_AT = 3550; // 二次噼啪
const DISBAND_AT = 4480; // 集体炸散退场

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
  api.setTrail(0.3);
  const points = sampleTextPoints('已签到', api.width, api.height);
  if (points.length === 0) return;
  const count = Math.min(points.length, 360);
  const center = { x: api.width / 2, y: api.height / 2 };
  // 文字包围盒（用于锁定括角与高光扫掠）
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  let disband = false;
  api.at(DISBAND_AT, () => {
    disband = true;
  });

  // ── 幕一：四路虫群分波涌入（近粒大亮 / 远粒小暗的双层纵深）──
  WAVE_BEATS.forEach((waveMs, edge) => {
    api.at(waveMs, () => {
      const born = waveMs / 1000;
      const n = Math.floor(count / WAVE_BEATS.length);
      for (let i = 0; i < n; i += 1) {
        const target = points[Math.floor(api.rng() * points.length)];
        const x = edge < 2 ? api.rng() * api.width : edge === 2 ? -16 : api.width + 16;
        const y = edge === 0 ? -16 : edge === 1 ? api.height + 16 : api.rng() * api.height;
        const near = api.rng() < 0.4;
        api.spawn({
          x, y,
          vx: api.range(-60, 60), vy: api.range(-60, 60),
          shape: 'dot',
          size: near ? api.range(2, 3) : api.range(1.2, 1.9),
          maxLife: (5450 - waveMs) / 1000,
          color: near ? api.pick(SWARM_COLORS) : '#65a30d',
          glow: near ? 1.1 : 0.7,
          opacity: near ? 1 : 0.6,
          wander: 90, drag: 0.24,
          fadeIn: 0.05, fadeOut: 0.1,
          update: (p, dt) => {
            if (disband) {
              // 解散：转为 streak 加速逃逸
              if (p.shape !== 'streak') {
                p.shape = 'streak';
                p.stretch = 0.08;
                p.wander = 0;
                const away = Math.atan2(p.y - center.y, p.x - center.x) + (api.rng() - 0.5) * 0.6;
                p.vx = Math.cos(away) * (160 + api.rng() * 300);
                p.vy = Math.sin(away) * (160 + api.rng() * 300);
                p.drag = 1;
                p.maxLife = Math.min(p.maxLife, p.life + 0.9);
              }
              return;
            }
            // 聚形弹簧力随绝对时间加强（1.35s 起收敛，1.8s 内合拢）
            const ageAbs = born + p.life;
            const ramp = Math.min(1, Math.max(0, (ageAbs - 1.35) / 0.9));
            if (ramp <= 0) return;
            p.wander = 90 * (1 - ramp) + 7;
            // 编队呼吸：目标点绕文字重心极缓胀缩
            const breathe = 1 + 0.016 * Math.sin(ageAbs * 2.3 + p.phase);
            const tx = center.x + (target.x - center.x) * breathe;
            const ty = center.y + (target.y - center.y) * breathe;
            p.vx += (tx - p.x) * 8.5 * ramp * dt;
            p.vy += (ty - p.y) * 8.5 * ramp * dt;
            p.vx *= 1 - Math.min(0.9, 3.4 * ramp * dt);
            p.vy *= 1 - Math.min(0.9, 3.4 * ramp * dt);
          },
        });
      }
    });
  });

  // ── 幕二：聚形锁定 —— 括角 + 确认脉冲 + 高光扫掠 + 二次噼啪 ──
  // 锁定括角（onFrame）：包围盒四角 L 形，聚形后亮起、解散前收走
  const pad = 30;
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < LOCK_AT || tMs > DISBAND_AT - 60) return;
    const env = Math.min(1, (tMs - LOCK_AT) / 320) * Math.min(1, Math.max(0, (DISBAND_AT - 60 - tMs) / 260));
    if (env <= 0.01) return;
    const arm = 16;
    ctx.strokeStyle = `rgba(190, 242, 100, ${0.62 * env})`;
    ctx.lineWidth = 1.6;
    const corners = [
      [minX - pad, minY - pad, 1, 1],
      [maxX + pad, minY - pad, -1, 1],
      [minX - pad, maxY + pad, 1, -1],
      [maxX + pad, maxY + pad, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + sx * arm, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * arm);
      ctx.stroke();
    }
  });
  api.at(LOCK_AT, () => {
    api.spawn({ x: center.x, y: center.y, shape: 'dot', size: 24, endSize: 90, maxLife: 0.4, color: '#f7fee7', glow: 1.8, fadeOut: 0.85 });
    api.spawn({
      x: center.x, y: center.y, shape: 'ring', size: 60,
      endSize: Math.min(api.width, api.height) * 0.46, maxLife: 0.9,
      color: '#4ade80', opacity: 0.65, fadeOut: 0.7,
    });
    for (let i = 0; i < 12; i += 1) {
      const pt = points[Math.floor(api.rng() * points.length)];
      api.spawn({ x: pt.x, y: pt.y, shape: 'dot', size: 3.2, endSize: 1, maxLife: 0.3, color: '#f7fee7', glow: 1.5, fadeOut: 0.6 });
    }
  });
  api.at(LOCK_AT + 300, () => {
    api.spawn({
      x: center.x, y: center.y, shape: 'ring', size: 100,
      endSize: Math.min(api.width, api.height) * 0.34, maxLife: 0.6,
      color: '#a3e635', opacity: 0.3, fadeOut: 0.6,
    });
  });
  // 高光扫掠：白热光带自左至右掠过字面
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 3050 || tMs > 3750) return;
    const prog = (tMs - 3050) / 700;
    const x = minX - 50 + (maxX - minX + 100) * prog;
    const grad = ctx.createLinearGradient(x - 34, 0, x + 34, 0);
    grad.addColorStop(0, 'rgba(247, 254, 231, 0)');
    grad.addColorStop(0.5, `rgba(247, 254, 231, ${0.2 * Math.sin(prog * Math.PI)})`);
    grad.addColorStop(1, 'rgba(247, 254, 231, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 34, minY - 34, 68, maxY - minY + 68);
  });
  api.at(CRACKLE_AT, () => {
    for (let i = 0; i < 8; i += 1) {
      const pt = points[Math.floor(api.rng() * points.length)];
      api.spawn({ x: pt.x, y: pt.y, shape: 'dot', size: 2.8, endSize: 1, maxLife: 0.28, color: '#ecfccb', glow: 1.4, fadeOut: 0.6 });
      api.spawn({ x: pt.x, y: pt.y, shape: 'ring', size: 3, endSize: 26, maxLife: 0.4, color: '#a3e635', opacity: 0.5, fadeOut: 0.6 });
    }
  });

  // ── 幕三：炸散退场 —— 白闪 + 环 + 光条逃逸，残留萤光明灭 ──
  api.at(DISBAND_AT, () => {
    api.spawn({ x: center.x, y: center.y, shape: 'dot', size: 30, endSize: 140, maxLife: 0.45, color: '#f7fee7', glow: 2, fadeOut: 0.9 });
    api.spawn({
      x: center.x, y: center.y, shape: 'ring', size: 40,
      endSize: Math.max(api.width, api.height) * 0.5, maxLife: 0.7,
      color: '#4ade80', opacity: 0.55, fadeOut: 0.65,
    });
  });
  api.every(90, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height,
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.6, 1),
      color: api.rng() < 0.6 ? '#bef264' : '#4ade80', glow: 1, twinkle: 3, wander: 30, fadeOut: 0.5,
    });
  }, { from: DISBAND_AT + 250, until: 5450 });
};
</script>

<template>
  <div class="nano-swarm-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.nanoSwarm" :scene="scene" />
    <div class="nano-tag">
      <small class="nt-code">NANITE BLOOM · UNITS 360</small>
      <div class="nt-main">
        <ComponentIcon :size="20" />
        <strong>纳米蜂群</strong>
      </div>
      <span class="nt-status">编队锁定 · 任务完成</span>
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
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 14px rgba(163, 230, 53, 0.55);
  transform: translateX(-50%);
  animation: nano-tag 5.8s ease both;
}

.nt-code {
  color: rgba(217, 249, 157, 0.6);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.26em;
}

.nt-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nt-main svg {
  filter: drop-shadow(0 0 12px rgba(163, 230, 53, 0.6));
}

.nt-main strong {
  font-size: 16px;
  letter-spacing: 0.24em;
}

.nt-status {
  color: rgba(236, 252, 203, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  animation: nt-status 5.8s ease both;
}

@keyframes nano-tag {
  0%, 42% { opacity: 0; transform: translateX(-50%) translateY(12px); }
  50%, 74% { opacity: 1; transform: translateX(-50%) translateY(0); }
  82%, 100% { opacity: 0; }
}

@keyframes nt-status {
  0%, 52% { opacity: 0; transform: translateY(4px); }
  58%, 74% { opacity: 1; transform: translateY(0); }
  82%, 100% { opacity: 0; }
}
</style>
