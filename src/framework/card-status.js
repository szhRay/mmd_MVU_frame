(function () {
  if (window.__cardStatus) return;
  window.__cardStatus = true;
  const bindings = new Map();
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

  function show(binding) {
    if (!binding.complete || binding.ready || disposed) return;
    try {
      const author = CARD_AUTHOR.status;
      if (!author || typeof author.render !== 'function') throw new Error('作者状态栏入口无效');
      author.render(binding.root, { content: binding.message.content, message: { ...binding.message } });
      binding.host.hidden = false;
      binding.ready = true;
      binding.error = '';
    } catch (error) {
      if (binding.error === error.message) return;
      binding.error = error.message;
      sdk.debug.log('卡片状态栏', error.message);
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
      bindings.set(host, { host, root, message: { ...message }, complete: false, ready: false, error: '' });
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
  sdk.on('dispose', function () {
    disposed = true;
    bindings.clear();
  });
})();
