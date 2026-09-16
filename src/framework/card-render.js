(function () {
  if (window.__cardRender) return;
  window.__cardRender = true;
  let stop;

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
    call('render', { content: message.content, message: { ...message } });
  }

  function start() {
    if (!stop) stop = CARD_INTERNAL.messages.watchReply({ stream, reply: render });
  }

  sdk.on('message:mount', start);
  sdk.on('dispose', function () {
    if (stop) stop();
  });
})();
