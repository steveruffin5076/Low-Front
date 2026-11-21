import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
// The official Khronos glTF validator (threejs-gltf-loading skill: validate every new or changed file).
// @ts-expect-error: the package ships no type definitions.
import { validateBytes } from 'gltf-validator';

interface Report {
  issues: { numErrors: number; numWarnings: number; messages: { code: string; message: string; pointer?: string }[] };
}

const manifest = JSON.parse(await readFile(new URL('../public/models/manifest.json', import.meta.url), 'utf8')) as Record<string, { file: string }>;

describe('Blender model files', () => {
  it.each(Object.entries(manifest))('%s passes the glTF validator with no errors or warnings', async (_key, entry) => {
    const bytes = await readFile(new URL(`../public/models/${entry.file}`, import.meta.url));
    const report = (await validateBytes(new Uint8Array(bytes))) as Report;
    const problems = report.issues.messages.map((m) => `${m.code} ${m.pointer ?? ''}: ${m.message}`);
    expect(report.issues.numErrors, problems.join('\n')).toBe(0);
    expect(report.issues.numWarnings, problems.join('\n')).toBe(0);
  });
});
