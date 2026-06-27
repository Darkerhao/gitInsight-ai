<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Bell,
  Database,
  Edit3,
  FolderArchive,
  KeyRound,
  Link,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { config, projectOptions, saveSettings } = assistant;

const activeTab = ref('basic');
const includeDataOverview = ref(true);
const includeCharts = ref(true);
const exportMarkdown = ref(true);

const timezoneOptions = [
  '(GMT+08:00) 北京，重庆，香港特别行政区，乌鲁木齐',
  '(GMT+00:00) 伦敦，都柏林',
  '(GMT+09:00) 东京，首尔',
];

const projectType = computed(() => {
  const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
  return selected?.name || config.feishuForm.projectName || '工蜂业务融合一体化平台';
});

const settingNotes = [
  { icon: Settings, title: '基础设置', desc: '配置系统基本信息、日期时间、文件存储等基础选项' },
  { icon: KeyRound, title: '权限管理', desc: '管理用户角色与权限，控制各功能模块的访问权限' },
  { icon: Link, title: '集成配置', desc: '配置 AI 接入、飞书连接等第三方服务集成' },
  { icon: Bell, title: '通知设置', desc: '配置系统通知、任务提醒和消息推送规则' },
  { icon: ShieldCheck, title: '安全设置', desc: '管理登录安全、数据加密和操作审计等安全选项' },
  { icon: Database, title: '日志管理', desc: '查看和管理系统运行日志与操作记录' },
];

async function clearCache() {
  await ElMessageBox.confirm('确认清除系统缓存？该操作不会影响已生成日报。', '清除缓存', { type: 'warning' });
  ElMessage.success('缓存已清理');
}

async function resetSettings() {
  await ElMessageBox.confirm('确认将系统设置恢复为默认配置？', '重置配置', { type: 'warning' });
  config.autoSync.enabled = false;
  config.autoSync.time = '18:30';
  config.feishuForm.defaultWorkHours = 8;
  ElMessage.success('已恢复默认配置，请保存后生效');
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="系统设置" subtitle="管理系统配置、权限控制、集成设置等" />

    <div class="content-grid has-right-panel">
      <section class="surface-card settings-panel">
        <el-tabs v-model="activeTab" class="clean-tabs">
          <el-tab-pane label="基础设置" name="basic" />
          <el-tab-pane label="权限管理" name="permission" />
          <el-tab-pane label="集成配置" name="integration" />
          <el-tab-pane label="通知设置" name="notify" />
          <el-tab-pane label="安全设置" name="security" />
          <el-tab-pane label="日志管理" name="logs" />
        </el-tabs>

        <div class="settings-section">
          <div class="panel-head">
            <h3>系统信息</h3>
            <el-button :icon="Edit3" link type="primary">编辑</el-button>
          </div>
          <div class="field-grid two-columns">
            <div class="field">
              <label>系统名称</label>
              <el-input model-value="AI日报助手" />
            </div>
            <div class="field">
              <label>系统描述</label>
              <el-input model-value="基于配置自动生成日报，支持预览、导出和同步飞书" />
            </div>
            <div class="field">
              <label>系统版本</label>
              <el-input model-value="v1.0.0" />
            </div>
            <div class="field">
              <label>时区设置</label>
              <el-select :model-value="timezoneOptions[0]">
                <el-option v-for="item in timezoneOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="panel-head">
            <h3>日期与时间</h3>
            <el-button :icon="Edit3" link type="primary">编辑</el-button>
          </div>
          <div class="field-grid four-columns">
            <div class="field">
              <label>日期格式</label>
              <el-select model-value="YYYY-MM-DD">
                <el-option label="YYYY-MM-DD" value="YYYY-MM-DD" />
                <el-option label="YYYY/MM/DD" value="YYYY/MM/DD" />
              </el-select>
            </div>
            <div class="field">
              <label>时间格式</label>
              <el-select model-value="24 小时制">
                <el-option label="24 小时制" value="24 小时制" />
                <el-option label="12 小时制" value="12 小时制" />
              </el-select>
            </div>
            <div class="field">
              <label>周开始日</label>
              <el-select model-value="星期一">
                <el-option label="星期一" value="星期一" />
                <el-option label="星期日" value="星期日" />
              </el-select>
            </div>
            <div class="field">
              <label>默认日期范围</label>
              <el-select model-value="近7天">
                <el-option label="近7天" value="近7天" />
                <el-option label="近30天" value="近30天" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="panel-head">
            <h3>文件与存储</h3>
            <el-button :icon="Edit3" link type="primary">编辑</el-button>
          </div>
          <div class="field-grid three-columns">
            <div class="field">
              <label>生成文件保存路径</label>
              <el-input v-model="config.workspaceDir" placeholder="D:\\AIReport\\output" />
            </div>
            <div class="field">
              <label>临时文件清理周期</label>
              <el-select model-value="7天">
                <el-option label="7天" value="7天" />
                <el-option label="30天" value="30天" />
              </el-select>
            </div>
            <div class="field">
              <label>最大文件大小限制</label>
              <el-select model-value="100MB">
                <el-option label="100MB" value="100MB" />
                <el-option label="500MB" value="500MB" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="panel-head">
            <h3>报告生成默认配置</h3>
            <el-button :icon="Edit3" link type="primary">编辑</el-button>
          </div>
          <div class="field-grid two-columns">
            <div class="field">
              <label>默认报告模板</label>
              <el-select model-value="默认配置（8号）">
                <el-option label="默认配置（8号）" value="默认配置（8号）" />
              </el-select>
            </div>
            <div class="field">
              <label>默认项目类型</label>
              <el-select :model-value="projectType">
                <el-option :label="projectType" :value="projectType" />
              </el-select>
            </div>
          </div>
          <div class="switch-grid">
            <div class="switch-line">
              <span>包含数据概览</span>
              <el-switch v-model="includeDataOverview" />
            </div>
            <div class="switch-line">
              <span>包含图表</span>
              <el-switch v-model="includeCharts" />
            </div>
            <div class="switch-line">
              <span>默认导出为 Markdown</span>
              <el-switch v-model="exportMarkdown" />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>系统操作</h3>
          <div class="operation-grid">
            <button class="operation-card" @click="clearCache">
              <Trash2 :size="18" />
              <strong>清除缓存</strong>
              <span>清除系统缓存数据，不影响已生成的日报</span>
            </button>
            <button class="operation-card" @click="resetSettings">
              <RotateCcw :size="18" />
              <strong>重置系统配置</strong>
              <span>将系统设置恢复为默认配置</span>
            </button>
          </div>
          <div class="danger-action">
            <el-button :icon="Trash2" type="danger" plain>清理配置</el-button>
          </div>
        </div>

        <div class="button-row end">
          <el-button :icon="Save" type="primary" @click="saveSettings">保存设置</el-button>
        </div>
      </section>

      <aside class="view-stack">
        <section class="surface-card">
          <h3>系统设置说明</h3>
          <p class="muted-text">在这里，您可以对系统的各项功能进行全局配置和管理。</p>
          <div class="settings-note-list">
            <div v-for="item in settingNotes" :key="item.title" class="settings-note-item">
              <component :is="item.icon" :size="18" />
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.desc }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="surface-card help-card">
          <FolderArchive :size="18" />
          <div>
            <strong>需要帮助？</strong>
            <span>查看系统设置使用指南，了解更多配置说明</span>
          </div>
          <el-button plain>查看帮助文档</el-button>
        </section>
      </aside>
    </div>
  </div>
</template>
