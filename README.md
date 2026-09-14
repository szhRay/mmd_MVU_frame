# 通用 MVU 框架

这是面向 MMD 新聊天页（`chatVersion: 1`）的 CARD + MVU 作者工程，不含角色、剧情、业务字段或成品界面。不会写代码的作者可以只用自然语言描述角色、玩法、记忆内容、界面和风格，由 AI 配合 `tavern-mmd` 技能逐组确认并填写九个入口，再构建为可导入的六键正则 JSON。

九条作者配置规则依次对应初始变量、变量结构、全局美化、变量注入、发送处理、回复状态栏、舞台、流式更新和完成更新。其中状态栏、舞台分别由一组 HTML/CSS 与 JS 源文件合并。`beginning.txt` 写入顶层 `beginning`；`variable-rules.txt` 嵌入 `persona.txt` 后共同写入顶层 `personality`。这三个文本文件都不计入九条正则。

> 导入时必须新建角色，并在创卡页确认使用“新页 / 新聊天页”。给已有角色导入无法把旧页升级为新页。

## 三步开始

### 1. 用自然语言说明需求

把角色、世界、玩法、希望系统记住的内容、界面和视觉感受告诉 AI。作者不需要说明字段类型、Schema、JSON Pointer、SDK、生命周期或插件名；AI 只追问尚未明确且会改变玩法或界面结果的问题。

直接使用 [AI_WORKFLOW.md](AI_WORKFLOW.md) 中的起始提示词。

### 2. 逐组确认并搭建

AI 按“MVU 数据模型 → 变量注入 → 全局美化 → 状态栏与舞台 → 发送、流式和完成行为”推进。每组先说明可见玩法与界面结果，作者确认后才修改该组，五组完成后再确认预览。

各入口的参数、时机和边界见 [AUTHORING.md](AUTHORING.md)，项目接口与必要的新页 SDK 见 [API.md](API.md)。

### 3. 构建与验证

```powershell
npm test
npm run build
```

构建结果：

- `output/mvu-regex.json`：创卡页导入的六键正则包。
- `output/mvu-persona.txt`：需要手工粘贴到角色人设。
- `output/mvu-preview.html`：本地 SDK 仿真预览，不代表真实站最终结果。

完成本地验证后，在全新的 MMD 新页角色和全新对话中做最终人工验收。

## 发布与维护

首次发布 GitHub、日常提交、打版本标签和安全恢复见 [MAINTENANCE.md](MAINTENANCE.md)。

## 规则数量

默认 `mvu.config.json` 启用三个推荐插件，共 15 条规则：3 条运行时、9 条作者配置和 3 条插件规则。

```json
{
  "plugins": ["report", "user-view", "prune"]
}
```

`report`、`user-view`、`prune` 默认推荐，作者可在需求对话中明确关闭任一项。`manager` 不主动推荐；只有作者需要手动查看、修改或重置变量时才提出。加入 `manager` 后共 16 条。名称必须来自下表，不接受未知值、重复项或其他配置键。无插件基础包仍是 12 条，仅用于底层构建测试。

| 插件 | 作用 |
|---|---|
| `report` | 把 AI 的变量更新块替换为逐项诊断报告。 |
| `user-view` | 把玩家消息末尾的当前变量折叠显示。 |
| `manager` | 提供变量查看、修改、重置和注入预览面板。 |
| `prune` | 新回合提交后清理较旧玩家消息中的变量块。 |

## 明确边界

- 只支持 MMD 新聊天页，不支持旧 MMD 或本地 SillyTavern。
- 不迁移旧接口、旧存档或其他变量结构。
- 不补字段、不转换类型、不吞掉非法操作；任何失败整批不提交。
- `output/` 是构建产物，日常只修改 `src/author/` 和 `mvu.config.json`。
