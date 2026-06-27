<script setup lang="ts">
defineProps<{
  status: 'success' | 'failed' | 'running' | 'pending' | 'info';
  label: string;
}>();
</script>

<template>
  <span class="status-badge" :class="`is-${status}`">
    <span class="status-badge-dot" />
    {{ label }}
  </span>
</template>
