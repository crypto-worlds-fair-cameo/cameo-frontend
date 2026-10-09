import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'vite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'dist-canvas-capture');
const entry = path.join(projectRoot, 'src/features/canvas-workspace/capture/canvasCaptureEntry.ts');
const manifestSource = JSON.parse(
  await readFile(
    path.join(projectRoot, 'src/features/canvas-workspace/capture/manifest-source.json'),
    'utf8'
  )
);
const sourcePaths = [
  'src/features/canvas-workspace/capture/canvasCaptureEntry.ts',
  'src/features/canvas-workspace/lib/drawBrushStroke.ts',
  'src/features/canvas-workspace/capture/manifest-source.json',
  'scripts/build-canvas-capture.mjs',
];

await build({
  configFile: false,
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: outputDirectory,
    sourcemap: false,
    minify: true,
    lib: {
      entry,
      formats: ['iife'],
      name: 'CameoCanvasCapture',
      fileName: () => 'renderer.js',
    },
  },
});

const bundle = await readFile(path.join(outputDirectory, 'renderer.js'));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', ...sourcePaths], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim();
const sourceHash = createHash('sha256');
for (const sourcePath of sourcePaths) {
  sourceHash.update(sourcePath);
  sourceHash.update('\0');
  sourceHash.update(await readFile(path.join(projectRoot, sourcePath)));
  sourceHash.update('\0');
}
await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(
    {
      rendererVersion: manifestSource.rendererVersion,
      sourceRevision: dirty ? `${revision}-dirty` : revision,
      sourceSha256: sourceHash.digest('hex'),
      bundleSha256: createHash('sha256').update(bundle).digest('hex'),
    },
    null,
    2
  )}\n`
);
