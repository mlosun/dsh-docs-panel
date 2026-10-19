// 宿主端 API 端到端自测：用假的 ctx 服务加载 lib/index.js 的 apply()，
// 截获 /docs-panel/api 路由，在临时目录里跑一遍新建/重命名/删除/回收站，
// 验证真实文件系统结果与越界防护。
// 运行：node api-test.cjs
const fsp = require('node:fs/promises')
const os = require('node:os')
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

// ---- 假 ctx：api-test 只用得到 fs / shell / webServer ----

function makeFsService() {
  function wrap(p) {
    return { displayPath: p, path: p }
  }
  return {
    async resolve(p) { return wrap(path.resolve(p)) },
    async stat(target) {
      try {
        const s = await fsp.stat(target.path)
        return { type: s.isDirectory() ? 'directory' : 'file', size: s.size }
      } catch (error) {
        return undefined
      }
    },
    async listDir(target) {
      const entries = await fsp.readdir(target.path, { withFileTypes: true })
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        target: wrap(path.join(target.path, entry.name)),
      }))
    },
    contains(dir, file) {
      return file.path === dir.path || file.path.startsWith(dir.path + path.sep)
    },
    processPath(target) { return target.path },
    async readText(target) { return fsp.readFile(target.path, 'utf8') },
    async writeText() { throw new Error('api-test: 不应写经 ctx.fs（沙箱会拒绝，实现也刻意绕开）') },
  }
}

function boot() {
  let route = null
  const ctx = {
    get(name) {
      if (name === 'fs') return makeFsService()
      if (name === 'shell') return { resolve: (spec) => spec, execute: async () => ({ result: async () => ({ exitCode: 0 }) }) }
      if (name === 'webServer') return { register: (r) => { route = r; return () => {} } }
      return undefined
    },
    effect(fn) { return fn() },
  }
  return { ctx, route: () => route }
}

// 走真实路由：POST /docs-panel/api/<method> + JSON body
function call(route, method, args) {
  const payload = JSON.stringify(args || {})
  const req = {
    method: 'POST',
    url: '/docs-panel/api/' + method,
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(payload, 'utf8')
    },
  }
  return new Promise((resolve, reject) => {
    const res = {
      writeHead() {},
      end(text) {
        try {
          resolve(JSON.parse(String(text)))
        } catch (error) {
          reject(error)
        }
      },
    }
    try {
      route.handler(req, res)
    } catch (error) {
      reject(error)
    }
  })
}

/** 把树压成 "rel:type" 列表，便于断言。 */
function flatten(node, out) {
  const acc = out === undefined ? [] : out
  for (const child of node.children) {
    acc.push(child.rel + ':' + child.type)
    if (child.type === 'dir') flatten(child, acc)
  }
  return acc
}

async function exists(p) {
  try {
    await fsp.stat(p)
    return true
  } catch (error) {
    return false
  }
}

;(async function main() {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), 'dsh-docs-panel-'))
  const harness = path.join(sandbox, 'harness')
  const docs = path.join(sandbox, 'docs')
  const previousHome = process.env.DSH_HOME
  try {
    await fsp.mkdir(path.join(docs, '手册'), { recursive: true })
    await fsp.writeFile(path.join(docs, '手册', 'guide.md'), '# guide\n', 'utf8')
    await fsp.writeFile(path.join(docs, 'readme.md'), '# readme\n', 'utf8')
    await fsp.writeFile(path.join(docs, 'other.md'), '# other\n', 'utf8')
    await fsp.writeFile(path.join(docs, '.hidden.md'), '# hidden\n', 'utf8')
    // 插件配置指向临时文档目录（$DSH_HOME 在 harnessHome() 里实时读取）
    process.env.DSH_HOME = harness
    await fsp.mkdir(path.join(harness, 'storages', 'dsh-docs-panel'), { recursive: true })
    await fsp.writeFile(
      path.join(harness, 'storages', 'dsh-docs-panel', 'config.json'),
      JSON.stringify({ docsDir: docs }) + '\n',
      'utf8',
    )

    const { ctx, route } = boot()
    const mod = await import(pathToFileURL(path.join(__dirname, 'lib', 'index.js')).href)
    mod.apply(ctx)
    const api = route()
    check('路由已注册', typeof api.handler, 'function')

    // ---- 读配置 / 列目录 ----
    const cfg = await call(api, 'config')
    check('config 返回已配置目录', cfg.docsDir, docs)

    const listed = await call(api, 'docs.list')
    check('docs.list 成功', listed.ok, true)
    check(
      'docs.list 树含目录与文件',
      flatten(listed.tree).sort(),
      ['手册:dir', '手册/guide.md:file', 'readme.md:file', 'other.md:file'].sort(),
    )
    check('docs.list 隐藏文件不计入', listed.fileCount, 3)

    // ---- 新建文件夹 / 文件 ----
    const mk = await call(api, 'docs.mkdir', { rel: '', name: '新目录' })
    check('mkdir 成功', mk, { ok: true, rel: '新目录' })
    check('mkdir 落盘', await exists(path.join(docs, '新目录')), true)

    const dup = await call(api, 'docs.mkdir', { rel: '', name: '新目录' })
    check('mkdir 重名被拒', dup.ok, false)

    const cf = await call(api, 'docs.createFile', { rel: '新目录', name: '笔记' })
    check('createFile 自动补 .md', cf, { ok: true, rel: '新目录/笔记.md' })
    check('createFile 落盘且为空', (await fsp.readFile(path.join(docs, '新目录', '笔记.md'), 'utf8')), '')

    const cfBad = await call(api, 'docs.createFile', { rel: '', name: 'a.txt' })
    check('createFile 拒绝非 Markdown', cfBad.ok, false)
    check('createFile 拒绝原因可读', cfBad.error.indexOf('Markdown') >= 0, true)

    // ---- 保存正文 ----
    const body = '# 标题\n\n正文第一段\n\n- 列表项\n'
    const save0 = await call(api, 'docs.save', { rel: '新目录/笔记.md', content: body })
    check('save 成功', save0.ok, true)
    check('save 返回字节数', save0.bytes, Buffer.byteLength(body, 'utf8'))
    check('save 落盘内容正确', await fsp.readFile(path.join(docs, '新目录', '笔记.md'), 'utf8'), body)
    check('save 后能读回同样内容', (await call(api, 'docs.read', { rel: '新目录/笔记.md' })).content, body)
    const leftovers = (await fsp.readdir(path.join(docs, '新目录')))
      .filter(function (name) { return name.indexOf('.dsp-save-') >= 0 })
    check('save 不留临时文件', leftovers, [])

    check('save 拒绝非 Markdown', (await call(api, 'docs.save', { rel: 'a.txt', content: 'x' })).ok, false)
    check('save 目标不存在被拒', (await call(api, 'docs.save', { rel: '不存在.md', content: 'x' })).ok, false)
    check('save 拒绝越界', (await call(api, 'docs.save', { rel: '../outside.md', content: 'x' })).ok, false)
    check('save 缺内容被拒', (await call(api, 'docs.save', { rel: '新目录/笔记.md' })).ok, false)
    check('save 目标是目录被拒', (await call(api, 'docs.save', { rel: '新目录', content: 'x' })).ok, false)

    // ---- 越界防护 ----
    const esc1 = await call(api, 'docs.createFile', { rel: '..', name: 'x' })
    check('拒绝 ../ 越界父目录', esc1.ok, false)
    const esc2 = await call(api, 'docs.mkdir', { rel: '.trash', name: 'x' })
    check('拒绝直接操作 .trash', esc2.ok, false)
    const esc3 = await call(api, 'docs.remove', { rel: '../outside.md' })
    check('拒绝删除目录外文件', esc3.ok, false)
    const esc4 = await call(api, 'docs.remove', { rel: '' })
    check('拒绝删除文档根', esc4.ok, false)

    // ---- 重命名 ----
    // 仅改大小写：大小写不敏感的文件系统上必须放行，且要真正改写磁盘上的大小写
    const renCase = await call(api, 'docs.rename', { rel: 'readme.md', name: 'README.md' })
    check('rename 仅改大小写被放行', renCase, { ok: true, rel: 'README.md' })
    const diskNames = await fsp.readdir(docs)
    check('rename 真正改写磁盘大小写', diskNames.indexOf('README.md') >= 0, true)
    check('rename 旧名已不在磁盘', diskNames.indexOf('readme.md'), -1)

    const renClash = await call(api, 'docs.rename', { rel: 'README.md', name: 'other.md' })
    check('rename 真重名被拒', renClash.ok, false)
    check('rename 被拒后原文件仍在', await exists(path.join(docs, 'README.md')), true)

    const renDir = await call(api, 'docs.rename', { rel: '新目录', name: '归档' })
    check('rename 目录', renDir, { ok: true, rel: '归档' })
    check('rename 目录下文件跟随', await exists(path.join(docs, '归档', '笔记.md')), true)

    // ---- 删除 → 回收站 ----
    const rm = await call(api, 'docs.remove', { rel: '归档' })
    check('remove 成功且返回 id', rm.ok, true)
    check('remove 后原位置消失', await exists(path.join(docs, '归档')), false)
    check('回收站 payload 存在', await exists(path.join(docs, '.trash', rm.id, 'payload')), true)
    check('回收站 meta 存在', await exists(path.join(docs, '.trash', rm.id, 'meta.json')), true)

    const afterRemove = await call(api, 'docs.list')
    check(
      '删除后列表不含该项',
      flatten(afterRemove.tree).sort(),
      ['手册:dir', '手册/guide.md:file', 'README.md:file', 'other.md:file'].sort(),
    )

    const trashList = await call(api, 'docs.trash.list')
    check('回收站列表有 1 项', trashList.items.length, 1)
    check('回收站记录原路径', trashList.items[0].rel, '归档')
    check('回收站记录类型', trashList.items[0].type, 'directory')

    // ---- 恢复 ----
    const restore = await call(api, 'docs.trash.restore', { id: rm.id })
    check('restore 成功', restore, { ok: true, rel: '归档' })
    check('restore 内容回到原位', await fsp.readFile(path.join(docs, '归档', '笔记.md'), 'utf8'), body)
    const trashAfterRestore = await call(api, 'docs.trash.list')
    check('restore 后回收站清空', trashAfterRestore.items.length, 0)

    // ---- 彻底删除 / 清空 ----
    const rm2 = await call(api, 'docs.remove', { rel: '归档' })
    const purge = await call(api, 'docs.trash.purge', { id: rm2.id })
    check('purge 成功', purge.ok, true)
    check('purge 后条目消失', await exists(path.join(docs, '.trash', rm2.id)), false)

    const badId = await call(api, 'docs.trash.purge', { id: '../../storages' })
    check('响应非法回收站 id', badId.ok, false)

    const rm3 = await call(api, 'docs.remove', { rel: 'README.md' })
    check('再次删除', rm3.ok, true)
    const empty = await call(api, 'docs.trash.empty')
    check('empty 成功', empty.ok, true)
    check('empty 后 .trash 消失', await exists(path.join(docs, '.trash')), false)

    // ---- 未知方法 ----
    const missing = await call(api, 'docs.nope')
    check('未知方法 404', missing.ok, false)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    await fsp.rm(sandbox, { recursive: true, force: true })
  }

  console.log('')
  console.log('RESULT: ' + (fail === 0 ? 'ALL PASS' : fail + ' FAILED') + '（' + pass + ' passed）')
  process.exit(fail === 0 ? 0 : 1)
})()
