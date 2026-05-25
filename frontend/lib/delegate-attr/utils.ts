import { parseApiPayload } from "@/lib/api/response-utils";
import type { NormalizedPage } from "@/lib/api/core/page";
import type {
  DelegateAttrConfigResponse,
  DelegateAttrRecordPageResponse,
  DelegateAttrRecordResponse,
  DelegateAttrRecordResponseValues,
  DelegateAttrTypedValueResponse,
  DelegateAttrValueInput,
  PageObject,
} from "@/lib/api/generated";

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

export type { NormalizedPage };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
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
  const parsedAny = (parsed ?? {}) as Record<string, unknown>;
  const configs = Array.isArray(parsedAny.configs) ? (parsedAny.configs as DelegateAttrConfigResponse[]) : [];

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
    records: normalizeDelegateAttrPage(parsedAny),
  };
}

export function normalizeDelegateAttrPage(
  pageLike: PageObject | Record<string, unknown> | null | undefined,
): NormalizedPage<DelegateAttrRecordRowViewModel> {
  const source = (pageLike ?? {}) as Record<string, unknown>;

  const recordsNode = isObject(source.records) ? source.records : null;
  const sourcePageNode = isObject(source.page) ? source.page : null;
  const recordsPageNode = recordsNode && isObject(recordsNode.page) ? recordsNode.page : null;
  const primaryNode = recordsPageNode ?? recordsNode ?? sourcePageNode ?? source;

  const contentRaw =
    (Array.isArray(primaryNode.content) && primaryNode.content) ||
    (recordsNode && Array.isArray(recordsNode.content) && recordsNode.content) ||
    (sourcePageNode && Array.isArray(sourcePageNode.content) && sourcePageNode.content) ||
    (Array.isArray(source.content) && source.content) ||
    [];
  const content: DelegateAttrRecordResponse[] = Array.isArray(contentRaw)
    ? (contentRaw as DelegateAttrRecordResponse[])
    : [];

  const totalElementsCandidate =
    primaryNode.totalElements ??
    primaryNode.total ??
    recordsNode?.totalElements ??
    recordsNode?.total ??
    sourcePageNode?.totalElements ??
    sourcePageNode?.total ??
    source.totalElements ??
    source.total;
  const totalElements =
    typeof totalElementsCandidate === "number"
      ? totalElementsCandidate
      : content.length;

  const sizeCandidate =
    primaryNode.size ??
    primaryNode.pageSize ??
    (isObject(primaryNode.pageable) ? primaryNode.pageable.pageSize : undefined) ??
    recordsNode?.size ??
    (isObject(recordsNode?.pageable) ? recordsNode.pageable.pageSize : undefined) ??
    sourcePageNode?.size ??
    (isObject(sourcePageNode?.pageable) ? sourcePageNode.pageable.pageSize : undefined) ??
    source.size;
  const size = typeof sizeCandidate === "number" && sizeCandidate > 0 ? sizeCandidate : 10;

  const rawTotalPages =
    primaryNode.totalPages ??
    primaryNode.totalPage ??
    recordsNode?.totalPages ??
    (recordsNode?.["totalPage"] as number | undefined) ??
    sourcePageNode?.totalPages ??
    (sourcePageNode?.["totalPage"] as number | undefined) ??
    source.totalPages ??
    source.totalPage;

  const totalPages =
    typeof rawTotalPages === "number"
      ? rawTotalPages
      : size > 0
        ? Math.ceil(totalElements / size)
        : 0;

  const pageNumberCandidate =
    primaryNode.number ??
    primaryNode.pageNumber ??
    (isObject(primaryNode.pageable) ? primaryNode.pageable.pageNumber : undefined) ??
    recordsNode?.number ??
    (recordsNode?.["pageNumber"] as number | undefined) ??
    (isObject(recordsNode?.pageable) ? recordsNode.pageable.pageNumber : undefined) ??
    sourcePageNode?.number ??
    (sourcePageNode?.["pageNumber"] as number | undefined) ??
    (isObject(sourcePageNode?.pageable) ? sourcePageNode.pageable.pageNumber : undefined) ??
    source.number;
  const pageNumber = typeof pageNumberCandidate === "number" ? pageNumberCandidate : 0;

  const firstCandidate = primaryNode.first ?? recordsNode?.first ?? sourcePageNode?.first ?? source.first;
  const lastCandidate = primaryNode.last ?? recordsNode?.last ?? sourcePageNode?.last ?? source.last;

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
    isFirstPage: typeof firstCandidate === "boolean" ? firstCandidate : pageNumber <= 0,
    isLastPage:
      typeof lastCandidate === "boolean"
        ? lastCandidate
        : totalPages > 0
          ? pageNumber >= totalPages - 1
          : true,
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}/${m}/${d} ${h}:${min}:${s}`;
}
