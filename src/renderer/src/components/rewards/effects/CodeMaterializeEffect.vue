<script setup lang="ts">
import { Code2 } from 'lucide-vue-next';

const codeLines = [
  'const scene = build(tokens)',
  'nodes.map(render)',
  'mesh.extrude(depth)',
  'commit.reward.play()',
  'return structure',
];
const blocks = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  x: `${18 + ((index * 17) % 64)}%`,
  y: `${22 + ((index * 29) % 52)}%`,
  z: `${(index % 5) * 12}px`,
  delay: `${index * 58}ms`,
}));
</script>

<template>
  <div class="code-materialize-effect">
    <div class="code-lines">
      <span v-for="(line, index) in codeLines" :key="line" :style="{ animationDelay: `${index * 130}ms` }">
        {{ line }}
      </span>
    </div>
    <span
      v-for="block in blocks"
      :key="block.id"
      class="code-block"
      :style="{ left: block.x, top: block.y, '--block-z': block.z, animationDelay: block.delay }"
    />
    <div class="code-model">
      <Code2 :size="52" />
      <strong>代码实体化</strong>
    </div>
  </div>
</template>

<style scoped>
.code-materialize-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  perspective: 900px;
}

.code-lines {
  position: absolute;
  left: 8%;
  top: 18%;
  display: grid;
  gap: 10px;
  color: rgba(187, 247, 208, 0.86);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 800;
  text-shadow: 0 0 14px rgba(34, 197, 94, 0.56);
}

.code-lines span {
  opacity: 0;
  transform: translateX(-18px);
  animation: code-line 3.8s ease both;
}

.code-block {
  position: absolute;
  width: 42px;
  height: 28px;
  border: 1px solid rgba(34, 197, 94, 0.38);
  border-radius: 5px;
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.38), rgba(20, 184, 166, 0.16)),
    rgba(2, 6, 23, 0.24);
  box-shadow:
    12px 12px 0 rgba(34, 197, 94, 0.08),
    0 0 28px rgba(34, 197, 94, 0.18);
  opacity: 0;
  transform: translate(-50%, -50%) translateZ(var(--block-z)) rotateX(58deg) rotateZ(45deg) scale(0.2);
  animation: code-block 4.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.code-model {
  position: absolute;
  right: 12%;
  bottom: 18%;
  width: 210px;
  height: 152px;
  border: 1px solid rgba(34, 197, 94, 0.36);
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.34);
  color: #dcfce7;
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  transform: perspective(800px) rotateX(58deg) rotateZ(-28deg);
  animation: code-model 5s ease both;
}

.code-model strong {
  font-size: 16px;
}

@keyframes code-line {
  0% { opacity: 0; transform: translateX(-18px); }
  24%, 68% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translate(54vw, 28vh) scale(0.28); }
}

@keyframes code-block {
  0% { opacity: 0; transform: translate(-50%, -50%) translateZ(0) rotateX(58deg) rotateZ(45deg) scale(0.2); }
  32%, 76% { opacity: 1; transform: translate(-50%, -50%) translateZ(var(--block-z)) rotateX(58deg) rotateZ(45deg) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -64%) translateZ(var(--block-z)) rotateX(58deg) rotateZ(45deg) scale(0.84); }
}

@keyframes code-model {
  0%, 100% { opacity: 0; filter: blur(8px); }
  24%, 78% { opacity: 1; filter: blur(0); }
}
</style>
