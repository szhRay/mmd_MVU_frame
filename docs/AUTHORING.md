# 作者入口手册

## 自然语言作者协作

制作固定分为四组：角色设定与开场白、全局美化、功能栏/回复状态栏/可选舞台、发送/流式/完成行为。每组先确认玩家可见结果，再修改对应入口。

本支线完全无状态。不要设计变量表、更新协议、跨轮快照或剧情存档；需要这些能力时切换到 main 分支。

## 六个作者规则

| 分组 | 作者入口 | 用途 |
|---|---|---|
| 全局美化 | theme.css | 统一聊天页、状态栏和舞台的视觉语义。 |
| 发送处理 | before-send.js | 同步整理发送按钮提交的玩家草稿。 |
| 回复状态栏 | status.html + status.js | 为每条已完成 AI 回复生成冻结视图。 |
| 舞台 | stage.html + stage.js | 初始化可选的大型长期界面。 |
| 流式更新 | stream.js | 在当前 AI 回复生成过程中更新临时界面。 |
| 完成更新 | render.js | 在完整 AI 回复结束后更新长期界面。 |

回复状态栏与舞台各由一组 HTML/CSS 与 JS 合并为一条正则。beginning.txt 和 persona.txt 分别进入导入包的 beginning 与 personality，不计入规则数。

### 角色设定与开场白

persona.txt 填写角色身份、行为规则、世界设定和写作要求。不要要求 AI 输出变量更新块或其他跨轮状态协议。

beginning.txt 是玩家看到的开场 AI 消息。构建时会去掉首尾空白，长度不得超过 4000 字符。

### 全局美化

theme.css 控制聊天页、回复状态栏和舞台。平台主题覆盖写在：

~~~css
[data-chat="root"][data-theme="dark"] { }
[data-chat="root"][data-theme="light"] { }
~~~

不要写 html、body、:root 或全局星号选择器，不请求外部字体、样式表或接口。

### 发送处理

CARD_AUTHOR.beforeSend(draft) 同步接收完整草稿并返回发送正文。返回非字符串、空白字符串或抛错时，本次点击发送会被阻止并写入 SDK 调试日志。

~~~js
CARD_AUTHOR.beforeSend = function (draft) {
  return draft.trim();
};
~~~

### 回复状态栏

status.html 必须保留唯一的 card-status-source 模板根，模板内再有且只有一个实际状态栏根元素。框架会为每条完整 AI 回复克隆实际根。

status.js 的入口：

~~~js
CARD_AUTHOR.status = {
  render(root, { content, message }) {
  },
};
~~~

root 只属于当前回复。状态栏只能从 content 和 message 计算本轮冻结视图；不得读取或累计其他轮的剧情状态。

### 舞台

stage.html 必须保留唯一的 card-stage-source 模板根，内部再有且只有一个实际舞台根。框架在首次消息挂载时把实际根放入 sdk.stage.el()，并调用：

~~~js
CARD_AUTHOR.stage = {
  render(root) {
  },
};
~~~

普通侧边栏、弹窗和快捷操作优先放顶层功能栏。只有地图、小游戏或覆盖消息区的大型界面才使用舞台。

### 流式与完成更新

流式入口可能在同一回复中被重复调用：

~~~js
CARD_AUTHOR.stream = function ({ content, message }) {
};
~~~

完成入口对完整 AI 回复调用：

~~~js
CARD_AUTHOR.render = function ({ content, message }) {
};
~~~

两者均不提供变量或存档。完成入口适合更新舞台等长期 UI；逐回复冻结内容写在状态栏入口。

## 公共接口

作者公开面仅包含：

~~~js
CARD.messages.at(index, role);
CARD.yaml.stringify(value);
~~~

历史正文使用 CARD.messages.at 读取。不要从消息 DOM 反查正文。

## 功能栏

导入 JSON 的 statusbar 会经过正则替换，结果位于 [data-slot="statusbar"]。侧边按钮、弹窗入口、菜单和侧边栏优先放这里。

本框架不内置功能栏。需要时另建作者文件、独立正则和唯一标记，并把标记加入顶层 statusbar。不得把功能栏写入逐回复的 status.html 或 status.js。

## MMD 新页容器白名单

进入消息正文、功能栏或正则 replaceString 的可见 HTML 只使用下列 worker 白名单标签：

~~~
p b a div span h1 h2 h3 h4 h5 h6 ul li ol strong em br img pre font i button
table th tr td input textarea label select option video user summary details code
blockquote hr del thead tbody s
svg g path circle ellipse rect line polyline polygon text tspan defs use
linearGradient radialGradient stop clipPath title
~~~

style 与 script 会被平台抽出执行，不作为可见容器。白名单外语义容器统一换成带自有 class 的 div。

另外遵守：

- 不使用作者自写 data-*、中文尖括号正文标记或 SVG 内联事件。
- 禁止 iframe、form、object、embed、link、meta 和 base。
- 作者脚本早于 DOM，顶层不得查询或写入 DOM。
- document.currentScript 恒为 null。
- 禁止 img onerror、teapot 和 Shadow DOM。
- 不在 message:mount 回调中再次注册 sdk.on。
- 不跨 await 或定时器后重新查询气泡节点。
- 不直接读取消息正文 DOM；使用入口的 content。
- Promise 能力必须显式处理失败。

## 构建门禁

构建会拒绝缺少源文件、非 slash 匹配式、可命中空串的正则、重复匹配式、触发标记交叉污染、错误模板根、错误 JSON 键、规则名超过 20 字、匹配式超过 1000 字或替换内容达到 20000 字。

完成后运行 npm run build，再对 output/card-regex.json 做 JSON 语法检查和 MMD 新页校验。作者明确要求时才运行 npm run preview。
