<script setup lang="ts">
import { Eye } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const CODE_CHARS = '01<>/{}[]=+*#$&λΣΨ'.split('');
const DATA_GLYPHS = ['READY', 'DAY+1', '+甲币', 'SYNC 100%', 'AUTH OK', 'FOCUS'];
const IRIS_AT = 1600;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const irisR = Math.min(api.width, api.height) * 0.3;

  // 幕一：黑暗中代码流向心汇入 —— 速度渐快、近心透视缩小（纵深吸入感）
  api.every(22, (index) => {
    const angle = api.range(0, Math.PI * 2);
    const radius = Math.max(api.width, api.height) * 0.62;
    const speed = 150 + index * 6;
    api.spawn({
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * speed, vy: -Math.sin(angle) * speed,
      shape: 'glyph', glyph: api.pick(CODE_CHARS), size: api.range(13, 21),
      maxLife: radius / speed,
      color: api.rng() > 0.62 ? '#f472b6' : api.rng() > 0.3 ? '#c084fc' : '#e9d5ff',
      fadeIn: 0.1, fadeOut: 0.16,
      update: (p) => {
        const d = Math.hypot(p.x - cx, p.y - cy);
        p.size = Math.max(7, p.size * (0.6 + 0.4 * Math.min(1, d / radius)));
      },
    });
  }, { until: IRIS_AT - 120 });

  // 汇入丝线：细长拖尾流光间插在字符流之间
  api.every(90, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = Math.max(api.width, api.height) * api.range(0.4, 0.58);
    const speed = api.range(420, 640);
    api.spawn({
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * speed, vy: -Math.sin(angle) * speed,
      shape: 'streak', stretch: 0.09, size: 1.6, maxLife: radius / speed,
      color: api.rng() > 0.5 ? '#c084fc' : '#f9a8d4', glow: 0.9, fadeIn: 0.08, fadeOut: 0.2,
    });
  }, { from: 260, until: IRIS_AT - 160 });

  // 苏醒前兆 0.7s：一环暗脉冲向心收缩
  api.at(700, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 300, endSize: 40, maxLife: 0.7, color: '#c084fc', opacity: 0.3, fadeIn: 0.1, fadeOut: 0.5 });
  });

  // 幕二：虹膜 —— seed 生成五层弧段，逐段通电（附通电火花），反向旋转
  type IrisSeg = { ring: number; start: number; span: number; bootAt: number; color: string; booted: boolean };
  const segments: IrisSeg[] = [];
  const ringRadii = [0.4, 0.55, 0.7, 0.84, 0.97];
  ringRadii.forEach((rr, ring) => {
    const count = 8 + Math.floor(api.rng() * 7);
    for (let s = 0; s < count; s += 1) {
      segments.push({
        ring,
        start: (s / count) * Math.PI * 2 + api.range(0, 0.2),
        span: (Math.PI * 2 / count) * api.range(0.4, 0.82),
        bootAt: IRIS_AT + ring * 130 + api.range(0, 900),
        color: api.rng() > 0.55 ? '#f472b6' : api.rng() > 0.35 ? '#c084fc' : '#e879f9',
        booted: false,
      });
    }
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < IRIS_AT) return;
    const globalFade = tMs < 5000 ? 1 : Math.max(0, 1 - (tMs - 5000) / 300);
    if (globalFade <= 0.02) return;
    const elapsed = (tMs - IRIS_AT) / 1000;
    const spinRamp = Math.min(1, elapsed / 0.8); // 旋转缓入
    for (const seg of segments) {
      if (tMs < seg.bootAt) continue;
      if (!seg.booted) {
        seg.booted = true;
        const r = irisR * ringRadii[seg.ring];
        api.spawn({
          x: cx + Math.cos(seg.start) * r, y: cy + Math.sin(seg.start) * r,
          shape: 'spark', size: 2.2, maxLife: 0.4, color: '#fdf4ff', glow: 1.5, fadeOut: 0.6,
        });
      }
      const boot = Math.min(1, (tMs - seg.bootAt) / 260);
      const dir = seg.ring % 2 === 0 ? 1 : -1;
      const rot = dir * elapsed * spinRamp * (0.12 + seg.ring * 0.05);
      const r = irisR * ringRadii[seg.ring];
      ctx.strokeStyle = seg.color;
      ctx.globalAlpha = boot * (0.3 + seg.ring * 0.09) * globalFade;
      ctx.lineWidth = 2.2 + seg.ring * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, seg.start + rot, seg.start + rot + seg.span * boot);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 辐射状纹理：内圈至外圈的细密纹路缓旋
    ctx.strokeStyle = `rgba(192, 132, 252, ${0.13 * globalFade})`;
    ctx.lineWidth = 1;
    const spokes = 30;
    const spin = elapsed * 0.09;
    for (let i = 0; i < spokes; i += 1) {
      const a = (i / spokes) * Math.PI * 2 + spin;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * irisR * 0.32, cy + Math.sin(a) * irisR * 0.32);
      ctx.lineTo(cx + Math.cos(a) * irisR * 0.96, cy + Math.sin(a) * irisR * 0.96);
      ctx.stroke();
    }
  });
  // 睁眼瞬间：主涟漪 + 200ms 粉色回波
  api.at(IRIS_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: irisR * 1.4, maxLife: 0.9, color: '#c084fc', opacity: 0.8, fadeOut: 0.7 });
  });
  api.at(IRIS_AT + 200, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: irisR * 1.7, maxLife: 0.8, color: '#f472b6', opacity: 0.4, fadeOut: 0.8 });
  });

  // 2.4s 定焦：瞳孔收缩的同时一道白热镜面眩光横扫虹膜
  api.at(2400, () => {
    api.spawn({
      x: cx - irisR * 1.1, y: cy - irisR * 0.42, vx: irisR * 2.9, vy: irisR * 0.36,
      shape: 'streak', stretch: 0.12, size: 2.6, maxLife: 0.75,
      color: '#fdf2f8', glow: 1.6, fadeIn: 0.12, fadeOut: 0.35,
    });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 10, endSize: 3, maxLife: 0.4, color: '#ffffff', glow: 1.8, fadeOut: 0.7 });
  });

  // 虹膜外缘电弧微火花：通电后沿最外环偶发噼啪
  api.every(240, () => {
    const a = api.range(0, Math.PI * 2);
    const r = irisR * 0.97;
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      vx: Math.cos(a) * api.range(16, 50), vy: Math.sin(a) * api.range(16, 50),
      shape: 'spark', size: api.range(1.1, 1.9), maxLife: api.range(0.3, 0.55),
      color: api.rng() > 0.5 ? '#f9a8d4' : '#e9d5ff', glow: 1.1, fadeOut: 0.5,
    });
  }, { from: 2300, until: 4800 });

  // 幕三：瞳孔中环绕的签到数据（轨道半径微呼吸）
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
        const rr = orbitR * (1 + Math.sin(p.life * 2.4 + p.phase) * 0.06);
        p.x = cx + Math.cos(angle) * rr;
        p.y = cy + Math.sin(angle) * rr;
      },
    });
  }, { from: 3300, until: 4900 });

  // 眨眼熄灭后的一点余光 + 消散微尘
  api.at(5450, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 5, endSize: 1, maxLife: 0.5, color: '#f9a8d4', glow: 1.6, fadeOut: 0.6 });
    for (let i = 0; i < 8; i += 1) {
      api.spawn({
        x: cx + api.range(-30, 30), y: cy + api.range(-20, 20),
        vy: -api.range(8, 26), shape: 'dot', size: api.range(0.8, 1.4),
        maxLife: api.range(0.3, 0.5), color: '#e9d5ff', glow: 1, wander: 20, fadeOut: 0.6,
      });
    }
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
    <div class="ai-caption-cn">觉醒之眼 · 注视已确认</div>
  </div>
</template>

<style scoped lang="scss">
.ai-awaken-effect {
  @include effect-stage(hidden);
}

.ai-pupil {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: radial-gradient(circle, #030109 0 52%, rgba(192, 132, 252, 0.24) 74%, transparent 82%);
  box-shadow:
    0 0 34px rgba(192, 132, 252, 0.42),
    0 0 80px rgba(244, 114, 182, 0.2);
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
  bottom: 12.5%;
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

.ai-caption-cn {
  position: absolute;
  left: 50%;
  bottom: 9%;
  color: rgba(233, 213, 255, 0.66);
  font-size: 11px;
  letter-spacing: 0.3em;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: ai-caption-cn 6s ease both;
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
  34%, 82% { transform: scaleY(0); }
  88%, 90.5% { transform: scaleY(1); }
  93% { transform: scaleY(0.86); }
  96%, 100% { transform: scaleY(1); }
}

@keyframes ai-lid-bottom {
  0%, 24% { transform: scaleY(1); }
  34%, 82% { transform: scaleY(0); }
  88%, 90.5% { transform: scaleY(1); }
  93% { transform: scaleY(0.86); }
  96%, 100% { transform: scaleY(1); }
}

@keyframes ai-caption {
  0%, 40% { width: 0; opacity: 0; }
  44% { opacity: 1; }
  70%, 86% { width: 340px; opacity: 1; }
  100% { width: 340px; opacity: 0; }
}

@keyframes ai-caption-cn {
  0%, 56% { opacity: 0; transform: translateX(-50%) translateY(6px); }
  66%, 86% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(0); }
}
</style>
