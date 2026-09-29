<script setup lang="ts">
import { computed } from 'vue';
import { Check, Settings } from 'lucide-vue-next';

const props = defineProps<{
  metrics: { loaded: boolean; selectedRepoCount: number; reporterName: string; aiReady: boolean };
}>();
const emit = defineEmits<{ finished: []; navigate: [value: string] }>();
const checks = computed(() => [
  { label: '仓库', ready: props.metrics.selectedRepoCount > 0, detail: props.metrics.selectedRepoCount ? `已选择 ${props.metrics.selectedRepoCount} 个仓库` : '待选择仓库', nav: 'config' },
  { label: '汇报人', ready: Boolean(props.metrics.reporterName.trim()), detail: props.metrics.reporterName || '待填写汇报人', nav: 'config' },
  { label: 'AI', ready: props.metrics.aiReady, detail: props.metrics.aiReady ? '配置已填写' : '待配置，可先用基础模板', nav: 'ai' },
]);
const completed = computed(() => checks.value.filter((item) => item.ready).length);
function configure(nav: string) {
  emit('navigate', nav);
  emit('finished');
}
</script>

<template>
  <section class="welcome-gate" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div class="welcome-card">
      <img src="../assets/logo.png" alt="码迹 AI" width="48" height="48" />
      <h1 id="welcome-title">开始今天的工作记录</h1>
      <p>选择仓库，补充工作内容，生成并发布日报。</p>
      <p role="status">{{ metrics.loaded ? `配置进度：${completed}/3 项已填写` : '正在读取本地配置…' }}</p>
      <ul class="welcome-checks">
        <li v-for="item in checks" :key="item.label">
          <Check v-if="metrics.loaded && item.ready" :size="18" />
          <Settings v-else :size="18" />
          <div><strong>{{ item.label }}</strong><span>{{ metrics.loaded ? item.detail : '读取中' }}</span></div>
          <el-button v-if="metrics.loaded && !item.ready" text @click="configure(item.nav)">去配置</el-button>
        </li>
      </ul>
      <p class="welcome-hint">飞书发布前，可在日报配置中连接表单。</p>
      <el-button type="primary" @click="emit('finished')">进入工作台</el-button>
    </div>
  </section>
</template>
