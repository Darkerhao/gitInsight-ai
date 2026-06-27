<script setup lang="ts">
import { computed } from 'vue';
import { Send, Sparkles } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import SectionTitle from '@/components/common/SectionTitle.vue';

const assistant = useAssistant();
const { report, status, loading, pushing, repos, generate, push, generateAndPush } = assistant;

const repoCountText = computed(() => `已扫描到 ${repos.value.length} 个仓库`);
</script>

<template>
  <div class="config-block">
    <SectionTitle title="配置预览" />
    <div class="preview-area">
      <el-input
        v-model="report"
        type="textarea"
        :rows="12"
        resize="none"
        placeholder="生成结果会显示在这里"
      />
    </div>
    <div class="preview-footer">
      <div class="preview-footer-actions">
        <el-button :icon="Sparkles" type="primary" :loading="loading" @click="generate">生成日报</el-button>
        <el-button :icon="Send" :loading="pushing" @click="push">同步飞书</el-button>
        <el-button :icon="Sparkles" type="success" :loading="loading || pushing" @click="generateAndPush">
          生成并同步
        </el-button>
      </div>
      <span class="preview-status">{{ status || repoCountText }}</span>
    </div>
  </div>
</template>
