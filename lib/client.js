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
      // 折叠态的窄竖条：28px，只放一个「展开」按钮
      '.dsp-list-rail{box-sizing:border-box;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));width:28px;flex:none;display:flex;flex-direction:column;align-items:center;padding:6px 0}',
      '.dsp-rail-btn{width:22px;height:22px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;font-size:11px;padding:0}',
      '.dsp-rail-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-note{color:var(--dsw-alias-label-dimmed);margin:4px 6px;font-size:12px;line-height:18px}',
      '.dsp-note-error{color:var(--dsw-alias-state-error-primary)}',
      '.dsp-item-selected{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-brand-primary)}',
      // 列表工具条（新建文件 / 新建文件夹 / 刷新）
      '.dsp-list-tools{display:flex;align-items:center;gap:4px;padding:2px 4px 6px;flex:none}',
      '.dsp-tool-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;border-radius:6px;height:22px;padding:0 7px;white-space:nowrap}',
      '.dsp-tool-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-tool-btn:disabled{opacity:0.5;cursor:default}',
      '.dsp-tool-spacer{flex:1}',
      '.dsp-status{max-width:none;white-space:normal;word-break:break-all;margin:2px 6px 4px}',
      // 文件树行
      '.dsp-row{display:flex;align-items:center;gap:3px;border-radius:6px;padding:3px 6px;cursor:pointer;color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;min-width:0}',
      '.dsp-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsp-row-dir{color:var(--dsw-alias-label-primary)}',
      '.dsp-row-new{background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base))}',
      '.dsp-twist{width:14px;height:16px;flex:none;border:none;background:transparent;color:var(--dsw-alias-label-dimmed);cursor:pointer;padding:0;font-size:9px;line-height:16px;text-align:center}',
      '.dsp-twist-empty{cursor:default}',
      '.dsp-node-icon{flex:none;width:14px;text-align:center;font-size:11px;line-height:1}',
      '.dsp-node-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-node-label-dim{color:var(--dsw-alias-label-dimmed)}',
      '.dsp-node-actions{display:none;flex:none;align-items:center;gap:1px}',
      '.dsp-row:hover .dsp-node-actions{display:flex}',
      '.dsp-node-actions-show{display:flex}',
      '.dsp-icon-btn{width:18px;height:18px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:4px;padding:0;font-size:11px;line-height:18px}',
      '.dsp-icon-btn:hover{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}',
      '.dsp-inline-input{flex:1;min-width:0;height:20px;font:inherit;font-size:12px;border:1px solid var(--dsw-alias-brand-primary);border-radius:4px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 4px;outline:none}',
      // 回收站
      '.dsp-trash-toggle{color:var(--dsw-alias-label-secondary);margin-top:4px;border-top:1px solid var(--dsw-alias-border-l1);border-radius:0}',
      '.dsp-trash-row{cursor:default}',
      '.dsp-trash-note{padding-left:16px}',
      '.dsp-reader{position:relative;flex:1;min-width:0;padding:20px 24px;overflow-y:auto}',
      // 文档工具条（固定面板头部下方，不随文档滚动，绝不遮挡标题）
      '.dsp-toolbar{position:relative;flex:none;z-index:8;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));border-bottom:1px solid var(--dsw-alias-border-l1);padding:4px 12px}',
      '.dsp-toolbar-row{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}',
      '.dsp-toolbar-spacer{flex:1}',
      '.dsp-toolbar-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;border-radius:6px;height:26px;padding:0 10px;display:inline-flex;align-items:center;gap:4px}',
      '.dsp-toolbar-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-toolbar-btn-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.dsp-toolbar-btn-primary{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.dsp-toolbar-btn:disabled{opacity:0.5;cursor:default}',
      // 编辑器：源码 + 实时预览
      '.dsp-reader-editing{padding:0;display:flex;flex-direction:column;overflow:hidden}',
      '.dsp-editor{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}',
      '.dsp-editor-bar{flex:none;display:flex;align-items:center;gap:2px;flex-wrap:wrap;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base))}',
      '.dsp-fmt-btn{min-width:24px;height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:5px;padding:0 5px;font:inherit;font-size:12px;line-height:24px}',
      '.dsp-fmt-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsp-tool-btn-on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.dsp-tool-btn-dirty{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.dsp-editor-body{display:flex;flex:1;min-height:0}',
      '.dsp-editor-text{flex:1;min-width:0;box-sizing:border-box;resize:none;border:none;outline:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsh-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:13px;line-height:1.7;padding:12px 16px}',
      '.dsp-editor-preview{flex:1;min-width:0;overflow-y:auto;border-left:1px solid var(--dsw-alias-border-l1);padding:16px 20px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base))}',
      '.dsp-editor-hint{flex:none;color:var(--dsw-alias-label-dimmed);font-size:11px;line-height:16px;padding:3px 10px;border-top:1px solid var(--dsw-alias-border-l1)}',
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
      // 窄面板里编辑/预览改为上下堆叠，避免两栏都被挤扁
      '@media (max-width:700px){.dsp-editor-body{flex-direction:column}.dsp-editor-preview{border-left:none;border-top:1px solid var(--dsw-alias-border-l1)}}',
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

    // 上次打开的文档 rel：localStorage 记忆，重新打开面板时恢复到原位置。
    // localStorage 不可用时照常浏览，只是不记忆。
    const SELECTED_REL_KEY = 'dsh-docs-panel.selected-rel'
    function readSavedRel() {
      try {
        const value = window.localStorage.getItem(SELECTED_REL_KEY)
        return typeof value === 'string' && value.length > 0 ? value : null
      } catch (error) { return null }
    }
    function saveSelectedRel(rel) {
      try {
        if (rel === null) window.localStorage.removeItem(SELECTED_REL_KEY)
        else window.localStorage.setItem(SELECTED_REL_KEY, rel)
      } catch (error) {}
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
      const [tree, setTree] = React.useState(null)
      const [listLoading, setListLoading] = React.useState(true)
      const [listError, setListError] = React.useState(null)
      const [truncated, setTruncated] = React.useState(false)
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
      // 折叠状态：只有显式收起（true）才算收起，未记录 = 展开
      const [collapsed, setCollapsed] = React.useState({})
      // 文件列表整体折叠：记忆在 localStorage，不可用时仍可切换只是不持久
      const [listCollapsed, setListCollapsed] = React.useState(function () {
        try { return window.localStorage.getItem('dsh-docs-panel.list-collapsed') === '1' } catch (error) { return false }
      })
      // 行内新建：{ kind: 'file' | 'dir', parentRel }
      const [newEntry, setNewEntry] = React.useState(null)
      // 行内重命名：{ rel, name }
      const [rowEdit, setRowEdit] = React.useState(null)
      // 回收站（.trash/ 下的条目）
      const [trash, setTrash] = React.useState([])
      const [trashOpen, setTrashOpen] = React.useState(false)
      // 写操作状态与反馈
      const [opBusy, setOpBusy] = React.useState(false)
      const [opMsg, setOpMsg] = React.useState(null)
      // 编辑器：草稿 + 上次读/存的内容（用于脏检查）
      const [editorOpen, setEditorOpen] = React.useState(false)
      const [draft, setDraft] = React.useState('')
      const [savedText, setSavedText] = React.useState('')
      const [previewOn, setPreviewOn] = React.useState(true)
      const [saving, setSaving] = React.useState(false)
      const [saveMsg, setSaveMsg] = React.useState(null)
      const [textareaEl, setTextareaEl] = React.useState(null)

      React.useEffect(function () {
        let alive = true
        rpc('config').then(function (cfg) {
          if (!alive || !cfg || !cfg.ok) return
          setConfigDir(cfg.docsDir)
          setEditDir(cfg.docsDir)
        }).catch(function () {})
        refreshList()
        refreshTrash()
        // 恢复上次打开的文档（docs.read 不依赖列表，可直接发；文件若已被
        // 外部删除，读取会走常规错误展示，用户另选一篇即覆盖记忆）
        const savedRel = readSavedRel()
        if (savedRel !== null) openDoc(savedRel)
        return function () { alive = false }
      }, [])

      // docs.list 响应统一落状态
      function applyList(res) {
        if (res && res.ok) {
          setTree(res.tree || { name: '', rel: '', type: 'dir', children: [] })
          setTruncated(res.truncated === true)
          setListError(null)
        } else {
          setTree(null)
          setTruncated(false)
          setListError((res && res.error) || '读取文档列表失败')
        }
      }

      function refreshList() {
        setListLoading(true)
        setListError(null)
        rpc('docs.list').then(function (res) {
          setListLoading(false)
          applyList(res)
        }).catch(function (err) {
          setListLoading(false)
          setTree(null)
          setTruncated(false)
          setListError(err && err.message ? err.message : String(err))
        })
      }

      function refreshTrash() {
        rpc('docs.trash.list').then(function (res) {
          if (res && res.ok) setTrash(res.items || [])
        }).catch(function () {})
      }

      function openDoc(rel) {
        // 点同一篇时当作「重新读取」；正在编辑同一篇则不动，免得打断输入
        const sameFile = selected === rel && readError === null
        if (sameFile && (isDirty() || contentLoading)) return
        if (!sameFile && isDirty() && !confirmDialog('当前文件有未保存的修改，放弃并打开「' + rel + '」？')) return
        currentReadRel = rel
        setSelected(rel)
        saveSelectedRel(rel)
        setContent(null)
        setReadError(null)
        setContentLoading(true)
        setSaveMsg(null)
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
            // 编辑模式切换文档：草稿跟着换过去
            if (editorOpen) {
              setDraft(res.content)
              setSavedText(res.content)
            }
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

      // ---------- 文件管理操作 ----------

      // 写操作统一收口：成功 → 提示 + 刷新列表/回收站；失败 → 展示宿主端返回的原因
      function runOp(method, args, okText, onSuccess) {
        setOpBusy(true)
        setOpMsg(null)
        rpc(method, args).then(function (res) {
          setOpBusy(false)
          if (res && res.ok) {
            setOpMsg({ kind: 'ok', text: typeof okText === 'function' ? okText(res) : okText })
            if (onSuccess !== undefined) onSuccess(res)
            refreshList()
            refreshTrash()
          } else {
            setOpMsg({ kind: 'err', text: (res && res.error) || '操作失败' })
          }
        }).catch(function (err) {
          setOpBusy(false)
          setOpMsg({ kind: 'err', text: err && err.message ? err.message : String(err) })
        })
      }

      function confirmDialog(message) {
        if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true
        return window.confirm(message)
      }

      function toggleDir(rel) {
        setCollapsed(function (prev) {
          const next = Object.assign({}, prev)
          if (next[rel] === true) delete next[rel]
          else next[rel] = true
          return next
        })
      }

      function toggleList() {
        setListCollapsed(function (v) {
          const next = !v
          try { window.localStorage.setItem('dsh-docs-panel.list-collapsed', next ? '1' : '0') } catch (error) {}
          return next
        })
      }

      function startNew(kind, parentRel) {
        if (parentRel !== '') {
          setCollapsed(function (prev) {
            if (prev[parentRel] !== true) return prev
            const next = Object.assign({}, prev)
            delete next[parentRel]
            return next
          })
        }
        setRowEdit(null)
        setOpMsg(null)
        setNewEntry({ kind: kind, parentRel: parentRel })
      }

      function submitNew(rawName) {
        if (newEntry === null) return
        const target = newEntry
        const name = typeof rawName === 'string' ? rawName.trim() : ''
        setNewEntry(null)
        if (name.length === 0) return
        const isDir = target.kind === 'dir'
        runOp(isDir ? 'docs.mkdir' : 'docs.createFile', { rel: target.parentRel, name: name },
          function (res) { return '已新建：' + (res && res.rel ? res.rel : name) })
      }

      function startRename(node) {
        setNewEntry(null)
        setOpMsg(null)
        setRowEdit({ rel: node.rel, name: node.name })
      }

      function submitRename(rel, rawName) {
        const name = typeof rawName === 'string' ? rawName.trim() : ''
        setRowEdit(null)
        if (name.length === 0) return
        runOp('docs.rename', { rel: rel, name: name },
          function (res) { return '已重命名：' + (res && res.rel ? res.rel : name) },
          function (res) {
            // 正在阅读的文档跟着改名走（内容不变，无需重新读取）
            const nextRel = res && typeof res.rel === 'string' ? res.rel : null
            if (selected === null || nextRel === null) return
            if (selected === rel) { setSelected(nextRel); saveSelectedRel(nextRel) }
            else if (selected.indexOf(rel + '/') === 0) { setSelected(nextRel + selected.slice(rel.length)); saveSelectedRel(nextRel + selected.slice(rel.length)) }
          })
      }

      function removeEntry(rel) {
        runOp('docs.remove', { rel: rel }, function () { return '已移入回收站：' + rel },
          function () {
            if (selected !== null && (selected === rel || selected.indexOf(rel + '/') === 0)) {
              setSelected(null)
              saveSelectedRel(null)
              setContent(null)
              setReadError(null)
              setTocOpen(false)
              // 正在编辑的就是被删掉的那个：直接退出编辑态，避免对着空气保存
              setEditorOpen(false)
              setDraft('')
              setSavedText('')
              setSaveMsg(null)
            }
          })
      }

      function confirmRemove(node) {
        const label = node.type === 'dir' ? '文件夹' : '文件'
        if (!confirmDialog('把' + label + '「' + node.rel + '」移入回收站？\n可在列表底部的「回收站」里恢复。')) return
        removeEntry(node.rel)
      }

      function restoreTrash(id) {
        runOp('docs.trash.restore', { id: id },
          function (res) { return '已恢复：' + (res && res.rel ? res.rel : id) })
      }

      function purgeTrash(item) {
        if (!confirmDialog('彻底删除「' + (item.rel || item.id) + '」？此操作不可恢复。')) return
        runOp('docs.trash.purge', { id: item.id }, '已彻底删除')
      }

      function emptyTrash() {
        if (trash.length === 0) return
        if (!confirmDialog('清空回收站？其中 ' + trash.length + ' 项将无法恢复。')) return
        runOp('docs.trash.empty', {}, '回收站已清空')
      }

      // ---------- 编辑器（Markdown 源码 + 实时预览） ----------

      function isDirty() {
        return editorOpen && draft !== savedText
      }

      function selectionRange() {
        const el = textareaEl
        if (el === null || typeof el.selectionStart !== 'number') return null
        return { start: el.selectionStart, end: el.selectionEnd }
      }

      // 受控 textarea 的选区必须等 React 提交新值之后再设回去，否则会被覆盖
      function replaceRange(next, selStart, selEnd) {
        setDraft(next)
        const el = textareaEl
        if (el === null) return
        const apply = function () {
          el.focus()
          if (typeof el.setSelectionRange === 'function') el.setSelectionRange(selStart, selEnd)
        }
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(apply)
        } else {
          apply()
        }
      }

      // 选区包裹：粗体 / 斜体 / 删除线 / 行内代码 / 链接
      function wrapSelection(before, after, placeholder) {
        const sel = selectionRange()
        if (sel === null) return
        const selected = draft.slice(sel.start, sel.end)
        const body = selected.length > 0 ? selected : placeholder
        const next = draft.slice(0, sel.start) + before + body + after + draft.slice(sel.end)
        replaceRange(next, sel.start + before.length, sel.start + before.length + body.length)
      }

      function lineRangeOf(value, start, end) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        let lineEnd = value.indexOf('\n', end)
        if (lineEnd === -1) lineEnd = value.length
        return { lineStart: lineStart, lineEnd: lineEnd, text: value.slice(lineStart, lineEnd) }
      }

      // 逐行变换（列表 / 引用 / 标题 / 缩进）
      function mapLines(fn) {
        const sel = selectionRange()
        if (sel === null) return
        const range = lineRangeOf(draft, sel.start, sel.end)
        const mapped = range.text.split('\n').map(fn).join('\n')
        replaceRange(
          draft.slice(0, range.lineStart) + mapped + draft.slice(range.lineEnd),
          range.lineStart,
          range.lineStart + mapped.length,
        )
      }

      // 行首标记开关：全都带了就整体去掉，否则整体加上
      function toggleLinePrefix(prefix) {
        const sel = selectionRange()
        if (sel === null) return
        const lines = lineRangeOf(draft, sel.start, sel.end).text.split('\n')
        const contentful = lines.filter(function (line) { return line.trim().length > 0 })
        const hasAll = contentful.length > 0 && contentful.every(function (line) { return line.startsWith(prefix) })
        mapLines(function (line) {
          if (line.trim().length === 0) return line
          if (hasAll) return line.startsWith(prefix) ? line.slice(prefix.length) : line
          return prefix + line
        })
      }

      function setHeadingLevel(level) {
        mapLines(function (line) {
          if (line.trim().length === 0) return line
          const bare = line.replace(/^#{1,6}\s+/, '')
          return level === 0 ? bare : '#'.repeat(level) + ' ' + bare
        })
      }

      function indentLines(outdent) {
        mapLines(function (line) {
          if (line.trim().length === 0) return line
          if (!outdent) return '  ' + line
          if (line.startsWith('  ')) return line.slice(2)
          return line.startsWith('\t') ? line.slice(1) : line
        })
      }

      // 整块插入（代码块 / 表格 / 分隔线），保证与上下文之间有空行。
      // caretOffset 是相对插入块自身的落点（省略则落到块尾），例如代码块要落在围栏内。
      function insertBlock(text, caretOffset) {
        const sel = selectionRange()
        if (sel === null) return
        const before = draft.slice(0, sel.start)
        let lead = ''
        if (before.length > 0 && !before.endsWith('\n')) lead = '\n\n'
        else if (before.endsWith('\n') && !before.endsWith('\n\n')) lead = '\n'
        const insert = lead + text
        const at = sel.start + (caretOffset === undefined ? insert.length : lead.length + caretOffset)
        replaceRange(before + insert + draft.slice(sel.end), at, at)
      }

      function startEdit() {
        if (selected === null || content === null) return
        setDraft(content)
        setSavedText(content)
        setSaveMsg(null)
        setRowEdit(null)
        setNewEntry(null)
        setEditorOpen(true)
      }

      function closeEditor() {
        if (isDirty() && !confirmDialog('有未保存的修改，确定放弃吗？')) return
        setEditorOpen(false)
        setSaveMsg(null)
      }

      function saveDraft() {
        if (!editorOpen || selected === null) return
        if (!isDirty()) {
          setSaveMsg({ kind: 'ok', text: '没有需要保存的修改' })
          return
        }
        const rel = selected
        const text = draft
        setSaving(true)
        setSaveMsg(null)
        rpc('docs.save', { rel: rel, content: text }).then(function (res) {
          setSaving(false)
          if (res && res.ok) {
            setSavedText(text)
            setContent(text)
            setSaveMsg({ kind: 'ok', text: '已保存' })
          } else {
            setSaveMsg({ kind: 'err', text: (res && res.error) || '保存失败' })
          }
        }).catch(function (err) {
          setSaving(false)
          setSaveMsg({ kind: 'err', text: err && err.message ? err.message : String(err) })
        })
      }

      function onEditorKeyDown(ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.altKey !== true) {
          const key = ev.key.toLowerCase()
          if (key === 's') { ev.preventDefault(); saveDraft(); return }
          if (key === 'b') { ev.preventDefault(); wrapSelection('**', '**', '粗体'); return }
          if (key === 'i') { ev.preventDefault(); wrapSelection('*', '*', '斜体'); return }
          if (key === 'k') { ev.preventDefault(); wrapSelection('[', '](url)', '链接文字'); return }
          return
        }
        if (ev.key === 'Tab') {
          ev.preventDefault()
          indentLines(ev.shiftKey === true)
          return
        }
        if (ev.key !== 'Enter' || ev.shiftKey === true) return
        // 回车续写列表：`- ` / `1. ` 继续，空列表项则退出列表
        const el = ev.target
        const start = el.selectionStart
        const lineStart = draft.lastIndexOf('\n', start - 1) + 1
        const match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(draft.slice(lineStart, start))
        if (match === null) return
        ev.preventDefault()
        if (match[3].trim().length === 0) {
          const next = draft.slice(0, lineStart) + match[1] + draft.slice(start)
          replaceRange(next, lineStart + match[1].length, lineStart + match[1].length)
          return
        }
        const marker = /^\d/.test(match[2]) ? (parseInt(match[2], 10) + 1) + '. ' : match[2] + ' '
        const insert = '\n' + match[1] + marker
        const next = draft.slice(0, start) + insert + draft.slice(el.selectionEnd)
        replaceRange(next, start + insert.length, start + insert.length)
      }

      // 预览解析成本随正文增长，过大时先关掉实时预览（可按「预览」强开）
      const PREVIEW_MAX_CHARS = 200000

      function renderEditor() {
        const dirty = isDirty()
        const tools = [
          { label: 'H1', title: '一级标题', run: function () { setHeadingLevel(1) } },
          { label: 'H2', title: '二级标题', run: function () { setHeadingLevel(2) } },
          { label: 'H3', title: '三级标题', run: function () { setHeadingLevel(3) } },
          { label: '¶', title: '正文（去掉标题标记）', run: function () { setHeadingLevel(0) } },
          { label: 'B', title: '粗体（Ctrl/Cmd+B）', run: function () { wrapSelection('**', '**', '粗体') } },
          { label: 'I', title: '斜体（Ctrl/Cmd+I）', run: function () { wrapSelection('*', '*', '斜体') } },
          { label: 'S', title: '删除线', run: function () { wrapSelection('~~', '~~', '删除线') } },
          { label: '‹›', title: '行内代码', run: function () { wrapSelection('`', '`', 'code') } },
          { label: '❝', title: '引用', run: function () { toggleLinePrefix('> ') } },
          { label: '•', title: '无序列表', run: function () { toggleLinePrefix('- ') } },
          { label: '1.', title: '有序列表', run: function () { toggleLinePrefix('1. ') } },
          { label: '☑', title: '任务列表', run: function () { toggleLinePrefix('- [ ] ') } },
          { label: '🔗', title: '链接（Ctrl/Cmd+K）', run: function () { wrapSelection('[', '](url)', '链接文字') } },
          { label: '{ }', title: '插入代码块', run: function () { insertBlock('```\n\n```\n', 4) } },
          { label: '▦', title: '插入表格', run: function () { insertBlock('| 列 1 | 列 2 |\n| --- | --- |\n|  |  |\n') } },
          { label: '―', title: '插入分隔线', run: function () { insertBlock('---\n') } },
        ]
        const toolButtons = tools.map(function (tool) {
          return React.createElement('button', {
            key: tool.label,
            type: 'button',
            className: 'dsp-fmt-btn',
            title: tool.title,
            tabIndex: -1,
            onMouseDown: function (ev) { ev.preventDefault() },
            onClick: tool.run,
          }, tool.label)
        })
        let preview = null
        if (previewOn) {
          preview = React.createElement('div', { className: 'dsp-editor-preview' },
            draft.length > PREVIEW_MAX_CHARS
              ? React.createElement('p', { className: 'dsp-note' }, '正文过长，已暂停实时预览。')
              : React.createElement('article', { className: 'dsp-markdown' },
                  parseBlocks(draft).map(function (block, idx) { return renderBlock(block, idx) }))
          )
        }
        return React.createElement('div', { className: 'dsp-editor' },
          React.createElement('div', { className: 'dsp-editor-bar' },
            toolButtons,
            React.createElement('span', { className: 'dsp-tool-spacer' }),
            React.createElement('button', {
              type: 'button',
              className: 'dsp-tool-btn' + (previewOn ? ' dsp-tool-btn-on' : ''),
              title: '显示 / 隐藏实时预览',
              onClick: function () { setPreviewOn(function (v) { return !v }) },
            }, '预览'),
            React.createElement('button', {
              type: 'button',
              className: 'dsp-tool-btn dsp-tool-btn-primary' + (dirty ? ' dsp-tool-btn-dirty' : ''),
              disabled: saving,
              title: '保存（Ctrl/Cmd+S）',
              onClick: saveDraft,
            }, saving ? '保存中…' : (dirty ? '保存 ●' : '保存')),
            React.createElement('button', {
              type: 'button',
              className: 'dsp-tool-btn',
              title: '退出编辑',
              onClick: closeEditor,
            }, '完成')
          ),
          saveMsg ? React.createElement('p', {
            className: 'dsp-msg ' + (saveMsg.kind === 'ok' ? 'dsp-msg-ok' : 'dsp-msg-err') + ' dsp-status',
          }, saveMsg.text) : null,
          React.createElement('div', { className: 'dsp-editor-body' },
            React.createElement('textarea', {
              className: 'dsp-editor-text',
              ref: setTextareaEl,
              value: draft,
              spellCheck: false,
              placeholder: '# 开始写 Markdown…',
              onChange: function (ev) { setDraft(ev.target.value) },
              onKeyDown: onEditorKeyDown,
            }),
            preview
          ),
          React.createElement('div', { className: 'dsp-editor-hint' },
            'Ctrl/Cmd+S 保存 · Ctrl/Cmd+B 粗体 · Ctrl/Cmd+I 斜体 · Ctrl/Cmd+K 链接 · Tab 缩进 · Shift+Tab 反缩进'
          )
        )
      }

      // ---------- 树与回收站渲染 ----------

      function stripMarkdownExt(name) {
        return name.replace(/\.(md|markdown)$/i, '')
      }

      function iconBtn(key, label, title, onClick) {
        return React.createElement('button', {
          key: key,
          type: 'button',
          className: 'dsp-icon-btn',
          title: title,
          'aria-label': title,
          onClick: function (ev) { ev.stopPropagation(); onClick() },
        }, label)
      }

      function renderRow(node, depth) {
        const isDir = node.type === 'dir'
        const open = isDir && collapsed[node.rel] !== true
        const editing = rowEdit !== null && rowEdit.rel === node.rel
        const children = []
        children.push(React.createElement('button', {
          key: 'twist',
          type: 'button',
          className: 'dsp-twist' + (isDir ? '' : ' dsp-twist-empty'),
          tabIndex: isDir ? 0 : -1,
          title: isDir ? (open ? '收起' : '展开') : '',
          'aria-label': isDir ? (open ? '收起' : '展开') : '',
          onClick: isDir ? function (ev) { ev.stopPropagation(); toggleDir(node.rel) } : function (ev) { ev.stopPropagation() },
        }, isDir ? (open ? '▾' : '▸') : ''))
        children.push(React.createElement('span', { key: 'icon', className: 'dsp-node-icon' },
          isDir ? (open ? '📂' : '📁') : '📄'))
        if (editing) {
          children.push(React.createElement('input', {
            key: 'edit',
            className: 'dsp-inline-input',
            defaultValue: rowEdit.name,
            autoFocus: true,
            spellCheck: false,
            onClick: function (ev) { ev.stopPropagation() },
            onKeyDown: function (ev) {
              if (ev.key === 'Enter') submitRename(node.rel, ev.target.value)
              else if (ev.key === 'Escape') setRowEdit(null)
            },
            onBlur: function () { setRowEdit(null) },
          }))
        } else {
          children.push(React.createElement('span', { key: 'label', className: 'dsp-node-label' },
            isDir ? node.name : stripMarkdownExt(node.name)))
        }
        if (!editing) {
          children.push(React.createElement('span', { key: 'act', className: 'dsp-node-actions' },
            isDir ? iconBtn('add', '＋', '在此新建文件', function () { startNew('file', node.rel) }) : null,
            isDir ? iconBtn('addDir', '＋📁', '在此新建文件夹', function () { startNew('dir', node.rel) }) : null,
            iconBtn('ren', '✎', '重命名', function () { startRename(node) }),
            iconBtn('del', '🗑', '移入回收站', function () { confirmRemove(node) })
          ))
        }
        return React.createElement('div', {
          key: node.rel,
          className: 'dsp-row' + (isDir ? ' dsp-row-dir' : '') + (!isDir && selected === node.rel ? ' dsp-item-selected' : ''),
          style: { paddingLeft: (4 + depth * 12) + 'px' },
          title: node.rel,
          onClick: function () { if (isDir) toggleDir(node.rel); else openDoc(node.rel) },
        }, children)
      }

      function renderNewEntryRow(depth, parentRel, kind) {
        return React.createElement('div', {
          key: 'new:' + parentRel,
          className: 'dsp-row dsp-row-new',
          style: { paddingLeft: (4 + depth * 12) + 'px' },
        },
          React.createElement('span', { className: 'dsp-twist dsp-twist-empty' }),
          React.createElement('span', { className: 'dsp-node-icon' }, kind === 'dir' ? '📁' : '📄'),
          React.createElement('input', {
            className: 'dsp-inline-input',
            autoFocus: true,
            spellCheck: false,
            placeholder: kind === 'dir' ? '文件夹名' : '文件名（自动补 .md）',
            onKeyDown: function (ev) {
              if (ev.key === 'Enter') submitNew(ev.target.value)
              else if (ev.key === 'Escape') setNewEntry(null)
            },
            onBlur: function () { setNewEntry(null) },
          })
        )
      }

      function collectRows(node, depth, out) {
        for (const child of node.children) {
          out.push(renderRow(child, depth))
          if (child.type !== 'dir' || collapsed[child.rel] === true) continue
          if (newEntry !== null && newEntry.parentRel === child.rel) {
            out.push(renderNewEntryRow(depth + 1, child.rel, newEntry.kind))
          }
          collectRows(child, depth + 1, out)
        }
        return out
      }

      const treeRows = []
      if (tree !== null) {
        if (newEntry !== null && newEntry.parentRel === '') {
          treeRows.push(renderNewEntryRow(0, '', newEntry.kind))
        }
        collectRows(tree, 0, treeRows)
      }

      const trashRows = []
      if (trashOpen) {
        if (trash.length === 0) {
          trashRows.push(React.createElement('p', { key: 'none', className: 'dsp-note dsp-trash-note' }, '回收站是空的'))
        } else {
          for (const item of trash) {
            trashRows.push(React.createElement('div', {
              key: item.id,
              className: 'dsp-row dsp-trash-row',
              style: { paddingLeft: '16px' },
              title: item.rel || item.id,
            },
              React.createElement('span', { className: 'dsp-node-icon' }, item.type === 'directory' ? '📁' : '📄'),
              React.createElement('span', { className: 'dsp-node-label dsp-node-label-dim' }, item.rel || '(记录已损坏)'),
              React.createElement('span', { className: 'dsp-node-actions dsp-node-actions-show' },
                iconBtn('back', '↩', '恢复到原位置', function () { restoreTrash(item.id) }),
                iconBtn('purge', '✕', '彻底删除', function () { purgeTrash(item) })
              )
            ))
          }
          trashRows.push(React.createElement('div', { key: 'empty', className: 'dsp-list-tools' },
            React.createElement('button', {
              type: 'button',
              className: 'dsp-tool-btn',
              disabled: opBusy,
              onClick: emptyTrash,
            }, '清空回收站')
          ))
        }
      }

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

      // 阅读态工具条：编辑中不显示（编辑态有自己的工具条）
      const canEdit = selected !== null && content !== null && readError === null
      const toolbar = !editorOpen && selected !== null && readError === null ? React.createElement('div', { className: 'dsp-toolbar' },
        React.createElement('div', { className: 'dsp-toolbar-row' },
          React.createElement('button', {
            type: 'button',
            className: 'dsp-toolbar-btn dsp-toolbar-btn-primary',
            title: '在面板内编辑这篇文档',
            disabled: !canEdit,
            onClick: startEdit,
          }, '✎ 编辑'),
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
          React.createElement('div', { className: 'dsp-settings-hint' }, '当前目录：' + configDir + '（配置保存在 $DSH_HOME/storages/dsh-docs-panel/config.json，默认 ~/.dsh/…）')
        ) : null,
        toolbar,
        React.createElement('div', { className: 'dsp-body' },
          listCollapsed
            ? React.createElement('aside', { className: 'dsp-list-rail' },
              React.createElement('button', {
                type: 'button', className: 'dsp-rail-btn', title: '展开文件列表',
                'aria-label': '展开文件列表',
                onClick: toggleList,
              }, '»'))
            : React.createElement('aside', { className: 'dsp-list' },
            React.createElement('div', { className: 'dsp-list-tools' },
              React.createElement('button', {
                type: 'button', className: 'dsp-tool-btn', disabled: opBusy,
                title: '在文档目录根下新建 Markdown 文件',
                onClick: function () { startNew('file', '') },
              }, '＋文件'),
              React.createElement('button', {
                type: 'button', className: 'dsp-tool-btn', disabled: opBusy,
                title: '在文档目录根下新建文件夹',
                onClick: function () { startNew('dir', '') },
              }, '＋文件夹'),
              React.createElement('span', { className: 'dsp-tool-spacer' }),
              React.createElement('button', {
                type: 'button', className: 'dsp-tool-btn', title: '折叠文件列表',
                onClick: toggleList,
              }, '«'),
              React.createElement('button', {
                type: 'button', className: 'dsp-tool-btn', title: '刷新列表', onClick: refreshList,
              }, '⟳')
            ),
            opMsg ? React.createElement('p', {
              className: 'dsp-msg ' + (opMsg.kind === 'ok' ? 'dsp-msg-ok' : 'dsp-msg-err') + ' dsp-status',
            }, opMsg.text) : null,
            listLoading ? React.createElement('p', { className: 'dsp-note' }, '正在读取文档列表…') : null,
            !listLoading && listError ? React.createElement('p', { className: 'dsp-note dsp-note-error' }, listError) : null,
            !listLoading && !listError && tree !== null && tree.children.length === 0
              ? React.createElement('p', { className: 'dsp-note' }, '这里还是空的。用上面的「＋文件 / ＋文件夹」新建，或把 .md 放进 ' + configDir + '。')
              : null,
            !listLoading && !listError ? treeRows : null,
            !listLoading && !listError && truncated
              ? React.createElement('p', { className: 'dsp-note' }, '条目过多，仅显示前面一部分（上限 500）。')
              : null,
            !listLoading && !listError ? React.createElement('div', {
              className: 'dsp-row dsp-row-dir dsp-trash-toggle',
              style: { paddingLeft: '4px' },
              onClick: function () { setTrashOpen(function (v) { return !v }) },
            },
              React.createElement('span', { className: 'dsp-twist' }, trashOpen ? '▾' : '▸'),
              React.createElement('span', { className: 'dsp-node-icon' }, '🗑'),
              React.createElement('span', { className: 'dsp-node-label' }, '回收站' + (trash.length > 0 ? '（' + trash.length + '）' : ''))
            ) : null,
            !listLoading && !listError ? trashRows : null
          ),
          editorOpen
            ? React.createElement('main', { className: 'dsp-reader dsp-reader-editing' }, renderEditor())
            : React.createElement('main', { className: 'dsp-reader', ref: setReaderEl },
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
