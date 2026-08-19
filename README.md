# dsh-docs-panel

> DSH 侧边栏里的「全局文档」：全局 Markdown 笔记，任何工作区随时可读。

[![npm](https://img.shields.io/npm/v/dsh-docs-panel)](https://www.npmjs.com/package/dsh-docs-panel)
[![license](https://img.shields.io/npm/l/dsh-docs-panel)](https://github.com/mlosun/dsh-docs-panel/blob/main/LICENSE)
[![requires](https://img.shields.io/badge/requires-dsh--better--sidebar-4d6bfe)](https://github.com/omdsh-dev/DSH-better-sidebar)
[![platform](https://img.shields.io/badge/platform-macOS-lightgrey)](https://github.com/mlosun/dsh-docs-panel)

把你自己整理的 Markdown 笔记，直接搬进 DeepSeek Harness 的侧边栏里读。

你攒在 `~/.dsh/docs` 的笔记、排查手册、使用说明，不必再切到别的编辑器——在 dsh 侧边栏点开即读：排版干净的正文、随时跳转的大纲，读完一键就能转到 Chrome 或 VS Code 继续编辑。

## ⚠️ 重要：依赖 dsh-better-sidebar

> 本插件从 v0.1.0 起**作为 dsh-better-sidebar 的侧边栏页面运行**，不再提供独立的右上角按钮入口。

- **必须安装 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)（≥ v0.4.0）**，否则本插件无法显示、无法使用；
- 安装顺序：**先装 better-sidebar，再装本插件**（见下方「安装」）；
- 界面入口位于 dsh 右侧边栏的「＋」菜单与 tab 栏，与文件 / Git / 终端等页面并列。

## 功能一览

- 📚 **列表点选阅读**：自动列出文档目录下所有 `.md` 文件（含子目录），点一下就读；
- 🎨 **良好排版**：标题、列表、表格、代码块、引用、链接都渲染得规整，自动适配亮色/暗色主题；
- 🧭 **悬浮大纲**：一键展开文档目录，点标题平滑跳转（默认收起，不打扰阅读）；
- 🌐 **外部打开**：每篇文档提供「Chrome 打开」「VS Code 打开」按钮，随时转到编辑器继续编辑（目前仅支持 macOS）；
- 📋 **代码复制**：代码块右上角一键复制；
- 📁 **目录可配置**：默认读 `~/.dsh/docs`，可在面板里改成任何目录，保存后永久生效；
- 🧩 **侧边栏集成**：作为 better-sidebar 的一个 tab 注册，与内置页面同风格（图标、头部、按钮对齐内置），随侧边栏布局按会话持久化。

## 安装

**第一步**：安装依赖（如果还没装过）：

```bash
dsh plugin --profile web add dsh-better-sidebar@latest
```

**第二步**：安装本插件：

```bash
dsh plugin --profile web add dsh-docs-panel
```

两条命令都会自动完成：从 npm 拉取插件包、登记到 dsh 的启动清单。装完后**重启 dsh**（或按 better-sidebar 的要求硬刷新浏览器 `Cmd/Ctrl+Shift+R`），打开网页，侧边栏「＋」菜单里就有「全局文档」了。**以后每次 dsh 启动都会自动加载，无需重新安装。**

## 卸载

在终端执行一条命令：

```bash
dsh plugin --profile web remove dsh-docs-panel
```

然后重启 dsh 生效。卸载会保留你的文档目录配置，重新安装后依然生效。

## 使用

1. 打开 dsh 侧边栏，点「＋」菜单，选「全局文档」（或直接点已固定的「全局文档」tab）；
2. 左侧列表点选一篇文档，右侧阅读；
3. ⚙️ 修改文档目录（默认 `~/.dsh/docs`，保存到 `~/.dsh/storages/dsh-docs-panel/config.json`）；
4. 「☰ 大纲」展开目录，「Chrome / VS Code 打开」转到编辑器。

## 常见问题

**文档列表是空的？** 往 `~/.dsh/docs` 里放几个 `.md` 文件即可（也可以点 ⚙️ 指向你自己的目录）。

**侧边栏里没有「全局文档」？** 按顺序排查：

1. 确认已安装 dsh-better-sidebar（≥ v0.4.0）且侧边栏正常显示；
2. 确认安装顺序是先 better-sidebar 后本插件；如果顺序反了，重装一次本插件即可；
3. 刚安装/更新过插件后，硬刷新浏览器（Cmd/Ctrl+Shift+R）再试。

**没装 better-sidebar 能用吗？** 不能。本插件 v0.1.0 起作为 better-sidebar 的侧边栏页面运行，未安装 better-sidebar 时插件不会显示任何界面。

## 开发

```bash
node markdown-test.cjs   # 自测 Markdown 渲染器
```

本地调试（已安装线上版时）：在 `~/.dsh/profiles/web/package.json` 把依赖改为 `"dsh-docs-panel": "link:/绝对路径/到/本仓库"`，执行 `pnpm install`，重启 dsh 并硬刷新浏览器。

## 目录结构

```
.
├── lib/
│   ├── index.js          # 宿主端：配置、文档读取、外部打开、剪贴板、HTTP 接口
│   └── client.js         # 浏览器端：better-sidebar tab 注册、大纲、Markdown 渲染器
├── cordis.patch.yml      # dsh 启动清单补丁
├── markdown-test.cjs     # 渲染器自测（node markdown-test.cjs）
├── docs/
│   └── better-sidebar-integration.md  # 接入 better-sidebar 的改造方案（含实施记录）
├── LICENSE
└── package.json
```

## 许可证

MIT
