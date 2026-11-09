// Local-only: prints OCR word boxes for an image-only statement PDF to stdout.
// Usage: node scripts/ocr-dump.mjs <statement.pdf>
// Writes no files and makes no network call: the engine, core and model come
// from node_modules, and pages are PNG-encoded in memory with node:zlib.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const file = process.argv[2];
if (!file) {
  process.stderr.write('Usage: node scripts/ocr-dump.mjs <statement.pdf>\n');
  process.exit(2);
}

const require = createRequire(import.meta.url);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createWorker, OEM } = require('tesseract.js');
const langDir = path.dirname(
  require.resolve('@tesseract.js-data/eng/package.json')
);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function toRgba({ width, height, data, kind }) {
  if (kind === 3) return new Uint8ClampedArray(data);
  const pixels = width * height;
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    if (kind === 1) {
      const bit = (data[i >> 3] >> (7 - (i & 7))) & 1;
      rgba.fill(bit ? 255 : 0, i * 4, i * 4 + 3);
    } else {
      rgba[i * 4] = data[i * 3];
      rgba[i * 4 + 1] = data[i * 3 + 1];
      rgba[i * 4 + 2] = data[i * 3 + 2];
    }
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

async function pageImage(page) {
  const ops = await page.getOperatorList();
  const { OPS } = pdfjs;
  let best = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== OPS.paintImageXObject) continue;
    const id = ops.argsArray[i][0];
    const image = await new Promise((resolve) => {
      page.objs.get(id, resolve);
    });
    if (
      image &&
      (!best || image.width * image.height > best.width * best.height)
    )
      best = image;
  }
  return best;
}

const bytes = new Uint8Array(await readFile(file));
const loading = pdfjs.getDocument({
  data: bytes,
  disableFontFace: true,
  verbosity: 0,
});
const pdf = await loading.promise;
const worker = await createWorker('eng', OEM.LSTM_ONLY, {
  langPath: path.join(langDir, '4.0.0_best_int'),
  cacheMethod: 'none',
  gzip: true,
});

try {
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const [x0, y0, x1, y1] = page.view;
    const widthPoints = x1 - x0;
    const heightPoints = y1 - y0;
    const image = await pageImage(page);
    if (!image) {
      process.stdout.write(`# page ${number}: no embedded image\n`);
      continue;
    }
    const png = encodePng(image.width, image.height, toRgba(image));
    const { data } = await worker.recognize(png, {}, { blocks: true });
    const sx = widthPoints / image.width;
    const sy = heightPoints / image.height;
    process.stdout.write(
      `# page ${number}: image ${image.width}x${image.height}px, page ${widthPoints}x${heightPoints}pt\n`
    );
    process.stdout.write(
      '# text\tpx_x0\tpx_y0\tpx_x1\tpx_y1\tpt_x\tpt_y\tconf\n'
    );
    for (const block of data.blocks ?? [])
      for (const paragraph of block.paragraphs)
        for (const line of paragraph.lines)
          for (const word of line.words) {
            const b = word.bbox;
            const row = [
              word.text,
              b.x0,
              b.y0,
              b.x1,
              b.y1,
              (b.x0 * sx).toFixed(1),
              (heightPoints - b.y1 * sy).toFixed(1),
              word.confidence.toFixed(0),
            ];
            process.stdout.write(`${row.join('\t')}\n`);
          }
    page.cleanup();
  }
} finally {
  await worker.terminate();
  await loading.destroy();
}
