// 作者配置：只接收当前变量副本。
CARD_AUTHOR.inject.variables = function (variables) {
  // ===== 作者可填写区域：开始 =====

  function visible(value) {
    if (Array.isArray(value)) return value.map(visible);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, child]) => [key, visible(child)]));
  }

  return CARD.yaml.stringify(visible(variables));

  // ===== 作者可填写区域：结束 =====
};
