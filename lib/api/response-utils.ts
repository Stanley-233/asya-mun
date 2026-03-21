export function parseApiPayload<T>(rawResponse: unknown): T | null {
  try {
    const transportData =
      rawResponse && typeof rawResponse === 'object' && 'data' in (rawResponse as Record<string, unknown>)
        ? (rawResponse as Record<string, unknown>).data
        : rawResponse

    if (transportData === null || transportData === undefined) {
      return null
    }

    const parsedTransport =
      typeof transportData === 'string' ? JSON.parse(transportData) : transportData

    if (
      parsedTransport &&
      typeof parsedTransport === 'object' &&
      'data' in (parsedTransport as Record<string, unknown>)
    ) {
      const nestedData = (parsedTransport as Record<string, unknown>).data
      if (nestedData === null || nestedData === undefined) {
        return null
      }

      if (typeof nestedData === 'string') {
        return JSON.parse(nestedData) as T
      }

      return nestedData as T
    }

    return parsedTransport as T
  } catch (err) {
    console.error('Failed to parse API payload:', err)
    return null
  }
}
