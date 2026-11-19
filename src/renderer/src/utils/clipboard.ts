import { ElMessage } from 'element-plus';

export async function copyText(value: string, successMessage: string) {
  if (!value.trim()) {
    ElMessage.warning('没有可复制的内容');
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
  } catch {
    ElMessage.error('复制失败，请手动选择内容复制');
    return;
  }
  ElMessage.success(successMessage);
}
