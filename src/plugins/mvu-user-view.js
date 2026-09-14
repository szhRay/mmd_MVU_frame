(function () {
  if (window.__mvuUserView) return;
  window.__mvuUserView = true;
  let stopped = false;
  sdk.on('message:mount', function (message) {
    if (stopped || message.role !== 'user') return;
    const body = document.querySelector('[data-chat="message-body"]');
    if (!body) return;
    const content = message.content;
    const start = content.lastIndexOf('[当前变量]');
    const complete = start >= 0 && content.slice(start).match(/^\[当前变量\][\s\S]*?\[\/当前变量\]\s*$/);
    const text = document.createElement('div');
    text.className = 'mvu-user-text';
    text.textContent = complete ? content.slice(0, start) : content;
    body.replaceChildren(text);
    if (!complete) return;
    const details = document.createElement('details');
    details.className = 'mvu-user-variables';
    const summary = document.createElement('summary');
    summary.textContent = '当前变量';
    const variables = document.createElement('pre');
    variables.textContent = content.slice(start);
    details.append(summary, variables);
    body.append(details);
  });
  sdk.on('dispose', () => { stopped = true; });
})();
