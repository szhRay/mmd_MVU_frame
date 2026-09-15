const fs = require('node:fs');
const path = require('node:path');

const PLUGINS = ['report', 'user-view', 'manager', 'prune'];
const TOP_KEYS = ['chatVersion', 'pageDepth', 'statusbar', 'beginning', 'personality', 'regex_scripts'];
const RULE_KEYS = ['id', 'scriptName', 'findRegex', 'replaceString'];

function read(root, name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('缺少文件：' + name);
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function script(source) {
  if (/<\/script>/i.test(source)) throw new Error('脚本源码不能包含 </script>：请拆分字符串');
  return '<script>\n' + source.trim() + '\n</script>';
}

function style(source) {
  if (/<\/style>/i.test(source)) throw new Error('样式源码不能包含 </style>：请拆分字符串');
  return '<style>\n' + source.trim() + '\n</style>';
}

function compactMarkup(source) {
  return source.trim().replace(/>\s+</g, '><')
    .replace(/(<!-- ===== 作者可填写区域：[^>]+ ===== -->)/g, '\n\n$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/<style>/g, '\n\n<style>');
}

function escapeHtml(source) {
  return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function strictConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('mvu.config.json 必须是对象');
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'plugins') throw new Error('mvu.config.json 顶层必须恰好只有 plugins');
  if (!Array.isArray(value.plugins)) throw new Error('plugins 必须是数组');
  if (new Set(value.plugins).size !== value.plugins.length) throw new Error('plugins 不能重复');
  for (const name of value.plugins) if (!PLUGINS.includes(name)) throw new Error('未知插件：' + name);
  return value.plugins.slice();
}

function parseSlashRegex(value) {
  const match = /^\/([\s\S]*)\/([dgimsuvy]*)$/.exec(value);
  if (!match) throw new Error('匹配式必须使用 /pattern/flags：' + value);
  let regex;
  try { regex = new RegExp(match[1], match[2]); }
  catch (error) { throw new Error('匹配式无效：' + value + '：' + error.message); }
  regex.lastIndex = 0;
  if (regex.test('')) throw new Error('匹配式不能命中空串：' + value);
}

function sourceRoot(markup, className) {
  const clean = markup.replace(/<style>[\s\S]*?<\/style>/gi, '').replace(/<script>[\s\S]*?<\/script>/gi, '').trim();
  const token = 'class="' + className + '"';
  if (clean.split(token).length !== 2) throw new Error(className + ' 必须恰好出现一次');
  return clean;
}

function frameworkDefinitions(root) {
  const f = name => read(root, 'src/framework/' + name);
  const a = name => read(root, 'src/author/' + name);
  const initial = JSON.parse(a('initial-variables.json'));
  if (!initial || typeof initial !== 'object' || Array.isArray(initial)) throw new Error('initial-variables.json 必须是对象');
  const statusMarkup = compactMarkup(a('status.html'));
  const stageMarkup = compactMarkup(a('stage.html'));
  const statusRoot = sourceRoot(statusMarkup, 'card-status-source');
  const stageRoot = sourceRoot(stageMarkup, 'card-stage-source');
  const authorStatus = statusMarkup + '\n\n' + script(a('status.js'));
  const authorStage = stageMarkup + '\n\n' + script(a('stage.js'));

  return {
    definitions: [
      {
        title: '框架·基础', find: '/__MVU_RUNTIME_BASE__/', sentinel: '__MVU_RUNTIME_BASE__',
        content: script([f('card-core.js'), f('message-reader.js'), f('card-prose.js'), f('card-variables.js'), f('card-yaml.js'), f('card-inject.js')].join('\n')),
      },
      {
        title: '框架·界面与操作', find: '/__MVU_RUNTIME_VIEW__/', sentinel: '__MVU_RUNTIME_VIEW__',
        content: script([f('card-status.js'), f('card-stage.js'), f('card-render.js'), f('mvu-json.js')].join('\n')),
      },
      { title: '作者配置·初始变量', find: '/__MVU_AUTHOR_INITIAL__/', sentinel: '__MVU_AUTHOR_INITIAL__', content: script('// ===== 作者可填写区域：开始 =====\n\nwindow.MVU_INITIAL = ' + JSON.stringify(initial) + ';\n\n// ===== 作者可填写区域：结束 =====') },
      { title: '作者配置·变量结构', find: '/__MVU_AUTHOR_MODEL__/', sentinel: '__MVU_AUTHOR_MODEL__', content: script(a('model.js')) },
      {
        title: 'MVU·引擎', find: '/__MVU_RUNTIME_ENGINE__/', sentinel: '__MVU_RUNTIME_ENGINE__',
        content: script([f('mvu-storage.js'), f('mvu-core.js'), f('mvu-validator.js'), f('mvu-runtime.js')].join('\n')),
      },
      { title: '作者配置·全局美化', find: '/__MVU_AUTHOR_THEME__/', sentinel: '__MVU_AUTHOR_THEME__', content: style(a('theme.css')) },
      { title: '作者配置·变量注入', find: '/__MVU_AUTHOR_INJECT__/', sentinel: '__MVU_AUTHOR_INJECT__', content: script(a('variable-inject.js')) },
      { title: '作者配置·发送处理', find: '/__MVU_AUTHOR_SEND__/', sentinel: '__MVU_AUTHOR_SEND__', content: script(a('before-send.js')) },
      { title: '作者配置·回复状态栏', find: '/{{card-status-source}}/', marker: '{{card-status-source}}', source: statusRoot, content: authorStatus },
      { title: '作者配置·舞台', find: '/{{card-stage-source}}/', marker: '{{card-stage-source}}', source: stageRoot, content: authorStage },
      { title: '作者配置·流式更新', find: '/__MVU_AUTHOR_STREAM__/', sentinel: '__MVU_AUTHOR_STREAM__', content: script(a('stream.js')) },
      { title: '作者配置·完成更新', find: '/__MVU_AUTHOR_RENDER__/', sentinel: '__MVU_AUTHOR_RENDER__', content: script(a('render.js')) },
    ],
    statusRoot,
    stageRoot,
  };
}

function pluginDefinitions(root, selected) {
  const p = name => read(root, 'src/plugins/' + name);
  const managerMarkup = sourceRoot(compactMarkup(p('mvu-manager.html')), 'mvu-manager-root');
  const definitions = {
    report: {
      title: '插件·更新报告', find: '/<变量更新>[\\s\\S]*?<\\/变量更新>/g',
      content: style(p('mvu-report.css')) + '<details class="mvu-report"><summary>正在等待更新结果</summary></details>' + script(p('mvu-view.js')),
    },
    'user-view': {
      title: '插件·玩家变量折叠', find: '/__MVU_PLUGIN_USER_VIEW__/', sentinel: '__MVU_PLUGIN_USER_VIEW__',
      content: style(p('mvu-user-view.css')) + script(p('mvu-user-view.js')),
    },
    manager: {
      title: '插件·变量管理器', find: '/{{mvu-manager}}/', marker: '{{mvu-manager}}', source: managerMarkup,
      content: managerMarkup + '\n\n' + style(p('mvu-manager.css')) + script(p('mvu-manager.js')),
    },
    prune: {
      title: '插件·旧变量清理', find: '/__MVU_PLUGIN_PRUNE__/', sentinel: '__MVU_PLUGIN_PRUNE__', content: script(p('mvu-prune.js')),
    },
  };
  return PLUGINS.filter(name => selected.includes(name)).map(name => definitions[name]);
}

function validateDefinitions(definitions, statusbar) {
  if (definitions.length > 130) throw new Error('正则条数超过 130');
  const finds = new Set();
  for (const item of definitions) {
    if (item.title.length > 20) throw new Error('正则名称超过 20 字符：' + item.title);
    if (item.find.length > 1000) throw new Error('匹配式超过 1000 字符：' + item.title);
    if (item.content.length >= 20000) throw new Error('替换内容达到 20000 字符：' + item.title);
    parseSlashRegex(item.find);
    if (finds.has(item.find)) throw new Error('重复匹配式：' + item.find);
    finds.add(item.find);
  }
  for (const item of definitions.filter(value => value.sentinel)) {
    for (const other of definitions) {
      if (other !== item && other.content.includes(item.sentinel)) throw new Error('触发标记交叉污染：' + item.sentinel + ' 出现在 ' + other.title);
    }
    if (statusbar.includes(item.sentinel)) throw new Error('脚本哨兵不能出现在 statusbar：' + item.sentinel);
  }
  for (const item of definitions.filter(value => value.marker)) {
    if (statusbar.split(item.marker).length !== 2) throw new Error('statusbar 必须恰好包含一次 ' + item.marker);
    if (!item.find.includes(item.marker)) throw new Error('可见触发标记与匹配式不一致：' + item.marker);
    for (const other of definitions) if (other !== item && other.content.includes(item.marker)) throw new Error('可见触发标记交叉污染：' + item.marker);
  }
}

function makeCard(root, selected) {
  const { definitions, statusRoot, stageRoot } = frameworkDefinitions(root);
  definitions.push(...pluginDefinitions(root, selected));
  const visible = definitions.filter(item => item.marker);
  const statusbar = visible.map(item => item.marker).join('');
  const statusSources = visible.map(item => ({ marker: item.marker, source: item.source }));
  validateDefinitions(definitions, statusbar);
  const personaTemplate = read(root, 'src/author/persona.txt');
  if (personaTemplate.split('{{VARIABLE_RULES}}').length !== 2) throw new Error('persona.txt 必须恰好包含一次 {{VARIABLE_RULES}}');
  const personality = personaTemplate.replace('{{VARIABLE_RULES}}', read(root, 'src/author/variable-rules.txt').trim()).trim();
  const beginning = read(root, 'src/author/beginning.txt').trim();
  if (statusbar.length > 200) throw new Error('statusbar 超过 200 字符');
  if (beginning.length > 4000) throw new Error('beginning 超过 4000 字符');
  if (personality.length > 10000) throw new Error('personality 超过 10000 字符');
  const regex_scripts = definitions.map((item, index) => ({ id: -1 - index, scriptName: item.title, findRegex: item.find, replaceString: item.content }));
  const card = { chatVersion: 1, pageDepth: 2, statusbar, beginning, personality, regex_scripts };
  if (JSON.stringify(Object.keys(card)) !== JSON.stringify(TOP_KEYS)) throw new Error('导入包顶层键错误');
  for (const rule of regex_scripts) if (JSON.stringify(Object.keys(rule)) !== JSON.stringify(RULE_KEYS)) throw new Error('规则键错误：' + rule.scriptName);
  return { card, statusRoot, stageRoot, statusSources };
}

function makePreview(card, statusSources) {
  const styles = card.regex_scripts.flatMap(rule => [...rule.replaceString.matchAll(/<style>([\s\S]*?)<\/style>/gi)].map(match => match[1])).join('\n');
  const scripts = card.regex_scripts.flatMap(rule => [...rule.replaceString.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]));
  let statusbar = card.statusbar;
  for (const item of statusSources) statusbar = statusbar.replace(item.marker, item.source);
  const fixture = `const handlers=new Map();window.emit=(name,msg)=>{for(const fn of handlers.get(name)||[])fn(msg)};
window.rows=[{key:'greeting',from:'ai',serverId:null,content:${JSON.stringify(card.beginning)}}];
window.previewStore={loaded:true,hasMore:false,get keys(){return rows.map(row=>row.key)},getByKey(key){return rows.find(row=>row.key===key)}};
document.documentElement.__vue_app__={_context:{provides:{pinia:{_s:new Map([['messages',previewStore]])}}}};
let stored,stageVisible=false;window.sdk={on(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn)},debug:{log(...args){console.log(...args)}},save:{get(){return stored},async set(key,value){stored=structuredClone(value)}},stage:{el(){return document.getElementById('stage')},open(){stageVisible=true;this.el().hidden=false},close(){stageVisible=false;this.el().hidden=true},visible(){return stageVisible}},input:{set(text){document.querySelector('[data-chat="input"]').value=text},get(){return document.querySelector('[data-chat="input"]').value},clear(){document.querySelector('[data-chat="input"]').value=''}},message:{async edit(){},async send(){}}};`;
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>通用 MVU 本地预览</title><style>:root{--rpx:1px}body{margin:0}[data-chat="root"]{min-height:100vh;padding-bottom:72px}[data-chat="message-body"]{margin:16px;padding:14px;white-space:pre-line}#stage{position:fixed;inset:0;z-index:3000}[data-chat="composer"]{position:fixed;inset:auto 0 0;display:flex;padding:10px}textarea{flex:1}' + styles + '</style><div data-chat="root" data-theme="dark"><header data-chat="header">通用 MVU 本地预览</header><div data-slot="statusbar">' + statusbar + '</div><main data-chat="messages"><article data-chat="message" data-from="ai"><div data-chat="message-body">' + escapeHtml(card.beginning) + '</div></article></main><div data-slot="right"></div><div id="stage" hidden></div><footer data-chat="composer"><textarea data-chat="input"></textarea><button data-chat="send">发送</button></footer></div><script>' + fixture + '</script>' + scripts.map(value => '<script>' + value + '</script>').join('') + '<script>emit("message:mount",{role:"ai",id:"greeting",serverId:null,content:rows[0].content});emit("message:done",{role:"ai",id:"greeting",serverId:null,content:rows[0].content});emit("ready")</script></html>';
}

function serializeJson(value) {
  return JSON.stringify(value, null, 2).replace(/<\/script>/gi, '<\\/script>') + '\n';
}

function buildProject({ root, plugins, outDir }) {
  const selected = strictConfig({ plugins });
  const { card, statusSources } = makeCard(root, selected);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mvu-regex.json'), serializeJson(card));
  fs.writeFileSync(path.join(outDir, 'mvu-persona.txt'), card.personality + '\n');
  fs.writeFileSync(path.join(outDir, 'mvu-preview.html'), makePreview(card, statusSources));
  return card;
}

function readConfig(root) {
  return strictConfig(JSON.parse(read(root, 'mvu.config.json')));
}

module.exports = { PLUGINS, TOP_KEYS, RULE_KEYS, strictConfig, parseSlashRegex, makeCard, buildProject, readConfig };
