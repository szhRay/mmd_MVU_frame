(function () {
  if (window.__cardStatus) return;
  window.__cardStatus = true;
  const bindings = new Map();
  const blockedAttributes = new Set(['href', 'src', 'srcset', 'action', 'formaction']);
  const blockedParts = new Set(['__proto__', 'prototype', 'constructor']);
  const tokenSource = '\\[\\[([^\\[\\]]+)\\]\\]';
  let disposed = false;

  function isReplyText(value) {
    const text = String(value == null ? '' : value).trim();
    return text !== '' && !text.startsWith('消息生成') && text !== '……';
  }

  function source() {
    const bar = document.querySelector('[data-slot="statusbar"]');
    const node = bar && bar.querySelector('.card-status-source');
    if (!node || node.children.length !== 1) throw new Error('状态栏源需要唯一根元素');
    return node;
  }

  function valueAt(variables, path) {
    const parts = path.split('.');
    if (!parts.length || parts.some(part => !part || blockedParts.has(part))) throw new Error('无效变量路径：' + path);
    let value = variables;
    for (const part of parts) {
      if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) {
        throw new Error('变量路径不存在：' + path);
      }
      value = value[part];
    }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('变量不是有限数字：' + path);
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error('状态栏变量必须是标量：' + path);
    return String(value);
  }

  function prepare(root, variables) {
    const changes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      if (!new RegExp(tokenSource).test(text.nodeValue)) continue;
      if (['STYLE', 'SCRIPT'].includes(text.parentElement && text.parentElement.tagName)) throw new Error('变量占位符不能写在 style 或 script 中');
      const node = text;
      const value = node.nodeValue.replace(new RegExp(tokenSource, 'g'), (_, path) => valueAt(variables, path.trim()));
      changes.push(() => { node.nodeValue = value; });
    }
    for (const element of [root, ...root.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        if (!new RegExp(tokenSource).test(attribute.value)) continue;
        const name = attribute.name.toLowerCase();
        if (name.startsWith('on') || blockedAttributes.has(name)) throw new Error('变量占位符不能写在属性：' + attribute.name);
        const value = attribute.value.replace(new RegExp(tokenSource, 'g'), (_, path) => valueAt(variables, path.trim()));
        changes.push(() => { element.setAttribute(attribute.name, value); });
      }
    }
    return changes;
  }

  function show(binding) {
    if (!binding.complete || binding.rendering || binding.ready || disposed) return;
    binding.rendering = true;
    try {
      const author = CARD_AUTHOR.status;
      if (!author || typeof author.render !== 'function') throw new Error('作者状态栏入口无效');
      const hasTokens = new RegExp(tokenSource).test(binding.root.textContent) ||
        [binding.root, ...binding.root.querySelectorAll('*')].some(element => [...element.attributes].some(attribute => new RegExp(tokenSource).test(attribute.value)));
      let variables;
      if (CARD_INTERNAL.variables.available()) variables = CARD_INTERNAL.variables.resolve(binding.message);
      else if (hasTokens) throw new Error('状态栏使用了变量占位符，但未注册变量提供器');
      const changes = variables === undefined ? [] : prepare(binding.root, variables);
      changes.forEach(change => change());
      const payload = { content: binding.message.content, message: { ...binding.message } };
      if (variables !== undefined) payload.variables = variables;
      author.render(binding.root, payload);
      binding.host.hidden = false;
      binding.ready = true;
      binding.error = '';
    } catch (error) {
      if (binding.error === error.message) return;
      binding.error = error.message;
      sdk.debug.log('卡片状态栏', error.message);
    } finally {
      binding.rendering = false;
    }
  }

  function binding(message) {
    if (disposed || !message || message.role !== 'ai') return;
    const body = document.querySelector('[data-chat="message-body"]');
    if (!body) return;
    let host = body.querySelector('.card-status-host');
    if (!host) {
      const root = source().firstElementChild.cloneNode(true);
      host = document.createElement('div');
      host.className = 'card-status-host';
      host.hidden = true;
      host.append(root);
      body.append(host);
      bindings.set(host, { host, root, message: { ...message }, complete: false, rendering: false, ready: false, error: '' });
    }
    return bindings.get(host);
  }

  function done(message) {
    if (!message || message.role !== 'ai' || !isReplyText(message.content)) return;
    const value = binding(message);
    if (!value) return;
    value.message = { ...message };
    value.complete = true;
    show(value);
  }

  function retry() {
    for (const [host, binding] of bindings) {
      if (!host.isConnected) bindings.delete(host);
      else show(binding);
    }
  }

  function prune() {
    for (const host of bindings.keys()) if (!host.isConnected) bindings.delete(host);
  }

  function reset() {
    for (const host of bindings.keys()) host.remove();
    bindings.clear();
  }

  sdk.on('message:mount', binding);
  sdk.on('message:done', done);
  sdk.on('message:unmount', () => requestAnimationFrame(prune));
  sdk.on('conversation:switch', reset);
  document.addEventListener('card:variables', retry);
  sdk.on('dispose', function () {
    disposed = true;
    bindings.clear();
    document.removeEventListener('card:variables', retry);
  });
})();
