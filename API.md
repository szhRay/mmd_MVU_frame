# 作者 API 手册

本文描述 `src/author/` 可以主动调用的项目运行时接口，以及作者入口实际需要的 MMD 新聊天页 SDK。变量注入的 YAML 序列化见 [AUTHORING.md](AUTHORING.md)。常规制作以本手册为准；本手册没有覆盖所需能力或实际行为异常时，才查询 `tavern-mmd` 的完整 `mmd-sandbox.md`。

## 使用原则

- 入口参数已经提供的数据直接使用，不要再次读取：`variable-inject.js` 已有 `variables`；`status.js` 已有该回复的 `message` 和 `variables`；`render.js` 已有当前完成回复的 `message`、`variables` 和 `variableError`。
- `stream.js` 只处理流式正文，不读取变量。需要变量的最终渲染写在 `render.js`。
- 只有入口没有提供所需数据，或确实需要查询其他消息时，才主动使用本手册的读取接口。
- 所有返回的消息和变量对象都是副本。修改副本不会修改消息、变量或存档。
- MVU 业务变量只通过 `MVU.replace/delta/insert/remove` 修改，不重复写入 `sdk.save`。
- 返回 Promise 的 SDK 调用必须处理失败；同步的 `sdk.save.get/keys` 也必须处理其可能抛出的错误。

## MMD 新页 SDK

以下能力只存在于 `/mmdsandbox`（`chatVersion: 1`）。`sync` 表示同步返回；`async` 表示返回 Promise。

### 输入框与输入区

| 能力 | 参数 | 返回 | 类型 | 用途与限制 |
|---|---|---|---|---|
| `sdk.input.get()` | 无 | `string` | sync | 读取草稿；不要轮询，变化监听用 `input:change`。 |
| `sdk.input.set(text)` | `text: string` | `void` | sync | 替换草稿。选项按钮优先用它，让玩家确认后自行发送。 |
| `sdk.input.add(text)` | `text: string` | `void` | sync | 在草稿末尾追加文本；不要逐字调用。 |
| `sdk.input.insert(text)` | `text: string` | `void` | sync | 在当前光标处插入；取不到光标时位置为 0。 |
| `sdk.input.clear()` | 无 | `void` | sync | 清空草稿；正常发送后平台已自动清空。 |
| `sdk.input.focus()` | 无 | `void` | sync | 聚焦输入框；不要在页面刚加载时主动唤起手机键盘。 |
| `sdk.input.blur()` | 无 | `void` | sync | 取消输入框焦点。 |
| `sdk.input.getCursor()` | 无 | `number` | sync | 读取光标位置，不提供选区。 |
| `sdk.input.setCursor(n)` | `n: number` | `void` | sync | 设置光标；紧接 `input.set` 的同一 tick 调用会按旧文本长度截断。 |
| `sdk.composer.show()` | 无 | `void` | sync | 显示输入区。 |
| `sdk.composer.hide()` | 无 | `void` | sync | 隐藏输入区；产品必须仍有明确的发送路径。 |
| `sdk.composer.visible()` | 无 | `boolean` | sync | 判断输入区是否可见。 |

输入框写入在 IME 组合输入期间可能失败。作者界面的普通选择和快捷操作优先 `sdk.input.set`，不要直接替玩家发送。

### 消息

| 能力 | 参数 | 返回 | 类型 | 用途与限制 |
|---|---|---|---|---|
| `sdk.message.send(text?)` | `text?: string` | `Promise<void>` | async | 以玩家身份发送指定文字；省略时发送当前草稿。必须在用户点击的当帧直接调用，调用前不能先 `await`。 |
| `sdk.message.edit(id, text)` | `id: string, text: string` | `Promise<void>` | async | 编辑消息；先以非空 `message.serverId` 确认消息可编辑，再传该消息的本地 `message.id`。 |

两项都必须处理 Promise 失败。不要在 `message:done` 中无条件发送，否则会形成自动对话循环。

```js
function sendChoice(text) {
  sdk.message.send(text).catch(function (error) {
    sdk.debug.log('发送失败', error && error.code);
  });
}
```

### 临时状态与服务端存档

| 能力 | 参数 | 返回 | 类型 | 用途与限制 |
|---|---|---|---|---|
| `sdk.cache.get(key)` | `key: string` | `unknown` | sync | 读取刷新即失的临时状态。 |
| `sdk.cache.set(key, value)` | `key: string, value: unknown` | `void` | sync | 保存当场 UI 状态。 |
| `sdk.cache.remove(key)` | `key: string` | `void` | sync | 删除临时状态。 |
| `sdk.save.get(key)` | `key: string` | `unknown` | sync | 读取进页时预载的服务端存档；创卡页瘦预览可能同步抛错，必须 `try/catch`。 |
| `sdk.save.set(key, value)` | `key: string, value: unknown` | `Promise<void>` | async | 写入可 JSON 序列化的跨设备存档；应把相关状态合并成一个对象并降低写入频率。 |
| `sdk.save.remove(key)` | `key: string` | `Promise<void>` | async | 当前真机环境稳定失败，属于不可依赖能力；常规作者代码不要使用。 |
| `sdk.save.keys()` | 无 | `string[]` | sync | 列出存档键；创卡页瘦预览可能同步抛错，必须 `try/catch`。 |

`cache` 只存界面当场状态，不存玩法进度；`save` 不用于复制 MVU 变量。存档键不含冒号且不超过 64 字符，写入值必须可 `JSON.stringify`。游客存档不会迁移到登录账号，不能把持久存档设计成唯一可玩路径。

### 功能栏与基础浮层

导入正则 JSON 的 `statusbar` 内容会先经过全部正则规则替换，替换后的可见 DOM 位于 `[data-slot="statusbar"]`。基础常驻界面优先放在这里，包括侧边按钮、弹窗入口、菜单、抽屉、侧边栏和快捷操作。

`statusbar` 最长 200 字符，通常只保存触发串；完整 HTML/CSS/JS 放在匹配该触发串的 `replaceString`。功能栏只在装载时执行一次正则替换，动态内容由 JS 更新现有 DOM，不依赖重新跑正则。

本框架不内置功能栏，也不规定文件名。需要时可自行增加任意命名的 HTML、CSS、JS 源文件，建立独立功能栏正则，并把它的唯一标记加入 JSON 的 `statusbar`。默认的 `status.html`、`status.js` 只负责逐回复状态栏，不能承载功能栏。新增文件不会被默认构建器自动发现；实际导入内容必须明确组装进功能栏规则的 `replaceString`。

旧版 MMD 的按钮、弹窗和侧边栏组织方式可以作为产品结构参考，但新页只使用 `<script>`、`sdk.*`、`[data-chat]` / `[data-slot]` 和自有 class/id。旧版 `img onerror`、雷达法/teapot、旧选择器与 Shadow DOM 不可复用。

### 可选舞台

| 能力 | 参数 | 返回 | 类型 | 用途与限制 |
|---|---|---|---|---|
| `sdk.stage.open(mode?)` | `mode?: 'content' \| 'full'` | `void` | sync | 打开长期界面；默认 `content`。 |
| `sdk.stage.close()` | 无 | `void` | sync | 关闭舞台，不清空其中 DOM。 |
| `sdk.stage.el()` | 无 | `HTMLElement` | sync | 取得舞台容器；关闭时仍可能返回节点。 |
| `sdk.stage.visible()` | 无 | `boolean` | sync | 唯一可靠的舞台开关判断。 |

舞台只用于需要覆盖消息区或整屏的大型、高级界面；普通侧边栏和弹窗不需要舞台。框架会在首次消息挂载时创建 `.card-stage-root`。作者入口只更新自己的根节点，不在每次打开时重建舞台。

### 角色、玩家、调试与事件

| 能力 | 参数 | 返回 | 类型 | 用途与限制 |
|---|---|---|---|---|
| `sdk.role.get()` | 无 | `{ name, avatarUrl }` | sync | 只提供角色名与头像。 |
| `sdk.user.get()` | 无 | `{ nickname, avatarUrl }` | sync | 只提供玩家昵称与头像；游客也有占位值，不能据此判断登录。 |
| `sdk.debug.log(...args)` | 任意值 | `void` | sync | 写入 `?sdkDebug=1` 调试面板。 |
| `sdk.version` | 无；它是值 | `'1'` | sync value | 不要写成函数，也不要用于能力探测。 |
| `sdk.on(event, callback)` | 事件名、回调 | `void` | sync | 订阅事件；没有 `once` 或 `off`。 |

合法事件名：

```text
ready
message:new  message:done  message:stream  message:mount  message:unmount
input:change  conversation:switch  theme:change  back  stage:close  dispose
```

`message:new/mount/done` 的载荷是 `{ content, id, role, serverId }`；`message:stream` 读取累积的 `content`。首屏依赖 `message:mount` 或 `message:done`，不依赖最后到且不补发的 `ready`。

常规作者入口不自行调用 `sdk.on`：框架已经把发送、流式、完成、状态栏和舞台生命周期转换为 `CARD_AUTHOR.*` 入口。只有现有入口无法表达需求时，才检查框架和完整平台契约，再决定是否扩展框架。

## 错误处理

Promise 能力至少记录 `error.code`；同步读取按契约用 `try/catch`。不要吞掉失败、伪造成功状态或自行补值。常见错误码包括 `UNAUTHORIZED`、`RATE_LIMITED`、`INVALID_ARGS`、`HOST_DENIED`、`NETWORK`、`NOT_SUPPORTED`、`UI_BUSY`、`MODEL_UNAVAILABLE`、`UNKNOWN_CAPABILITY`。

若本手册未覆盖所需能力、验证错误无法解释、实际行为与文档不一致，或用户明确要求修改/诊断框架，再读取完整 `mmd-sandbox.md` 与相关 `src/framework/` 源码。

## 消息

消息对象具有以下字段：

```js
{
  id,        // 本地消息 ID；项目实测用于 sdk.message.edit
  serverId,  // 服务端消息 ID；为 null 时消息不可编辑
  role,      // "ai" 或 "user"
  content,   // 消息原文
}
```

`id` 用于当前已加载消息的身份和编辑调用，不作为跨重载持久身份；需要长期关联消息时使用非空 `serverId`。

### `CARD.messages.at(index, role)`

先按角色筛选当前已加载消息，再按筛选后列表的位置读取一条消息。可读取 AI 回复，也可读取玩家已经发送的内容。

- `index`：必须是整数。`0` 是该角色第一条，`-1` 是该角色最后一条，其他负数继续从末尾向前计数。
- `role`：只能是 `"ai"` 或 `"user"`。
- 顺序：同一角色内从旧到新；AI 序列包含开场消息，user 序列包含玩家已发送的消息。
- 返回：对应消息的副本；索引越界时返回 `null`。
- 失败：索引不是整数、角色非法、消息仓尚不可访问或框架已经停止时抛出错误。

```js
const greeting = CARD.messages.at(0, 'ai');
const latestReply = CARD.messages.at(-1, 'ai');
const firstSent = CARD.messages.at(0, 'user');
const latestSent = CARD.messages.at(-1, 'user');

if (latestSent) {
  console.log(latestSent.content);
}
```

索引只针对当前已经加载且角色匹配的消息。平台之后加载更早的同角色历史时，原有正索引会随列表前移；不要把索引保存为长期身份。该接口不负责加载更早的历史。

## 变量读取

### `CARD.variables.current()`

读取当前对话位置已经提交的最终变量快照。

- 返回：当前变量的深拷贝。
- 失败：变量系统尚未就绪、当前回复尚未完成、存档或校验状态不可用时抛出错误。

```js
const variables = CARD.variables.current();
panel.querySelector('.current-value').textContent = variables.角色.姓名;
```

只在入口没有提供 `variables` 时调用。读取结果仅供展示；给返回对象赋值不会提交变量。

### `CARD.variables.reply(index)`

按 AI 消息序列索引读取某条回复对应的最终变量快照。索引语义与 `CARD.messages.at(index, 'ai')` 完全一致。

- 参数：`index` 必须是整数；`0` 是开场 AI 消息，`1` 是第一条后续 AI 回复，`-1` 是最后一条 AI 消息。
- 返回：该回复变量快照的深拷贝；开场消息对应初始变量快照。
- 失败：索引非法或越界、找不到回复快照、该轮变量更新失败或变量系统不可用时抛出错误。

```js
const greeting = CARD.messages.at(0, 'ai');
const initialVariables = CARD.variables.reply(0);

const firstReply = CARD.messages.at(1, 'ai');
const firstReplyVariables = CARD.variables.reply(1);
```

`status.js` 已直接收到该回复的 `variables`，`render.js` 也已收到当前回复的 `variables`；这两个入口不要重复调用本方法。

## 玩家变量操作

作者交互只使用以下四个方法。每次调用都是一次独立事务：复制当前快照、执行一个操作、运行 `MVU_MODEL.derive`、严格校验并提交。操作、派生或校验失败时抛出错误，本次调用不提交任何变化；成功时同步返回已提交最终快照的深拷贝，并在随后异步持久化。

路径使用 JSON Pointer：

- 必须以 `/` 开头，不能用空字符串表示根。
- 对象字段和数组索引各占一段，例如 `/角色/姓名`、`/物品栏/0`。
- 字段名中的 `~` 写成 `~0`，`/` 写成 `~1`。
- 数组索引使用非负整数；`insert` 可用末段 `-` 表示追加。

### `MVU.replace(path, value)`

替换已经存在的对象字段或数组元素。`value` 必须是普通 JSON 数据。

```js
const variables = MVU.replace('/角色/姓名', '新名字');
```

### `MVU.delta(path, value)`

给已经存在的数字字段增加 `value`。原值、增量和结果都必须是有限数字。

```js
const variables = MVU.delta('/状态/积分', 1);
```

### `MVU.insert(path, value)`

新增不存在的对象字段，或在数组指定位置插入元素。对象字段已经存在时失败；数组可在 `0` 到当前长度之间插入。

```js
const variables = MVU.insert('/物品栏/-', {
  名称: '新物品',
  数量: 1,
});
```

### `MVU.remove(path)`

删除已经存在的对象字段或数组元素。

```js
const variables = MVU.remove('/效果/0');
```

四个方法都要求变量系统已经就绪，且路径、结果和派生值必须满足严格 Schema。返回值表示本次变量提交成功，不表示异步持久化已经完成。连续调用多个方法会形成多个独立提交；后一次失败不会撤销此前已经成功的调用。
