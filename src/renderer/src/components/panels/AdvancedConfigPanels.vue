<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import SectionTitle from '@/components/common/SectionTitle.vue';

const assistant = useAssistant();
const {
  config,
  advancedConfigPanels,
  aiBaseUrlOptions,
  aiModelOptions,
  rememberAiBaseUrlOption,
  rememberAiModelOption,
  removeAiBaseUrlOption,
  removeAiModelOption,
} = assistant;
</script>

<template>
  <div class="config-block">
    <SectionTitle title="AI 接入配置" subtitle="配置 AI 模型与飞书连接信息" />
    <el-collapse v-model="advancedConfigPanels" class="advanced-collapse">
      <el-collapse-item title="AI 接入配置" name="ai">
        <div class="field-grid">
          <div class="field field-span-2">
            <label>接口地址</label>
            <el-select
              v-model="config.aiBaseUrl"
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
              v-model="config.aiModel"
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
            <el-input v-model="config.aiApiKey" type="password" show-password placeholder="API Key" />
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item title="飞书连接配置" name="feishu">
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

      <el-collapse-item title="飞书人员与项目映射" name="mapping">
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
