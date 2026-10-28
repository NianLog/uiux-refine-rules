# 项目设计引用与复核

本文件只在首次接入、设计条目维护或规则漂移时加载。普通组件检索不用读取完整维护格式。
`<skill-root>`、`<project-root>` 和 `<review.json>` 均替换为真实绝对路径。

## 项目文件

- `design/uiux-design.md`：面向人的设计决定及逐条规则引用。
- `design/uiux-adoption.json`：脚本写入的完整规则快照、复核理由和实现验证状态。

这两个文件应加入项目版本控制。采纳记录不存用户输入、账号凭据或生产数据。
已有 DESIGN.md 时先读它，保留原规范。这里记录当前实际采纳的条目及其对应设计依据，不复制一份互相竞争的全站规范。
引用其他文档的条目应写入本条所依赖的实际约束；脚本不会追踪普通 Markdown 链接目标的内容变更。
首次接入可参考 [模板](../assets/project-template/design/uiux-design.md)，但必须根据真实项目改写示例决定。
没有设计文档时 `check` 返回 untracked；不自动创建文件。只读请求保持只读。

## 设计条目

每个二级设计条目必须放在成对标记内。标记只占一行，包含严格 JSON：

```markdown
<!-- uiux:decision {"id":"D-edit-form","tags":["unsaved"],"refs":["UXR-0018@f57f23772a30"],"local":false} -->
## 编辑表单退出

未修改时直接退出。有未保存修改时，关闭按钮和 Escape 使用同一处理流程；遮罩不能丢弃输入。
项目没有草稿服务，因此不显示“已自动保存”。
<!-- /uiux:decision -->
```

上面的指纹为随库更新的示例，实际使用必须通过 query 获取本地当前版本。
条目 ID 稳定且不复用；tags 选可用场景标签，refs 列出采用的规则及依赖，不能仅引用主规则漏掉依赖。
`local:true` 的条目不引用公共规则，写清项目自有决定和依据；建议仍选择相关标签以发现公共规则冲突。
`local:true, tags:[]` 表示本条没有可匹配的公共规则范围，脚本不能为它发现新规则；必须在改变项目场景时重新判断。
不同页面或组件使用不同条目和标签，不把一个项目全部归成一个行业类别。
条目外允许标题和说明；约束性二级条目放入标记，防止误以为未被追踪的段落也已校验。

## 每次预检查

```sh
node "<skill-root>/scripts/rules.mjs" check --project "<project-root>"
```

检查当前本地规则库，不联网。验证正文与索引一致后，再比较完整快照、短引用、条目摘要、候选和依赖。
新增候选需要判断适用性；旧候选被标为不适用后若内容改变，也需要复核该判断。
未知 ID、废弃、依赖缺失、条目删除和文档手改都不能被静默忽略。

| 状态 | 退出码 | 含义 |
| --- | --- | --- |
| current | 0 | 引用与复核记录一致 |
| review_required | 2 | 有待复核事项 |
| untracked | 3 | 没有设计文档和采纳记录 |
| error | 1 | 格式、索引或读取失败，检查未完成 |

`findings` 是确定性文件检查结果；不是所有候选都一定适用，不自动修改无关页面。

## 查看变更

```sh
node "<skill-root>/scripts/rules.mjs" diff --project "<project-root>" --decision D-edit-form --id UXR-0018
```

命令只输出指定条目的旧快照和当前正文，不需要 Git 历史或网络。
旧规则已退出范围时仍能查看保留的 retired_rules 快照。
是否修改设计由差异的含义决定，不由哈希变化次数决定。

## 记录复核

1. 先阅读当前任务涉及的候选及必要依赖，确认哪些适用；有冲突先等用户决定。
2. 在授权范围内修改设计正文和引用。实施不在范围内时只更新规范，并保持实现 unverified。
3. 文档修改完后执行 prepare。命令只输出 JSON，不写文件。

```sh
node "<skill-root>/scripts/rules.mjs" prepare --project "<project-root>" --decision D-edit-form
```

4. 将 JSON 保存为 UTF-8 临时复核文件，逐项填写：

| 字段 | 要求 |
| --- | --- |
| `rationale` | 为什么当前设计决定成立；已满足时说明判断依据 |
| `rules.*.disposition` | applied、not_applicable 或 exception；pending 不能提交 |
| `rules.*.reason` | 对应条件、设计决定或排除依据，不能只写“通过” |
| `rules.*.approval` | exception 时写用户决定的可核对出处；其他情况为空字符串 |
| `retire_rules` | 退出当前范围的旧规则，逐条说明迁移或退出理由 |
| `implementation.status` | unverified 或 verified |
| `implementation.evidence` | verified 时说明真实检查、测试或截图证据及范围 |

所有候选和必要依赖都必须有结论。not_applicable 不出现在 refs；applied 和 exception 必须有当前引用。
脚本只能检查理由存在，不能认证用户确实批准或证据真实。Agent 不得伪造这些字段。
普通偏好的有理由调整可按规则适用范围处理；与适用要求冲突的决定必须保留批准依据。

5. 记录并再次检查：

```sh
node "<skill-root>/scripts/rules.mjs" record --project "<project-root>" --review "<review.json>"
node "<skill-root>/scripts/rules.mjs" check --project "<project-root>"
```

prepare 的 expected_state 覆盖当时的库索引、设计文件和采纳文件。之后任一输入变化都会拒绝旧请求。
不能在报错后机械替换 expected_state 重试；重新检查差异和判断，再生成请求。
同一复核文件成功后再提交会因状态变化被拒绝；先查记录，不盲目重发。
record 成功写入当前条目后，其他条目可能仍待复核并返回退出码 2；这不代表写入失败，应读取结果确认。

## 删除、失败与并发

删除设计条目后仍需 prepare 对应旧 ID，填写 remove_decisions 理由再 record；不能直接删采纳 JSON 消除提醒。
写入仅替换采纳文件，不自动改设计文档，避免跨文件提交一半造成假通过。
写入使用独占 write-lock、同目录临时文件、fsync 和 rename，提交前再次核对状态。
崩溃前可能留下 `.write-lock` 或 `.tmp`；旧采纳文件保持可读，新检查会重新比较文档。
先确认原进程已结束，再核对现有文件和锁内状态；没有证据时不要自动移除锁。恢复后重新 prepare。

这是本地单写者工具。锁只约束使用本脚本的写入者；不能阻止其他程序在最后一次检查与替换之间强写采纳文件。
需要严格多写者事务时再引入专用存储；首版不声称具有数据库事务或断电持久化保证。
项目设计目录和规则目录拒绝符号链接或 junction，避免写到调用者未选择的位置；项目根目录本身可由真实路径解析。
