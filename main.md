# 通用 MVU 框架

目标平台：MMD 新聊天页（`chatVersion: 1`，`/mmdsandbox`）。

这是不含角色、剧情和业务字段的 CARD + MVU 作者框架。它只支持新卡和新对话，不提供旧平台、旧接口、旧存档迁移、默认补值或异常降级。

## 从这里开始

- [README.md](README.md) — 作者入口、构建和导入说明。
- [AI_WORKFLOW.md](AI_WORKFLOW.md) — 不懂代码的作者与 AI 的五组确认流程。
- [AUTHORING.md](AUTHORING.md) — 九个作者入口及其运行时契约。
- [API.md](API.md) — 项目公开接口和必要的新页 SDK。
- [plan.md](plan.md) — 当前状态与下一项工作模板。
- [工作/验证记录.md](工作/验证记录.md) — 最近一次验证结果。

## 目录

- `src/author/` — 作者日常修改的九个入口与 persona。
- `mvu.config.json` — 默认插件配置。
- `src/framework/` — 框架实现；仅在明确修复框架时修改。
- `src/plugins/` — 四个可选插件。
- `scripts/` — 构建与本地预览工具。
- `output/` — 构建产物，不进入 Git 源码提交；发布时作为 GitHub Release 附件。
- `工作/` — 本地仿真、截图和最新验证记录。

## 固定契约

- 默认 15 条正则：3 条框架/MVU 运行时、9 条作者配置、`report`、`user-view`、`prune`。
- 启用 `manager` 后为 16 条；仅接受 `report`、`user-view`、`manager`、`prune`。
- 导入 JSON 顶层恰好六键，每条规则恰好四键且 ID 为负数。
- 作者只使用新页 SDK、稳定的 `[data-chat]` / `[data-slot]` 和自有 class/id。
- 顶层 `statusbar` 经正则替换后进入 `[data-slot="statusbar"]`；功能栏按需另建文件、独立规则和唯一标记，不属于默认九个作者规则。`status.html`、`status.js` 只保存逐回复快照，舞台仅作可选高级界面。
- 变量更新规则使用紧凑中文 YAML；只写有实际用途、不能可靠推导且需要额外约束的字段，完整 persona 不得超过 10000 字符。
- 四个插件使用新页消息事件与 MVU 内部事件；`manager` 通过独立 `statusbar` 标记提供功能栏入口。
