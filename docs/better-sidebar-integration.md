# dsh-docs-panel × DSH-better-sidebar 接入改造方案

> 版本：v1.2 · 状态：✅ 已实施（v0.1.0）
> 面向对象：dsh-docs-panel 维护者 + 接手实现的技术人员
> 附带「给非技术读者的摘要」一节（见文末）。

> **实施记录（v0.1.0）**：完整改造已落地——
> - `lib/client.js` 注册 better-sidebar tab（id `dsh-docs-panel:docs`，title「全局文档」），移除右上角按钮与浮层壳，新增自绘 outline 风格 tab 图标，样式对齐内置面板（header 36px / 28px 圆形图标按钮 / bg-layer-1）；
> - **时序修复（冷启动）**：`betterSidebar` 不能放进 `dsh.client.inject` 静态依赖（否则 better-sidebar 未就绪时插件 pending/静默跳过，表现为「热重载正常、重启后消失」），改用 `ctx.plugin({ inject: ['betterSidebar'], apply })` 声明服务依赖（与官方案例 dsh-sentinel 一致）；
> - `package.json`：v0.0.1 → v0.1.0，`dsh.client.inject` 只留 `timer`，新增 `peerDependencies.dsh-better-sidebar: >=0.4.0`；
> - `markdown-test.cjs` 定位锚点同步为 `DocsView`；README 整体重写并更新演示图。
> host 端 `lib/index.js` 与 `cordis.patch.yml` 未改动。

---

## 0. 一句话结论

**可行性：完全可行。** 把 dsh-docs-panel 的文档阅读功能注册成 DSH-better-sidebar 的一个侧边栏 tab（与资源管理器 / Git / 终端同级的页面），改动集中在浏览器端一个文件（`lib/client.js`），宿主端与数据接口一行不用动。已确认 better-sidebar 对外部插件的注册**完全开放**（无白名单，`registerTab` 是公开服务方法）。

---

## 1. 现状盘点（调研结论）

| 项 | 结论 |
|---|---|
| 本机 better-sidebar | 已装 `dsh-better-sidebar@0.13.1`（当前最新），提供 `ctx.betterSidebar` 服务 |
| 本机 docs-panel | 已装 npm `dsh-docs-panel@0.0.1`，与本仓库代码**零差异**（同一份源码） |
| 仓库与已装版唯一差异 | 已装版 `package.json` 有 `dsh.client.inject: ["slots"]`，**本仓库缺少此字段** |
| 插件形态 | 标准双半插件：host（`lib/index.js`）+ client（`lib/client.js`） |
| host 数据接口 | `/docs-panel/api/*`（HTTP POST + JSON），含配置 / 列表 / 读取 / 外部打开 / 复制 |
| client 界面 | 右上角「我的文档」按钮 → 右侧 fixed 滑出面板（列表 + 阅读 + 大纲 + 外部打开） |
| 挂载方式 | 走 `dsh.profile.bundles` 的 bundle patch（`cordis.patch.yml` 内 `insert` 一行） |

### 1.1 better-sidebar 的接入机制（官方文档要点）

- 从 **v0.4.0** 起暴露 `ctx.betterSidebar` 服务（**只在 client half 存在**）；
- 外部插件用 `ctx.betterSidebar.registerTab(descriptor)` 注册一个侧边栏页面，出现在侧边栏 `+` 菜单里；
- 内置 7 个 tab（explorer / git / subagent / terminal / browser / editor / diff）也是通过**同一 API** 注册的——能力完全对等；
- 注册返回 disposer，**必须包在 `ctx.effect(...)` 里**，卸载（HMR / 禁用）时自动撤销；
- tab 是**会话级**的（`scope.sessionId`），布局按会话持久化到 localStorage；
- 消费插件需要在 client 侧声明 `inject: ['betterSidebar']`，Cordis 保证服务就绪后才激活插件；
- 官方完整接入指南：[`docs/external-plugin-guide.md`](https://github.com/omdsh-dev/DSH-better-sidebar/blob/main/docs/external-plugin-guide.md)。

### 1.2 本机部署顺序（重要）

`~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 中，`dsh-docs-panel` 排在 `dsh-better-sidebar` **之前**（第 9 vs 第 12 位）。

> ⚠️ **实测教训（v0.1.0）**：把 `betterSidebar` 写进 `dsh.client.inject`（静态依赖）**并不能**保证跨插件服务等待——冷启动时若 better-sidebar 的 client 尚未提供服务，本插件会 pending 或 `ctx.get` 返回 undefined 而静默跳过（表现为「热重载正常、重启后 tab 消失」）。**正确做法**是代码内 `ctx.plugin({ inject: ['betterSidebar'], apply })` 声明服务依赖，让 cordis 等到服务就绪再执行注册（详见 §4.2 与 §7）。

---

## 2. 目标形态

按需求确认（用户已选择）：

- ❌ 移除右上角「我的文档」按钮；
- ✅ 在 better-sidebar 侧边栏 `+` 菜单新增「文档」tab，点击后在侧边栏内阅读；
- ✅ 阅读体验保留：文档列表、Markdown 排版、大纲跳转、Chrome / VS Code 外部打开、代码复制、目录配置；
- ❌ 不要求兼容「未安装 better-sidebar」的场景（插件将硬依赖 better-sidebar）。

> ⚠️ 取舍提示：**硬依赖**意味着「没装 better-sidebar 时插件整个不加载（右上角按钮也不会出现）」。当前 dsh-docs-panel 是独立小插件、可单独使用；若要保留这种独立性，需改走「运行时探测 + 可选注册」的兼容方案（见 §6 备选），但那会多写一点防御代码。本方案按「不要求兼容」执行。

---

## 3. 改动总览

| 文件 | 改动 | 量级 |
|---|---|---|
| `package.json` | 补 `dsh.client.inject`：从缺省改为 `["betterSidebar"]`（可含 `"slots"`） | 小 |
| `lib/client.js` | 核心改造：删按钮/浮层壳、改 tab 组件、注册 tab | 中 |
| `lib/index.js`（host） | **不改** | 无 |
| `cordis.patch.yml` | **不改**（挂载方式不变） | 无 |
| `README.md` | 可选：更新截图与使用说明 | 小 |

---

## 4. `lib/client.js` 改造详解（核心）

当前 `lib/client.js` 结构（约 727 行）：
1. `window.__ModuleLoader__.load({ id, factory })` 包装（DSH client 插件加载形态）；
2. 样式表注入（`injectStyles`，~80 条 CSS）；
3. 轻量 Markdown 渲染器（`inlineNodes` / `parseBlocks` / `renderBlock` 等，**全部复用**）；
4. `DocsPanel` 组件（含 open 开关、fixed 浮层壳、列表、阅读区、工具栏、大纲）；
5. 尾部 `slots.inject('conversation.session.header.utilities', ...)` 挂右上角按钮。

### 4.1 结构调整建议

```
lib/client.js
├── 保留：ModuleLoader 包装、require('react')
├── 保留：rpc()（数据仍走 /docs-panel/api/*，不变）
├── 保留：injectStyles（可删浮层相关样式，保留阅读排版样式）
├── 保留：Markdown 渲染器（全部）
├── 改造：把 DocsPanel 拆成两层
│     ├── DocsView        ← 纯内容视图（列表 + 阅读 + 工具栏 + 大纲），无浮层壳
│     └── （删除）         ← 原 fixed 面板壳 / backdrop / resizer / header / 设置弹层
└── 新增：注册 better-sidebar tab（替换原 slots.inject）
```

### 4.2 注册代码（替换 §尾部）

```js
// betterSidebar 是跨插件服务：不能放进静态 inject（dsh.client.inject），
// 否则冷启动时 better-sidebar 未就绪会让插件 pending 或 ctx.get 返回
// undefined 而静默跳过（热重载正常、重启后消失）。正确做法：用 ctx.plugin
// 声明服务依赖，cordis 等 betterSidebar 就绪后才执行注册（与官方案例
// dsh-sentinel 一致）。
ctx.plugin({
  inject: ['betterSidebar'],
  apply(sidebarCtx) {
    const betterSidebar = sidebarCtx.betterSidebar
    ctx.effect(() => betterSidebar.registerTab({
      id: 'dsh-docs-panel:docs',        // 唯一 id，带包前缀，避开内置 id
      title: () => '全局文档',          // 侧边栏 tab 标题 / + 菜单项
      icon: (size) => <DocsTabIcon size={size} />,  // 自绘 outline 图标，风格同官方 Icon*Outline16
      order: 60,                        // + 菜单排序（内置 explorer=10 git=20 subagent=30 terminal=40）
      single: true,                     // 单实例：重复打开聚焦既有 tab 而非新开
      component: ({ scope, visible }) =>
        React.createElement(DocsView, { scope, visible }),
    }))
  },
})
```

### 4.3 `DocsView` 组件要点

把现有 `DocsPanel` 改为**无浮层**的内容组件：

- **删除**：`open` 状态、`.dsp-backdrop`、`.dsp-panel` fixed 定位、`.dsp-resizer` 拖宽手柄、`.dsp-header` 关闭按钮/设置按钮的「关闭」部分、点击外部关闭逻辑；
- **保留**：文档列表（左）、阅读区（右）、工具栏（Chrome / VS Code 打开 + 大纲）、目录设置（⚙️ 可收进工具栏或右上角小图标）、Markdown 渲染、复制按钮；
- **布局**：根元素从 `position:fixed` 改为 `height:100%; display:flex; flex-direction:column`，内部 `.dsp-body` 双栏保持 `flex:1; min-height:0`；
- **数据获取**：仍用 `rpc('config') / rpc('docs.list') / rpc('docs.read')`，**与 better-sidebar 的 `/sidebar/api` 完全无关**（文档库是全局 `~/.dsh/docs`，不是会话工作区文件）——这是本方案改动小的根本原因；
- **`visible` 语义**：better-sidebar 在面板折叠 / tab 非激活时传 `visible: false`。文档读取是即时的（无轮询/订阅），**无需为性能做暂停**；如日后加文件监听可挂 `visible` 门控；
- **`scope`**：tab 组件会收到 `scope.sessionId`。docs-panel 阅读不依赖会话，可忽略，但保留 prop 以备将来（如「文档笔记绑定会话」）。

### 4.4 需要调整的 CSS

| 原类 | 处置 |
|---|---|
| `.dsp-backdrop` | 删除 |
| `.dsp-panel` | 改为内容容器：`height:100%; display:flex; flex-direction:column; background:var(--dsw-alias-bg-base)`（去掉 `position:fixed; z-index; box-shadow; border-left`） |
| `.dsp-resizer` | 删除（better-sidebar 有自己的宽度管理） |
| `.dsp-header` | 保留当工具条/标题行用，或简化 |
| `.dsp-body / .dsp-list / .dsp-reader` | 保留，微调让高度填满容器 |
| 其余 `.dsp-markdown*` / `.dsp-toc*` / `.dsp-code*` | 全部保留 |

---

## 5. `package.json` 改动

```jsonc
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "platform": "web",
    "inject": ["timer"]        // 只留包级服务；betterSidebar 由代码内 ctx.plugin 声明（见 §4.2）
  }
},
"peerDependencies": {
  "dsh-better-sidebar": ">=0.4.0"   // 硬依赖声明，提示使用者先装 better-sidebar
}
```

- `dsh.client.inject` 只放**包级服务**（`timer`）；**`betterSidebar` 不能放这里**（冷启动时序坑，见 §4.2 与 §7）；
- `peerDependencies.dsh-better-sidebar` 声明硬依赖，安装本插件时 npm/pnpm 会给出提示。

---

## 6. 备选方案（若将来要「兼容未装 better-sidebar」）

当前已选「不要求兼容」，记录备选供将来参考：

- **运行时探测**（dsh-sentinel 同款）：`inject` **不**声明 `betterSidebar`，在 `apply` 里 `const bs = ctx.get('betterSidebar')`，有则注册 tab，无则退回右上角按钮（或什么都不做）；
- 代价：不能享受 Cordis 的「服务就绪后自动激活」门控，需要自行处理「服务晚于本插件激活」的时序（如订阅注册事件 / 延迟重试）；
- 收益：没装 better-sidebar 时插件照常独立可用，适合公开发行给更广用户。

官方第一个接入案例 [dsh-sentinel](https://github.com/fuhefei/dsh-sentinel) 采用的就是该模式，文档 §11 有记载。

---

## 7. 风险与注意点

| # | 风险 | 说明与对策 |
|---|---|---|
| 1 | **id 冲突** | 注册 id 必须唯一且不与内置（explorer/git/subagent/terminal/browser/editor/diff）冲突；用 `dsh-docs-panel:docs` 前缀即可 |
| 2 | **硬依赖停摆** | 没装 better-sidebar 时 client 不激活（无任何界面）。v0.1.0 起接受此取舍；要改回独立可用走 §6 |
| 3 | **静态 inject 时序坑（实测踩过）** | `betterSidebar` **不能**放进 `dsh.client.inject`：冷启动时 better-sidebar 未就绪会让插件 pending 或静默跳过，表现为「热重载正常、重启后 tab 消失」。必须用 `ctx.plugin({ inject: ['betterSidebar'], apply })`（见 §4.2） |
| 4 | **`timer` 服务声明** | `client.js` 用 `ctx.get('timer')` 做复制按钮闪回，需在 `dsh.client.inject` 里声明 `timer` |
| 5 | **双栏布局溢出** | tab 内容区高度受 better-sidebar 容器约束；`.dsp-body` 需 `min-height:0` 保证列表/阅读区各自滚动不溢出 |
| 6 | **浮层残留** | 若沿用 fixed 定位面板壳，会浮在 better-sidebar 之上造成重叠；必须改流式布局 |
| 7 | **HMR / 重复注册** | `registerTab` 必须包 `ctx.effect`，否则热重载后二次激活报 `already registered` |
| 8 | **会话级语义** | tab 布局按会话持久化；同一用户不同会话侧边栏独立，文档阅读器在每个会话各自可开（单实例）——属预期行为 |
| 9 | **图标库纯度门** | 不要 `require('@deepseek-ai/dsh-client-ui-primitives')` 等官方 client 包——client 模块表对第三方插件 value-import 有纯度门，可能抛错。自绘 SVG 图标（outline 风格）零依赖最安全 |

---

## 8. 实施步骤（实现者清单）

1. 备份 `lib/client.js`；
2. 改 `package.json`：`dsh.client.inject` 只留 `timer`，加 `peerDependencies.dsh-better-sidebar: >=0.4.0`；
3. 重构 `client.js`：
   a. 把 `DocsPanel` 拆出 `DocsView`（删浮层壳、改流式布局、调 CSS）；
   b. 删除原 `slots.inject('conversation.session.header.utilities', ...)` 段；
   c. 新增 §4.2 的 `ctx.plugin` 注册代码（**不要**用 `dsh.client.inject` 声明 betterSidebar）；
   d. 自绘 outline 图标（§4.2 `DocsTabIcon`），`npm version minor`（0.0.x → 0.1.0）；
4. 本地验证（冷启动重点）：
   - 在 `~/.dsh/profiles/web/package.json` 把 `dsh-docs-panel` 依赖改为 `link:/Users/mlosun/CNB/dsh-docs-panel`，`pnpm install`；
   - 硬刷新浏览器（Cmd/Ctrl+Shift+R）检查侧边栏 `+` 菜单出现「全局文档」；
   - **必须重启 dsh 服务再验证一次**（冷启动时序是本方案最容易踩的坑，见 §7 风险 3）；
   - 验证项：打开 tab、列文档、读文档、大纲跳转、外部打开、目录配置、代码复制、开关侧边栏后状态；
5. 通过后 `npm publish` 发布 0.1.0，本机 `dsh plugin --profile web add dsh-docs-panel@latest` 更新；
6. 更新 README 截图与「安装/使用」文案（可选）。

> 注意：本方案改动全在 client half，DSH 对 client 改动热加载，**无需重启 `dsh web`**；仅当改动 host half（本方案不动）才需重启。

---

## 9. 给非技术读者的摘要

- **能不能做？** 能，而且很顺。
- **会变成什么样？** 现在「我的文档」是网页右上角一个按钮，点开从右侧滑出一块面板；改造后，它会变成 DSH 侧边栏里的一个正式页面（跟文件、Git、终端那些图标并列），点开就在侧边栏里读你的笔记。
- **会不会搞乱已有的笔记？** 不会。读的还是 `~/.dsh/docs` 那个目录，大纲、目录切换、用 Chrome / VS Code 打开、复制代码这些功能都保留。
- **工作量大吗？** 不大。后台的「读文件、安全保护」那些逻辑一行都不用动，只改浏览器这层的显示方式。
- **有风险吗？** 有一个要知道的取舍：改造后「必须装 DSH-better-sidebar 才能用」——如果哪天你卸了 better-sidebar，这个文档功能也会跟着停用。这是你选的方案（简单直接）；如果以后想让它脱离 better-sidebar 也能单独用，也有备选做法，只是要额外多写点兼容代码。

---

*本文档由 AI 协助调研编写，依据本仓库源码、本机已装插件、DSH-better-sidebar 官方接入文档（v0.13.1）与真实接入案例 dsh-sentinel。*
