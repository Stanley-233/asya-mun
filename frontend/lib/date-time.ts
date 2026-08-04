/**
 * 处理后端与前端之间无时区偏移的 ISO-8601 时间字符串。
 *
 * 后端所有“现实时间”字段统一使用 UTC 系统时间（LocalDateTime 形式）
 * 序列化，因此不带时区偏移的字符串应被理解为 UTC，然后再转换为
 * 浏览器本地时区展示。
 */

/**
 * 将服务端返回的时间字符串解析为 Date 对象。
 * 如果字符串本身已带时区/Z，则直接解析；否则按 UTC 解析。
 */
export function parseServerDateTime(value?: string | null): Date | null {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null

  const hasOffset = /[Zz]|[+-]\d{2}:?\d{2}$/.test(normalized)
  const date = new Date(hasOffset ? normalized : `${normalized}Z`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * 将服务端时间字符串格式化为本地时间文本（yyyy/MM/dd HH:mm:ss）。
 */
export function formatServerDateTime(value?: string | null): string {
  const date = parseServerDateTime(value)
  if (!date) return value || '未知'

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}/${m}/${d} ${h}:${min}:${s}`
}

/**
 * 将服务端时间字符串转换为 <input type="datetime-local"> 所需的本地时间格式。
 */
export function toServerDateTimeLocalInputValue(value?: string | null): string {
  const date = parseServerDateTime(value)
  if (!date) return ''

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

/**
 * 将用户在 <input type="datetime-local"> 中输入的本地时间
 * 转换为后端 LocalDateTime 可接受的 UTC 无时区 ISO-8601 字符串。
 */
export function parseDateTimeLocalToServerISO(dateTimeLocal: string): string {
  if (!dateTimeLocal.trim()) return ''
  const date = new Date(dateTimeLocal)
  if (Number.isNaN(date.getTime())) return ''

  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}:${s}`
}
