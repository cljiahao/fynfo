import { cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OCR_ASSETS,
  OCR_PACKAGE_VERSIONS,
  OCR_VERSION,
} from './ocr-asset-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const destination = path.join(root, 'public', 'ocr', OCR_VERSION);
const sources = new Map();

for (const [name, version] of Object.entries(OCR_PACKAGE_VERSIONS)) {
  const packagePath = require.resolve(`${name}/package.json`);
  const metadata = JSON.parse(await readFile(packagePath, 'utf8'));
  if (metadata.version !== version)
    throw new Error(`Unexpected ${name} version`);
  sources.set(name, path.dirname(packagePath));
}

for (const asset of OCR_ASSETS) {
  const target = path.join(destination, asset.destination);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(sources.get(asset.package), asset.source), target);
}
