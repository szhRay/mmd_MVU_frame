const path = require('node:path');
const { buildProject } = require('./build-lib.cjs');

const root = path.resolve(__dirname, '..');
const card = buildProject({ root, outDir: path.join(root, 'output') });
console.log('已构建通用 CARD：' + card.regex_scripts.length + ' 条规则');
