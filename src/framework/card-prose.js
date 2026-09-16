(function () {
  const bodies = new Map();
  const skipped = 'pre,code,kbd,samp,input,textarea,script,style,.card-quote';
  const quotes = /“([^“”\r\n]{1,800})[“”]|"([^"\r\n]{1,800})"/g;

  function decorate(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement.closest(skipped) && quotes.test(node.nodeValue)) nodes.push(node);
      quotes.lastIndex = 0;
    }
    for (const text of nodes) {
      const fragment = document.createDocumentFragment();
      let offset = 0;
      text.nodeValue.replace(quotes, (match, chinese, ascii, index) => {
        fragment.append(text.nodeValue.slice(offset, index));
        const span = document.createElement('span');
        span.className = 'card-quote';
        span.textContent = '“' + (chinese === undefined ? ascii : chinese) + '”';
        fragment.append(span);
        offset = index + match.length;
        return match;
      });
      fragment.append(text.nodeValue.slice(offset));
      text.replaceWith(fragment);
      quotes.lastIndex = 0;
    }
  }

  function mount(message) {
    if (message.role !== 'ai') return;
    const body = document.querySelector('[data-chat="message-body"]');
    if (!body) return;
    bodies.set(message.id, body);
    decorate(body);
  }

  function done(message) {
    if (message.role !== 'ai') return;
    const body = bodies.get(message.id);
    if (!body) return;
    decorate(body);
    bodies.delete(message.id);
  }

  [['message:mount', mount], ['message:done', done], ['dispose', () => bodies.clear()]]
    .forEach(([event, handler]) => sdk.on(event, handler));
})();
