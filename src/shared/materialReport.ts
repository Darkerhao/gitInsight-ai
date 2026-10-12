import { PRODUCT_MANAGER_SECTIONS, PROJECT_MANAGER_SECTIONS } from './types.js';
import type { GenerateFromMaterialParams, MaterialRole, RoleMaterialPayload } from './types.js';

export const MATERIAL_ROLE_LABELS: Record<MaterialRole, string> = {
  projectManager: '项目经理', productManager: '产品经理',
};

export function isMaterialRole(role: unknown): role is MaterialRole {
  return role === 'projectManager' || role === 'productManager';
}

export function materialSections(role: MaterialRole) {
  return role === 'projectManager' ? PROJECT_MANAGER_SECTIONS : PRODUCT_MANAGER_SECTIONS;
}

export function emptyMaterial(role: MaterialRole, date: string): RoleMaterialPayload {
  return { role, date, sections: materialSections(role).map(({ key, label }) => ({ key, label, content: '' })), extraNotes: '' };
}

export function formatMaterialReport(params: GenerateFromMaterialParams) {
  const sections = params.sections.filter(section => section.content.trim()).map((section, index) =>
    `${index + 1}、${section.label}\n\n${section.content.trim()}`);
  if (params.extraNotes.trim()) sections.push(`补充说明\n\n${params.extraNotes.trim()}`);
  return [`${params.date} ${MATERIAL_ROLE_LABELS[params.role]}日报`, ...sections,
    `汇报人：${params.reporterName.trim()}`, `日期：${params.date}`].join('\n\n');
}

export function buildMaterialPrompt(params: GenerateFromMaterialParams) {
  if (!isMaterialRole(params.role)) throw new Error('不支持的素材角色');
  if (!params.reporterName.trim()) throw new Error('请先填写汇报人');
  const text = params.sections.filter(section => section.content.trim())
    .map(section => `【${section.label}】\n${section.content.trim()}`);
  if (params.extraNotes.trim()) text.push(`【补充说明】\n${params.extraNotes.trim()}`);
  if (!text.length) throw new Error('请至少填写一项工作素材后再生成日报');
  return `请根据以下工作素材整理一份正式的中文${MATERIAL_ROLE_LABELS[params.role]}日报。
按素材分区归纳，同类事项合并，保留关键事实、进度、结论、风险和待确认事项。
只能依据所提供的素材，禁止推断、补写或编造未出现的内容、结论或数据；空分区不输出。
日期：${params.date}
汇报人：${params.reporterName.trim()}
工作素材：\n${text.join('\n\n')}`;
}
