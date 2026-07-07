<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FileText, Gamepad2, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  visible: boolean;
}>();

const gameScore = ref(0);
const gameStreak = ref(0);
const gameTarget = ref({ x: 52, y: 48 });
const loadingTips = [
  '正在读取提交记录与影响文件',
  '正在聚合模块变更与研发脉络',
  '正在压缩上下文并生成日报正文',
  '正在校验输出结构与明日计划',
];

const loadingTip = computed(() => loadingTips[gameScore.value % loadingTips.length]);
const gameTargetStyle = computed(() => ({
  left: `${gameTarget.value.x}%`,
  top: `${gameTarget.value.y}%`,
}));

function moveGameTarget() {
  gameTarget.value = {
    x: Math.round(12 + Math.random() * 76),
    y: Math.round(18 + Math.random() * 58),
  };
}

function hitGameTarget() {
  gameScore.value += 1;
  gameStreak.value += 1;
  moveGameTarget();
}

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) return;
    gameScore.value = 0;
    gameStreak.value = 0;
    moveGameTarget();
  },
);
</script>

<template>
  <div v-if="visible" class="generation-loading-overlay" aria-live="polite">
    <div class="generation-loading-shell">
      <div class="generation-loading-copy">
        <span class="loading-eyebrow">
          <FileText :size="16" />
          生成中
        </span>
        <h2>AI 正在整理研发日报</h2>
        <p>{{ loadingTip }}</p>
        <div class="loading-progress">
          <i />
        </div>
        <div class="loading-pipeline" aria-hidden="true">
          <span>Collect</span>
          <span>Analyze</span>
          <span>Compose</span>
        </div>
      </div>

      <div class="loading-game-panel">
        <div class="loading-game-head">
          <div>
            <strong>等待小游戏</strong>
            <span>命中脉冲节点，给生成过程加点手感</span>
          </div>
          <div class="loading-game-score">
            <Gamepad2 :size="16" />
            {{ gameScore }}
          </div>
        </div>
        <div class="loading-game-board">
          <span class="loading-game-chip chip-a">commit</span>
          <span class="loading-game-chip chip-b">diff</span>
          <span class="loading-game-chip chip-c">report</span>
          <button
            class="loading-game-target"
            type="button"
            :style="gameTargetStyle"
            aria-label="收集灵感点"
            @click="hitGameTarget"
          >
            <Sparkles :size="22" />
          </button>
        </div>
        <p>连续命中 {{ gameStreak }} 次，生成完成后会自动收起。</p>
      </div>
    </div>
  </div>
</template>
