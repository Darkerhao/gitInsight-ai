<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ seedId: string; progress?: number; potId?: string }>();
const growth = computed(() => Math.min(1, Math.max(0, props.progress ?? 1)));
</script>

<template>
  <div class="garden-plant" :class="[seedId, potId, { 'is-grown': growth >= 1 }]" aria-hidden="true">
    <svg viewBox="0 0 160 172" fill="none">
      <ellipse cx="80" cy="153" rx="49" ry="8" fill="currentColor" opacity=".08" />
      <g class="plant-foliage" :style="{ transform: `scale(${0.35 + growth * 0.65})` }">
      <path d="M80 119V58" class="plant-stem" stroke-width="5" stroke-linecap="round" />
      <path d="M79 96C52 96 43 82 46 72C67 70 80 79 79 96Z" class="plant-leaf" />
      <path d="M81 80C105 81 117 66 113 57C94 55 80 65 81 80Z" class="plant-leaf leaf-right" />
      <circle v-if="growth < 1" cx="80" cy="57" :r="4 + growth * 5" class="plant-leaf" />
      <g v-else-if="seedId === 'seed-sunflower'" class="plant-crown">
        <g fill="#f1c75b">
          <ellipse cx="80" cy="36" rx="9" ry="18" /><ellipse cx="80" cy="70" rx="9" ry="18" />
          <ellipse cx="63" cy="53" rx="18" ry="9" /><ellipse cx="97" cy="53" rx="18" ry="9" />
          <ellipse cx="68" cy="41" rx="8" ry="16" transform="rotate(-45 68 41)" /><ellipse cx="92" cy="65" rx="8" ry="16" transform="rotate(-45 92 65)" />
          <ellipse cx="92" cy="41" rx="8" ry="16" transform="rotate(45 92 41)" /><ellipse cx="68" cy="65" rx="8" ry="16" transform="rotate(45 68 65)" />
        </g>
        <circle cx="80" cy="53" r="14" fill="#97683b" /><circle cx="76" cy="49" r="3" fill="#bc8e51" />
      </g>
      <g v-else-if="seedId === 'seed-pine'" class="plant-crown plant-leaf">
        <path d="M80 16L58 52H68L48 82H61L42 110H118L99 82H112L92 52H102L80 16Z" />
        <path d="M80 34V110" stroke="#427b61" stroke-width="3" />
      </g>
      <g v-else class="plant-crown plant-leaf">
        <path d="M80 70C52 67 51 43 65 39C74 37 80 44 80 48C80 38 92 32 101 39C117 54 99 68 80 70Z" />
        <path d="M80 69C58 77 42 62 48 49C52 42 63 42 68 48C60 36 63 23 75 24C91 25 91 51 80 69Z" opacity=".85" />
      </g>
      </g>
      <path d="M49 119H111L103 148C101 157 59 157 57 148L49 119Z" class="plant-pot" />
      <rect x="45" y="114" width="70" height="12" rx="5" class="plant-pot-rim" />
      <path d="M60 133H99" stroke="white" stroke-opacity=".22" stroke-width="3" stroke-linecap="round" />
      <g v-if="potId === 'pot-orbit'" stroke="#92c8e5" stroke-width="2"><ellipse cx="80" cy="136" rx="47" ry="9" transform="rotate(-12 80 136)" /><circle cx="124" cy="126" r="4" fill="#92c8e5" /></g>
    </svg>
  </div>
</template>

<style scoped>
.garden-plant { width: 160px; height: 172px; color: var(--c-text); }
svg { width: 100%; height: 100%; overflow: visible; }
.plant-stem { stroke: #699b62; }
.plant-leaf { fill: #7fac73; }
.leaf-right { fill: #9acb7d; }
.plant-foliage { transform-origin: 80px 119px; }
.plant-pot { fill: #ad7b61; }
.plant-pot-rim { fill: #ca9b7b; }
.pot-ceramic .plant-pot { fill: #b9c9cb; }
.pot-ceramic .plant-pot-rim { fill: #dfe9e4; }
.pot-orbit .plant-pot { fill: #52758b; }
.pot-orbit .plant-pot-rim { fill: #7094a7; }
</style>
