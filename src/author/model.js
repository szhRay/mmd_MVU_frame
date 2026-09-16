// 作者配置：Schema 只添加必要约束并保留未声明字段，derive 统一计算派生字段。
(function () {
  // ===== 作者可填写区域：开始 =====

  function schema(z) {
    return z.object({}).passthrough();
  }

  function derive(variables, context) {
  }

  // ===== 作者可填写区域：结束 =====

  window.MVU_MODEL = { schema, derive };
})();
