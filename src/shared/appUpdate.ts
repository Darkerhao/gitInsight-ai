export type AppUpdateStatus = 'idle' | 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error' | 'unsupported';

export interface AppUpdateState {
  status: AppUpdateStatus;
  supported: boolean;
  autoUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseDate: string;
  lastCheckedAt: string;
  message: string;
  progress: {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  } | null;
}

export const APP_LINKS = {
  home: 'https://github.com/Darkerhao/gitInsight-ai',
  releases: 'https://github.com/Darkerhao/gitInsight-ai/releases',
} as const;

export type AppLink = keyof typeof APP_LINKS;
