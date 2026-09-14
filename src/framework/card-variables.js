(function () {
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  let provider;
  function current() {
    if (!provider) throw new Error('未注册变量提供器');
    return copy(provider.current());
  }
  function resolve(message) {
    if (!provider) throw new Error('未注册变量提供器');
    return copy(provider.reply(copy(message)));
  }
  CARD.variables = Object.freeze({
    current,
    reply(index) {
      const message = CARD.messages.at(index, 'ai');
      if (!message) throw new Error('消息索引不存在');
      return resolve(message);
    },
  });
  CARD_INTERNAL.variables = Object.freeze({
    provide(value) {
      if (provider) throw new Error('变量提供器已注册');
      if (!value || typeof value.current !== 'function' || typeof value.reply !== 'function') {
        throw new Error('变量提供器需要 current 和 reply');
      }
      provider = value;
    },
    available() { return provider !== undefined; },
    resolve,
    changed(context) {
      document.dispatchEvent(new CustomEvent('card:variables', { detail: copy(context) }));
    },
  });
})();
