(function () {
  if (window.MVU_MANAGER) return;
  const styleText = __MVU_MANAGER_STYLE__;
  let launcher, style;
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
    } finally { tree.disabled = !available; refreshPreview(); refreshing = false; }
    return changed;
  }
  function submit(operation) {
    if (refresh() || !available) return false;
    MVU.applyPlayer([operation]); closeEditor(); refresh(); notice.textContent = '已提交'; return true;
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
    panel = make('section'); panel.className = 'mvu-manager';
    const header = make('header'); header.append(make('strong','变量管理'),button('×','关闭',close));
    status = make('div'); status.className = 'mvu-status'; notice = make('div'); notice.className = 'mvu-notice';
    tree = make('fieldset'); tree.className = 'mvu-tree';
    variablePage = make('div');
    variablePage.append(button('重置当前轮','重置当前轮',()=>{MVU.resetCurrent();closeEditor();baseline=undefined;refresh();}), tree);
    preview = make('section'); preview.hidden = true; preview.className = 'mvu-injection-preview';
    previewText = make('pre'); previewStatus = make('p'); previewStatus.setAttribute('role','status');
    recalculate = button('重新计算','重新计算',refreshPreview);
    preview.append(make('p','MVU 将在发送正文末尾追加以下变量块'),recalculate,previewStatus,previewText);
    const tabs = make('div'); tabs.className = 'mvu-tabs'; tabs.setAttribute('role','tablist');
    for (const [label, page] of [['变量',variablePage],['变量注入预览',preview]]) {
      const tab = button(label,label,()=>{
        variablePage.hidden = page !== variablePage; preview.hidden = page !== preview;
        for (const item of tabs.children) item.setAttribute('aria-selected', String(item === tab));
      });
      tab.setAttribute('role','tab'); tab.setAttribute('aria-selected',String(page === variablePage)); tabs.append(tab);
    }
    panel.append(header,status,notice,tabs,variablePage,preview); refresh();
  }
  function open() {
    if (disposed) return;
    initialize(); panel.hidden = false; refresh();
    document.querySelector('[data-slot="statusbar"]').append(panel);
  }
  function close() {
    if (panel) panel.hidden = true;
    closeEditor();
  }
  function mount() {
    if (disposed || launcher) return;
    style = make('style', styleText);
    launcher = make('button', '变量管理');
    launcher.type = 'button'; launcher.className = 'mvu-manager-launcher';
    launcher.onclick = open;
    document.querySelector('[data-slot="statusbar"]').append(style, launcher);
  }
  function switchConversation() {
    if (disposed) return;
    close(); baseline = undefined; value = undefined; expanded.clear();
    if (panel) {
      tree.replaceChildren(); notice.textContent = ''; status.textContent = '';
      previewText.textContent = ''; previewStatus.textContent = '';
      available = false; tree.disabled = true;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('card:variables', refresh);
    if (panel) panel.remove();
    if (launcher) launcher.remove();
    if (style) style.remove();
    value = undefined; baseline = undefined; closeEditor(); expanded.clear();
  }
  window.MVU_MANAGER = { open, close };
  document.addEventListener('card:variables', refresh);
  sdk.on('message:mount', mount);
  sdk.on('conversation:switch', switchConversation);
  sdk.on('dispose', dispose);
})();
