(function () {
  if (window.__cardInject) return;
  window.__cardInject = true;
  const markers = ['[当前变量]', '[/当前变量]'];
  const variableSuffix = /\n?\[当前变量\]\n(?:(?!\[\/?当前变量\])[\s\S])*?\n\[\/当前变量\]\s*$/;
  let stopped = false;

  function authorText(name, value) {
    if (typeof value !== 'string') throw new Error(name + '必须同步返回字符串');
    if (markers.some(marker => value.includes(marker))) throw new Error(name + '不能包含保留标记');
    return value;
  }

  function author() {
    if (stopped) throw new Error('注入器已停止');
    const value = CARD_AUTHOR.inject;
    if (!value || typeof value.variables !== 'function' || typeof value.beforeSend !== 'function') {
      throw new Error('作者注入入口无效');
    }
    return value;
  }

  function variableBlock() {
    let variables;
    try {
      const current = CARD_INTERNAL.variables.available() ? CARD.variables.current() : undefined;
      variables = authorText('变量注入', author().variables(current));
    } catch (error) {
      throw new Error('变量注入生成失败：' + error.message);
    }
    return '[当前变量]\n' + variables + '\n[/当前变量]';
  }

  function prepare(draft) {
    if (typeof draft !== 'string') throw new Error('发送正文必须是字符串');
    let content;
    try { content = authorText('发送前处理', author().beforeSend(draft.replace(variableSuffix, ''))); }
    catch (error) { throw new Error('发送前处理失败：' + error.message); }
    if (content.trim() === '') throw new Error('发送前处理结果不能为空');
    return content + '\n' + variableBlock();
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

  function onKey(event) {
    if (event.target.matches('[data-chat="input"]') && event.key === 'Enter') event.stopImmediatePropagation();
  }

  CARD_INTERNAL.inject = Object.freeze({ prepare, variableBlock });
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  sdk.on('dispose', function () {
    stopped = true;
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
  });
})();
