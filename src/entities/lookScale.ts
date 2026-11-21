/**
 * Mouse speed while zoomed: scaled by tan(zoomed FOV / 2) / tan(hip FOV / 2), so a target near the
 * crosshair moves across the screen at the same speed as at the hip (any sight, not only scopes).
 * Both FOVs are vertical, in degrees.
 */
export function zoomLookScale(fovDeg: number, hipFovDeg: number): number {
  if (fovDeg >= hipFovDeg) return 1;
  const half = (deg: number): number => Math.tan((deg * Math.PI) / 360);
  return half(fovDeg) / half(hipFovDeg);
}

/** Horizontal FOV (degrees) for a vertical FOV at an aspect ratio (width / height). */
export function horizontalFov(verticalDeg: number, aspect: number): number {
  return (2 * Math.atan(Math.tan((verticalDeg * Math.PI) / 360) * aspect) * 180) / Math.PI;
}
