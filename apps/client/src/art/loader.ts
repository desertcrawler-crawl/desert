import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ART_SLOTS, type ArtSlotName } from "./manifest.ts";

const loader = new GLTFLoader();
const cache = new Map<ArtSlotName, Promise<GLTF | null>>();

/**
 * Load the artist's .glb for a slot, or null if there is none yet.
 * Null means "use the code placeholder"; it is not an error.
 */
export function loadArt(slot: ArtSlotName): Promise<GLTF | null> {
  let p = cache.get(slot);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}assets/models/${ART_SLOTS[slot].file}`;
    p = fetch(url, { method: "HEAD" })
      .then((res) => {
        const type = res.headers.get("content-type") ?? "";
        // Dev servers answer missing files with index.html; treat that as "no art yet".
        if (!res.ok || type.includes("text/html")) return null;
        return loader.loadAsync(url);
      })
      .then((gltf) => {
        if (gltf) {
          gltf.scene.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
          });
        }
        return gltf;
      })
      .catch((err) => {
        console.warn(`[art] ${slot}: could not load ${url}, using placeholder`, err);
        return null;
      });
    cache.set(slot, p);
  }
  return p;
}
