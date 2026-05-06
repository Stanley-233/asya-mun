import { parseApiPayload } from '../response-utils'

export interface NormalizedPage<T> {
  content: T[]
  totalPages: number
  totalElements: number
  pageNumber: number
  isFirstPage: boolean
  isLastPage: boolean
}

export function createEmptyPage<T>(): NormalizedPage<T> {
  return {
    content: [],
    totalPages: 0,
    totalElements: 0,
    pageNumber: 0,
    isFirstPage: true,
    isLastPage: true,
  }
}

export function normalizePagePayload<T>(raw: unknown): NormalizedPage<T> {
  const parsed = parseApiPayload<Record<string, unknown> | null>(raw)
  if (!parsed || typeof parsed !== 'object') {
    return createEmptyPage<T>()
  }

  const pageNode =
    parsed.page && typeof parsed.page === 'object'
      ? (parsed.page as Record<string, unknown>)
      : undefined
  const pageableNode =
    parsed.pageable && typeof parsed.pageable === 'object'
      ? (parsed.pageable as Record<string, unknown>)
      : undefined

  const content = Array.isArray(parsed.content) ? (parsed.content as T[]) : []
  const totalElementsCandidate =
    parsed.totalElements ?? parsed.total ?? pageNode?.totalElements ?? pageNode?.total
  const totalElements =
    typeof totalElementsCandidate === 'number' ? totalElementsCandidate : content.length

  const sizeCandidate = parsed.size ?? pageableNode?.pageSize ?? pageNode?.size
  const size = typeof sizeCandidate === 'number' && sizeCandidate > 0 ? sizeCandidate : undefined

  const rawTotalPages = parsed.totalPages ?? parsed.totalPage ?? pageNode?.totalPages ?? pageNode?.totalPage
  const totalPages =
    typeof rawTotalPages === 'number'
      ? rawTotalPages
      : totalElements > 0 && size
        ? Math.ceil(totalElements / size)
        : 0

  const pageNumberCandidate = parsed.number ?? pageableNode?.pageNumber ?? pageNode?.number
  const pageNumber = typeof pageNumberCandidate === 'number' ? pageNumberCandidate : 0

  const firstCandidate = parsed.first ?? pageNode?.first
  const lastCandidate = parsed.last ?? pageNode?.last

  return {
    content,
    totalPages,
    totalElements,
    pageNumber,
    isFirstPage: typeof firstCandidate === 'boolean' ? firstCandidate : pageNumber <= 0,
    isLastPage:
      typeof lastCandidate === 'boolean'
        ? lastCandidate
        : totalPages > 0
          ? pageNumber >= totalPages - 1
          : true,
  }
}
