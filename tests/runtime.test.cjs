const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixture = require('./fixtures/model-fixture.cjs');

const root = path.resolve(__dirname, '..');

function context() {
  const value = { console, JSON, Math, Number, Object, Array, String, Boolean, RegExp, Error, TypeError, structuredClone, crypto: { randomUUID: () => 'test-slot' } };
  value.window = value;
  vm.createContext(value);
  return value;
}

function run(value, file) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src/framework', file), 'utf8'), value, { filename: file });
}

test('JSON Pointer 四类操作按顺序执行且不修改原值', () => {
  const ctx = context();
  run(ctx, 'mvu-json.js');
  const initial = { count: 1, object: { old: 'x' }, list: [1] };
  const result = ctx.MvuJson.apply(initial, [
    { op: 'replace', path: '/object/old', value: 'y' },
    { op: 'delta', path: '/count', value: 2 },
    { op: 'insert', path: '/object/new', value: true },
    { op: 'remove', path: '/list/0' },
  ]);
  assert.deepEqual(result, { count: 3, object: { old: 'y', new: true }, list: [] });
  assert.deepEqual(initial, { count: 1, object: { old: 'x' }, list: [1] });
});

test('派生先于严格校验，失败时诊断整批回滚', () => {
  const ctx = context();
  run(ctx, 'mvu-json.js');
  const prepared = ctx.MvuJson.prepare({ counter: 3, _double: 0 }, fixture.derive, { source: 'player', round: 1, replyId: null }, fixture.validate);
  assert.deepEqual(prepared.snapshot, { counter: 3, _double: 6 });
  const parsed = { operations: [{ op: 'insert', path: '/extra', value: true }], block: 'x' };
  const result = ctx.MvuJson.diagnose(fixture.initial, parsed, null, fixture.derive, { source: 'ai', round: 1, replyId: 'a1' }, fixture.validate);
  assert.equal(result.report.status, 'error');
  assert.deepEqual(result.snapshot, fixture.initial);
});

test('MVU 建立逐回复快照、回溯并清空会话状态', async () => {
  const ctx = context();
  run(ctx, 'mvu-json.js');
  run(ctx, 'mvu-storage.js');
  run(ctx, 'mvu-core.js');
  let rows = [{ id: 'greeting', role: 'ai', serverId: null, content: '开始' }];
  let stored;
  const changes = [];
  const mvu = ctx.createMvu({
    initial: fixture.initial,
    readMessages: () => ({ loaded: true, hasMore: false, messages: rows }),
    load: () => stored,
    save: async value => { stored = structuredClone(value); },
    changed: value => changes.push(value),
    report: () => {},
    validate: fixture.validate,
    validationStatus: () => '',
    derive: fixture.derive,
  });
  mvu.sync();
  assert.deepEqual(mvu.getCurrent(), fixture.initial);
  rows = rows.concat(
    { id: 'u1', role: 'user', serverId: 'u1', content: '增加' },
    { id: 'a1', role: 'ai', serverId: 'a1', content: '正文<变量更新>[{"op":"delta","path":"/counter","value":2}]</变量更新>' },
  );
  mvu.sync();
  assert.deepEqual(mvu.getReplySnapshot({ role: 'ai', serverId: 'a1' }), { counter: 2, _double: 4 });
  rows = rows.concat(
    { id: 'u2', role: 'user', serverId: 'u2', content: '再增加' },
    { id: 'a2', role: 'ai', serverId: 'a2', content: '正文<变量更新>[{"op":"delta","path":"/counter","value":3}]</变量更新>' },
  );
  mvu.sync();
  assert.deepEqual(mvu.getCurrent(), { counter: 5, _double: 10 });
  rows = rows.slice(0, 3);
  mvu.sync();
  assert.deepEqual(mvu.getCurrent(), { counter: 2, _double: 4 });
  mvu.switchConversation();
  assert.equal(mvu.info().ready, false);
  assert.ok(changes.length > 0);
  await new Promise(resolve => setImmediate(resolve));
});

test('存档写入串行执行并只保留等待中的最新值', async () => {
  const ctx = context();
  run(ctx, 'mvu-storage.js');
  const values = [];
  let active = 0;
  let maximum = 0;
  const writer = ctx.createMvuWriter(async value => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    values.push(value.number);
    active--;
  }, error => assert.equal(error, null));
  writer.write({ number: 1 });
  writer.write({ number: 2 });
  writer.write({ number: 3 });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(maximum, 1);
  assert.deepEqual(values, [1, 3]);
});

test('作者消息接口按角色与已加载列表索引读取且只暴露 at', () => {
  const ctx = context();
  const rows = [
    { key: 'greeting', serverId: null, from: 'ai', content: '开始' },
    { key: 'u1', serverId: '10', from: 'user', content: '继续' },
    { key: 'a1', serverId: '11', from: 'ai', content: '回复' },
  ];
  const store = {
    loaded: true,
    hasMore: false,
    keys: rows.map(row => row.key),
    getByKey: key => rows.find(row => row.key === key),
  };
  const StoreMap = vm.runInContext('Map', ctx);
  const app = {};
  Object.defineProperty(app, '__vue_app__', {
    value: { _context: { provides: { pinia: { _s: new StoreMap([['messages', store]]) } } } },
  });
  ctx.document = {
    documentElement: app,
    createTreeWalker: () => ({ nextNode: () => null }),
    dispatchEvent() {},
  };
  ctx.NodeFilter = { SHOW_ELEMENT: 1 };
  ctx.Event = function Event() {};
  ctx.setInterval = () => 1;
  ctx.clearInterval = () => {};
  ctx.requestAnimationFrame = () => 1;
  ctx.cancelAnimationFrame = () => {};
  ctx.sdk = { on() {}, debug: { log() {} } };
  run(ctx, 'card-core.js');
  run(ctx, 'message-reader.js');

  assert.deepEqual(Object.keys(ctx.CARD.messages), ['at']);
  assert.deepEqual({ ...ctx.CARD.messages.at(0, 'ai') }, { id: 'greeting', serverId: null, role: 'ai', content: '开始' });
  assert.deepEqual({ ...ctx.CARD.messages.at(-1, 'ai') }, { id: 'a1', serverId: '11', role: 'ai', content: '回复' });
  assert.deepEqual({ ...ctx.CARD.messages.at(0, 'user') }, { id: 'u1', serverId: '10', role: 'user', content: '继续' });
  assert.equal(ctx.CARD.messages.at(2, 'ai'), null);
  assert.equal(ctx.CARD.messages.at(-2, 'user'), null);
  assert.throws(() => ctx.CARD.messages.at(1.5, 'ai'), /消息索引必须是整数/);
  assert.throws(() => ctx.CARD.messages.at(0, 'other'), /消息角色必须是 ai 或 user/);
  const copy = ctx.CARD.messages.at(0, 'ai');
  copy.content = '修改';
  assert.equal(ctx.CARD.messages.at(0, 'ai').content, '开始');
  assert.equal(typeof ctx.CARD_INTERNAL.messages.get, 'function');
  assert.equal(typeof ctx.CARD_INTERNAL.messages.snapshot, 'function');
  assert.equal(typeof ctx.CARD_INTERNAL.messages.watchReply, 'function');
});

test('作者变量接口按 AI 消息索引读取回复快照', () => {
  const ctx = context();
  const messages = [
    { role: 'ai', serverId: null, snapshot: { count: 0 } },
    { role: 'user', serverId: '10' },
    { role: 'ai', serverId: '11', snapshot: { count: 1 } },
    { role: 'ai', serverId: '12', failed: true },
  ];
  ctx.CARD = {
    messages: {
      at(index, role) {
        assert.equal(role, 'ai');
        return messages.filter(message => message.role === role).at(index) || null;
      },
    },
  };
  ctx.CARD_INTERNAL = {};
  ctx.document = { dispatchEvent() {} };
  ctx.CustomEvent = function CustomEvent() {};
  run(ctx, 'card-variables.js');
  ctx.CARD_INTERNAL.variables.provide({
    current: () => ({ count: 1 }),
    reply(message) {
      if (message.role !== 'ai') throw new Error('需要 AI 回复消息');
      if (message.failed) throw new Error('本轮更新未生效');
      return message.snapshot;
    },
  });

  assert.deepEqual(Object.keys(ctx.CARD.variables), ['current', 'reply']);
  assert.deepEqual(ctx.CARD.variables.reply(0), { count: 0 });
  assert.deepEqual(ctx.CARD.variables.reply(1), { count: 1 });
  assert.deepEqual(ctx.CARD.variables.reply(-2), { count: 1 });
  assert.throws(() => ctx.CARD.variables.reply(2), /本轮更新未生效/);
  assert.throws(() => ctx.CARD.variables.reply(3), /消息索引不存在/);
  const current = ctx.CARD.variables.current();
  current.count = 9;
  assert.deepEqual(ctx.CARD.variables.current(), { count: 1 });
});

test('发送注入先处理草稿，再追加唯一变量块', () => {
  const ctx = context();
  ctx.document = { addEventListener() {}, removeEventListener() {} };
  ctx.sdk = { on() {}, input: { get() { return ''; }, set() {} }, debug: { log() {} } };
  ctx.CARD = { variables: { current: () => ({ count: 2 }) } };
  ctx.CARD_INTERNAL = { variables: { available: () => true } };
  ctx.CARD_AUTHOR = { inject: {} };
  run(ctx, 'card-yaml.js');
  ctx.CARD_AUTHOR.inject.variables = variables => ctx.CARD.yaml.stringify(variables);
  ctx.CARD_AUTHOR.inject.beforeSend = draft => '处理：' + draft;
  run(ctx, 'card-inject.js');
  assert.equal(ctx.CARD_INTERNAL.inject.prepare('正文'), '处理：正文\n[当前变量]\ncount: 2\n[/当前变量]');
  assert.equal(ctx.CARD_INTERNAL.inject.prepare('正文\n[当前变量]\ncount: 1\n[/当前变量]'), '处理：正文\n[当前变量]\ncount: 2\n[/当前变量]');
  ctx.CARD_AUTHOR.inject.beforeSend = () => '[当前变量]';
  assert.throws(() => ctx.CARD_INTERNAL.inject.prepare('正文'), /不能包含保留标记/);
});

test('状态栏在空气泡和生成占位期间保持隐藏', () => {
  const ctx = context();
  const handlers = new Map();
  const documentHandlers = new Map();
  const roots = [];
  const template = {
    textContent: '状态', attributes: [],
    querySelectorAll: () => [],
    cloneNode() {
      const root = { textContent: '状态', attributes: [], querySelectorAll: () => [] };
      roots.push(root);
      return root;
    }
  };
  const source = { children: [template], firstElementChild: template };
  const bar = { querySelector: selector => selector === '.card-status-source' ? source : null };
  let host;
  const body = {
    querySelector: selector => selector === '.card-status-host' ? host : null,
    append(value) { host = value; host.isConnected = true; }
  };
  ctx.document = {
    querySelector(selector) {
      if (selector === '[data-slot="statusbar"]') return bar;
      if (selector === '[data-chat="message-body"]') return body;
      return null;
    },
    createElement() {
      return {
        hidden: false, isConnected: false, children: [],
        append(value) { this.children.push(value); },
        remove() { this.isConnected = false; },
      };
    },
    addEventListener: (name, listener) => documentHandlers.set(name, listener),
    removeEventListener() {}
  };
  ctx.sdk = {
    on(name, listener) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(listener); },
    debug: { log() {} }
  };
  let variableRetry = false;
  ctx.CARD_INTERNAL = { variables: {
    available: () => true,
    resolve() {
      if (!variableRetry) {
        variableRetry = true;
        documentHandlers.get('card:variables')();
      }
    }
  } };
  const rendered = [];
  ctx.CARD_AUTHOR = { status: { render(root, payload) { rendered.push(payload.content); root.textContent = payload.content; } } };
  run(ctx, 'card-status.js');
  const emit = (name, payload) => handlers.get(name).forEach(listener => listener(payload));

  emit('message:mount', { role: 'ai', id: 'a1', serverId: '1', content: '' });
  assert.equal(host.hidden, true);
  documentHandlers.get('card:variables')();
  assert.deepEqual(rendered, []);
  emit('message:mount', { role: 'ai', id: 'a1', serverId: '1', content: '消息生成中' });
  documentHandlers.get('card:variables')();
  assert.equal(host.hidden, true);
  assert.deepEqual(rendered, []);

  emit('message:done', { role: 'ai', id: 'a1', serverId: '1', content: '正式回复' });
  assert.equal(host.hidden, false);
  assert.equal(roots[0].textContent, '正式回复');
  assert.deepEqual(rendered, ['正式回复']);
  documentHandlers.get('card:variables')();
  assert.deepEqual(rendered, ['正式回复']);
});

function stageContext(authorStage) {
  const handlers = new Map();
  let visible = false;
  let mounted;
  const roots = [];
  const template = {
    cloneNode() {
      const value = {
        isConnected: false,
        remove() { this.isConnected = false; if (mounted === this) mounted = undefined; },
      };
      roots.push(value);
      return value;
    },
  };
  const source = { children: [template], firstElementChild: template };
  const stage = {
    replaceChildren(value) { mounted = value; value.isConnected = true; },
  };
  const ctx = context();
  ctx.CARD = {};
  ctx.CARD_AUTHOR = authorStage === undefined ? {} : { stage: authorStage };
  ctx.document = { querySelector: selector => selector === '[data-slot="statusbar"]' ? { querySelector: () => source } : null };
  ctx.sdk = {
    stage: {
      el: () => stage,
      open: () => { visible = true; },
      close: () => { visible = false; },
      visible: () => visible,
    },
    on(name, listener) { handlers.set(name, listener); },
  };
  return { ctx, handlers, roots, mounted: () => mounted, visible: () => visible };
}

test('舞台根在首次消息挂载时初始化一次，切换会话后重新初始化', () => {
  const rendered = [];
  const fixture = stageContext({ render(root) { assert.equal(root.isConnected, true); rendered.push(root); } });
  run(fixture.ctx, 'card-stage.js');
  assert.equal(fixture.ctx.CARD.stage, undefined);
  assert.equal(fixture.mounted(), undefined);
  fixture.handlers.get('message:mount')();
  const first = fixture.mounted();
  fixture.handlers.get('message:mount')();
  assert.deepEqual(rendered, [first]);
  assert.equal(fixture.visible(), false);
  fixture.handlers.get('conversation:switch')();
  assert.equal(fixture.mounted(), undefined);
  fixture.handlers.get('message:mount')();
  const second = fixture.mounted();
  assert.notEqual(second, first);
  assert.deepEqual(rendered, [first, second]);
});

test('舞台初始化入口无效或作者抛错时直接失败且不打开', () => {
  const missing = stageContext();
  run(missing.ctx, 'card-stage.js');
  assert.throws(() => missing.handlers.get('message:mount')(), /作者舞台入口无效/);
  assert.equal(missing.mounted(), undefined);
  assert.equal(missing.visible(), false);

  const failed = stageContext({ render() { throw new Error('作者错误'); } });
  run(failed.ctx, 'card-stage.js');
  assert.throws(() => failed.handlers.get('message:mount')(), /作者错误/);
  assert.ok(failed.mounted());
  assert.equal(failed.visible(), false);
});
