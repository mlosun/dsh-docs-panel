/**
 * dsh-docs-panel 宿主端。
 *
 * 功能：文档目录配置（存 $DSH_HOME/storages/dsh-docs-panel/config.json，默认 ~/.dsh/…，
 * 绝不用 settings.yaml，避免触发 settings 服务的 watcher 造成前端同步失效）、
 * Markdown 文档扫描与读取、Chrome/VS Code 外部打开、代码复制到剪贴板。
 * 客户端经 HTTP 路由 /docs-panel/api/<method> 调用（POST + JSON）。
 */

import { homedir } from 'node:os'
import { mkdir, readFile, writeFile, realpath, rename, rm, readdir, stat } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { buildTree, isMarkdown, isSafeRel, isUnder, joinRel, validateEntryName } from './paths.js'

export const name = 'dsh-docs-panel'

// 声明硬依赖：Cordis 会等这些服务就绪后再调用 apply。
// 若用 ctx.get() 同步读取，插件可能在服务尚未注册时提前 apply，
// 导致拿到 undefined 而静默失效。
// 注意：不依赖 settings 服务——配置走 $DSH_HOME/storages 自管 JSON，与 settings.yaml 彻底解耦。
export const inject = ['fs', 'shell', 'webServer']

const DEFAULT_DIR = '~/.dsh/docs'
const MAX_DOC_BYTES = 3000000
const MAX_COPY_BYTES = 500000
// 列表条目（目录 + 文件）上限与递归深度上限，防止超大目录拖垮面板
const MAX_LIST_ENTRIES = 500
const MAX_LIST_DEPTH = 6
// 回收站目录名（位于文档目录内，客户端不可直接寻址）
const TRASH_DIR_NAME = '.trash'
// 回收站条目 id 白名单（同时用于防目录穿越）
const TRASH_ID_PATTERN = /^[A-Za-z0-9._-]+$/

const IS_WINDOWS = process.platform === 'win32'

// Harness 主目录：$DSH_HOME 覆盖优先，否则 ~/.dsh（与 dsh-home-paths 的
// resolveDshHome 规则一致）。不走 shell 取主目录——printf/$HOME 只在 POSIX
// shell 下成立，Windows 的 shell 服务是 pwsh，会静默返回空 stdout。
function harnessHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim()
  return join(homedir(), '.dsh')
}

// 插件自管配置目录 / 文件：$DSH_HOME/storages/dsh-docs-panel/(config.json)
function configDirPath() {
  return join(harnessHome(), 'storages', 'dsh-docs-panel')
}

function configPath() {
  return join(configDirPath(), 'config.json')
}

// 展开 ~、~/、~\ 前缀（用 OS 主目录，跨平台；Windows 也识别 ~\）
function expandTilde(path) {
  if (typeof path !== 'string' || path.length === 0) return path
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

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

  // 文档目录配置的内存缓存（惰性加载/持久化，见 load/persistConfiguredDir）
  let docsDirCache = null

  // 文档目录配置：存 $DSH_HOME/storages/dsh-docs-panel/config.json（自管 JSON，
  // 与 settings.yaml 彻底解耦）。未配置时用默认 ~/.dsh/docs。
  // 结构同 cost-meter 的 storages/<plugin>/ 惯例，避免污染配置根目录。
  //
  // 读写直接走 node:fs，不经 ctx.fs / ctx.shell：
  // - ctx.fs 是沙箱后端（dsh-fs-sandbox），workspace-write 下只允许写工作区和
  //   系统临时目录，$DSH_HOME 下的写入会被判 FS_SANDBOX_DENIED；
  // - 主目录不再靠 shell 取（见上方 harnessHome 的说明）。

  // 惰性读配置文件，填充缓存（首次调用或缓存为空时触发）
  async function loadConfiguredDir() {
    if (docsDirCache) return docsDirCache
    try {
      const text = await readFile(configPath(), 'utf8')
      const parsed = JSON.parse(text)
      const dir = parsed && typeof parsed.docsDir === 'string' ? parsed.docsDir.trim() : ''
      if (dir.length > 0) { docsDirCache = dir; return dir }
    } catch (error) {
      // 首次使用时文件不存在属正常路径，只有真正的读/解析失败才记日志
      const code = error && error.code
      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        console.error('[dsh-docs-panel] 读取配置失败（回落默认）：', error && error.message ? error.message : String(error))
      }
    }
    return DEFAULT_DIR
  }

  // 持久化配置到 config.json（惰性，仅在用户主动保存时调用）
  async function persistConfiguredDir(dir) {
    try {
      await mkdir(configDirPath(), { recursive: true })
    } catch (error) {
      throw new Error('创建配置目录失败：' + (error && error.message ? error.message : String(error)))
    }
    try {
      await writeFile(configPath(), JSON.stringify({ docsDir: dir }, null, 2) + '\n', 'utf8')
    } catch (error) {
      throw new Error('写入配置文件失败：' + (error && error.message ? error.message : String(error)))
    }
    docsDirCache = dir
  }

  // joinRel / isMarkdown / isSafeRel 已移到 ./paths.js（纯逻辑，可自测）

  // POSIX shell 单引号转义（macOS 用）
  function shQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'"
  }

  // PowerShell 单引号转义（'' 表示一个字面 '，Windows 用）
  function psQuote(value) {
    return "'" + String(value).replace(/'/g, "''") + "'"
  }

  // 校验 rel 并返回文档目录目标与文件目标（含越界防护）
  async function resolveDocTargets(rel) {
    if (!isSafeRel(rel)) return { ok: false, error: '非法文件名' }
    const absDir = expandTilde(await loadConfiguredDir())
    let dirTarget
    let fileTarget
    try {
      dirTarget = await fs.resolve(absDir)
      fileTarget = await fs.resolve(join(absDir, rel))
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
    const abs = expandTilde(dir)
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

  // 递归扫描文档目录，返回「目录 + Markdown 文件」的嵌套树。
  // 目录即使为空也要收录，否则用户新建的空文件夹会立刻从列表里消失。
  // 以 `.` 开头的一律跳过（回收站 .trash 等内部项不进 UI）。
  async function handleDocsList() {
    const rawDir = await loadConfiguredDir()
    const absDir = expandTilde(rawDir)
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

    const entries = []
    let truncated = false
    async function walk(target, rel, depth) {
      if (depth > MAX_LIST_DEPTH) return
      if (entries.length >= MAX_LIST_ENTRIES) { truncated = true; return }
      let children
      try {
        children = await fs.listDir(target)
      } catch (error) {
        return
      }
      for (const entry of children) {
        if (entry === undefined || entry === null || typeof entry.name !== 'string') continue
        const name = entry.name
        if (name.startsWith('.')) continue
        if (entries.length >= MAX_LIST_ENTRIES) { truncated = true; return }
        const relPath = joinRel(rel, name)
        if (entry.type === 'directory') {
          entries.push({ rel: relPath, type: 'dir' })
          await walk(entry.target, relPath, depth + 1)
        } else if (entry.type === 'file' && isMarkdown(name)) {
          entries.push({ rel: relPath, type: 'file' })
        }
      }
    }
    await walk(dirTarget, '', 0)
    let fileCount = 0
    for (const entry of entries) if (entry.type === 'file') fileCount += 1
    return { ok: true, dir: rawDir, tree: buildTree(entries), fileCount: fileCount, truncated: truncated }
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

  // 用 Chrome 或 VS Code 打开当前文档（macOS 走 open -a，Windows 走 Start-Process）
  async function handleDocsOpen(args) {
    const rel = args && typeof args.rel === 'string' ? args.rel : ''
    const app = args && typeof args.app === 'string' ? args.app : 'chrome'
    // macOS：应用显示名；Windows：可执行名（chrome 走 App Paths，code 需在 PATH 上）
    const POSIX_APPS = { chrome: 'Google Chrome', vscode: 'Visual Studio Code' }
    const WIN_APPS = { chrome: 'chrome', vscode: 'code' }
    if (POSIX_APPS[app] === undefined || WIN_APPS[app] === undefined) return { ok: false, error: '不支持的应用' }
    const resolved = await resolveDocTargets(rel)
    if (!resolved.ok) return { ok: false, error: resolved.error }
    // 用 fs.processPath 拿 canonical 绝对路径（FsTarget 无 displayPath 属性）
    let filePath = join(resolved.absDir, rel)
    try {
      filePath = fs.processPath(resolved.fileTarget)
    } catch (error) { /* 回退到拼接路径 */ }
    try {
      const command = IS_WINDOWS
        ? 'Start-Process -FilePath ' + psQuote(WIN_APPS[app]) + ' -ArgumentList ' + psQuote(filePath)
        : 'open -a ' + shQuote(POSIX_APPS[app]) + ' ' + shQuote(filePath)
      const spec = shell.resolve({ command: command })
      // ShellExecutor 的接口是 resolve() + execute()：execute 返回进程句柄，
      // 前台结果要用句柄上的 result() 才拿得到（含 exitCode / stderr）。
      const result = await (await shell.execute(spec)).result()
      if (result.exitCode === 0) return { ok: true, path: filePath }
      const errText = result && result.stderr && typeof result.stderr.text === 'string' ? result.stderr.text.trim() : ''
      return { ok: false, error: '打开失败：' + (errText || '应用可能未安装') }
    } catch (error) {
      return { ok: false, error: '打开失败：' + (error && error.message ? error.message : String(error)) }
    }
  }

  // 复制文本到系统剪贴板（macOS pbcopy，Windows Set-Clipboard）
  async function handleDocsCopy(args) {
    const text = args && typeof args.text === 'string' ? args.text : ''
    if (text.length === 0) return { ok: false, error: '没有可复制的内容' }
    if (text.length > MAX_COPY_BYTES) return { ok: false, error: '内容过长，无法复制' }
    try {
      // Windows 侧显式用 UTF-8 解码 stdin：pwsh 的 [Console]::In 受控制台代码页
      // 影响，直接读取会把中文变成乱码；这里绕开控制台编码。
      const command = IS_WINDOWS
        ? '$s=[IO.StreamReader]::new([Console]::OpenStandardInput(),[Text.UTF8Encoding]::new($false)); Set-Clipboard -Value $s.ReadToEnd()'
        : 'pbcopy'
      const spec = shell.resolve({ command: command, stdin: text })
      const result = await (await shell.execute(spec)).result()
      if (result.exitCode === 0) return { ok: true }
      return { ok: false, error: '复制失败' }
    } catch (error) {
      return { ok: false, error: '复制失败：' + (error && error.message ? error.message : String(error)) }
    }
  }

  // ---------- 文档目录内的写操作 ----------
  //
  // 这些操作直接走 node:fs，不能用 ctx.fs：它是沙箱后端（dsh-fs-sandbox），
  // workspace-write 下只允许写工作区与系统临时目录，文档目录常在工作区之外。
  // 代价是「目标必须在文档目录之内」这条约束要自己保证：先做纯逻辑校验
  // （isSafeRel / validateEntryName），再把目标 canonical 化（realpath 到最近
  // 已存在的祖先）后与 canonical 的文档目录比较，从而挡住符号链接 / junction
  // 指向目录外的逃逸。

  function errorText(error) {
    return error && error.message ? error.message : String(error)
  }

  async function realpathOrNull(path) {
    try {
      return await realpath(path)
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return null
      throw error
    }
  }

  // 把 path 的最近已存在祖先 realpath 化，再拼回缺失的后缀。
  // 目标可能还不存在（新建），但祖先里如果有链接指向外部，这里就会暴露出来。
  async function canonicalizePath(path) {
    let current = path
    const missing = []
    for (;;) {
      const real = await realpathOrNull(current)
      if (real !== null) return missing.length === 0 ? real : join(real, ...missing.reverse())
      const parent = dirname(current)
      if (parent === current) return null
      missing.push(basename(current))
      current = parent
    }
  }

  // 把 rel 解析成文档目录内的绝对路径（canonical），越界即拒绝
  async function resolveInsideDocs(rel) {
    const root = expandTilde(await loadConfiguredDir())
    let rootReal
    try {
      rootReal = await realpath(root)
    } catch (error) {
      return { ok: false, error: '文档目录无法访问：' + root }
    }
    let canonical
    try {
      canonical = await canonicalizePath(join(root, rel))
    } catch (error) {
      return { ok: false, error: '路径无法访问' }
    }
    if (canonical === null || !isUnder(rootReal, canonical)) {
      return { ok: false, error: '不允许操作文档目录之外的文件' }
    }
    return { ok: true, root: rootReal, rel: rel, abs: canonical }
  }

  async function statOrUndefined(path) {
    try {
      return await stat(path)
    } catch (error) {
      return undefined
    }
  }

  function resolveParentRel(rel) {
    const cut = rel.lastIndexOf('/')
    return { parentRel: cut === -1 ? '' : rel.slice(0, cut), name: rel.slice(cut + 1) }
  }

  // 新建文件夹：rel 为父目录相对路径（'' = 文档根），name 为单段名称
  async function handleMkdir(args) {
    const parentRel = args && typeof args.rel === 'string' ? args.rel.trim() : ''
    if (parentRel !== '' && !isSafeRel(parentRel)) return { ok: false, error: '非法路径' }
    const name = validateEntryName(args && args.name, 'dir')
    if (!name.ok) return { ok: false, error: name.error }
    const rel = joinRel(parentRel, name.name)
    const resolved = await resolveInsideDocs(rel)
    if (!resolved.ok) return resolved
    try {
      await mkdir(resolved.abs, { recursive: false })
    } catch (error) {
      if (error && error.code === 'EEXIST') return { ok: false, error: '已存在同名文件夹' }
      if (error && error.code === 'ENOENT') return { ok: false, error: '上级目录不存在' }
      return { ok: false, error: '创建文件夹失败：' + errorText(error) }
    }
    return { ok: true, rel: rel }
  }

  // 新建空 Markdown 文件
  async function handleCreateFile(args) {
    const parentRel = args && typeof args.rel === 'string' ? args.rel.trim() : ''
    if (parentRel !== '' && !isSafeRel(parentRel)) return { ok: false, error: '非法路径' }
    const name = validateEntryName(args && args.name, 'file')
    if (!name.ok) return { ok: false, error: name.error }
    const rel = joinRel(parentRel, name.name)
    const resolved = await resolveInsideDocs(rel)
    if (!resolved.ok) return resolved
    try {
      await writeFile(resolved.abs, '', { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if (error && error.code === 'EEXIST') return { ok: false, error: '已存在同名文件' }
      if (error && error.code === 'ENOENT') return { ok: false, error: '上级目录不存在' }
      return { ok: false, error: '新建文件失败：' + errorText(error) }
    }
    return { ok: true, rel: rel }
  }

  // 同卷原子写：先写同目录临时文件再 rename 覆盖，避免写到一半进程被杀导致
  // 正文被截断。临时名不以 .md 结尾，因此不会出现在文件树里。
  async function writeFileAtomic(path, text) {
    const tmp = join(dirname(path), basename(path) + '.dsp-save-' + Math.random().toString(36).slice(2, 8))
    try {
      await writeFile(tmp, text, 'utf8')
      await rename(tmp, path)
    } catch (error) {
      try { await rm(tmp, { force: true }) } catch (cleanupError) { /* 尽力清理 */ }
      throw error
    }
  }

  // 保存 Markdown 正文（面板内编辑器用）
  async function handleDocsSave(args) {
    const rel = args && typeof args.rel === 'string' ? args.rel.trim() : ''
    if (!isSafeRel(rel)) return { ok: false, error: '非法路径' }
    if (!isMarkdown(rel)) return { ok: false, error: '只能保存 Markdown 文件' }
    const text = args && typeof args.content === 'string' ? args.content : null
    if (text === null) return { ok: false, error: '缺少要保存的内容' }
    const bytes = Buffer.byteLength(text, 'utf8')
    if (bytes > MAX_DOC_BYTES) return { ok: false, error: '内容过大，暂不支持保存（上限 ' + MAX_DOC_BYTES + ' 字节）' }
    const target = await resolveInsideDocs(rel)
    if (!target.ok) return target
    const info = await statOrUndefined(target.abs)
    if (info === undefined) return { ok: false, error: '文件不存在（可能已被删除或移动）' }
    if (info.isDirectory()) return { ok: false, error: '这是一个文件夹，不能保存' }
    try {
      await writeFileAtomic(target.abs, text)
    } catch (error) {
      return { ok: false, error: '保存失败：' + errorText(error) }
    }
    return { ok: true, rel: rel, bytes: bytes }
  }

  // 同目录内重命名（单段名称，不改层级，也不覆盖已存在项）
  async function handleRename(args) {
    const rel = args && typeof args.rel === 'string' ? args.rel.trim() : ''
    if (!isSafeRel(rel)) return { ok: false, error: '非法路径' }
    const src = await resolveInsideDocs(rel)
    if (!src.ok) return src
    const info = await statOrUndefined(src.abs)
    if (info === undefined) return { ok: false, error: '目标不存在' }
    const name = validateEntryName(args && args.name, info.isDirectory() ? 'dir' : 'file')
    if (!name.ok) return { ok: false, error: name.error }
    const parts = resolveParentRel(rel)
    if (name.name === parts.name) return { ok: true, rel: rel }
    const nextRel = joinRel(parts.parentRel, name.name)
    const dst = await resolveInsideDocs(nextRel)
    if (!dst.ok) return dst

    if ((await statOrUndefined(dst.abs)) !== undefined) {
      // 大小写不敏感的文件系统（Windows / macOS 默认）上，readme.md → README.md
      // 会解析回同一个文件：这不是“重名”，而是改磁盘上的大小写。用 realpath
      // 比出这是同一个文件后才放行，其余情况一律按重名拒绝。
      const srcReal = await realpathOrNull(src.abs)
      const dstReal = await realpathOrNull(dst.abs)
      if (srcReal === null || dstReal === null || srcReal !== dstReal) {
        return { ok: false, error: '已存在同名项' }
      }
      // 目标要用「请求的字面路径」而不是 canonical：canonical 会被 realpath
      // 还原成磁盘上的旧大小写，直接 rename 过去等于什么都没改。先落临时名
      // 再改成目标名，才能在大小写不敏感的文件系统上真正改写存储大小写。
      const dstLiteral = join(dst.root, nextRel)
      const tmpAbs = join(dirname(dstLiteral), name.name + '.dsp-tmp-' + Math.random().toString(36).slice(2, 8))
      try {
        await rename(src.abs, tmpAbs)
        await rename(tmpAbs, dstLiteral)
      } catch (error) {
        try { await rename(tmpAbs, src.abs) } catch (rollbackError) { /* 回滚失败则保留原状 */ }
        return { ok: false, error: '重命名失败：' + errorText(error) }
      }
      return { ok: true, rel: nextRel }
    }

    try {
      await rename(src.abs, dst.abs)
    } catch (error) {
      return { ok: false, error: '重命名失败：' + errorText(error) }
    }
    return { ok: true, rel: nextRel }
  }

  // 回收站条目 id：时间戳 + 随机后缀（便于人工辨认，也避免同毫秒冲突）
  function makeTrashId() {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
    return stamp + '-' + Math.random().toString(36).slice(2, 8)
  }

  // 删除 = 移入 <文档目录>/.trash/<id>/（payload 保存原内容，meta.json 记原路径）。
  // 回收站就在文档目录内，因此是同卷 rename，不会出现跨设备 EXDEV。
  async function handleRemove(args) {
    const rel = args && typeof args.rel === 'string' ? args.rel.trim() : ''
    if (rel.length === 0) return { ok: false, error: '不能删除文档根目录' }
    if (!isSafeRel(rel)) return { ok: false, error: '非法路径' }
    const src = await resolveInsideDocs(rel)
    if (!src.ok) return src
    const info = await statOrUndefined(src.abs)
    if (info === undefined) return { ok: false, error: '目标不存在' }
    const id = makeTrashId()
    const entryDir = join(src.root, TRASH_DIR_NAME, id)
    const meta = {
      id: id,
      rel: rel,
      name: basename(rel),
      type: info.isDirectory() ? 'directory' : 'file',
      deletedAt: new Date().toISOString(),
    }
    try {
      await mkdir(entryDir, { recursive: true })
      await writeFile(join(entryDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8')
      await rename(src.abs, join(entryDir, 'payload'))
    } catch (error) {
      try { await rm(entryDir, { recursive: true, force: true }) } catch (cleanupError) { /* 尽力而为 */ }
      return { ok: false, error: '移入回收站失败：' + errorText(error) }
    }
    return { ok: true, id: id, rel: rel }
  }

  // 校验回收站条目 id 并返回其目录（id 白名单挡住 .. 与路径分隔符）
  async function trashEntry(id) {
    if (typeof id !== 'string' || !TRASH_ID_PATTERN.test(id)) return null
    if (id === '.' || id === '..') return null
    const root = expandTilde(await loadConfiguredDir())
    let rootReal
    try {
      rootReal = await realpath(root)
    } catch (error) {
      return null
    }
    return { dir: join(rootReal, TRASH_DIR_NAME, id) }
  }

  async function readTrashMeta(entryDir) {
    try {
      const parsed = JSON.parse(await readFile(join(entryDir, 'meta.json'), 'utf8'))
      return parsed !== null && typeof parsed === 'object' ? parsed : null
    } catch (error) {
      return null
    }
  }

  async function handleTrashList() {
    const root = expandTilde(await loadConfiguredDir())
    let rootReal
    try {
      rootReal = await realpath(root)
    } catch (error) {
      return { ok: true, items: [] }
    }
    let names
    try {
      names = await readdir(join(rootReal, TRASH_DIR_NAME))
    } catch (error) {
      return { ok: true, items: [] }
    }
    const items = []
    for (const id of names) {
      if (!TRASH_ID_PATTERN.test(id) || id === '.' || id === '..') continue
      const meta = await readTrashMeta(join(rootReal, TRASH_DIR_NAME, id))
      if (meta === null) continue
      items.push({
        id: id,
        rel: typeof meta.rel === 'string' ? meta.rel : '',
        type: meta.type === 'directory' ? 'directory' : 'file',
        deletedAt: typeof meta.deletedAt === 'string' ? meta.deletedAt : '',
      })
    }
    items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    return { ok: true, items: items }
  }

  async function handleTrashRestore(args) {
    const entry = await trashEntry(args && args.id)
    if (entry === null) return { ok: false, error: '回收站条目无效' }
    const meta = await readTrashMeta(entry.dir)
    if (meta === null || typeof meta.rel !== 'string' || !isSafeRel(meta.rel)) {
      return { ok: false, error: '回收站记录已损坏，无法恢复' }
    }
    const rel = meta.rel
    const dst = await resolveInsideDocs(rel)
    if (!dst.ok) return dst
    if ((await statOrUndefined(dst.abs)) !== undefined) return { ok: false, error: '原位置已有同名项，请先处理' }
    try {
      await mkdir(dirname(dst.abs), { recursive: true })
      await rename(join(entry.dir, 'payload'), dst.abs)
    } catch (error) {
      return { ok: false, error: '恢复失败：' + errorText(error) }
    }
    try { await rm(entry.dir, { recursive: true, force: true }) } catch (error) { /* 清理失败不影响恢复结果 */ }
    return { ok: true, rel: rel }
  }

  async function handleTrashPurge(args) {
    const entry = await trashEntry(args && args.id)
    if (entry === null) return { ok: false, error: '回收站条目无效' }
    try {
      await rm(entry.dir, { recursive: true, force: true })
    } catch (error) {
      return { ok: false, error: '彻底删除失败：' + errorText(error) }
    }
    return { ok: true }
  }

  async function handleTrashEmpty() {
    const root = expandTilde(await loadConfiguredDir())
    let rootReal
    try {
      rootReal = await realpath(root)
    } catch (error) {
      return { ok: false, error: '文档目录无法访问' }
    }
    try {
      await rm(join(rootReal, TRASH_DIR_NAME), { recursive: true, force: true })
    } catch (error) {
      return { ok: false, error: '清空回收站失败：' + errorText(error) }
    }
    return { ok: true }
  }

  const dispatch = {
    'config': handleConfig,
    'config.set': handleConfigSet,
    'docs.list': handleDocsList,
    'docs.read': handleDocsRead,
    'docs.open': handleDocsOpen,
    'docs.copy': handleDocsCopy,
    'docs.mkdir': handleMkdir,
    'docs.createFile': handleCreateFile,
    'docs.save': handleDocsSave,
    'docs.rename': handleRename,
    'docs.remove': handleRemove,
    'docs.trash.list': handleTrashList,
    'docs.trash.restore': handleTrashRestore,
    'docs.trash.purge': handleTrashPurge,
    'docs.trash.empty': handleTrashEmpty,
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
