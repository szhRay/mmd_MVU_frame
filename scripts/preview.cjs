const path = require('node:path');
const { buildPreview } = require('./build-lib.cjs');

const root = path.resolve(__dirname, '..');
buildPreview({ root, outDir: path.join(root, 'output') });
console.log('已生成 output/card-preview.html');
