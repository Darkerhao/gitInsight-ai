<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SCAN_MS = 3600; // 与 CSS 扫描线动画时长一致

const scene: SceneFn = (api) => {
  api.setTrail(0.28);
  const W = api.width;
  const H = api.height;
  // 与 CSS 扫描线一致的 ease-out 推进
  const scanY = (tMs: number) => (1 - Math.pow(1 - Math.min(1, tMs / SCAN_MS), 3)) * H;

  // 远景霾光：低空漂浮的城市微尘（远小暗 → 纵深底噪）
  for (let i = 0; i < 26; i += 1) {
    api.spawn({
      x: api.rng() * W, y: H * api.range(0.5, 0.92),
      vx: api.range(-8, 8), vy: api.range(-6, -2),
      shape: 'dot', size: api.range(0.7, 1.6), maxLife: api.duration / 1000,
      color: api.rng() > 0.8 ? '#a78bfa' : '#67e8f9',
      glow: 0.7, opacity: api.range(0.12, 0.3), twinkle: api.range(0.5, 1.6), fadeIn: 0.14, fadeOut: 0.16,
    });
  }

  // 扫描前沿拖曳的识别短划：沿扫描线横向掠出的白热刻度
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > SCAN_MS) return;
    const y = scanY(tMs);
    const sweep = (tMs / 1000) * 3.1;
    ctx.strokeStyle = 'rgba(207, 250, 254, 0.4)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i += 1) {
      const x = ((i / 7 + sweep * 0.13) % 1) * W;
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x + 16, y + 4);
      ctx.stroke();
    }
  });

  // 扫描识别反馈：光环 + 白热闪心 + 十六进制识别码，偶发紫色标记（辅色点缀）
  api.every(120, (index) => {
    const tNow = index * 120;
    if (tNow > SCAN_MS) return;
    const y = scanY(tNow);
    const x = api.range(W * 0.08, W * 0.92);
    api.spawn({ x, y, shape: 'ring', size: 4, endSize: 44, maxLife: 0.55, color: '#67e8f9', opacity: 0.85, fadeOut: 0.5 });
    api.spawn({ x, y, shape: 'dot', size: 3.4, endSize: 1.6, maxLife: 0.5, color: '#f0fdfa', glow: 1.6, fadeOut: 0.6 });
    if (api.rng() < 0.42) {
      api.spawn({
        x: x + api.range(-20, 20), y: y - api.range(10, 30), vy: -30,
        shape: 'glyph',
        glyph: `${Math.floor(api.range(0, 255)).toString(16).toUpperCase().padStart(2, '0')}`,
        size: 12, maxLife: 0.8, color: '#a5f3fc', opacity: 0.9, fadeIn: 0.15, fadeOut: 0.4,
      });
    }
    if (api.rng() < 0.16) {
      api.spawn({ x, y, shape: 'ring', size: 10, endSize: 26, maxLife: 0.45, color: '#a78bfa', opacity: 0.6, fadeOut: 0.6 });
    }
  }, { until: SCAN_MS });

  // 建筑数据上传：近层亮束 + 远层暗束（双层视差）
  api.every(64, () => {
    const near = api.rng() < 0.6;
    api.spawn({
      x: api.range(W * 0.12, W * 0.88),
      y: H * api.range(0.62, 0.9),
      vy: -(near ? api.range(240, 420) : api.range(120, 210)),
      shape: 'streak', stretch: near ? 0.08 : 0.05,
      size: near ? api.range(1.6, 2.4) : api.range(0.9, 1.3),
      maxLife: api.range(0.7, 1.3),
      color: near ? (api.rng() < 0.75 ? '#22d3ee' : '#5eead4') : '#0e7490',
      glow: near ? 1 : 0.6, opacity: near ? 1 : 0.6, fadeIn: 0.1, fadeOut: 0.25,
    });
  }, { from: 700, until: api.duration - 900 });

  // 数据包字符：偶发的地址码随束流上行
  api.every(420, () => {
    api.spawn({
      x: api.range(W * 0.16, W * 0.84), y: H * api.range(0.68, 0.85), vy: -api.range(70, 120),
      shape: 'glyph',
      glyph: `#${Math.floor(api.range(0, 4096)).toString(16).toUpperCase().padStart(3, '0')}`,
      size: 10, maxLife: api.range(0.9, 1.4), color: '#5eead4', opacity: 0.6, fadeIn: 0.14, fadeOut: 0.35,
    });
  }, { from: 1100, until: SCAN_MS });

  // 扫描完成：全城点亮 —— 白热闪心 + 三重确认环 + 上半球火花
  api.at(SCAN_MS + 100, () => {
    const cx = W / 2;
    const cy = H * 0.6;
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 20, endSize: 130, maxLife: 0.5, color: '#ecfeff', glow: 2, fadeOut: 0.85 });
    api.burst({
      x: cx, y: cy, count: 46, speed: [80, 420],
      angle: [Math.PI, Math.PI * 2],
      base: { shape: 'spark', size: 1.8, drag: 0.4, color: '#a5f3fc', twinkle: 8, glow: 1.1, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.maxLife = 0.7 + rng() * 0.8;
        if (rng() < 0.2) p.color = '#c4b5fd';
      },
    });
  });
  [0, 150, 320].forEach((delay, i) => {
    api.at(SCAN_MS + 100 + delay, () => {
      api.spawn({
        x: W / 2, y: H * 0.6, shape: 'ring', size: 40,
        endSize: Math.max(W, H) * (0.4 + i * 0.14),
        maxLife: 0.9, color: i === 1 ? '#a78bfa' : '#67e8f9',
        opacity: 0.8 - i * 0.2, fadeOut: 0.7,
      });
    });
  });
  // 回波：确认后的一记低亮余环
  api.at(SCAN_MS + 620, () => {
    api.spawn({ x: W / 2, y: H * 0.6, shape: 'ring', size: 80, endSize: Math.max(W, H) * 0.5, maxLife: 0.8, color: '#22d3ee', opacity: 0.26, fadeOut: 0.8 });
  });
};
</script>

<template>
  <div class="city-scan-effect">
    <div class="city-map">
      <span
        v-for="block in 36"
        :key="block"
        class="city-block"
        :class="{ accent: block % 7 === 3 }"
        :style="{ height: `${22 + ((block * 13) % 86)}px`, animationDelay: `${(block % 7) * 90}ms` }"
      />
    </div>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.cityScan" :scene="scene" />
    <div class="city-scan-line" />
    <div class="city-scan-label">
      <small class="city-code">URBAN SWEEP // SECTOR GRID-07</small>
      <Building2 :size="42" />
      <strong>城域测绘</strong>
      <small class="city-sub">UPLINK 100% · 全城点亮</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.city-scan-effect {
  @include effect-stage(hidden);
}

.city-map {
  position: absolute;
  left: 50%;
  bottom: 14%;
  width: min(760px, 88vw);
  height: min(390px, 62vh);
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: end;
  gap: 10px;
  padding: 22px;
  transform: translateX(-50%) perspective(700px) rotateX(52deg);
  transform-origin: center bottom;
  mask-image: linear-gradient(180deg, transparent 0, #000 14% 88%, transparent 100%);
}

.city-map::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(34, 211, 238, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 211, 238, 0.18) 1px, transparent 1px);
  background-size: 42px 42px;
  opacity: 0;
  animation: city-grid 4.8s ease both;
}

.city-block {
  position: relative;
  z-index: 1;
  min-height: 16px;
  border: 1px solid rgba(34, 211, 238, 0.32);
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.32), rgba(59, 130, 246, 0.1));
  box-shadow: inset 0 0 18px rgba(34, 211, 238, 0.12);
  opacity: 0;
  transform: scaleY(0.18);
  transform-origin: center bottom;
  animation: city-block 4.8s ease both;
}

.city-block.accent {
  border-color: rgba(167, 139, 250, 0.4);
  background: linear-gradient(180deg, rgba(167, 139, 250, 0.3), rgba(76, 29, 149, 0.12));
  box-shadow: inset 0 0 18px rgba(167, 139, 250, 0.14);
}

.city-scan-line {
  position: absolute;
  left: 0;
  right: 0;
  top: -18%;
  height: 18vh;
  background: linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.36), rgba(255, 255, 255, 0.82), transparent);
  box-shadow: 0 0 42px rgba(34, 211, 238, 0.46);
  opacity: 0;
  animation: city-scan 3.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.city-scan-label {
  position: absolute;
  left: 50%;
  top: 40%;
  display: grid;
  gap: 8px;
  place-items: center;
  color: #cffafe;
  text-shadow: 0 0 22px rgba(34, 211, 238, 0.5);
  transform: translate(-50%, -50%);
  animation: city-label 4.8s ease both;
}

.city-scan-label svg {
  color: #22d3ee;
  filter: drop-shadow(0 0 20px rgba(34, 211, 238, 0.6));
}

.city-scan-label strong {
  font-size: 17px;
  letter-spacing: 0.16em;
}

.city-code {
  color: rgba(165, 243, 252, 0.6);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.28em;
}

.city-sub {
  color: rgba(196, 181, 253, 0.72);
  font-size: 11px;
  letter-spacing: 0.14em;
}

@keyframes city-grid {
  0%, 100% { opacity: 0; }
  16%, 80% { opacity: 1; }
}

@keyframes city-block {
  0%, 6% { opacity: 0; transform: scaleY(0.18); filter: brightness(0.8); }
  26%, 76% { opacity: 1; transform: scaleY(1); filter: brightness(1.16); }
  79%, 84% { opacity: 1; transform: scaleY(1); filter: brightness(1.62); }
  100% { opacity: 0; transform: scaleY(0.9); filter: brightness(0.9); }
}

@keyframes city-scan {
  0% { opacity: 0; transform: translateY(0); }
  10% { opacity: 1; }
  88% { opacity: 1; }
  100% { opacity: 0; transform: translateY(126vh); }
}

@keyframes city-label {
  0%, 44% { opacity: 0; transform: translate(-50%, -44%) scale(0.92); }
  54%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -54%) scale(0.97); }
}
</style>
