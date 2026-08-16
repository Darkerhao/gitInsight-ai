<script setup lang="ts">
import { computed } from 'vue';
import { BrainCog, ClipboardCopy, Download, FileSearch, History, RefreshCw, Sparkles, X } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import WeeklyReflectionActionPanel from '@/components/reflection/WeeklyReflectionActionPanel.vue';
import { useWeeklyReflection } from '@/composables/useWeeklyReflection';

const emit = defineEmits<{
  (event: 'navigate', value: string): void;
}>();

const {
  projects, history, sources, currentRecord, selectedSource, selectedProjectPath, dateRange, sourceScope,
  projectsLoading, sourcesLoading, historyLoading, generating, displayProjectName, publishedSourceCount,
  totalCommits, totalFiles, hasMultiProjectSource, activeAiProfileName, generateReflection, selectHistory,
  updateImprovementStatus, isActionSaving, copyReflection, exportReflection,
} = useWeeklyReflection();

const metadata = computed(() => currentRecord.value?.structuredJson ?? null);

function projectLabel(project: (typeof projects.value)[number]) {
  return project.name;
}

function sourceLabel(ref: string) {
  return currentRecord.value?.sourceReports.find((source) => source.ref === ref)?.date || ref;
}

function openSource(ref: string) {
  selectedSource.value = currentRecord.value?.sourceReports.find((source) => source.ref === ref) ?? null;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <div class="view-stack weekly-reflection-view atelier-page">
    <PageHeader title="项目周反思" subtitle="基于本周日报识别项目问题、工作优缺点和下一步调整动作">
      <template #actions>
        <el-button :icon="BrainCog" plain @click="emit('navigate', 'ai')">AI 设置</el-button>
      </template>
    </PageHeader>

    <section class="surface-card reflection-setup-panel">
      <div class="reflection-section-head">
        <div>
          <span class="eyebrow">01 · 分析范围</span>
          <h2>选择一个项目和一周日期</h2>
          <p>每天只采用一份有效日报；同日存在多份时优先单项目日报，再取最新记录。</p>
        </div>
        <el-tag type="info" effect="plain">{{ activeAiProfileName }}</el-tag>
      </div>

      <div class="reflection-filter-grid">
        <div class="field">
          <label>项目</label>
          <el-select v-model="selectedProjectPath" filterable :loading="projectsLoading" placeholder="请选择有日报记录的项目">
            <el-option
              v-for="project in projects"
              :key="project.path"
              :label="projectLabel(project)"
              :value="project.path"
            >
              <span>{{ projectLabel(project) }}</span>
              <small>{{ project.reportCount }} 条日报</small>
            </el-option>
          </el-select>
        </div>
        <div class="field">
          <label>日期范围</label>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :clearable="false"
          />
        </div>
        <div class="field">
          <label>日报来源</label>
          <el-segmented
            v-model="sourceScope"
            :options="[
              { label: '全部有效日报', value: 'all' },
              { label: '仅已提交飞书', value: 'published' },
            ]"
          />
        </div>
      </div>

      <div v-loading="sourcesLoading" class="reflection-source-summary">
        <div><strong>{{ sources.length }}</strong><span>有效日报</span></div>
        <div><strong>{{ publishedSourceCount }}</strong><span>已提交飞书</span></div>
        <div><strong>{{ totalCommits }}</strong><span>提交记录</span></div>
        <div><strong>{{ totalFiles }}</strong><span>影响文件</span></div>
      </div>

      <el-alert
        v-if="hasMultiProjectSource"
        class="reflection-source-alert"
        type="warning"
        :closable="false"
        title="当前范围包含多项目合并日报，AI 只会采用能够明确归属于当前项目的内容。"
      />

      <div class="reflection-source-strip">
        <span class="reflection-source-title">{{ displayProjectName }}</span>
        <div v-if="sources.length" class="reflection-source-tags">
          <el-button v-for="source in sources" :key="source.reportId" link type="primary" @click="selectedSource = source">
            {{ source.date }}
            <el-tag v-if="source.published" size="small" type="success" effect="plain">已提交</el-tag>
          </el-button>
        </div>
        <span v-else class="muted-text">当前范围暂无可分析日报</span>
        <el-button
          class="reflection-generate-button"
          type="primary"
          :icon="Sparkles"
          :loading="generating"
          :disabled="!sources.length"
          @click="generateReflection"
        >
          生成本周反思
        </el-button>
      </div>
    </section>

    <section class="reflection-workspace">
      <div class="surface-card reflection-result-panel">
        <div class="reflection-section-head compact">
          <div>
            <span class="eyebrow">02 · 反思结果</span>
            <h2>{{ currentRecord?.projectName || '等待生成周反思' }}</h2>
            <p v-if="currentRecord">{{ currentRecord.startDate }} 至 {{ currentRecord.endDate }} · {{ currentRecord.sourceReports.length }} 条日报</p>
          </div>
          <div class="reflection-result-actions">
            <el-button :icon="RefreshCw" plain :disabled="!sources.length" :loading="generating" @click="generateReflection">重新生成</el-button>
            <el-button :icon="ClipboardCopy" plain :disabled="!currentRecord" @click="copyReflection">复制</el-button>
            <el-button :icon="Download" type="primary" plain :disabled="!currentRecord" @click="exportReflection">导出</el-button>
          </div>
        </div>

        <div v-if="metadata" class="reflection-result-content">
          <div class="reflection-overview">
            <strong>{{ metadata.title }}</strong>
            <p>{{ metadata.overview }}</p>
          </div>

          <div class="reflection-analysis-grid">
            <section>
              <h3>做得好的地方</h3>
              <div v-if="metadata.strengths.length" class="reflection-point-list">
                <article v-for="item in metadata.strengths" :key="item.title">
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.detail }}</p>
                  <div class="reflection-evidence-links">
                    <el-button v-for="ref in item.evidenceRefs" :key="ref" link type="primary" @click="openSource(ref)">{{ sourceLabel(ref) }}</el-button>
                  </div>
                </article>
              </div>
              <p v-else class="muted-text">暂无足够证据</p>
            </section>

            <section>
              <h3>发现的问题</h3>
              <div v-if="metadata.problems.length" class="reflection-point-list">
                <article v-for="item in metadata.problems" :key="item.title">
                  <div class="reflection-problem-title">
                    <strong>{{ item.title }}</strong>
                    <el-tag v-if="item.previousProblemRef" size="small" type="warning" effect="plain">重复问题</el-tag>
                  </div>
                  <p>{{ item.detail }}</p>
                  <small>影响：{{ item.impact }}</small>
                  <div class="reflection-evidence-links">
                    <el-button v-for="ref in item.evidenceRefs" :key="ref" link type="primary" @click="openSource(ref)">{{ sourceLabel(ref) }}</el-button>
                  </div>
                </article>
              </div>
              <p v-else class="muted-text">暂无足够证据</p>
            </section>

            <section>
              <h3>工作中的不足</h3>
              <div v-if="metadata.shortcomings.length" class="reflection-point-list">
                <article v-for="item in metadata.shortcomings" :key="item.title">
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.detail }}</p>
                  <div class="reflection-evidence-links">
                    <el-button v-for="ref in item.evidenceRefs" :key="ref" link type="primary" @click="openSource(ref)">{{ sourceLabel(ref) }}</el-button>
                  </div>
                </article>
              </div>
              <p v-else class="muted-text">暂无足够证据</p>
            </section>
          </div>

          <WeeklyReflectionActionPanel
            v-if="currentRecord"
            aria-label="后续改进动作"
            :record="currentRecord"
            :saving="isActionSaving"
            @open-source="openSource"
            @update-status="updateImprovementStatus"
          />

          <section class="reflection-focus-section">
            <h3>下周重点</h3>
            <ol>
              <li v-for="item in metadata.nextWeekFocus" :key="item">{{ item }}</li>
            </ol>
          </section>
        </div>

        <div v-else class="reflection-empty-state">
          <FileSearch :size="34" />
          <strong>尚未生成周反思</strong>
          <span>选择项目和日期范围后，系统会基于真实日报生成证据化分析。</span>
        </div>
      </div>

      <aside class="surface-card reflection-history-panel">
        <div class="reflection-section-head compact">
          <div>
            <span class="eyebrow">03 · 历史记录</span>
            <h2>最近反思</h2>
          </div>
          <History :size="19" />
        </div>
        <div v-loading="historyLoading" class="reflection-history-list">
          <button
            v-for="record in history"
            :key="record.id"
            type="button"
            :class="{ active: currentRecord?.id === record.id }"
            @click="selectHistory(record)"
          >
            <strong>{{ record.projectName }}</strong>
            <span>{{ record.startDate }} 至 {{ record.endDate }}</span>
            <small>{{ record.sourceReports.length }} 条日报 · {{ formatDateTime(record.updatedAt) }}</small>
          </button>
          <div v-if="!historyLoading && !history.length" class="reflection-history-empty">生成后会保存在这里</div>
        </div>
      </aside>
    </section>

    <el-drawer
      :model-value="Boolean(selectedSource)"
      append-to-body
      direction="rtl"
      size="min(520px, 94vw)"
      :with-header="false"
      body-class="reflection-source-drawer-body"
      @update:model-value="(value: boolean) => { if (!value) selectedSource = null; }"
    >
      <div v-if="selectedSource" class="reflection-source-detail">
        <div class="panel-head">
          <div>
            <h3>{{ selectedSource.date }} 日报</h3>
            <p>{{ selectedSource.projectName }} · {{ selectedSource.commitsCount }} 条提交</p>
          </div>
          <el-button :icon="X" circle text aria-label="关闭日报详情" @click="selectedSource = null" />
        </div>
        <div class="reflection-source-detail-tags">
          <el-tag :type="selectedSource.published ? 'success' : 'info'" effect="plain">
            {{ selectedSource.published ? '已提交飞书' : '本地日报' }}
          </el-tag>
          <el-tag v-if="selectedSource.multiProject" type="warning" effect="plain">多项目来源</el-tag>
        </div>
        <pre>{{ selectedSource.report }}</pre>
      </div>
    </el-drawer>
  </div>
</template>
