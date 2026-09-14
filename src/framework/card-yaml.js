(function () {
  function string(value) {
    const reserved = /^(?:null|true|false|yes|no|on|off|y|n)$/i;
    if (value.trim() === value && /^[\p{L}_][\p{L}\p{N}_ .\/-]*$/u.test(value) && !reserved.test(value)) return value;
    return JSON.stringify(value).replace(/[\u0085\u2028\u2029]/g, char => String.fromCharCode(92) + 'u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  }

  function scalar(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return string(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value).replace(/^(\-?\d+)e/, '$1.0e');
    throw new Error('YAML 只支持普通 JSON 数据');
  }

  function lines(value, depth) {
    const indent = '  '.repeat(depth);
    if (value === null || typeof value !== 'object') return [indent + scalar(value)];
    const array = Array.isArray(value);
    if (!array && Object.getPrototypeOf(value) !== Object.prototype) throw new Error('YAML 只支持普通 JSON 数据');
    const entries = array ? Array.from(value, (child, index) => [index, child]) : Object.entries(value);
    if (!entries.length) return [indent + (array ? '[]' : '{}')];
    return entries.flatMap(([key, child]) => {
      const prefix = indent + (array ? '-' : string(key) + ':');
      const nested = lines(child, depth + 1);
      const container = child !== null && typeof child === 'object' && Object.keys(child).length > 0;
      return container ? [prefix, ...nested] : [prefix + ' ' + nested[0].slice((depth + 1) * 2)];
    });
  }

  CARD.yaml = Object.freeze({
    stringify(value) {
      return lines(value, 0).join('\n');
    },
  });
})();
