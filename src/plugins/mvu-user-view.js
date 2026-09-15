(function () {
  if (window.__mvuUserView) return;
  window.__mvuUserView = true;
  let stopped = false;
  const suffix = /\n\[当前变量\](?:(?!\[\/?当前变量\])[\s\S])*\[\/当前变量\]\s*$/;
  sdk.on('message:mount', function (message) {
    if (stopped || message.role !== 'user') return;
    const body = document.querySelector('[data-chat="message-body"]');
    if (!body || body.classList.contains('mvu-user-view-ready')) return;
    const match = suffix.exec(message.content);
    if (!match) return;
    body.classList.add('mvu-user-view-ready');
    const text = document.createElement('div');
    text.className = 'mvu-user-text';
    text.textContent = message.content.slice(0, match.index);
    body.replaceChildren(text);
    const details = document.createElement('details');
    details.className = 'mvu-user-variables';
    const summary = document.createElement('summary');
    summary.textContent = '当前变量';
    const variables = document.createElement('pre');
    variables.textContent = match[0].slice(1);
    details.append(summary, variables);
    body.append(details);
  });
  sdk.on('dispose', function () { stopped = true; });
})();
