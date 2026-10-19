/**
 * dsh-docs-panel 的路径与名称纯逻辑（无 IO、无插件依赖）。
 *
 * 独立成文件是为了可测：宿主端 `lib/index.js` 读写文件时绕开了 `ctx.fs`
 * （沙箱后端不允许写 $DSH_HOME），因此「目标必须在文档目录之内」这条约束
 * 由本模块的判定配合宿主端的 realpath 解析共同保证，值得单独自测
 * （见 fs-ops-test.cjs）。
 */

import { relative, isAbsolute, sep } from 'node:path'

/** 拼接相对路径（始终用 '/' 分隔，展示与传输统一）。 */
export function joinRel(base, name) {
  return base ? base + '/' + name : name
}

/** 是否是 Markdown 文件（列表只收录这类文件）。 */
export function isMarkdown(name) {
  return /\.(md|markdown)$/i.test(name)
}

/**
 * 相对路径安全校验：禁止绝对路径、反斜杠、空段、`.`/`..` 段，以及隐藏段
 * （以 `.` 开头的段——回收站 `.trash` 等内部目录绝不能被客户端直接寻址）。
 * @param rel - 以 '/' 分段的相对路径。
 */
export function isSafeRel(rel) {
  if (typeof rel !== 'string' || rel.length === 0) return false
  if (rel.startsWith('/') || rel.includes('\\') || rel.includes('\u0000')) return false
  const parts = rel.split('/')
  for (const part of parts) {
    if (part === '' || part === '.' || part === '..' || part.startsWith('.')) return false
  }
  return true
}

/** Windows 设备保留名（带不带扩展名都算）。 */
const WIN_RESERVED_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

/** 名称长度上限（字符数）。 */
export const MAX_NAME_LENGTH = 120

/**
 * 校验用户输入的单段名称（mkdir / createFile / rename 共用）。
 *
 * 只允许 Markdown 文件：没有扩展名时自动补 `.md`，给了别的扩展名一律拒绝。
 * 同时挡掉 Windows 上会出问题的名字（非法字符、结尾空格/点、设备保留名）
 * 与隐藏名（以点开头，新建出来在列表里也看不见）。
 *
 * @param name - 原始输入。
 * @param kind - 'file' 或 'dir'。
 * @returns {{ok: true, name: string} | {ok: false, error: string}}
 */
export function validateEntryName(name, kind) {
  if (typeof name !== 'string') return { ok: false, error: '名称无效' }
  const trimmed = name.trim()
  if (trimmed.length === 0) return { ok: false, error: '名称不能为空' }
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, error: '名称过长（上限 ' + MAX_NAME_LENGTH + ' 字符）' }
  if (trimmed === '.' || trimmed === '..') return { ok: false, error: '名称无效' }
  if (trimmed.startsWith('.')) return { ok: false, error: '名称不能以点开头' }
  if (trimmed.includes('/') || trimmed.includes('\\')) return { ok: false, error: '名称不能包含路径分隔符' }
  if (/[<>:"|?*\u0000-\u001f]/.test(trimmed)) return { ok: false, error: '名称包含非法字符' }
  if (/[. ]$/.test(trimmed)) return { ok: false, error: '名称不能以空格或点结尾' }
  if (WIN_RESERVED_NAME.test(trimmed.split('.')[0])) return { ok: false, error: '这是系统保留名称' }
  if (kind === 'file') {
    if (!/\.[A-Za-z0-9]+$/.test(trimmed)) return { ok: true, name: trimmed + '.md' }
    if (!isMarkdown(trimmed)) return { ok: false, error: '只允许新建 Markdown 文件（.md / .markdown）' }
  }
  return { ok: true, name: trimmed }
}

/**
 * 目标是否位于 parent 之下（含相等）。用 `path.relative` 判定，平台分隔符、
 * Windows 大小写与盘符差异都交给 Node 处理，只排除“上跳”的结果。
 * @param parent - 已 canonical 化的父路径。
 * @param child - 已 canonical 化的子路径。
 */
export function isUnder(parent, child) {
  const rel = relative(parent, child)
  if (rel === '') return true
  if (isAbsolute(rel)) return false
  return rel !== '..' && !rel.startsWith('..' + sep)
}

/**
 * 由扁平条目构建嵌套树。条目形如 `{ rel, type: 'dir' | 'file' }`；
 * 目录即使为空也必须保留（否则用户新建的空文件夹在列表里会立刻“消失”）。
 * 折叠状态由客户端维护，这里只保证顺序稳定：目录在前，同类按名称排序。
 *
 * @param entries - 扁平条目列表。
 * @returns 根节点 `{ name: '', rel: '', type: 'dir', children: [] }`
 */
export function buildTree(entries) {
  const root = { name: '', rel: '', type: 'dir', children: [] }
  const dirs = new Map([['', root]])

  function ensureDir(rel) {
    const cached = dirs.get(rel)
    if (cached !== undefined) return cached
    const cut = rel.lastIndexOf('/')
    const parentRel = cut === -1 ? '' : rel.slice(0, cut)
    const node = { name: rel.slice(cut + 1), rel: rel, type: 'dir', children: [] }
    ensureDir(parentRel).children.push(node)
    dirs.set(rel, node)
    return node
  }

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || typeof entry.rel !== 'string') continue
    if (entry.type === 'dir') {
      ensureDir(entry.rel)
      continue
    }
    const cut = entry.rel.lastIndexOf('/')
    const parentRel = cut === -1 ? '' : entry.rel.slice(0, cut)
    ensureDir(parentRel).children.push({
      name: entry.rel.slice(cut + 1),
      rel: entry.rel,
      type: 'file',
      children: [],
    })
  }

  sortTree(root)
  return root
}

/** 递归排序：目录优先，再按中文友好的名称顺序。 */
export function sortTree(node) {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
  for (const child of node.children) {
    if (child.type === 'dir') sortTree(child)
  }
}

/** 收集树里全部目录的相对路径（客户端用于默认展开）。 */
export function collectDirRels(node, out) {
  const acc = out === undefined ? [] : out
  for (const child of node.children) {
    if (child.type !== 'dir') continue
    acc.push(child.rel)
    collectDirRels(child, acc)
  }
  return acc
}
