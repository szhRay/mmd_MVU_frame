(function () {
  if (window.__cardStage) return;
  window.__cardStage = true;
  let root;
  let disposed = false;

  function mount() {
    if (disposed) return;
    if (root && root.isConnected) return root;
    const bar = document.querySelector('[data-slot="statusbar"]');
    const source = bar && bar.querySelector('.card-stage-source');
    if (!source || source.children.length !== 1) throw new Error('舞台源需要唯一根元素');
    const author = CARD_AUTHOR.stage;
    if (!author || typeof author.render !== 'function') throw new Error('作者舞台入口无效');
    root = source.firstElementChild.cloneNode(true);
    sdk.stage.el().replaceChildren(root);
    author.render(root);
    return root;
  }

  function reset() {
    if (root) root.remove();
    root = undefined;
  }

  sdk.on('message:mount', mount);
  sdk.on('conversation:switch', reset);
  sdk.on('dispose', function () {
    disposed = true;
    reset();
  });
})();
