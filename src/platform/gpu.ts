/**
 * Built-in (integrated) graphics, from the WebGL renderer name: Intel UHD/Iris/HD (not Arc),
 * AMD APU "Radeon(TM) Graphics" / Vega, or a software renderer. On a laptop that also has a
 * graphics card, the browser often picks these, which costs a lot of frame rate.
 */
export function isBuiltInGpu(name: string): boolean {
  if (/\bArc\b/i.test(name)) return false;
  return /Intel|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d*\s*Graphics|Microsoft Basic Render|SwiftShader|llvmpipe/i.test(name);
}
