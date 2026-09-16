(function () {
  const copy = value => JSON.parse(JSON.stringify(value));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const protectedKey = key => key.startsWith('_') || key.startsWith('$');
  function containsProtected(value) {
    return value !== null && typeof value === 'object' && Object.entries(value).some(([key, child]) => protectedKey(key) || containsProtected(child));
  }
  function apply(state, operations, ai = false, shifts = []) {
    if (!Array.isArray(operations)) throw new Error('变量更新必须是JSON数组');
    const result = copy(state);
    for (const [index, operation] of operations.entries()) {
      try {
        if (!operation || typeof operation !== 'object') throw new Error('无效变量操作');
        const { op, path, value } = operation;
        if (!['replace', 'delta', 'insert', 'remove'].includes(op) || typeof path !== 'string' || !path.startsWith('/')) {
          throw new Error('无效变量操作');
        }
        const parts = path.slice(1).split('/').map(part => {
          if (/~(?![01])/.test(part)) throw new Error('无效路径转义');
          const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
          if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('禁止该变量路径');
          if (ai && protectedKey(key)) throw new Error('AI不可修改受保护变量');
          return key;
        });
        let parent = result;
        for (let i = 0; i < parts.length; i++) {
          if (parent === null || typeof parent !== 'object') throw new Error('变量父对象不存在');
          const last = i === parts.length - 1;
          let key = parts[i];
          const array = Array.isArray(parent);
          if (array) {
            if (last && op === 'insert' && key === '-') key = parent.length;
            else {
              if (!/^(0|[1-9][0-9]*)$/.test(key)) throw new Error('无效数组索引');
              key = Number(key);
            }
            const limit = last && op === 'insert' ? parent.length : parent.length - 1;
            if (!Number.isSafeInteger(key) || key > limit) throw new Error('数组索引不存在');
          }
          if (!last) {
            if (!own(parent, key)) throw new Error('变量父对象不存在');
            parent = parent[key];
            continue;
          }
          if (op === 'insert') {
            if (!array && own(parent, key)) throw new Error('变量已存在');
          } else if (!own(parent, key)) throw new Error('变量不存在');
          if (op !== 'remove' && !own(operation, 'value')) throw new Error(op + '缺少value');
          if (array && (op === 'insert' || op === 'remove')) shifts[index] = { path: pointer(parts.slice(0, -1)), index: key };
          if (ai && (op === 'replace' || op === 'remove') && containsProtected(parent[key])) throw new Error('AI不可替换或删除含受保护变量的容器');
          if (ai && (op === 'insert' || op === 'replace') && containsProtected(value)) throw new Error('AI不可新增受保护变量');
          if (op === 'delta') {
            if (!Number.isFinite(parent[key]) || !Number.isFinite(value) || !Number.isFinite(parent[key] + value)) {
              throw new Error('delta只接受有限数字');
            }
            parent[key] += value;
          } else if (op === 'remove') {
            if (array) parent.splice(key, 1);
            else delete parent[key];
          } else if (array && op === 'insert') parent.splice(key, 0, copy(value));
          else parent[key] = copy(value);
        }
      } catch (error) {
        error.kind = 'operation';
        error.index = index;
        error.path = typeof operation?.path === 'string' ? operation.path : '';
        throw error;
      }
    }
    return result;
  }

  function parse(content) {
    const blocks = [...content.matchAll(/<变量更新>([\s\S]*?)<\/变量更新>/g)];
    if (!blocks.length) throw Object.assign(new Error('回复需要至少一个完整的变量更新块'), { kind: 'protocol' });
    const operations = [];
    for (const block of blocks) {
      let parsed;
      try { parsed = JSON.parse(block[1]); }
      catch (error) { error.kind = 'json'; throw error; }
      if (!Array.isArray(parsed)) throw Object.assign(new Error('变量更新必须是JSON数组'), { kind: 'format' });
      operations.push(...parsed);
    }
    return { operations, block: JSON.stringify(operations) };
  }

  const pointer = parts => parts.length ? '/' + parts.map(part => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/') : '';
  const decode = path => path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  const related = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
  function changes(before, after, parts = []) {
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
      return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => changes(before[key], after[key], [...parts, key]));
    }
    const item = { path: pointer(parts), type: before === undefined ? 'insert' : after === undefined ? 'remove' : 'replace' };
    if (before !== undefined) item.before = copy(before);
    if (after !== undefined) item.after = copy(after);
    return [item];
  }
  function friendly(issue) {
    const name = issue.path.length ? String(issue.path[issue.path.length - 1]) : '变量';
    if (issue.code === 'too_small' && issue.type === 'number') return name + (issue.inclusive ? '不能小于' : '必须大于') + issue.minimum;
    if (issue.code === 'too_big' && issue.type === 'number') return name + (issue.inclusive ? '不能大于' : '必须小于') + issue.maximum;
    if (issue.code === 'invalid_type' && issue.expected === 'integer') return name + '必须是整数';
    if (issue.code === 'invalid_type' && issue.expected === 'number' && issue.received !== 'undefined') return name + '必须是数字';
    if (issue.code === 'not_finite') return name + '必须是有限数字';
    if (issue.code === 'invalid_type') return name + (issue.received === 'undefined' ? '不能为空' : '的内容类型不正确');
    if (issue.code === 'unrecognized_keys') return name + '中包含不允许添加的字段';
    return name + '不符合角色的变量规则';
  }
  function prepare(candidate, derive, context, validate) {
    const before = copy(candidate);
    const derived = copy(candidate);
    try { derive(derived, copy(context)); }
    catch (error) {
      throw Object.assign(new Error('变量派生失败：' + error.message), { kind: 'derive', technical: error.message });
    }
    try {
      return { before, derived, snapshot: validate(derived) };
    } catch (error) {
      if (error.kind === 'schema') error.derivePaths = changes(before, derived).map(change => change.path);
      throw error;
    }
  }
  function diagnose(base, parsed, parseError, derive, context, validate) {
    const report = { status: 'error', operations: parsed.operations === undefined ? [] : copy(parsed.operations), changes: [], adjustments: [], issues: [] };
    const shifts = [];
    try {
      if (parseError) throw parseError;
      const applied = apply(base, parsed.operations, true, shifts);
      const prepared = prepare(applied, derive, context, validate);
      const snapshot = prepared.snapshot;
      report.changes = changes(base, applied);
      report.adjustments = changes(applied, snapshot);
      report.status = parsed.operations.length || report.changes.length ? 'success' : 'empty';
      return { snapshot, report };
    } catch (error) {
      if (error.kind === 'schema') {
        report.issues = error.issues.map(issue => {
          const path = pointer(issue.path);
          const derived = path && error.derivePaths.some(changed => related(path, changed));
          const indices = path && !derived && issue.code !== 'custom' ? report.operations.flatMap((op, index) => {
            if (!op || typeof op.path !== 'string') return [];
            const shift = shifts[index];
            const moved = shift && path.startsWith(shift.path + '/') && Number(decode(path.slice(shift.path.length))[0]) >= shift.index;
            return related(path, op.path) || moved ? [index] : [];
          }) : [];
          return { kind: derived ? 'derive-schema' : 'schema', code: issue.code, path, indices,
            message: derived ? '派生后的变量不符合规则：' + friendly(issue) : friendly(issue), technical: issue.message };
        });
      } else {
        const kind = error.kind || 'validation';
        const words = {
          protocol: '回复需要至少一个完整的变量更新块',
          json: '更新内容的格式有误，无法读取，请检查括号、引号和逗号',
          format: '更新内容需要写成操作列表，无法逐项读取',
          validation: '更新结果不符合角色的变量规则',
          derive: '变量派生失败',
        };
        const operationWords = {
          '变量不存在': '找不到要修改的变量', '变量父对象不存在': '找不到这个变量所属的对象',
          '变量已存在': '这个变量已经存在，不能重复新增', '数组索引不存在': '找不到列表中的这一项',
          '无效数组索引': '列表位置需要使用有效的序号', 'delta只接受有限数字': '增加或减少的操作只能用于有效数字',
          'AI不可修改受保护变量': '这项变量只能由角色脚本或玩家修改',
          'AI不可替换或删除含受保护变量的容器': '这组内容包含受保护变量，不能整体替换或删除',
          'AI不可新增受保护变量': '不能通过回复新增受保护变量',
          'replace缺少value': '替换操作没有填写新内容', 'insert缺少value': '新增操作没有填写内容', 'delta缺少value': '增减操作没有填写数值',
          '无效变量操作': '这项操作的写法不正确', '无效路径转义': '变量位置的写法不正确', '禁止该变量路径': '不允许修改这个变量位置',
        };
        report.issues = [{ kind, code: kind === 'operation' ? error.message : kind, path: error.path || '', indices: kind === 'operation' ? [error.index] : [],
          message: kind === 'operation' ? operationWords[error.message] : words[kind], technical: error.technical || error.message }];
      }
      return { snapshot: copy(base), report, error };
    }
  }
  window.MvuJson = { apply: (state, operations) => apply(state, operations), applyAi: (state, operations) => apply(state, operations, true), parse, prepare, diagnose };
})();
