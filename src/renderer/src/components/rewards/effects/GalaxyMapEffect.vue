<script setup lang="ts">
import { Telescope } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * ASTRO CHART · 全息星图（5600ms = 700 entry + 4050 loop + 850 exit）
 * 三幕：星点按深度分层自底部升起（近大远小视差）→ 星图绕心缓旋（深度差速 = 视差），
 * 极坐标测绘网显影，seed 星座连线逐段生长（生长头白热光点）并标注代号 →
 * 目标星锁定：收缩角括号 + 三重锁定环 + RA/DEC 坐标 + TARGET LOCKED，星图上收淡出。
 * 配色：白热锁定核心 + 浅蓝主辉光（#93c5fd 族）+ 靛紫辅点缀（#818cf8 族）。
 */
const SETTLE_AT = 1500; // 星图落定后开始缓旋
const LINK_FROM = 1750;
const LOCK_AT = 4050;

const scene: SceneFn = (api) => {
  const cx = api.width / 2;
  const cy = api.height / 2;
  const squash = 0.95;

  // 统一旋转场：深度越近旋得越快（差速 = 视差）
  const rotOf = (tMs: number, depth: number) =>
    (Math.max(0, tMs - SETTLE_AT) / 1000) * (0.022 + depth * 0.055);
  const posOf = (bx: number, by: number, tMs: number, depth: number) => {
    const rot = rotOf(tMs, depth);
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    return { x: cx + bx * ca - by * sa, y: cy + (bx * sa + by * ca) * squash };
  };

  // 幕一：分层星野 —— 底部升起，深度决定尺寸/亮度/上升速度
  for (let i = 0; i < 118; i += 1) {
    const depth = api.rng();
    const bx = (api.rng() - 0.5) * api.width * 0.96;
    const by = (api.rng() - 0.5) * api.height * 0.82;
    const riseDelay = api.range(0, 0.35);
    const riseDur = 1.35 - depth * 0.55; // 近层升得快，远层慢慢跟上
    api.spawn({
      x: cx + bx, y: cy + by + 200, shape: 'dot',
      size: 0.8 + depth * 2, maxLife: 5.45,
      color: depth > 0.72 ? '#c7d2fe' : depth > 0.4 ? '#a5b4fc' : '#94a3b8',
      glow: 0.6 + depth * 0.7, opacity: 0.3 + depth * 0.55,
      twinkle: api.range(0.4, 1.7), fadeIn: 0.05, fadeOut: 0.13,
      update: (p) => {
        const rise = Math.max(0, Math.min(1, (p.life - riseDelay) / riseDur));
        const ease = 1 - (1 - rise) ** 3;
        const mapped = posOf(bx, by, p.life * 1000, depth);
        const lift = Math.max(0, p.life - 4.82); // 幕尾：星图上收
        p.x = mapped.x;
        p.y = mapped.y + (1 - ease) * (170 + depth * 150) - lift * lift * 320;
      },
    });
  }

  // seed 生成 2-3 组星座（顶点 + 连线 + 代号），随星图同场旋转
  type Constellation = { pts: Array<{ bx: number; by: number }>; code: string; depth: number };
  const constellations: Constellation[] = [];
  const groups = 2 + Math.floor(api.rng() * 2);
  for (let g = 0; g < groups; g += 1) {
    const baseX = (0.2 + api.rng() * 0.6 - 0.5) * api.width;
    const baseY = (0.18 + api.rng() * 0.44 - 0.5) * api.height;
    const n = 4 + Math.floor(api.rng() * 3);
    const pts = Array.from({ length: n }, () => ({
      bx: baseX + api.range(-130, 130),
      by: baseY + api.range(-95, 95),
    }));
    constellations.push({ pts, code: `NGC-${1000 + Math.floor(api.rng() * 9000)}`, depth: 0.55 });
  }

  // 星座顶点：更亮的星 + 呼吸光晕，1s 后逐组通电
  constellations.forEach((c, gi) => {
    const spawnT = 950 + gi * 180;
    api.at(spawnT, () => {
      c.pts.forEach((pt, pi) => {
        api.spawn({
          x: cx + pt.bx, y: cy + pt.by, shape: 'spark', size: 2.7, maxLife: (5450 - spawnT) / 1000,
          color: '#a5b4fc', glow: 1.35, twinkle: 1.1, fadeIn: 0.06 + pi * 0.015, fadeOut: 0.14,
          update: (p) => {
            const mapped = posOf(pt.bx, pt.by, spawnT + p.life * 1000, c.depth);
            p.x = mapped.x;
            p.y = mapped.y;
          },
        });
      });
    });
  });

  // 幕二：极坐标测绘网 + 星座连线逐段生长（onFrame 自定义绘制）
  const lockTargetIdx = {
    g: Math.floor(api.rng() * constellations.length),
    p: 0,
  };
  lockTargetIdx.p = Math.floor(api.rng() * constellations[lockTargetIdx.g].pts.length);

  api.onFrame((tMs, _dt, ctx) => {
    const fadeAll = Math.max(0, Math.min(1, (api.duration - 620 - tMs) / 520));
    if (fadeAll <= 0.02) return;

    // 测绘网：三圈同心椭圆 + 八向方位线，随星图缓旋
    const gridIn = Math.max(0, Math.min(1, (tMs - 650) / 600));
    if (gridIn > 0.02) {
      const gridRot = rotOf(tMs, 0.5);
      const maxR = Math.min(api.width, api.height) * 0.46;
      ctx.strokeStyle = `rgba(129, 140, 248, ${0.11 * gridIn * fadeAll})`;
      ctx.lineWidth = 1;
      [0.36, 0.64, 0.92].forEach((f) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, maxR * f, maxR * f * squash, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.strokeStyle = `rgba(129, 140, 248, ${0.07 * gridIn * fadeAll})`;
      for (let s = 0; s < 8; s += 1) {
        const a = (s / 8) * Math.PI * 2 + gridRot;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * maxR * 0.16, cy + Math.sin(a) * maxR * 0.16 * squash);
        ctx.lineTo(cx + Math.cos(a) * maxR * 0.92, cy + Math.sin(a) * maxR * 0.92 * squash);
        ctx.stroke();
      }
    }

    // 星座连线：逐段生长，生长头带白热光点
    if (tMs >= LINK_FROM) {
      ctx.lineWidth = 1.2;
      constellations.forEach((c, gi) => {
        const totalSegs = c.pts.length - 1;
        const progress = Math.min(totalSegs, (tMs - LINK_FROM - gi * 300) / 400);
        if (progress <= 0) return;
        const mapped = c.pts.map((pt) => posOf(pt.bx, pt.by, tMs, c.depth));
        ctx.strokeStyle = `rgba(165, 180, 252, ${0.55 * fadeAll})`;
        ctx.beginPath();
        ctx.moveTo(mapped[0].x, mapped[0].y);
        const full = Math.floor(progress);
        for (let s = 1; s <= full && s <= totalSegs; s += 1) ctx.lineTo(mapped[s].x, mapped[s].y);
        let head = mapped[Math.min(full, totalSegs)];
        if (full < totalSegs) {
          const frac = progress - full;
          const a = mapped[full];
          const b = mapped[full + 1];
          head = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
          ctx.lineTo(head.x, head.y);
        }
        ctx.stroke();
        if (progress < totalSegs) {
          ctx.fillStyle = `rgba(240, 244, 255, ${0.9 * fadeAll})`;
          ctx.beginPath();
          ctx.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 幕三：锁定角括号 —— 白热收缩框，脉冲呼吸
    if (tMs >= LOCK_AT) {
      const c = constellations[lockTargetIdx.g];
      const pt = c.pts[lockTargetIdx.p];
      const pos = posOf(pt.bx, pt.by, tMs, c.depth);
      const age = tMs - LOCK_AT;
      const gap = 15 + 26 * Math.exp(-age / 260);
      const arm = 7;
      const pulse = 0.72 + 0.28 * Math.sin(age / 130);
      ctx.strokeStyle = `rgba(224, 231, 255, ${0.92 * pulse * fadeAll})`;
      ctx.lineWidth = 1.6;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(pos.x + sx * gap, pos.y + sy * gap - sy * arm);
        ctx.lineTo(pos.x + sx * gap, pos.y + sy * gap);
        ctx.lineTo(pos.x + sx * gap - sx * arm, pos.y + sy * gap);
        ctx.stroke();
      });
    }
  });

  // 星座代号：等宽字符标注，跟随旋转
  constellations.forEach((c, gi) => {
    const spawnT = LINK_FROM + 450 + gi * 320;
    api.at(spawnT, () => {
      const first = c.pts[0];
      api.spawn({
        x: cx + first.bx + 16, y: cy + first.by - 18, shape: 'glyph', glyph: c.code,
        size: 11, maxLife: 2.9, color: 'rgba(199, 210, 254, 0.85)',
        font: '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.12, fadeOut: 0.24,
        update: (p) => {
          const mapped = posOf(first.bx, first.by, spawnT + p.life * 1000, c.depth);
          p.x = mapped.x + 16;
          p.y = mapped.y - 18;
        },
      });
    });
  });

  // 幕三：目标锁定 —— 脉冲白闪 + 三重锁定环 + 坐标 + 确认微文案（全部跟随旋转）
  api.at(LOCK_AT, () => {
    const c = constellations[lockTargetIdx.g];
    const pt = c.pts[lockTargetIdx.p];
    const follow = (offsetY: number, spawnT: number) => (p: any) => {
      const mapped = posOf(pt.bx, pt.by, spawnT + p.life * 1000, c.depth);
      p.x = mapped.x;
      p.y = mapped.y + offsetY;
    };
    api.spawn({
      x: 0, y: 0, shape: 'dot', size: 4, endSize: 30, maxLife: 0.7,
      color: '#eef2ff', glow: 2, fadeOut: 0.7, update: follow(0, LOCK_AT),
    });
    [0, 150, 320].forEach((delay, i) => {
      api.at(LOCK_AT + delay, () => {
        api.spawn({
          x: 0, y: 0, shape: 'ring', size: 10, endSize: 58 + i * 32,
          maxLife: 0.85, color: i === 1 ? '#e0e7ff' : '#818cf8', opacity: 0.9 - i * 0.14,
          fadeOut: 0.6, update: follow(0, LOCK_AT + delay),
        });
      });
    });
    const ra = `RA ${Math.floor(api.rng() * 24)}h ${Math.floor(api.rng() * 60)}m`;
    const dec = `DEC ${api.rng() > 0.5 ? '+' : '-'}${Math.floor(api.rng() * 80)}°`;
    api.at(LOCK_AT + 240, () => {
      api.spawn({
        x: 0, y: 0, shape: 'glyph', glyph: `${ra} · ${dec}`, size: 12, maxLife: 1.15,
        color: '#c7d2fe', font: '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.14, fadeOut: 0.3, update: follow(44, LOCK_AT + 240),
      });
    });
    api.at(LOCK_AT + 460, () => {
      api.spawn({
        x: 0, y: 0, shape: 'glyph', glyph: 'TARGET LOCKED', size: 10, maxLife: 0.9,
        color: 'rgba(224, 231, 255, 0.95)',
        font: '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.12, fadeOut: 0.35, update: follow(62, LOCK_AT + 460),
      });
    });
  });

  // 锁定余韵：目标附近的靛蓝星尘微涌
  api.every(80, () => {
    const c = constellations[lockTargetIdx.g];
    const pt = c.pts[lockTargetIdx.p];
    const mapped = posOf(pt.bx, pt.by, LOCK_AT + 300, c.depth);
    const a = api.range(0, Math.PI * 2);
    const r = api.range(10, 44);
    api.spawn({
      x: mapped.x + Math.cos(a) * r, y: mapped.y + Math.sin(a) * r,
      vx: api.range(-12, 12), vy: api.range(-20, -4),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.5, 0.9),
      color: api.rng() > 0.5 ? '#c7d2fe' : '#818cf8', glow: 1, twinkle: 6, fadeOut: 0.5,
    });
  }, { from: LOCK_AT + 200, until: api.duration - 700 });
};
</script>

<template>
  <div class="galaxy-map-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.galaxyMap" :scene="scene" />
    <div class="gmap-frame">
      <Telescope :size="22" />
      <small>ASTRO CHART · DEEP SKY SURVEY</small>
      <strong>全息星图 · 已标定目标星</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.galaxy-map-effect {
  @include effect-stage(hidden);
  animation: gmap-camera 5.6s ease both;
}

.gmap-frame {
  position: absolute;
  left: 7%;
  bottom: 10%;
  border-left: 2px solid rgba(129, 140, 248, 0.6);
  color: #c7d2fe;
  display: grid;
  gap: 5px;
  padding-left: 14px;
  animation: gmap-frame 5.6s ease both;
}

.gmap-frame small {
  color: rgba(165, 180, 252, 0.75);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.26em;
}

.gmap-frame strong {
  font-size: 13px;
  letter-spacing: 0.16em;
}

@keyframes gmap-frame {
  0%, 16% { opacity: 0; transform: translateY(12px); }
  26%, 86% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; }
}

@keyframes gmap-camera {
  0% { opacity: 0; transform: scale(1.06) translateY(12px); }
  10% { opacity: 1; }
  40% { transform: scale(1) translateY(0); }
  74% { transform: scale(1.015) translateY(-2px); }
  92% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.04) translateY(-16px); }
}
</style>
