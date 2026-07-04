<script setup lang="ts">
import { CircuitBoard } from 'lucide-vue-next';

const glyphSet = ['01', 'AI', 'OK', 'PR', 'Git', 'Σ', '↯', 'run'];
const streams = Array.from({ length: 34 }, (_, index) => {
  const side = ['left', 'right', 'top', 'bottom'][index % 4];
  return {
    id: index,
    side,
    offset: `${8 + ((index * 17) % 84)}%`,
    delay: `${(index % 10) * 62}ms`,
    glyphs: Array.from({ length: 5 }, (_, glyphIndex) => glyphSet[(index + glyphIndex) % glyphSet.length]),
  };
});
const rails = Array.from({ length: 10 }, (_, index) => ({
  id: index,
  delay: `${index * 90}ms`,
  rotate: `${index % 2 ? 90 : 0}deg`,
  x: `${16 + ((index * 19) % 68)}%`,
  y: `${18 + ((index * 23) % 60)}%`,
}));
</script>

<template>
  <div class="cyber-data-flow-effect">
    <span
      v-for="stream in streams"
      :key="stream.id"
      class="cyber-stream"
      :class="`from-${stream.side}`"
      :style="{ '--stream-offset': stream.offset, animationDelay: stream.delay }"
    >
      <i v-for="(glyph, glyphIndex) in stream.glyphs" :key="`${stream.id}-${glyphIndex}`">{{ glyph }}</i>
    </span>

    <span
      v-for="rail in rails"
      :key="rail.id"
      class="cyber-rail"
      :style="{ left: rail.x, top: rail.y, '--rail-rotate': rail.rotate, animationDelay: rail.delay }"
    />

    <div class="cyber-frame">
      <div class="cyber-frame-grid">
        <span v-for="index in 12" :key="index" />
      </div>
      <div class="cyber-core">
        <CircuitBoard :size="44" />
        <strong>赛博霓虹数据流</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cyber-data-flow-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.cyber-data-flow-effect::before,
.cyber-data-flow-effect::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.cyber-data-flow-effect::before {
  background:
    linear-gradient(115deg, transparent 0 42%, rgba(125, 249, 255, 0.22) 48%, transparent 55%),
    radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.18), transparent 38%);
  mix-blend-mode: screen;
  transform: translateX(-30%);
  animation: cyber-screen-sweep 2.4s ease-out both;
}

.cyber-data-flow-effect::after {
  background:
    repeating-linear-gradient(0deg, transparent 0 10px, rgba(34, 211, 238, 0.08) 11px 12px),
    linear-gradient(90deg, transparent, rgba(236, 72, 153, 0.12), transparent);
  mix-blend-mode: color-dodge;
  animation: cyber-glitch-field 4.8s steps(3, end) both;
}

.cyber-stream {
  position: absolute;
  display: inline-flex;
  gap: 7px;
  color: rgba(125, 249, 255, 0.86);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  opacity: 0;
  text-shadow: 0 0 14px rgba(34, 211, 238, 0.72);
  filter: drop-shadow(0 0 10px rgba(236, 72, 153, 0.36));
  mix-blend-mode: screen;
}

.cyber-stream i {
  font-style: normal;
}

.cyber-stream.from-left {
  left: -22vw;
  top: var(--stream-offset);
  animation: cyber-flow-left 2.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.cyber-stream.from-right {
  right: -22vw;
  top: var(--stream-offset);
  animation: cyber-flow-right 2.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.cyber-stream.from-top {
  left: var(--stream-offset);
  top: -16vh;
  flex-direction: column;
  animation: cyber-flow-top 2.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.cyber-stream.from-bottom {
  left: var(--stream-offset);
  bottom: -16vh;
  flex-direction: column;
  animation: cyber-flow-bottom 2.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.cyber-rail {
  position: absolute;
  width: 18vw;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.9), rgba(244, 114, 182, 0.72), transparent);
  opacity: 0;
  transform: translate(-50%, -50%) rotate(var(--rail-rotate)) scaleX(0.12);
  animation: cyber-rail 2.8s ease both;
}

.cyber-frame {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(520px, 76vw);
  height: min(300px, 54vh);
  border: 1px solid rgba(34, 211, 238, 0.48);
  border-radius: 12px;
  background:
    linear-gradient(90deg, rgba(34, 211, 238, 0.1), transparent 28% 72%, rgba(236, 72, 153, 0.1)),
    rgba(2, 6, 23, 0.42);
  backdrop-filter: blur(8px);
  box-shadow:
    inset 0 0 42px rgba(34, 211, 238, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 70px rgba(34, 211, 238, 0.26),
    0 0 110px rgba(236, 72, 153, 0.16);
  overflow: hidden;
  transform: translate(-50%, -50%) scale(0.86);
  animation: cyber-frame 4.8s ease both;
}

.cyber-frame::before,
.cyber-frame::after {
  content: '';
  position: absolute;
  width: 86px;
  height: 86px;
  border-color: rgba(125, 249, 255, 0.76);
}

.cyber-frame::before {
  left: 14px;
  top: 14px;
  border-left: 2px solid;
  border-top: 2px solid;
}

.cyber-frame::after {
  right: 14px;
  bottom: 14px;
  border-right: 2px solid;
  border-bottom: 2px solid;
}

.cyber-frame-grid {
  position: absolute;
  inset: 18px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 10px;
}

.cyber-frame-grid span {
  border: 1px solid rgba(34, 211, 238, 0.26);
  border-radius: 8px;
  background: rgba(34, 211, 238, 0.07);
  opacity: 0;
  animation: cyber-cell 2.8s ease both;
}

.cyber-frame-grid span:nth-child(3n) {
  animation-delay: 120ms;
}

.cyber-frame-grid span:nth-child(4n) {
  animation-delay: 220ms;
}

.cyber-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 172px;
  height: 128px;
  border: 1px solid rgba(125, 249, 255, 0.24);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.28);
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  color: #cffafe;
  transform: translate(-50%, -50%);
  animation: cyber-core 4.8s ease both;
}

.cyber-core::before {
  content: '';
  position: absolute;
  inset: -18px;
  border-radius: inherit;
  background: conic-gradient(from 0deg, transparent, rgba(34, 211, 238, 0.58), rgba(244, 114, 182, 0.42), transparent 46%);
  opacity: 0.72;
  filter: blur(1px);
  animation: cyber-core-orbit 2.4s linear infinite;
}

.cyber-core svg,
.cyber-core strong {
  position: relative;
  z-index: 1;
}

.cyber-core strong {
  font-size: 16px;
}

@keyframes cyber-screen-sweep {
  0% { opacity: 0; transform: translateX(-30%); }
  18% { opacity: 1; }
  100% { opacity: 0; transform: translateX(30%); }
}

@keyframes cyber-glitch-field {
  0%, 100% { opacity: 0; transform: translate(0, 0); }
  24%, 72% { opacity: 0.72; }
  36% { transform: translate(2px, -1px); }
  48% { transform: translate(-2px, 1px); }
  60% { transform: translate(1px, 2px); }
}

@keyframes cyber-flow-left {
  0% { opacity: 0; transform: translateX(0) scale(0.88); }
  16%, 70% { opacity: 1; }
  100% { opacity: 0; transform: translateX(62vw) scale(0.48); }
}

@keyframes cyber-flow-right {
  0% { opacity: 0; transform: translateX(0) scale(0.88); }
  16%, 70% { opacity: 1; }
  100% { opacity: 0; transform: translateX(-62vw) scale(0.48); }
}

@keyframes cyber-flow-top {
  0% { opacity: 0; transform: translateY(0) scale(0.88); }
  16%, 70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(48vh) scale(0.48); }
}

@keyframes cyber-flow-bottom {
  0% { opacity: 0; transform: translateY(0) scale(0.88); }
  16%, 70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-48vh) scale(0.48); }
}

@keyframes cyber-rail {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--rail-rotate)) scaleX(0.12); }
  24%, 70% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--rail-rotate)) scaleX(1); }
}

@keyframes cyber-frame {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  18%, 76% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes cyber-cell {
  0% { opacity: 0; transform: scale(0.72); }
  42%, 82% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.96); }
}

@keyframes cyber-core {
  0%, 100% { opacity: 0; filter: blur(8px); }
  24%, 78% { opacity: 1; filter: blur(0); }
}

@keyframes cyber-core-orbit {
  to { transform: rotate(360deg); }
}
</style>
