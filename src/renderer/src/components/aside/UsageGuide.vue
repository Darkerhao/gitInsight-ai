<script setup lang="ts">
import { ElMessage } from 'element-plus';

const steps = [
  { title: '配置基础信息', desc: '填写项目路径、选择负责人等基本信息' },
  { title: '配置 AI 接入', desc: '配置 AI 模型与飞书连接信息，确保数据同步' },
  { title: '设置自动同步', desc: '设置定时任务，自动生成并同步日报' },
  { title: '生成日报', desc: '手动或自动生成日报并同步到飞书' },
];
</script>

<template>
  <section class="aside-card">
    <div class="aside-card-head">
      <h3>使用指南</h3>
    </div>
    <ol class="usage-guide-list">
      <li v-for="(step, index) in steps" :key="step.title" class="usage-guide-item">
        <span class="usage-guide-index">{{ index + 1 }}</span>
        <div class="usage-guide-body">
          <strong>{{ step.title }}</strong>
          <span>{{ step.desc }}</span>
        </div>
      </li>
    </ol>
    <button class="usage-guide-btn" @click="ElMessage.info('敬请期待')">查看详细教程</button>
  </section>
</template>
