<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardCopy, Download, FileText, Gamepad2, Pin, Plus, RotateCcw, Save, Search, Send, Sparkles, Trash2 } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import { PRODUCT_MANAGER_SECTIONS, PROJECT_MANAGER_SECTIONS } from '@shared/types';
import type { MaterialRole, MaterialSection, MaterialSectionDef, RepoInfo, ReportRole } from '@shared/types';

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const {
  config,
  form,
  report,
  status,
  loading,
  pushing,
  materialGenerating,
  sortedRepos,
  selectedRepoPaths,
  selectedRepos,
  projectOptions,
  lastReportResult,
  dailyReports,
  chooseWorkspace,
  generate,
  generateFromMaterial,
  persistRoleMaterial,
  restoreRoleMaterial,
  push,
  saveCurrentReport,
  toggleRepo,
  isRepoPinned,
  toggleRepoPin,
  removeRepo,
  selectFeishuProject,
  updateProjectWorkHours,
  applyFullDayReportRange,
} = assistant;

interface RoleOption {
  key: ReportRole;
  label: string;
  title: string;
  description: string;
  source: string;
  filenameLabel: string;
  placeholder: string;
}

const reportRoles: RoleOption[] = [
  {
    key: 'developer',
    label: '研发日报',
    title: '研发日报',
    description: '基于 Git 提交、diff 和影响文件生成技术日报',
    source: '数据来源：所选仓库的 Git 提交记录',
    filenameLabel: '研发日报',
    placeholder: '生成后的研发日报会显示在这里，可直接修改后保存',
  },
  {
    key: 'projectManager',
    label: '项目经理日报',
    title: '项目经理日报',
    description: '基于项目推进事实生成，聚焦进度、里程碑、风险与协同',
    source: '数据来源：你填写的项目推进素材（非 Git）',
    filenameLabel: '项目经理日报',
    placeholder: '填写左侧项目素材后点击生成，日报会显示在这里，可继续编辑',
  },
  {
    key: 'productManager',
    label: '产品经理日报',
    title: '产品经理日报',
    description: '基于产品工作事实生成，聚焦需求、评审、验收与反馈',
    source: '数据来源：你填写的产品工作素材（非 Git）',
    filenameLabel: '产品经理日报',
    placeholder: '填写左侧产品素材后点击生成，日报会显示在这里，可继续编辑',
  },
];

const materialSectionDefs: Record<MaterialRole, MaterialSectionDef[]> = {
  projectManager: PROJECT_MANAGER_SECTIONS,
  productManager: PRODUCT_MANAGER_SECTIONS,
};

const activeRole = ref<ReportRole>('developer');
const activePreviewTab = ref('report');
const roleReportDrafts = ref<Record<ReportRole, string>>(createEmptyRoleReports());
const reportDirty = ref<Record<ReportRole, boolean>>(createCleanRoleDirty());
const materialInputs = reactive<Record<MaterialRole, Record<string, string>>>({
  projectManager: createSectionInputs('projectManager'),
  productManager: createSectionInputs('productManager'),
});
const materialExtraNotes = reactive<Record<MaterialRole, string>>({
  projectManager: '',
  productManager: '',
});
const restoredMaterialRoles = new Set<MaterialRole>();

const dateShortcut = ref('today');
const repoKeyword = ref('');
const gameScore = ref(0);
const gameStreak = ref(0);
const gameTarget = ref({ x: 52, y: 48 });
const workHourPresets = [1, 2, 4, 6, 7, 7.5, 8];
const workHourOptions = Array.from({ length: 48 }, (_, index) => (index + 1) * 0.5);
const loadingTips = [
  '正在读取素材与提交记录',
  '正在整理时间段工作内容',
  '正在压缩上下文并生成日报',
  '快点中间的小光标，给等待加一点手感',
];

const busy = computed(() => loading.value || materialGenerating.value);
const isDeveloperRole = computed(() => activeRole.value === 'developer');
const activeMaterialRole = computed<MaterialRole | null>(() => (activeRole.value === 'developer' ? null : (activeRole.value as MaterialRole)));
const activeRoleOption = computed(() => reportRoles.find((item) => item.key === activeRole.value) ?? reportRoles[0]);
const activeSectionDefs = computed(() => (activeMaterialRole.value ? materialSectionDefs[activeMaterialRole.value] : []));

const selectedProjectText = computed(() => {
  if (!selectedRepos.value.length) return '未选择项目';
  return selectedRepos.value.map((repo) => repo.name).join('、');
});

const generatedAtText = computed(() => formatDateTime(lastReportResult.value?.generatedAt || dailyReports.value[0]?.generatedAt));
const commitCount = computed(() => lastReportResult.value?.commits.length ?? 0);
const touchedFiles = computed(() => Array.from(new Set(lastReportResult.value?.commits.flatMap((commit) => commit.files) ?? [])));
const activeReportContent = computed({
  get: () => roleReportDrafts.value[activeRole.value],
  set: (value: string) => {
    roleReportDrafts.value = { ...roleReportDrafts.value, [activeRole.value]: value };
  },
});
const reportLineCount = computed(() => activeReportContent.value.split(/\r?\n/).filter((line) => line.trim()).length);
const loadingTip = computed(() => loadingTips[gameScore.value % loadingTips.length]);
const reportRangeStartMs = computed(() => new Date(form.startDateTime).getTime());
const reportRangeEndMs = computed(() => new Date(form.endDateTime).getTime());
const reportRangeValid = computed(
  () => !Number.isNaN(reportRangeStartMs.value) && !Number.isNaN(reportRangeEndMs.value) && reportRangeStartMs.value < reportRangeEndMs.value,
);
const reportRangeLabel = computed(() => {
  if (!reportRangeValid.value) return '请选择有效时间段';
  return `${formatRangeDateTime(form.startDateTime)} 至 ${formatRangeDateTime(form.endDateTime)}`;
});
const reportTitleRange = computed(() => (reportRangeValid.value ? reportRangeLabel.value : form.date));
const reportPreviewTitle = computed(() => {
  if (isDeveloperRole.value) return `${selectedProjectText.value} ${reportTitleRange.value} 日报`;
  return `${activeRoleOption.value.title} · ${form.date}`;
});
const gameTargetStyle = computed(() => ({
  left: `${gameTarget.value.x}%`,
  top: `${gameTarget.value.y}%`,
}));

const filledSectionCount = computed(() => {
  if (!activeMaterialRole.value) return 0;
  const inputs = materialInputs[activeMaterialRole.value];
  const filled = activeSectionDefs.value.filter((def) => (inputs[def.key] ?? '').trim()).length;
  return materialExtraNotes[activeMaterialRole.value].trim() ? filled + 1 : filled;
});
const hasMaterialContent = computed(() => filledSectionCount.value > 0);

const metrics = computed(() => {
  if (isDeveloperRole.value) {
    return [
      { label: '选中仓库', value: selectedRepos.value.length },
      { label: '提交记录', value: commitCount.value },
      { label: '影响文件', value: touchedFiles.value.length },
      { label: '当前正文行数', value: activeReportContent.value ? reportLineCount.value : 0 },
    ];
  }
  return [
    { label: '已填素材项', value: filledSectionCount.value },
    { label: '素材分区', value: activeSectionDefs.value.length },
    { label: '当前正文行数', value: activeReportContent.value ? reportLineCount.value : 0 },
  ];
});

const generationRecords = computed(() => dailyReports.value.slice(0, 5));
const selectedRepoSummary = computed(() => {
  if (!selectedRepos.value.length) return '请选择要生成日报的仓库';
  if (selectedRepos.value.length === 1) return selectedRepos.value[0].name;
  return `已选择 ${selectedRepos.value.length} 个仓库`;
});
const filteredRepos = computed(() => {
  const keyword = repoKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return sortedRepos.value;
  return sortedRepos.value.filter((repo) => `${repo.name} ${repo.path}`.toLocaleLowerCase().includes(keyword));
});
const generationChecks = computed(() => [
  {
    key: 'repo',
    label: '仓库范围',
    ok: selectedRepos.value.length > 0,
    detail: selectedRepos.value.length ? `已选择 ${selectedRepos.value.length} 个仓库` : '未选择仓库',
    action: 'repositories',
    required: true,
  },
  {
    key: 'date',
    label: '日报日期',
    ok: Boolean(form.date),
    detail: form.date || '未选择日期',
    action: '',
    required: true,
  },
  {
    key: 'range',
    label: '提交时间段',
    ok: reportRangeValid.value,
    detail: reportRangeLabel.value,
    action: '',
    required: true,
  },
  {
    key: 'reporter',
    label: '汇报人',
    ok: Boolean(config.reporterName),
    detail: config.reporterName || '未设置汇报人',
    action: 'config',
    required: true,
  },
  {
    key: 'ai',
    label: 'AI 接入',
    ok: Boolean(config.aiBaseUrl && config.aiModel && config.aiApiKey),
    detail: config.aiApiKey ? config.aiModel : '未配置时将使用基础模板排版',
    action: 'config',
    required: false,
  },
]);
const blockedGenerationCheck = computed(() => generationChecks.value.find((item) => item.required && !item.ok));

function createEmptyRoleReports(): Record<ReportRole, string> {
  return { developer: '', projectManager: '', productManager: '' };
}

function createCleanRoleDirty(): Record<ReportRole, boolean> {
  return { developer: false, projectManager: false, productManager: false };
}

function createSectionInputs(role: MaterialRole): Record<string, string> {
  return Object.fromEntries(materialSectionDefs[role].map((def) => [def.key, '']));
}

function buildSectionsPayload(role: MaterialRole): MaterialSection[] {
  const inputs = materialInputs[role];
  return materialSectionDefs[role].map((def) => ({
    key: def.key,
    label: def.label,
    content: (inputs[def.key] ?? '').trim(),
  }));
}

async function loadMaterialForRole(role: MaterialRole) {
  if (restoredMaterialRoles.has(role)) return;
  const record = await restoreRoleMaterial(role);
  const next = createSectionInputs(role);
  if (record) {
    for (const section of record.sections) {
      if (section.key in next) next[section.key] = section.content;
    }
    materialExtraNotes[role] = record.extraNotes ?? '';
  }
  materialInputs[role] = next;
  restoredMaterialRoles.add(role);
}

async function switchRole(role: ReportRole) {
  if (role === activeRole.value) return;
  activeRole.value = role;
  activePreviewTab.value = 'report';
  if (role !== 'developer') {
    await loadMaterialForRole(role);
  }
}

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

function markReportDirty() {
  reportDirty.value = { ...reportDirty.value, [activeRole.value]: true };
}

watch(busy, (isBusy) => {
  if (!isBusy) return;
  gameScore.value = 0;
  gameStreak.value = 0;
  moveGameTarget();
});

async function handleSaveCurrentReport() {
  const record = await saveCurrentReport(activeReportContent.value);
  if (record) {
    reportDirty.value = { ...reportDirty.value, [activeRole.value]: false };
  }
}

function formatDateTime(value?: string) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatRangeDateTime(value?: string) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeValue(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${formatDate(date)}T${hour}:${minute}:${second}`;
}

function setDateShortcut(value: string) {
  dateShortcut.value = value;
  if (value === 'custom') return;
  const now = new Date();
  if (value === 'rolling') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(9, 0, 0, 0);
    form.date = formatDate(now);
    form.startDateTime = formatDateTimeValue(start);
    form.endDateTime = formatDateTimeValue(now);
    return;
  }
  const date = new Date(now);
  if (value === 'yesterday') date.setDate(date.getDate() - 1);
  applyFullDayReportRange(formatDate(date));
}

function handleReportDateChange() {
  if (form.date) {
    applyFullDayReportRange(form.date);
  }
  dateShortcut.value = 'custom';
}

function handleRangeChange() {
  dateShortcut.value = 'custom';
}

async function handleGenerate() {
  if (isDeveloperRole.value) {
    await handleGenerateDeveloper();
    return;
  }
  await handleGenerateMaterial();
}

async function handleGenerateDeveloper() {
  const blocked = blockedGenerationCheck.value;
  if (blocked) {
    ElMessage.warning(`请先完善：${blocked.label}`);
    return;
  }
  if (!config.aiApiKey) {
    ElMessage.info('未配置 AI 接入，将使用基础日报模板生成');
  }
  await generate();
  if (report.value.trim()) {
    roleReportDrafts.value = { ...roleReportDrafts.value, developer: report.value };
    reportDirty.value = { ...reportDirty.value, developer: false };
  }
}

async function handleGenerateMaterial() {
  const role = activeMaterialRole.value;
  if (!role) return;
  if (!config.reporterName) {
    ElMessage.warning('请先填写汇报人');
    return;
  }
  if (!hasMaterialContent.value) {
    ElMessage.warning('请至少填写一项工作素材后再生成日报');
    return;
  }
  const sections = buildSectionsPayload(role);
  const extraNotes = materialExtraNotes[role].trim();
  await persistRoleMaterial(role, sections, extraNotes);
  await generateFromMaterial(role, sections, extraNotes);
  if (report.value.trim()) {
    roleReportDrafts.value = { ...roleReportDrafts.value, [role]: report.value };
    reportDirty.value = { ...reportDirty.value, [role]: false };
  }
}

async function copyReport() {
  if (!activeReportContent.value.trim()) {
    ElMessage.warning('当前没有可复制的日报内容');
    return;
  }
  await navigator.clipboard.writeText(activeReportContent.value);
  ElMessage.success('日报内容已复制');
}

function exportMarkdown() {
  if (!activeReportContent.value.trim()) {
    ElMessage.warning('当前没有可导出的日报内容');
    return;
  }
  const blob = new Blob([activeReportContent.value], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `项目日报-${activeRoleOption.value.filenameLabel}-${form.date}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('Markdown 已导出');
}

async function publishActiveReport() {
  await push(activeReportContent.value);
}

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从仓库中心移除「${item.name}」吗？这不会删除本地仓库文件。`, '移除仓库', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await removeRepo(item.path);
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '移除仓库失败');
  }
}
</script>

<template>
  <div class="view-stack">
    <div v-if="busy" class="generation-loading-overlay" aria-live="polite">
      <div class="generation-loading-shell">
        <div class="generation-loading-copy">
          <span class="loading-eyebrow">
            <Sparkles :size="16" />
            生成中
          </span>
          <h2>AI 正在整理{{ activeRoleOption.label }}</h2>
          <p>{{ loadingTip }}</p>
          <div class="loading-progress">
            <i />
          </div>
        </div>

        <div class="loading-game-panel">
          <div class="loading-game-head">
            <div>
              <strong>等待小游戏</strong>
              <span>点击光标收集灵感点</span>
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
            <button type="button" class="loading-game-target" :style="gameTargetStyle" @click="hitGameTarget">
              <Sparkles :size="20" />
            </button>
          </div>
          <p>连续命中 {{ gameStreak }} 次，日报生成完成后会自动关闭。</p>
        </div>
      </div>
    </div>

    <PageHeader title="日报生成" subtitle="按角色的真实数据来源生成日报：研发用 Git，项目/产品用工作素材">
      <template #actions>
        <el-button :icon="FileText" plain @click="emit('navigate', 'history')">生成记录</el-button>
        <el-button :icon="CalendarDays" plain @click="emit('navigate', 'sync:list')">同步任务</el-button>
      </template>
    </PageHeader>

    <section class="surface-card role-select-card">
      <div class="role-select-head">
        <strong>选择日报角色</strong>
        <span>不同角色的事实来源不同，生成方式也不同</span>
      </div>
      <div class="role-select-grid">
        <button
          v-for="item in reportRoles"
          :key="item.key"
          type="button"
          class="role-select-card-item"
          :class="{ active: activeRole === item.key }"
          @click="switchRole(item.key)"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.description }}</span>
          <small>{{ item.source }}</small>
        </button>
      </div>
    </section>

    <div class="content-grid has-right-panel">
      <div class="view-stack">
        <section v-if="isDeveloperRole" class="surface-card step-card">
          <div class="step-title">
            <span>1</span>
            <strong>选择生成范围</strong>
          </div>
          <div class="field-grid">
            <div class="field field-span-3 repo-picker-field">
              <label>选择仓库</label>
              <el-popover placement="bottom-start" trigger="click" :width="620" popper-class="repo-picker-popper">
                <template #reference>
                  <button type="button" class="repo-picker-trigger">
                    <div>
                      <strong>{{ selectedRepoSummary }}</strong>
                      <span>{{ selectedRepos.length ? selectedRepos.map((repo) => repo.name).join('、') : '支持多仓库汇总生成日报' }}</span>
                    </div>
                    <small>{{ selectedRepoPaths.length }}/{{ sortedRepos.length }}</small>
                  </button>
                </template>

                <div class="repo-picker-panel">
                  <div class="repo-picker-head">
                    <div>
                      <strong>仓库选择</strong>
                      <span>当前日报会基于选中的仓库生成</span>
                    </div>
                    <el-button :icon="Plus" type="primary" plain @click="chooseWorkspace">添加仓库</el-button>
                  </div>

                  <el-input v-model="repoKeyword" :prefix-icon="Search" clearable placeholder="搜索仓库名称或路径" />

                  <div class="repo-picker-list">
                    <button v-if="!sortedRepos.length" type="button" class="repo-picker-empty" @click="chooseWorkspace">
                      暂无仓库，点击选择工作目录
                    </button>

                    <div
                      v-for="repo in filteredRepos"
                      :key="repo.path"
                      class="repo-picker-item"
                      :class="{ active: selectedRepoPaths.includes(repo.path), pinned: isRepoPinned(repo.path) }"
                    >
                      <button type="button" class="repo-picker-main" @click="toggleRepo(repo.path)">
                        <span class="repo-picker-check">
                          <CheckCircle2 v-if="selectedRepoPaths.includes(repo.path)" :size="16" />
                        </span>
                        <span class="repo-picker-copy">
                          <strong>{{ repo.name }}</strong>
                          <small>{{ repo.path }}</small>
                        </span>
                      </button>

                      <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
                        <button
                          type="button"
                          class="repo-picker-icon"
                          :class="{ active: isRepoPinned(repo.path) }"
                          :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${repo.name}` : `置顶 ${repo.name}`"
                          :aria-pressed="isRepoPinned(repo.path)"
                          @click.stop="toggleRepoPin(repo.path)"
                        >
                          <Pin :size="15" />
                        </button>
                      </el-tooltip>

                      <el-tooltip content="从列表移除" placement="top">
                        <button type="button" class="repo-picker-icon danger" :aria-label="`移除 ${repo.name}`" @click.stop="confirmRemoveRepo(repo)">
                          <Trash2 :size="15" />
                        </button>
                      </el-tooltip>
                    </div>

                    <div v-if="sortedRepos.length && !filteredRepos.length" class="repo-picker-empty">
                      未找到匹配仓库
                    </div>
                  </div>
                </div>
              </el-popover>
            </div>
            <div class="field">
              <label>日报日期</label>
              <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="handleReportDateChange" />
            </div>
            <div class="field">
              <label>提交开始</label>
              <el-date-picker
                v-model="form.startDateTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm:ss"
                :clearable="false"
                placeholder="开始时间"
                @change="handleRangeChange"
              />
            </div>
            <div class="field">
              <label>提交结束</label>
              <el-date-picker
                v-model="form.endDateTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm:ss"
                :clearable="false"
                placeholder="结束时间"
                @change="handleRangeChange"
              />
            </div>
          </div>
          <div class="segmented-actions">
            <button :class="{ active: dateShortcut === 'today' }" @click="setDateShortcut('today')">今天</button>
            <button :class="{ active: dateShortcut === 'yesterday' }" @click="setDateShortcut('yesterday')">昨天</button>
            <button :class="{ active: dateShortcut === 'rolling' }" @click="setDateShortcut('rolling')">昨日9点至现在</button>
            <button :class="{ active: dateShortcut === 'custom' }" @click="setDateShortcut('custom')">自定义范围</button>
          </div>
        </section>

        <section v-else class="surface-card step-card">
          <div class="step-title">
            <span>1</span>
            <strong>填写{{ activeRoleOption.label }}素材</strong>
          </div>
          <div class="notice-line">
            <StatusBadge status="info" :label="`${activeRoleOption.source}，可只填有内容的分区`" />
          </div>
          <div class="field-grid">
            <div class="field">
              <label>日报日期</label>
              <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" :clearable="false" />
            </div>
          </div>
          <div v-if="activeMaterialRole" class="material-form">
            <div v-for="def in activeSectionDefs" :key="def.key" class="material-field">
              <label>{{ def.label }}</label>
              <el-input
                v-model="materialInputs[activeMaterialRole][def.key]"
                type="textarea"
                :rows="2"
                resize="vertical"
                :placeholder="def.placeholder"
                @input="markReportDirty"
              />
            </div>
            <div class="material-field">
              <label>补充材料</label>
              <el-input
                v-model="materialExtraNotes[activeMaterialRole]"
                type="textarea"
                :rows="3"
                resize="vertical"
                placeholder="可粘贴会议纪要、需求文档摘录、聊天记录等任意补充材料，AI 会一并整理"
                @input="markReportDirty"
              />
            </div>
          </div>
        </section>

        <section class="surface-card step-card">
          <div class="step-title with-action">
            <div>
              <span>2</span>
              <strong>生成与编辑</strong>
            </div>
            <el-button :icon="Sparkles" type="primary" :loading="busy" @click="handleGenerate">开始生成</el-button>
          </div>
          <div v-if="isDeveloperRole" class="generation-check-grid">
            <button
              v-for="item in generationChecks"
              :key="item.key"
              type="button"
              class="generation-check-card"
              :class="{ ready: item.ok, warning: !item.ok && item.required, optional: !item.required }"
              :disabled="!item.action"
              @click="item.action && emit('navigate', item.action)"
            >
              <component :is="item.ok ? CheckCircle2 : CircleAlert" :size="18" />
              <span>
                <strong>{{ item.label }}</strong>
                <small>{{ item.detail }}</small>
              </span>
            </button>
          </div>
          <div class="notice-line">
            <StatusBadge
              v-if="isDeveloperRole"
              status="info"
              :label="selectedRepos.length ? `将基于 ${selectedRepos.length} 个已选仓库和 ${reportRangeLabel} 生成日报` : '请先在当前仓库选择器中选择仓库'"
            />
            <StatusBadge
              v-else
              :status="hasMaterialContent ? 'info' : 'pending'"
              :label="hasMaterialContent ? `已填写 ${filledSectionCount} 项素材，将整理为${activeRoleOption.label}` : '请先在上方填写至少一项工作素材'"
            />
          </div>
          <div class="metric-grid">
            <div v-for="item in metrics" :key="item.label" class="metric-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <el-tabs v-if="isDeveloperRole" v-model="activePreviewTab" class="clean-tabs">
            <el-tab-pane label="日报正文" name="report" />
            <el-tab-pane :label="`提交记录 (${commitCount})`" name="commits" />
            <el-tab-pane :label="`影响文件 (${touchedFiles.length})`" name="files" />
            <el-tab-pane label="原始摘要" name="raw" />
          </el-tabs>

          <article class="report-preview">
            <div class="report-preview-head">
              <h2>{{ reportPreviewTitle }}</h2>
              <span>生成时间：{{ generatedAtText }}</span>
            </div>

            <div class="report-mode-row">
              <div class="report-mode-copy">
                <strong>{{ activeRoleOption.title }}</strong>
                <span>{{ activeRoleOption.description }}</span>
              </div>
            </div>

            <el-input
              v-if="!isDeveloperRole || activePreviewTab === 'report'"
              v-model="activeReportContent"
              class="editable-report"
              type="textarea"
              :rows="isDeveloperRole ? 18 : 16"
              resize="vertical"
              :placeholder="activeRoleOption.placeholder"
              @input="markReportDirty"
            />

            <div v-else-if="activePreviewTab === 'commits'" class="data-list">
              <div v-if="!lastReportResult?.commits.length" class="empty-state">暂无提交记录</div>
              <div v-for="commit in lastReportResult?.commits" :key="commit.hash" class="data-list-item">
                <strong>{{ commit.message }}</strong>
                <span>{{ commit.author }} · {{ formatDateTime(commit.date) }} · {{ commit.hash.slice(0, 8) }}</span>
              </div>
            </div>

            <div v-else-if="activePreviewTab === 'files'" class="data-list">
              <div v-if="!touchedFiles.length" class="empty-state">暂无影响文件</div>
              <div v-for="file in touchedFiles" :key="file" class="data-list-item">
                <strong>{{ file }}</strong>
              </div>
            </div>

            <pre v-else>{{ lastReportResult?.rawInput.gitLogs || '暂无原始摘要' }}</pre>
          </article>

          <div class="button-row between">
            <el-button :icon="RotateCcw" plain :loading="busy" @click="handleGenerate">重新生成</el-button>
            <div class="button-row">
              <el-button :icon="Save" plain @click="handleSaveCurrentReport">保存修改</el-button>
              <el-button :icon="ClipboardCopy" plain @click="copyReport">复制内容</el-button>
              <el-button :icon="Download" type="primary" plain @click="exportMarkdown">导出为 Markdown</el-button>
            </div>
          </div>
          <p v-if="status" class="muted-text">{{ status }}</p>
        </section>
      </div>

      <aside class="view-stack">
        <section class="surface-card publish-panel">
          <div class="step-title">
            <span>3</span>
            <strong>发布与同步</strong>
          </div>
          <h3>发布到飞书</h3>
          <div class="publish-hint">
            <span>定时自动同步已移至同步任务统一管理</span>
            <button type="button" @click="emit('navigate', 'sync:list')">去配置</button>
          </div>
          <div class="field">
            <label>选择目标</label>
            <el-select v-model="config.feishuForm.projectOptionId" placeholder="请先获取飞书项目选项" @change="selectFeishuProject">
              <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </div>
          <div class="field">
            <label>工作时长</label>
            <div class="hour-field">
              <el-input-number
                v-model="config.feishuForm.defaultWorkHours"
                :min="0.5"
                :max="24"
                :step="0.5"
                :precision="1"
                controls-position="right"
                @change="updateProjectWorkHours"
              />
              <span>小时</span>
            </div>
            <el-select
              :model-value="Number(config.feishuForm.defaultWorkHours)"
              placeholder="选择工作时长"
              @change="updateProjectWorkHours"
            >
              <el-option
                v-for="hours in workHourOptions"
                :key="hours"
                :label="`${hours}h`"
                :value="hours"
              />
            </el-select>
            <div class="hour-presets">
              <button
                v-for="hours in workHourPresets"
                :key="hours"
                type="button"
                :class="{ active: Number(config.feishuForm.defaultWorkHours) === hours }"
                @click="updateProjectWorkHours(hours)"
              >
                {{ hours }}h
              </button>
            </div>
          </div>
          <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!activeReportContent.trim()" @click="publishActiveReport">
            发布{{ activeRoleOption.label }}到飞书
          </el-button>
        </section>

        <section class="surface-card">
          <div class="panel-head">
            <h3>生成记录</h3>
            <el-button link type="primary" @click="emit('navigate', 'history')">查看全部</el-button>
          </div>
          <div class="record-list">
            <div v-if="!generationRecords.length" class="empty-state">暂无生成记录</div>
            <div v-for="item in generationRecords" :key="item.id" class="record-item">
              <StatusBadge :status="item.status === 'failed' ? 'failed' : 'success'" :label="item.status === 'draft' ? '草稿' : item.status === 'success' ? '成功' : '失败'" />
              <div>
                <strong>{{ item.date }} 日报</strong>
                <span>{{ item.repoNames.join('、') || '未记录项目' }} · {{ formatDateTime(item.generatedAt) }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
