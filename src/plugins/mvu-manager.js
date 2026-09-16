(function () {
  if (window.MVU_MANAGER) return;
  let root, launcher;
  let panel, status, notice, tree, value, baseline, available = false, refreshing = false, disposed = false, activeEditor;
  let preview, previewText, previewStatus, variablePage, recalculate;
  const expanded = new Map();
  const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  const pointer = (path, key) => path + '/' + String(key).replace(/~/g, '~0').replace(/\//g, '~1');
  const labels = {string:'字符串',number:'数字',boolean:'布尔',null:'null',object:'对象',array:'数组'};
  function make(tag, text) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
  function button(text, label, action) {
    const node = make('button', text); node.type = 'button'; node.setAttribute('aria-label', label); node.title = label;
    node.onclick = () => { try { action(); } catch (error) { notice.textContent = error.message; } }; return node;
  }
  function closeEditor() { if (activeEditor) activeEditor.remove(); activeEditor = undefined; }
  function refreshPreview() {
    if (!MVU.info().ready) {
      previewStatus.textContent = '等待变量就绪';
      previewText.textContent = '';
      recalculate.disabled = true;
      return;
    }
    try {
      const text = CARD_INTERNAL.inject.variableBlock();
      previewStatus.textContent = '';
      previewText.textContent = text;
    } catch (error) {
      previewStatus.textContent = error.message;
      previewText.textContent = '';
    }
    recalculate.disabled = !MVU.info().ready;
  }
  function refresh() {
    if (!panel || panel.hidden || refreshing || disposed) return false;
    refreshing = true; let changed = false;
    try {
      MVU.sync(); const info = MVU.info(); available = info.ready;
      status.textContent = info.status + ' · 第' + info.round + '轮';
      if (!available) {
        changed = baseline !== undefined; baseline = undefined; value = undefined; closeEditor(); expanded.clear();
        tree.replaceChildren(make('p', info.status));
      } else {
        const next = MVU.getCurrent();
        const identity = JSON.stringify([info.slotId,info.round,info.replyId,next]);
        if (identity !== baseline) {
          changed = true; baseline = identity; value = next; closeEditor(); notice.textContent = ''; render();
        }
      }
    } catch (error) {
      changed = true; available = false; baseline = undefined; value = undefined; closeEditor(); tree.replaceChildren(); notice.textContent = error.message;
    } finally { refreshPreview(); refreshing = false; }
    return changed;
  }
  function apply(operation) {
    if (operation.op === 'replace') return MVU.replace(operation.path, operation.value);
    if (operation.op === 'insert') return MVU.insert(operation.path, operation.value);
    if (operation.op === 'remove') return MVU.remove(operation.path);
    throw new Error('不支持的变量操作');
  }
  function submit(operation) {
    if (refresh() || !available) return false;
    apply(operation); closeEditor(); refresh(); notice.textContent = '已提交'; return true;
  }
  function editor(host, current, path, adding) {
    closeEditor();
    const box = make('div'); box.className = 'mvu-editor'; activeEditor = box;
    const fields = make('div'); fields.className = 'mvu-fields';
    const error = make('div'); error.className = 'mvu-error'; error.setAttribute('role','status');
    let type = typeOf(current), input, key;
    if (adding) {
      key = make('input'); key.setAttribute('aria-label', adding === 'array' ? '插入索引' : '新增字段名');
      key.placeholder = adding === 'array' ? '索引或-（末尾）' : '字段名'; key.value = adding === 'array' ? '-' : ''; fields.append(key);
      const select = make('select'); select.setAttribute('aria-label','新增类型');
      for (const name of Object.keys(labels)) { const option = make('option',labels[name]); option.value = name; select.append(option); }
      select.value = type; select.onchange = () => { type = select.value; field(); }; fields.append(select);
    }
    const inputBox = make('div'); fields.append(inputBox);
    function field() {
      inputBox.replaceChildren(); input = undefined;
      if (type === 'string') { input = make('textarea'); input.value = typeof current === 'string' ? current : ''; }
      if (type === 'number') { input = make('input'); input.type = 'number'; input.step = 'any'; input.value = typeof current === 'number' ? String(current) : '0'; }
      if (type === 'boolean') { input = make('input'); input.type = 'checkbox'; input.checked = current === true; }
      if (input) { input.setAttribute('aria-label','节点值'); inputBox.append(input); }
      else inputBox.append(make('span',type === 'null' ? 'null' : '空' + labels[type]));
    }
    field();
    const actions = make('div'); actions.className = 'mvu-editor-actions';
    actions.append(button('√','应用',() => {
      try {
        let next;
        if (type === 'string') next = input.value;
        if (type === 'number') { next = input.valueAsNumber; if (!Number.isFinite(next)) throw new Error('请输入有限数字'); }
        if (type === 'boolean') next = input.checked;
        if (type === 'null') next = null;
        if (type === 'object') next = {};
        if (type === 'array') next = [];
        submit({op:adding ? 'insert' : 'replace',path:adding ? pointer(path,key.value) : path,value:next});
      } catch (e) { error.textContent = e.message; }
    }),button('×','取消',closeEditor));
    box.append(fields,actions,error); host.append(box);
  }
  function render() {
    tree.replaceChildren();
    function node(current,path,name,depth) {
      const kind = typeOf(current), compound = kind === 'object' || kind === 'array';
      const card = make('section'); card.className = 'mvu-card';
      const row = make('div'); row.className = 'mvu-row';
      const body = make('div'); body.className = 'mvu-children';
      if (depth >= 6) body.style.paddingLeft = '0';
      if (compound) {
        const open = expanded.has(path) ? expanded.get(path) : depth === 0; body.hidden = !open;
        const toggle = button(open ? '▾' : '▸','展开 '+path,() => { body.hidden = !body.hidden; expanded.set(path,!body.hidden); toggle.textContent = body.hidden ? '▸':'▾'; toggle.setAttribute('aria-expanded',String(!body.hidden)); });
        toggle.setAttribute('aria-expanded',String(open)); row.append(toggle);
      }
      row.append(make('strong',name),make('small',labels[kind]));
      const parts = path.split('/').slice(1);
      const access = parts.some(key => key.startsWith('$')) ? '不注入AI' : parts.some(key => key.startsWith('_')) ? 'AI只读' : '';
      if (access) row.append(make('small',access));
      if (!compound) {
        if (kind === 'null') row.append(make('span','null'));
        else { const edit = button(String(current),'修改 '+path,() => editor(card,current,path,false)); edit.className = 'mvu-value'; row.append(edit); }
      } else row.append(button('+','新增 '+path,() => editor(card,'',path,kind)));
      row.append(button('🗑','删除 '+path,() => submit({op:'remove',path})));
      card.append(row);
      if (compound) {
        for (const key of Object.keys(current)) body.append(node(current[key],pointer(path,key),kind === 'array' ? '['+key+']' : key,depth+1));
        if (!Object.keys(current).length) body.append(make('small','空'+labels[kind])); card.append(body);
      }
      return card;
    }
    const kind = typeOf(value);
    if (kind === 'object' || kind === 'array') {
      tree.append(button('+','新增一级字段',() => editor(tree,'','',kind)));
      for (const key of Object.keys(value)) tree.append(node(value[key],pointer('',key),kind === 'array'?'['+key+']':key,0));
    } else tree.append(make('p',String(value)));
  }
  function initialize() {
    if (panel) return;
    const slot = document.querySelector('[data-slot="statusbar"]');
    root = slot && slot.querySelector('.mvu-manager-root');
    if (!root) return;
    launcher = root.querySelector('.mvu-manager-launcher');
    panel = root.querySelector('.mvu-manager-panel');
    status = root.querySelector('.mvu-status'); notice = root.querySelector('.mvu-notice');
    tree = root.querySelector('.mvu-tree'); variablePage = root.querySelector('.mvu-variable-page');
    preview = root.querySelector('.mvu-injection-preview'); previewText = root.querySelector('.mvu-preview-text');
    previewStatus = root.querySelector('.mvu-preview-status'); recalculate = root.querySelector('.mvu-recalculate');
    const closeButton = root.querySelector('.mvu-manager-close');
    const reset = root.querySelector('.mvu-reset');
    const tabs = root.querySelector('.mvu-tabs');
    launcher.onclick = open; closeButton.onclick = close; recalculate.onclick = refreshPreview;
    reset.onclick = () => { try { MVU.resetCurrent(); closeEditor(); baseline = undefined; refresh(); } catch (error) { notice.textContent = error.message; } };
    launcher.setAttribute('aria-label','打开变量管理'); closeButton.setAttribute('aria-label','关闭变量管理');
    recalculate.setAttribute('aria-label','重新计算变量注入预览'); reset.setAttribute('aria-label','重置当前轮');
    tabs.setAttribute('role','tablist'); previewStatus.setAttribute('role','status');
    for (const [tab, page] of [[root.querySelector('.mvu-tab-variables'),variablePage],[root.querySelector('.mvu-tab-preview'),preview]]) {
      tab.onclick = () => {
        variablePage.classList.toggle('is-hidden', page !== variablePage);
        preview.classList.toggle('is-hidden', page !== preview);
        for (const item of tabs.children) item.setAttribute('aria-selected', String(item === tab));
      };
      tab.setAttribute('role','tab'); tab.setAttribute('aria-selected',String(page === variablePage));
    }
    panel.classList.add('is-hidden');
  }
  function open() {
    if (disposed) return;
    initialize();
    if (!panel) return;
    panel.classList.remove('is-hidden'); refresh();
  }
  function close() {
    if (panel) panel.classList.add('is-hidden');
    closeEditor();
  }
  function mount() {
    if (!disposed) initialize();
  }
  function switchConversation() {
    if (disposed) return;
    close(); baseline = undefined; value = undefined; expanded.clear();
    if (panel) {
      tree.replaceChildren(); notice.textContent = ''; status.textContent = '';
      previewText.textContent = ''; previewStatus.textContent = '';
      available = false;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('card:variables', refresh);
    if (root) root.remove();
    value = undefined; baseline = undefined; closeEditor(); expanded.clear();
  }
  window.MVU_MANAGER = { open, close };
  document.addEventListener('card:variables', refresh);
  sdk.on('message:mount', mount);
  sdk.on('conversation:switch', switchConversation);
  sdk.on('dispose', dispose);
})();
