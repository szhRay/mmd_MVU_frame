# 项目规则

- 目标平台固定为 MMD 新聊天页（`/mmdsandbox`，`chatVersion: 1`）。
- 涉及界面、正则、persona 或构建产物时必须使用 `tavern-mmd` 技能。
- 新会话先读 `main.md` 和 `plan.md`，再读 `README.md`、`docs/AUTHORING.md`、`docs/API.md` 与 `docs/AI_WORKFLOW.md`。
- 必须先通过自然语言对话了解作者需求，再按 MVU 数据模型、变量注入、全局美化、功能栏/回复状态栏/可选舞台、发送/流式/完成行为五组推进；每组先确认业务与界面结果，再修改该组。
- 侧边按钮、弹窗、菜单和侧边栏优先使用 `statusbar` 正则替换后落入的 `[data-slot="statusbar"]` 功能栏；舞台仅作为覆盖消息区或整屏的可选高级界面。功能栏按需自行增加文件、独立正则和唯一标记，不得写入逐回复状态栏的 `status.html`、`status.js`。
- 不向作者询问 Schema、字段类型、JSON Pointer、SDK、生命周期、正则或插件名称，只追问会改变产品结果的缺失信息。
- 变量只追踪有实际消费者且不能可靠推导的状态；业务字段使用简短中文，更新规则使用紧凑中文 YAML，并同步初始变量、严格 Schema、`derive`、规则和变量注入。
- 作者需求只修改 `src/author/` 与 `mvu.config.json`；除非任务明确是修复框架，不修改 `src/framework/`。
- 常规作者制作以项目文档和 `docs/API.md` 为准；API 未覆盖、验证错误无法解释、行为与文档不一致或用户要求诊断框架时，才检查完整平台规范与 `src/framework/`。技能的必读规则仍优先。
- 默认推荐 `report`、`user-view`、`prune`；作者可明确关闭。`manager` 仅在需要手动查看、修改或重置变量时提出。
- 代码保持简洁，不添加兜底、兼容、迁移、默认补值或跨平台分支。
- 创建或修改文件后立即更新 `main.md`；完成步骤后立即勾选 `plan.md`。
- 交付前只运行 `npm run build`、JSON 语法检查和 MMD 新页校验；作者明确要求时才生成预览，不执行仿真页面验证。
