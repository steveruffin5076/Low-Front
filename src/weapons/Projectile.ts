/** One fixed step of a bullet under gravity (exact for constant acceleration). Mutates `pos` and `vel` ([x, y, z]). */
export function stepProjectile(pos: number[], vel: number[], dt: number, gravity: number): void {
  pos[0] += vel[0] * dt;
  pos[1] += vel[1] * dt - 0.5 * gravity * dt * dt;
  pos[2] += vel[2] * dt;
  vel[1] -= gravity * dt;
}
