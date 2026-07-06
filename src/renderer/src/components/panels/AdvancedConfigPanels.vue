<script setup lang="ts">
import { computed } from 'vue';
import { Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
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
  fieldLoading,
  createAiProfile,
  selectAiProfile,
  removeAiProfile,
  rememberAiBaseUrlOption,
  rememberAiModelOption,
  removeAiBaseUrlOption,
  removeAiModelOption,
  loadFeishuFields,
  loadFeishuProjects,
} = assistant;

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
</script>

<template>
  <div class="config-block">
    <SectionTitle :title="sectionTitle" :subtitle="sectionSubtitle">
      <template #extra>
        <el-button v-if="isAiOnly" :icon="Plus" type="primary" plain @click="createAiProfile">新增配置</el-button>
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
        <div class="field-helper-row">
          <div>
            <strong>{{ activeAiProfile.name || '未命名配置' }}</strong>
            <span>生成日报时会默认使用当前选中的 AI 配置，也可以在生成页临时切换。</span>
          </div>
          <el-button :icon="Trash2" type="danger" plain :disabled="!canRemoveAiProfile" @click="removeAiProfile(activeAiProfile.id)">
            删除配置
          </el-button>
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
      </section>
    </div>

    <el-collapse v-else v-model="activePanels" class="advanced-collapse">
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
