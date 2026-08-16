// Markdown 渲染器本地自测：提取 lib/client.js 里的真实渲染函数，
// 用「返回 HTML 字符串」的 mock React 执行，验证解析与渲染结果。
const fs = require('fs')

// ---- mock React：createElement 直接拼 HTML 字符串 ----
const React = {
  createElement(type, props, ...children) {
    if (typeof type === 'function') return '[Component]'
    const attrs = []
    for (const k in props || {}) {
      if (k === 'key' || k === 'ref') continue
      const v = props[k]
      if (v === true) attrs.push(k)
      else if (typeof v === 'string' || typeof v === 'number') {
        attrs.push(k + '="' + String(v).replace(/"/g, '&quot;') + '"')
      }
    }
    const attrText = attrs.length ? ' ' + attrs.join(' ') : ''
    const kids = children
      .flat(Infinity)
      .filter((c) => c !== null && c !== undefined)
      .map((c) => String(c))
      .join('')
    if (type === 'hr' || type === 'img') return '<' + type + attrText + '>'
    return '<' + type + attrText + '>' + kids + '</' + type + '>'
  },
}

// ---- 提取插件源码里的渲染函数段 ----
const src = fs.readFileSync(__dirname + '/lib/client.js', 'utf8')
const start = src.indexOf('    let currentReadRel')
const end = src.indexOf('    function DocsPanel')
if (start < 0 || end < 0) {
  console.error('FAIL: 无法在 lib/client.js 中定位渲染函数段')
  process.exit(1)
}
const segment = src.slice(start, end)
const factory = new Function(
  'React', 'rpc', 'timer',
  segment + '\nreturn { inlineNodes, stripInline, isTableDelim, splitRow, isBlockStart, parseBlocks, renderBlock }'
)
const api = factory(React, async () => ({ ok: true }), undefined)

// ---- 测试文档：覆盖全部支持的语法 ----
const md = [
  '# 一级标题',
  '',
  '普通段落，包含 **粗体**、*斜体*、`行内代码`、~~删除线~~ 和 [链接](https://example.com)。',
  '',
  '## 二级标题',
  '',
  '- 无序项一',
  '- 无序项二',
  '  - 嵌套项 A',
  '  - 嵌套项 B',
  '',
  '1. 有序项一',
  '2. 有序项二',
  '',
  '> 这是一段引用，引用里有 **强调**。',
  '',
  '```js',
  'const x = 1',
  'console.log(x)',
  '```',
  '',
  '| 名称 | 说明 |',
  '| --- | --- |',
  '| dsh | 开发工具 |',
  '| docs | 文档面板 |',
  '',
  '---',
  '',
  '### 三级标题',
  '',
  '收尾段落。',
  '',
].join('\n')

// ---- 执行 ----
let failed = false
function check(name, cond) {
  if (cond) {
    console.log('PASS  ' + name)
  } else {
    failed = true
    console.log('FAIL  ' + name)
  }
}

const blocks = api.parseBlocks(md)
console.log('块类型: ' + blocks.map((b) => b.kind).join(','))
console.log('块数量: ' + blocks.length)

check('包含 h1 块', blocks.some((b) => b.kind === 'h' && b.level === 1))
check('包含 h2 块', blocks.some((b) => b.kind === 'h' && b.level === 2))
check('包含 h3 块', blocks.some((b) => b.kind === 'h' && b.level === 3))
check('包含表格块且表头 2 列', (() => {
  const t = blocks.find((b) => b.kind === 'table')
  return t && t.header.length === 2 && t.rows.length === 2
})())
check('包含代码块', blocks.some((b) => b.kind === 'code' && b.code.includes('console.log(x)')))
check('包含引用块', blocks.some((b) => b.kind === 'quote'))
check('无序列表含 2 项', (() => {
  const l = blocks.find((b) => b.kind === 'list' && !b.ordered)
  return l && l.items.length === 2
})())
check('有序列表含 2 项', (() => {
  const l = blocks.find((b) => b.kind === 'list' && b.ordered)
  return l && l.items.length === 2
})())
check('包含分隔线', blocks.some((b) => b.kind === 'hr'))

// 行内解析检查
const inlineHtml = api.inlineNodes('**粗体** 和 `代码` 和 [链接](https://example.com)').join('')
check('行内粗体渲染', inlineHtml.includes('<strong>粗体</strong>'))
check('行内代码渲染', inlineHtml.includes('<code className="dsp-inline-code">代码</code>'))
check('行内链接渲染', inlineHtml.includes('<a href="https://example.com"'))

// 大纲纯文本提取
check('stripInline 去除标记', api.stripInline('**加粗** 和 `代码` [链接](https://x.com)') === '加粗 和 代码 链接')

// 标题与嵌套列表渲染检查
const h1Html = api.renderBlock(blocks.find((b) => b.kind === 'h' && b.level === 1), 0)
check('标题渲染为 h1', h1Html.startsWith('<h1>') && h1Html.includes('一级标题'))
const ulHtml = api.renderBlock(blocks.find((b) => b.kind === 'list' && !b.ordered), 4)
check('嵌套列表无多余段落包裹', ulHtml.includes('<li>无序项二<ul>'))
check('嵌套项渲染', ulHtml.includes('嵌套项 A') && ulHtml.includes('嵌套项 B'))

// 代码块渲染（组件化后输出占位，不崩即可）
const codeHtml = api.renderBlock(blocks.find((b) => b.kind === 'code'), 6)
check('代码块组件渲染', typeof codeHtml === 'string' && codeHtml.includes('[Component]'))

// 表格渲染
const tableHtml = api.renderBlock(blocks.find((b) => b.kind === 'table'), 7)
check('表格渲染表头', tableHtml.includes('<th>名称</th>') && tableHtml.includes('<th>说明</th>'))
check('表格渲染数据行', tableHtml.includes('<td>dsh</td>'))

console.log('')
console.log(failed ? 'RESULT: FAIL' : 'RESULT: ALL PASS')
process.exit(failed ? 1 : 0)
