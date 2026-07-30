<script setup lang="ts">
import { Clock3 } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 时间折叠 TEMPORAL FOLD · 4.9s
 * 幕一 0-550ms    九块空间面板 3D 折入，表盘通电，秒针起走
 * 幕二 2200ms     白闪触发倒流：秒针平滑反旋、时之砂上升、涟漪内收、青色回波环收缩
 * 幕三 3600ms     恢复正向：确认双环荡开，尾段面板坍闭、表盘淡出
 * 配色：白热核心 + 蓝主色（#60a5fa）辉光 + 青辅色（#2dd4bf）点缀
 */
const REWIND_AT = 2200; // 时间倒流的瞬间
const RESUME_AT = 3600; // 时间恢复正向

const scene: SceneFn = (api) => {
  api.setTrail(0.14);
  const cx = api.width / 2;
  const cy = api.height / 2;
  let timeDir = 1; // 目标方向
  let dirEased = 1; // 平滑插值后的实际方向（秒针/砂粒共用）

  // ── 秒针（onFrame 自定义绘制）：正走 → 倒流平滑反旋 → 恢复 ──
  let handAngle = -Math.PI / 2;
  api.onFrame((tMs, dt, ctx) => {
    dirEased += (timeDir - dirEased) * Math.min(1, dt * 7);
    const fade = Math.min(1, tMs / 500) * Math.max(0, Math.min(1, (api.duration - 700 - tMs) / 500));
    if (fade <= 0.02) return;
    handAngle += 2.6 * dirEased * dt;
    const r = 92;
    const hx = cx + Math.cos(handAngle) * r;
    const hy = cy + Math.sin(handAngle) * r;
    // 扫掠余辉扇面
    ctx.fillStyle = `rgba(96, 165, 250, ${0.1 * fade})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, handAngle - 0.66 * dirEased, handAngle, dirEased < 0);
    ctx.closePath();
    ctx.fill();
    // 针体 + 白热针尖
    const grad = ctx.createLinearGradient(cx, cy, hx, hy);
    grad.addColorStop(0, `rgba(147, 197, 253, ${0.1 * fade})`);
    grad.addColorStop(1, `rgba(219, 234, 254, ${0.9 * fade})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * fade})`;
    ctx.beginPath();
    ctx.arc(hx, hy, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── 双层轨道粒子流：外环随时间方向，内环反向（残像对旋的层次）──
  api.every(26, () => {
    let angle = api.range(0, Math.PI * 2);
    const radius = api.range(112, 150);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'spark', size: api.range(1.6, 2.8), maxLife: api.range(0.8, 1.4),
      color: api.rng() < 0.7 ? '#93c5fd' : '#e0e7ff',
      glow: 1.1, fadeIn: 0.1,
      update: (p, dt) => {
        angle += 2.8 * dirEased * dt;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius;
      },
    });
  }, { until: api.duration - 800 });
  api.every(46, () => {
    let angle = api.range(0, Math.PI * 2);
    const radius = api.range(66, 92);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'spark', size: api.range(1.1, 1.9), maxLife: api.range(0.7, 1.2),
      color: '#5eead4', glow: 0.9, opacity: 0.7, fadeIn: 0.12,
      update: (p, dt) => {
        angle -= 2.2 * dirEased * dt; // 与外环对旋
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius;
      },
    });
  }, { from: 300, until: api.duration - 900 });

  // ── 时之砂：活粒子随 dirEased 实时改向（倒流瞬间全场砂粒同步反转）──
  api.every(36, () => {
    const base = api.range(120, 260);
    api.spawn({
      x: api.range(0, api.width),
      y: timeDir > 0 ? -8 : api.height + 8,
      vx: api.range(-20, 20),
      shape: 'dot', size: api.range(1, 2.2), maxLife: api.range(1.2, 2.2),
      color: timeDir > 0 ? '#93c5fd' : '#bfdbfe',
      twinkle: api.range(3, 7), wander: 30, glow: 1,
      update: (p) => {
        p.vy = base * dirEased;
      },
    });
  }, { until: api.duration - 900 });

  // ── 时间涟漪：正向外扩、倒流内收 ──
  api.every(460, () => {
    const outward = timeDir > 0;
    api.spawn({
      x: cx, y: cy, shape: 'ring',
      size: outward ? 90 : 300,
      endSize: outward ? 320 : 60,
      maxLife: 1.1, color: '#93c5fd', opacity: 0.5, fadeIn: 0.1, fadeOut: 0.5,
    });
  }, { from: 300, until: api.duration - 1200 });

  // ── 残像刻度：表盘外围闪现的罗马数字，随方向反旋 ──
  api.every(240, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(170, 250);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'glyph',
      glyph: api.pick(['Ⅻ', 'Ⅲ', 'Ⅵ', 'Ⅸ', '∞', '⧖']),
      size: api.range(14, 24), maxLife: api.range(0.6, 1),
      color: 'rgba(191, 219, 254, 0.9)',
      spin: api.range(-0.8, 0.8) * timeDir,
      fadeIn: 0.2, fadeOut: 0.4,
    });
  }, { from: 400, until: api.duration - 1000 });

  // ── 2200ms 倒流：白闪 + 涟漪急收 + 青色回波环持续收缩 ──
  api.at(REWIND_AT, () => {
    timeDir = -1;
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 50, endSize: 4, maxLife: 0.45, color: '#eff6ff', glow: 2.2 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 250, endSize: 20, maxLife: 0.8, color: '#93c5fd', opacity: 0.9, fadeIn: 0.06 });
    api.burst({
      x: cx, y: cy, count: 26, speed: [60, 220],
      base: { shape: 'spark', size: 1.6, maxLife: 0.7, color: '#dbeafe', glow: 1, drag: 0.4, fadeOut: 0.5 },
      vary: (p, rng) => {
        if (rng() < 0.3) p.color = '#5eead4';
      },
    });
  });
  api.every(320, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 260, endSize: 40,
      maxLife: 0.7, color: '#2dd4bf', opacity: 0.34, fadeIn: 0.08, fadeOut: 0.5,
    });
  }, { from: REWIND_AT + 260, until: RESUME_AT - 260 });

  // ── 3600ms 恢复正向：确认双环 + 表盘边缘微火花 ──
  api.at(RESUME_AT, () => {
    timeDir = 1;
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 280, maxLife: 0.8, color: '#bfdbfe', opacity: 0.9 });
  });
  api.at(RESUME_AT + 140, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 40, endSize: 340, maxLife: 0.8, color: '#5eead4', opacity: 0.4, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 22, speed: [120, 260],
      base: { shape: 'spark', size: 1.5, maxLife: 0.6, color: '#eff6ff', glow: 1, drag: 0.4, fadeOut: 0.5 },
    });
  });

  // ── 尾段余尘：表盘熄灭后残余蓝尘缓漂 ──
  api.every(90, () => {
    api.spawn({
      x: cx + api.range(-170, 170),
      y: cy + api.range(-130, 130),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.5, 0.9),
      color: api.pick(['#93c5fd', '#dbeafe']),
      glow: 0.8, wander: 34, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: 4150, until: 4520 });
};
</script>

<template>
  <div class="time-fold-effect">
    <div class="time-fold-stage">
      <span
        v-for="fold in 9"
        :key="fold"
        class="time-fold-panel"
        :style="{ animationDelay: `${fold * 90}ms`, '--fold-shade': `${0.16 + (fold % 3) * 0.08}` }"
      />
    </div>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.timeFold" :scene="scene" />
    <div class="time-fold-clock">
      <span v-for="tick in 18" :key="tick" :style="{ '--tick-angle': `${tick * 20}deg` }" />
      <Clock3 :size="48" />
      <strong>时间折叠</strong>
      <small>TEMPORAL FOLD · ΔT −1.4s</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.time-fold-effect {
  @include effect-stage(hidden);
  perspective: 900px;
}

.time-fold-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(680px, 88vw);
  height: min(410px, 68vh);
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  transform: translate(-50%, -50%);
}

.time-fold-panel {
  border: 1px solid rgba(147, 197, 253, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, var(--fold-shade)), rgba(96, 165, 250, 0.08)),
    rgba(15, 23, 42, 0.28);
  box-shadow: inset 0 0 36px rgba(96, 165, 250, 0.12);
  opacity: 0;
  transform-origin: center top;
  animation: time-fold-panel 4.9s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.time-fold-panel:nth-child(odd) {
  transform-origin: center bottom;
}

.time-fold-clock {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 210px;
  height: 210px;
  border: 1px solid rgba(191, 219, 254, 0.46);
  border-radius: 50%;
  color: #dbeafe;
  display: grid;
  gap: 6px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: time-fold-clock 4.9s ease both;
}

.time-fold-clock::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(96, 165, 250, 0.3), transparent 40%);
  animation: time-fold-spin 1.5s linear infinite;
}

.time-fold-clock span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 14px;
  border-radius: 999px;
  background: rgba(191, 219, 254, 0.72);
  transform: rotate(var(--tick-angle)) translateY(-96px);
  transform-origin: center 96px;
}

.time-fold-clock svg,
.time-fold-clock strong,
.time-fold-clock small {
  position: relative;
  z-index: 1;
}

.time-fold-clock strong {
  font-size: 15px;
  letter-spacing: 0.14em;
}

.time-fold-clock small {
  color: rgba(191, 219, 254, 0.64);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
}

@keyframes time-fold-panel {
  0% { opacity: 0; transform: rotateX(82deg) scaleY(0.08); filter: blur(10px); }
  30% { opacity: 1; transform: rotateX(0deg) scaleY(1); filter: blur(0); }
  42% { transform: rotateX(0deg) scaleY(0.985); }
  46% { transform: rotateX(-4deg) scaleY(1.01); }
  66% { opacity: 1; transform: rotateX(0deg) scaleY(1); }
  100% { opacity: 0; transform: rotateX(-74deg) scaleY(0.1); filter: blur(8px); }
}

@keyframes time-fold-clock {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.62) rotate(-20deg); }
  20%, 42% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  47% { opacity: 1; transform: translate(-50%, -50%) scale(0.94) rotate(-6deg); }
  56%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
}

@keyframes time-fold-spin {
  to { transform: rotate(360deg); }
}
</style>
