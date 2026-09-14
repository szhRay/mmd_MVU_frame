(function () {
  let cachedStore;
  let subscribed = false;
  let disposed = false;
  let frame = null;
  let timer;
  let stream;
  let done;
  let skipStable = false;
  let signature;
  const watchers = new Set();

  function store() {
    if (disposed) throw new Error('消息读取器已停止');
    if (cachedStore) return cachedStore;
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
    let node = document.documentElement;
    while (node) {
      const app = Object.getOwnPropertyDescriptor(node, '__vue_app__')?.value;
      if (app) {
        const provides = app._context.provides;
        for (const key of Reflect.ownKeys(provides)) {
          const value = Object.getOwnPropertyDescriptor(provides, key)?.value;
          if (value?._s instanceof Map && value._s.has('messages')) {
            cachedStore = value._s.get('messages');
            return cachedStore;
          }
        }
      }
      node = walker.nextNode();
    }
    throw new Error('Messages store is not accessible');
  }

  function message(row) {
    return { id: row.key, serverId: row.serverId, role: row.from, content: row.content };
  }

  function snapshot() {
    subscribe();
    const source = store();
    return { loaded: source.loaded, hasMore: source.hasMore,
      messages: source.keys.map(key => message(source.getByKey(key))) };
  }

  function get(id) {
    subscribe();
    const row = store().getByKey(id);
    return row ? message(row) : null;
  }

  function at(index, role) {
    if (!Number.isInteger(index)) throw new Error('消息索引必须是整数');
    if (role !== 'ai' && role !== 'user') throw new Error('消息角色必须是 ai 或 user');
    subscribe();
    const source = store();
    const key = source.keys.filter(key => source.getByKey(key).from === role).at(index);
    return key === undefined ? null : message(source.getByKey(key));
  }

  function latest(role) {
    if (role !== 'ai' && role !== 'user') throw new Error('消息角色必须是 ai 或 user');
    subscribe();
    const source = store();
    const keys = source.keys;
    for (let i = keys.length - 1; i >= 0; i--) {
      const row = source.getByKey(keys[i]);
      if (row.from === role) return message(row);
    }
    return null;
  }

  function same(a, b) {
    return a.id === b.id || (a.serverId != null && b.serverId != null &&
      String(a.serverId) === String(b.serverId));
  }

  function call(watcher, name, value) {
    const callback = watcher[name];
    if (!callback) return;
    try { callback({ ...value }); }
    catch (error) { sdk.debug.log('消息读取监听失败', error.message); }
  }

  function reply(watcher, value) {
    if (!watcher.onReply || value.content === '') return;
    if (watcher.replyId === value.id && watcher.replyContent === value.content) return;
    watcher.replyId = value.id;
    watcher.replyContent = value.content;
    call(watcher, 'onReply', value);
  }

  function flush() {
    frame = null;
    let source, keys, current, user;
    try {
      source = store();
      keys = source.keys;
      for (let i = keys.length - 1; i >= 0 && (!current || !user); i--) {
        const row = source.getByKey(keys[i]);
        if (!current && row.from === 'ai') current = message(row);
        if (!user && row.from === 'user') user = message(row);
      }
    }
    catch (error) { sdk.debug.log('消息读取失败', error.message); return; }
    const next = [source.loaded, source.hasMore, keys.length, current?.id, current?.serverId,
      current?.content, user?.id, user?.serverId];
    if (!signature || next.some((value, index) => value !== signature[index])) {
      signature = next;
      document.dispatchEvent(new Event('card:messages'));
    }
    if (!current) { stream = undefined; done = undefined; return; }
    if (stream && same(current, stream)) {
      skipStable = false;
      for (const watcher of watchers) {
        if (watcher.streamId === stream.id && watcher.streamContent === stream.content) continue;
        watcher.streamId = stream.id;
        watcher.streamContent = stream.content;
        call(watcher, 'onStream', stream);
      }
    }
    if (done && same(current, done)) {
      skipStable = false;
      for (const watcher of watchers) reply(watcher, done);
      stream = undefined;
      done = undefined;
    } else if (skipStable) {
      skipStable = false;
      for (const watcher of watchers) {
        watcher.replyId = current.id;
        watcher.replyContent = current.content;
      }
    } else if (!stream || !same(current, stream)) {
      for (const watcher of watchers) reply(watcher, current);
    }
  }

  function schedule() {
    if (!disposed && frame === null) frame = requestAnimationFrame(flush);
  }

  function subscribe() {
    if (subscribed) return;
    subscribed = true;
    timer = setInterval(schedule, 500);
    sdk.on('message:new', schedule);
    sdk.on('message:stream', value => {
      if (value.role !== 'ai') return;
      let current;
      try { current = latest('ai'); } catch (error) { sdk.debug.log('消息读取失败', error.message); return; }
      if (!current || !same(current, value)) return;
      stream = { id: value.id, serverId: value.serverId, role: value.role, content: value.content };
      schedule();
    });
    sdk.on('message:done', value => {
      if (value.role !== 'ai') return;
      done = { id: value.id, serverId: value.serverId, role: value.role, content: value.content };
      schedule();
    });
    sdk.on('conversation:switch', () => {
      cachedStore = undefined;
      stream = undefined;
      done = undefined;
      skipStable = true;
      signature = undefined;
      for (const watcher of watchers) {
        watcher.streamId = undefined;
        watcher.streamContent = undefined;
        watcher.replyId = undefined;
        watcher.replyContent = undefined;
      }
      schedule();
    });
    sdk.on('dispose', () => {
      disposed = true;
      cachedStore = undefined;
      watchers.clear();
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    });
  }

  function watchReply({ stream: onStream, reply: onReply }) {
    if (typeof onStream !== 'function' && typeof onReply !== 'function') throw new Error('至少需要一个消息回调');
    if (onStream !== undefined && typeof onStream !== 'function') throw new Error('stream 必须是函数');
    if (onReply !== undefined && typeof onReply !== 'function') throw new Error('reply 必须是函数');
    subscribe();
    store();
    const watcher = { onStream, onReply };
    watchers.add(watcher);
    if (onReply) schedule();
    let stopped = false;
    return function () {
      if (stopped) return;
      stopped = true;
      watchers.delete(watcher);
    };
  }

  window.CARD.messages = Object.freeze({ at });
  window.CARD_INTERNAL.messages = Object.freeze({ snapshot, get, watchReply });
})();
