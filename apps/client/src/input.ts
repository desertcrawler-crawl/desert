import type { MoveInput } from "@desert/sim";

export interface InputHandlers {
  move(input: MoveInput): void;
  posture(want: "walk" | "crawl"): void;
  slap(): void;
  /** Any key or click while dying makes a tiny involuntary movement. */
  anyInput(): void;
}

/**
 * Keyboard controls (placeholders for the control test):
 *   W/S  crawl or walk forward/back      A/D  turn
 *   Space  get up and walk               Ctrl or C  get down and crawl
 *   F  slap                              Enter  chat
 * Note: holding Ctrl while pressing W closes the browser tab in most browsers,
 * so C is offered as a safe alternative for crawling.
 */
export class KeyboardInput {
  private keys = new Set<string>();
  private last = "";

  constructor(private readonly on: InputHandlers) {
    window.addEventListener("keydown", (e) => {
      if (isTyping(e)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) on.posture("walk");
      } else if (e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "KeyC") {
        if (!e.repeat) on.posture("crawl");
      } else if (e.code === "KeyF") {
        if (!e.repeat) on.slap();
      }
      if (!e.repeat) on.anyInput();
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
      this.on.move(input);
    }
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
}
