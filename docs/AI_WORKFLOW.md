# AI 自然语言协作流程

本工程面向不懂代码的作者。作者只需描述角色、开场白、界面和视觉感受；AI 不要求作者填写 SDK、生命周期、正则或构建配置。

## 开始对话

推荐提示：

~~~text
请使用 tavern-mmd 技能，目标平台固定为 MMD 新聊天页。

我想制作：[描述角色、世界、开场白、界面和风格]

请先通过对话了解需求，不要立即改文件。只追问会改变产品结果的选择。
需求明确后，按 docs/AI_WORKFLOW.md 的四组流程逐组确认并实施。
~~~

## 工作规则

新会话依次完整阅读 main.md、plan.md、README.md、docs/AUTHORING.md、docs/API.md、docs/AI_WORKFLOW.md，再读取当前组涉及的 src/author 文件。

常规作者需求不读取 src/framework。只有 API 未覆盖、验证错误无法解释、实际行为与文档不一致或明确诊断框架时才扩大范围。

本支线不提供跨轮剧情状态。若需求包含关系值、任务进度、物品栏、变量修改或回复回溯快照，应说明这些能力属于 main 分支，不在本支线另造状态系统。

## 四组确认与实施

### 第一组：角色设定与开场白

确认角色身份、行为边界、世界设定、写作要求与玩家看到的第一条消息，再修改 persona.txt 和 beginning.txt。

### 第二组：全局美化

确认整体氛围、深浅色、色彩、圆角、密度和背景感受，再修改 theme.css。

### 第三组：功能栏、回复状态栏与可选舞台

先确认是否需要顶层功能栏以及其中的按钮、弹窗、菜单和侧边栏；再确认每条回复旁要显示什么本轮冻结信息。只有大型覆盖界面才确认舞台。

修改 status.html、status.js、stage.html、stage.js，以及按需新增的功能栏文件和独立规则。所有静态 HTML 必须经过 AUTHORING.md 白名单审核。

### 第四组：发送、流式与完成行为

确认发送前是否整理玩家文字、生成中显示什么、完整回复后哪些长期界面更新，再修改 before-send.js、stream.js 和 render.js。

选项默认写入输入框让玩家确认发送；只有作者明确要求自动发送时才使用消息发送能力。

每组修改后立即更新 main.md，并在 plan.md 勾选完成项。

## 验证与交付

1. 运行 npm run build。
2. 对正式 JSON 做语法检查。
3. 运行 tavern-mmd 的 validate.py --platform mmdsandbox 并审核警告。
4. 作者明确要求时才运行 npm run preview。

最终只交付 output/card-regex.json 与 output/card-persona.txt，并提醒必须新建角色、使用新聊天页和全新对话。
