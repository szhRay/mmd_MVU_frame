(function () {
  const saveKey = 'mvu_state';
  let frame = null;
  let preloadTimer = null;
  let started = false;
  let ready = false;
  let disposed = false;
  let script;
  let validator;
  let validationError = '校验器加载中';
  window.MVU = createMvu({
    initial: window.MVU_INITIAL,
    validate: data => {
      if (!validator) throw new Error(validationError);
      return validator(data);
    },
    validationStatus: () => !ready ? '等待页面就绪' : validator ? '' : validationError,
    readMessages: () => CARD_INTERNAL.messages.snapshot(),
    load: () => sdk.save.get(saveKey),
    save: value => sdk.save.set(saveKey, value),
    changed: context => CARD_INTERNAL.variables.changed(context),
    report: error => sdk.debug.log('MVU', error.message),
    derive: (variables, context) => MVU_MODEL.derive(variables, context),
  });
  CARD_INTERNAL.variables.provide({
    current: () => MVU.getCurrent(),
    reply: message => MVU.getReplySnapshot(message),
  });
  function clearSchedule() {
    if (frame !== null) cancelAnimationFrame(frame);
    if (preloadTimer !== null) clearTimeout(preloadTimer);
    frame = null;
    preloadTimer = null;
  }
  function synchronize() {
    frame = null;
    MVU.sync();
    if (MVU.info().status !== '存档未预载') return;
    preloadTimer = setTimeout(() => {
      preloadTimer = null;
      schedule();
    }, 100);
  }
  function schedule() {
    if (frame !== null || !started) return;
    if (preloadTimer !== null) clearTimeout(preloadTimer);
    preloadTimer = null;
    frame = requestAnimationFrame(synchronize);
  }
  function switchConversation() {
    clearSchedule();
    MVU.switchConversation();
    schedule();
  }
  function start() {
    if (started || disposed || !ready || !validator) return;
    started = true;
    schedule();
  }
  function loadValidator() {
    if (script || disposed) return;
    script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/zod@3.23.8/lib/index.umd.min.js';
    script.onload = () => {
      if (disposed) return;
      try {
        validator = createMvuValidator(MVU_MODEL.schema(window.Zod));
        start();
      } catch (error) {
        validationError = '校验器初始化失败：' + error.message;
        MVU.sync();
      }
    };
    script.onerror = () => {
      if (disposed) return;
      validationError = '校验器加载失败';
      MVU.sync();
    };
    document.head.append(script);
  }
  sdk.on('message:mount', function () {
    loadValidator();
    schedule();
  });
  sdk.on('message:done', schedule);
  sdk.on('ready', function () {
    ready = true;
    MVU.sync();
    loadValidator();
    start();
  });
  document.addEventListener('card:messages', schedule);
  sdk.on('conversation:switch', switchConversation);
  sdk.on('dispose', function () {
    disposed = true;
    started = false;
    if (script) { script.onload = null; script.onerror = null; script.remove(); }
    clearSchedule();
    document.removeEventListener('card:messages', schedule);
    MVU.stop();
  });
})();
