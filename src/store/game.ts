"use client";

import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type { Action, Mode } from "../game/engine";
import {
  advanceRound,
  createSession,
  declareSolo,
  expireSolo as expireSessionSolo,
  rankings,
  runAiTurn,
  sessionAction,
  tickTimer,
  type GameSession,
  type GameSettings,
} from "../game/session";

export interface Preferences {
  sound: boolean;
  volume: number;
  notation: "solfege" | "letters" | "number";
  intervals: boolean;
  explosionWarning: boolean;
  autoSolo: boolean;
  soloSeconds: 3 | 5;
  speed: "normal" | "fast";
  colorAssist: boolean;
  handSize: 7 | 10;
  highSpecialPoints: boolean;
}
export const DEFAULT_PREFS: Preferences = {
  sound: true,
  volume: 0.6,
  notation: "solfege",
  intervals: false,
  explosionWarning: true,
  autoSolo: true,
  soloSeconds: 3,
  speed: "normal",
  colorAssist: false,
  handSize: 10,
  highSpecialPoints: false,
};
export interface GameRecord {
  id: string;
  date: number;
  mode: Mode;
  players: number;
  scores: number[];
  rank: number;
  explosions: number;
  seenExplosions: number;
  maxLeap: number;
  sequentialRatio: number;
}
export interface GameStore {
  session: GameSession | null;
  prefs: Preferences;
  prefOverrides: { autoSolo?: boolean; intervals?: boolean };
  history: GameRecord[];
  tutorialStep: number;
  hydrated: boolean;
  lastSettings: GameSettings | null;
  start: (settings: GameSettings, seed?: number, now?: number) => void;
  act: (action: Action) => void;
  aiTurn: () => void;
  solo: () => void;
  expireSolo: (now: number) => void;
  nextRound: () => void;
  tick: (now: number) => void;
  updatePrefs: (partial: Partial<Preferences>) => void;
  setTutorialStep: (step: number) => void;
  clearHistory: () => void;
  abandon: () => void;
  setHydrated: () => void;
}

/** Unavailable or full storage must never prevent a classroom game. */
const safeStorage: StateStorage = {
  getItem(name) {
    if (typeof window === "undefined") return null;
    try {
      const saved = window.localStorage.getItem(name);
      if (saved) JSON.parse(saved);
      return saved;
    } catch {
      try {
        window.localStorage.removeItem(name);
      } catch {
        /* Private mode. */
      }
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* Continue without saving. */
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* Private mode. */
    }
  },
};

function completedHistory(
  session: GameSession | null,
  history: GameRecord[],
): GameRecord[] {
  if (
    !session ||
    session.status !== "gameResult" ||
    history.some((record) => record.id === session.id)
  )
    return history;
  const rank = rankings(session).find((entry) => entry.player === 0)?.rank ?? 1;
  const record: GameRecord = {
    id: session.id,
    date: Date.now(),
    mode: session.settings.mode,
    players: session.seats.length,
    scores: session.totals.slice(),
    rank,
    explosions: session.explosions.filter((event) => event.player === 0).length,
    seenExplosions: session.explosions.length,
    maxLeap: session.stats.maxLeap[0],
    sequentialRatio: session.stats.placed[0]
      ? session.stats.sequential[0] / session.stats.placed[0]
      : 0,
  };
  return [record, ...history].slice(0, 20);
}

function validSession(value: unknown): value is GameSession {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GameSession>;
  return (
    typeof item.id === "string" &&
    !!item.settings &&
    !!item.round &&
    Array.isArray(item.round.lines) &&
    item.round.lines.length === 4 &&
    Array.isArray(item.round.hands) &&
    Array.isArray(item.seats) &&
    Array.isArray(item.rounds) &&
    Array.isArray(item.totals) &&
    Array.isArray(item.explosions) &&
    !!item.stats &&
    typeof item.rngStep === "number"
  );
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const updateSession = (
        transform: (session: GameSession) => GameSession,
      ) => {
        const current = get().session;
        if (!current) return;
        const session = transform(current);
        if (session === current) return;
        set({ session, history: completedHistory(session, get().history) });
      };
      return {
        session: null,
        prefs: DEFAULT_PREFS,
        prefOverrides: {},
        history: [],
        tutorialStep: 0,
        hydrated: false,
        lastSettings: null,
        start(
          settings,
          seed = Math.floor(Math.random() * 0xffffffff),
          now = Date.now(),
        ) {
          set({
            session: createSession(settings, seed, now),
            lastSettings: structuredClone(settings),
            prefs: {
              ...get().prefs,
              autoSolo: settings.autoSolo,
              intervals:
                get().prefOverrides.intervals ?? settings.mode === "basic",
            },
          });
        },
        act(action) {
          updateSession((session) =>
            sessionAction(session, action, Date.now()),
          );
        },
        aiTurn() {
          updateSession((session) => runAiTurn(session, Date.now()));
        },
        solo() {
          updateSession((session) => declareSolo(session, Date.now()));
        },
        expireSolo(now) {
          updateSession((session) => expireSessionSolo(session, now));
        },
        nextRound() {
          updateSession((session) => advanceRound(session, Date.now()));
        },
        tick(now) {
          updateSession((session) => tickTimer(session, now));
        },
        updatePrefs(partial) {
          const prefs = { ...get().prefs, ...partial };
          const prefOverrides = { ...get().prefOverrides };
          if (partial.autoSolo !== undefined)
            prefOverrides.autoSolo = partial.autoSolo;
          if (partial.intervals !== undefined)
            prefOverrides.intervals = partial.intervals;
          const existing = get().session;
          const session =
            existing && partial.autoSolo === true
              ? expireSessionSolo(existing, Date.now())
              : existing;
          set({
            prefs,
            prefOverrides,
            session: session
              ? {
                  ...session,
                  settings: {
                    ...session.settings,
                    ...(partial.autoSolo === undefined
                      ? {}
                      : { autoSolo: prefs.autoSolo }),
                    ...(partial.soloSeconds === undefined
                      ? {}
                      : { soloSeconds: prefs.soloSeconds }),
                  },
                  soloPending:
                    partial.autoSolo === true ? null : session.soloPending,
                }
              : null,
          });
        },
        setTutorialStep(step) {
          set({ tutorialStep: Math.max(0, Math.min(7, step)) });
        },
        clearHistory() {
          set({ history: [] });
        },
        abandon() {
          set({ session: null });
        },
        setHydrated() {
          set({ hydrated: true });
        },
      };
    },
    {
      name: "updown-melody-v1",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (state) => ({
        session: state.session,
        prefs: state.prefs,
        prefOverrides: state.prefOverrides,
        history: state.history,
        tutorialStep: state.tutorialStep,
        lastSettings: state.lastSettings,
      }),
      migrate: () => ({
        session: null,
        prefs: DEFAULT_PREFS,
        prefOverrides: {},
        history: [],
        tutorialStep: 0,
        lastSettings: null,
      }),
      merge(persisted, current) {
        if (!persisted || typeof persisted !== "object") return current;
        const saved = persisted as Partial<GameStore>;
        return {
          ...current,
          session: validSession(saved.session) ? saved.session : null,
          prefs: { ...DEFAULT_PREFS, ...saved.prefs },
          prefOverrides: {
            ...(typeof saved.prefOverrides?.autoSolo === "boolean"
              ? { autoSolo: saved.prefOverrides.autoSolo }
              : {}),
            ...(typeof saved.prefOverrides?.intervals === "boolean"
              ? { intervals: saved.prefOverrides.intervals }
              : {}),
          },
          history: Array.isArray(saved.history)
            ? saved.history.slice(0, 20)
            : [],
          tutorialStep:
            typeof saved.tutorialStep === "number"
              ? Math.max(0, Math.min(7, saved.tutorialStep))
              : 0,
          lastSettings: saved.lastSettings ?? null,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
