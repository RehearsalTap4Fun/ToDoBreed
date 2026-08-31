import { useEffect, useState } from 'react'
import type { CreatureRecord } from '../core/types'
import { renderRecordImage } from '../qmonster/orchestrator'

/** blob URL 复用：同一缓存键只创建一次 objectURL */
const urlCache = new Map<string, string>()

/** gen2 生物立绘：优先 IndexedDB 缓存，未命中按权威 spec 重绘 */
export function QCreatureImg({
  record,
  size,
  className,
}: {
  record: CreatureRecord
  size: number
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(
    record.qimageKey ? (urlCache.get(record.qimageKey) ?? null) : null,
  )

  useEffect(() => {
    if (url !== null || record.qstatus !== 'ready') return
    let cancelled = false
    renderRecordImage(record)
      .then((blob) => {
        if (cancelled || blob === null) return
        const objectUrl = URL.createObjectURL(blob)
        if (record.qimageKey) urlCache.set(record.qimageKey, objectUrl)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [record, url])

  if (url === null) {
    return (
      <div
        className={`qimg-pending ${className ?? ''}`}
        style={{ width: size, height: size }}
        title={record.qstatus === 'pending' ? '形象凝聚中…' : '形象加载中…'}
      />
    )
  }
  return (
    <img
      className={className}
      src={url}
      width={size}
      height={size}
      alt={record.nickname ?? record.name}
      style={{ objectFit: 'contain' }}
    />
  )
}
