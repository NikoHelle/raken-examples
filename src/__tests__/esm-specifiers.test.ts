import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The build is plain `tsc`, so emitted specifiers are whatever the source says; native Node ESM does
// no extension probing, so a relative import without `.js` fails with ERR_MODULE_NOT_FOUND.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPECIFIERS = [
  /\bfrom\s+['"](\.\.?\/[^'"]+)['"]/g, // import … from './x' / export … from './x'
  /\bimport\s+['"](\.\.?\/[^'"]+)['"]/g, // side-effect import './x'
  /\bimport\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g, // dynamic import('./x')
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('emitted ESM specifiers', () => {
  it('every relative import/export in src carries a .js extension', () => {
    const offending: string[] = [];
    for (const file of sourceFiles(srcDir)) {
      const text = readFileSync(file, 'utf8');
      for (const re of SPECIFIERS) {
        for (const match of text.matchAll(re)) {
          const spec = match[1]!;
          if (!spec.endsWith('.js')) offending.push(`${relative(srcDir, file)} → ${spec}`);
        }
      }
    }
    expect(offending).toEqual([]);
  });
});
