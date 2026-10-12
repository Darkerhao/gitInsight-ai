<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ClipboardCopy, Download, FileText, Save, Send, Sparkles } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAssistant } from '@/composables/useAssistant';
import { createMaterialReports } from '@/composables/useMaterialReports';
import { MATERIAL_ROLE_LABELS, isMaterialRole, materialSections } from '@shared/materialReport';
import type { MaterialRole } from '@shared/types';

const assistant = useAssistant();
const { config, projectOptions, aiProfileOptions, activeAiProfile, selectFeishuProject, updateProjectWorkHours } = assistant;
const route = useRoute();
const router = useRouter();
const editor = createMaterialReports({ api: window.api, config, persistConfig: assistant.persistConfig,
  confirmDiscard: async () => {
    try {
      await ElMessageBox.confirm('当前素材或日报尚未保存，继续将放弃这些修改。', '未保存的修改', {
        confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning',
      });
      return true;
    } catch { return false; }
  },
}, assistant.today);
const { draft, busy, message, error, dirty, published } = editor;
const sectionDefs = computed(() => materialSections(draft.value.role));
const hasMaterial = computed(() => draft.value.sections.some(section => section.content.trim()) || draft.value.extraNotes.trim());

function loadRoute(query: typeof route.query) {
  const role = isMaterialRole(query.role) ? query.role : 'projectManager';
  const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : assistant.today;
  const reportId = typeof query.reportId === 'string' ? Number(query.reportId) : undefined;
  return editor.load(role, date, reportId);
}

async function switchContext(role: MaterialRole, date: string) {
  if (date) await editor.load(role, date);
}

function switchDate(value: string | number) {
  return switchContext(draft.value.role, String(value));
}

function preventUnsavedClose(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = ''; }
}

onMounted(() => { void loadRoute(route.query); window.addEventListener('beforeunload', preventUnsavedClose); });
// The app mounts views dynamically outside RouterView, so register a router guard explicitly.
const removeRouteGuard = router.beforeEach(to => to.path === '/material' ? loadRoute(to.query) : editor.canLeave());
onBeforeUnmount(() => { removeRouteGuard(); window.removeEventListener('beforeunload', preventUnsavedClose); });

async function saveReport() {
  if (await editor.saveReport()) {
    try { await assistant.refreshDailyReports(); }
    catch { ElMessage.warning('日报已保存，历史列表刷新失败'); }
  }
}

async function publishReport() {
  try {
    await ElMessageBox.confirm(`将 ${draft.value.date} 的${MATERIAL_ROLE_LABELS[draft.value.role]}日报发布到「${config.feishuForm.projectName || '所选项目'}」。请确认正文和工时。`, '确认发布', {
      confirmButtonText: '确认发布', cancelButtonText: '取消', type: 'warning',
    });
  } catch { return; }
  if (await editor.publish()) {
    try { await assistant.refreshLocalData(); }
    catch { ElMessage.warning('日报已提交，本地列表刷新失败，请勿重复提交'); }
  }
}

async function copyReport() {
  try { await navigator.clipboard.writeText(draft.value.report); ElMessage.success('日报已复制'); }
  catch { ElMessage.error('复制失败，请手动选择正文复制'); }
}

function exportReport() {
  const url = URL.createObjectURL(new Blob([draft.value.report], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${draft.value.date}-${MATERIAL_ROLE_LABELS[draft.value.role]}日报.md`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="view-stack material-page">
    <PageHeader title="素材日报" subtitle="按项目经理、产品经理的真实工作素材整理日报">
      <template #actions>
        <el-button :icon="FileText" @click="router.push('/history')">历史日志</el-button>
      </template>
    </PageHeader>

    <section class="surface-card material-context">
      <div class="material-roles" aria-label="日报角色">
        <el-button v-for="(label, role) in MATERIAL_ROLE_LABELS" :key="role"
          :type="draft.role === role ? 'primary' : 'default'" :aria-pressed="draft.role === role"
          :disabled="busy" @click="switchContext(role, draft.date)">{{ label }}</el-button>
      </div>
      <div class="field">
        <label for="material-date">日报日期</label>
        <el-input id="material-date" :model-value="draft.date" type="date" :disabled="busy"
          @update:model-value="switchDate" />
      </div>
      <div class="field">
        <label>AI 配置</label>
        <el-select v-model="config.activeAiProfileId" :disabled="busy" aria-label="素材 AI 配置" @change="assistant.selectAiProfile">
          <el-option v-for="item in aiProfileOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
      <span class="muted-text">汇报人：{{ draft.reporterName || config.reporterName || '未设置' }}</span>
    </section>

    <div class="material-columns">
      <section class="surface-card view-stack">
        <div class="panel-head"><h3>{{ MATERIAL_ROLE_LABELS[draft.role] }}工作素材</h3><el-button :icon="Save" :disabled="busy" @click="editor.saveMaterial">保存素材</el-button></div>
        <p class="muted-text">只填写有内容的分区，按角色和日期分别保存。</p>
        <div v-for="(section, index) in draft.sections" :key="section.key" class="field">
          <label :for="`material-${section.key}`">{{ section.label }}</label>
          <el-input :id="`material-${section.key}`" v-model="section.content" type="textarea" :rows="3" resize="vertical"
            :placeholder="sectionDefs[index]?.placeholder" :disabled="busy" />
        </div>
        <div class="field">
          <label for="material-extra">补充材料</label>
          <el-input id="material-extra" v-model="draft.extraNotes" type="textarea" :rows="3" resize="vertical" :disabled="busy"
            placeholder="会议纪要、需求摘录、聊天记录等补充事实" />
        </div>
      </section>

      <div class="view-stack">
        <section class="surface-card view-stack">
          <div class="panel-head">
            <h3>生成与编辑</h3>
            <el-button :icon="Sparkles" type="primary" :loading="busy" :disabled="busy || !hasMaterial" @click="editor.generate">生成素材日报</el-button>
          </div>
          <p v-if="!activeAiProfile?.enabled || !activeAiProfile?.apiKey" class="muted-text">当前未启用 AI，将直接按分区排版素材。</p>
          <label for="material-report">日报正文</label>
          <el-input id="material-report" v-model="draft.report" class="material-report-editor" type="textarea" :rows="19" resize="vertical"
            :disabled="busy" placeholder="生成后可继续编辑，也可直接填写日报" />
          <div class="material-actions">
            <el-button :icon="Save" :disabled="busy || !draft.report.trim()" @click="saveReport">保存日报</el-button>
            <el-button :icon="ClipboardCopy" :disabled="!draft.report.trim()" @click="copyReport">复制</el-button>
            <el-button :icon="Download" :disabled="!draft.report.trim()" @click="exportReport">导出 Markdown</el-button>
          </div>
          <p v-if="dirty" class="muted-text">有尚未保存的修改</p>
          <el-alert v-if="error" class="material-error" :title="error" type="error" :closable="false" show-icon />
          <p v-if="message" class="material-status" role="status">{{ message }}</p>
        </section>

        <section class="surface-card view-stack">
          <h3>发布到飞书</h3>
          <div class="field">
            <label>目标项目</label>
            <el-select v-model="config.feishuForm.projectOptionId" :disabled="busy" placeholder="请在设置中连接飞书并获取项目" @change="selectFeishuProject">
              <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </div>
          <div class="field">
            <label>工作时长（小时）</label>
            <el-input-number v-model="config.feishuForm.defaultWorkHours" :min="0.5" :max="24" :step="0.5" :precision="1" :disabled="busy" @change="updateProjectWorkHours" />
          </div>
          <el-button :icon="Send" type="primary" :disabled="busy || !draft.report.trim() || !config.feishuForm.projectOptionId || published" @click="publishReport">
            {{ published ? '已提交飞书' : '发布素材日报' }}
          </el-button>
          <el-button link type="primary" @click="router.push('/config')">配置 AI 与飞书</el-button>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-context { display: flex; gap: 20px; align-items: end; flex-wrap: wrap; }
.material-context .field { min-width: 180px; }
.material-roles { display: flex; gap: 8px; padding-bottom: 1px; }
.material-columns { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(360px, 1.2fr); gap: 20px; align-items: start; }
.material-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.material-actions .el-button, .material-roles .el-button { margin-left: 0; }
.material-page h3, .material-page p { margin: 0; }
@media (max-width: 1000px) { .material-columns { grid-template-columns: 1fr; } }
</style>
