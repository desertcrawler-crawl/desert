import * as THREE from "three";
import { terrainHeight } from "@desert/sim";
import { loadArt } from "./art/loader.ts";
import { buildCross, buildSkeleton, buildWell } from "./art/placeholders.ts";
import { makeLabel } from "./avatar.ts";

type Template = () => THREE.Object3D;

/** Use the artist's model for a slot when there is one, otherwise the placeholder. */
async function template(slot: "well" | "skeleton" | "cross", fallback: Template): Promise<Template> {
  const art = await loadArt(slot);
  return art ? () => art.scene.clone() : fallback;
}

export interface PropTemplates {
  well: Template;
  skeleton: Template;
  cross: Template;
}

export async function loadPropTemplates(): Promise<PropTemplates> {
  const [well, skeleton, cross] = await Promise.all([
    template("well", buildWell),
    template("skeleton", buildSkeleton),
    template("cross", buildCross),
  ]);
  return { well, skeleton, cross };
}

export function placeWell(t: PropTemplates, x: number, z: number): THREE.Object3D {
  const o = t.well();
  o.position.set(x, terrainHeight(x, z) - 0.05, z);
  return o;
}

/** A skeleton on its back with a wooden cross beside it carrying the name. */
export function placeMarker(t: PropTemplates, name: string, x: number, z: number, heading: number): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(x, terrainHeight(x, z), z);
  g.rotation.y = Math.PI - heading;
  const skeleton = t.skeleton();
  g.add(skeleton);
  const cross = t.cross();
  cross.position.set(0.7, 0, 0.6);
  g.add(cross);
  const label = makeLabel(name);
  label.position.set(0.7, 1.45, 0.6);
  g.add(label);
  return g;
}

/** The small luminous life force that floats up and vanishes after death. */
export class Sparkle {
  readonly object: THREE.Sprite;
  private age = 0;
  constructor(position: THREE.Vector3) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,240,1)");
    grad.addColorStop(0.3, "rgba(255,240,170,0.8)");
    grad.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    this.object = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.object.position.copy(position).add(new THREE.Vector3(0, 0.4, 0));
    this.object.scale.setScalar(0.5);
  }
  /** Returns false when finished. */
  update(dt: number): boolean {
    this.age += dt;
    this.object.position.y += dt * 1.6;
    this.object.position.x += Math.sin(this.age * 4) * dt * 0.3;
    const m = this.object.material;
    m.opacity = this.age < 3 ? 1 : Math.max(0, 1 - (this.age - 3));
    this.object.scale.setScalar(0.5 + 0.1 * Math.sin(this.age * 10));
    if (this.age > 4) {
      this.object.removeFromParent();
      m.map?.dispose();
      m.dispose();
      return false;
    }
    return true;
  }
}
