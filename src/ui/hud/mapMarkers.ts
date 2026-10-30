import { HUD } from '../../data/hud';
import type { TeamId } from '../../data/map/types';

/** Something drawn on a map view, in map meters. */
export interface MapMarker {
  x: number;
  z: number;
  /** A crate is one your team can use (owned flag). */
  kind: 'ally' | 'enemy' | 'crate';
  /** Soldier dots are drawn in their team's color. */
  team?: TeamId;
}

/** A flag on a map view: letter in a circle filled with the owner's color. */
export interface FlagMarker {
  id: string;
  x: number;
  z: number;
  owner: TeamId | null;
}

export function teamColor(team: TeamId | null): string {
  return team ? HUD.team[team] : HUD.team.neutral;
}

export function drawFlag(g: CanvasRenderingContext2D, px: number, py: number, f: FlagMarker, radius: number = HUD.flagMarker.radius): void {
  g.beginPath();
  g.arc(px, py, radius, 0, Math.PI * 2);
  g.fillStyle = teamColor(f.owner);
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.stroke();
  g.fillStyle = f.owner ? '#fff' : '#1a1d21';
  g.font = HUD.flagMarker.font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(f.id, px, py + 0.5);
}

export function drawDot(g: CanvasRenderingContext2D, px: number, py: number, m: MapMarker): void {
  if (m.kind === 'crate') {
    // Small white box with a green cross: a resupply crate.
    g.fillStyle = '#f1f3f5';
    g.fillRect(px - 4, py - 4, 8, 8);
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.strokeRect(px - 4, py - 4, 8, 8);
    g.fillStyle = '#2f9e44';
    g.fillRect(px - 3, py - 1, 6, 2);
    g.fillRect(px - 1, py - 3, 2, 6);
    return;
  }
  g.beginPath();
  g.arc(px, py, 3.5, 0, Math.PI * 2);
  g.fillStyle = teamColor(m.team ?? (m.kind === 'ally' ? 'blue' : 'red'));
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = '#000';
  g.stroke();
}

/** The player: an arrow pointing `angle` radians clockwise from up. */
export function drawPlayer(g: CanvasRenderingContext2D, px: number, py: number, angle: number, size = 8): void {
  g.save();
  g.translate(px, py);
  g.rotate(angle);
  g.beginPath();
  g.moveTo(0, -size);
  g.lineTo(size * 0.7, size * 0.75);
  g.lineTo(0, size * 0.35);
  g.lineTo(-size * 0.7, size * 0.75);
  g.closePath();
  g.fillStyle = '#ffe066';
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = '#000';
  g.stroke();
  g.restore();
}
