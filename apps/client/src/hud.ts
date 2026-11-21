import { WORLD } from "@desert/sim";

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
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The whole playable oval, with a small margin.
    const b = WORLD.boundary;
    const k = Math.min(width / (b.rx * 2), height / (b.rz * 2)) * 0.96;
    const px = (x: number) => width / 2 + x * k;
    const pz = (z: number) => height / 2 + z * k; // north (-z) is up

    c.clearRect(0, 0, width, height);
    c.fillStyle = "#e8cc96";
    c.beginPath();
    c.ellipse(width / 2, height / 2, b.rx * k, b.rz * k, 0, 0, Math.PI * 2);
    c.fill();
    // Fixed geography, faintly, so the map can be read.
    c.fillStyle = "rgba(140, 90, 50, 0.45)";
    for (const r of WORLD.rocks) {
      c.beginPath();
      c.arc(px(r.x), pz(r.z), Math.max(1, r.radius * k), 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = "rgba(120, 75, 40, 0.6)";
    c.lineWidth = 1.5;
    for (const w of WORLD.walls) {
      const dx = (Math.cos(w.angle) * w.length) / 2;
      const dz = (Math.sin(w.angle) * w.length) / 2;
      c.beginPath();
      c.moveTo(px(w.x - dx), pz(w.z - dz));
      c.lineTo(px(w.x + dx), pz(w.z + dz));
      c.stroke();
    }
    c.fillStyle = "rgba(90, 58, 32, 0.75)";
    c.font = "10px system-ui, sans-serif";
    c.textAlign = "center";
    for (const l of WORLD.landmarks) c.fillText(l.name, px(l.x), pz(l.z) - 6);
    c.textAlign = "start";
    // Active wells.
    for (const w of wells) {
      c.fillStyle = "#1f6f9a";
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(px(w.x), pz(w.z), 4, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    // Other players.
    for (const p of others) {
      if (p.phase === "dead") continue;
      c.fillStyle = p.phase === "terminal" ? "rgba(60,40,30,0.5)" : "#3b2a1a";
      c.beginPath();
      c.arc(px(p.x), pz(p.z), 3, 0, Math.PI * 2);
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
    c.fillText("N", width / 2 - 4, 13);
  }
}

/** Traditional horizontal health bar. Health means distance from death, not fitness. */
export function drawHealth(fill: HTMLElement, label: HTMLElement, health: number, phase: string, inShade: boolean): void {
  const h = Math.max(0, Math.min(100, health));
  fill.style.width = `${h}%`;
  fill.style.backgroundColor = h > 50 ? "#3fa7cf" : h > 20 ? "#e09a3a" : "#d2412f";
  const box = fill.closest<HTMLElement>("#health");
  if (box) box.dataset.level = phase !== "dead" && h <= 20 ? "low" : "ok";
  const state =
    phase === "dead" ? "Dead" : phase === "terminal" ? "Dying" : h <= 20 ? "Desperate" : h <= 50 ? "Dangerous" : "Hydrated";
  label.textContent = `${Math.ceil(h)}% · ${state}${phase !== "dead" && inShade ? " · in shade" : ""}`;
}
