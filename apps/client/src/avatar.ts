import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildCrawler, poseCrawler, poseLying, type CrawlerRig } from "./art/placeholders.ts";

/**
 * One character on screen. Uses the artist's crawler.glb when present
 * (playing its "crawl" / "crawl_idle" clips), otherwise the code placeholder.
 */
export class Avatar {
  readonly object = new THREE.Group();
  private rig: CrawlerRig | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private phase = 0;
  private breath = Math.random() * 10;
  private label: THREE.Sprite;

  constructor(name: string, art: GLTF | null) {
    if (art) {
      const model = cloneSkinned(art.scene);
      this.object.add(model);
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of art.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    } else {
      this.rig = buildCrawler();
      this.object.add(this.rig.root);
    }
    this.label = makeLabel(name);
    this.label.position.y = 1.3;
    this.object.add(this.label);
  }

  private twitchTime = 0;

  /** A tiny involuntary reaction while dying (keyboard or mouse input). */
  twitch(): void {
    this.twitchTime = 0.5;
  }

  /**
   * speed: metres per second actually travelled, drives the crawl cycle.
   * phase: "alive" | "terminal" | "dead". health: 0-100, weakens dying breath.
   */
  update(dt: number, speed: number, phase: string, health: number): void {
    this.object.visible = phase !== "dead"; // the skeleton marker takes over
    if (phase === "dead") return;
    const moving = phase === "alive" && speed > 0.05;
    const dying = phase === "terminal";
    this.breath += dt * (dying ? 1.4 : 2.2 + speed * 2);
    this.twitchTime = Math.max(0, this.twitchTime - dt);
    const twitch = Math.sin(this.twitchTime * 25) * this.twitchTime * 2;
    if (this.mixer) {
      this.play(dying ? "dying_breathe" : moving ? "crawl" : "crawl_idle");
      this.mixer.update(dt);
    } else if (this.rig) {
      if (dying) {
        poseLying(this.rig, this.breath, Math.max(0.15, health / 10), twitch);
      } else {
        if (moving) this.phase += dt * speed * 7;
        this.rig.body.rotation.set(0, 0, 0);
        poseCrawler(this.rig, this.phase, this.breath);
      }
    }
  }

  private play(name: string): void {
    const next = this.actions.get(name) ?? this.actions.values().next().value ?? null;
    if (!next || next === this.current) return;
    next.reset().fadeIn(0.4).play();
    this.current?.fadeOut(0.4);
    this.current = next;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.label.material.map?.dispose();
    this.label.material.dispose();
  }
}

export function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(60,40,20,0.8)";
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = "#fff7e8";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: true }));
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}
