<script setup lang="ts">
import { FolderSearch, LogIn, RefreshCw, TestTube2 } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import SectionTitle from '@/components/common/SectionTitle.vue';

const assistant = useAssistant();
const {
  config,
  form,
  reporterOptions,
  projectOptions,
  projectLoading,
  feishuLoading,
  chooseWorkspace,
  selectFeishuProject,
  loginFeishu,
  loadFeishuProjects,
  testSubmitFeishu,
  applyFullDayReportRange,
} = assistant;

function handleReportDateChange(value: string | null) {
  if (value) {
    applyFullDayReportRange(value);
  }
}
</script>

<template>
  <div class="config-block">
    <SectionTitle title="基础配置" />
    <div class="field-grid">
      <div class="field field-span-2">
        <label>项目路径</label>
        <el-input v-model="config.workspaceDir" placeholder="例如：D:/workspace">
          <template #append>
            <el-button :icon="FolderSearch" @click="chooseWorkspace" />
          </template>
        </el-input>
      </div>
      <div class="field">
        <label>日报日期</label>
        <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" @change="handleReportDateChange" />
      </div>
      <div class="field">
        <label>负责人</label>
        <el-select v-model="config.reporterName" filterable allow-create placeholder="选择或输入汇报人">
          <el-option v-for="item in reporterOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="field field-span-2">
        <label>所属项目</label>
        <el-select
          v-model="config.feishuForm.projectOptionId"
          filterable
          placeholder="选择所属项目"
          :loading="projectLoading"
          @change="selectFeishuProject"
        >
          <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </div>
      <div class="field">
        <label>默认工时</label>
        <el-input-number
          v-model="config.feishuForm.defaultWorkHours"
          :min="0.5"
          :max="24"
          :step="0.5"
          controls-position="right"
          placeholder="默认工时"
        />
      </div>
    </div>

    <div class="config-block-actions">
      <el-button :icon="LogIn" :loading="feishuLoading" @click="loginFeishu">登录飞书</el-button>
      <el-button :icon="RefreshCw" :loading="projectLoading" @click="loadFeishuProjects">刷新项目</el-button>
      <el-button :icon="TestTube2" type="primary" :loading="feishuLoading" @click="testSubmitFeishu">测试提交</el-button>
    </div>
  </div>
</template>
