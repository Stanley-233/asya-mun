export const RETURN_TO_STORAGE_KEY = 'asya-return-to'
const DEFAULT_AUTH_REDIRECT = '/progress'

export function getSafeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  if (value === '/') return null
  if (value.startsWith('/login')) return null
  return value
}

export function getCurrentReturnToPath() {
  if (typeof window === 'undefined') return DEFAULT_AUTH_REDIRECT

  const { pathname, search, hash } = window.location
  if (pathname === '/' || pathname === '/login') return DEFAULT_AUTH_REDIRECT

  return `${pathname}${search}${hash}`
}

export function buildLoginRedirect(returnTo = getCurrentReturnToPath()) {
  const safeReturnTo = getSafeReturnTo(returnTo) || DEFAULT_AUTH_REDIRECT

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, safeReturnTo)
  }

  return `/?returnTo=${encodeURIComponent(safeReturnTo)}`
}
