<script setup lang="ts">
import { Dna } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SCAN_MS = 1350;
const HELIX_FROM = 1350;
const HELIX_UNTIL = 3750;
const VERIFY_AT = 3750;
const BASE_PAIRS = [['A', 'T'], ['T', 'A'], ['C', 'G'], ['G', 'C']] as const;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const W = api.width;
  const H = api.height;
  const cx = W / 2;
  const helixR = Math.min(150, W * 0.17);
  const rise = 132;
  const waveLen = 46;
  const easeScan = (k: number) => 1 - Math.pow(1 - k, 2.2);

  // 幕一：扫描光带自上而下（白热芯 + 绿辉边），扫过区域留下余辉网格
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > SCAN_MS + 150) return;
    const k = Math.min(1, tMs / SCAN_MS);
    const y = easeScan(k) * H;
    const fade = tMs > SCAN_MS ? 1 - (tMs - SCAN_MS) / 150 : 1;
    ctx.strokeStyle = `rgba(74, 222, 128, ${0.05 * fade})`;
    ctx.lineWidth = 1;
    for (let gy = 40; gy < y; gy += 56) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }
    const grad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    grad.addColorStop(0, 'rgba(74, 222, 128, 0)');
    grad.addColorStop(0.42, `rgba(74, 222, 128, ${0.3 * fade})`);
    grad.addColorStop(0.5, `rgba(240, 253, 244, ${0.72 * fade})`);
    grad.addColorStop(0.58, `rgba(74, 222, 128, ${0.3 * fade})`);
    grad.addColorStop(1, 'rgba(74, 222, 128, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 30, W, 60);
  });
  // 扫描路径网格火花 + 左缘十六进制读数上浮
  api.every(60, (index) => {
    const tNow = index * 60;
    if (tNow > SCAN_MS) return;
    const y = easeScan(Math.min(1, tNow / SCAN_MS)) * H;
    for (let i = 0; i < 3; i += 1) {
      api.spawn({
        x: Math.round(api.rng() * (W / 42)) * 42, y: y + api.range(-4, 4),
        shape: 'spark', size: api.range(1.1, 2), maxLife: 0.5,
        color: '#86efac', glow: 1, fadeOut: 0.5,
      });
    }
    if (api.rng() < 0.5) {
      api.spawn({
        x: W * 0.07, y, vy: -18,
        shape: 'glyph', glyph: `0x${Math.floor(api.range(0, 65535)).toString(16).toUpperCase().padStart(4, '0')}`,
        size: 10, maxLife: 0.7, color: '#bbf7d0', opacity: 0.8, fadeIn: 0.12, fadeOut: 0.4,
      });
    }
  }, { until: SCAN_MS });

  // 幕二：双螺旋对旋上升 —— cos 相位调制大小与亮度（近大远小、后排压暗）
  api.every(20, () => {
    [0, Math.PI].forEach((strandPhase) => {
      api.spawn({
        x: cx, y: H + 12, vy: -rise,
        shape: 'dot', size: 3, maxLife: (H + 40) / rise,
        color: strandPhase === 0 ? '#4ade80' : '#a3e635',
        glow: 1.1, fadeIn: 0.04, fadeOut: 0.08, phase: strandPhase,
        update: (p) => {
          const t = (H - p.y) / waveLen + p.phase;
          const depth = Math.cos(t);
          p.x = cx + Math.sin(t) * helixR;
          p.size = 2.1 + (depth + 1) * 0.95;
          p.opacity = 0.4 + (depth + 1) * 0.3;
        },
      });
    });
  }, { from: HELIX_FROM, until: HELIX_UNTIL });

  // 碱基横杠 + 中轴微光：静态波形阶梯，跟随螺旋生长前沿逐级显现
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < HELIX_FROM + 180 || tMs > VERIFY_AT + 240) return;
    const fadeIn = Math.min(1, (tMs - HELIX_FROM - 180) / 300);
    const fadeOut = tMs > VERIFY_AT ? Math.max(0, 1 - (tMs - VERIFY_AT) / 240) : 1;
    const fade = fadeIn * fadeOut;
    const frontY = Math.max(0, H - ((tMs - HELIX_FROM) / 1000) * rise);
    for (let y = H - 8; y > Math.max(20, frontY); y -= 34) {
      const t = (H - y) / waveLen;
      const s = Math.sin(t);
      const a = Math.min(1, Math.abs(s) * 1.2) * 0.32 * fade;
      if (a < 0.02) continue;
      const x1 = cx + s * helixR;
      const x2 = cx - s * helixR;
      const g = ctx.createLinearGradient(x1, 0, x2, 0);
      g.addColorStop(0, `rgba(74, 222, 128, ${a})`);
      g.addColorStop(0.5, `rgba(236, 253, 245, ${a * 0.9})`);
      g.addColorStop(1, `rgba(163, 230, 53, ${a})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(220, 252, 231, ${0.06 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, Math.max(20, frontY));
    ctx.lineTo(cx, H);
    ctx.stroke();
  });

  // 随机碱基高亮：白热闪点成对亮起，碱基字母对向两侧弹出
  [1950, 2400, 2850, 3300].forEach((tm) => {
    api.at(tm, () => {
      const y = api.range(H * 0.3, H * 0.75);
      const t = (H - y) / waveLen;
      const x1 = cx + Math.sin(t) * helixR;
      const x2 = cx - Math.sin(t) * helixR;
      const pair = api.pick(BASE_PAIRS);
      api.spawn({ x: x1, y, shape: 'dot', size: 6, endSize: 2, maxLife: 0.4, color: '#f0fdf4', glow: 1.8, fadeOut: 0.6 });
      api.spawn({ x: x2, y, shape: 'dot', size: 6, endSize: 2, maxLife: 0.4, color: '#f0fdf4', glow: 1.8, fadeOut: 0.6 });
      api.spawn({ x: x1 + 14, y: y - 6, vy: -26, shape: 'glyph', glyph: pair[0], size: 13, maxLife: 0.9, color: '#bbf7d0', fadeIn: 0.1, fadeOut: 0.4 });
      api.spawn({ x: x2 - 14, y: y - 6, vy: -26, shape: 'glyph', glyph: pair[1], size: 13, maxLife: 0.9, color: '#d9f99d', fadeIn: 0.1, fadeOut: 0.4 });
      api.spawn({ x: (x1 + x2) / 2, y, shape: 'ring', size: 4, endSize: 40, maxLife: 0.5, color: '#86efac', opacity: 0.6, fadeOut: 0.6 });
    });
  });

  // 右缘测序读数流：碱基字符低亮上行（远景次级系统）
  api.every(160, () => {
    api.spawn({
      x: W * 0.93 + api.range(-8, 8), y: H * 0.85, vy: -api.range(50, 90),
      shape: 'glyph', glyph: api.pick(['A', 'T', 'C', 'G']), size: 11,
      maxLife: api.range(1, 1.6), color: '#bef264', opacity: 0.5, twinkle: 1.5, fadeIn: 0.12, fadeOut: 0.3,
    });
  }, { from: 1550, until: 3550 });

  // 幕三：双链收束 —— 粒子被拉向中轴成光柱
  api.every(24, () => {
    const y = api.range(H * 0.12, H * 0.92);
    const side = api.rng() > 0.5 ? 1 : -1;
    api.spawn({
      x: cx + side * helixR * api.range(0.7, 1.1), y,
      vx: -side * api.range(260, 420),
      shape: 'streak', stretch: 0.08, size: 1.8, maxLife: 0.4,
      color: side > 0 ? '#4ade80' : '#a3e635', glow: 1, fadeOut: 0.4,
    });
  }, { from: VERIFY_AT, until: VERIFY_AT + 320 });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < VERIFY_AT + 150 || tMs > VERIFY_AT + 1150) return;
    const life = (tMs - VERIFY_AT - 150) / 1000;
    const alpha = Math.sin(Math.min(1, life) * Math.PI) * 0.85;
    const grad = ctx.createLinearGradient(cx - 30, 0, cx + 30, 0);
    grad.addColorStop(0, 'rgba(74, 222, 128, 0)');
    grad.addColorStop(0.5, `rgba(240, 253, 244, ${alpha})`);
    grad.addColorStop(1, 'rgba(74, 222, 128, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 30, 0, 60, H);
  });

  // 确认爆发：白热闪心 + 双环 + 火花，650ms 后回波环
  api.at(VERIFY_AT + 320, () => {
    const cy = H / 2;
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 120, maxLife: 0.5, color: '#f0fdf4', glow: 2, fadeOut: 0.85 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 300, maxLife: 0.9, color: '#4ade80', opacity: 0.85, fadeOut: 0.7 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 12, endSize: 190, maxLife: 0.8, color: '#d9f99d', opacity: 0.7, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 52, speed: [90, 300],
      base: { shape: 'spark', size: 2, maxLife: 1, color: '#86efac', glow: 1.1, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() < 0.3) p.color = '#d9f99d';
        if (rng() < 0.14) p.color = '#f0fdf4';
      },
    });
  });
  api.at(VERIFY_AT + 650, () => {
    api.spawn({ x: cx, y: H / 2, shape: 'ring', size: 60, endSize: 380, maxLife: 0.9, color: '#4ade80', opacity: 0.38, fadeOut: 0.8 });
  });

  // 余韵：确认星尘自光柱缓缓升腾
  api.every(60, () => {
    api.spawn({
      x: cx + api.range(-60, 60), y: H / 2 + api.range(-40, 60),
      vy: -api.range(30, 80), shape: 'dot', size: api.range(1, 2),
      maxLife: api.range(0.7, 1.2), color: api.pick(['#86efac', '#d9f99d', '#f0fdf4']),
      glow: 1, wander: 20, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: VERIFY_AT + 400, until: 5000 });
};
</script>

<template>
  <div class="bio-scan-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.bioScan" :scene="scene" />
    <div class="bio-verdict">
      <small class="bio-code">HELIX VERIFY // BIO-AUTH 11</small>
      <Dna :size="24" />
      <strong>IDENTITY VERIFIED</strong>
      <small class="bio-sub">生体校验 · 基因序列匹配 99.98%</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bio-scan-effect {
  @include effect-stage(hidden);
}

.bio-verdict {
  position: absolute;
  left: 50%;
  bottom: 13%;
  border: 1px solid rgba(74, 222, 128, 0.44);
  border-radius: 10px;
  background: rgba(2, 44, 34, 0.5);
  color: #d1fae5;
  display: grid;
  gap: 6px;
  place-items: center;
  padding: 12px 26px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: bio-verdict 5.4s ease both;
}

.bio-verdict svg {
  color: #4ade80;
  filter: drop-shadow(0 0 14px rgba(74, 222, 128, 0.6));
}

.bio-verdict strong {
  font-size: 14px;
  letter-spacing: 0.18em;
}

.bio-code {
  color: rgba(190, 242, 100, 0.62);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.26em;
}

.bio-sub {
  color: rgba(167, 243, 208, 0.74);
  font-size: 11px;
  letter-spacing: 0.1em;
}

@keyframes bio-verdict {
  0%, 74% { opacity: 0; transform: translateX(-50%) translateY(14px) scale(0.92); }
  80%, 94% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  100% { opacity: 0.85; transform: translateX(-50%) translateY(-4px); }
}
</style>
