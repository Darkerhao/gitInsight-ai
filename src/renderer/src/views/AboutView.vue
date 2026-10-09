<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowDownToLine, CheckCircle2, CircleAlert, ExternalLink, Github, Info, RefreshCw, RotateCw } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAppUpdates } from '@/composables/useAppUpdates';
import { APP_EDITION_LABEL, APP_PRODUCT_NAME } from '@shared/edition';
import type { AppLink, AppUpdateStatus } from '@shared/appUpdate';

const updates = useAppUpdates();
const { state, requestError } = updates;
const checking = ref(false);
const saving = ref(false);
const installing = ref(false);
const status = computed(() => state.value?.status ?? 'idle');
const statusCopy = computed(() => {
  const version = state.value?.latestVersion;
  const titles: Record<AppUpdateStatus, string> = {
    idle: '随时检查，让应用保持最新',
    checking: '正在检查更新…',
    'not-available': '当前已是最新版本',
    available: `发现新版本 v${version}`,
    downloading: `正在下载 v${version}`,
    downloaded: `新版本 v${version} 已准备就绪`,
    error: '更新暂未完成',
    unsupported: '当前环境暂不支持应用内更新',
  };
  return titles[status.value];
});
const statusIcon = computed(() => {
  if (status.value === 'error') return CircleAlert;
  if (status.value === 'downloaded' || status.value === 'not-available') return CheckCircle2;
  if (status.value === 'downloading' || status.value === 'available') return ArrowDownToLine;
  return Info;
});
const statusDescription = computed(() => {
  if (state.value?.message) return state.value.message;
  if (status.value === 'downloaded') return state.value?.autoUpdate
    ? '退出应用时会自动安装，也可以现在重启完成更新。'
    : '请先保存正在编辑的内容，再重启应用完成安装。';
  if (status.value === 'downloading') return state.value?.autoUpdate
    ? '正在后台下载，你可以继续使用应用。'
    : '本次下载会继续，完成后由你手动安装。';
  if (status.value === 'available') return '下载并安装新版本，现有配置和本地数据会保留。';
  if (status.value === 'checking') return '正在获取最新的正式版本信息。';
  if (status.value === 'not-available') return '已安装当前发行版的最新正式版本。';
  return '在这里完成版本检查、下载和安装。';
});
const lastChecked = computed(() => state.value?.lastCheckedAt
  ? new Date(state.value.lastCheckedAt).toLocaleString('zh-CN', { hour12: false }) : '尚未检查');
const canDownload = computed(() => state.value?.supported && (status.value === 'available'
  || (status.value === 'error' && Boolean(state.value.latestVersion))));
const progressText = computed(() => {
  const progress = state.value?.progress;
  if (!progress) return '正在准备下载…';
  return `${(progress.transferred / 1048576).toFixed(1)} / ${(progress.total / 1048576).toFixed(1)} MB · ${(progress.bytesPerSecond / 1048576).toFixed(1)} MB/s`;
});
const releaseNotes = computed(() => {
  const notes = state.value?.releaseNotes || '';
  // GitHub's release feed contains HTML. Extract text without injecting remote markup.
  const document = new DOMParser().parseFromString(notes, 'text/html');
  document.querySelectorAll('script, style').forEach(node => node.remove());
  document.querySelectorAll('p, li, h1, h2, h3, h4, br').forEach(node => node.append('\n'));
  return document.body.textContent?.trim() || '';
});

async function check() {
  checking.value = true;
  try { await updates.check(); } finally { checking.value = false; }
}

async function setAutomatic(value: string | number | boolean) {
  saving.value = true;
  try { await updates.setAutomatic(value === true); } finally { saving.value = false; }
}

async function install() {
  try {
    await ElMessageBox.confirm('应用将关闭并安装新版本，请先保存正在编辑的日报和配置。', '重启更新', {
      confirmButtonText: '重启安装', cancelButtonText: '稍后', type: 'info',
    });
    installing.value = true;
    await window.api.installAppUpdate();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '无法安装更新，请重试。');
  } finally {
    installing.value = false;
  }
}

async function openLink(link: AppLink) {
  try { await window.api.openAppLink(link); }
  catch { ElMessage.error('无法打开链接，请稍后重试。'); }
}
</script>

<template>
  <div class="view-stack app-about-view">
    <PageHeader title="关于" subtitle="版本信息与应用更新" />

    <el-alert v-if="requestError" :title="requestError" type="error" show-icon :closable="false">
      <el-button link type="primary" @click="updates.refresh">重新加载更新状态</el-button>
    </el-alert>

    <section class="surface-card app-about-card" aria-label="关于码迹 AI">
      <div class="app-about-head">
        <div class="app-about-brand">
          <img src="../assets/logo.png" alt="码迹 AI" width="64" height="64" />
          <div>
            <h2>{{ APP_PRODUCT_NAME }}</h2>
            <div class="app-about-version">
              <span>{{ state ? `版本 v${state.currentVersion}` : '正在读取版本…' }}</span>
              <el-tag size="small" effect="plain">{{ APP_EDITION_LABEL }}</el-tag>
            </div>
          </div>
        </div>
        <el-button
          :icon="RefreshCw"
          :loading="checking || status === 'checking'"
          :disabled="!state?.supported || status === 'downloading' || status === 'downloaded'"
          @click="check"
        >检查更新</el-button>
      </div>

      <div class="app-about-update">
        <div class="app-about-status" :class="`is-${status}`">
          <component :is="statusIcon" :size="24" class="app-about-status-icon" aria-hidden="true" />
          <div class="app-about-status-copy" role="status" aria-live="polite">
            <h3>{{ statusCopy }}</h3>
            <p>{{ statusDescription }}</p>
          </div>
          <el-button v-if="canDownload" type="primary" :icon="ArrowDownToLine" @click="updates.download">
            {{ status === 'error' ? '重新下载' : '下载更新' }}
          </el-button>
          <el-button v-if="status === 'downloaded'" type="primary" :icon="RotateCw" :loading="installing" @click="install">
            重启安装
          </el-button>
        </div>

        <div v-if="status === 'downloading'" class="app-about-progress" aria-label="更新下载进度">
          <el-progress :percentage="Math.round(state?.progress?.percent || 0)" :stroke-width="8" />
          <span>{{ progressText }}</span>
        </div>

        <details v-if="releaseNotes" class="app-about-notes" open>
          <summary>
            v{{ state?.latestVersion }} 更新说明
            <span v-if="state?.releaseDate"> · {{ new Date(state.releaseDate).toLocaleDateString('zh-CN') }}</span>
          </summary>
          <pre>{{ releaseNotes }}</pre>
        </details>

        <div class="app-about-automatic">
          <div>
            <h3>自动更新</h3>
            <p v-if="!state?.supported">使用支持的安装包后，可开启自动更新。</p>
            <p v-else>{{ state.autoUpdate ? '启动后自动检查并下载，在退出应用时安装。' : '已关闭自动检查与退出安装，仍可手动更新。' }}</p>
          </div>
          <el-switch
            :model-value="Boolean(state?.supported && state.autoUpdate)"
            :loading="saving"
            :disabled="!state?.supported"
            aria-label="自动更新"
            @change="setAutomatic"
          />
        </div>
        <p class="app-about-last-check">上次检查：{{ lastChecked }}</p>
      </div>

      <div class="app-about-links">
        <el-button :icon="Github" @click="openLink('home')">项目主页</el-button>
        <el-button :icon="ExternalLink" @click="openLink('releases')">更新日志</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.app-about-view { width: 100%; max-width: 1080px; margin: 0 auto; }
.app-about-card { overflow: hidden; padding: 0; }
.app-about-head, .app-about-brand, .app-about-version, .app-about-status, .app-about-automatic, .app-about-links {
  display: flex;
  align-items: center;
}
.app-about-head { justify-content: space-between; gap: 24px; padding: 28px; }
.app-about-brand { gap: 18px; min-width: 0; }
.app-about-brand img { flex-shrink: 0; border-radius: 16px; }
.app-about-brand h2 { margin: 0 0 8px; font-size: 22px; line-height: 1.4; }
.app-about-version { gap: 12px; flex-wrap: wrap; color: var(--c-text-muted); font-size: 14px; }
.app-about-update { padding: 26px 28px 20px; border-top: 1px solid var(--c-border); }
.app-about-status { align-items: flex-start; gap: 14px; }
.app-about-status-icon { flex-shrink: 0; margin-top: 2px; color: var(--c-text-muted); }
.app-about-status-copy { flex: 1; min-width: 0; }
.app-about-status h3, .app-about-automatic h3 { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.7; }
.app-about-status p, .app-about-automatic p { margin: 5px 0 0; color: var(--c-text-muted); font-size: 13px; line-height: 1.7; }
.is-downloaded .app-about-status-icon, .is-not-available .app-about-status-icon { color: var(--c-primary); }
.is-error .app-about-status-icon { color: var(--tone-red); }
.app-about-progress { margin: 20px 0 0 38px; }
.app-about-progress > span { color: var(--c-text-muted); font-size: 12px; }
.app-about-notes { margin: 20px 0 0 38px; padding: 14px 18px; border-radius: var(--radius-block); background: var(--c-surface-muted); }
.app-about-notes summary { cursor: pointer; font-size: 13px; font-weight: 600; }
.app-about-notes pre { max-height: 260px; overflow: auto; margin: 14px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 13px; line-height: 1.8; color: var(--c-text-muted); }
.app-about-automatic { justify-content: space-between; gap: 24px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--c-border); }
.app-about-last-check { margin: 16px 0 0; color: var(--c-text-faint); font-size: 12px; }
.app-about-links { flex-wrap: wrap; gap: 12px; padding: 18px 28px; background: var(--c-surface-muted); border-top: 1px solid var(--c-border); }
.app-about-links .el-button + .el-button { margin-left: 0; }
@media (max-width: 640px) {
  .app-about-head { flex-wrap: wrap; padding: 20px; }
  .app-about-brand h2 { font-size: 18px; }
  .app-about-update { padding: 20px; }
  .app-about-status { flex-wrap: wrap; }
  .app-about-status-copy { flex-basis: calc(100% - 38px); }
  .app-about-progress, .app-about-notes { margin-left: 0; }
  .app-about-links { padding: 16px 20px; }
}
</style>
