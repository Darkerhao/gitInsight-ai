<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CheckCircle2, CircleAlert, ClipboardList, LogIn, Plus, RefreshCw, TestTube2, Trash2, UserRound } from 'lucide-vue-next';
import type { AiConnectionTestResult } from '@shared/types';
import { useAssistant } from '@/composables/useAssistant';
import SectionTitle from '@/components/common/SectionTitle.vue';

const props = withDefaults(
  defineProps<{
    mode?: 'full' | 'ai';
  }>(),
  {
    mode: 'full',
  },
);

const assistant = useAssistant();
const {
  config,
  advancedConfigPanels,
  aiBaseUrlOptions,
  aiModelOptions,
  aiProfileOptions,
  activeAiProfile,
  feishuFieldOptions,
  feishuLoading,
  fieldLoading,
  projectLoading,
  projectOptions,
  createAiProfile,
  selectAiProfile,
  removeAiProfile,
  rememberAiBaseUrlOption,
  rememberAiModelOption,
  removeAiBaseUrlOption,
  removeAiModelOption,
  loginFeishu,
  loadFeishuFields,
  loadFeishuProjects,
  testSubmitFeishu,
} = assistant;

type FeishuGuideAction = 'login' | 'fields' | 'projects' | 'mapping' | 'test';

const fieldMappingRows = [
  { label: '日期字段', model: 'dateFieldId', placeholder: '选择日期字段 ID' },
  { label: '汇报人字段', model: 'userFieldId', placeholder: '选择汇报人字段 ID' },
  { label: '明细表问题', model: 'questionId', placeholder: '选择明细表问题 ID' },
  { label: '所属项目字段', model: 'projectFieldId', placeholder: '选择所属项目字段 ID' },
  { label: '工作时长字段', model: 'hoursFieldId', placeholder: '选择工作时长字段 ID' },
  { label: '工作内容字段', model: 'contentFieldId', placeholder: '选择工作内容字段 ID' },
] as const;

const isAiOnly = computed(() => props.mode === 'ai');
const sectionTitle = computed(() => (isAiOnly.value ? 'AI 配置管理' : 'AI 接入与飞书连接'));
const sectionSubtitle = computed(() => (isAiOnly.value ? '维护统一模型连接信息' : '维护模型、授权凭据和表单字段映射'));
const canRemoveAiProfile = computed(() => config.aiProfiles.length > 1);
const aiConnectionTesting = ref(false);
const aiConnectionTestResult = ref<AiConnectionTestResult | null>(null);
const aiConnectionSignature = computed(() =>
  [activeAiProfile.value.id, activeAiProfile.value.baseUrl, activeAiProfile.value.apiKey, activeAiProfile.value.model]
    .map((value) => String(value ?? ''))
    .join('\u0000'),
);
watch(aiConnectionSignature, () => {
  aiConnectionTestResult.value = null;
});
const feishuAuthReady = computed(() =>
  Boolean(
    config.feishuForm.endpoint.trim() &&
      config.feishuForm.shareToken.trim() &&
      config.feishuForm.cookie.trim() &&
      config.feishuForm.csrfToken.trim(),
  ),
);
const feishuFieldMappingReady = computed(() => fieldMappingRows.every((row) => Boolean(config.feishuForm[row.model].trim())));
const feishuProjectReady = computed(() => Boolean(config.feishuForm.projectFieldId.trim() && config.feishuForm.projectOptionId.trim()));
const feishuReporterReady = computed(() => Boolean(config.feishuForm.reporterUserId.trim()));
const feishuSubmitReady = computed(
  () => feishuAuthReady.value && feishuFieldMappingReady.value && feishuProjectReady.value && feishuReporterReady.value,
);
const feishuGuideDoneCount = computed(
  () =>
    [feishuAuthReady.value, feishuFieldMappingReady.value, feishuProjectReady.value && feishuReporterReady.value, feishuSubmitReady.value].filter(Boolean)
      .length,
);
const feishuGuideStatusLabel = computed(() => `${feishuGuideDoneCount.value}/4 步完成`);
const feishuGuideSteps = computed(() => [
  {
    key: 'auth',
    title: '连接飞书',
    detail: feishuAuthReady.value ? '登录态、CSRF 和表单接口信息已齐备' : '先登录飞书，并补齐提交接口、shareToken、Cookie 与 CSRF Token',
    done: feishuAuthReady.value,
    panel: 'feishu',
    action: 'login' as FeishuGuideAction,
    actionLabel: '登录飞书',
    icon: LogIn,
    loading: feishuLoading.value,
    disabled: false,
  },
  {
    key: 'fields',
    title: '映射表单字段',
    detail: feishuFieldMappingReady.value
      ? '日期、汇报人、明细表、项目、工时和内容字段均已映射'
      : `还有 ${fieldMappingRows.filter((row) => !config.feishuForm[row.model].trim()).length} 个字段需要选择或填写`,
    done: feishuFieldMappingReady.value,
    panel: 'fields',
    action: 'fields' as FeishuGuideAction,
    actionLabel: feishuFieldOptions.value.length ? '重新解析字段' : '解析字段',
    icon: ClipboardList,
    loading: fieldLoading.value,
    disabled: !config.feishuForm.shareToken.trim() && !config.feishuForm.endpoint.trim(),
  },
  {
    key: 'mapping',
    title: '确认人员与项目',
    detail:
      feishuProjectReady.value && feishuReporterReady.value
        ? `已选择 ${projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId)?.name || config.feishuForm.projectName || '飞书项目'}`
        : '选择飞书项目，并填写汇报人 userId',
    done: feishuProjectReady.value && feishuReporterReady.value,
    panel: 'mapping',
    action: feishuProjectReady.value ? ('mapping' as FeishuGuideAction) : ('projects' as FeishuGuideAction),
    actionLabel: feishuProjectReady.value ? '完善映射' : '刷新项目',
    icon: UserRound,
    loading: projectLoading.value,
    disabled: !config.feishuForm.projectFieldId.trim(),
  },
  {
    key: 'test',
    title: '提交前检查',
    detail: feishuSubmitReady.value ? '配置已满足测试提交条件' : '完成前面步骤后，再写入一条测试记录验证闭环',
    done: feishuSubmitReady.value,
    panel: 'feishu',
    action: 'test' as FeishuGuideAction,
    actionLabel: '测试提交',
    icon: TestTube2,
    loading: feishuLoading.value,
    disabled: !feishuSubmitReady.value,
  },
]);
const activePanels = computed<string[]>({
  get: () => (isAiOnly.value ? ['ai'] : advancedConfigPanels.value),
  set: (value) => {
    if (isAiOnly.value) {
      advancedConfigPanels.value = Array.from(new Set([...advancedConfigPanels.value, ...value, 'ai']));
      return;
    }
    advancedConfigPanels.value = value;
  },
});

function handleAiProfileChange(value: string) {
  selectAiProfile(value);
}

async function runAiConnectionTest() {
  if (aiConnectionTesting.value) return;

  const payload = {
    baseUrl: activeAiProfile.value.baseUrl.trim(),
    apiKey: activeAiProfile.value.apiKey.trim(),
    model: activeAiProfile.value.model.trim(),
  };
  const requestSignature = aiConnectionSignature.value;
  if (!payload.baseUrl || !payload.apiKey || !payload.model) {
    aiConnectionTestResult.value = {
      success: false,
      message: '请先填写接口地址、API Key 和模型名称。',
      latencyMs: 0,
    };
    return;
  }

  aiConnectionTesting.value = true;
  try {
    const result = await window.api.testAiConnection(payload);
    if (requestSignature === aiConnectionSignature.value) {
      aiConnectionTestResult.value = result;
    }
  } catch (error) {
    if (requestSignature === aiConnectionSignature.value) {
      aiConnectionTestResult.value = {
        success: false,
        message: error instanceof Error ? error.message : 'AI 接口连接失败，请检查网络和配置。',
        latencyMs: 0,
      };
    }
  } finally {
    aiConnectionTesting.value = false;
  }
}

function openAdvancedPanel(name: string) {
  activePanels.value = Array.from(new Set([...activePanels.value, name]));
}

function runFeishuGuideAction(action: FeishuGuideAction, panel: string) {
  openAdvancedPanel(panel);
  if (action === 'login') return loginFeishu();
  if (action === 'fields') return loadFeishuFields();
  if (action === 'projects') return loadFeishuProjects();
  if (action === 'test') return testSubmitFeishu();
  return undefined;
}
</script>

<template>
  <div class="config-block">
    <SectionTitle :title="sectionTitle" :subtitle="sectionSubtitle">
      <template #extra>
        <el-button v-if="isAiOnly" class="ai-config-action-btn" :icon="Plus" type="primary" plain @click="createAiProfile">
          新增配置
        </el-button>
      </template>
    </SectionTitle>

    <div v-if="isAiOnly" class="ai-profile-manager">
      <aside class="ai-profile-list" aria-label="AI 配置列表">
        <el-button
          v-for="profile in config.aiProfiles"
          :key="profile.id"
          class="ai-profile-item"
          :class="{ active: profile.id === config.activeAiProfileId }"
          plain
          @click="selectAiProfile(profile.id)"
        >
          <span class="ai-profile-copy">
            <strong>{{ profile.name || '未命名配置' }}</strong>
            <small>{{ profile.model || '未配置模型' }}</small>
          </span>
          <el-tag v-if="profile.id === config.activeAiProfileId" size="small" effect="light" round>当前</el-tag>
        </el-button>
      </aside>

      <section class="ai-profile-editor">
        <div class="field-helper-row ai-profile-helper-row">
          <div>
            <strong>{{ activeAiProfile.name || '未命名配置' }}</strong>
            <span>生成日报时会默认使用当前选中的 AI 配置，也可以在生成页临时切换。测试连接使用当前表单值，不会自动保存。</span>
          </div>
          <div class="ai-profile-actions">
            <el-button class="ai-config-action-btn" :icon="TestTube2" type="primary" plain :loading="aiConnectionTesting" @click="runAiConnectionTest">
              测试连接
            </el-button>
            <el-button class="ai-config-action-btn" :icon="Trash2" type="danger" plain :disabled="!canRemoveAiProfile" @click="removeAiProfile(activeAiProfile.id)">
              删除配置
            </el-button>
          </div>
        </div>

        <div class="field-grid">
          <div class="field">
            <label>配置名称</label>
            <el-input v-model="activeAiProfile.name" placeholder="例如：DeepSeek 生产环境" />
          </div>
          <div class="field field-span-2">
            <label>接口地址</label>
            <el-select
              v-model="activeAiProfile.baseUrl"
              filterable
              allow-create
              default-first-option
              placeholder="OpenAI兼容接口地址"
              @change="rememberAiBaseUrlOption"
            >
              <el-option v-for="item in aiBaseUrlOptions" :key="item" :label="item" :value="item">
                <div class="select-option-row">
                  <span>{{ item }}</span>
                  <el-button class="option-delete" link type="danger" :icon="Trash2" @click.stop="removeAiBaseUrlOption(item)" />
                </div>
              </el-option>
            </el-select>
          </div>
          <div class="field">
            <label>模型名称</label>
            <el-select
              v-model="activeAiProfile.model"
              filterable
              allow-create
              default-first-option
              placeholder="模型名称"
              @change="rememberAiModelOption"
            >
              <el-option v-for="item in aiModelOptions" :key="item" :label="item" :value="item">
                <div class="select-option-row">
                  <span>{{ item }}</span>
                  <el-button class="option-delete" link type="danger" :icon="Trash2" @click.stop="removeAiModelOption(item)" />
                </div>
              </el-option>
            </el-select>
          </div>
          <div class="field">
            <label>启用状态</label>
            <div class="state-switch-wrap" :class="{ active: activeAiProfile.enabled }">
              <el-switch v-model="activeAiProfile.enabled" class="state-switch" />
              <span class="state-switch-label">{{ activeAiProfile.enabled ? '启用' : '停用' }}</span>
            </div>
          </div>
          <div class="field field-span-3">
            <label>API Key</label>
            <el-input v-model="activeAiProfile.apiKey" type="password" show-password placeholder="API Key" />
          </div>
        </div>

        <div
          v-if="aiConnectionTestResult"
          class="ai-connection-test-result"
          :class="aiConnectionTestResult.success ? 'success' : 'error'"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 v-if="aiConnectionTestResult.success" :size="18" />
          <CircleAlert v-else :size="18" />
          <div class="ai-connection-test-copy">
            <strong>{{ aiConnectionTestResult.success ? '连接成功' : '连接失败' }}</strong>
            <span>{{ aiConnectionTestResult.message }}</span>
            <small v-if="!aiConnectionTestResult.success && /HTML 页面|不是有效 JSON/.test(aiConnectionTestResult.message)">
              提示：接口地址通常填写服务商提供的 API Base URL，例如 https://api.example.com/v1，而不是官网首页。
            </small>
          </div>
          <small v-if="aiConnectionTestResult.latencyMs > 0">{{ aiConnectionTestResult.latencyMs }} ms</small>
        </div>
      </section>
    </div>

    <el-collapse v-else v-model="activePanels" class="advanced-collapse">
      <section class="feishu-guide-card" aria-label="飞书接入向导">
        <div class="feishu-guide-head">
          <div>
            <strong>飞书接入向导</strong>
            <span>按顺序完成连接、字段映射、项目人员映射和测试提交。</span>
          </div>
          <el-tag :type="feishuGuideDoneCount === 4 ? 'success' : 'warning'" effect="light" round>
            {{ feishuGuideStatusLabel }}
          </el-tag>
        </div>

        <div class="feishu-guide-steps">
          <article
            v-for="step in feishuGuideSteps"
            :key="step.key"
            class="feishu-guide-step"
            :class="{ done: step.done }"
          >
            <div class="feishu-guide-step-icon">
              <component :is="step.done ? CheckCircle2 : step.icon" :size="18" />
            </div>
            <div class="feishu-guide-step-copy">
              <strong>{{ step.title }}</strong>
              <span>{{ step.detail }}</span>
            </div>
            <el-button
              size="small"
              plain
              :type="step.done ? 'success' : 'primary'"
              :loading="step.loading"
              :disabled="step.disabled"
              @click="runFeishuGuideAction(step.action, step.panel)"
            >
              {{ step.actionLabel }}
            </el-button>
          </article>
        </div>
      </section>

      <el-collapse-item :title="isAiOnly ? '模型连接配置' : 'AI 接入配置'" name="ai">
        <div class="field-grid">
          <div class="field field-span-3">
            <label>当前 AI 配置</label>
            <el-select v-model="config.activeAiProfileId" placeholder="选择 AI 配置" @change="handleAiProfileChange">
              <el-option v-for="item in aiProfileOptions" :key="item.value" :label="item.label" :value="item.value">
                <div class="select-option-row">
                  <span>{{ item.label }}</span>
                  <small>{{ item.model || item.baseUrl }}</small>
                </div>
              </el-option>
            </el-select>
          </div>
          <div class="field field-span-2">
            <label>接口地址</label>
            <el-select
              v-model="activeAiProfile.baseUrl"
              filterable
              allow-create
              default-first-option
              placeholder="OpenAI兼容接口地址"
              @change="rememberAiBaseUrlOption"
            >
              <el-option v-for="item in aiBaseUrlOptions" :key="item" :label="item" :value="item">
                <div class="select-option-row">
                  <span>{{ item }}</span>
                  <el-button
                    class="option-delete"
                    link
                    type="danger"
                    :icon="Trash2"
                    @click.stop="removeAiBaseUrlOption(item)"
                  />
                </div>
              </el-option>
            </el-select>
          </div>
          <div class="field">
            <label>模型名称</label>
            <el-select
              v-model="activeAiProfile.model"
              filterable
              allow-create
              default-first-option
              placeholder="模型名称"
              @change="rememberAiModelOption"
            >
              <el-option v-for="item in aiModelOptions" :key="item" :label="item" :value="item">
                <div class="select-option-row">
                  <span>{{ item }}</span>
                  <el-button class="option-delete" link type="danger" :icon="Trash2" @click.stop="removeAiModelOption(item)" />
                </div>
              </el-option>
            </el-select>
          </div>
          <div class="field field-span-3">
            <label>API Key</label>
            <el-input v-model="activeAiProfile.apiKey" type="password" show-password placeholder="API Key" />
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item v-if="!isAiOnly" title="飞书连接配置" name="feishu">
        <div class="field-grid">
          <div class="field field-span-2">
            <label>提交接口地址</label>
            <el-input v-model="config.feishuForm.endpoint" placeholder="飞书表单提交接口地址" />
          </div>
          <div class="field">
            <label>shareToken</label>
            <el-input v-model="config.feishuForm.shareToken" placeholder="飞书表单 shareToken" />
          </div>
          <div class="field">
            <label>x-csrftoken</label>
            <el-input v-model="config.feishuForm.csrfToken" type="password" show-password placeholder="x-csrftoken" />
          </div>
          <div class="field field-span-2">
            <label>Cookie</label>
            <el-input v-model="config.feishuForm.cookie" type="textarea" :rows="2" placeholder="Cookie（仅保存在本机配置）" />
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item v-if="!isAiOnly" title="飞书表单字段映射" name="fields">
        <div class="field-helper-row">
          <div>
            <strong>解析表单字段</strong>
            <span>根据飞书表单元数据选择字段 ID，仍支持手动输入兜底。</span>
          </div>
          <el-button :icon="RefreshCw" :loading="fieldLoading" type="primary" plain @click="loadFeishuFields">
            解析字段
          </el-button>
        </div>

        <div class="field-grid">
          <div v-for="row in fieldMappingRows" :key="row.model" class="field">
            <label>{{ row.label }}</label>
            <el-select
              v-model="config.feishuForm[row.model]"
              filterable
              allow-create
              default-first-option
              :placeholder="row.placeholder"
              :loading="fieldLoading"
              @change="row.model === 'projectFieldId' && loadFeishuProjects()"
            >
              <el-option
                v-for="field in feishuFieldOptions"
                :key="`${row.model}-${field.id}`"
                :label="`${field.name}（${field.typeLabel}）`"
                :value="field.id"
              >
                <div class="select-option-row">
                  <span>{{ field.name }} · {{ field.typeLabel }}</span>
                  <small>{{ field.id }}</small>
                </div>
              </el-option>
            </el-select>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item v-if="!isAiOnly" title="飞书人员与项目映射" name="mapping">
        <div class="field-grid">
          <div class="field">
            <label>汇报人 userId</label>
            <el-input v-model="config.feishuForm.reporterUserId" placeholder="飞书汇报人 userId" />
          </div>
          <div class="field">
            <label>汇报人名称</label>
            <el-input v-model="config.feishuForm.reporterName" placeholder="留空使用上方汇报人" />
          </div>
          <div class="field">
            <label>头像地址</label>
            <el-input v-model="config.feishuForm.reporterAvatarUrl" placeholder="飞书头像地址，可选" />
          </div>
          <div class="field field-span-3">
            <label>所属项目名称</label>
            <el-input v-model="config.feishuForm.projectName" placeholder="所属项目名称，仅用于备注" />
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
