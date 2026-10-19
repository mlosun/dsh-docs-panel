// 编辑器文本变换自测：按仓库既有约定，从 lib/client.js 里抽出真实的变换函数，
// 用假的 textarea / setDraft 执行，验证改出来的正文与光标位置。
// client 是单文件模块（window.__ModuleLoader__ 工厂，不能用 import），
// 因此这些纯文本操作只能内联在那里，这里靠锚点抽取。
// 运行：node editor-test.cjs
const fs = require('node:fs')

const src = fs.readFileSync(__dirname + '/lib/client.js', 'utf8')
const startAnchor = '      function selectionRange() {'
const endAnchor = '      function startEdit() {'
const start = src.indexOf(startAnchor)
const end = src.indexOf(endAnchor)
if (start < 0 || end < 0 || end <= start) {
  console.error('FAIL: 无法在 lib/client.js 中定位编辑器变换函数段（锚点已变动）')
  process.exit(1)
}
const segment = src.slice(start, end)

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

// 假 textarea：记录选区，并让 setSelectionRange 改回来，模拟浏览器行为
function harness(value, start, end) {
  const el = {
    selectionStart: start,
    selectionEnd: end,
    focus() {},
    setSelectionRange(a, b) {
      this.selectionStart = a
      this.selectionEnd = b
    },
  }
  let written = null
  const factory = new Function(
    'draft', 'textareaEl', 'setDraft', 'window',
    segment + '\nreturn { wrapSelection, toggleLinePrefix, setHeadingLevel, indentLines, insertBlock }',
  )
  const api = factory(value, el, function (next) { written = next }, undefined)
  return {
    api,
    el,
    text() { return written },
    caret() { return [el.selectionStart, el.selectionEnd] },
  }
}

// ---- 选区包裹 ----
{
  const h = harness('hello world', 0, 5)
  h.api.wrapSelection('**', '**', '粗体')
  check('粗体包裹选中文本', h.text(), '**hello** world')
  check('粗体包裹后选回正文', h.caret(), [2, 7])
}
{
  const h = harness('abc', 3, 3)
  h.api.wrapSelection('**', '**', '粗体')
  check('粗体插入占位符', h.text(), 'abc**粗体**')
  check('占位符被选中便于直接输入', h.caret(), [5, 7])
}
{
  const h = harness('x', 0, 1)
  h.api.wrapSelection('`', '`', 'code')
  check('行内代码包裹', h.text(), '`x`')
}
{
  const h = harness('word', 0, 4)
  h.api.wrapSelection('[', '](url)', '链接文字')
  check('链接包裹', h.text(), '[word](url)')
  check('链接选中文字部分', h.caret(), [1, 5])
}

// ---- 行首标记开关 ----
{
  const h = harness('a\nb', 0, 3)
  h.api.toggleLinePrefix('- ')
  check('无序列表：整体加上', h.text(), '- a\n- b')
}
{
  const h = harness('- a\n- b', 0, 7)
  h.api.toggleLinePrefix('- ')
  check('无序列表：已全有则整体去掉', h.text(), 'a\nb')
}
{
  const h = harness('a\n\nb', 0, 4)
  h.api.toggleLinePrefix('> ')
  check('引用：空行不加标记', h.text(), '> a\n\n> b')
}
{
  const h = harness('a', 0, 1)
  h.api.toggleLinePrefix('- [ ] ')
  check('任务列表标记', h.text(), '- [ ] a')
}
{
  const h = harness('- a\nb', 0, 5)
  h.api.toggleLinePrefix('- ')
  check('部分带标记时统一补齐', h.text(), '- - a\n- b')
}

// ---- 标题 ----
{
  const h = harness('a', 0, 1)
  h.api.setHeadingLevel(2)
  check('加二级标题', h.text(), '## a')
}
{
  const h = harness('### a', 0, 5)
  h.api.setHeadingLevel(1)
  check('标题级别替换而非叠加', h.text(), '# a')
}
{
  const h = harness('# a', 0, 3)
  h.api.setHeadingLevel(0)
  check('去掉标题标记', h.text(), 'a')
}
{
  const h = harness('a\n\nb', 0, 4)
  h.api.setHeadingLevel(3)
  check('标题：空行不动', h.text(), '### a\n\n### b')
}

// ---- 缩进 ----
{
  const h = harness('a\nb', 0, 3)
  h.api.indentLines(false)
  check('Tab 缩进整段', h.text(), '  a\n  b')
}
{
  const h = harness('  a', 0, 3)
  h.api.indentLines(true)
  check('Shift+Tab 反缩进', h.text(), 'a')
}
{
  const h = harness('\ta', 0, 2)
  h.api.indentLines(true)
  check('Shift+Tab 去掉制表符', h.text(), 'a')
}
{
  const h = harness('a', 0, 1)
  h.api.indentLines(true)
  check('无缩进时反缩进保持原样', h.text(), 'a')
}

// ---- 整块插入 ----
{
  const h = harness('', 0, 0)
  h.api.insertBlock('---\n')
  check('空文档插入不加前导空行', h.text(), '---\n')
}
{
  const h = harness('abc', 3, 3)
  h.api.insertBlock('---\n')
  check('段落后插入补空行', h.text(), 'abc\n\n---\n')
}
{
  const h = harness('abc\n', 4, 4)
  h.api.insertBlock('---\n')
  check('已有单个换行时只补一个', h.text(), 'abc\n\n---\n')
}
{
  const h = harness('abc\n\n', 5, 5)
  h.api.insertBlock('| a | b |\n| --- | --- |\n')
  check('已有空行时不重复补', h.text(), 'abc\n\n| a | b |\n| --- | --- |\n')
}
{
  const h = harness('ab', 1, 1)
  h.api.insertBlock('---\n')
  check('插入位置在光标处', h.text(), 'a\n\n---\nb')
}
{
  const h = harness('', 0, 0)
  h.api.insertBlock('```\n\n```\n')
  check('整块插入默认落点在块尾', h.caret(), [9, 9])
}
{
  const h = harness('abc\n\n', 5, 5)
  h.api.insertBlock('```\n\n```\n', 4)
  check('代码块光标落在围栏内', h.text(), 'abc\n\n```\n\n```\n')
  check('代码块落点偏移正确', h.caret(), [9, 9])
}

console.log('')
console.log('RESULT: ' + (fail === 0 ? 'ALL PASS' : fail + ' FAILED') + '（' + pass + ' passed）')
process.exit(fail === 0 ? 0 : 1)
