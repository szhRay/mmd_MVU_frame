const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PLUGINS, TOP_KEYS, RULE_KEYS, strictConfig, parseSlashRegex, makeCard, buildProject, readConfig } = require('../scripts/build-lib.cjs');

const root = path.resolve(__dirname, '..');

test('无插件基础包包含三条运行时和九条作者规则', () => {
  const { card } = makeCard(root, []);
  assert.equal(card.regex_scripts.length, 12);
  assert.deepEqual(card.regex_scripts.filter(rule => rule.scriptName.startsWith('框架·') || rule.scriptName === 'MVU·引擎').map(rule => rule.scriptName), ['框架·基础', '框架·界面与操作', 'MVU·引擎']);
  assert.equal(card.regex_scripts.filter(rule => rule.scriptName.startsWith('作者配置·')).length, 9);
  for (const rule of card.regex_scripts.filter(rule => rule.scriptName.startsWith('作者配置·'))) {
    assert.match(rule.replaceString, /作者可填写区域/, rule.scriptName);
  }
});

test('项目默认配置启用三个推荐插件并构建十五条规则', () => {
  const plugins = readConfig(root);
  assert.deepEqual(plugins, ['report', 'user-view', 'prune']);
  assert.equal(plugins.includes('manager'), false);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generic-mvu-default-'));
  const card = buildProject({ root, plugins, outDir });
  assert.equal(card.regex_scripts.length, 15);
  assert.deepEqual(card.regex_scripts.slice(-3).map(rule => rule.scriptName), ['插件·更新报告', '插件·玩家变量折叠', '插件·旧变量清理']);
});

test('推荐插件加入变量管理器后包含十六条规则', () => {
  const { card } = makeCard(root, [...readConfig(root), 'manager']);
  assert.equal(card.regex_scripts.length, 16);
  assert.deepEqual(card.regex_scripts.slice(-4).map(rule => rule.scriptName), ['插件·更新报告', '插件·玩家变量折叠', '插件·变量管理器', '插件·旧变量清理']);
});

test('导入结构、长度、ID和正则全部严格合法', () => {
  const { card } = makeCard(root, PLUGINS);
  assert.deepEqual(Object.keys(card), TOP_KEYS);
  card.regex_scripts.forEach((rule, index) => {
    assert.deepEqual(Object.keys(rule), RULE_KEYS);
    assert.equal(rule.id, -1 - index);
    assert.ok(rule.scriptName.length <= 20);
    assert.ok(rule.findRegex.length <= 1000);
    assert.ok(rule.replaceString.length < 20000);
    parseSlashRegex(rule.findRegex);
    for (const match of rule.replaceString.matchAll(/<script>([\s\S]*?)<\/script>/gi)) assert.doesNotThrow(() => new Function(match[1]), rule.scriptName);
  });
  assert.equal(new Set(card.regex_scripts.map(rule => rule.findRegex)).size, card.regex_scripts.length);
});

test('默认 persona 嵌入紧凑中文变量规则且不含酒馆专用协议', () => {
  const rules = fs.readFileSync(path.join(root, 'src/author/variable-rules.txt'), 'utf8').trim();
  const { card } = makeCard(root, []);
  assert.ok(card.personality.includes(rules));
  assert.ok(card.personality.length <= 10000);
  assert.equal((card.personality.match(/<变量含义与更新规则>/g) || []).length, 1);
  assert.match(rules, /\n规则: \{\}\n/);
  for (const key of ['类型', '范围', '格式', '取值', '分段', '说明', '更新']) assert.ok(rules.includes(key), key);
  assert.doesNotMatch(rules, /(^|\n)\s*(?:type|range|format|check|value):/m);
  for (const token of ['<UpdateVariable>', '<Analysis>', '<JSONPatch>', 'format_message_variable', '"op":"add"']) assert.equal(card.personality.includes(token), false, token);
  assert.match(card.personality, /不输出分析过程/);
});

test('模板根唯一且默认产物不含原实例', () => {
  const { card, statusRoot, stageRoot } = makeCard(root, []);
  assert.equal((statusRoot.match(/class="card-status-source"/g) || []).length, 1);
  assert.equal((stageRoot.match(/class="card-stage-source"/g) || []).length, 1);
  const text = JSON.stringify(card);
  for (const token of ['异世界', '生命值', '累计经验', '金币', '装备', '技能', '道具', 'npc_001', 'quest_001', '边境地区', '冒险者公会']) assert.equal(text.includes(token), false, token);
});

test('状态栏和舞台作者规则按 HTML、CSS、JS 排列', () => {
  const { card } = makeCard(root, []);
  for (const name of ['作者配置·回复状态栏', '作者配置·舞台']) {
    const content = card.regex_scripts.find(rule => rule.scriptName === name).replaceString;
    assert.ok(content.indexOf('<div') < content.indexOf('<style>'), name);
    assert.ok(content.indexOf('<style>') < content.indexOf('<script>'), name);
  }
  const stage = card.regex_scripts.find(rule => rule.scriptName === '作者配置·舞台').replaceString;
  const status = card.regex_scripts.find(rule => rule.scriptName === '作者配置·回复状态栏').replaceString;
  assert.match(status, /class="card-status-source"/);
  assert.match(status, /CARD_AUTHOR\.status/);
  assert.doesNotMatch(status, /card-chrome-root|CARD_AUTHOR\.chrome/);
  assert.match(stage, /CARD_AUTHOR\.stage/);
  assert.match(stage, /render\(root\)/);
});

test('正式包只暴露作者索引接口且不包含 CARD.stage', () => {
  const text = JSON.stringify(makeCard(root, PLUGINS).card);
  assert.match(text, /CARD\.messages = Object\.freeze\(\{ at \}\)/);
  assert.match(text, /CARD\.variables = Object\.freeze/);
  assert.doesNotMatch(text, /CARD\.messages\.(?:get|snapshot|watchReply)/);
  assert.doesNotMatch(text, /CARD\.variables\.(?:available|provide|changed)/);
  assert.doesNotMatch(text, /CARD\.inject/);
  assert.doesNotMatch(text, /CARD\.stage/);
});

test('配置拒绝未知键、未知插件和重复插件', () => {
  assert.throws(() => strictConfig({ plugins: [], mode: 'x' }), /顶层必须恰好/);
  assert.throws(() => strictConfig({ plugins: ['other'] }), /未知插件/);
  assert.throws(() => strictConfig({ plugins: ['report', 'report'] }), /不能重复/);
  assert.throws(() => parseSlashRegex('plain'), /必须使用/);
  assert.throws(() => parseSlashRegex('/(?:)/'), /不能命中空串/);
});

test('构建文件保持 JSON 中的安全 script 闭合写法', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generic-mvu-'));
  buildProject({ root, plugins: [], outDir });
  const raw = fs.readFileSync(path.join(outDir, 'mvu-regex.json'), 'utf8');
  assert.equal(raw.includes('</script>'), false);
  assert.equal(raw.includes('<\\/script>'), true);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.regex_scripts.length, 12);
});
