<script setup lang="ts">
import { computed, ref } from 'vue';
import { CheckCircle2, Clock3, FolderGit2, ListChecks, Pencil, Pin, Plus, Search, Trash2 } from 'lucide-vue-next';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { RepoInfo } from '@shared/types';
import {
  getRepoDisplayName as resolveRepoDisplayName,
  matchesRepoKeyword,
} from '@shared/repositoryName';

type DateShortcut = 'today' | 'yesterday' | 'rolling' | 'custom';
type SetupStatus = 'success' | 'pending';

interface ReportFormState {
  date: string;
  startDateTime: string;
  endDateTime: string;
}

interface AiProfileOption {
  label: string;
  value: string;
  model: string;
  baseUrl: string;
}

const props = defineProps<{
  activeAiProfileId: string;
  form: ReportFormState;
  setupStatus: SetupStatus;
  setupStatusLabel: string;
  selectedRepoSummary: string;
  repoContextText: string;
  reportRangeLabel: string;
  readinessProgressLabel: string;
  readinessDetail: string;
  selectedRepos: RepoInfo[];
  selectedRepoPaths: string[];
  sortedRepos: RepoInfo[];
  repoDisplayNames: Record<string, string>;
  aiProfileOptions: AiProfileOption[];
  dateShortcut: DateShortcut;
  isRepoSelected: (path: string) => boolean;
  isRepoPinned: (path: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'choose-workspace'): void;
  (e: 'select-ai-profile', value: string): void;
  (e: 'report-date-change', value: string): void;
  (e: 'start-date-time-change', value: string): void;
  (e: 'end-date-time-change', value: string): void;
  (e: 'set-date-shortcut', value: DateShortcut): void;
  (e: 'toggle-repo', value: string): void;
  (e: 'toggle-repo-pin', value: string): void;
  (e: 'rename-repo', value: RepoInfo): void;
  (e: 'remove-repo', value: RepoInfo): void;
}>();

const repoKeyword = ref('');
const filteredRepos = computed(() => props.sortedRepos.filter((repo) => matchesRepoKeyword(repo, props.repoDisplayNames, repoKeyword.value)));

function displayName(repo: RepoInfo) {
  return resolveRepoDisplayName(repo, props.repoDisplayNames);
}

function repoMeta(repo: RepoInfo) {
  const name = displayName(repo);
  return name === repo.name ? repo.path : `${repo.name} · ${repo.path}`;
}

function handleAiProfileChange(value: string) {
  emit('select-ai-profile', value);
}

function handleReportDateChange(value: string | null) {
  if (value) emit('report-date-change', value);
}

function handleStartDateTimeChange(value: string | null) {
  if (value) emit('start-date-time-change', value);
}

function handleEndDateTimeChange(value: string | null) {
  if (value) emit('end-date-time-change', value);
}
</script>

<template>
  <section class="surface-card step-card report-setup-card">
    <div class="step-title with-action">
      <div>
        <span>1</span>
        <strong>选择生成范围</strong>
      </div>
      <StatusBadge :status="setupStatus" :label="setupStatusLabel" />
    </div>

    <div class="report-context-bar">
      <div class="report-context-item">
        <FolderGit2 :size="16" />
        <span>
          <strong>{{ selectedRepoSummary }}</strong>
          <small>{{ repoContextText }}</small>
        </span>
      </div>
      <div class="report-context-item">
        <Clock3 :size="16" />
        <span>
          <strong>提交范围</strong>
          <small>{{ reportRangeLabel }}</small>
        </span>
      </div>
      <div class="report-context-item">
        <ListChecks :size="16" />
        <span>
          <strong>{{ readinessProgressLabel }}</strong>
          <small>{{ readinessDetail }}</small>
        </span>
      </div>
    </div>

    <div class="field-grid">
      <div class="field field-span-3 repo-picker-field">
        <label>选择仓库</label>
        <el-popover placement="bottom-start" trigger="click" :width="760" popper-class="repo-picker-popper">
          <template #reference>
            <el-button class="repo-picker-trigger">
              <div class="repo-picker-trigger-copy">
                <strong>{{ selectedRepoSummary }}</strong>
                <span>{{ selectedRepos.length ? selectedRepos.map((repo) => repo.name).join('、') : '支持多仓库汇总生成研发日报' }}</span>
              </div>
              <small>{{ selectedRepoPaths.length }}/{{ sortedRepos.length }}</small>
            </el-button>
          </template>

          <div class="repo-picker-panel">
            <div class="repo-picker-head">
              <div>
                <strong>仓库选择</strong>
                <span>当前日报会基于已选仓库的提交记录生成</span>
              </div>
              <el-button :icon="Plus" type="primary" plain @click="emit('choose-workspace')">添加仓库</el-button>
            </div>

            <el-input v-model="repoKeyword" :prefix-icon="Search" clearable placeholder="搜索显示名称、仓库原名或路径" />

            <div class="repo-picker-list">
              <el-button v-if="!sortedRepos.length" class="repo-picker-empty" plain @click="emit('choose-workspace')">
                暂无仓库，点击选择工作目录
              </el-button>

              <div
                v-for="repo in filteredRepos"
                :key="repo.path"
                class="repo-picker-item"
                :class="{ active: isRepoSelected(repo.path), pinned: isRepoPinned(repo.path) }"
              >
                <el-button class="repo-picker-main" @click="emit('toggle-repo', repo.path)">
                  <span class="repo-picker-check">
                    <CheckCircle2 v-if="isRepoSelected(repo.path)" :size="16" />
                  </span>
                  <span class="repo-picker-copy">
                    <strong>{{ displayName(repo) }}</strong>
                    <small>{{ repoMeta(repo) }}</small>
                  </span>
                </el-button>

                <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
                  <el-button
                    class="repo-picker-icon"
                    :class="{ active: isRepoPinned(repo.path) }"
                    :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${displayName(repo)}` : `置顶 ${displayName(repo)}`"
                    :aria-pressed="isRepoPinned(repo.path)"
                    plain
                    @click.stop="emit('toggle-repo-pin', repo.path)"
                  >
                    <Pin :size="15" />
                  </el-button>
                </el-tooltip>

                <el-tooltip content="重命名仓库" placement="top">
                  <el-button class="repo-picker-icon" :aria-label="`重命名 ${displayName(repo)}`" plain @click.stop="emit('rename-repo', repo)">
                    <Pencil :size="15" />
                  </el-button>
                </el-tooltip>

                <el-tooltip content="从列表移除" placement="top">
                  <el-button class="repo-picker-icon danger" :aria-label="`移除 ${displayName(repo)}`" plain @click.stop="emit('remove-repo', repo)">
                    <Trash2 :size="15" />
                  </el-button>
                </el-tooltip>
              </div>

              <div v-if="sortedRepos.length && !filteredRepos.length" class="repo-picker-empty">
                未找到匹配仓库
              </div>
            </div>
          </div>
        </el-popover>
      </div>

      <div class="field field-span-3">
        <label>AI 配置</label>
        <el-select :model-value="activeAiProfileId" placeholder="选择 AI 配置" @change="handleAiProfileChange">
          <el-option v-for="item in aiProfileOptions" :key="item.value" :label="item.label" :value="item.value">
            <div class="select-option-row">
              <span>{{ item.label }}</span>
              <small>{{ item.model || item.baseUrl || '未配置模型' }}</small>
            </div>
          </el-option>
        </el-select>
      </div>

      <div class="field">
        <label>日报日期</label>
        <el-date-picker
          :model-value="form.date"
          type="date"
          value-format="YYYY-MM-DD"
          :clearable="false"
          @update:model-value="handleReportDateChange"
        />
      </div>
      <div class="field">
        <label>提交开始</label>
        <el-date-picker
          :model-value="form.startDateTime"
          type="datetime"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :clearable="false"
          placeholder="开始时间"
          @update:model-value="handleStartDateTimeChange"
        />
      </div>
      <div class="field">
        <label>提交结束</label>
        <el-date-picker
          :model-value="form.endDateTime"
          type="datetime"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :clearable="false"
          placeholder="结束时间"
          @update:model-value="handleEndDateTimeChange"
        />
      </div>
    </div>

    <div class="segmented-actions">
      <el-button class="segmented-action" :class="{ active: dateShortcut === 'today' }" plain @click="emit('set-date-shortcut', 'today')">
        今天
      </el-button>
      <el-button class="segmented-action" :class="{ active: dateShortcut === 'yesterday' }" plain @click="emit('set-date-shortcut', 'yesterday')">
        昨天
      </el-button>
      <el-button class="segmented-action" :class="{ active: dateShortcut === 'rolling' }" plain @click="emit('set-date-shortcut', 'rolling')">
        昨日 9 点至现在
      </el-button>
      <el-button class="segmented-action" :class="{ active: dateShortcut === 'custom' }" plain @click="emit('set-date-shortcut', 'custom')">
        自定义范围
      </el-button>
    </div>
  </section>
</template>
