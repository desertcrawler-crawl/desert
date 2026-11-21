import * as THREE from "three";
import { terrainHeight, type MoveInput } from "@desert/sim";
import { loadArt } from "./art/loader.ts";
import { Avatar } from "./avatar.ts";
import { FollowCamera } from "./camera.ts";
import { KeyboardInput } from "./input.ts";
import { joinDesert } from "./net.ts";
import { buildWorld, SUN_DIRECTION } from "./world.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const joinForm = document.querySelector<HTMLFormElement>("#join")!;
const nameInput = document.querySelector<HTMLInputElement>("#name")!;
const joinError = document.querySelector<HTMLParagraphElement>("#join-error")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const status = document.querySelector<HTMLDivElement>("#status")!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const follow = new FollowCamera(canvas);
const { sun } = await buildWorld(scene);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  follow.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

try {
  nameInput.value = localStorage.getItem("desert:name") ?? "";
} catch {
  /* storage unavailable: fine */
}

/** What we draw for each player: smoothed towards the server's numbers. */
interface Shown {
  avatar: Avatar;
  pos: THREE.Vector3;
  heading: number;
}
const shown = new Map<string, Shown>();

joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = joinForm.querySelector("button")!;
  button.disabled = true;
  joinError.hidden = true;
  const name = nameInput.value.trim();
  try {
    localStorage.setItem("desert:name", name);
  } catch {
    /* ignore */
  }
  try {
    const [room, crawlerArt] = await Promise.all([joinDesert(name), loadArt("crawler")]);
    joinForm.hidden = true;
    hud.hidden = false;
    start(room, crawlerArt);
  } catch (err) {
    console.error(err);
    joinError.textContent = "Could not reach the desert server. Is it running?";
    joinError.hidden = false;
    button.disabled = false;
  }
});

function start(room: Awaited<ReturnType<typeof joinDesert>>, crawlerArt: Awaited<ReturnType<typeof loadArt>>) {
  new KeyboardInput((input: MoveInput) => room.send("input", input));
  room.onLeave(() => {
    status.textContent = "Disconnected from the desert. Reload to play again.";
  });

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const players = room.state.players;
    if (players) {
      // Add and update.
      players.forEach((p, id) => {
        let s = shown.get(id);
        if (!s) {
          s = { avatar: new Avatar(p.name, crawlerArt), pos: new THREE.Vector3(p.x, terrainHeight(p.x, p.z), p.z), heading: p.heading };
          scene.add(s.avatar.object);
          shown.set(id, s);
        }
        tmp.set(p.x, terrainHeight(p.x, p.z), p.z);
        const before = s.pos.clone();
        s.pos.lerp(tmp, 1 - Math.exp(-dt * 10));
        s.heading = lerpAngle(s.heading, p.heading, 1 - Math.exp(-dt * 10));
        const speed = before.distanceTo(s.pos) / Math.max(dt, 1e-3);
        s.avatar.object.position.copy(s.pos);
        // Models face +Z (glTF standard). Heading 0 = north = -Z, growing clockwise from above.
        s.avatar.object.rotation.y = Math.PI - s.heading;
        s.avatar.update(dt, speed);
      });
      // Remove players who left.
      for (const [id, s] of shown) {
        if (!players.has(id)) {
          s.avatar.dispose();
          shown.delete(id);
        }
      }
      status.textContent = `${players.size} / 30 in this desert`;
    }

    const me = shown.get(room.sessionId);
    if (me) {
      follow.update(dt, me.pos, me.heading);
      // Keep the shadow area centred on the player; the sun direction itself never changes.
      sun.target.position.copy(me.pos);
      sun.position.copy(me.pos).addScaledVector(SUN_DIRECTION, 80);
    }
    renderer.render(scene, follow.camera);
  });
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Before joining, show the desert slowly from above.
renderer.setAnimationLoop(() => {
  const t = performance.now() / 1000;
  follow.camera.position.set(Math.sin(t * 0.05) * 40, 14, Math.cos(t * 0.05) * 40);
  follow.camera.lookAt(0, 0, 0);
  renderer.render(scene, follow.camera);
});
