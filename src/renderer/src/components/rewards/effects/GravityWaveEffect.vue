<script setup lang="ts">
import { Waves } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * SPACETIME MERGER · 引力波合并（6200ms = 800 entry + 4400 loop + 1000 exit）
 * 三幕：双中子星白热双核互绕（轨道逐圈衰减、转速递增、切向拖尾成双螺旋），
 * 底部 LIGO 应变波形同步「啁啾」→ 2.6s 合并白闪 + 千新星金红抛射（远景暗红回波）→
 * 极坐标时空网格显影，三道径向波依次扭曲网格线，余晖残骸缓旋、星点相位抖动平息。
 * 配色：白热双核 + 浅蓝主辉光（#93c5fd 族）+ 靛紫辅点缀（#818cf8 族）+ 千新星金红瞬色。
 */
const MERGE_AT = 2600;

const scene: SceneFn = (api) => {
  api.setTrail(0.17);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const phase0 = api.range(0, Math.PI * 2);
  let nowMs = 0;

  // 共享轨道方程：半径衰减 + 相位加速（啁啾）
  const orbitState = (tMs: number) => {
    const progress = Math.min(1, tMs / MERGE_AT);
    const radius = 150 * (1 - 0.94 * Math.pow(progress, 1.25));
    const angle = phase0 + (tMs / 1000) * 2.2 + Math.pow(progress, 2.6) * 30;
    return { radius, angle, progress };
  };
  const starPos = (tMs: number, offset: number) => {
    const { radius, angle } = orbitState(tMs);
    return {
      x: cx + Math.cos(angle + offset) * radius,
      y: cy + Math.sin(angle + offset) * radius * 0.86,
    };
  };

  // 星野：分层微星，被引力场拖拽微缩，合并后相位抖动、随余韵平息
  for (let i = 0; i < 58; i += 1) {
    const bx = api.rng() * api.width;
    const by = api.rng() * api.height;
    const jw = api.range(5, 11);
    const jp = api.range(0, Math.PI * 2);
    const depth = api.rng();
    api.spawn({
      x: bx, y: by, shape: 'dot', size: 0.7 + depth * 1.2, maxLife: 6.15,
      color: depth > 0.72 ? '#bfdbfe' : '#e2e8f0', glow: 0.7 + depth * 0.4,
      opacity: 0.28 + depth * 0.5, twinkle: api.range(0.5, 1.6), fadeOut: 0.1,
      update: (p) => {
        // 合并前：向心微拖拽；合并后：相位抖动指数衰减（时空回稳）
        const pull = Math.min(1, nowMs / MERGE_AT) ** 2 * 9 * (1 - depth * 0.5);
        const dx = cx - bx;
        const dy = cy - by;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const jitter = nowMs > MERGE_AT ? 3.4 * Math.exp(-(nowMs - MERGE_AT) / 1500) : 0;
        p.x = bx + (dx / dist) * pull + Math.sin((nowMs / 1000) * jw + jp) * jitter;
        p.y = by + (dy / dist) * pull + Math.cos((nowMs / 1000) * jw * 0.8 + jp) * jitter;
      },
    });
  }

  // 幕一：白热双核 —— 蓝/紫色晕 + 白芯，沿共享轨道互绕
  [0, Math.PI].forEach((offset, star) => {
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 7.5, maxLife: MERGE_AT / 1000,
      color: star === 0 ? '#93c5fd' : '#c4b5fd', glow: 1.9, fadeIn: 0.07, fadeOut: 0.03,
      update: (p) => {
        const pos = starPos(nowMs, offset);
        p.x = pos.x;
        p.y = pos.y;
        p.size = 7.5 - orbitState(nowMs).progress * 2.4;
        p.endSize = p.size;
      },
    });
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 2.8, maxLife: MERGE_AT / 1000,
      color: '#f8fafc', glow: 1, fadeIn: 0.07, fadeOut: 0.03,
      update: (p) => {
        const pos = starPos(nowMs, offset);
        p.x = pos.x;
        p.y = pos.y;
      },
    });
  });

  // 切向拖尾：数值求速，拖出真实弧线的双螺旋光带
  api.every(20, (index) => {
    const t = index * 20;
    if (t >= MERGE_AT - 30) return;
    [0, Math.PI].forEach((offset, star) => {
      const p1 = starPos(t, offset);
      const p0 = starPos(Math.max(0, t - 24), offset);
      api.spawn({
        x: p1.x, y: p1.y,
        vx: ((p1.x - p0.x) / 0.024) * 0.22, vy: ((p1.y - p0.y) / 0.024) * 0.22,
        shape: 'streak', stretch: 0.09, drag: 0.12,
        size: 2.5 - orbitState(t).progress * 0.9, maxLife: 0.55,
        color: star === 0 ? '#bfdbfe' : '#c4b5fd', glow: 1.1, opacity: 0.85,
        fadeIn: 0.04, fadeOut: 0.5,
      });
    });
  }, { until: MERGE_AT - 20 });

  // LIGO 应变波形带：顶部等宽「啁啾」曲线 —— 频率与振幅随互绕收紧而攀升，合并后振铃衰减
  api.onFrame((tMs, _dt, ctx) => {
    nowMs = tMs;
    const fadeIn = Math.max(0, Math.min(1, (tMs - 650) / 500));
    const fadeOut = Math.max(0, Math.min(1, (api.duration - 420 - tMs) / 500));
    const env = fadeIn * fadeOut;
    if (env <= 0.02) return;
    const y0 = api.height * 0.13;
    const span = api.width * 0.56;
    const x0 = cx - span / 2;
    const windowS = 1.25;
    ctx.strokeStyle = `rgba(147, 197, 253, ${0.4 * env})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let s = 0; s <= 72; s += 1) {
      const tau = tMs / 1000 - windowS + (s / 72) * windowS;
      let h = 0;
      if (tau > 0 && tau * 1000 <= MERGE_AT) {
        const pr = (tau * 1000) / MERGE_AT;
        h = (3 + 15 * pr ** 3) * Math.sin(Math.PI * 2 * (1.6 * tau + 7 * pr ** 3.4 * 2.6));
      } else if (tau * 1000 > MERGE_AT) {
        const rd = tau - MERGE_AT / 1000;
        h = 18 * Math.exp(-rd * 5.2) * Math.sin(Math.PI * 2 * 15 * rd);
      }
      const px = x0 + (s / 72) * span;
      if (s === 0) ctx.moveTo(px, y0 + h);
      else ctx.lineTo(px, y0 + h);
    }
    ctx.stroke();
    // 波形游标白点
    ctx.fillStyle = `rgba(248, 250, 252, ${0.85 * env})`;
    ctx.beginPath();
    ctx.arc(x0 + span, y0, 2, 0, Math.PI * 2);
    ctx.fill();

    // 幕三：极坐标时空网格 —— 三道径向波依次扭曲网格线，波幅逐道递减
    if (tMs < MERGE_AT + 120) return;
    const gridFade = Math.min(1, (tMs - MERGE_AT - 120) / 420) * Math.max(0, Math.min(1, (api.duration - 520 - tMs) / 700));
    if (gridFade <= 0.02) return;
    const maxR = Math.max(api.width, api.height) * 0.72;
    const wavefronts = [
      { at: MERGE_AT + 120, amp: 14 },
      { at: MERGE_AT + 820, amp: 8.5 },
      { at: MERGE_AT + 1520, amp: 4.5 },
    ];
    const distort = (r: number) => {
      let d = 0;
      for (const wv of wavefronts) {
        if (tMs < wv.at) continue;
        const wt = (tMs - wv.at) / 1000;
        d += wv.amp * Math.exp(-Math.abs(r - wt * 470) / 125) * Math.sin(r / 25 - wt * 10);
      }
      return d;
    };
    ctx.strokeStyle = `rgba(147, 197, 253, ${0.3 * gridFade})`;
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 8; ring += 1) {
      const base = ring * (maxR / 8);
      ctx.beginPath();
      for (let s = 0; s <= 52; s += 1) {
        const a = (s / 52) * Math.PI * 2;
        const r = base + distort(base);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 0.86;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(129, 140, 248, ${0.16 * gridFade})`;
    for (let l = 0; l < 12; l += 1) {
      const a = (l / 12) * Math.PI * 2;
      ctx.beginPath();
      for (let s = 1; s <= 16; s += 1) {
        const base = (s / 16) * maxR;
        const r = base + distort(base);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 0.86;
        if (s === 1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  });

  // 幕二：合并 —— 白闪 + 透镜环 + 千新星金红抛射 + 远景暗红回波
  api.at(MERGE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 380, maxLife: 0.6, color: '#f8fafc', glow: 2.4, fadeOut: 0.92 });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: 300, maxLife: 0.7, color: '#bfdbfe', opacity: 0.9, fadeOut: 0.7 });
    api.burst({
      x: cx, y: cy, count: 120, speed: [120, 540],
      base: { shape: 'spark', size: 2.4, maxLife: 1.5, glow: 1.1, ay: 44, drag: 0.34, fadeOut: 0.45 },
      vary: (p, rng) => {
        const roll = rng();
        p.color = roll < 0.42 ? '#fbbf24' : roll < 0.66 ? '#f87171' : roll < 0.84 ? '#fde68a' : '#fff7ed';
        p.maxLife = 0.85 + rng() * 1.15;
        if (rng() > 0.85) p.twinkle = 4 + rng() * 4;
      },
    });
    // 抛射光矛：合并喷流的骨架方向
    api.burst({
      x: cx, y: cy, count: 20, speed: [380, 620],
      base: { shape: 'streak', stretch: 0.08, size: 2, maxLife: 0.8, color: '#fde68a', glow: 1.2, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() > 0.7) p.color = '#bfdbfe';
        p.maxLife = 0.5 + rng() * 0.5;
      },
    });
  });
  // 远景暗红回波：慢半拍、更暗、更缓的第二层抛射（纵深）
  api.at(MERGE_AT + 170, () => {
    api.burst({
      x: cx, y: cy, count: 42, speed: [60, 240],
      base: { shape: 'spark', size: 1.6, maxLife: 1.6, color: '#b91c1c', glow: 0.8, opacity: 0.55, ay: 30, drag: 0.4, fadeOut: 0.5 },
      vary: (p, rng) => {
        if (rng() > 0.72) p.color = '#f87171';
        p.maxLife = 1 + rng() * 0.9;
      },
    });
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 60, endSize: Math.max(api.width, api.height) * 0.55, maxLife: 1, color: '#818cf8', opacity: 0.4, fadeIn: 0.16, fadeOut: 0.6 });
  });

  // 余晖残骸：合并后中心驻留一颗缓脉动的残星，振铃期两次微闪
  api.at(MERGE_AT + 220, () => {
    api.spawn({
      x: cx, y: cy, shape: 'dot', size: 5, maxLife: (api.duration - MERGE_AT - 900) / 1000,
      color: '#e0e7ff', glow: 1.5, fadeIn: 0.14, fadeOut: 0.35,
      update: (p) => {
        p.size = 5 + Math.sin(p.life * 9) * 1.4;
        p.endSize = p.size;
      },
    });
  });
  [MERGE_AT + 780, MERGE_AT + 1300].forEach((at, i) => {
    api.at(at, () => {
      api.spawn({ x: cx, y: cy, shape: 'ring', size: 8, endSize: 60 - i * 16, maxLife: 0.55, color: '#c7d2fe', opacity: 0.6 - i * 0.2, fadeOut: 0.6 });
    });
  });

  // 涟漪波前微光：网格上随波泛起的浮尘
  api.every(58, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(60, 320);
    api.spawn({
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.86,
      shape: 'dot', size: api.range(0.9, 1.8), maxLife: api.range(0.8, 1.4),
      color: api.rng() > 0.3 ? '#bfdbfe' : '#818cf8', glow: 1, twinkle: 3, wander: 20, fadeOut: 0.5,
    });
  }, { from: MERGE_AT + 320, until: api.duration - 750 });
};
</script>

<template>
  <div class="gravity-wave-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.gravityWave" :scene="scene" />
    <div class="gw-hud">
      <Waves :size="28" />
      <small>SPACETIME MERGER · GW-260726 · SNR 24.1</small>
      <strong>引力波合并 · 啁啾质量 2.7 M☉</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gravity-wave-effect {
  @include effect-stage(hidden);
  animation: gw-camera 6.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.gw-hud {
  position: absolute;
  left: 50%;
  bottom: 12%;
  border: 1px solid rgba(147, 197, 253, 0.34);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.4);
  color: #dbeafe;
  display: grid;
  gap: 5px;
  place-items: center;
  padding: 12px 22px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: gw-hud 6.2s ease both;
}

.gw-hud small {
  color: rgba(165, 180, 252, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
}

.gw-hud strong {
  font-size: 14px;
  letter-spacing: 0.1em;
}

@keyframes gw-hud {
  0%, 50% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  60%, 88% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}

@keyframes gw-camera {
  0% { transform: scale(1.08); }
  30% { transform: scale(1.015); }
  40% { transform: scale(0.985); }
  41.9% { transform: scale(0.955); }
  47% { transform: scale(1.07); }
  56% { transform: scale(1.01); }
  100% { transform: scale(1.06); opacity: 0; }
}
</style>
