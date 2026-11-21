export interface ChatLine {
  name: string;
  text: string;
}

/**
 * Session-wide text chat, lower right. Enter opens it, Enter sends, Escape closes.
 * Everything is shown as plain text (never HTML), so names and messages cannot inject markup.
 */
export class ChatBox {
  private readonly log: HTMLDivElement;
  private readonly input: HTMLInputElement;

  constructor(root: HTMLElement, private readonly send: (text: string) => void) {
    this.log = root.querySelector(".log")!;
    this.input = root.querySelector("input")!;
    window.addEventListener("keydown", (e) => {
      if (e.code !== "Enter" || document.activeElement === this.input) return;
      e.preventDefault();
      this.input.focus();
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.code === "Enter") {
        const text = this.input.value.trim();
        if (text) this.send(text);
        this.input.value = "";
        this.input.blur();
      } else if (e.code === "Escape") {
        this.input.blur();
      }
      e.stopPropagation();
    });
  }

  add(line: ChatLine): void {
    const row = document.createElement("div");
    const who = document.createElement("b");
    who.textContent = `${line.name}: `;
    row.append(who, document.createTextNode(line.text));
    this.log.append(row);
    while (this.log.childElementCount > 40) this.log.firstElementChild?.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }
}
