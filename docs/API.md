# CARD 与 MMD 新页 API

本手册只列作者入口需要的公开能力。常规作者代码不访问 CARD_INTERNAL，不读取平台内部 store，也不自行注册框架已经覆盖的消息生命周期。

## 消息对象

~~~js
{
  id,
  serverId,
  role,
  content,
}
~~~

- id 是当前页面的本地消息 ID。
- serverId 为空时消息不可编辑。
- role 只会是 ai 或 user。
- content 是事件提供的消息原文。

## CARD.messages.at

~~~js
CARD.messages.at(index, role);
~~~

先按角色筛选当前已加载消息，再按位置读取。

- index 必须是整数；0 是第一条，-1 是最后一条。
- role 只能是 ai 或 user。
- 返回消息副本；越界返回 null。
- 不负责加载更早历史，不把索引用作长期身份。

~~~js
const greeting = CARD.messages.at(0, 'ai');
const latestReply = CARD.messages.at(-1, 'ai');
const latestUser = CARD.messages.at(-1, 'user');
~~~

## CARD.yaml.stringify

~~~js
CARD.yaml.stringify(value);
~~~

把普通 JSON 数据转换成 YAML 字符串。只接受 null、字符串、布尔值、有限数字、数组和普通对象；不接受 Date、Map、Set、BigInt、函数或无限数。

此方法只负责文本格式化，不保存或累计状态。

## 输入区

| 能力 | 返回 | 说明 |
|---|---|---|
| sdk.input.get() | string | 同步读取当前草稿。 |
| sdk.input.set(text) | void | 整体替换草稿。 |
| sdk.input.add(text) | void | 向末尾追加文字。 |
| sdk.input.insert(text) | void | 在当前光标插入文字。 |
| sdk.input.clear() | void | 清空草稿。 |
| sdk.input.focus() | void | 聚焦输入框。 |

选项和快捷操作默认使用 sdk.input.set，让玩家确认后自行发送。

## 消息

| 能力 | 返回 | 限制 |
|---|---|---|
| sdk.message.send(text?) | Promise<void> | 必须在用户点击当帧直接调用，调用前不能 await。 |
| sdk.message.edit(id, text) | Promise<void> | 先确认 serverId 非空，再传消息的本地 id。 |

Promise 必须处理失败；不要在 message:done 中无条件发送。

~~~js
sdk.message.send('继续').catch(function (error) {
  sdk.debug.log('发送失败', error && error.code);
});
~~~

## 舞台

| 能力 | 说明 |
|---|---|
| sdk.stage.open(mode?) | 打开 content 或 full 模式舞台。 |
| sdk.stage.close() | 关闭舞台，不清空 DOM。 |
| sdk.stage.el() | 取得舞台容器。 |
| sdk.stage.visible() | 唯一可靠的舞台开关判断。 |

框架会在首次消息挂载时创建 card-stage-root。作者只更新自己的根节点，不重复建立舞台。

## 临时 UI 状态

sdk.cache 可用于当前页面的折叠、选中标签等临时 UI 状态，刷新即失。本支线不使用 sdk.save 或 localStorage 保存剧情进度，也不允许借它们重建变量系统。

## 角色、玩家与调试

| 能力 | 返回 |
|---|---|
| sdk.role.get() | 角色 name 与 avatarUrl。 |
| sdk.user.get() | 玩家 nickname 与 avatarUrl。 |
| sdk.debug.log(...args) | 写入 SDK 调试面板。 |
| sdk.version | 固定值 1，不是函数。 |

## 事件

合法事件名：

~~~
ready
message:new  message:done  message:stream  message:mount  message:unmount
input:change  conversation:switch  theme:change  back  stage:close  dispose
~~~

首屏依赖 message:mount 或 message:done，不依赖 ready。常规作者入口不自行订阅 message:stream、message:done 或 message:mount；框架已经转换为 CARD_AUTHOR.stream、CARD_AUTHOR.render、CARD_AUTHOR.status 和 CARD_AUTHOR.stage。

只有现有入口无法表达需求时，才诊断并扩展框架。

## 错误处理

同步调用按契约处理异常，Promise 调用至少记录 error.code。不要吞掉失败、伪造成功状态或补造数据。
