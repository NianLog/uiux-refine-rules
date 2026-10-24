<p align="center">
  <img src="assets/icon.svg" width="112" height="112" alt="UIUX 优化规则库图标">
</p>

<h1 align="center">UIUX Refine Rules</h1>

<p align="center"><strong>让 AI 按明确的设计规则，把界面做得更清楚、更好用。</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-195D50?style=flat-square" alt="MIT 开源协议"></a>
  <a href="rules"><img src="https://img.shields.io/badge/Design_Rules-29-3C786B?style=flat-square" alt="29 条设计规则"></a>
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/Agent_Skills-compatible-526B80?style=flat-square" alt="Agent Skills 格式"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%E2%89%A522-66784A?style=flat-square" alt="规则检查工具需要 Node.js 22 或以上"></a>
</p>

<p align="center">
  <a href="#它能帮你做什么">了解功能</a> ·
  <a href="#安装">安装</a> ·
  <a href="#开始使用">开始使用</a> ·
  <a href="#开发者说明">开发者说明</a>
</p>

当你让 AI 优化一个页面时，它需要知道：这里适合弹窗还是抽屉，删除后能不能撤销，表单没填完时怎样退出，动效会不会影响阅读。

**UIUX Refine Rules 是一份交给 AI 使用的界面设计规则库。** 安装到支持 Skill 的 AI 编程工具后，你照常用中文提出需求，AI 会根据当前页面查阅相关规则，说明怎么改、为什么这样改、改完怎样检查。

你不需要先成为设计师，也不用记住规则编号。

## 它能帮你做什么

| 你遇到的问题 | 它会帮助 AI 具体检查 |
| --- | --- |
| 页面层次不清楚 | 背景、容器和输入框是否容易区分，焦点是否看得见 |
| 一个操作不知道用什么弹层 | 结合内容多少、是否需要看列表、操作后果选择弹窗、抽屉或页面 |
| 用户误关窗口，填写内容丢了 | 关闭按钮、遮罩和键盘退出是否都保护未保存内容 |
| 删除操作让人不放心 | 能否真正恢复；该提供撤销，还是先说明损失再确认 |
| 数字跳动、展开抖动、动画太多 | 数字对齐、内容展开、操作反馈，以及减少动画时的表现 |
| 以前定下的设计要求变了 | 找出受影响的设计记录，判断是否需要调整，保留已有决定 |

初版有 **29 条规则**，覆盖文字、颜色层级、动效、表单、提示、确认、移动端面板、分步引导和图片查看。

每条规则都写明适用场景、不适用的情况、具体做法和检查方式。涉及某个组件时才读取对应内容；有冲突时，先说明取舍，再由你决定。

## 安装

### 方式一：让你的 AI 帮忙

如果你不熟悉命令行，把下面这段话发给能操作本地项目的 AI 编程助手：

> 请帮我把 https://github.com/NianLog/uiux-refine-rules 安装到当前项目的 AI 工具中。优先通过 skills 安装，先检查需要的软件是否齐全，安装后确认能找到 uiux-refine-rules。暂时不用开启自动提醒。

它需要能够读取项目文件并运行命令。只支持普通文字聊天的工具，不能直接完成这些操作。

### 方式二：通过 skills 安装

先安装 [Node.js](https://nodejs.org/) 和 [Git](https://git-scm.com/downloads)，然后在**你要优化的应用项目文件夹**里打开终端。
`skills` 安装工具当前要求 Node.js **22.20 或以上**；本 Skill 自带检查脚本要求 Node.js 22 或以上。[安装工具说明](https://github.com/vercel-labs/skills#install-a-skill)

复制执行：

```bash
npx skills add NianLog/uiux-refine-rules --skill uiux-refine-rules
```

根据提示选择你使用的 AI 工具，确认安装位置。默认只安装到当前项目。

**使用 Codex 的用户**也可以直接指定：

```bash
npx skills add NianLog/uiux-refine-rules --skill uiux-refine-rules -a codex
```

安装后回到 AI 工具，确认技能列表里有 `uiux-refine-rules`。如果暂时没出现，刷新列表或新开一个聊天再检查。

<details>
<summary>我想在所有项目中使用</summary>

安装时加上 `-g`，让这个 Skill 可用于你的多个项目：

```bash
npx skills add NianLog/uiux-refine-rules --skill uiux-refine-rules -a codex -g
```

</details>

<details>
<summary>Windows 提示无法创建链接</summary>

加上 `--copy`，改为复制文件：

```bash
npx skills add NianLog/uiux-refine-rules --skill uiux-refine-rules -a codex --copy
```

更多选项见 [skills 官方安装文档](https://github.com/vercel-labs/skills/blob/main/docs/commands.md#skills-add)。

</details>

## 开始使用

安装好后，告诉 AI **要处理哪个页面、哪里不好用、哪些现有设计需要保留**。下面几段可以直接复制。

**先找问题，暂时不改：**

> 使用 uiux-refine-rules 检查用户管理页。先列出影响使用的问题，说明依据和建议，等我确认后再修改。

**优化一个具体组件：**

> 使用 uiux-refine-rules 优化编辑用户的抽屉。保留现有品牌色，重点检查填写内容丢失、错误提示和键盘操作。

**判断交互方式：**

> 使用 uiux-refine-rules 帮我设计删除图片的交互。请先确认项目能否恢复删除的图片，再决定用撤销提示还是确认窗口。

**继续维护以前的设计：**

> 使用 uiux-refine-rules 检查这个项目记录的设计要求是否需要更新。只处理本次涉及的页面，有冲突先告诉我。

在 Codex 中也可以用 `$uiux-refine-rules` 明确调用。

第一次使用时，AI 会先了解项目，必要时建立一份设计记录。以后规则变化，就能知道哪些地方需要重新检查。
如果你只要求检查，它应报告缺失的记录，不擅自改文件。

## 日常使用时，你会看到什么

- **相关建议**：针对正在处理的组件，说明具体问题和修改方法。
- **需要你决定的取舍**：例如现有品牌要求与某条建议冲突，说明各自影响后再问你。
- **规则变化提醒**：指出受影响的设计记录；已有设计符合新要求时，不必为了更新而重做页面。
- **明确的检查结果**：分别说明检查了什么、还有哪些没有实际验证。

“设计记录已对上”不代表真实页面已经好用。实际界面仍需要查看、操作，并检查不同屏幕和输入方式。

### 更新 Skill

通过 skills 安装后，可以检查是否有更新，或只更新这一个 Skill：

```bash
npx skills check
npx skills update uiux-refine-rules
```

更新后让 AI 再检查项目设计记录。更新规则库不会直接修改你的应用页面。

### 可选：开启自动提醒

Codex 用户可以让 AI 按 [自动提醒说明](adapters/codex/README.md) 帮忙接入。
接入并在 Codex 中信任配置后，开始聊天或提交需求时会检查已接入的项目；记录一致时不提示。

**安装 Skill 不会自动开启这项功能。** 普通使用时，Skill 仍会要求 AI 在工作前检查；其他工具的自动提醒暂未提供专门适配。

## 常见问题

**不会写代码，也能用吗？**

可以用日常语言描述问题、查看建议和决定取舍。安装及修改应用，需要能操作项目的 AI 编程工具；你也可以先让它解释方案，确认后再改。

**会把所有页面都改成同一种风格吗？**

规则包含适用条件和可选风格。你可以明确要求保留现有品牌、布局或组件；出现冲突时应先讨论，而不是直接替换。

**能把新的设计建议补进来吗？**

可以。把建议和能找到的来源交给 AI，明确要求维护规则库。它应先查已有规则，重复内容合并，冲突内容交给你取舍。
只想调整某个项目时，请说明是这个项目的要求，避免改动所有项目共用的规则。

**必须联网才能用吗？**

安装、获取更新需要网络。已经安装的规则读取和项目检查在本地完成；你的 AI 工具是否需要联网，取决于工具本身。

## 开发者说明

下面是文件组织和命令接口。日常使用不需要手工维护这些内容。

### 运行内容

| 位置 | 用途 |
| --- | --- |
| [SKILL.md](SKILL.md) | 技能入口、使用流程与按需读取规则 |
| [rules/](rules) | 29 条独立规则，每条包含条件、做法、验收和反例 |
| [index.json](index.json) | 从规则生成的检索索引与内容指纹 |
| [scripts/](scripts) | 使用 Node.js 标准库的检查和记录工具 |
| [references/](references) | Skill 按需读取的项目追踪、规则格式和规则维护说明 |
| [assets/](assets) | Skill 图标及项目设计记录模板 |
| [adapters/codex/](adapters/codex) | Codex 自动预检查配置与接入说明 |

公开仓库只分发运行内容、使用说明、图标和 MIT 协议。开发笔记、测试、验证报告及 AGENTS.md 保留在维护者本地，由 `.gitignore` 默认排除。

### 命令

脚本无外部运行依赖，不需要在 Skill 目录执行 `npm install`。
在 Skill 所在文件夹运行：

```bash
node scripts/rules.mjs validate
node scripts/rules.mjs query --tags drawer,form
node scripts/rules.mjs query --ids UXR-0018 --full
node scripts/rules.mjs check --project "/absolute/path/to/app"
```

在其他位置调用时，使用脚本的绝对路径。Windows 项目路径可以写成 `D:/Projects/my-app`。

每条规则拥有稳定 ID 和内容指纹。项目的 `design/uiux-design.md` 引用规则，`design/uiux-adoption.json` 保存采纳时的完整内容与复核理由。
变化后先判断是否影响当前设计，再更新记录；工具没有“全部直接标记最新”的操作。

- [项目追踪](references/project-tracking.md)：首次接入、差异查看与逐条复核。
- [规则格式](references/rule-format.md)：字段、指纹和废弃替代关系。
- [规则维护](references/maintenance.md)：新材料整合、重复合并与冲突处理。

其他兼容 Agent Skills 的工具可以读取规则并执行脚本；自动提醒的接入方式取决于宿主。本仓库提供 Codex 配置模板，不将模板存在等同于真实事件已触发。

## 反馈与许可

发现规则不适用、缺少场景或安装问题，可以 [提交 Issue](https://github.com/NianLog/uiux-refine-rules/issues)。请附上使用场景、相关规则和预期行为，避免上传项目中的私人信息。

本项目采用 [MIT License](LICENSE)。使用、修改或分发时，请保留协议要求的版权和许可声明。
