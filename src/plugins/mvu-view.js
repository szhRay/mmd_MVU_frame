(function () {
  if (window.__mvuReport) return;
  window.__mvuReport = true;
  const bubbles = new Map();
  let stopped = false;
  const make = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function show(node, entry) {
    if (stopped) return;
    const row = CARD_INTERNAL.messages.get(entry.id);
    const id = entry.serverId == null ? row && row.serverId : entry.serverId;
    let report = null;
    if (id != null) {
      try { report = MVU.getReplyReport(id); }
      catch { /* The reply has not acquired a saved report yet. */ }
    }
    const latest = id != null && String(MVU.info().replyId) === String(id);
    const identity = JSON.stringify([report, latest]);
    if (entry.identity === identity) return;
    entry.identity = identity;
    const wasOpen = node.open;
    const summary = make('summary');
    node.replaceChildren(summary);
    node.open = wasOpen;
    node.className = 'mvu-report is-' + (report ? report.status : 'waiting');
    if (!report) { summary.textContent = '◷ 正在等待更新结果'; return; }
    summary.textContent = report.status === 'error' ? '⚠ 本轮更新未生效，所有操作均未应用' : report.status === 'empty' ? '✓ 本轮没有变量变化' : '✓ 本轮变量已更新 · ' + report.operations.length + '项操作';
    const body = make('div'); body.className = 'mvu-report-body'; node.append(body);
    report.issues.filter(issue => !issue.indices.length).forEach(issue => body.append(make('p', '⚠ ' + issue.message)));
    if (report.operations.length) {
      const list = make('ol'); list.className = 'mvu-report-list';
      report.operations.forEach((operation, index) => {
        const issues = report.issues.filter(issue => issue.indices.includes(index));
        const item = make('li');
        item.append(make('strong', '第' + (index + 1) + '条'));
        const valid = operation !== null && typeof operation === 'object';
        item.append(make('div', '操作：' + (valid && typeof operation.op === 'string' ? operation.op : '未填写')));
        item.append(make('div', '变量：' + (valid && typeof operation.path === 'string' ? operation.path : '未填写')));
        const raw = valid && operation.op === 'remove' ? '不适用' : valid && Object.prototype.hasOwnProperty.call(operation, 'value') ? JSON.stringify(operation.value, null, 2) : '未填写';
        item.append(make('div', '数值：' + raw));
        if (issues.length) item.className = 'mvu-report-problem';
        issues.forEach(issue => item.append(make('p', '⚠ ' + issue.message + (issue.kind === 'schema' && issue.indices.length > 1 ? '（第' + issue.indices.map(i => i + 1).join('、') + '条共同影响该字段）' : ''))));
        list.append(item);
      });
      body.append(list);
    }
    if (report.status === 'error' && latest) body.append(make('p', '请用平台编辑修改本条回复；重新计算会覆盖本轮手动修改'));
  }

  function render() {
    if (stopped) return;
    for (const [node, entry] of bubbles) {
      if (!node.isConnected) bubbles.delete(node);
      else show(node, entry);
    }
  }
  sdk.on('message:mount', function (msg) {
    if (stopped || msg.role !== 'ai') return;
    const body = document.querySelector('[data-chat="message-body"]');
    if (!body) return;
    const [node, ...duplicates] = body.querySelectorAll('.mvu-report');
    for (const duplicate of duplicates) { bubbles.delete(duplicate); duplicate.remove(); }
    if (!node || bubbles.has(node)) return;
    const entry = { id: msg.id, serverId: msg.serverId, identity: null };
    bubbles.set(node, entry);
    show(node, entry);
  });
  document.addEventListener('card:variables', render);
  sdk.on('conversation:switch', () => bubbles.clear());
  sdk.on('dispose', () => { stopped = true; bubbles.clear(); document.removeEventListener('card:variables', render); });
})();
