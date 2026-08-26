#!/usr/bin/env node
/**
 * 线索采集器：扫描 git 仓库最近提交/未提交改动 + Claude/Codex 会话记录，
 * 提炼「尚未完成、值得跟进」的事项，写入 public/gsi-inbox.json 供应用的线索信箱拉取。
 *
 * 用法：npm run collect          （或 node scripts/collect-todos.mjs）
 * 配置：collect.config.json     （repos / sinceHours / maxItems / useClaude）
 * 定时：可配 cron，如  0 9 * * *  cd ~/Demo/incubator && npm run collect
 *
 * 提炼优先走 `claude -p` 无头模式（智能提取）；CLI 不可用时降级为关键词启发式。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const DEFAULTS = {
  repos: ['.'],
  claudeProjectsDir: '~/.claude/projects',
  codexSessionsDir: '~/.codex/sessions',
  sinceHours: 24,
  maxItems: 8,
  useClaude: true,
}

function expandHome(p) {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p
}

function loadConfig() {
  const p = join(ROOT, 'collect.config.json')
  if (!existsSync(p)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(p, 'utf8')) }
  } catch {
    console.warn('[collect] collect.config.json 解析失败，使用默认配置')
    return { ...DEFAULTS }
  }
}

function git(repo, args) {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 15000 }).trim()
  } catch {
    return ''
  }
}

/** 收集 git 材料：最近提交信息 + 未提交改动概览 */
function collectGit(cfg) {
  const chunks = []
  for (const raw of cfg.repos) {
    const repo = resolve(ROOT, expandHome(raw))
    if (!existsSync(join(repo, '.git'))) continue
    const name = basename(repo)
    const log = git(repo, ['log', `--since=${cfg.sinceHours} hours ago`, '--pretty=format:%s'])
    const status = git(repo, ['status', '--porcelain'])
      .split('\n')
      .filter(Boolean)
      .slice(0, 20)
      .join('\n')
    if (log || status) {
      chunks.push(
        `### git 仓库 ${name}\n最近提交：\n${log || '（无）'}\n未提交改动：\n${status || '（干净）'}`,
      )
    }
  }
  return chunks
}

/** 收集 AI 会话材料：最近修改的 jsonl 里的用户消息（取尾部，避免超长） */
function collectSessions(dir, label, sinceMs, maxSessions = 5) {
  const root = expandHome(dir)
  if (!existsSync(root)) return []
  const files = []
  const walk = (d, depth) => {
    if (depth > 3) return
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name)
      if (ent.isDirectory()) walk(p, depth + 1)
      else if (ent.name.endsWith('.jsonl')) {
        const st = statSync(p)
        if (st.mtimeMs >= sinceMs && st.size > 0) files.push({ p, mtime: st.mtimeMs })
      }
    }
  }
  try {
    walk(root, 0)
  } catch {
    return []
  }
  files.sort((a, b) => b.mtime - a.mtime)
  const chunks = []
  for (const { p } of files.slice(0, maxSessions)) {
    const lines = readFileSync(p, 'utf8').split('\n').filter(Boolean).slice(-200)
    const msgs = []
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        const texts = extractUserTexts(obj)
        for (const t of texts) {
          const clean = t.replace(/\s+/g, ' ').trim()
          if (clean.length >= 6 && !clean.startsWith('<')) msgs.push(clean.slice(0, 200))
        }
      } catch {
        /* 跳过坏行 */
      }
    }
    if (msgs.length > 0) {
      chunks.push(`### ${label} 会话 ${basename(p, '.jsonl').slice(0, 12)}\n${msgs.slice(-25).join('\n')}`)
    }
  }
  return chunks
}

/** 从一条会话记录里提取用户消息文本（对不同格式做防御性解析） */
function extractUserTexts(obj) {
  const out = []
  const role = obj.type === 'user' || obj.role === 'user' || obj.message?.role === 'user'
  if (!role) return out
  const content = obj.message?.content ?? obj.content
  if (typeof content === 'string') out.push(content)
  else if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === 'string') out.push(part)
      else if (part && typeof part.text === 'string' && (part.type === 'text' || !part.type))
        out.push(part.text)
    }
  }
  return out
}

function hashOf(title, source) {
  return createHash('sha1').update(`${source}|${title}`).digest('hex').slice(0, 16)
}

function sanitize(items, maxItems) {
  const diffs = new Set(['easy', 'normal', 'hard', 'epic'])
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(items) ? items : []) {
    const title = String(raw?.title ?? '').trim().slice(0, 40)
    if (!title) continue
    const source = String(raw?.source ?? '外部').trim().slice(0, 16) || '外部'
    const difficulty = diffs.has(raw?.difficulty) ? raw.difficulty : 'normal'
    const hash = hashOf(title, source)
    if (seen.has(hash)) continue
    seen.add(hash)
    out.push({ hash, title, source, difficulty })
    if (out.length >= maxItems) break
  }
  return out
}

/** 智能提炼：claude -p 无头模式 */
function extractWithClaude(material, maxItems) {
  const probe = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 15000 })
  if (probe.error || probe.status !== 0) return null
  const prompt =
    `你是待办提取器。stdin 是最近 ${'{h}'} 小时的 git 提交、工作区状态与 AI 编程会话中的用户消息。` +
    `提取"尚未完成、值得今天跟进"的具体事项。只输出一个 JSON 数组，不要任何其他文字：` +
    `[{"title":"中文祈使句，≤30字","difficulty":"easy|normal|hard|epic","source":"来源简述≤12字，如 git:仓库名 或 claude会话"}]。` +
    `最多 ${maxItems} 条；宁缺毋滥，材料中没有明确未完成事项就输出 []。不要编造，不要把已完成的事列进来。`
  const res = spawnSync('claude', ['-p', prompt], {
    input: material,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (res.error || res.status !== 0) {
    console.warn('[collect] claude -p 调用失败，降级为启发式提取')
    return null
  }
  const m = res.stdout.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    return JSON.parse(m[0])
  } catch {
    console.warn('[collect] claude 输出解析失败，降级为启发式提取')
    return null
  }
}

/** 启发式降级：只看 git（提交信息里的未完成信号 + 未提交改动） */
function extractHeuristic(cfg) {
  const items = []
  for (const raw of cfg.repos) {
    const repo = resolve(ROOT, expandHome(raw))
    if (!existsSync(join(repo, '.git'))) continue
    const name = basename(repo)
    const log = git(repo, ['log', `--since=${cfg.sinceHours} hours ago`, '--pretty=format:%s'])
    for (const msg of log.split('\n').filter(Boolean)) {
      if (/\b(wip|todo|fixme)\b|暂未|待办|待完成|待修|未完|临时|后续/i.test(msg)) {
        items.push({ title: `跟进：${msg.slice(0, 26)}`, source: `git:${name}`, difficulty: 'normal' })
      }
    }
    const dirty = git(repo, ['status', '--porcelain']).split('\n').filter(Boolean)
    if (dirty.length > 0) {
      items.push({
        title: `处理 ${name} 的 ${dirty.length} 处未提交改动`,
        source: `git:${name}`,
        difficulty: dirty.length > 8 ? 'hard' : 'normal',
      })
    }
  }
  return items
}

// ── main ──────────────────────────────────────────
const cfg = loadConfig()
const sinceMs = Date.now() - cfg.sinceHours * 3600_000

const material = [
  ...collectGit(cfg),
  ...collectSessions(cfg.claudeProjectsDir, 'claude', sinceMs),
  ...collectSessions(cfg.codexSessionsDir, 'codex', sinceMs),
].join('\n\n')

let items
if (!material.trim()) {
  items = []
  console.log('[collect] 近期无可分析材料')
} else if (cfg.useClaude) {
  const smart = extractWithClaude(material, cfg.maxItems)
  items = smart !== null ? smart : extractHeuristic(cfg)
} else {
  items = extractHeuristic(cfg)
}

const clean = sanitize(items, cfg.maxItems)
const payload = JSON.stringify({ generatedAt: new Date().toISOString(), items: clean }, null, 2)
const outDir = join(ROOT, 'public')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'gsi-inbox.json'), payload)
// file:// 单机形态无法 fetch，同步产出 JS 注入版；release/ 存在则一并更新
const jsPayload = `window.__GSI_INBOX__ = ${payload};\n`
writeFileSync(join(outDir, 'gsi-inbox.js'), jsPayload)
const releaseDir = join(ROOT, 'release')
if (existsSync(releaseDir)) writeFileSync(join(releaseDir, 'gsi-inbox.js'), jsPayload)
console.log(`[collect] 写入 public/gsi-inbox.json(.js)：${clean.length} 条线索`)
for (const it of clean) console.log(`  - [${it.source}] ${it.title}（${it.difficulty}）`)
