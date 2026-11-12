import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../session";
import { DEFAULT_PREFS, useGameStore } from "../../store/game";

describe("live game preferences", () => {
  beforeEach(() => {
    useGameStore.setState({
      session: null,
      prefs: { ...DEFAULT_PREFS },
      prefOverrides: {},
      history: [],
      lastSettings: null,
    });
  });
  it("sets mode defaults while retaining explicit interval and solo overrides", () => {
    useGameStore
      .getState()
      .start({ ...DEFAULT_SETTINGS, mode: "basic", autoSolo: false }, 51, 0);
    expect(useGameStore.getState().prefs.intervals).toBe(true);
    expect(useGameStore.getState().prefs.autoSolo).toBe(false);
    expect(useGameStore.getState().prefOverrides).toEqual({});
    useGameStore.getState().updatePrefs({ intervals: false, autoSolo: true });
    expect(useGameStore.getState().prefOverrides).toEqual({
      intervals: false,
      autoSolo: true,
    });
    useGameStore
      .getState()
      .start({ ...DEFAULT_SETTINGS, mode: "basic", autoSolo: true }, 52, 0);
    expect(useGameStore.getState().prefs.intervals).toBe(false);
    expect(useGameStore.getState().prefs.autoSolo).toBe(true);
  });
  it("preserves a basic-game solo choice when changing sound or display preferences", () => {
    useGameStore
      .getState()
      .start({ ...DEFAULT_SETTINGS, mode: "basic", autoSolo: false }, 51, 0);
    useGameStore.getState().updatePrefs({ sound: false });
    expect(useGameStore.getState().session?.settings.autoSolo).toBe(false);
    useGameStore.getState().updatePrefs({ notation: "letters" });
    expect(useGameStore.getState().session?.settings.autoSolo).toBe(false);
  });
  it("changes solo behavior only for its relevant preference and retains an existing deadline", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    useGameStore
      .getState()
      .start({ ...DEFAULT_SETTINGS, mode: "basic", autoSolo: false }, 51, 0);
    const current = useGameStore.getState().session!;
    useGameStore.setState({
      session: { ...current, soloPending: { player: 0, expiresAt: 3000 } },
    });
    useGameStore.getState().updatePrefs({ volume: 0.3 });
    expect(useGameStore.getState().session?.soloPending?.expiresAt).toBe(3000);
    useGameStore.getState().updatePrefs({ soloSeconds: 5 });
    expect(useGameStore.getState().session?.settings.soloSeconds).toBe(5);
    expect(useGameStore.getState().session?.soloPending?.expiresAt).toBe(3000);
    useGameStore.getState().updatePrefs({ autoSolo: true });
    expect(useGameStore.getState().session?.settings.autoSolo).toBe(true);
    expect(useGameStore.getState().session?.soloPending).toBeNull();
    now.mockRestore();
  });
});
