export const OCR_VERSION = '7.0.0';

/** `public/ocr/<version>/` layout. Only the LSTM-only core builds are listed:
 * the engine runs in LSTM mode, so the legacy cores are never requested. Each
 * core `.wasm.js` embeds its WebAssembly, so no separate `.wasm` is served. */
export const OCR_ASSETS = [
  {
    package: 'tesseract.js',
    source: 'dist/worker.min.js',
    destination: 'worker.js',
  },
  {
    package: 'tesseract.js',
    source: 'LICENSE.md',
    destination: 'LICENSE-tesseract.js.md',
  },
  {
    package: 'tesseract.js-core',
    source: 'tesseract-core-lstm.wasm.js',
    destination: 'core/tesseract-core-lstm.wasm.js',
  },
  {
    package: 'tesseract.js-core',
    source: 'tesseract-core-simd-lstm.wasm.js',
    destination: 'core/tesseract-core-simd-lstm.wasm.js',
  },
  {
    package: 'tesseract.js-core',
    source: 'tesseract-core-relaxedsimd-lstm.wasm.js',
    destination: 'core/tesseract-core-relaxedsimd-lstm.wasm.js',
  },
  {
    package: 'tesseract.js-core',
    source: 'LICENSE',
    destination: 'LICENSE-tesseract.js-core',
  },
  {
    package: '@tesseract.js-data/eng',
    source: '4.0.0_best_int/eng.traineddata.gz',
    destination: 'lang/eng.traineddata.gz',
  },
];

export const OCR_PACKAGE_VERSIONS = {
  'tesseract.js': '7.0.0',
  'tesseract.js-core': '7.0.0',
  '@tesseract.js-data/eng': '1.0.0',
};
