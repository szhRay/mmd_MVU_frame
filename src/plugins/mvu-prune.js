(function () {
  const keep = 3; // 作者配置：保留最近几条玩家消息中的当前变量。
  let stopped = false;
  let slot = null;
  let round = 0;

  function removeVariables(content) {
    const start = content.lastIndexOf('\n[当前变量]');
    if (start < 0) return null;
    const block = content.slice(start);
    if (!/^\n\[当前变量\](?:(?!\[\/?当前变量\])[\s\S])*\[\/当前变量\]\s*$/.test(block)) return null;
    return content.slice(0, start);
  }

  // 触发契约：业务触发走 card:variables + MVU.info()，不监听消息时序事件。
  // slotId 变化=新会话只立基线；round 回退=回溯只跟随；round 增加=新一轮已提交。
  document.addEventListener('card:variables', function () {
    if (stopped) return;
    try {
      const info = MVU.info();
      if (!info.ready) return;
      if (info.slotId !== slot) { slot = info.slotId; round = info.round; return; }
      if (info.round <= round) { round = info.round; return; }
      round = info.round;
      const users = CARD_INTERNAL.messages.snapshot().messages.filter(row => row.role === 'user');
      const target = users[users.length - 1 - keep];
      if (!target || target.serverId == null) return;
      const content = removeVariables(target.content);
      if (content === null) return;
      sdk.message.edit(target.id, content).catch(function (error) {
        sdk.debug.log('旧变量清理失败', error.code, error.message);
      });
    } catch (error) {
      sdk.debug.log('旧变量清理失败', error.code, error.message);
    }
  });

  sdk.on('dispose', function () { stopped = true; });
})();
