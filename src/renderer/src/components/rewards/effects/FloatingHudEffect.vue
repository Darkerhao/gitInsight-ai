<script setup lang="ts">
import { Radar } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * HOLO ARRAY · 悬浮阵列（5200ms = 600 entry + 3800 loop + 800 exit）
 * 三幕：轨道环展开、双脉冲通电 → 深轨道（大椭圆、背面压暗）+ 准星双向环流，
 * 面板间数据光束点对点激射（尾迹碎屑 / 抵达涟漪 / ACK 确认 / 概率回射）→
 * ARRAY SYNC 100% 全阵列逐面板确认脉冲，全息尘退场。
 * 配色：白热光束头 + 青色主辉光（#22d3ee 族）+ 紫色辅点缀（#a78bfa）。
 */
const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const reticleR = Math.min(190, Math.min(api.width, api.height) * 0.34);
  const deepRx = Math.min(api.width * 0.42, 390);

  // 面板锚点（与模板 8 面板定位公式一致，供数据链路点对点激射）
  const panels = Array.from({ length: 8 }, (_, i) => ({
    x: api.width * ((14 + ((i * 23) % 72)) / 100),
    y: api.height * ((14 + ((i * 19) % 66)) / 100),
  }));

  // 幕一：展开双脉冲
  api.at(180, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 18, endSize: reticleR * 1.8, maxLife: 0.9, color: '#67e8f9', opacity: 0.7, fadeOut: 0.7 });
  });
  api.at(400, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 12, endSize: reticleR * 1.2, maxLife: 0.7, color: '#a78bfa', opacity: 0.45, fadeOut: 0.7 });
  });

  // 全息尘：双层纵深 —— 远层小而暗慢升，近层大而亮快升
  api.every(70, () => {
    api.spawn({
      x: api.range(0, api.width), y: api.height + 6,
      vy: -api.range(26, 60), vx: api.range(-8, 8),
      shape: 'dot', size: api.range(0.7, 1.3), maxLife: api.range(2.4, 3.6),
      color: '#67e8f9', glow: 0.7, opacity: api.range(0.2, 0.42),
      twinkle: api.range(2, 4), wander: 12, fadeOut: 0.3,
    });
  }, { until: api.duration - 1000 });
  api.every(105, () => {
    api.spawn({
      x: api.range(0, api.width), y: api.height + 8,
      vy: -api.range(90, 150), vx: api.range(-16, 16),
      shape: 'dot', size: api.range(1.7, 2.6), maxLife: api.range(1.6, 2.6),
      color: api.rng() < 0.72 ? '#a5f3fc' : '#c4b5fd', glow: 1.1,
      twinkle: api.range(3, 7), wander: 26, fadeOut: 0.3,
    });
  }, { from: 250, until: api.duration - 1100 });

  // 深轨道：大椭圆环流（对应 DOM 倾斜轨道环），背面粒子压暗缩小成遮挡纵深
  api.every(52, () => {
    let angle = api.range(0, Math.PI * 2);
    const dir = api.rng() < 0.7 ? 1 : -1;
    api.spawn({
      x: cx + Math.cos(angle) * deepRx, y: cy + Math.sin(angle) * deepRx * 0.32,
      shape: 'streak', stretch: 0.05, size: 2.2, maxLife: api.range(1.2, 2),
      color: '#22d3ee', glow: 1, fadeIn: 0.14, fadeOut: 0.2,
      update: (p, dt) => {
        angle += 1.1 * dir * dt;
        const depth = 0.5 + 0.5 * Math.sin(angle); // 前半亮大、后半暗小
        const nx = cx + Math.cos(angle) * deepRx;
        const ny = cy + Math.sin(angle) * deepRx * 0.32;
        p.vx = (nx - p.x) / Math.max(dt, 0.001);
        p.vy = (ny - p.y) / Math.max(dt, 0.001);
        p.x = nx;
        p.y = ny;
        p.opacity = 0.2 + depth * 0.8;
        p.size = 1.1 + depth * 1.6;
        p.endSize = p.size;
      },
    });
  }, { from: 300, until: api.duration - 900 });

  // 准星双向环流：内外双车道，青紫对旋
  api.every(38, () => {
    let angle = api.range(0, Math.PI * 2);
    const dir = api.rng() < 0.5 ? 1 : -1;
    const radius = reticleR * (dir > 0 ? api.range(0.93, 1) : api.range(1.05, 1.12));
    api.spawn({
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.92,
      shape: 'spark', size: api.range(1.5, 2.5), maxLife: api.range(0.9, 1.5),
      color: dir > 0 ? '#22d3ee' : '#a78bfa', glow: 1.1, fadeIn: 0.12, fadeOut: 0.24,
      update: (p, dt) => {
        angle += 1.9 * dir * dt;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius * 0.92;
      },
    });
  }, { from: 350, until: api.duration - 850 });

  // 幕二：面板间数据链路 —— 光束头白热、尾迹碎屑、抵达涟漪 + ACK + 概率回射
  const fireLink = (fi: number, ti: number, isReply: boolean) => {
    const from = panels[fi];
    const to = panels[ti];
    const travel = 0.34;
    api.spawn({
      x: from.x, y: from.y, shape: 'spark', size: 2.8, maxLife: travel,
      color: '#f0fdff', glow: 1.5, fadeIn: 0.08, fadeOut: 0.1,
      update: (p, dt, sceneApi) => {
        const progress = Math.min(1, p.life / travel);
        const ease = progress * progress * (3 - 2 * progress); // smoothstep 光束缓动
        p.x = from.x + (to.x - from.x) * ease;
        p.y = from.y + (to.y - from.y) * ease;
        // 尾迹碎屑
        if (sceneApi.rng() < dt * 30) {
          sceneApi.spawn({
            x: p.x, y: p.y, vx: sceneApi.range(-14, 14), vy: sceneApi.range(-14, 14),
            shape: 'dot', size: 1.1, maxLife: 0.32, color: isReply ? '#c4b5fd' : '#7dd3fc',
            glow: 0.8, opacity: 0.75, fadeOut: 0.6,
          });
        }
      },
      onDeath: (p, sceneApi) => {
        sceneApi.spawn({ x: p.x, y: p.y, shape: 'ring', size: 4, endSize: 42, maxLife: 0.4, color: isReply ? '#a78bfa' : '#7dd3fc', opacity: 0.8, fadeOut: 0.6 });
        sceneApi.spawn({ x: p.x, y: p.y, shape: 'dot', size: 5, endSize: 1, maxLife: 0.22, color: '#f0fdff', glow: 1.4, fadeOut: 0.7 });
        if (!isReply && sceneApi.rng() < 0.45) {
          // 应答回射：慢半拍的紫色返程光束
          fireLink(ti, fi, true);
        } else if (sceneApi.rng() < 0.4) {
          sceneApi.spawn({
            x: p.x, y: p.y - 18, shape: 'glyph', glyph: 'ACK', size: 9, maxLife: 0.6,
            color: 'rgba(165, 243, 252, 0.9)',
            font: '600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fadeIn: 0.12, fadeOut: 0.4,
          });
        }
      },
    });
  };
  api.every(360, () => {
    const fi = Math.floor(api.rng() * panels.length);
    let ti = Math.floor(api.rng() * panels.length);
    if (ti === fi) ti = (ti + 3) % panels.length;
    fireLink(fi, ti, false);
  }, { from: 850, until: api.duration - 1400 });

  // 幕三：ARRAY SYNC —— 逐面板确认闪 + 中央同步脉冲 + 微文案
  panels.forEach((panel, i) => {
    api.at(4180 + i * 52, () => {
      api.spawn({ x: panel.x, y: panel.y, shape: 'dot', size: 6, endSize: 1, maxLife: 0.3, color: '#f0fdff', glow: 1.6, fadeOut: 0.7 });
      api.spawn({ x: panel.x, y: panel.y, shape: 'ring', size: 6, endSize: 34, maxLife: 0.42, color: '#67e8f9', opacity: 0.7, fadeOut: 0.6 });
    });
  });
  api.at(4380, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 20, endSize: reticleR * 2, maxLife: 0.85, color: '#67e8f9', opacity: 0.65, fadeOut: 0.7 });
    api.spawn({
      x: cx, y: cy - reticleR - 36, shape: 'glyph', glyph: 'ARRAY SYNC 100%',
      size: 12, maxLife: 0.9, color: 'rgba(224, 242, 254, 0.95)',
      font: '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fadeIn: 0.12, fadeOut: 0.35,
    });
  });
};
</script>

<template>
  <div class="floating-hud-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.floatingHud" :scene="scene" />
    <div class="hud-reticle">
      <span v-for="tick in 16" :key="tick" :style="{ '--tick-angle': `${(tick - 1) * 22.5}deg` }" />
    </div>
    <span
      v-for="panel in 8"
      :key="panel"
      class="hud-panel"
      :style="{
        left: `${14 + (((panel - 1) * 23) % 72)}%`,
        top: `${14 + (((panel - 1) * 19) % 66)}%`,
        '--panel-depth': `${panel % 2 ? 26 : -22}px`,
        animationDelay: `${(panel - 1) * 95}ms`,
      }"
    />
    <div class="hud-cabin">
      <Radar :size="50" />
      <small>HOLO ARRAY · LINK ACTIVE</small>
      <strong>悬浮阵列</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.floating-hud-effect {
  @include effect-stage(hidden);
  perspective: 900px;
}

.floating-hud-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(820px, 92vw);
  height: min(520px, 78vh);
  border: 1px solid rgba(34, 211, 238, 0.28);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateX(62deg);
  opacity: 0;
  animation: hud-orbit 5.2s ease both;
}

.hud-reticle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(360px, 58vw);
  aspect-ratio: 1;
  border: 1px solid rgba(34, 211, 238, 0.44);
  border-radius: 50%;
  box-shadow:
    inset 0 0 30px rgba(34, 211, 238, 0.12),
    0 0 48px rgba(34, 211, 238, 0.16);
  transform: translate(-50%, -50%) rotateX(18deg);
  animation: hud-reticle 5.2s ease both;
}

.hud-reticle span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 24px;
  border-radius: 999px;
  background: rgba(125, 249, 255, 0.74);
  transform: rotate(var(--tick-angle)) translateY(-172px);
  transform-origin: center 172px;
}

.hud-panel {
  position: absolute;
  width: 132px;
  height: 72px;
  border: 1px solid rgba(125, 249, 255, 0.46);
  border-radius: 9px;
  background:
    linear-gradient(135deg, rgba(34, 211, 238, 0.18), transparent 54%),
    rgba(2, 6, 23, 0.32);
  box-shadow: 0 0 32px rgba(34, 211, 238, 0.16);
  opacity: 0;
  transform: translate(-50%, -50%) translateZ(var(--panel-depth)) rotateY(-10deg);
  animation: hud-panel 4.8s ease both;
}

.hud-panel::before,
.hud-panel::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(125, 249, 255, 0.78), rgba(167, 139, 250, 0.45));
}

.hud-panel::before {
  top: 18px;
}

.hud-panel::after {
  top: 34px;
  width: 46%;
}

.hud-cabin {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 7px;
  place-items: center;
  color: #e0f2fe;
  transform: translate(-50%, -50%) translateZ(56px);
  animation: hud-cabin 5.2s ease both;
}

.hud-cabin small {
  color: rgba(165, 243, 252, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.28em;
}

.hud-cabin strong {
  font-size: 16px;
  letter-spacing: 0.18em;
}

@keyframes hud-orbit {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotateX(62deg) scale(0.82); }
  18%, 80% { opacity: 1; transform: translate(-50%, -50%) rotateX(62deg) scale(1); }
}

@keyframes hud-reticle {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) rotateX(18deg) rotate(0deg) scale(0.76); }
  20%, 80% { opacity: 1; }
  100% { transform: translate(-50%, -50%) rotateX(18deg) rotate(92deg) scale(1.08); }
}

@keyframes hud-panel {
  0%, 100% { opacity: 0; transform: translate(-50%, -38%) translateZ(var(--panel-depth)) rotateY(-18deg) scale(0.86); }
  24%, 80% { opacity: 1; transform: translate(-50%, -50%) translateZ(var(--panel-depth)) rotateY(0deg) scale(1); }
  52% { transform: translate(calc(-50% + 8px), calc(-50% - 4px)) translateZ(var(--panel-depth)) rotateY(5deg) scale(1.02); }
  86% { opacity: 1; transform: translate(-50%, -50%) translateZ(var(--panel-depth)) rotateY(0deg) scale(1.06); }
}

@keyframes hud-cabin {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) translateZ(56px) scale(0.86); }
  20%, 82% { opacity: 1; transform: translate(-50%, -50%) translateZ(56px) scale(1); }
}
</style>
