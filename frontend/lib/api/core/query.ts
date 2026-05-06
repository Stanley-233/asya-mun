type QueryPrimitive = string | number | boolean | null | undefined

function appendQueryParam(searchParams: URLSearchParams, key: string, value: QueryPrimitive) {
  if (value === undefined || value === null) return
  if (typeof value === 'string' && value.trim() === '') return
  searchParams.append(key, String(value))
}

export function withQuery(path: string, query?: Record<string, unknown>) {
  if (!query) {
    return path
  }

  const [pathname, rawSearch = ''] = path.split('?', 2)
  const searchParams = new URLSearchParams(rawSearch)

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return

    if (key === 'pageable' && typeof value === 'object' && !Array.isArray(value)) {
      const pageable = value as {
        page?: number
        size?: number
        sort?: string[]
      }
      appendQueryParam(searchParams, 'page', pageable.page)
      appendQueryParam(searchParams, 'size', pageable.size)
      pageable.sort?.forEach(sort => appendQueryParam(searchParams, 'sort', sort))
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => appendQueryParam(searchParams, key, item as QueryPrimitive))
      return
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      appendQueryParam(searchParams, key, value)
      return
    }

    throw new TypeError(`Unsupported query value type for key "${key}"`)
  })

  const search = searchParams.toString()
  return search ? `${pathname}?${search}` : pathname
}
