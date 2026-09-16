# 项目规则

- 目标平台固定为 MMD 新聊天页（/mmdsandbox，chatVersion: 1）。
- 当前分支是完全无状态的 CARD-only 支线；需要跨轮剧情变量时使用 main，不在本支线重新实现状态系统。
- 涉及界面、正则、persona 或构建产物时必须使用 tavern-mmd 技能。
- 新会话先读 main.md 和 plan.md，再读 README.md、docs/AUTHORING.md、docs/API.md 与 docs/AI_WORKFLOW.md。
- 必须先通过自然语言对话了解作者需求，再按角色设定与开场白、全局美化、功能栏/回复状态栏/可选舞台、发送/流式/完成行为四组推进；每组先确认业务与界面结果，再修改该组。
- 侧边按钮、弹窗、菜单和侧边栏优先放入 [data-slot="statusbar"] 功能栏；舞台仅作为覆盖消息区或整屏的可选高级界面。
- 功能栏按需增加文件、独立正则和唯一标记，不得写入逐回复状态栏的 status.html、status.js。
- 所有进入消息正文、功能栏或正则 replaceString 的静态 HTML 必须使用 docs/AUTHORING.md 的 MMD 新页容器白名单；白名单外标签改为自有 class 的 div。
- 不向作者询问 SDK、生命周期、正则或构建配置，只追问会改变产品结果的缺失信息。
- 作者需求只修改 src/author；除非任务明确修复框架，不修改 src/framework。
- 常规制作以项目文档和 docs/API.md 为准；API 未覆盖、验证错误无法解释、行为与文档不一致或明确诊断框架时，才检查完整平台规范与 src/framework。
- 代码保持简洁，不添加兜底、静默吞错、兼容、迁移或跨平台分支。
- 创建或修改文件后立即更新 main.md；完成步骤后立即勾选 plan.md。
- 交付前只运行 npm run build、JSON 语法检查和 MMD 新页校验；作者明确要求时才生成预览，不执行仿真页面验证。
