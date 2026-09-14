// 作者配置：Schema 只验证，derive 统一计算派生字段。
(function () {
  // ===== 作者可填写区域：开始 =====

  function schema(z) {
    return z.object({}).strict();
  }

  function derive(variables, context) {
  }

  // ===== 作者可填写区域：结束 =====

  window.MVU_MODEL = { schema, derive };
})();
