(function () {
  const rows = [];
  const store = {
    loaded: false,
    hasMore: false,
    get keys() { return rows.map(row => row.key); },
    getByKey(key) { return rows.find(row => row.key === key); },
  };
  function upsert(message) {
    const stable = message.serverId == null ? message.id : String(message.serverId);
    let row = rows.find(value => (value.serverId == null ? value.key : String(value.serverId)) === stable);
    if (!row) { rows.push({ key: message.id, serverId: message.serverId, from: message.role, content: message.content }); return; }
    row.key = message.id; row.serverId = message.serverId; row.from = message.role; row.content = message.content;
  }
  Object.defineProperty(document.documentElement, '__vue_app__', {
    value: { _context: { provides: { pinia: { _s: new Map([['messages', store]]) } } } },
  });
  sdk.on('message:new', upsert);
  sdk.on('message:stream', upsert);
  sdk.on('message:done', upsert);
  sdk.on('ready', function () { store.loaded = true; });
  sdk.on('conversation:switch', function () { rows.length = 0; store.loaded = false; });
})();
