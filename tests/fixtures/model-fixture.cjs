const initial = { counter: 0, _double: 0 };

function derive(value) {
  value._double = value.counter * 2;
}

function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('变量必须是对象');
  if (Object.keys(value).sort().join(',') !== '_double,counter') throw new Error('变量字段不严格');
  if (!Number.isInteger(value.counter) || !Number.isInteger(value._double)) throw new Error('变量必须是整数');
  if (value._double !== value.counter * 2) throw new Error('派生字段无效');
  return JSON.parse(JSON.stringify(value));
}

module.exports = { initial, derive, validate };
