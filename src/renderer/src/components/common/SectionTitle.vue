<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="section-title">
    <span class="section-title-bar" />
    <span class="section-title-text">{{ title }}</span>
    <span v-if="subtitle" class="section-title-subtitle">{{ subtitle }}</span>
    <span class="section-title-extra"><slot name="extra" /></span>
  </div>
</template>
