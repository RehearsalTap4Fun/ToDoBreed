import { useEffect, useState } from 'react'
import type { CreatureRecord } from '../core/types'
import { renderRecordImage } from '../qmonster/orchestrator'
import { renderFelineImage } from '../qmonster/feline/orchestrator'

/** blob URL 复用：同一缓存键只创建一次 objectURL */
const urlCache = new Map<string, string>()

function imageKeyOf(record: CreatureRecord): string | undefined {
  return record.kind === 'feline' ? record.fimageKey : record.qimageKey
}

function statusOf(record: CreatureRecord): 'pending' | 'ready' | undefined {
  return record.kind === 'feline' ? record.fstatus : record.qstatus
}

/** 位图立绘（gen2 QMonster / gen3 小猫轨）：优先 IndexedDB 缓存，未命中按权威身份重绘 */
export function QCreatureImg({
  record,
  size,
  className,
}: {
  record: CreatureRecord
  size: number
  className?: string
}) {
  const key = imageKeyOf(record)
  const status = statusOf(record)
  const [url, setUrl] = useState<string | null>(key ? (urlCache.get(key) ?? null) : null)

  useEffect(() => {
    if (url !== null || status !== 'ready') return
    let cancelled = false
    const render = record.kind === 'feline' ? renderFelineImage(record) : renderRecordImage(record)
    render
      .then((blob) => {
        if (cancelled || blob === null) return
        const objectUrl = URL.createObjectURL(blob)
        if (key) urlCache.set(key, objectUrl)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [record, url, status, key])

  if (url === null) {
    return (
      <div
        className={`qimg-pending ${className ?? ''}`}
        style={{ width: size, height: size }}
        title={status === 'pending' ? '形象凝聚中…' : '形象加载中…'}
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
