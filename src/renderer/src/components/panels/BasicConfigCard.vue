<script setup lang="ts">
import { computed } from 'vue';
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

type BasicActionKey = 'login' | 'refresh' | 'test';

const selectedProjectName = computed(
  () => projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId)?.name || config.feishuForm.projectName || '未选择项目',
);

const fieldMappingReady = computed(() =>
  Boolean(
    config.feishuForm.questionId.trim() &&
      config.feishuForm.dateFieldId.trim() &&
      config.feishuForm.userFieldId.trim() &&
      config.feishuForm.projectFieldId.trim() &&
      config.feishuForm.hoursFieldId.trim() &&
      config.feishuForm.contentFieldId.trim(),
  ),
);
const feishuAuthReady = computed(() =>
  Boolean(
    config.feishuForm.endpoint.trim() &&
      config.feishuForm.shareToken.trim() &&
      config.feishuForm.cookie.trim() &&
      config.feishuForm.csrfToken.trim(),
  ),
);
const mappingReady = computed(() => Boolean(config.feishuForm.reporterUserId.trim() && config.feishuForm.projectOptionId.trim()));

const basicSummaryItems = computed(() => [
  {
    label: 'Git 工作目录',
    value: config.workspaceDir || '未选择',
    tone: config.workspaceDir ? 'blue' : 'muted',
  },
  {
    label: '汇报人',
    value: config.reporterName || '未配置',
    tone: config.reporterName ? 'green' : 'muted',
  },
  {
    label: '所属项目',
    value: selectedProjectName.value,
    tone: config.feishuForm.projectOptionId || config.feishuForm.projectName ? 'amber' : 'muted',
  },
]);

const basicActions = computed(() => [
  { key: 'login' as const, label: '登录飞书', icon: LogIn, loading: feishuLoading.value, type: 'default', disabled: false, title: '' },
  {
    key: 'refresh' as const,
    label: '刷新项目',
    icon: RefreshCw,
    loading: projectLoading.value,
    type: 'default',
    disabled: !config.feishuForm.projectFieldId.trim(),
    title: config.feishuForm.projectFieldId.trim() ? '' : '请先在飞书字段映射中选择所属项目字段',
  },
  {
    key: 'test' as const,
    label: '测试提交',
    icon: TestTube2,
    loading: feishuLoading.value,
    type: 'primary',
    disabled: !feishuAuthReady.value || !fieldMappingReady.value || !mappingReady.value,
    title:
      feishuAuthReady.value && fieldMappingReady.value && mappingReady.value
        ? ''
        : '请先完成飞书连接、字段映射、项目选择和汇报人 userId',
  },
]);

function handleReportDateChange(value: string | null) {
  if (value) {
    applyFullDayReportRange(value);
  }
}

function runBasicAction(key: BasicActionKey) {
  if (key === 'login') return loginFeishu();
  if (key === 'refresh') return loadFeishuProjects();
  return testSubmitFeishu();
}
</script>

<template>
  <div class="config-block">
    <SectionTitle title="基础配置" subtitle="区分 Git 提交采集与日报发布配置" />

    <div class="config-summary-strip">
      <div v-for="item in basicSummaryItems" :key="item.label" class="config-summary-item" :class="`tone-${item.tone}`">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <section class="config-scope-group git" aria-label="Git 提交采集配置">
      <div class="config-scope-group-head">
        <div>
          <div class="config-scope-group-title">
            <strong>Git 提交采集</strong>
            <span class="config-scope-badge git">Git 相关</span>
          </div>
          <span>决定从哪个工作目录、哪个日期和哪个 Git 作者读取提交；邮箱可作为额外匹配条件。</span>
        </div>
      </div>

      <div class="field-grid">
        <div class="field field-span-2">
          <label>Git 工作目录</label>
          <el-input v-model="config.workspaceDir" placeholder="例如：D:/workspace">
            <template #append>
              <el-button :icon="FolderSearch" @click="chooseWorkspace" />
            </template>
          </el-input>
        </div>
        <div class="field">
          <label>日报日期 <span class="field-scope-note">提交日期</span></label>
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" @change="handleReportDateChange" />
        </div>
        <div class="field">
          <label>负责人 <span class="field-scope-note">Git 作者</span></label>
          <el-select v-model="config.reporterName" filterable allow-create placeholder="选择或输入汇报人">
            <el-option v-for="item in reporterOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="field field-span-2">
          <label>Git 作者邮箱 <span class="field-scope-note">邮箱匹配</span></label>
          <el-input v-model="config.gitAuthorEmail" type="email" placeholder="例如：name@company.com" />
        </div>
      </div>
    </section>

    <section class="config-scope-group report" aria-label="日报与同步配置">
      <div class="config-scope-group-head">
        <div>
          <div class="config-scope-group-title">
            <strong>日报与同步</strong>
            <span class="config-scope-badge report">非 Git 配置</span>
          </div>
          <span>这些配置只影响日报归属、工时和飞书提交，不参与 Git 提交筛选。</span>
        </div>
      </div>

      <div class="field-grid">
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
    </section>

    <div class="config-block-actions">
      <el-button
        v-for="action in basicActions"
        :key="action.key"
        :icon="action.icon"
        :type="action.type"
        :loading="action.loading"
        :disabled="action.disabled"
        :plain="action.type === 'primary'"
        :title="action.title"
        @click="runBasicAction(action.key)"
      >
        {{ action.label }}
      </el-button>
    </div>
  </div>
</template>
