(function () {
  window.createMvuValidator = schema => data => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw Object.assign(new Error(result.error.issues.map(issue => '/' + issue.path.map(String).map(part => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/') + '：' + issue.message).join('；')), { kind: 'schema', issues: result.error.issues });
    }
    function check(value) {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
      if (typeof value === 'number' && Number.isFinite(value)) return;
      if (Array.isArray(value)) { value.forEach(check); return; }
      if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) { Object.values(value).forEach(check); return; }
      throw new Error('校验结果必须是JSON数据');
    }
    check(result.data);
    return JSON.parse(JSON.stringify(result.data));
  };
})();
