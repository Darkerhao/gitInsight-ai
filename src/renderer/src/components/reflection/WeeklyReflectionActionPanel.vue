<script setup lang="ts">
import type {
  WeeklyReflectionActionStatus,
  WeeklyReflectionRecord,
} from '@shared/types';

const props = defineProps<{
  record: WeeklyReflectionRecord;
  saving: (action: string) => boolean;
}>();

const emit = defineEmits<{
  (event: 'open-source', ref: string): void;
  (event: 'update-status', action: string, status: WeeklyReflectionActionStatus): void;
}>();

const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '已完成', value: 'completed' },
  { label: '未完成', value: 'not_completed' },
];

function statusFor(action: string): WeeklyReflectionActionStatus {
  return props.record.actionStates.find((item) => item.action === action)?.status || 'pending';
}

function updateStatus(action: string, value: unknown) {
  if (value === 'pending' || value === 'completed' || value === 'not_completed') {
    emit('update-status', action, value);
  }
}

function statusLabel(status: WeeklyReflectionActionStatus) {
  return status === 'completed' ? '已完成' : status === 'not_completed' ? '未完成' : '待处理';
}

function statusType(status: WeeklyReflectionActionStatus) {
  return status === 'completed' ? 'success' : status === 'not_completed' ? 'danger' : 'info';
}

function priorityLabel(priority: 'high' | 'medium' | 'low') {
  return priority === 'high' ? '高' : priority === 'medium' ? '中' : '低';
}

function priorityType(priority: 'high' | 'medium' | 'low') {
  return priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'info';
}
</script>

<template>
  <section v-if="record.structuredJson.previousActionReviews.length" class="reflection-action-review-section">
    <h3>上周改进动作复盘</h3>
    <div class="reflection-action-review-list">
      <article v-for="review in record.structuredJson.previousActionReviews" :key="review.actionRef">
        <div class="reflection-action-review-head">
          <strong>{{ review.action }}</strong>
          <div>
            <el-tag size="small" effect="plain" :type="statusType(review.previousStatus)">
              上周标记：{{ statusLabel(review.previousStatus) }}
            </el-tag>
            <el-tag size="small" effect="plain" :type="statusType(review.suggestedStatus)">
              AI 建议：{{ statusLabel(review.suggestedStatus) }}
            </el-tag>
          </div>
        </div>
        <p>{{ review.assessment }}</p>
        <div v-if="review.evidenceRefs.length" class="reflection-evidence-links">
          <el-button v-for="ref in review.evidenceRefs" :key="ref" link type="primary" @click="emit('open-source', ref)">
            查看本期依据 {{ ref }}
          </el-button>
        </div>
        <small v-else>本期证据不足，保持待处理建议</small>
      </article>
    </div>
  </section>

  <section class="reflection-improvement-section">
    <h3>后续改进动作</h3>
    <div v-if="record.structuredJson.improvements.length" class="reflection-improvement-list">
      <article v-for="item in record.structuredJson.improvements" :key="item.action">
        <div class="reflection-improvement-head">
          <div>
            <el-tag :type="priorityType(item.priority)" size="small" effect="plain">
              {{ priorityLabel(item.priority) }}优先级
            </el-tag>
            <strong>{{ item.action }}</strong>
          </div>
          <el-segmented
            :model-value="statusFor(item.action)"
            :options="statusOptions"
            :disabled="saving(item.action)"
            @update:model-value="updateStatus(item.action, $event)"
          />
        </div>
        <p>{{ item.reason }}</p>
        <small>预期结果：{{ item.expectedOutcome }}</small>
        <div class="reflection-evidence-links">
          <el-button v-for="ref in item.evidenceRefs" :key="ref" link type="primary" @click="emit('open-source', ref)">
            查看日报 {{ ref }}
          </el-button>
        </div>
      </article>
    </div>
    <p v-else class="muted-text">暂无具体改进动作</p>
  </section>
</template>
