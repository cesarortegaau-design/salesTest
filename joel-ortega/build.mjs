import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
const comun = { bundle: true, minify: true, platform: 'browser', target: 'es2020', logLevel: 'warning' };
await build({ ...comun, entryPoints: ['src/admin.js'], format: 'esm', outfile: 'public/assets/admin.js' });
await build({ ...comun, entryPoints: ['src/lector.js'], format: 'iife', outfile: 'public/assets/lector.js' });
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.js', 'public/assets/pdf.worker.min.js');
console.log('admin.js, lector.js y pdf.worker listos');
