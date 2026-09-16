(function () {
  const keep = 3; // 作者配置：保留最近几条玩家消息中的当前变量。
  const variableSuffix = /\n\[当前变量\](?:(?!\[\/?当前变量\])[\s\S])*\[\/当前变量\]\s*$/;
  let stopped = false;

  function removeVariables(content) {
    const start = content.lastIndexOf('\n[当前变量]');
    if (start < 0) return null;
    const block = content.slice(start);
    if (!/^\n\[当前变量\](?:(?!\[\/?当前变量\])[\s\S])*\[\/当前变量\]\s*$/.test(block)) return null;
    return content.slice(0, start);
  }

  function beforeSend(event) {
    if (stopped || !event.target.closest('[data-chat="send"]') || !variableSuffix.test(sdk.input.get())) return;
    try {
      const users = CARD_INTERNAL.messages.snapshot().messages.filter(row => row.role === 'user');
      const target = users[users.length - keep];
      if (!target || target.serverId == null) return;
      const content = removeVariables(target.content);
      if (content === null) return;
      sdk.message.edit(target.id, content).catch(function (error) {
        sdk.debug.log('旧变量清理失败', error.code, error.message);
      });
    } catch (error) {
      sdk.debug.log('旧变量清理失败', error.code, error.message);
    }
  }

  function dispose() {
    stopped = true;
    document.removeEventListener('click', beforeSend, true);
  }

  document.addEventListener('click', beforeSend, true);
  sdk.on('dispose', dispose);
})();
