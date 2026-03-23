import { parseApiPayload } from "@/lib/api/response-utils";
import type {
  DelegateAttrConfigResponse,
  DelegateAttrRecordPageResponse,
  DelegateAttrRecordResponse,
  DelegateAttrRecordResponseValues,
  DelegateAttrTypedValueResponse,
  DelegateAttrValueInput,
  Pagenull,
} from "@/lib/api/endpoints/asyaBackendAPI.schemas";

export interface DelegateAttrColumnViewModel {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER";
  sortOrder: number;
  enabled: boolean;
  visible: boolean;
  configId: string;
}

export interface DelegateAttrRecordRowViewModel {
  recordId: string;
  delegateId: string;
  delegateName: string;
  updatedAt: string;
  valuesMap: DelegateAttrRecordResponseValues;
}

export interface DelegateAttrFilterFormValue {
  textValue?: string;
  numberValue?: string;
}

export interface NormalizedPage<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  pageNumber: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}

export function parseDelegateAttrConfigs(rawResponse: unknown): DelegateAttrColumnViewModel[] {
  const parsed = parseApiPayload<DelegateAttrConfigResponse[] | null>(rawResponse);
  const list = Array.isArray(parsed) ? parsed : [];

  return list
    .map((config) => ({
      key: config.attrKey,
      label: config.attrLabel,
      type: config.attrType,
      sortOrder: config.sortOrder,
      enabled: config.enabled,
      visible: config.visible,
      configId: config.id,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function parseDelegateAttrRecordPage(
  rawResponse: unknown,
): { configs: DelegateAttrColumnViewModel[]; records: NormalizedPage<DelegateAttrRecordRowViewModel> } {
  const parsed = parseApiPayload<DelegateAttrRecordPageResponse | null>(rawResponse);
  const configs = parsed?.configs ?? [];
  const records = parsed?.records ?? {};

  return {
    configs: configs
      .map((config) => ({
        key: config.attrKey,
        label: config.attrLabel,
        type: config.attrType,
        sortOrder: config.sortOrder,
        enabled: config.enabled,
        visible: config.visible,
        configId: config.id,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    records: normalizeDelegateAttrPage(records),
  };
}

export function normalizeDelegateAttrPage(
  pageLike: Pagenull | null | undefined,
): NormalizedPage<DelegateAttrRecordRowViewModel> {
  const content: DelegateAttrRecordResponse[] = Array.isArray(pageLike?.content)
    ? pageLike.content
    : [];

  const totalElements = pageLike?.totalElements ?? content.length;
  const size = pageLike?.size ?? pageLike?.pageable?.pageSize ?? 10;
  const totalPages =
    typeof pageLike?.totalPages === "number"
      ? pageLike.totalPages
      : size > 0
        ? Math.ceil(totalElements / size)
        : 0;
  const pageNumber = pageLike?.number ?? pageLike?.pageable?.pageNumber ?? 0;

  return {
    content: content.map((record) => ({
      recordId: record.recordId,
      delegateId: record.delegateId,
      delegateName: record.delegateName,
      updatedAt: record.updatedAt,
      valuesMap: record.values ?? {},
    })),
    totalPages,
    totalElements,
    pageNumber,
    isFirstPage: pageLike?.first ?? pageNumber <= 0,
    isLastPage: pageLike?.last ?? (totalPages > 0 ? pageNumber >= totalPages - 1 : true),
  };
}

export function getDelegateAttrDisplayValue(
  typedValue: DelegateAttrTypedValueResponse | undefined,
): string {
  if (!typedValue) return "-";
  if (typedValue.attrType === "TEXT") {
    return typedValue.textValue?.trim() ? typedValue.textValue : "-";
  }
  if (typedValue.attrType === "NUMBER") {
    return typedValue.numberValue !== undefined && typedValue.numberValue !== null
      ? String(typedValue.numberValue)
      : "-";
  }
  return "-";
}

export function buildDelegateAttrUpsertValues(
  columns: DelegateAttrColumnViewModel[],
  formValues: Record<string, string>,
): DelegateAttrValueInput[] {
  const values: DelegateAttrValueInput[] = [];

  for (const column of columns) {
    const rawValue = formValues[column.key];
    const trimmed = rawValue?.trim() ?? "";

    if (!trimmed) continue;

    if (column.type === "TEXT") {
      values.push({
        attrKey: column.key,
        textValue: trimmed,
      });
      continue;
    }

    const parsedNumber = Number(trimmed);
    if (!Number.isFinite(parsedNumber)) {
      throw new Error(`属性「${column.label}」必须是有效数字`);
    }

    values.push({
      attrKey: column.key,
      numberValue: parsedNumber,
    });
  }

  return values;
}

export function toRecordFormValues(
  columns: DelegateAttrColumnViewModel[],
  valuesMap?: DelegateAttrRecordResponseValues,
): Record<string, string> {
  const output: Record<string, string> = {};

  for (const column of columns) {
    const typedValue = valuesMap?.[column.key];
    if (!typedValue) {
      output[column.key] = "";
      continue;
    }

    if (typedValue.attrType === "TEXT") {
      output[column.key] = typedValue.textValue ?? "";
      continue;
    }

    if (typedValue.attrType === "NUMBER") {
      output[column.key] =
        typedValue.numberValue !== undefined && typedValue.numberValue !== null
          ? String(typedValue.numberValue)
          : "";
      continue;
    }

    output[column.key] = "";
  }

  return output;
}

export function formatDelegateAttrUpdatedAt(value?: string): string {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}
