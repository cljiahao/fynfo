import { cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packagePath = require.resolve('pdfjs-dist/package.json');
const metadata = JSON.parse(await readFile(packagePath, 'utf8'));
if (metadata.version !== '6.4.299')
  throw new Error('Unexpected PDF.js version');
const source = path.dirname(packagePath);
const destination = path.join(root, 'public', 'pdfjs', metadata.version);
await mkdir(destination, { recursive: true });
await cp(
  path.join(source, 'build', 'pdf.worker.min.mjs'),
  path.join(destination, 'pdf.worker.mjs')
);
for (const resource of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(path.join(source, resource), path.join(destination, resource), {
    recursive: true,
  });
}
await cp(path.join(source, 'LICENSE'), path.join(destination, 'LICENSE'));
