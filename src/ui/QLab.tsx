import { useEffect, useRef, useState } from 'react'
import type { Catalog } from '@qmonster/generator-core'
import { loadCatalog, qmonsterAvailable } from '../qmonster/catalog'
import { hatchValidSpec, type QMode, type QTheme } from '../qmonster/hatch'

/** QMonster 渲染试验场（?qlab=1）：3 主题 × 3 模式，固定 seed 端到端验证生成+渲染通路 */

const THEMES: QTheme[] = ['deep-sea', 'fungal', 'shadow']
const MODES: QMode[] = ['normal', 'mutation', 'aberration']
const THEME_NAMES: Record<QTheme, string> = { 'deep-sea': '深海', fungal: '菌沼', shadow: '幽影' }
const MODE_NAMES: Record<QMode, string> = { normal: '正常', mutation: '变异', aberration: '畸变' }

export function QLab() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seedBase, setSeedBase] = useState('2026082101')

  useEffect(() => {
    if (!qmonsterAvailable()) {
      setError('file:// 单机形态下 QMonster 渲染不可用，请通过 npm run dev 访问')
      return
    }
    loadCatalog()
      .then(setCatalog)
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <div className="qlab">
      <header className="lab-head">
        <h1>QMonster 渲染试验场</h1>
        <p>
          目录 v0.3.0 · 3 主题 × 3 模式 · 同一 seed 确定性生成 ·
          图像由 @qmonster/renderer-canvas 位图合成
        </p>
        <label className="qlab-seed">
          seed 基串：
          <input value={seedBase} onChange={(e) => setSeedBase(e.target.value)} />
        </label>
      </header>
      {error && <div className="qlab-error">{error}</div>}
      {catalog && (
        <div className="qlab-grid">
          {THEMES.map((theme) =>
            MODES.map((mode) => (
              <QCell
                key={`${theme}-${mode}-${seedBase}`}
                catalog={catalog}
                theme={theme}
                mode={mode}
                seed={`${seedBase}-${theme}-${mode}`}
              />
            )),
          )}
        </div>
      )}
    </div>
  )
}

function QCell({
  catalog,
  theme,
  mode,
  seed,
}: {
  catalog: Catalog
  theme: QTheme
  mode: QMode
  seed: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'rendering' | 'ok' | string>('rendering')
  const [info, setInfo] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const canvas = canvasRef.current
        if (canvas === null) return
        const { diagnostics, attempt } = await hatchValidSpec(seed, theme, mode, catalog, canvas)
        if (cancelled) return
        setInfo(
          `${attempt > 0 ? `第 ${attempt + 1} 次尝试收敛` : '首发命中'}${diagnostics.length > 0 ? ` · ${diagnostics.length} 条警告` : ''}`,
        )
        setStatus('ok')
      } catch (e) {
        if (!cancelled) setStatus(String(e))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [catalog, theme, mode, seed])

  return (
    <div className="qlab-cell">
      <canvas ref={canvasRef} width={1024} height={1024} />
      <div className="qlab-meta">
        <b>
          {THEME_NAMES[theme]} · {MODE_NAMES[mode]}
        </b>
        <span>{status === 'ok' ? `✓ ${info}` : status === 'rendering' ? '渲染中…' : status}</span>
      </div>
    </div>
  )
}
