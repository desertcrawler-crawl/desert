import { GREYBOX } from "@desert/sim";

export interface MapPlayer {
  x: number;
  z: number;
  heading: number;
  phase: string;
}

/**
 * Always-visible flat minimap, upper right, north-up, sand-coloured.
 * Shows you (with a facing arrow), every other player and every active well.
 * Skeletons are not shown (spec proposal for launch).
 */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  draw(me: MapPlayer | undefined, others: MapPlayer[], wells: { x: number; z: number }[]): void {
    const c = this.ctx;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const size = this.canvas.clientWidth;
    if (this.canvas.width !== size * dpr) {
      this.canvas.width = this.canvas.height = size * dpr;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const half = GREYBOX.halfSize;
    const k = size / (half * 2);
    const px = (x: number) => (x + half) * k;
    const pz = (z: number) => (z + half) * k; // north (-z) is up

    c.fillStyle = "#e8cc96";
    c.fillRect(0, 0, size, size);
    // Fixed geography, faintly, so the map can be read.
    c.fillStyle = "rgba(140, 90, 50, 0.45)";
    for (const r of GREYBOX.rocks) {
      c.beginPath();
      c.arc(px(r.x), pz(r.z), Math.max(2, r.radius * k), 0, Math.PI * 2);
      c.fill();
    }
    // Active wells.
    for (const w of wells) {
      c.fillStyle = "#1f6f9a";
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(px(w.x), pz(w.z), 5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    // Other players.
    for (const p of others) {
      if (p.phase === "dead") continue;
      c.fillStyle = p.phase === "terminal" ? "rgba(60,40,30,0.5)" : "#3b2a1a";
      c.beginPath();
      c.arc(px(p.x), pz(p.z), 3.5, 0, Math.PI * 2);
      c.fill();
    }
    // You: a red arrow showing your facing.
    if (me) {
      c.save();
      c.translate(px(me.x), pz(me.z));
      c.rotate(me.heading);
      c.fillStyle = "#c0392b";
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, -8);
      c.lineTo(6, 6);
      c.lineTo(0, 3);
      c.lineTo(-6, 6);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }
    c.fillStyle = "rgba(59,42,26,0.8)";
    c.font = "bold 11px system-ui, sans-serif";
    c.fillText("N", size / 2 - 4, 13);
  }
}

/** Traditional horizontal health bar. Health means distance from death, not fitness. */
export function drawHealth(fill: HTMLElement, label: HTMLElement, health: number, phase: string, inShade: boolean): void {
  const h = Math.max(0, Math.min(100, health));
  fill.style.width = `${h}%`;
  fill.style.background = h > 50 ? "#4f9d4a" : h > 20 ? "#d08a2c" : "#b8322a";
  const state =
    phase === "dead" ? "Dead" : phase === "terminal" ? "Dying" : h <= 20 ? "Desperate" : h <= 50 ? "Dangerous" : "Hydrated";
  label.textContent = `${Math.ceil(h)}% · ${state}${phase !== "dead" && inShade ? " · in shade" : ""}`;
}
