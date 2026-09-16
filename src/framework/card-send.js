(function () {
  if (window.__cardSend) return;
  window.__cardSend = true;
  let stopped = false;

  function prepare(draft) {
    if (stopped) throw new Error('发送处理已停止');
    if (typeof draft !== 'string') throw new Error('发送正文必须是字符串');
    if (typeof CARD_AUTHOR.beforeSend !== 'function') throw new Error('作者 beforeSend 入口无效');
    const content = CARD_AUTHOR.beforeSend(draft);
    if (typeof content !== 'string') throw new Error('发送前处理必须同步返回字符串');
    if (content.trim() === '') throw new Error('发送前处理结果不能为空');
    return content;
  }

  function onClick(event) {
    if (!event.target.closest('[data-chat="send"]')) return;
    const draft = sdk.input.get();
    if (draft.trim() === '') return;
    try {
      sdk.input.set(prepare(draft));
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sdk.debug.log('卡片发送未执行', error.message);
    }
  }

  CARD_INTERNAL.send = Object.freeze({ prepare });
  document.addEventListener('click', onClick, true);
  sdk.on('dispose', function () {
    stopped = true;
    document.removeEventListener('click', onClick, true);
  });
})();
