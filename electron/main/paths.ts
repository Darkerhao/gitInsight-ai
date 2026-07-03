import { app } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const CONFIG_FILE = 'config.json';

export const SECRETS_FILE = 'secrets.json';

export const DB_FILE = 'gitinsight.db';


export function getConfigPath() {
  return join(app.getPath('userData'), CONFIG_FILE);
}


export function getSecretsPath() {
  return join(app.getPath('userData'), SECRETS_FILE);
}


export function getDatabasePath() {
  return join(app.getPath('userData'), DB_FILE);
}


export async function ensureConfigDir() {
  await mkdir(app.getPath('userData'), { recursive: true });
}

