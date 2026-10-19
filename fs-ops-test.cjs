// 文件管理相关纯逻辑自测：直接导入 lib/paths.js（ESM），验证名称校验、
// 路径包含性与目录树构建的安全边界。
// 运行：node fs-ops-test.cjs
const path = require('node:path')
const { pathToFileURL } = require('node:url')

let pass = 0
let fail = 0

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    pass += 1
    console.log('PASS  ' + name)
  } else {
    fail += 1
    console.log('FAIL  ' + name)
    console.log('      期望 ' + e)
    console.log('      实际 ' + a)
  }
}

;(async function main() {
  const {
    joinRel,
    isMarkdown,
    isSafeRel,
    validateEntryName,
    isUnder,
    buildTree,
    collectDirRels,
    MAX_NAME_LENGTH,
  } = await import(pathToFileURL(path.join(__dirname, 'lib', 'paths.js')).href)

  // ---- joinRel ----
  check('joinRel 根级', joinRel('', 'a.md'), 'a.md')
  check('joinRel 子级', joinRel('sub', 'a.md'), 'sub/a.md')

  // ---- isMarkdown ----
  check('isMarkdown .md', isMarkdown('a.md'), true)
  check('isMarkdown 大写 .MARKDOWN', isMarkdown('A.MARKDOWN'), true)
  check('isMarkdown .txt', isMarkdown('a.txt'), false)

  // ---- isSafeRel ----
  const safeOk = ['a.md', 'sub/a.md', 'a-b_c/1.md', '目录/笔记.md']
  for (const rel of safeOk) check('isSafeRel 允许 ' + JSON.stringify(rel), isSafeRel(rel), true)
  const safeBad = [
    '',
    '/abs.md',
    'a\\b.md',
    'a/../b.md',
    'a/./b.md',
    'a//b.md',
    './a.md',
    '..',
    '.trash/x',
    '.hidden',
    'a/.hidden',
  ]
  for (const rel of safeBad) check('isSafeRel 拒绝 ' + JSON.stringify(rel), isSafeRel(rel), false)

  // ---- validateEntryName（目录）----
  check('目录名原样通过', validateEntryName('笔记', 'dir'), { ok: true, name: '笔记' })
  check('目录名去首尾空格', validateEntryName('  notes 2026  ', 'dir'), { ok: true, name: 'notes 2026' })
  check('目录名不能为空', validateEntryName('   ', 'dir').ok, false)
  check('目录名不能是 .', validateEntryName('.', 'dir').ok, false)
  check('目录名不能是 ..', validateEntryName('..', 'dir').ok, false)
  check('目录名不能以点开头', validateEntryName('.hidden', 'dir').ok, false)
  check('目录名不能带分隔符', validateEntryName('a/b', 'dir').ok, false)
  check('目录名不能带反斜杠', validateEntryName('a\\b', 'dir').ok, false)
  check('目录名拒绝非法字符', validateEntryName('a<b', 'dir').ok, false)
  check('目录名拒绝冒号', validateEntryName('a:b', 'dir').ok, false)
  check('目录名拒绝问号', validateEntryName('a?b', 'dir').ok, false)
  check('目录名拒绝结尾点', validateEntryName('a.', 'dir').ok, false)
  check('目录名拒绝保留名 CON', validateEntryName('CON', 'dir').ok, false)
  check('目录名拒绝保留名 com1', validateEntryName('com1', 'dir').ok, false)
  check('目录名拒绝保留名 NUL.md', validateEntryName('NUL.md', 'dir').ok, false)
  check('目录名超长拒绝', validateEntryName('x'.repeat(MAX_NAME_LENGTH + 1), 'dir').ok, false)

  // ---- validateEntryName（文件）----
  check('文件名无扩展名自动补 .md', validateEntryName('README', 'file'), { ok: true, name: 'README.md' })
  check('文件名 .md 原样', validateEntryName('a.md', 'file'), { ok: true, name: 'a.md' })
  check('文件名 .MARKDOWN 原样', validateEntryName('a.MARKDOWN', 'file'), { ok: true, name: 'a.MARKDOWN' })
  check('文件名多点 .md 通过', validateEntryName('notes.v2.md', 'file'), { ok: true, name: 'notes.v2.md' })
  check('文件名 .txt 拒绝', validateEntryName('a.txt', 'file').ok, false)
  check('文件名 .json 拒绝', validateEntryName('a.json', 'file').ok, false)
  check('文件名结尾点拒绝', validateEntryName('a.', 'file').ok, false)
  check('文件名尾部空格被裁剪后补 .md', validateEntryName('a ', 'file'), { ok: true, name: 'a.md' })
  check('文件名大写保留名拒绝', validateEntryName('lpt9.md', 'file').ok, false)
  check('名称长度上限为 120', MAX_NAME_LENGTH, 120)

  // ---- isUnder ----
  const root = path.join(__dirname, 'docs')
  check('isUnder 直接子项', isUnder(root, path.join(root, 'a.md')), true)
  check('isUnder 深层子项', isUnder(root, path.join(root, 'a', 'b', 'c.md')), true)
  check('isUnder 自身算在内', isUnder(root, root), true)
  check('isUnder 父目录不算', isUnder(root, __dirname), false)
  check('isUnder 兄弟目录不算', isUnder(root, path.join(__dirname, 'other')), false)
  check('isUnder 前缀相近的兄弟目录不算', isUnder(root, root + '2'), false)
  // 名字以 .. 开头的合法子项不能被误判为“上跳”
  check('isUnder 名为 ..foo 的子项通过', isUnder(root, path.join(root, '..foo')), true)

  // ---- buildTree ----
  const tree = buildTree([
    { rel: 'z.md', type: 'file' },
    { rel: 'a', type: 'dir' },
    { rel: 'a/b.md', type: 'file' },
    { rel: 'a/sub', type: 'dir' },
    { rel: 'b.md', type: 'file' },
  ])
  check('buildTree 顶层：目录优先', tree.children.map((c) => c.name + ':' + c.type), ['a:dir', 'b.md:file', 'z.md:file'])
  check('buildTree 子级：目录优先', tree.children[0].children.map((c) => c.name + ':' + c.type), ['sub:dir', 'b.md:file'])
  check('buildTree 保留空目录', tree.children[0].children[0].rel, 'a/sub')
  check('buildTree 空目录没有子项', tree.children[0].children[0].children.length, 0)
  check('buildTree 忽略非法条目', buildTree([null, {}, 'x', { rel: 'x.md', type: 'file' }]).children.map((c) => c.rel), ['x.md'])
  // 只给了深层文件、没显式给目录条目时，中间目录要自动补齐
  check('buildTree 自动补齐中间目录', buildTree([{ rel: 'p/q/r.md', type: 'file' }]).children[0].children[0].children[0].rel, 'p/q/r.md')

  // ---- collectDirRels ----
  check('collectDirRels', collectDirRels(tree), ['a', 'a/sub'])
  check('collectDirRels 空树', collectDirRels(buildTree([])), [])

  console.log('')
  console.log('RESULT: ' + (fail === 0 ? 'ALL PASS' : fail + ' FAILED') + '（' + pass + ' passed）')
  process.exit(fail === 0 ? 0 : 1)
})()
