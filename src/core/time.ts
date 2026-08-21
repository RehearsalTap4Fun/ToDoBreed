/**
 * 时间处理（§13.1）：逾期判定用本地自然日，周刷新锚定周一。
 * 日戳统一为 'YYYY-MM-DD'；日期运算按 UTC 解释日戳，避免 DST 问题。
 */

export function dayStamp(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toUTC(stamp: string): number {
  const [y, m, d] = stamp.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(stamp: string, n: number): string {
  const d = new Date(toUTC(stamp) + n * 86400000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** b - a 的天数（b 晚于 a 时为正） */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000)
}

/** 该日所在周的周一（周即以周一日戳标识） */
export function mondayOf(stamp: string): string {
  const dow = new Date(toUTC(stamp)).getUTCDay() // 0=Sun..6=Sat
  const offset = dow === 0 ? 6 : dow - 1
  return addDays(stamp, -offset)
}

export function isMonday(stamp: string): boolean {
  return new Date(toUTC(stamp)).getUTCDay() === 1
}
