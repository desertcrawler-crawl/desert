import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildCrawler, poseCrawler, poseLying, type CrawlerRig } from "./art/placeholders.ts";

const ONE_SHOT_CLIPS = new Set(["stand_up", "lie_down", "death"]);

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
      for (const clip of art.animations) {
        const action = this.mixer.clipAction(clip);
        // Transitions play once and hold their last pose instead of looping.
        if (ONE_SHOT_CLIPS.has(clip.name)) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        this.actions.set(clip.name, action);
      }
    } else {
      this.rig = buildCrawler();
      this.object.add(this.rig.root);
    }
    this.label = makeLabel(name);
    this.label.position.y = 1.3;
    this.object.add(this.label);
  }

  private twitchTime = 0;
  private slappedTime = 0;
  private slapTime = 0;
  private upright = 0;

  /** Comic reaction when this character gets slapped. */
  slapped(): void {
    this.slappedTime = 0.8;
  }

  /** The slapping arm swing. */
  slapping(): void {
    this.slapTime = 0.4;
  }

  /** A tiny involuntary reaction while dying (keyboard or mouse input). */
  twitch(): void {
    this.twitchTime = 0.5;
  }

  /**
   * speed: metres per second actually travelled, drives the crawl cycle.
   * phase: "alive" | "terminal" | "dead". health: 0-100, weakens dying breath.
   */
  update(dt: number, speed: number, phase: string, health: number, posture = "crawl"): void {
    this.object.visible = phase !== "dead"; // the skeleton marker takes over
    if (phase === "dead") return;
    const moving = phase === "alive" && speed > 0.05;
    const dying = phase === "terminal";
    this.breath += dt * (dying ? 1.4 : 2.2 + speed * 2);
    this.twitchTime = Math.max(0, this.twitchTime - dt);
    this.slappedTime = Math.max(0, this.slappedTime - dt);
    this.slapTime = Math.max(0, this.slapTime - dt);
    const twitch = Math.sin(this.twitchTime * 25) * this.twitchTime * 2;
    // Standing up and getting down are slow: blend over the transition.
    const wantUp = posture === "walk" || posture === "standingUp" ? 1 : 0;
    const rate = posture === "standingUp" ? 1 / 3 : 1 / 2;
    this.upright += Math.sign(wantUp - this.upright) * Math.min(Math.abs(wantUp - this.upright), dt * rate);
    this.label.position.y = 1.3 + 0.7 * this.upright; // keep the name above the head when standing
    if (this.mixer) {
      const clip = dying
        ? "dying_breathe"
        : this.slappedTime > 0
          ? "slapped"
          : this.slapTime > 0
            ? "slap"
            : posture === "standingUp"
              ? "stand_up"
              : posture === "lyingDown"
                ? "lie_down"
                : posture === "walk"
                  ? moving ? "walk" : "walk_idle"
                  : moving ? "crawl" : "crawl_idle";
      this.play(clip);
      this.mixer.update(dt);
    } else if (this.rig) {
      if (dying) {
        poseLying(this.rig, this.breath, Math.max(0.15, health / 10), twitch + 3 * Math.sin(this.slappedTime * 30) * this.slappedTime);
      } else {
        if (moving) this.phase += dt * speed * (this.upright > 0.5 ? 5 : 7);
        poseCrawler(this.rig, this.phase, this.breath, this.upright);
        // Slapped: a comic head-spinning wobble. Slapping: one arm swings.
        this.rig.body.rotation.y = Math.sin(this.slappedTime * 28) * this.slappedTime * 0.9;
        if (this.slapTime > 0) this.rig.armR.rotation.x = -2.2 * Math.sin((this.slapTime / 0.4) * Math.PI);
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
  ctx.lineJoin = "round";
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
