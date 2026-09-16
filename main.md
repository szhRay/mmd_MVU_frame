# 通用 CARD 框架

目标平台：MMD 新聊天页（`chatVersion: 1`，`/mmdsandbox`）。

当前分支：`codex/card-only`。这是完全无状态的 CARD 作者框架，不解析、累计、校验或保存剧情变量，也不提供 MVU、变量注入、变量管理或旧存档兼容。MVU 版本继续保留在 `main`。

## 从这里开始

- [README.md](README.md) — 作者入口、构建和导入说明。
- [参考文档](docs/README.md) — 作者流程、入口契约和 API 手册索引。
- [AI_WORKFLOW.md](docs/AI_WORKFLOW.md) — 不懂代码的作者与 AI 的四组确认流程。
- [AUTHORING.md](docs/AUTHORING.md) — 六个作者规则及其运行时契约。
- [API.md](docs/API.md) — 项目公开接口和必要的新页 SDK。
- [plan.md](plan.md) — 当前状态与下一项工作模板。

## 目录

- `src/author/` — 作者日常修改的六个规则入口、开场白与 persona。
- `docs/` — 集中的作者参考文档与索引。
- `src/framework/` — CARD 运行时；仅在明确修复框架时修改。
- `scripts/` — 构建与显式预览工具。
- `output/` — 构建产物，不进入 Git；发布时作为 GitHub Release 附件。
- `工作/` — 本地仿真、截图和最新验证记录。

## 固定契约

- 默认固定 8 条正则：2 条框架运行时与 6 条作者配置。
- 导入 JSON 顶层恰好六键，每条规则恰好四键且 ID 为负数。
- 作者只使用新页 SDK、稳定的 `[data-chat]` / `[data-slot]` 和自有 class/id。
- 消息正文、功能栏与正则替换 HTML 只使用 `docs/AUTHORING.md` 列出的 worker/DOMPurify 交集白名单。
- 顶层 `statusbar` 经正则替换后进入 `[data-slot="statusbar"]`；回复状态栏只消费当前回复正文和消息元数据。
- 舞台仅作可选高级界面；框架不提供任何跨轮剧情状态。
- 默认构建只生成 `card-regex.json` 与 `card-persona.txt`；预览仅通过显式命令生成。

## 当前状态

- CARD 运行时、8 条规则构建器与 card-* 产物命名已完成。
- 作者手册、公开 API、AI 四组工作流和分支项目规则已同步。
- 构建、JSON 语法检查和 MMD 新页校验已完成；唯一警告已审核为顶层订阅误报。
