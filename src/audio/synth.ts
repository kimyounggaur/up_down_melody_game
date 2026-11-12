import type { GameEvent } from "../game/engine";

/** Browser audio is created only after an explicit tap. No audio files are needed. */
class MelodySynth {
  private context: AudioContext | null = null;
  private enabled = true;
  private volume = 0.6;
  private nodes = new Set<OscillatorNode>();

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.min(1, Math.max(0, volume));
    if (!enabled) this.stop();
  }

  async unlock() {
    if (typeof window === "undefined") return;
    try {
      const browser = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const Context = browser.AudioContext ?? browser.webkitAudioContext;
      if (!Context) return;
      this.context ??= new Context();
      if (this.context.state === "suspended") await this.context.resume();
    } catch {
      // Silent mode remains fully playable when the browser rejects audio.
    }
  }

  private tone(
    frequency: number,
    at = 0,
    duration = 0.4,
    gain = 1,
    kind: OscillatorType = "triangle",
  ) {
    const context = this.context;
    if (
      !context ||
      !this.enabled ||
      !this.volume ||
      context.state !== "running"
    )
      return;
    const start = context.currentTime + Math.max(0, at);
    const envelope = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, this.volume * 0.19 * gain),
      start + 0.012,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    this.nodes.add(oscillator);
    oscillator.onended = () => {
      this.nodes.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  note(n: number, at = 0, duration = 0.4) {
    const frequency = 440 * 2 ** ((60 + n - 69) / 12);
    this.tone(frequency, at, duration);
    this.tone(frequency * 2, at, duration * 0.65, 0.17, "sine");
  }

  melody(notes: number[], step = 0.35) {
    this.stop();
    notes.forEach((n, index) => this.note(n, index * step));
  }

  private slide(at: number) {
    const context = this.context;
    if (!context || !this.enabled || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + at;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(420, start);
    oscillator.frequency.exponentialRampToValueAtTime(840, start + 0.18);
    gain.gain.setValueAtTime(this.volume * 0.1, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.nodes.add(oscillator);
    oscillator.onended = () => {
      this.nodes.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 0.23);
  }

  events(events: GameEvent[]) {
    let offset = 0;
    for (const event of events) {
      switch (event.type) {
        case "placed":
          this.note(event.from, offset, 0.18);
          this.note(event.card.n, offset + (event.distance <= 2 ? 0.12 : 0.2));
          if (event.distance >= 6)
            this.tone(1320, offset + 0.15, 0.14, 0.15, "sine");
          offset += 0.34;
          break;
        case "exploded":
          event.taken.forEach((card, i) =>
            this.note(card.n, offset + i * 0.2, 0.25),
          );
          this.tone(110, offset + 1.02, 0.45, 0.75, "sine");
          offset += 1.5;
          break;
        case "bounced":
          this.slide(offset);
          offset += 0.22;
          break;
        case "special": {
          const motif = {
            REV: [7, 0],
            REST: [12],
            PLUS2: [3, 7],
            WILD: [0, 4, 7],
            WILD4: [0, 3, 6, 12],
          };
          if (event.card.kind !== "P")
            motif[event.card.kind].forEach((n, i) =>
              this.note(n, offset + i * 0.1, 0.2),
            );
          offset += 0.4;
          break;
        }
        case "drew":
          this.tone(520, offset, 0.1, 0.25, "sine");
          offset += 0.12;
          break;
        case "skipped":
          this.tone(330, offset, 0.15, 0.25, "sine");
          offset += 0.17;
          break;
        case "roundOver":
          [0, 4, 7, 12].forEach((n, i) => this.note(n, offset + i * 0.12));
          offset += 0.55;
          break;
      }
    }
  }

  solo() {
    [7, 12, 19].forEach((n, i) => this.note(n, i * 0.08, 0.22));
  }

  victory() {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.note(n, i * 0.12, 0.5));
  }

  stop() {
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.nodes.clear();
  }
}

export const synth = new MelodySynth();
