import type { ReportResult, ReportTimeRange, StructuredReportMetadata } from '../../../../shared/types.js';

export function toPlainReportTimeRange(timeRange?: ReportTimeRange): ReportTimeRange | undefined {
  if (!timeRange) return undefined;
  return {
    startDateTime: timeRange.startDateTime,
    endDateTime: timeRange.endDateTime,
    label: timeRange.label,
  };
}

export function toPlainRawInput(rawInput?: ReportResult['rawInput']): ReportResult['rawInput'] | undefined {
  if (!rawInput) return undefined;
  return {
    gitLogs: rawInput.gitLogs,
    files: rawInput.files,
    diff: rawInput.diff,
    ...(rawInput.manualWorkContent ? { manualWorkContent: rawInput.manualWorkContent } : {}),
  };
}

export function toPlainStructuredJson(structuredJson?: StructuredReportMetadata): StructuredReportMetadata | undefined {
  if (!structuredJson) return undefined;
  return {
    title: structuredJson.title,
    workItems: structuredJson.workItems.map((item) => ({ ...item })),
    achievements: [...structuredJson.achievements],
    techTags: [...structuredJson.techTags],
    risks: [...structuredJson.risks],
    tomorrowPlan: [...structuredJson.tomorrowPlan],
    milestone: structuredJson.milestone,
  };
}
