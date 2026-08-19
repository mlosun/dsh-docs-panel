window.__ModuleLoader__.load({ id: 'dsh-docs-panel', factory: (require) => {
  'use strict'
  var module = { exports: {} }
  var exports = module.exports

  // React 通过模块加载器注入提供，不是浏览器全局变量
  const React = require('react')

  // 客户端 → 宿主端 RPC：经同源 HTTP 路由（正式插件形态）
  function rpc(method, args) {
    return fetch('/docs-panel/api/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error('HTTP ' + res.status))
      return res.json()
    })
  }

  // 侧边栏 tab 图标：自绘 outline 风格（16 网格、1.5 描边、圆角、currentColor），
  // 与 dsh 官方 Icon*Outline16 系列视觉一致；不依赖官方图标库（避免 client
  // 模块表纯度门导致 require 失败）。文档 + 折角 + 三行文字的「文档」形态。
  function DocsTabIcon(props) {
    const size = props && props.size ? props.size : 16
    return React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
    },
      React.createElement('path', { d: 'M4.5 1.5h5l3 3v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z' }),
      React.createElement('path', { d: 'M9.5 1.5v3h3' }),
      React.createElement('path', { d: 'M5.5 8h5' }),
      React.createElement('path', { d: 'M5.5 10.5h5' }),
      React.createElement('path', { d: 'M5.5 13h3' })
    )
  }

  // 注入包样式表
  function injectStyles(css) {
    try {
      if (typeof document === 'undefined') return
      const style = document.createElement('style')
      style.setAttribute('data-plugin', 'dsh-docs-panel')
      style.textContent = css
      document.head.appendChild(style)
    } catch (error) {}
  }

  function apply(ctx) {
    const timer = ctx.get('timer')

    // betterSidebar 是跨插件服务（由 dsh-better-sidebar 提供），不能放进静态
    // inject——否则在 better-sidebar 尚未就绪的冷启动阶段，本插件会一直 pending
    // 甚至拖慢 web 启动。正确做法（与官方案例 dsh-sentinel 一致）：用 ctx.plugin
    // 声明服务依赖，cordis 会等 betterSidebar 就绪后才执行注册。
    ctx.plugin({
      inject: ['betterSidebar'],
      apply(sidebarCtx) {
        const betterSidebar = sidebarCtx.betterSidebar
        // 注册为 better-sidebar 的侧边栏 tab（官方接入指南要求包在 ctx.effect 里，
        // 卸载/HMR 时自动撤销注册；id 带包前缀避免与内置 tab 冲突）
        ctx.effect(() => betterSidebar.registerTab({
          id: 'dsh-docs-panel:docs',
          title: () => '全局文档',
          icon: function (size) {
            return React.createElement(DocsTabIcon, { size: size })
          },
          order: 60,
          single: true,
          component: function (props) {
            return React.createElement(DocsView, { scope: props.scope, visible: props.visible })
          },
        }))
      },
    })

    injectStyles([
      // 侧边栏 tab 内容容器：占满 better-sidebar 提供的区域，流式布局。
      // 视觉对齐 better-sidebar 内置面板：header 36px、icon 按钮 28px 圆形、
      // 背景用 bg-layer-1（与 .panel 一致）。
      '.dsp-root{box-sizing:border-box;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);flex-direction:column;display:flex;pointer-events:auto}',
      '.dsp-header{box-sizing:border-box;flex:none;justify-content:space-between;align-items:center;height:36px;padding:0 8px 0 12px;display:flex;gap:8px}',
      '.dsp-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-header-actions{display:flex;align-items:center;gap:2px}',
      '.dsp-header-btn{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;display:inline-flex;font-size:14px}',
      '.dsp-header-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-settings{border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));flex:none;align-items:center;gap:8px;padding:8px 12px;display:flex;flex-wrap:wrap}',
      '.dsp-settings-label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dsp-settings-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);min-width:200px;height:26px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;border-radius:6px;flex:1;padding:0 8px;outline:none}',
      '.dsp-settings-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dsp-btn{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;background:transparent;border-radius:6px;height:26px;padding:0 10px}',
      '.dsp-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-msg{font-size:12px;line-height:18px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-msg-ok{color:var(--dsw-alias-state-success-primary)}',
      '.dsp-msg-err{color:var(--dsw-alias-state-error-primary)}',
      '.dsp-settings-hint{width:100%;color:var(--dsw-alias-label-dimmed);font-size:11px;line-height:16px}',
      '.dsp-body{flex:1;min-height:0;display:flex}',
      '.dsp-list{box-sizing:border-box;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));width:220px;flex:none;padding:4px 6px 8px;overflow-y:auto}',
      '.dsp-note{color:var(--dsw-alias-label-dimmed);margin:4px 6px;font-size:12px;line-height:18px}',
      '.dsp-note-error{color:var(--dsw-alias-state-error-primary)}',
      '.dsp-item{box-sizing:border-box;border:none;background:transparent;width:100%;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;border-radius:8px;padding:6px 10px;margin-bottom:2px;display:block;font-family:inherit;font-size:13px;line-height:20px}',
      '.dsp-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsp-item-selected{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-brand-primary)}',
      '.dsp-item-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-item-dir{display:block;color:var(--dsw-alias-label-dimmed);font-size:11px;line-height:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-reader{position:relative;flex:1;min-width:0;padding:20px 24px;overflow-y:auto}',
      // 文档工具条（固定面板头部下方，不随文档滚动，绝不遮挡标题）
      '.dsp-toolbar{position:relative;flex:none;z-index:8;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));border-bottom:1px solid var(--dsw-alias-border-l1);padding:4px 12px}',
      '.dsp-toolbar-row{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}',
      '.dsp-toolbar-spacer{flex:1}',
      '.dsp-toolbar-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;border-radius:6px;height:26px;padding:0 10px;display:inline-flex;align-items:center;gap:4px}',
      '.dsp-toolbar-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-toolbar-btn-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.dsp-toc{position:absolute;top:calc(100% + 4px);right:12px;width:240px;max-height:280px;overflow:auto;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,0.18);padding:6px;z-index:9}',
      '.dsp-toc-item{display:block;width:100%;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-family:inherit;font-size:12px;line-height:18px;padding:4px 8px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-toc-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsp-toc-l1{font-weight:600}',
      '.dsp-toc-l2{padding-left:14px}',
      '.dsp-toc-l3{padding-left:26px}',
      '.dsp-toc-l4{padding-left:38px}',
      '.dsp-toc-l5{padding-left:50px}',
      '.dsp-toc-l6{padding-left:62px}',
      // 正文排版
      '.dsp-markdown{max-width:720px;margin:0 auto;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.75;overflow-wrap:break-word}',
      '.dsp-markdown h1{font-size:24px;line-height:1.35;margin:0 0 18px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.dsp-markdown h2{font-size:19px;line-height:1.4;margin:28px 0 12px}',
      '.dsp-markdown h3{font-size:16px;line-height:1.4;margin:24px 0 10px}',
      '.dsp-markdown h4{font-size:15px;margin:20px 0 8px}',
      '.dsp-markdown h5{font-size:14px;margin:18px 0 8px}',
      '.dsp-markdown h6{font-size:13px;color:var(--dsw-alias-label-secondary);margin:16px 0 8px}',
      '.dsp-markdown p{margin:0 0 14px}',
      '.dsp-markdown ul,.dsp-markdown ol{margin:0 0 14px;padding-left:24px}',
      '.dsp-markdown li{margin:4px 0}',
      '.dsp-markdown li>ul,.dsp-markdown li>ol{margin:4px 0}',
      '.dsp-markdown a{color:var(--dsw-alias-brand-primary);text-decoration:none}',
      '.dsp-markdown a:hover{text-decoration:underline}',
      '.dsp-markdown strong{font-weight:600}',
      '.dsp-markdown em{font-style:italic}',
      '.dsp-markdown del{opacity:0.65}',
      '.dsp-markdown hr{border:none;border-top:1px solid var(--dsw-alias-border-l1);margin:24px 0}',
      '.dsp-markdown blockquote{margin:0 0 14px;padding:10px 16px;border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);border-radius:0 10px 10px 0}',
      '.dsp-markdown blockquote p{margin:0}',
      '.dsp-inline-code{padding:1px 6px;border-radius:6px;background:var(--dsw-alias-markdown-inline-code,rgba(128,132,144,0.16));font-family:var(--dsh-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:0.9em}',
      // 代码块与复制按钮
      '.dsp-code{position:relative;margin:0 0 14px;border-radius:10px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1)}',
      '.dsp-code pre{margin:0;padding:12px 14px;background:var(--dsw-alias-markdown-code-block);overflow-x:auto}',
      '.dsp-code code{color:var(--dsw-alias-label-secondary);font-family:var(--dsh-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12.5px;line-height:1.65;white-space:pre}',
      '.dsp-copy-btn{position:absolute;top:8px;right:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;border-radius:6px;height:24px;padding:0 8px;z-index:2}',
      '.dsp-copy-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-copy-btn.dsp-copied{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}',
      '.dsp-markdown table{border-collapse:collapse;width:100%;margin:0 0 14px;font-size:13px}',
      '.dsp-markdown th,.dsp-markdown td{border:1px solid var(--dsw-alias-border-l1);padding:7px 12px;text-align:left;vertical-align:top}',
      '.dsp-markdown th{background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));font-weight:600}',
      '.dsp-markdown img{max-width:100%;border-radius:8px}',
      '@media (max-width:560px){.dsp-list{width:150px}.dsp-reader{padding:16px 14px}}',
    ].join('\n'))

    // 当前正在读取的文档（防止快速切换时旧请求覆盖新内容）
    let currentReadRel = null
    // 标题元素引用：大纲点击跳转用
    const headingEls = {}

    // ---------- 轻量 Markdown 渲染器 ----------

    // 行内格式：`code`、**bold**、__bold__、*italic*、~~del~~、[text](url)
    function inlineNodes(text) {
      const nodes = []
      const regex = /(`+)([^`\n]*?)\1|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|~~([^~\n]+)~~|\[([^\]\n]+)\]\(([^)\s]+)\)/g
      let last = 0
      let match
      let k = 0
      while ((match = regex.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index))
        const key = 'i' + (k++)
        if (match[1] !== undefined) {
          nodes.push(React.createElement('code', { key: key, className: 'dsp-inline-code' }, match[2]))
        } else if (match[3] !== undefined) {
          nodes.push(React.createElement('strong', { key: key }, inlineNodes(match[3])))
        } else if (match[4] !== undefined) {
          nodes.push(React.createElement('strong', { key: key }, inlineNodes(match[4])))
        } else if (match[5] !== undefined) {
          nodes.push(React.createElement('em', { key: key }, inlineNodes(match[5])))
        } else if (match[6] !== undefined) {
          nodes.push(React.createElement('del', { key: key }, inlineNodes(match[6])))
        } else if (match[7] !== undefined) {
          nodes.push(React.createElement('a', { key: key, href: match[8], target: '_blank', rel: 'noopener noreferrer' }, match[7]))
        }
        last = regex.lastIndex
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    // 去掉行内标记，得到纯文本（大纲标题用）
    function stripInline(text) {
      return text
        .replace(/`([^`]*)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\*\*([^*]*)\*\*/g, '$1')
        .replace(/\*([^*]*)\*/g, '$1')
        .replace(/~~([^~]*)~~/g, '$1')
        .trim()
    }

    function isTableDelim(line) {
      const s = line.trim()
      if (!s.includes('|')) return false
      const t = s.replace(/^\|/, '').replace(/\|$/, '')
      const cells = t.split('|')
      if (cells.length === 0) return false
      for (const cell of cells) {
        if (!/^:?-{1,}:?$/.test(cell.trim())) return false
      }
      return true
    }

    function splitRow(line) {
      let s = line.trim()
      if (s.startsWith('|')) s = s.slice(1)
      if (s.endsWith('|')) s = s.slice(0, -1)
      return s.split('|').map(function (c) { return c.trim() })
    }

    function isBlockStart(line) {
      if (/^(`{3,}|~{3,})/.test(line)) return true
      if (/^\s{0,3}#{1,6}\s+/.test(line)) return true
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) return true
      if (/^\s{0,3}>\s?/.test(line)) return true
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) return true
      return false
    }

    // 块级解析：代码块 / 标题 / 分隔线 / 引用 / 列表 / 表格 / 段落
    function parseBlocks(text) {
      const lines = text.replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        const fence = line.match(/^(`{3,}|~{3,})/)
        if (fence) {
          const marker = fence[1]
          const buf = []
          i += 1
          while (i < lines.length && !lines[i].startsWith(marker)) {
            buf.push(lines[i])
            i += 1
          }
          if (i < lines.length) i += 1
          blocks.push({ kind: 'code', code: buf.join('\n') })
          continue
        }
        const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
        if (heading) {
          blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] })
          i += 1
          continue
        }
        if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
          blocks.push({ kind: 'hr' })
          i += 1
          continue
        }
        if (/^\s{0,3}>\s?/.test(line)) {
          const buf = []
          while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
            buf.push(lines[i].replace(/^\s{0,3}>\s?/, ''))
            i += 1
          }
          blocks.push({ kind: 'quote', text: buf.join('\n') })
          continue
        }
        const listStart = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)
        if (listStart) {
          const items = []
          while (i < lines.length) {
            const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)
            if (!m) break
            const indent = lines[i].length - lines[i].replace(/^\s*/, '').length
            const ordered = /^\d/.test(m[1])
            const content = [m[2]]
            i += 1
            while (i < lines.length) {
              const nm = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)
              if (nm && lines[i].length - lines[i].replace(/^\s*/, '').length > indent) {
                content.push(lines[i])
                i += 1
                continue
              }
              if (lines[i].trim() === '') {
                if (i + 1 < lines.length) {
                  const pm = lines[i + 1].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)
                  if (pm && lines[i + 1].length - lines[i + 1].replace(/^\s*/, '').length > indent) {
                    content.push('')
                    i += 1
                    continue
                  }
                }
                break
              }
              if (/^\s{2,}\S/.test(lines[i])) {
                content.push(lines[i])
                i += 1
                continue
              }
              break
            }
            items.push({ ordered: ordered, text: content.join('\n') })
          }
          blocks.push({ kind: 'list', ordered: items.length > 0 ? items[0].ordered : false, items: items })
          continue
        }
        if (line.trim() !== '' && line.includes('|') && i + 1 < lines.length && isTableDelim(lines[i + 1])) {
          const header = splitRow(line)
          const rows = []
          i += 2
          while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
            rows.push(splitRow(lines[i]))
            i += 1
          }
          blocks.push({ kind: 'table', header: header, rows: rows })
          continue
        }
        if (line.trim() === '') {
          i += 1
          continue
        }
        const buf = [line]
        i += 1
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !isBlockStart(lines[i]) &&
          !(lines[i].includes('|') && i + 1 < lines.length && isTableDelim(lines[i + 1]))
        ) {
          buf.push(lines[i])
          i += 1
        }
        blocks.push({ kind: 'p', text: buf.join(' ') })
      }
      return blocks
    }

    // 浏览器剪贴板兜底（host 的 pbcopy 失败时用）
    function tryBrowserCopy(text) {
      if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
        return Promise.reject(new Error('clipboard unavailable'))
      }
      return navigator.clipboard.writeText(text)
    }

    // 代码块（带复制按钮）
    function CodeBlock(props) {
      const [copied, setCopied] = React.useState(false)
      function flash() {
        setCopied(true)
        if (timer !== undefined) {
          try {
            timer.timeout(function () { setCopied(false) }, 2000)
          } catch (error) {}
        }
      }
      function doCopy() {
        rpc('docs.copy', { text: props.code }).then(function (res) {
          if (res && res.ok) {
            flash()
            return
          }
          return tryBrowserCopy(props.code).then(flash, function () {})
        }).catch(function () {
          return tryBrowserCopy(props.code).then(flash, function () {})
        })
      }
      return React.createElement('div', { className: 'dsp-code' },
        React.createElement('button', {
          type: 'button',
          className: 'dsp-copy-btn' + (copied ? ' dsp-copied' : ''),
          title: '复制代码',
          onClick: doCopy,
        }, copied ? '✓ 已复制' : '复制'),
        React.createElement('pre', null, React.createElement('code', null, props.code))
      )
    }

    function renderBlock(block, key) {
      if (block.kind === 'h') {
        const level = Math.max(1, Math.min(6, block.level))
        const hKey = 'h' + key
        return React.createElement('h' + level, {
          key: key,
          ref: function (el) { headingEls[hKey] = el },
        }, inlineNodes(block.text))
      }
      if (block.kind === 'p') return React.createElement('p', { key: key }, inlineNodes(block.text))
      if (block.kind === 'hr') return React.createElement('hr', { key: key })
      if (block.kind === 'code') {
        return React.createElement(CodeBlock, { key: key, code: block.code })
      }
      if (block.kind === 'quote') return React.createElement('blockquote', { key: key }, inlineNodes(block.text))
      if (block.kind === 'list') {
        const tag = block.ordered ? 'ol' : 'ul'
        const items = block.items.map(function (item, idx) {
          const sub = parseBlocks(item.text)
          let children
          if (sub.length === 1 && sub[0].kind === 'p') {
            children = inlineNodes(sub[0].text)
          } else {
            children = []
            for (const sb of sub) {
              if (sb.kind === 'p') {
                for (const node of inlineNodes(sb.text)) children.push(node)
              } else {
                children.push(renderBlock(sb, children.length))
              }
            }
          }
          return React.createElement('li', { key: idx }, children)
        })
        return React.createElement(tag, { key: key }, items)
      }
      if (block.kind === 'table') {
        let colCount = block.header.length
        for (const row of block.rows) {
          if (row.length > colCount) colCount = row.length
        }
        const headerCells = []
        for (let c = 0; c < colCount; c++) {
          headerCells.push(React.createElement('th', { key: c }, inlineNodes(block.header[c] || '')))
        }
        const bodyRows = block.rows.map(function (row, ri) {
          const cells = []
          for (let c = 0; c < colCount; c++) {
            cells.push(React.createElement('td', { key: c }, inlineNodes(row[c] || '')))
          }
          return React.createElement('tr', { key: ri }, cells)
        })
        return React.createElement('table', { key: key },
          React.createElement('thead', null, React.createElement('tr', null, headerCells)),
          React.createElement('tbody', null, bodyRows)
        )
      }
      return null
    }

    // ---------- 全局文档组件（better-sidebar tab 内容） ----------

    function DocsView() {
      const [docs, setDocs] = React.useState([])
      const [listLoading, setListLoading] = React.useState(false)
      const [listError, setListError] = React.useState(null)
      const [configDir, setConfigDir] = React.useState('~/.dsh/docs')
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [editDir, setEditDir] = React.useState('~/.dsh/docs')
      const [configMsg, setConfigMsg] = React.useState(null)
      const [selected, setSelected] = React.useState(null)
      const [content, setContent] = React.useState(null)
      const [contentLoading, setContentLoading] = React.useState(false)
      const [readError, setReadError] = React.useState(null)
      const [tocOpen, setTocOpen] = React.useState(false)
      const [openMsg, setOpenMsg] = React.useState(null)
      const [readerEl, setReaderEl] = React.useState(null)

      React.useEffect(function () {
        let alive = true
        setListLoading(true)
        setListError(null)
        rpc('config').then(function (cfg) {
          if (!alive || !cfg || !cfg.ok) return
          setConfigDir(cfg.docsDir)
          setEditDir(cfg.docsDir)
        }).catch(function () {})
        rpc('docs.list').then(function (res) {
          if (!alive) return
          setListLoading(false)
          if (res && res.ok) {
            setDocs(res.items || [])
            setListError(null)
          } else {
            setDocs([])
            setListError((res && res.error) || '读取文档列表失败')
          }
        }).catch(function (err) {
          if (!alive) return
          setListLoading(false)
          setDocs([])
          setListError(err && err.message ? err.message : String(err))
        })
        return function () { alive = false }
      }, [])

      function refreshList() {
        setListLoading(true)
        setListError(null)
        rpc('docs.list').then(function (res) {
          setListLoading(false)
          if (res && res.ok) {
            setDocs(res.items || [])
            setListError(null)
          } else {
            setDocs([])
            setListError((res && res.error) || '读取文档列表失败')
          }
        }).catch(function (err) {
          setListLoading(false)
          setDocs([])
          setListError(err && err.message ? err.message : String(err))
        })
      }

      function openDoc(rel) {
        currentReadRel = rel
        setSelected(rel)
        setContent(null)
        setReadError(null)
        setContentLoading(true)
        // 每篇文档默认收起大纲（不缓存状态）
        setTocOpen(false)
        // 切换文档后回到阅读区顶部，避免沿用上一篇的滚动位置
        if (readerEl !== null && typeof readerEl.scrollTop === 'number') {
          readerEl.scrollTop = 0
        }
        rpc('docs.read', { rel: rel }).then(function (res) {
          if (currentReadRel !== rel) return
          if (res && res.ok) {
            setContent(res.content)
            setReadError(null)
          } else {
            setContent(null)
            setReadError((res && res.error) || '读取失败')
          }
          setContentLoading(false)
        }).catch(function (err) {
          if (currentReadRel !== rel) return
          setContent(null)
          setReadError(err && err.message ? err.message : String(err))
          setContentLoading(false)
        })
      }

      function saveConfig(forceDir) {
        const dir = (forceDir !== undefined ? forceDir : editDir).trim()
        if (dir.length === 0) {
          setConfigMsg({ kind: 'err', text: '路径不能为空' })
          return
        }
        setConfigMsg(null)
        rpc('config.set', { docsDir: dir }).then(function (res) {
          if (res && res.ok) {
            setConfigMsg({ kind: 'ok', text: '已保存：' + dir })
            setConfigDir(res.docsDir || dir)
            setEditDir(res.docsDir || dir)
            refreshList()
          } else {
            setConfigMsg({ kind: 'err', text: (res && res.error) || '保存失败' })
          }
        }).catch(function (err) {
          setConfigMsg({ kind: 'err', text: err && err.message ? err.message : String(err) })
        })
      }

      function openExternal(app) {
        if (selected === null) return
        setOpenMsg(null)
        rpc('docs.open', { rel: selected, app: app }).then(function (res) {
          if (res && res.ok) return
          setOpenMsg((res && res.error) || '打开失败')
        }).catch(function (err) {
          setOpenMsg(err && err.message ? err.message : String(err))
        })
      }

      function jumpToHeading(hKey) {
        const el = headingEls[hKey]
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }

      const listItems = docs.map(function (item) {
        const title = item.name.replace(/\.(md|markdown)$/i, '')
        return React.createElement('button', {
          key: item.rel,
          type: 'button',
          className: 'dsp-item' + (selected === item.rel ? ' dsp-item-selected' : ''),
          title: item.rel,
          onClick: function () { openDoc(item.rel) },
        },
          React.createElement('span', { className: 'dsp-item-name' }, title),
          item.dir ? React.createElement('span', { className: 'dsp-item-dir' }, item.dir) : null
        )
      })

      const parsedBlocks = content !== null && readError === null ? parseBlocks(content) : null
      const markdownBody = parsedBlocks
        ? parsedBlocks.map(function (block, idx) { return renderBlock(block, idx) })
        : null
      const tocItems = []
      if (parsedBlocks) {
        for (let i = 0; i < parsedBlocks.length; i++) {
          const b = parsedBlocks[i]
          if (b.kind === 'h') tocItems.push({ level: b.level, text: stripInline(b.text), key: 'h' + i })
        }
      }

      const tocPanel = selected !== null && tocOpen ? React.createElement('div', { className: 'dsp-toc' },
        tocItems.length === 0
          ? React.createElement('p', { className: 'dsp-note' }, '本文档没有标题')
          : tocItems.map(function (item) {
              return React.createElement('button', {
                key: item.key,
                type: 'button',
                className: 'dsp-toc-item dsp-toc-l' + item.level,
                title: item.text || '(无标题)',
                onClick: function () { jumpToHeading(item.key) },
              }, item.text || '(无标题)')
            })
      ) : null

      const toolbar = selected !== null && readError === null ? React.createElement('div', { className: 'dsp-toolbar' },
        React.createElement('div', { className: 'dsp-toolbar-row' },
          React.createElement('button', {
            type: 'button',
            className: 'dsp-toolbar-btn',
            title: '用 Chrome 打开这篇文档',
            onClick: function () { openExternal('chrome') },
          }, '🌐 Chrome 打开'),
          React.createElement('button', {
            type: 'button',
            className: 'dsp-toolbar-btn',
            title: '用 VS Code 打开这篇文档',
            onClick: function () { openExternal('vscode') },
          }, '💻 VS Code 打开'),
          openMsg ? React.createElement('span', { className: 'dsp-msg dsp-msg-err' }, openMsg) : null,
          React.createElement('span', { className: 'dsp-toolbar-spacer' }),
          React.createElement('button', {
            type: 'button',
            className: 'dsp-toolbar-btn' + (tocOpen ? ' dsp-toolbar-btn-active' : ''),
            title: '展开或收起大纲',
            onClick: function () { setTocOpen(function (v) { return !v }) },
          }, '☰ 大纲')
        ),
        tocPanel
      ) : null

      return React.createElement('div', { className: 'dsp-root' },
        React.createElement('header', { className: 'dsp-header' },
          React.createElement('span', { className: 'dsp-title' }, '全局文档'),
          React.createElement('div', { className: 'dsp-header-actions' },
            React.createElement('button', {
              type: 'button',
              className: 'dsp-header-btn',
              title: '目录设置',
              'aria-label': '目录设置',
              onClick: function () { setSettingsOpen(function (v) { return !v }) },
            }, '⚙️')
          )
        ),
        settingsOpen ? React.createElement('div', { className: 'dsp-settings' },
          React.createElement('span', { className: 'dsp-settings-label' }, '文档目录'),
          React.createElement('input', {
            className: 'dsp-settings-input',
            value: editDir,
            placeholder: '~/.dsh/docs',
            onChange: function (ev) { setEditDir(ev.target.value) },
          }),
          React.createElement('button', { type: 'button', className: 'dsp-btn', onClick: function () { saveConfig(undefined) } }, '保存'),
          React.createElement('button', { type: 'button', className: 'dsp-btn', onClick: function () { saveConfig('~/.dsh/docs') } }, '恢复默认'),
          configMsg ? React.createElement('span', { className: 'dsp-msg ' + (configMsg.kind === 'ok' ? 'dsp-msg-ok' : 'dsp-msg-err') }, configMsg.text) : null,
          React.createElement('div', { className: 'dsp-settings-hint' }, '当前目录：' + configDir + '（保存在 ~/.dsh/storages/dsh-docs-panel/config.json）')
        ) : null,
        toolbar,
        React.createElement('div', { className: 'dsp-body' },
          React.createElement('aside', { className: 'dsp-list' },
            listLoading ? React.createElement('p', { className: 'dsp-note' }, '正在读取文档列表…') : null,
            !listLoading && listError ? React.createElement('p', { className: 'dsp-note dsp-note-error' }, listError) : null,
            !listLoading && !listError && listItems.length === 0
              ? React.createElement('p', { className: 'dsp-note' }, '没有找到 Markdown 文档。把 .md 文件放入 ' + configDir + ' 即可在这里阅读。')
              : null,
            listItems
          ),
          React.createElement('main', { className: 'dsp-reader', ref: setReaderEl },
            selected === null ? React.createElement('p', { className: 'dsp-note' }, '从左侧列表选择一篇文档开始阅读') : null,
            contentLoading ? React.createElement('p', { className: 'dsp-note' }, '正在打开文档…') : null,
            readError ? React.createElement('p', { className: 'dsp-note dsp-note-error' }, readError) : null,
            markdownBody ? React.createElement('article', { className: 'dsp-markdown' }, markdownBody) : null
          )
        )
      )
    }

  }

  exports.apply = apply
  return module.exports
} })
