import { build } from 'esbuild';
await build({
  entryPoints: ['src/admin.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile: 'public/assets/admin.js',
});
console.log('admin.js listo');
