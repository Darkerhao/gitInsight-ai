/// <reference types="vite/client" />

import type { GitInsightApi } from '@shared/api';

declare global {
  interface Window {
    api: GitInsightApi;
  }
}

export {};
