import { useEffect, useState } from 'react'
import type { CreatureRecord } from '../core/types'
import { getCachedImage } from '../qmonster/image-cache'
import { renderFelineImage } from '../qmonster/feline/orchestrator'
import { felineAvailable } from '../qmonster/feline/sdk'

/** blob URL 复用：同一缓存键只创建一次 objectURL */
const urlCache = new Map<string, string>()

/**
 * 位图立绘：
 * - gen3（小猫轨）：IndexedDB 缓存优先，未命中按 fvisual/fplan 由 SDK 重绘
 * - gen2（QMonster v0.3，运行时已下线）：只读——冻结进存档的 data URL，其次本源 IndexedDB 旧缓存，否则占位
 */
export function QCreatureImg({
  record,
  size,
  className,
}: {
  record: CreatureRecord
  size: number
  className?: string
}) {
  const isFeline = record.kind === 'feline'
  const key = isFeline ? record.fimageKey : record.qimageKey
  const status = isFeline ? record.fstatus : 'ready'
  const frozen = record.kind === 'qmonster' ? record.qimageData : undefined
  const [url, setUrl] = useState<string | null>(frozen ?? (key ? (urlCache.get(key) ?? null) : null))

  useEffect(() => {
    if (url !== null || status !== 'ready') return
    let cancelled = false
    const load = isFeline
      ? renderFelineImage(record)
      : key
        ? getCachedImage(key)
        : Promise.resolve<Blob | null>(null)
    load
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
  }, [record, url, status, key, isFeline])

  if (url === null) {
    const available = isFeline ? felineAvailable() : false
    const title = isFeline
      ? available
        ? status === 'pending'
          ? '形象凝聚中…'
          : '形象加载中…'
        : '单文件形态无法合成立绘：用「启动孵化器.command」或 npm run play 打开可见形象'
      : '旧谱系生物：立绘未能冻结进存档（QMonster v0.3 运行时已下线）'
    return (
      <div
        className={`qimg-pending${available ? '' : ' offline'} ${className ?? ''}`}
        style={{ width: size, height: size }}
        title={title}
      >
        {!available && <span className="qimg-offline-glyph">🐾</span>}
      </div>
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
