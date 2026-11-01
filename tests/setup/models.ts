import { readFile } from 'node:fs/promises';
import { loadModelLibrary } from '../../src/weapons/models/modelLibrary';

/** Every test file starts with the Blender-built models loaded, as the game does at startup. */
await loadModelLibrary(async (file) => {
  const buf = await readFile(new URL(`../../public/models/${file}`, import.meta.url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
});
