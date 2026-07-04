/**
 * Generate PWA icons using @resvg/resvg-js (pure Rust/WASM, no native deps needed)
 * Run: node gen-icons.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const svgPath = path.join(__dirname, 'public', 'logo.svg');
const outDir = path.join(__dirname, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const svgStr = readFileSync(svgPath, 'utf8');

let Resvg;
try {
  ({ Resvg } = require('@resvg/resvg-js'));
} catch {
  console.error('Missing dep. Run:  npm install --save-dev @resvg/resvg-js');
  process.exit(1);
}

for (const size of [192, 512]) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(255,255,255,0)',
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const outPath = path.join(outDir, `icon-${size}.png`);
  writeFileSync(outPath, pngBuffer);
  console.log(`✓ ${outPath} (${size}×${size})`);
}

console.log('\nIcons ready in public/icons/');
