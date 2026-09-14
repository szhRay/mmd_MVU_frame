(function () {
  const copy = value => JSON.parse(JSON.stringify(value));
  const { apply, parse } = window.MvuJson;
  function equal(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]));
  }
  const sid = row => row.serverId == null ? null : String(row.serverId);

  window.createMvu = function ({ initial, readMessages, load, save, changed, report, validate, validationStatus, derive }) {
    let slot = null;
    let current = -1;
    let usable = false;
    let signature = null;
    let generatingUser = null;
    let stopped = false;
    let syncing = false;
    let lastError = '';
    let saveError = '';
    const writer = createMvuWriter(save, error => {
      saveError = error ? '保存失败：' + error.message : '';
      if (error) report(error);
      changed(hookContext('save'));
    });
    let stateLabel = '等待消息加载';

    function fail(error) {
      const notify = usable || stateLabel !== error.message;
      usable = false;
      stateLabel = error.message;
      if (lastError !== error.message) { lastError = error.message; report(error); }
      if (notify) changed(hookContext('state'));
    }
    function persist() {
      writer.write(slot);
    }
    function hookContext(source, position = current, replyId = position < 0 ? null : slot.rounds[position]?.aiId) {
      return { source, round: position + 1, replyId };
    }
    function calculate(base, userId, aiId, parsed, error, force, source, position) {
      const result = window.MvuJson.diagnose(base, parsed, error, derive, hookContext(source, position, aiId), validate);
      if (force && result.error) throw result.error;
      const round = { userId, aiId, block: parsed.block, snapshot: result.snapshot, report: result.report };
      if (result.error) round.error = result.error.message;
      return round;
    }
    function restore(rows) {
      const stored = load();
      if (stored != null) {
        if (stored.version !== 1 || typeof stored.id !== 'string' || !Array.isArray(stored.rounds) || !stored.initial) throw new Error('存档格式无效');
        const target = copy(stored);
        if (target.rounds.some(round => !round.report || !['success', 'empty', 'error'].includes(round.report.status) || !Array.isArray(round.report.operations) || !Array.isArray(round.report.changes) || !Array.isArray(round.report.adjustments) || !Array.isArray(round.report.issues))) throw new Error('存档诊断报告无效，请新建对话');
        for (const snapshot of [target.initial, ...target.rounds.map(round => round.snapshot)]) {
          if (!equal(validate(snapshot), snapshot)) throw new Error('存档快照与当前变量模型不一致');
        }
        slot = target;
        return 'restore';
      }
      if (rows.length !== 1 || rows[0].id !== 'greeting') throw new Error('当前对话无存档');
      const prepared = window.MvuJson.prepare(initial, derive, hookContext('initial', -1, null), validate);
      slot = { version: 1, id: crypto.randomUUID(), initial: prepared.snapshot, rounds: [] };
      persist();
      return 'initial';
    }
    function sync(force = false) {
      if (stopped) { if (force) throw new Error('监听已停止'); return; }
      if (syncing) return;
      syncing = true;
      try { runSync(force); }
      finally { syncing = false; }
    }
    function runSync(force) {
      const wasUsable = usable;
      let canKeepCurrent = false;
      let changeSource = null;
      try {
        const pending = validationStatus();
        if (pending) { if (force) throw new Error(pending); if (stateLabel !== pending) fail(new Error(pending)); return; }
        const state = readMessages();
        if (state.loaded !== true) {
          if (force) throw new Error('等待消息加载');
          const notify = stateLabel !== '等待消息加载';
          signature = null;
          usable = false;
          stateLabel = '等待消息加载';
          if (notify) changed(hookContext('state'));
          return;
        }
        const rows = state.messages;
        let ai, user;
        for (let i = rows.length - 1; i >= 0 && (!ai || !user); i--) {
          const row = rows[i];
          if (!ai && row.role === 'ai') ai = row;
          if (!user && row.role === 'user') user = row;
        }
        const next = [rows.length, ai?.id, ai?.serverId, ai?.content, user?.id, user?.serverId, state.hasMore];
        if (!force && slot && signature && next.every((value, i) => value === signature[i])) return;
        const latestChanged = !signature || next.slice(1, 4).some((value, i) => value !== signature[i + 1]);
        if (!force) signature = next;
        usable = false;
        if (force && !slot) throw new Error('无对应存档');
        if (!slot) changeSource = restore(rows);
        if (!ai || (user && rows.indexOf(user) > rows.indexOf(ai)) || (ai.id !== 'greeting' && (ai.content === '' || sid(ai) === null))) {
          if (force) throw new Error('等待本轮回复完成及消息身份齐全');
          if (user) generatingUser = sid(user);
          stateLabel = '等待本轮回复'; changed(hookContext('state')); return;
        }
        canKeepCurrent = force && wasUsable && signature && next.every((value, i) => value === signature[i]);
        if (ai.id === 'greeting') {
          if (latestChanged) changeSource = 'sync';
          if (force) {
            if (rows.length !== 1) throw new Error('重置第0轮需要当前只有greeting');
            const updated = window.MvuJson.prepare(initial, derive, hookContext('reset', -1, null), validate).snapshot;
            slot.initial = updated;
            slot.rounds = [];
            persist();
            changeSource = 'reset';
          } else if (slot.rounds.length) { slot.rounds = []; persist(); changeSource = 'rollback'; }
          current = -1;
        } else {
          const found = slot.rounds.findIndex(round => round.aiId === sid(ai));
          let parsed, parseError;
          try { parsed = parse(ai.content); }
          catch (error) { parseError = error; parsed = { block: ai.content }; }
          if (found >= 0) {
            if (force || latestChanged) changeSource = force ? 'reset' : 'sync';
            if (force || generatingUser === slot.rounds[found].userId || parsed.block !== slot.rounds[found].block) {
              const base = found === 0 ? slot.initial : slot.rounds[found - 1].snapshot;
              const source = force ? 'reset' : 'ai';
              slot.rounds[found] = calculate(base, slot.rounds[found].userId, sid(ai), parsed, parseError, force, source, found);
              changeSource = source;
              persist();
            }
            current = found;
            if (slot.rounds.length > found + 1) {
              slot.rounds.length = found + 1;
              if (changeSource !== 'ai' && changeSource !== 'reset') changeSource = 'rollback';
              persist();
            }
          } else {
            const aiPosition = rows.indexOf(ai);
            let parentUser;
            let previousAi;
            for (let i = aiPosition - 1; i >= 0; i--) {
              if (!parentUser && rows[i].role === 'user') parentUser = rows[i];
              if (rows[i].role === 'ai') { previousAi = rows[i]; break; }
            }
            if (!parentUser || sid(parentUser) === null) { if (force) throw new Error('等待用户消息身份'); stateLabel = '等待用户消息身份'; changed(hookContext('state')); return; }
            let position = slot.rounds.findIndex(round => round.userId === sid(parentUser));
            if (position < 0) {
              if (previousAi?.id === 'greeting') position = 0;
              else {
                const previous = slot.rounds.findIndex(round => round.aiId === (previousAi && sid(previousAi)));
                if (previous < 0) throw new Error('找不到上一轮快照');
                position = previous + 1;
              }
            }
            const base = position === 0 ? slot.initial : slot.rounds[position - 1].snapshot;
            const round = calculate(base, sid(parentUser), sid(ai), parsed, parseError, force, force ? 'reset' : 'ai', position);
            slot.rounds.splice(position, slot.rounds.length - position, round);
            current = position;
            changeSource = force ? 'reset' : 'ai';
            persist();
          }
        }
        signature = next;
        usable = true;
        generatingUser = null;
        const error = current < 0 ? '' : slot.rounds[current].error || '';
        if (error && lastError !== error) report(new Error(error));
        lastError = error;
        stateLabel = error ? '本轮更新未生效，已沿用此前变量：' + error : '就绪';
        changed(hookContext(changeSource || 'sync'));
      } catch (error) {
        if (canKeepCurrent) { usable = true; stateLabel = error.message; report(error); changed(hookContext('state')); throw error; }
        fail(error); if (force) throw error;
      }
    }
    function snapshot() { return current === -1 ? slot.initial : slot.rounds[current].snapshot; }
    const api = {
      sync: () => sync(),
      resetCurrent() { sync(true); return copy(snapshot()); },
      validate(data) { return validate(data); },
      getCurrent() {
        sync();
        if (!usable) throw new Error(stateLabel);
        return copy(snapshot());
      },
      getReply(serverId) {
        if (!slot) throw new Error('无对应存档');
        if (serverId === null) return copy(slot.initial);
        const round = slot.rounds.find(r => r.aiId === String(serverId));
        if (!round) throw new Error('无对应回复快照');
        return copy(round.snapshot);
      },
      getReplyReport(serverId) {
        if (!slot) throw new Error('无对应存档');
        const round = slot.rounds.find(r => r.aiId === String(serverId));
        if (!round) throw new Error('无对应回复诊断');
        return copy(round.report);
      },
      getReplySnapshot(message) {
        if (!message || message.role !== 'ai') throw new Error('需要 AI 回复消息');
        api.sync();
        const serverId = message.serverId == null ? null : String(message.serverId);
        if (serverId !== null && api.getReplyReport(serverId).status === 'error') throw new Error('本轮更新未生效');
        return api.getReply(serverId);
      },
      applyPlayer(operations) {
        const candidate = apply(api.getCurrent(), operations);
        const updated = window.MvuJson.prepare(candidate, derive, hookContext('player'), validate).snapshot;
        if (current === -1) slot.initial = updated;
        else slot.rounds[current].snapshot = updated;
        persist();
        changed(hookContext('player'));
        return copy(updated);
      },
      replace(path, value) { return api.applyPlayer([{ op: 'replace', path, value }]); },
      delta(path, value) { return api.applyPlayer([{ op: 'delta', path, value }]); },
      insert(path, value) { return api.applyPlayer([{ op: 'insert', path, value }]); },
      remove(path) { return api.applyPlayer([{ op: 'remove', path }]); },
      info() { return { status: saveError || stateLabel, ready: usable, slotId: slot?.id, replyId: slot && current >= 0 ? slot.rounds[current]?.aiId : null, round: current + 1 }; },
      switchConversation() {
        writer.reset();
        slot = null; current = -1; usable = false; signature = null;
        generatingUser = null;
        lastError = ''; saveError = ''; stateLabel = '等待消息加载';
        changed(hookContext('switch'));
      },
      stop() { stopped = true; writer.reset(); },
    };
    return api;
  };
})();
