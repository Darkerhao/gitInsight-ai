<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { COIN_SHOP_ITEMS, type CoinShopItem } from '@shared/coinWorkshop';
import rainMarkup from '@/assets/focus/rain.svg?raw';
import cafeMarkup from '@/assets/focus/cafe.svg?raw';
import spaceMarkup from '@/assets/focus/space.svg?raw';
import rainScene from '@/assets/focus/rain.svg';
import cafeScene from '@/assets/focus/cafe.svg';
import spaceScene from '@/assets/focus/space.svg';
import { useFocusSpace } from '@/composables/useFocusSpace';

const props = defineProps<{ ownedItemIds: readonly string[]; balance: number; pending: string }>();
const emit = defineEmits<{ purchase: [item: CoinShopItem] }>();
const focus = useFocusSpace();
const { timer, time, sceneId, soundEnabled } = focus;
const scenes = COIN_SHOP_ITEMS.filter(item => item.kind === 'scene');
const artwork: Record<string, { image: string; markup: string; label: string; caption: string }> = {
  'scene-rain': { image: rainScene, markup: rainMarkup, label: 'AFTER HOURS', caption: '把喧嚣留在窗外，把时间留给自己。' },
  'scene-cafe': { image: cafeScene, markup: cafeMarkup, label: 'THE QUIET CORNER', caption: '暖光落在书页上，灵感慢慢发生。' },
  'scene-space': { image: spaceScene, markup: spaceMarkup, label: 'ORBITAL OBSERVATORY', caption: '世界很远，眼前的这一刻很近。' },
};
const previewId = ref(sceneId.value);
const sceneMarkup = computed(() => artwork[previewId.value]?.markup.replace('<svg ', '<svg class="focus-live" '));
const selected = computed(() => scenes.find(item => item.id === previewId.value)!);
const owned = (item: CoinShopItem) => item.price === 0 || props.ownedItemIds.includes(item.id);
const activeName = computed(() => scenes.find(item => item.id === sceneId.value)?.name);
const busy = computed(() => timer.status === 'running' || timer.status === 'paused');
watch(() => props.ownedItemIds, () => {
  const active = scenes.find(item => item.id === sceneId.value)!;
  if (!owned(active)) focus.selectScene('scene-desk');
}, { immediate: true });
</script>

<template>
  <section class="focus-space">
    <div class="focus-heading"><div><h2>给当下，留一段专注时间</h2><p>25 分钟专注 · 5 分钟休息。一次只做一件事。</p></div><label class="focus-sound"><input type="checkbox" :checked="soundEnabled" @change="focus.setSound(($event.target as HTMLInputElement).checked)" />完成提示音</label></div>
    <div class="focus-layout">
      <div class="focus-stage" :data-scene="previewId" aria-label="专注场景预览">
        <!-- Only bundled, trusted artwork is inserted here. -->
        <div v-if="artwork[previewId]" class="focus-art" :key="previewId" aria-hidden="true" v-html="sceneMarkup" />
        <template v-else><div class="focus-window" aria-hidden="true" /><div class="focus-desk" aria-hidden="true"><span class="focus-lamp" /><span class="focus-book" /><span class="focus-cup" /></div></template>
        <div class="focus-stage-top"><span class="focus-location"><i />{{ selected.name }}<small>{{ artwork[previewId]?.label ?? 'A SIMPLE START' }}</small></span><span>{{ previewId === sceneId ? '正在使用' : '场景预览' }}</span></div>
        <div class="focus-clock"><span class="focus-clock-rule" aria-hidden="true" />
          <span class="focus-phase">{{ timer.phase === 'focus' ? '专注时刻' : '休息时刻' }} · {{ ({ idle: '准备开始', running: '进行中', paused: '已暂停', completed: '已完成' })[timer.status] }}</span>
          <strong data-focus-time role="timer" aria-label="剩余时间">{{ time }}</strong>
          <p>{{ busy ? `当前使用 · ${activeName}` : timer.status === 'completed' ? '每一段投入，都值得被看见。' : '从这一刻，开始积累。' }}</p>
          <div v-if="previewId === sceneId" class="focus-controls">
            <el-button v-if="timer.status === 'idle'" type="primary" @click="focus.start('focus')">开始专注</el-button>
            <el-button v-if="timer.status === 'running'" type="primary" @click="focus.pause">暂停</el-button>
            <el-button v-if="timer.status === 'paused'" type="primary" @click="focus.resume">继续</el-button>
            <el-button v-if="busy" @click="focus.end">结束</el-button>
            <template v-if="timer.status === 'completed'">
              <el-button v-if="timer.phase === 'focus'" type="primary" @click="focus.start('break')">开始休息 · 5 分钟</el-button>
              <el-button :type="timer.phase === 'break' ? 'primary' : 'default'" @click="focus.start('focus')">再来一轮专注</el-button>
            </template>
          </div>
          <p v-else>场景预览 · 返回当前场景可操作计时</p>
        </div>
        <div class="focus-scene-caption"><span>{{ artwork[previewId]?.label ?? 'LESS, BUT BETTER' }}</span><p>{{ artwork[previewId]?.caption ?? '一张书桌，一件小事，一个好的开始。' }}</p></div>
        <div class="focus-preview-note" v-if="previewId !== sceneId">预览中 · 计时仍使用{{ activeName }}<button @click="previewId = sceneId">返回当前场景</button></div>
      </div>
      <aside class="focus-scenes" aria-label="选择专注场景">
        <div class="focus-scenes-title"><h3>选择你的空间</h3><span>永久拥有，随时回来</span></div>
        <article v-for="item in scenes" :key="item.id" class="focus-scene-card" :class="{ selected: previewId === item.id }" :data-product="item.id">
          <button class="focus-scene-select" :aria-pressed="previewId === item.id" :aria-label="`预览${item.name}`" @click="previewId = item.id"><span class="focus-scene-swatch" :data-scene="item.id"><img v-if="artwork[item.id]" :src="artwork[item.id].image" alt="" loading="lazy" /><span v-else class="focus-free-art" /><span class="focus-swatch-label">{{ artwork[item.id]?.label ?? 'ESSENTIAL' }}</span><span v-if="sceneId === item.id" class="focus-current-badge">使用中</span></span><span><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span></button>
          <div class="focus-scene-footer"><span>{{ item.price === 0 ? '免费体验' : owned(item) ? '已永久解锁' : `${item.price / 10000} 万码币` }}</span>
            <el-button v-if="owned(item)" size="small" :disabled="sceneId === item.id" @click="focus.selectScene(item.id); previewId = item.id">{{ sceneId === item.id ? '正在使用' : '使用场景' }}</el-button>
            <el-button v-else-if="previewId !== item.id" size="small" @click="previewId = item.id">预览场景</el-button>
            <el-button v-else size="small" type="primary" :loading="pending === `buy:${item.id}`" :disabled="Boolean(pending) || balance < item.price" @click="emit('purchase', item)">{{ balance < item.price ? `还差 ${(item.price - balance).toLocaleString('zh-CN')}` : '解锁场景' }}</el-button>
          </div>
        </article>
      </aside>
    </div>
    <p class="focus-footnote">切换页面，计时仍会继续；完成后会在应用内提醒。关闭应用将结束本次计时。场景仅改变画面，不含背景音乐。</p>
  </section>
</template>

<style scoped>
.focus-space { display: grid; gap: 22px; }
.focus-heading, .focus-scenes-title, .focus-scene-footer, .focus-stage-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.focus-heading h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -.5px; }
.focus-heading p { color: var(--c-text-muted); font-size: 13px; margin: 8px 0 0; }
.focus-sound { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--c-text-muted); }
.focus-sound input { accent-color: var(--c-primary); }
.focus-layout { display: grid; gap: 28px; }
.focus-stage { position: relative; overflow: hidden; height: clamp(480px, 43vw, 640px); border-radius: 20px; isolation: isolate; color: #f1ede5; background: #243832; }
.focus-art :deep(svg) { width: 100%; height: 100%; display: block; }
.focus-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -3; }
.focus-stage::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #07131880, transparent 72%), linear-gradient(0deg, #08121d9c, transparent 25%); z-index: -1; pointer-events: none; }
.focus-stage-top { padding: 28px 34px; font-size: 12px; }
.focus-location { display: flex; gap: 10px; align-items: center; letter-spacing: 2px; }
.focus-location i { width: 5px; height: 5px; border-radius: 50%; background: #e0c7a1; box-shadow: 0 0 12px #e0c7a155; }
.focus-location small { font-size: 8px; color: #ffffff70; letter-spacing: 2px; margin-left: 6px; }
.focus-stage-top > span:last-child { padding: 6px 12px; background: #07132033; border: 1px solid #ffffff25; border-radius: 20px; color: #e6e9e8; font-size: 10px; }
.focus-clock { position: absolute; left: 6%; top: 25%; width: 34%; text-align: left; }
.focus-clock-rule { display: block; height: 1px; width: 28px; background: #c7bda2; margin-bottom: 22px; }
.focus-phase { font-size: 10px; letter-spacing: 3px; color: #e1dfd3ba; }
.focus-clock strong { display: block; font-size: clamp(64px, 7.5vw, 110px); font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: -5px; margin: 16px 0 14px; line-height: 1; text-shadow: 0 4px 35px #08142130; }
.focus-clock p { font-size: 11px; color: #e1dfd3a6; line-height: 1.8; }
.focus-controls { display: flex; gap: 10px; margin-top: 27px; flex-wrap: wrap; }
.focus-controls .el-button { margin: 0; border-radius: 24px; min-width: 90px; height: 38px; background: #f4eee1; border: 1px solid #f4eee1; color: #27332e; box-shadow: none; font-size: 12px; }
.focus-controls .el-button:hover { background: #fff; border-color: #fff; }
.focus-controls .el-button + .el-button { color: #e9ede7; background: #ffffff0a; border-color: #ffffff30; }
.focus-scene-caption { position: absolute; left: 6%; bottom: 32px; }
.focus-scene-caption > span { font-size: 8px; letter-spacing: 3px; color: #e1d2b97d; }
.focus-scene-caption p { font-size: 12px; color: #efe7d1c9; letter-spacing: 1px; margin: 10px 0 0; }
.focus-preview-note { position: absolute; right: 28px; bottom: 32px; text-align: right; font-size: 10px; color: #dce5e4a6; line-height: 1.8; }
.focus-preview-note button { display: block; margin: 5px 0 0 auto; border: 0; border-bottom: 1px solid #ffffff50; padding: 0 0 3px; background: transparent; color: #eef1ed; font: inherit; cursor: pointer; }
.focus-scenes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.focus-scenes-title { grid-column: 1 / -1; margin-bottom: 2px; }
.focus-scenes-title h3 { font-size: 14px; margin: 0; font-weight: 600; }
.focus-scenes-title > span { font-size: 11px; color: var(--c-text-faint); }
.focus-scene-card { min-width: 0; border: 1px solid var(--c-border); border-radius: 14px; padding: 6px; background: var(--c-surface); }
.focus-scene-card.selected { border-color: var(--c-primary); box-shadow: 0 0 0 1px var(--c-primary); }
.focus-scene-select { display: block; width: 100%; text-align: left; border: 0; padding: 0; background: transparent; color: var(--c-text); cursor: pointer; }
.focus-scene-select:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 3px; border-radius: 10px; }
.focus-scene-swatch { position: relative; display: block; height: 132px; overflow: hidden; border-radius: 9px; background: #263a36; }
.focus-scene-swatch::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 40%, #07131f99); }
.focus-scene-swatch img { width: 100%; height: 100%; object-fit: cover; }
.focus-swatch-label { position: absolute; z-index: 1; bottom: 12px; left: 12px; color: #eee5d5bf; font-size: 7px; letter-spacing: 1.5px; }
.focus-current-badge { position: absolute; top: 9px; right: 9px; padding: 3px 7px; background: #12221e66; color: #fff; border: 1px solid #ffffff30; border-radius: 10px; font-size: 9px; }
.focus-scene-select > span:last-child { display: block; padding: 13px 10px 0; }
.focus-scene-select strong { display: block; font-size: 13px; font-weight: 600; }
.focus-scene-select small { display: block; margin-top: 7px; color: var(--c-text-muted); font-size: 10px; line-height: 1.8; min-height: 36px; }
.focus-scene-footer { margin: 13px 10px 10px; font-size: 11px; color: var(--c-text-muted); gap: 6px; }
.focus-scene-footer .el-button { font-size: 10px; padding: 5px 9px; }
.focus-footnote { font-size: 11px; color: var(--c-text-muted); margin: 0; line-height: 1.8; }
/* The included desk keeps a restrained, simple composition. */
.focus-stage[data-scene='scene-desk'] { background: linear-gradient(120deg, #263c36, #8a9985); }
.focus-window { position: absolute; right: 9%; top: 13%; width: 34%; height: 54%; border: 10px solid #ffffff12; border-radius: 120px 120px 0 0; background: linear-gradient(160deg, #a6bda3, #667e6c); z-index: -2; }
.focus-window::after { content: ''; position: absolute; inset: 50% 0 auto; height: 5px; background: #ffffff20; }
.focus-desk { position: absolute; bottom: 0; width: 100%; height: 23%; background: linear-gradient(#8a7457, #4a4438); border-top: 6px solid #b5a181; z-index: -2; }
.focus-cup { position: absolute; width: 38px; height: 42px; background: #d6cdb7; right: 15%; top: -49px; border-radius: 4px 4px 15px 15px; box-shadow: 10px 3px 0 -3px #b9a78a; }
.focus-book { position: absolute; right: 27%; top: -19px; height: 12px; width: 115px; background: #dfd7c0; border-bottom: 4px solid #57716a; transform: rotate(-5deg); }
.focus-lamp { position: absolute; right: 39%; top: -175px; height: 158px; width: 5px; background: #b9ab88; transform: rotate(-12deg); }
.focus-lamp::before { content: ''; position: absolute; width: 80px; height: 35px; left: -25px; background: #ddcda8; border-radius: 60px 60px 4px 4px; box-shadow: 0 30px 70px #ffe7aa33; }
.focus-free-art { position: absolute; inset: 0; background: linear-gradient(0deg, #78684e 25%, transparent 25%), linear-gradient(110deg, #32473e, #a0b49c); }
.focus-free-art::before { content: ''; position: absolute; right: 20%; top: 12%; width: 32%; height: 62%; border: 4px solid #b8c5b333; border-radius: 40px 40px 0 0; background: #a9bda433; }
@media (max-width: 1000px) { .focus-scenes { grid-template-columns: repeat(2, minmax(0, 1fr)); } .focus-clock { width: 43%; } .focus-location small { display: none; } .focus-scene-swatch { height: 160px; } }
@media (max-width: 650px) { .focus-heading { align-items: start; flex-direction: column; } .focus-stage { height: 500px; } .focus-stage-top { padding: 20px; } .focus-clock { top: 23%; width: 80%; } .focus-clock strong { font-size: 78px; } .focus-stage::after { background: #08132066; } .focus-scene-caption { bottom: 85px; } .focus-preview-note { left: 6%; right: auto; bottom: 20px; text-align: left; } .focus-preview-note button { display: inline; margin-left: 10px; } .focus-scenes { gap: 10px; } .focus-scene-footer { margin: 10px 4px; flex-wrap: wrap; } }
.focus-art { animation: scene-arrive .65s ease-out; }
.focus-scene-card { transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
.focus-scene-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px #07182112; }
.focus-scene-card.selected:hover { box-shadow: 0 0 0 1px var(--c-primary), 0 8px 24px #07182112; }
@keyframes scene-arrive { from { opacity: 0; transform: scale(1.025); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .focus-art { animation: none; } .focus-scene-card { transition: none; } .focus-scene-card:hover { transform: none; } }
</style>
