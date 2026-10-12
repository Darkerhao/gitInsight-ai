import type { GenerateFromMaterialParams, MaterialReportResult } from '../../src/shared/types.js';
import { buildMaterialPrompt, formatMaterialReport } from '../../src/shared/materialReport.js';
import { callAiMaterialReport, resolveAiConfig } from './aiClient.js';
import { loadConfig } from './config.js';

export async function generateReportFromMaterial(params: GenerateFromMaterialParams): Promise<MaterialReportResult> {
  const prompt = buildMaterialPrompt(params);
  const config = resolveAiConfig(await loadConfig(), params.aiProfileId);
  const report = config.aiApiKey ? await callAiMaterialReport(config, prompt) : formatMaterialReport(params);
  return { report, role: params.role, date: params.date, generatedAt: new Date().toISOString() };
}
