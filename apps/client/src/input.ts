import type { MoveInput } from "@desert/sim";

/** Keyboard state turned into a movement intention. Sends only on change. */
export class KeyboardInput {
  private keys = new Set<string>();
  private last = "";

  constructor(private readonly send: (input: MoveInput) => void) {
    window.addEventListener("keydown", (e) => {
      if (isTyping(e)) return;
      this.keys.add(e.code);
      this.flush();
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      this.flush();
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.flush();
    });
  }

  current(): MoveInput {
    const k = this.keys;
    const forward = ((k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0)) as MoveInput["forward"];
    const turn = ((k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0)) as MoveInput["turn"];
    return { forward, turn };
  }

  private flush(): void {
    const input = this.current();
    const key = `${input.forward},${input.turn}`;
    if (key !== this.last) {
      this.last = key;
      this.send(input);
    }
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
}
