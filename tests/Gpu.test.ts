import { describe, expect, it } from 'vitest';
import { isBuiltInGpu } from '../src/platform/gpu';

describe('built-in GPU detection', () => {
  it('flags integrated and software renderers, not graphics cards', () => {
    for (const name of ['Intel(R) UHD Graphics', 'Intel(R) Iris(R) Xe Graphics', 'AMD Radeon(TM) Graphics', 'AMD Radeon(TM) Vega 8 Graphics', 'Microsoft Basic Render Driver', 'Vulkan 1.3.0 (SwiftShader Device (Subzero)']) {
      expect(isBuiltInGpu(name), name).toBe(true);
    }
    for (const name of ['NVIDIA GeForce RTX 3050 Laptop GPU', 'AMD Radeon RX 6600M', 'Intel(R) Arc(TM) A770 Graphics', 'Apple M1']) {
      expect(isBuiltInGpu(name), name).toBe(false);
    }
  });
});
