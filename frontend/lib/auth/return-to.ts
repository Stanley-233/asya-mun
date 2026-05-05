export const RETURN_TO_STORAGE_KEY = 'asya-return-to'

export function getSafeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  if (value.startsWith('/login')) return null
  return value
}

export function getCurrentReturnToPath() {
  if (typeof window === 'undefined') return '/'

  const { pathname, search, hash } = window.location
  if (pathname === '/login') return '/'

  return `${pathname}${search}${hash}`
}

export function buildLoginRedirect(returnTo = getCurrentReturnToPath()) {
  const safeReturnTo = getSafeReturnTo(returnTo) || '/'

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, safeReturnTo)
  }

  return `/login?returnTo=${encodeURIComponent(safeReturnTo)}`
}
