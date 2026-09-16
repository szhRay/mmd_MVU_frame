# 作者入口手册

## 自然语言作者协作

作者只需描述角色、玩法、希望系统记住的内容、界面和风格。AI 不要求作者理解 Schema、字段类型、JSON Pointer、SDK、生命周期、正则或插件名，只追问尚未明确且会改变产品结果的选择。

制作固定分为五组：MVU 数据模型、变量注入、全局美化、功能栏/回复状态栏/可选舞台、发送/流式/完成行为。每组先给出简短的人类可读方案，得到作者确认后才修改对应入口；不提前实现后续组。全部完成后生成预览并进行最终视觉确认。具体对话提示和插件建议见 [AI_WORKFLOW.md](AI_WORKFLOW.md)。

常规制作以本手册和 [API.md](API.md) 为准。API 未覆盖所需能力、验证错误无法解释、实际行为与文档不一致，或作者明确要求诊断/修改框架时，才检查完整平台规范与 `src/framework/`。全局技能若规定必须读取平台规范，仍遵守技能要求。

## 数据执行顺序

每次初始化、AI 更新、玩家操作或重置都固定执行：复制候选快照 → 应用操作 → `MVU_MODEL.derive` → Schema 解析 → 保存最终快照。Schema 解析包含验证，以及作者谨慎启用的确定性规范化；派生或解析失败时不保存任何部分变化。

`_` 开头的字段约定为 AI 只读派生字段；`$` 开头的字段默认不会通过变量注入入口发送给 AI。两项均由作者的数据设计负责保持一致。

## 九个作者规则

构建产物中每条“作者配置”正则都保留空行，并用“作者可填写区域”标记可修改范围。必要的函数外壳、模板根节点和主题映射位于标记外，不应删除。

| 分组 | 作者入口 | 用途 |
|---|---|---|
| MVU 数据模型 | `initial-variables.json`、`model.js` | 按实际变量定义初始快照、Schema 和派生字段。 |
| 变量注入 | `variable-inject.js` | 决定玩家每次发送时把哪些当前变量交给 AI。 |
| 全局美化 | `theme.css` | 统一聊天页、状态栏和舞台的视觉语义。 |
| 界面内容 | `status.html` + `status.js`、`stage.html` + `stage.js` | 编写逐回复冻结界面和可选高级舞台。功能栏按需另建文件和规则。 |
| 触发时机 | `before-send.js`、`stream.js`、`render.js` | 在发送前、流式回复中和完整回复后执行作者逻辑。 |

这里的“九个”按构建后的作者配置正则计数：初始变量、变量结构、全局美化、变量注入、发送处理、回复状态栏、舞台、流式更新、完成更新。回复状态栏由 `status.html` 与 `status.js` 合成一条，舞台由 `stage.html` 与 `stage.js` 合成一条。`beginning.txt` 写入导入包的 `beginning`；`variable-rules.txt` 嵌入 `persona.txt` 后共同生成 `personality`。这三个文本文件都不计入正则条数。

### 一、MVU 数据模型

#### 初始变量：`initial-variables.json`

初始变量是新对话的第一份完整快照。根据角色和玩法真正需要记录的内容设置字段、层级、类型和初始值，不保留无业务含义的示例字段。它必须是普通 JSON 对象，并且一次完整满足 `model.js` 的 Schema。

开场 AI 消息使用这份初始快照；之后的 AI 更新、玩家操作、重置和回溯都以经过验证的快照为边界。新增、删除或改名字段时，必须同步检查 Schema、派生逻辑和 `variable-rules.txt`。

#### 变量结构：`model.js`

`schema(z)` 的参数是完整的 Zod 3.23.8 UMD API。Schema 的首要职责是保住功能所需的数据边界，同时尽量接受不影响含义的 AI 格式误差。按以下三级使用，默认停留在第一级。

| 级别 | 能力 | 使用规则 |
|---|---|---|
| 第一级：直接允许 | `.passthrough()`、`.optional()`、`.nullable()`、对象、数组、`z.record`、枚举、字面量、联合类型、数值/文本/长度/范围校验、同步 `refine` / `superRefine` | 只验证而不改写数据，是所有变量模型的默认选择。根对象默认 `.passthrough()`；固定业务对象也优先保留额外字段。只有字段集合必须封闭并直接影响玩法、分支或界面时才用 `.strict()`。 |
| 第二级：谨慎允许 | `z.coerce.number()`、`preprocess`、`transform`、`default` | 仅在正确结果含义唯一时使用；必须同步、确定、幂等，输出普通 JSON，不读取外部状态，也不改变剧情含义。 |
| 第三级：继续禁止 | `catch`、`coerce.boolean()` 等宽泛转换、未知字段静默删除、根变量树复杂重写、猜测未知枚举或结构、无明确方向的自动取整、时间/随机值、异步 refine/transform、非 JSON 输出 | 这些能力会吞掉错误、产生不可重复存档或静默改变业务含义，不得使用。 |

第二级必须同时满足：

- 同一 Schema 对第一次输出再次解析时，结果必须完全相同；不得让同一存档每次解析继续变化。
- `z.coerce.number()` 只用于明确声明为数值、且所有可接受输入都具有唯一数值含义的字段；不使用其他宽泛 `coerce`。
- `preprocess` 只转换严格匹配的格式，例如完整数字字符串；不从混合文本中猜数值。
- `transform` 只做明确范围钳制、不会改变含义的文本规范化或预先定义的唯一映射。
- `default` 只用于业务上不可缺失、且确有唯一默认值的字段；不得借此掩盖本应报错的缺失状态。
- 转换不得修改 `_`、`$` 保护字段，不得输出 Date、Map、Set、BigInt、函数、无限数或其他非 JSON 数据。

当前执行顺序是先 `derive`、后 Schema。若普通字段会参与 `_` 派生字段计算，不要在 Schema 中后置转换该字段；应先在 `derive` 开头完成同样的确定性规范化，再计算派生字段，最后由 Schema 验证最终结果。这样不会出现普通字段被 Zod 修正后，派生字段仍按旧值计算的矛盾。

Zod 不能修复损坏的 `<变量更新>` JSON、非法 `op`、非法 JSON Pointer、缺失的操作目标或 AI 对 `_` / `$` 字段的修改；这些错误发生在 Schema 之前。无法唯一判断正确意图的类型、枚举、对象/数组结构或缺失字段也不得猜测。最终结果仍不合法时，本轮 AI 操作保持整组不提交。

`derive(variables, context)` 接收候选快照的副本，同步完成会影响派生结果的确定性规范化，再计算可由其他字段确定的派生值；不读取 DOM、SDK、存档或 MVU API。规范化同样必须确定、幂等且不猜测业务意图。

`context` 包含 `source`、`round`、`replyId`：

- `source` 只会是 `initial`、`ai`、`player` 或 `reset`。
- `round` 在开场快照为 `0`，第一条后续 AI 回复为 `1`，之后依次递增。
- `replyId` 是该轮 AI 回复的服务端消息 ID 字符串；开场快照为 `null`。玩家操作沿用当前快照的 `round` 和 `replyId`。
- 载入已有存档时不会再次调用 `derive`，而是用当前 Schema 校验每份已保存快照。

初始变量、Schema、`derive` 与 `variable-rules.txt` 必须表达同一套字段和规则。

#### 变量更新规则：`variable-rules.txt`

`variable-rules.txt` 会原样嵌入 persona，模型看不到 `model.js`，因此这里必须说明 Schema 无法由当前 YAML 值直接推断的限制。标签内使用根节点为 `规则` 的紧凑中文 YAML；默认 `规则: {}` 表示没有业务变量，制作角色时替换为实际规则。

只使用以下中文说明键，并且按需填写：

| 键 | 何时填写 |
|---|---|
| `类型` | 非文本类型，或动态对象需要说明键和值结构时。 |
| `范围` | 数值有硬边界时。 |
| `格式` | 日期、时间或固定文本格式不能从字段名判断时。 |
| `取值` | 只有有限状态会影响阶段、分支或界面时。 |
| `分段` | 数值区间具有不同业务含义时。 |
| `说明` | 字段名仍不足以表达含义时。 |
| `更新` | 需要明确触发条件、单次幅度、阈值或禁止条件时。 |

示例仅用于说明格式，不复制进实际项目：

```yaml
规则:
  角色.${角色甲|角色乙}.关系值:
    类型: 数值
    范围: 0~100
    分段: {0~29: 疏远,30~69: 熟悉,70~100: 亲密}
    更新: [仅按本轮已发生互动调整,普通事件单次1~3,重大事件单次4~10]
  物品栏:
    类型: "{[物品名]:{数量:数值,说明:文本}}"
    更新: [实际获得时新增,实际消耗完时删除]
```

变量路径和业务字段使用简短中文；固定玩家键写 `玩家`，不把玩家名或名称宏用作对象键。同类固定字段用 `${字段甲|字段乙}` 合并；动态角色、任务、物品等集合写容器路径，并在 `类型` 中说明动态键结构。文本类型、自明含义和普通更新条件省略，不为完整表格重复信息。

变量设计先判断它是否会影响剧情连续性、角色反应、玩法、分支或界面；没有实际消费者的状态不追踪，可由其他字段确定的值交给 `derive`，不重复交给 AI。有稳定名称的角色、任务和物品优先使用对象键；只有顺序或重复项本身有意义时才使用数组。枚举只用于确实有限且会驱动行为的状态。

更新条件只依据当前变量与本轮正文已经发生的事实，不预测未来。数值规则写明范围、单次幅度、阈值和显著事件；`_` 派生字段与 `$` 隐藏字段不写更新规则。新增、删除、改名或改变类型时，同步检查初始变量、Schema、`derive`、本文件和变量注入。

### 二、变量注入

`variable-inject.js` 在玩家每次发送时同步收到当前变量副本。作者可以按本轮 AI 真正需要的上下文筛选、重命名、组合或省略字段，再返回要随消息发送的字符串。默认发送全部变量；它不修改玩家正文。

推荐把普通 JSON 数据交给 `CARD.yaml.stringify(value)`：

```js
CARD_AUTHOR.inject.variables = function (variables) {
  return CARD.yaml.stringify({
    角色: variables.角色,
    状态: variables.状态,
  });
};
```

`value` 只能包含 `null`、字符串、布尔值、有限数字、数组和普通对象。返回值必须是同步字符串，且不能自行包含 `[当前变量]` 或 `[/当前变量]`；框架会统一添加标记。默认模板会递归省略以 `$` 开头的字段，作者可以按实际变量重新定义筛选方式。

变量系统未就绪、作者入口抛错、返回非字符串或返回保留标记时，本次发送会被阻止，并在 SDK 调试日志记录错误；框架不会改写或补救作者返回值。

一次发送按以下顺序处理：

```text
清除草稿末尾的旧变量块 → beforeSend(draft) → 生成当前变量注入 → 拼接变量块 → 发送
```

### 三、全局美化

`theme.css` 控制聊天页整体配色以及平台输入区、按钮、气泡和弹窗等组件的主题映射，不保存状态，也不编写交互逻辑。

作者只修改两个“作者可填写区域”中的 10 个 `--card-*` 语义变量，分别提供默认深色和 `data-theme="light"` 浅色值，或默认浅色和 `data-theme="dark"` 深色值。作者区块之后的 `--chat-*` 平台映射和图标、气泡规则保持不动。状态栏和舞台 CSS 应复用 `--card-surface`、`--card-text`、`--card-accent` 等语义变量，不另建互不一致的配色体系。

### 四、界面内容

#### 顶层功能栏：`statusbar` → `[data-slot="statusbar"]`

导入正则 JSON 顶层的 `statusbar` 是功能栏原始内容。平台装载角色时先让它依次经过 `regex_scripts` 正则替换，再把替换后的可见 HTML 放进 `[data-slot="statusbar"]`；规则中的 `<style>` 和 `<script>` 会被平台抽取并安装。因此 `statusbar` 通常只写短触发串，完整界面放在对应规则的 `replaceString` 中，避免占用 200 字符额度。

功能栏是基础常驻界面的首选载体，可以承载左右侧按钮、快捷操作、状态摘要，以及弹窗、菜单、抽屉和侧边栏的入口。可以沿用旧版 MMD 的信息架构，例如“侧边按钮 → 弹窗或侧边栏 → 选项写入输入框”，但只能沿用交互思路；新页实现必须使用 `<script>`、`sdk.*`、稳定的 `[data-chat]` / `[data-slot]` 与自有 class/id，不能复用旧版 `img onerror`、雷达法/teapot、旧选择器或 Shadow DOM。

除可选的变量管理器插件外，本框架不提供作者业务功能栏文件或规则，也不规定文件名。作者确认需要功能栏后，可以自行增加任意命名的 HTML、CSS、JS 源文件；新增一条只负责功能栏的独立正则，以唯一标记为 `findRegex`、以完整界面为 `replaceString`，再把该标记加入导入 JSON 的 `statusbar`。新增文件只是源码组织方式，平台实际接收的仍是正则 `replaceString`；默认构建器不会自动发现这些文件或生成这条规则。

功能栏规则必须与“作者配置·回复状态栏”分开，不能把功能栏 HTML、CSS、JS 或事件对象写进 `status.html`、`status.js`。功能栏只在装载时完成一次正则替换，动态数值与开关状态由 JS 更新已有 DOM，不依赖重新跑正则。脚本顶层不访问 DOM；需要初始化时使用新页事件，在回调中定位自己的固定 class/id。

默认构建会把回复状态栏与舞台模板的触发串写入顶层 `statusbar`；启用变量管理器时还会加入它自己的功能栏标记。回复状态栏和舞台规则替换后的隐藏模板源仅供框架克隆，不是玩家可见的功能栏。自定义功能栏标记与这些内部标记并列，不能替换、包裹或复用它们。

#### 回复状态栏：`status.html` + `status.js`

回复状态栏属于单条 AI 回复，与顶层功能栏不是同一层。框架在该消息挂载时，从 `[data-slot="statusbar"]` 内的隐藏模板源克隆 `status.html` 的唯一 `.card-status-root`，在完整回复和对应变量快照可用后调用一次：

```js
CARD_AUTHOR.status.render(root, { content, message, variables });
```

`content` 是该轮 AI 原文，`message` 是消息副本，`variables` 是该回复的冻结变量快照。空 AI 气泡、“消息生成”和省略号占位期间状态栏保持隐藏。后续变量变化不会改写已经显示的旧回复状态栏。

`status.html` 中的 HTML 定义结构，内联 CSS 只修饰 `.card-status-root` 内的元素，`status.js` 负责根内动态列表和交互。HTML 文本或安全属性可以写 `[[变量.路径]]` 标量占位，具体规则如下：

- 路径按英文句点分段；数组元素使用数字段，例如 `[[物品栏.0.名称]]`。字段名本身不能包含英文句点，空段以及 `__proto__`、`prototype`、`constructor` 段非法。
- 最终值只能是字符串、有限数字或布尔值，并统一转成字符串；`null`、对象、数组和不存在的路径非法。
- 占位符不能写进 `style` 或 `script` 文本，也不能写进 `on*`、`href`、`src`、`srcset`、`action`、`formaction` 属性。平台仍会删除作者自写 `data-*`。
- 一次替换是整体操作；任一占位符非法时不替换任何占位符，状态栏继续隐藏。

状态栏在 AI 消息挂载时以隐藏状态创建，收到有效的完整回复并取得该回复快照后才调用作者 `render`。同一挂载实例成功后不再刷新；消息卸载再挂载时会重新克隆并渲染。变量暂不可用或作者渲染抛错时保持隐藏，后续变量变更会再次尝试，重复错误只记录一次。

#### 舞台：`stage.html` + `stage.js`

舞台是可选的高级扩展，不是基础界面的默认载体。侧边按钮、弹窗、侧边栏和小型常驻面板优先使用功能栏；只有地图、背包、小游戏或大型角色面板需要覆盖消息区或整屏时，才使用舞台。框架在首次 `message:mount` 时把 `stage.html` 的唯一 `.card-stage-root` 克隆到 `sdk.stage.el()`，然后同步调用一次 `CARD_AUTHOR.stage.render(root)`。该入口只初始化根内 DOM 和绑定交互，不负责打开舞台，也不读取变量。

这里不使用 `ready`：MMD 新页的首屏顺序是 `message:new → message:mount → message:done → ready`，而且晚注册的 `ready` 监听不会补发，无法可靠承担首屏舞台构建。`message:mount` 能覆盖首次已有消息和之后的会话重建。

作者直接使用 MMD 新页 SDK 控制舞台：

```js
sdk.stage.open('full');
sdk.stage.close();
sdk.stage.visible();
sdk.stage.el();
```

舞台不会自动打开。需要随完整回复刷新时，在全局 `CARD_AUTHOR.render` 中从 `sdk.stage.el()` 查询自己的 `.card-stage-root` 并更新。关闭再打开不会重新初始化；切换会话会移除旧根，新会话首次挂载消息时重新创建。作者初始化抛错时不重试、不降级。

状态栏和舞台规则均按 HTML、CSS、JS 排列。平台会在 DOM 建立前抽取并执行脚本，因此作者脚本顶层不得访问 DOM；初始化只能写在各自的 `render` 入口内。

### 五、触发时机

完整交互链如下：

```text
玩家发送 → 发送处理 → 变量注入 → AI 流式更新（可重复） → MVU 提交 → 回复状态栏与完成更新
```

#### 发送处理：`before-send.js`

`CARD_AUTHOR.inject.beforeSend(draft)` 在玩家消息发出前同步调用。`draft` 是已经移除末尾旧变量块的完整草稿；返回值是准备发送的完整玩家正文，必须是非空同步字符串，且不能包含变量块保留标记。这里可以整理、包裹或追加玩家正文，但不生成变量注入。

#### 流式更新：`stream.js`

`CARD_AUTHOR.stream({content, message})` 在当前 AI 回复正文变化时调用，同一回复可能调用多次。`content` 是当时的流式正文，`message` 是消息副本；此时变量尚未完成处理，因此不提供 `variables`。该入口适合进度提示和临时预览，不提交变量，也不渲染依赖最终变量的内容。

作者入口的返回值会被忽略。入口抛错时框架只写 SDK 调试日志；该次调用结束，之后的流式或完成事件仍会继续调用作者入口。

#### 完成更新：`render.js`

`CARD_AUTHOR.render({content, message, variables, variableError})` 在完整 AI 回复经过 MVU 处理后调用。`variables` 通常是该回复提交后的最终快照；如果该轮变量更新失败，则提供当前已提交快照，并在 `variableError` 中给出错误文本。

成功时 payload 不包含 `variableError` 属性。若回复快照暂不可用，框架会等待变量变更后重试；连当前已提交快照也无法读取时，本次不调用作者 `render`，只记录错误。

该入口适合更新舞台或其他跨消息长期界面。逐回复冻结内容写在状态栏入口，不要在这里重新读取或改写旧消息气泡。

## 公共接口

主动调用前先阅读 [API.md](API.md)。作者公开面仅包含：

```js
CARD.messages.at(index, role);

CARD.variables.current();
CARD.variables.reply(index);

MVU.replace(path, value);
MVU.delta(path, value);
MVU.insert(path, value);
MVU.remove(path);
```

入口已经提供的数据直接使用：变量注入入口已有当前变量，状态栏与完成更新入口已有对应的 `variables`，不重复读取。历史正文用 `CARD.messages.at(index, role)` 按角色读取；历史变量用同一 AI 消息序列的 `CARD.variables.reply(index)` 读取。

## MMD 新页约束

- 消息正文、功能栏及正则替换产生的可见 HTML 会先经过 worker 标签白名单，再经过 DOMPurify；实际可用范围取两者交集。白名单外的标签壳会被删除，但其中的文字通常保留。
- worker 侧允许的标签如下；`style`、`script` 会被平台抽取并单独生效，不作为可见容器留在原位置：

```text
p b a div span h1 h2 h3 h4 h5 h6 ul li ol strong em br img pre font i button
table th tr td input textarea label select option video script user summary
details code blockquote hr del thead tbody s
svg g path circle ellipse rect line polyline polygon text tspan defs use
linearGradient radialGradient stop clipPath title style
```

- 常规布局优先使用 `div`、`span`、`p`、列表、表格、`details/summary` 和表单控件。`section`、`article`、`header`、`footer`、`main`、`nav`、`aside`、`fieldset`、`legend` 不在 worker 白名单内；需要这些语义时改用带自有 class 的 `div`，不能依赖标签壳保留。
- `iframe`、`link`、`meta`、`base`、`form`、`object`、`embed` 会被删除。不要用 `form` 包裹输入控件，按钮逻辑由脚本绑定。
- 模型正文中的 `<状态>`、`<面板>` 等中文尖括号标记会被当成标签剥掉；需要供正则匹配的协议标记统一使用 `[状态]...[/状态]` 这类方括号形式。真正要渲染的 HTML 不要包在 Markdown 反引号中，否则会显示成文本。
- 作者自写的 `data-*`、`aria-*` 和 `role` 会被净化删除；自有节点用带项目前缀的 class/id，避免 `id="forms"`、`id="images"` 等与 `document` 属性冲突的名称。平台自己的 `[data-chat]`、`[data-slot]` 只读使用。
- HTML 元素上的 `on*` 可能保留，但 SVG 内的 `on*` 会被删除；本项目仍统一在 `<script>` 中给 HTML 容器或按钮绑定事件。不要把业务逻辑塞进内联事件属性，属性值中的 `]>`、`-->`、`--!>` 或 `</script` 等片段还可能让整条属性消失。
- 成品界面保持自包含：CSP 会阻止外部 `fetch`、外部字体和外部样式表。使用系统字体栈与内联 `<style>`；图片可使用 `https:`、`data:` 或 `blob:`。外链 HTTPS 脚本虽可能加载，但平台不会等待它完成，还会干扰后续 `ready` 订阅，因此常规作者实现只使用内联脚本。
- 作者脚本在 DOM 建立前执行，顶层不得查询或写入 DOM。
- 气泡内绑定只能在 `message:mount` 回调中同步取得引用；不得跨 `await` 或定时器后重新查询气泡。
- `sdk.on` 只能在脚本体注册，不能嵌套在 `message:mount` 中。
- `document.currentScript` 恒为 `null`；用固定 class/id 和事件提供的消息作用域定位。
- 禁止 `img onerror`、teapot、Shadow DOM 和作者自写 `data-*`。作者元素使用自有 class/id。
- 基础常驻入口、弹窗和侧边栏优先放功能栏；只有需要覆盖消息区或整屏的大型长期界面才使用 `sdk.stage`。回复状态栏只保存该回复的冻结视图。
- 作者 CSS 不写 `html`、`body`、`:root` 或全局 `*`，平台换肤写在 `[data-chat="root"]`。
- 不直接读取消息正文 DOM；流式和完成内容分别使用事件载荷的 `content`。
- `sdk.message.*`、`sdk.save.*` 等 Promise 调用必须显式处理失败。

## 开场白、Persona 与更新协议

`beginning.txt` 是玩家看到的开场 AI 消息。构建时会去掉文件首尾空白并写入导入包的 `beginning`，长度不得超过 4000 字符。它使用初始变量快照，不解析也不需要 `<变量更新>` 块；默认回复状态栏与舞台的触发串，以及按需增加的功能栏标记，都写入顶层 `statusbar`，不需要放进开场白。

在 `persona.txt` 填写角色设定，在 `variable-rules.txt` 逐字段描述语义与更新条件。不要改掉 `{{VARIABLE_RULES}}` 占位；构建器要求它恰好出现一次。

通用协议使用 JSON Pointer 和 `replace`、`delta`、`insert`、`remove` 四种操作。Schema 是最终边界，提示词描述必须与 Schema、初始变量和 `derive` 完全一致。

## 构建门禁

构建会直接拒绝：缺少源文件、非法配置、重复插件、未知插件、非 slash 匹配式、可命中空串的正则、重复匹配式、触发标记交叉污染、错误模板根、错误 JSON 键、规则名称超过 20 字、匹配式超过 1000 字或替换内容达到 20000 字。

修改完成后运行 `npm run build`。让 `tavern-mmd` 对正式产物执行 `validate.py --platform mmdsandbox`。

构建后对正式 JSON 做语法检查和 MMD 新页校验。默认不生成或验证 chat/thin-preview 仿真页面；作者明确要求预览时再单独生成。正式导入始终使用 `output/mvu-regex.json`。
