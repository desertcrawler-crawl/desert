import * as THREE from "three";
import { terrainHeight } from "@desert/sim";

/**
 * Third-person follow camera, behind and slightly above the character.
 * Dragging the mouse orbits it temporarily; it eases back behind the
 * character when released. It never changes the character's heading.
 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yawOffset = 0;
  /** The camera's current facing: 0 = north, growing clockwise. */
  yaw = 0;
  private pitch = 0.32;
  private distance = 5;
  private dragging = false;
  private readonly smoothed = new THREE.Vector3();
  private initialised = false;

  constructor(dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
    dom.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener("pointerup", (e) => {
      this.dragging = false;
      dom.releasePointerCapture(e.pointerId);
    });
    dom.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.yawOffset -= e.movementX * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.004, 0.08, 1.2);
    });
    dom.addEventListener(
      "wheel",
      (e) => {
        this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.1), 2.5, 14);
        e.preventDefault();
      },
      { passive: false },
    );
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private bobTime = 0;
  private bobAmount = 0;
  private readonly lookAt = new THREE.Vector3();

  /** speed (m/s) adds a slight, tired sway; upright says whether the character is walking. */
  update(dt: number, target: THREE.Vector3, heading: number, speed = 0, upright = false): void {
    if (!this.dragging) this.yawOffset *= Math.exp(-dt * 1.5); // drift back behind the character
    const yaw = heading + this.yawOffset;
    this.yaw = yaw;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw)); // opposite of facing
    const horiz = Math.cos(this.pitch) * this.distance;
    const desired = new THREE.Vector3(
      target.x + back.x * horiz,
      target.y + 0.6 + Math.sin(this.pitch) * this.distance,
      target.z + back.z * horiz,
    );
    // Do not dip below the ground.
    desired.y = Math.max(desired.y, terrainHeight(desired.x, desired.z) + 0.4);
    if (!this.initialised) {
      this.smoothed.copy(desired);
      this.initialised = true;
    }
    this.smoothed.lerp(desired, 1 - Math.exp(-dt * 6));
    this.camera.position.copy(this.smoothed);
    // Look target eases too, so turns feel weighty rather than snapped.
    const want = new THREE.Vector3(target.x, target.y + 0.5, target.z);
    if (this.lookAt.lengthSq() === 0) this.lookAt.copy(want);
    this.lookAt.lerp(want, 1 - Math.exp(-dt * 9));
    // A slow, weary sway that grows with speed.
    this.bobAmount += (Math.min(speed / 1.2, 1) - this.bobAmount) * (1 - Math.exp(-dt * 3));
    this.bobTime += dt * (upright ? 4.2 : 2.6) * (0.4 + this.bobAmount);
    const bob = this.bobAmount * (upright ? 0.05 : 0.035);
    this.camera.position.y += Math.sin(this.bobTime * 2) * bob;
    this.camera.lookAt(this.lookAt);
    this.camera.rotateZ(Math.sin(this.bobTime) * bob * 0.25);
  }
}
