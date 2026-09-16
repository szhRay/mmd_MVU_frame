const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const card = JSON.parse(fs.readFileSync(path.join(root, 'output', 'card-regex.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'scripts', 'preview-store.js'), 'utf8').trim();
card.regex_scripts.unshift({
  id: -1,
  scriptName: '仿真·消息仓适配器',
  findRegex: '/__CARD_TEST_STORE__/',
  replaceString: '<script>\n' + source + '\n</script>',
});
card.regex_scripts.forEach((rule, index) => { rule.id = -1 - index; });
const out = path.join(root, '工作');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'card-preview-fixture.json'), JSON.stringify(card, null, 2).replace(/<\/script>/gi, '<\\/script>') + '\n');
console.log('已生成仅供 tavern-mmd 本地仿真的消息仓夹具；正式导入仍使用 output/card-regex.json。');
