<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const emit = defineEmits<{
  (e: 'finished'): void;
}>();

// 动画总时长（需与 CSS 关键帧节奏保持一致）
const TOTAL_DURATION = 2800;

const leaving = ref(false);
let fadeTimer = 0;
let doneTimer = 0;

onMounted(() => {
  // 接近尾声时触发淡出，结束后通知父级卸载遮罩
  fadeTimer = window.setTimeout(() => {
    leaving.value = true;
  }, TOTAL_DURATION - 320);

  doneTimer = window.setTimeout(() => {
    emit('finished');
  }, TOTAL_DURATION);
});

onBeforeUnmount(() => {
  window.clearTimeout(fadeTimer);
  window.clearTimeout(doneTimer);
});
</script>

<template>
  <div class="welcome-gate" :class="{ leaving }">
    <div class="gate-backdrop" />

    <div class="gate-portal" aria-hidden="true">
      <div class="gate-frame gate-frame-top" />
      <div class="gate-frame gate-frame-left" />
      <div class="gate-frame gate-frame-right" />
      <div class="gate-frame gate-frame-bottom" />
      <div class="gate-seam" />

      <div class="gate-leaf gate-leaf-left">
        <div class="gate-door-ornament">
          <span />
          <span />
          <span />
        </div>
        <div class="gate-door-badge">AI</div>
        <div class="gate-panel gate-panel-upper" />
        <div class="gate-panel gate-panel-lower" />
        <div class="gate-handle" />
      </div>

      <div class="gate-leaf gate-leaf-right">
        <div class="gate-door-ornament">
          <span />
          <span />
          <span />
        </div>
        <div class="gate-door-badge">AI</div>
        <div class="gate-panel gate-panel-upper" />
        <div class="gate-panel gate-panel-lower" />
        <div class="gate-handle" />
      </div>
    </div>

    <!-- 中央品牌 -->
    <div class="gate-brand">
      <div class="gate-logo">A</div>
      <div class="gate-title">AI日报助手</div>
      <div class="gate-subtitle">智能生成 · 高效同步</div>
    </div>
  </div>
</template>
