import { useMemo, useState } from 'react'
import { DIFFICULTY_META, type Difficulty, type InboxItem } from '../core/types'

/** 采集产出文件的探测状态：missing = 未发现采集器产出（大概率尚未配置） */
export interface InboxFeed {
  status: 'unknown' | 'ok' | 'missing'
  generatedAt: string | null
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/** 线索信箱：审阅采集器送来的待办建议——采纳（钉上黑板）或忽略 */
export function Inbox({
  items,
  feed,
  today,
  onAdopt,
  onDismiss,
  onClose,
}: {
  items: InboxItem[]
  feed: InboxFeed
  today: string
  onAdopt(hash: string, difficulty: Difficulty, due: string | null): void
  onDismiss(hash: string): void
  onClose(): void
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="inbox-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inbox-head">
          <h3>线索信箱</h3>
          <span className="inbox-sub">采集自你的 git 提交、AI 会话与 Jira · 采纳后才会钉上黑板</span>
        </div>
        {items.length === 0 ? (
          feed.status === 'missing' ? (
            <SetupGuide />
          ) : (
            <div className="inbox-empty">
              信箱空空。
              {feed.status === 'ok' && feed.generatedAt
                ? `采集器上次运行于 ${fmtTime(feed.generatedAt)}，暂无新线索。`
                : ''}
              <br />
              手动采集：在项目目录运行 <code>npm run collect</code>
            </div>
          )
        ) : (
          <>
            <div className="inbox-list">
              {items.map((it) => (
                <InboxRow key={it.hash} item={it} today={today} onAdopt={onAdopt} onDismiss={onDismiss} />
              ))}
            </div>
            {feed.status === 'ok' && feed.generatedAt && (
              <div className="inbox-meta">上次采集：{fmtTime(feed.generatedAt)}</div>
            )}
          </>
        )}
        <button className="inbox-close" onClick={onClose}>
          合上信箱
        </button>
      </div>
    </div>
  )
}

/** 未发现采集产出：给一段可直接交给 AI agent 的配置提示词 */
function SetupGuide() {
  const [copied, setCopied] = useState(false)

  const projectDir = useMemo(() => {
    if (location.protocol === 'file:') {
      const p = decodeURIComponent(location.pathname)
      const i = p.indexOf('/release/')
      if (i > 0) return p.slice(0, i)
    }
    return '<项目根目录>'
  }, [])

  const prompt = useMemo(
    () =>
      `我在使用「怪奇生物孵化器」（待办驱动的孵化小游戏），项目目录：${projectDir}。` +
      `它的线索信箱需要一个采集器定时产出建议文件，但我还没配置。请帮我完成：\n` +
      `1. 阅读项目里的 scripts/collect-todos.mjs 与 collect.config.json，理解采集器的工作方式；\n` +
      `2. 和我确认后编辑 collect.config.json：repos 填我常用的本地 git 仓库路径；若我使用 Jira，确认 jira.baseUrl 与 jql；\n` +
      `3. 若接 Jira：引导我生成 PAT，把 export JIRA_API_TOKEN="<token>" 写入 ~/.config/gsi/env（chmod 600，绝不提交 git），并让 ~/.zshrc source 它（token 由我自己填，不要让它出现在会话记录里）；\n` +
      `4. 安装每日 cron（cron 需显式 PATH 与 USER；macOS 下 claude CLI 凭证在钥匙串，缺 USER 会报 Not logged in）：\n` +
      `   0 9 * * * . $HOME/.config/gsi/env && export USER=\${USER:-$(whoami)} LOGNAME=\${LOGNAME:-$USER} PATH=$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin && cd ${projectDir} && npm run collect >> /tmp/gsi-collect.log 2>&1\n` +
      `5. 运行 npm run collect 验证：应产出 public/gsi-inbox.json(.js) 并更新 release/gsi-inbox.js；\n` +
      `6. 完成后告诉我刷新单机页面即可在信箱看到线索。`,
    [projectDir],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = prompt
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      setCopied(true)
    }
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="setup-guide">
      <p>
        <b>还没有发现采集器的产出</b>——线索采集大概率尚未配置。
        把下面这段提示词交给你的 AI agent（Claude Code / Codex），它会替你完成全部配置：
      </p>
      <pre className="agent-prompt">{prompt}</pre>
      <div className="setup-actions">
        <button className="ir-adopt" onClick={copy}>
          {copied ? '✓ 已复制' : '复制提示词'}
        </button>
        <span className="setup-hint">或者手动：在项目目录运行 <code>npm run collect</code></span>
      </div>
    </div>
  )
}

function InboxRow({
  item,
  today,
  onAdopt,
  onDismiss,
}: {
  item: InboxItem
  today: string
  onAdopt(hash: string, difficulty: Difficulty, due: string | null): void
  onDismiss(hash: string): void
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>(item.difficulty)
  const [due, setDue] = useState(item.due ?? '')
  return (
    <div className="inbox-row">
      <div className="ir-main">
        <div className="ir-title">{item.title}</div>
        {item.due && <span className="ir-source">截止 {item.due}</span>}
        <span className="ir-source">{item.source}</span>
      </div>
      <div className="ir-controls">
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_META[d].name} +{DIFFICULTY_META[d].points}
            </option>
          ))}
        </select>
        <input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} title="截止日（可选）" />
        <button className="ir-adopt" onClick={() => onAdopt(item.hash, difficulty, due || null)}>
          钉上黑板
        </button>
        <button className="ir-dismiss" onClick={() => onDismiss(item.hash)}>
          忽略
        </button>
      </div>
    </div>
  )
}
