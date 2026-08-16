/**
 * dsh-docs-panel 宿主端。
 *
 * 功能：文档目录配置（存 ~/.dsh/storages/dsh-docs-panel/config.json，绝不用 settings.yaml，
 * 避免触发 settings 服务的 watcher 造成前端同步失效）、Markdown 文档扫描与读取、
 * Chrome/VS Code 外部打开、代码复制到剪贴板。
 * 客户端经 HTTP 路由 /docs-panel/api/<method> 调用（POST + JSON）。
 */

export const name = 'dsh-docs-panel'

// 声明硬依赖：Cordis 会等这些服务就绪后再调用 apply。
// 若用 ctx.get() 同步读取，插件可能在服务尚未注册时提前 apply，
// 导致拿到 undefined 而静默失效。
// 注意：不依赖 settings 服务——配置走 ~/.dsh/storages 自管 JSON，与 settings.yaml 彻底解耦。
export const inject = ['fs', 'shell', 'webServer']

const DEFAULT_DIR = '~/.dsh/docs'
const MAX_DOC_BYTES = 3000000
const MAX_COPY_BYTES = 500000

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text.trim()) return {}
  return JSON.parse(text)
}

export function apply(ctx) {
  const fs = ctx.get('fs')
  const shell = ctx.get('shell')
  const webServer = ctx.get('webServer')
  console.log('[dsh-docs-panel] 已加载')

  // inject 已声明硬依赖，此处仅作防御性兜底
  if (fs === undefined || shell === undefined) return

  let homeCache = null
  // 文档目录配置的内存缓存（惰性加载/持久化，见 load/persistConfiguredDir）
  let docsDirCache = null

  // 文档目录配置：存 ~/.dsh/storages/dsh-docs-panel/config.json（自管 JSON，
  // 与 settings.yaml 彻底解耦）。未配置时用默认 ~/.dsh/docs。
  // 结构同 cost-meter 的 storages/<plugin>/ 惯例，避免污染配置根目录。

  // 惰性读配置文件，填充缓存（首次调用或缓存为空时触发）
  async function loadConfiguredDir() {
    if (docsDirCache) return docsDirCache
    try {
      const home = await getHome()
      if (!home) return DEFAULT_DIR
      const cfgPath = home + '/.dsh/storages/dsh-docs-panel/config.json'
      const target = await fs.resolve(cfgPath)
      const info = await fs.stat(target)
      if (info === undefined) return DEFAULT_DIR
      const text = await fs.readText(target)
      const parsed = JSON.parse(text)
      const dir = parsed && typeof parsed.docsDir === 'string' ? parsed.docsDir.trim() : ''
      if (dir.length > 0) { docsDirCache = dir; return dir }
    } catch (error) {
      console.error('[dsh-docs-panel] 读取配置失败（回落默认）：', error && error.message ? error.message : String(error))
    }
    return DEFAULT_DIR
  }

  // 持久化配置到 config.json（惰性，仅在用户主动保存时调用）
  async function persistConfiguredDir(dir) {
    const home = await getHome()
    if (!home) throw new Error('无法获取主目录')
    const dirPath = home + '/.dsh/storages/dsh-docs-panel'
    const cfgPath = dirPath + '/config.json'
    // 确保目录存在（fs 服务无 mkdir，交给 shell）
    try {
      const mkdirSpec = shell.resolve({ command: 'mkdir -p ' + shQuote(dirPath) })
      const mkdirResult = await shell.run(mkdirSpec)
      if (mkdirResult && mkdirResult.exitCode !== undefined && mkdirResult.exitCode !== 0) {
        throw new Error('mkdir 失败，exitCode=' + mkdirResult.exitCode)
      }
    } catch (error) {
      throw new Error('创建配置目录失败：' + (error && error.message ? error.message : String(error)))
    }
    const target = await fs.resolve(cfgPath)
    await fs.writeText(target, JSON.stringify({ docsDir: dir }, null, 2) + '\n')
    docsDirCache = dir
  }

  // 通过 shell 服务获取用户主目录，用于展开 ~ 前缀
  async function getHome() {
    if (homeCache) return homeCache
    try {
      const spec = shell.resolve({ command: 'printf %s "$HOME"' })
      const result = await shell.run(spec)
      const text = result && result.stdout && typeof result.stdout.text === 'string'
        ? result.stdout.text.trim()
        : ''
      if (text.length > 0) homeCache = text.split('\n')[0].trim()
    } catch (error) {
      console.error('[dsh-docs-panel] 获取主目录失败：', error && error.message ? error.message : String(error))
    }
    return homeCache
  }

  async function expandTilde(path) {
    if (path === '~') {
      const home = await getHome()
      return home || path
    }
    if (path.startsWith('~/')) {
      const home = await getHome()
      return home ? home + path.slice(1) : path
    }
    return path
  }

  function joinRel(base, name) {
    return base ? base + '/' + name : name
  }

  function isMarkdown(name) {
    return /\.(md|markdown)$/i.test(name)
  }

  // 相对路径安全校验：禁止绝对路径、反斜杠、空段与 .. 段
  function isSafeRel(rel) {
    if (typeof rel !== 'string' || rel.length === 0) return false
    if (rel.startsWith('/') || rel.includes('\\') || rel.includes('\u0000')) return false
    const parts = rel.split('/')
    for (const part of parts) {
      if (part === '' || part === '.' || part === '..') return false
    }
    return true
  }

  // shell 单引号转义
  function shQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'"
  }

  // 校验 rel 并返回文档目录目标与文件目标（含越界防护）
  async function resolveDocTargets(rel) {
    if (!isSafeRel(rel)) return { ok: false, error: '非法文件名' }
    const absDir = await expandTilde(await loadConfiguredDir())
    let dirTarget
    let fileTarget
    try {
      dirTarget = await fs.resolve(absDir)
      fileTarget = await fs.resolve(absDir.replace(/\/+$/, '') + '/' + rel)
    } catch (error) {
      return { ok: false, error: '文件无法访问' }
    }
    if (!fs.contains(dirTarget, fileTarget)) return { ok: false, error: '不允许访问文档目录之外的文件' }
    return { ok: true, dirTarget: dirTarget, fileTarget: fileTarget, absDir: absDir }
  }

  // 获取当前生效的配置
  async function handleConfig() {
    const dir = await loadConfiguredDir()
    return { ok: true, docsDir: dir, defaultDir: DEFAULT_DIR }
  }

  // 保存文档目录配置（校验目录存在后写入 config.json）
  async function handleConfigSet(args) {
    const dir = args && typeof args.docsDir === 'string' ? args.docsDir.trim() : ''
    if (dir.length === 0) return { ok: false, error: '路径不能为空' }
    const abs = await expandTilde(dir)
    let info
    try {
      const target = await fs.resolve(abs)
      info = await fs.stat(target)
    } catch (error) {
      return { ok: false, error: '路径无法访问：' + dir }
    }
    if (info === undefined) return { ok: false, error: '目录不存在：' + dir }
    if (info.type !== 'directory') return { ok: false, error: '这不是一个文件夹：' + dir }
    try {
      await persistConfiguredDir(dir)
      return { ok: true, docsDir: dir }
    } catch (error) {
      return { ok: false, error: '保存失败：' + (error && error.message ? error.message : String(error)) }
    }
  }

  // 递归列出文档目录下的所有 Markdown 文件
  async function handleDocsList() {
    const rawDir = await loadConfiguredDir()
    const absDir = await expandTilde(rawDir)
    let dirTarget
    try {
      dirTarget = await fs.resolve(absDir)
    } catch (error) {
      return { ok: false, error: '目录无法访问：' + rawDir }
    }
    let rootInfo
    try {
      rootInfo = await fs.stat(dirTarget)
    } catch (error) {
      rootInfo = undefined
    }
    if (rootInfo === undefined) return { ok: false, error: '目录不存在：' + rawDir + '（可在面板设置中修改）' }
    if (rootInfo.type !== 'directory') return { ok: false, error: '这不是一个文件夹：' + rawDir }

    const items = []
    async function walk(target, rel, depth) {
      if (depth > 6 || items.length >= 500) return
      let entries
      try {
        entries = await fs.listDir(target)
      } catch (error) {
        return
      }
      for (const entry of entries) {
        if (entry === undefined || entry === null || typeof entry.name !== 'string') continue
        const name = entry.name
        if (name.startsWith('.')) continue
        const relPath = joinRel(rel, name)
        if (entry.type === 'directory') {
          await walk(entry.target, relPath, depth + 1)
        } else if (entry.type === 'file' && isMarkdown(name)) {
          items.push({ rel: relPath, name: name, dir: rel || '' })
        }
      }
    }
    await walk(dirTarget, '', 0)
    items.sort((a, b) => a.rel.localeCompare(b.rel, 'zh-Hans-CN'))
    return { ok: true, dir: rawDir, items: items }
  }

  // 读取一篇文档
  async function handleDocsRead(args) {
    const rel = args && typeof args.rel === 'string' ? args.rel : ''
    const resolved = await resolveDocTargets(rel)
    if (!resolved.ok) return { ok: false, error: resolved.error }
    let info
    try {
      info = await fs.stat(resolved.fileTarget)
    } catch (error) {
      info = undefined
    }
    if (info === undefined) return { ok: false, error: '文件不存在' }
    if (info.type !== 'file') return { ok: false, error: '不是普通文件' }
    if (typeof info.size === 'number' && info.size > MAX_DOC_BYTES) return { ok: false, error: '文件过大，暂不支持打开' }
    try {
      const text = await fs.readText(resolved.fileTarget)
      return { ok: true, content: text, rel: rel }
    } catch (error) {
      return { ok: false, error: '读取失败：' + (error && error.message ? error.message : String(error)) }
    }
  }

  // 用 Chrome 或 VS Code 打开当前文档
  async function handleDocsOpen(args) {
    const rel = args && typeof args.rel === 'string' ? args.rel : ''
    const app = args && typeof args.app === 'string' ? args.app : 'chrome'
    const appNames = { chrome: 'Google Chrome', vscode: 'Visual Studio Code' }
    const appName = appNames[app]
    if (appName === undefined) return { ok: false, error: '不支持的应用' }
    const resolved = await resolveDocTargets(rel)
    if (!resolved.ok) return { ok: false, error: resolved.error }
    // 用 fs.processPath 拿 canonical 绝对路径（FsTarget 无 displayPath 属性）
    let filePath = resolved.absDir.replace(/\/+$/, '') + '/' + rel
    try {
      filePath = fs.processPath(resolved.fileTarget)
    } catch (error) { /* 回退到拼接路径 */ }
    try {
      const spec = shell.resolve({ command: 'open -a ' + shQuote(appName) + ' ' + shQuote(filePath) })
      const result = await shell.run(spec)
      if (result.exitCode === 0) return { ok: true, path: filePath }
      const errText = result && result.stderr && typeof result.stderr.text === 'string' ? result.stderr.text.trim() : ''
      return { ok: false, error: '打开失败：' + (errText || '应用可能未安装') }
    } catch (error) {
      return { ok: false, error: '打开失败：' + (error && error.message ? error.message : String(error)) }
    }
  }

  // 复制文本到系统剪贴板（macOS pbcopy）
  async function handleDocsCopy(args) {
    const text = args && typeof args.text === 'string' ? args.text : ''
    if (text.length === 0) return { ok: false, error: '没有可复制的内容' }
    if (text.length > MAX_COPY_BYTES) return { ok: false, error: '内容过长，无法复制' }
    try {
      const spec = shell.resolve({ command: 'pbcopy', stdin: text })
      const result = await shell.run(spec)
      if (result.exitCode === 0) return { ok: true }
      return { ok: false, error: '复制失败' }
    } catch (error) {
      return { ok: false, error: '复制失败：' + (error && error.message ? error.message : String(error)) }
    }
  }

  const dispatch = {
    'config': handleConfig,
    'config.set': handleConfigSet,
    'docs.list': handleDocsList,
    'docs.read': handleDocsRead,
    'docs.open': handleDocsOpen,
    'docs.copy': handleDocsCopy,
  }

  // 客户端 RPC：HTTP 路由（正式插件形态，重启后依然生效）
  if (webServer !== undefined) {
    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/docs-panel/api',
      handler: async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const method = (url.pathname.replace(/^\/docs-panel\/api\/?/, '') || '').replace(/\/+$/, '')
        const fn = Object.prototype.hasOwnProperty.call(dispatch, method) ? dispatch[method] : null
        if (fn === null || req.method !== 'POST') {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'no such route: ' + req.method + ' ' + method }))
          return
        }
        try {
          const args = await readJsonBody(req)
          const value = await fn(args || {})
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(value))
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: String((error && error.message) || error) }))
        }
      },
    }))
    console.log('[dsh-docs-panel] /docs-panel/api 路由已注册')
  } else {
    console.warn('[dsh-docs-panel] webServer 服务不可用，客户端接口未注册')
  }
}
