<script setup lang="ts">
import { onMounted, ref } from 'vue';

const emit = defineEmits<{
  (e: 'finished'): void;
}>();

// 动画总时长（需与 CSS 关键帧节奏保持一致）
const TOTAL_DURATION = 2600;

const leaving = ref(false);

onMounted(() => {
  // 接近尾声时触发淡出，结束后通知父级卸载遮罩
  const fadeTimer = window.setTimeout(() => {
    leaving.value = true;
  }, TOTAL_DURATION - 320);

  const doneTimer = window.setTimeout(() => {
    emit('finished');
  }, TOTAL_DURATION);

  // 组件被提前卸载时清理定时器
  onCleanup(() => {
    window.clearTimeout(fadeTimer);
    window.clearTimeout(doneTimer);
  });
});

function onCleanup(fn: () => void) {
  // 轻量清理：组件卸载时执行
  import('vue').then(({ onBeforeUnmount }) => onBeforeUnmount(fn));
}
</script>

<template>
  <div class="welcome-gate" :class="{ leaving }">
    <!-- 左右两扇门 -->
    <div class="gate-leaf gate-leaf-left" />
    <div class="gate-leaf gate-leaf-right" />

    <!-- 中央品牌 -->
    <div class="gate-brand">
      <div class="gate-logo">A</div>
      <div class="gate-title">AI日报助手</div>
      <div class="gate-subtitle">智能生成 · 高效同步</div>
    </div>
  </div>
</template>
