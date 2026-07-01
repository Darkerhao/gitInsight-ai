import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'preload.js',
      },
    },
  },
  renderer: {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) return undefined;
            if (normalizedId.includes('/element-plus/')) return 'vendor-element-plus';
            if (normalizedId.includes('/echarts/')) return 'vendor-echarts';
            if (normalizedId.includes('/lucide-vue-next/')) return 'vendor-icons';
            if (normalizedId.includes('/gsap/')) return 'vendor-animation';
            if (normalizedId.includes('/@vueuse/')) return 'vendor-vueuse';
            if (normalizedId.includes('/vue/') || normalizedId.includes('/vue-router/')) return 'vendor-vue';
            return 'vendor';
          },
        },
      },
    },
  },
});
