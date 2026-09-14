(function () {
  if (window.__cardRender) return;
  window.__cardRender = true;
  let stop;
  let pending;

  function call(name, payload) {
    try {
      const author = CARD_AUTHOR[name];
      if (typeof author !== 'function') throw new Error('作者 ' + name + ' 入口无效');
      author(payload);
    } catch (error) {
      sdk.debug.log('卡片界面更新', error.message);
    }
  }

  function stream(message) {
    call('stream', { content: message.content, message: { ...message } });
  }

  function render(message) {
    pending = { ...message };
    const payload = { content: message.content, message: { ...message } };
    try {
      if (!CARD_INTERNAL.variables.available()) return;
      try { payload.variables = CARD_INTERNAL.variables.resolve(message); }
      catch (error) {
        payload.variables = CARD.variables.current();
        payload.variableError = error.message;
      }
    } catch (error) {
      sdk.debug.log('卡片界面更新', error.message);
      return;
    }
    call('render', payload);
    pending = undefined;
  }

  function start() {
    if (!stop) stop = CARD_INTERNAL.messages.watchReply({ stream, reply: render });
  }

  function retry() {
    if (pending) render(pending);
  }

  sdk.on('message:mount', start);
  document.addEventListener('card:variables', retry);
  sdk.on('conversation:switch', function () { pending = undefined; });
  sdk.on('dispose', function () {
    if (stop) stop();
    document.removeEventListener('card:variables', retry);
    pending = undefined;
  });
})();
