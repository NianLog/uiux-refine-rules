# Codex 自动预检查

仅在用户要求安装或调整自动预检查时加载。本目录提供模板，不会被 Skill 自动注册。
依据 [Codex 官方 hooks 文档](https://learn.chatgpt.com/docs/hooks)，核查日期为 2026-10-24。
当前没有专用 SkillActivated 事件；使用 SessionStart 与 UserPromptSubmit 作宿主提醒，Skill 本身仍在每次激活时执行 check。

## 接入

1. 确认 Node.js >=22 可用，先运行 `rules.mjs validate` 和项目 `check`。
2. 读取项目现有 `.codex/hooks.json` 和 `.codex/config.toml`，避免添加重复事件或覆盖其他 hooks。
3. 从 [hooks.example.json](hooks.example.json) 取需要的事件，把 `__SKILL_ROOT__` 换为已安装 Skill 的绝对路径。Windows 推荐正斜杠路径，如 `D:/Skills/uiux-refine-rules`。
4. 将事件合并到项目 `.codex/hooks.json`；已有 inline hooks 时沿用现有表达形式，不同时维护两份。
5. 按宿主要求审核并信任当前 hook 定义。安装插件或复制 Skill 不等于已经信任 hook；变更后可能需要重新审核。
6. 新开或恢复项目会话，实测接入项目的过期引用会产生摘要，一致时不输出消息。检查宿主日志或 hook 面板确认实际触发。

如果宿主找不到 node，将命令里的 node 换成已核实的可执行文件绝对路径并正确加引号。
模板没有绕过信任或权限的设置，不修改全局配置。使用哪个配置层由用户已授权的接入范围决定。

## 行为

- 读取 stdin 的事件名和 cwd，直接调用本地检查函数，不执行输入里的 shell 文本。
- 从 cwd 向上寻找 `design/uiux-design.md` 或采纳文件，遇到最近仓库边界停止；多项目时采用最近接入点。
- 项目未接入或引用一致时保持安静。
- 有变化时最多返回 8 条发现的类型、设计条目 ID 和规则 ID，不把完整正文、旧快照或用户提示写入上下文。
- 格式错误、索引漂移或读取失败时输出“检查未完成”，不能宣称通过。
- hooks 不联网、不改项目、不自动迁移、不阻断整个任务。相关设计工作仍按 Skill 的预检查结果处理。

## 验证范围

`node --test` 覆盖两个事件的 JSON 协议、子目录查找、仓库边界、安静路径和异常路径。
这些测试不证明当前 Codex 安装版本已经加载并信任模板。
宿主适配变化先更新协议测试，再更新模板和本说明，不臆造新的事件名。
