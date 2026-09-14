const path = require('node:path');
const { buildProject, readConfig } = require('./build-lib.cjs');

const root = path.resolve(__dirname, '..');
const plugins = readConfig(root);
const card = buildProject({ root, plugins, outDir: path.join(root, 'output') });
console.log('已构建通用 MVU：' + card.regex_scripts.length + ' 条规则，插件：' + (plugins.join(', ') || '无'));
