# dsh-docs-panel

> DSH 侧边栏里的「全局文档」：全局 Markdown 笔记，任何工作区随时可读。

[![npm](https://img.shields.io/npm/v/dsh-docs-panel)](https://www.npmjs.com/package/dsh-docs-panel)
[![license](https://img.shields.io/npm/l/dsh-docs-panel)](https://github.com/mlosun/dsh-docs-panel/blob/main/LICENSE)
[![requires](https://img.shields.io/badge/requires-dsh--better--sidebar-4d6bfe)](https://github.com/omdsh-dev/DSH-better-sidebar)
[![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)](https://github.com/mlosun/dsh-docs-panel)

把你自己整理的 Markdown 笔记，直接搬进 DeepSeek Harness 的侧边栏里读。

你攒在 `~/.dsh/docs` 的笔记、排查手册、使用说明，不必再切到别的编辑器——在 dsh 侧边栏点开即读：排版干净的正文、随时跳转的大纲，读完一键就能转到 Chrome 或 VS Code 继续编辑。

## ⚠️ 重要：依赖 dsh-better-sidebar

> 本插件从 v0.1.0 起**作为 dsh-better-sidebar 的侧边栏页面运行**，不再提供独立的右上角按钮入口。

- **必须安装 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)（≥ v0.4.0）**，否则本插件无法显示、无法使用；
- 安装顺序：**先装 better-sidebar，再装本插件**（见下方「安装」）；
- 界面入口位于 dsh 右侧边栏的「＋」菜单与 tab 栏，与文件 / Git / 终端等页面并列。

## 功能一览

- 📚 **可折叠文件树**：把文档目录下的文件夹与 `.md` 文件列成树，目录可展开 / 收起，点文件即读；
- ✎ **面板内编辑**：直接在面板里改 Markdown——左侧写源码、右侧实时预览，带格式工具栏与快捷键，`Ctrl/Cmd+S` 保存；
- 🎨 **良好排版**：标题、列表、表格、代码块、引用、链接都渲染得规整，自动适配亮色/暗色主题；
- 🧭 **悬浮大纲**：一键展开文档目录，点标题平滑跳转（默认收起，不打扰阅读）；
- 🛠 **文件管理**：面板里直接新建文件 / 文件夹、重命名、删除，不用切到系统文件管理器；
- ♻️ **回收站**：删除是移入文档目录下的 `.trash/`，可在列表底部恢复或彻底删除；
- 🌐 **外部打开**：每篇文档提供「Chrome 打开」「VS Code 打开」按钮，随时转到编辑器继续编辑（macOS 走 `open -a`，Windows 走 `Start-Process`，VS Code 需 `code` 在 PATH 上）；
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
2. 左侧是可折叠的文件树：点目录展开 / 收起，点文件在右侧阅读；
3. 点工具条的「✎ 编辑」进入编辑：左边写 Markdown 源码，右边实时预览（可点「预览」关掉）；工具条提供标题 / 粗体 / 斜体 / 删除线 / 行内代码 / 引用 / 列表 / 任务列表 / 链接 / 代码块 / 表格 / 分隔线，`Enter` 自动续写列表，`Tab` 缩进、`Shift+Tab` 反缩进，`Ctrl/Cmd+S` 保存，「完成」退出（有未保存修改会先确认）；
4. 工具条的「＋文件 / ＋文件夹」在文档目录根下新建；把鼠标移到某个文件夹行上，行尾的「＋」会在**该文件夹内**新建；
5. 悬停行的行尾还有「✎ 重命名」和「🗑 删除」。新建文件只支持 Markdown，不写扩展名会自动补 `.md`；
6. 删除是移入文档目录下的 `.trash/`，列表底部的「回收站」里可以恢复或彻底删除（也可以一次性清空）；
7. ⚙️ 修改文档目录（默认 `~/.dsh/docs`，保存到 `$DSH_HOME/storages/dsh-docs-panel/config.json`，未设 `$DSH_HOME` 时即 `~/.dsh/…`）；
8. 「☰ 大纲」展开目录，「Chrome / VS Code 打开」转到编辑器。

## 常见问题

**文档列表是空的？** 用工具条的「＋文件」新建，或往 `~/.dsh/docs` 里放几个 `.md` 文件（也可以点 ⚙️ 指向你自己的目录）。只显示 `.md` / `.markdown`，其它扩展名不会出现在列表里。

**回收站的文件在哪？** 在文档目录下的 `.trash/<时间戳>/` 里（`payload` 是原内容，`meta.json` 记录原路径与删除时间）。它是以点开头的隐藏目录，不会出现在文件树里；恢复或清空后自动清理。想彻底不要它，直接删掉文档目录下的 `.trash/` 即可。

**侧边栏里没有「全局文档」？** 按顺序排查：

1. 确认已安装 dsh-better-sidebar（≥ v0.4.0）且侧边栏正常显示；
2. 确认安装顺序是先 better-sidebar 后本插件；如果顺序反了，重装一次本插件即可；
3. 刚安装/更新过插件后，硬刷新浏览器（Cmd/Ctrl+Shift+R）再试。

**没装 better-sidebar 能用吗？** 不能。本插件 v0.1.0 起作为 better-sidebar 的侧边栏页面运行，未安装 better-sidebar 时插件不会显示任何界面。

## 开发

```bash
node markdown-test.cjs   # 自测 Markdown 渲染器
node fs-ops-test.cjs     # 自测路径/名称校验与目录树构建（纯逻辑）
node editor-test.cjs     # 自测编辑器文本变换（粗体/列表/标题/缩进/插入块）
node api-test.cjs        # 自测宿主端 API（临时目录里跑新建/保存/重命名/删除/回收站）
```

本地调试（已安装线上版时）：在 `~/.dsh/profiles/web/package.json` 把依赖改为 `"dsh-docs-panel": "link:/绝对路径/到/本仓库"`，执行 `pnpm install`，重启 dsh 并硬刷新浏览器。

## 目录结构

```
.
├── lib/
│   ├── index.js          # 宿主端：配置、文档读写、文件管理、外部打开、剪贴板、HTTP 接口
│   ├── paths.js          # 纯逻辑：名称校验、路径包含性、目录树构建（可自测）
│   └── client.js         # 浏览器端：better-sidebar tab 注册、文件树、编辑器、大纲、Markdown 渲染器
├── cordis.patch.yml      # dsh 启动清单补丁
├── markdown-test.cjs     # 渲染器自测（node markdown-test.cjs）
├── fs-ops-test.cjs       # 路径/名称纯逻辑自测（node fs-ops-test.cjs）
├── editor-test.cjs       # 编辑器文本变换自测（node editor-test.cjs）
├── api-test.cjs          # 宿主端 API 自测（node api-test.cjs）
├── docs/
│   └── better-sidebar-integration.md  # 接入 better-sidebar 的改造方案（含实施记录）
├── LICENSE
└── package.json
```

## 安全说明

文档目录可以配置在工作区之外，因此写操作（新建 / 保存 / 重命名 / 删除 / 恢复）刻意**不经过 `ctx.fs`**——它是沙箱后端，`workspace-write` 下只允许写工作区和系统临时目录。插件改为直接用 `node:fs`，并自己承担越界防护：先做名称与相对路径校验（拒绝 `..`、路径分隔符、隐藏段），再把目标 canonical 化（`realpath` 到最近已存在的祖先）后与 canonical 的文档目录比较，从而挡住符号链接 / junction 逃逸。保存正文走「同目录临时文件 + rename 覆盖」的原子写，避免写到一半中断把正文截断；正文大小上限 3 MB。这部分逻辑有 `fs-ops-test.cjs` 与 `api-test.cjs` 覆盖。

编辑器刻意不做所见即所得：client 侧的模块表对第三方插件的包导入有纯度门，引入富文本编辑库风险高，本插件坚持零运行时依赖。当前形态是「Markdown 源码 + 实时预览」——预览复用面板里同一套渲染器，所以看到的效果与阅读态完全一致。

## 许可证

MIT
