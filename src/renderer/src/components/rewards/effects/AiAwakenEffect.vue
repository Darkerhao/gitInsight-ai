<script setup lang="ts">
import { Eye } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const CODE_CHARS = '01<>/{}[]=+*#$&λΣΨ'.split('');
const DATA_GLYPHS = ['✓', 'DAY+1', '+币', 'SYNC', '100%', 'OK'];
const IRIS_AT = 1600;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const irisR = Math.min(api.width, api.height) * 0.3;

  // 幕一：黑暗中代码流向心汇入，速度渐快
  api.every(22, (index) => {
    const angle = api.range(0, Math.PI * 2);
    const radius = Math.max(api.width, api.height) * 0.62;
    const speed = 160 + index * 5;
    api.spawn({
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * speed, vy: -Math.sin(angle) * speed,
      shape: 'glyph', glyph: api.pick(CODE_CHARS), size: api.range(11, 19),
      maxLife: radius / speed, color: api.rng() > 0.6 ? '#f472b6' : '#67e8f9',
      fadeIn: 0.1, fadeOut: 0.2,
    });
  }, { until: IRIS_AT - 100 });

  // 幕二：虹膜 —— seed 生成多层弧段，逐段通电点亮，反向旋转
  type IrisSeg = { ring: number; start: number; span: number; bootAt: number; color: string };
  const segments: IrisSeg[] = [];
  const ringRadii = [0.42, 0.6, 0.78, 0.95];
  ringRadii.forEach((rr, ring) => {
    const count = 10 + Math.floor(api.rng() * 9);
    for (let s = 0; s < count; s += 1) {
      segments.push({
        ring,
        start: (s / count) * Math.PI * 2 + api.range(0, 0.2),
        span: (Math.PI * 2 / count) * api.range(0.4, 0.82),
        bootAt: IRIS_AT + api.range(0, 1400),
        color: api.rng() > 0.55 ? '#f472b6' : api.rng() > 0.4 ? '#67e8f9' : '#e879f9',
      });
    }
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < IRIS_AT) return;
    const globalFade = Math.max(0, Math.min(1, (5100 - tMs) / 260 + 1)) * (tMs > 5100 ? Math.max(0, 1 - (tMs - 5100) / 300) : 1);
    if (globalFade <= 0.02) return;
    for (const seg of segments) {
      if (tMs < seg.bootAt) continue;
      const boot = Math.min(1, (tMs - seg.bootAt) / 260);
      const dir = seg.ring % 2 === 0 ? 1 : -1;
      const rot = dir * (tMs - IRIS_AT) / 1000 * (0.14 + seg.ring * 0.05);
      const r = irisR * ringRadii[seg.ring];
      ctx.strokeStyle = seg.color;
      ctx.globalAlpha = boot * (0.34 + seg.ring * 0.1) * globalFade;
      ctx.lineWidth = 2.4 + seg.ring * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, seg.start + rot, seg.start + rot + seg.span * boot);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 辐射状纹理
    ctx.strokeStyle = `rgba(244, 114, 182, ${0.14 * globalFade})`;
    ctx.lineWidth = 1;
    const spokes = 28;
    const spin = (tMs - IRIS_AT) / 1000 * 0.1;
    for (let i = 0; i < spokes; i += 1) {
      const a = (i / spokes) * Math.PI * 2 + spin;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * irisR * 0.34, cy + Math.sin(a) * irisR * 0.34);
      ctx.lineTo(cx + Math.cos(a) * irisR * 0.96, cy + Math.sin(a) * irisR * 0.96);
      ctx.stroke();
    }
  });
  api.at(IRIS_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: irisR * 1.4, maxLife: 0.9, color: '#f472b6', opacity: 0.8, fadeOut: 0.7 });
  });

  // 幕三：瞳孔中环绕的签到数据
  api.every(300, () => {
    const orbitR = irisR * api.range(0.16, 0.3);
    let angle = api.range(0, Math.PI * 2);
    const w = api.range(0.8, 1.6);
    api.spawn({
      x: cx + Math.cos(angle) * orbitR, y: cy + Math.sin(angle) * orbitR,
      shape: 'glyph', glyph: api.pick(DATA_GLYPHS), size: api.range(11, 15),
      maxLife: api.range(1.2, 1.8), color: '#fdf2f8', twinkle: 1.6, fadeIn: 0.16, fadeOut: 0.3,
      update: (p, dt) => {
        angle += w * dt;
        p.x = cx + Math.cos(angle) * orbitR;
        p.y = cy + Math.sin(angle) * orbitR;
      },
    });
  }, { from: 3400, until: 4900 });

  // 眨眼熄灭后的一点余光
  api.at(5450, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 5, endSize: 1, maxLife: 0.5, color: '#f9a8d4', glow: 1.6, fadeOut: 0.6 });
  });
};
</script>

<template>
  <div class="ai-awaken-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.aiAwaken" :scene="scene" />
    <div class="ai-pupil">
      <Eye :size="34" />
    </div>
    <div class="ai-lid is-top" />
    <div class="ai-lid is-bottom" />
    <div class="ai-caption">CONSCIOUSNESS ONLINE_</div>
  </div>
</template>

<style scoped>
.ai-awaken-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.ai-pupil {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: radial-gradient(circle, #030109 0 52%, rgba(244, 114, 182, 0.24) 74%, transparent 82%);
  box-shadow: 0 0 34px rgba(244, 114, 182, 0.42);
  color: #f9a8d4;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  animation: ai-pupil 6s ease both;
}

.ai-lid {
  position: absolute;
  left: 0;
  right: 0;
  height: 50%;
  background: rgba(1, 2, 8, 0.94);
  animation-duration: 6s;
  animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  animation-fill-mode: both;
}

.ai-lid.is-top { top: 0; transform-origin: top; animation-name: ai-lid-top; }
.ai-lid.is-bottom { bottom: 0; transform-origin: bottom; animation-name: ai-lid-bottom; }

.ai-caption {
  position: absolute;
  left: 50%;
  bottom: 11%;
  overflow: hidden;
  border-right: 2px solid rgba(249, 168, 212, 0.9);
  color: #fbcfe8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.3em;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: ai-caption 6s steps(22) both;
}

@keyframes ai-pupil {
  0%, 26% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  34% { opacity: 1; transform: translate(-50%, -50%) scale(1.16); }
  40% { transform: translate(-50%, -50%) scale(0.72); }
  47%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  92%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
}

@keyframes ai-lid-top {
  0%, 24% { transform: scaleY(1); }
  33%, 82% { transform: scaleY(0); }
  88%, 91% { transform: scaleY(1); }
  93% { transform: scaleY(0.9); }
  96%, 100% { transform: scaleY(1); }
}

@keyframes ai-lid-bottom {
  0%, 24% { transform: scaleY(1); }
  33%, 82% { transform: scaleY(0); }
  88%, 91% { transform: scaleY(1); }
  93% { transform: scaleY(0.9); }
  96%, 100% { transform: scaleY(1); }
}

@keyframes ai-caption {
  0%, 40% { width: 0; opacity: 0; }
  44% { opacity: 1; }
  70%, 86% { width: 340px; opacity: 1; }
  100% { width: 340px; opacity: 0; }
}
</style>
