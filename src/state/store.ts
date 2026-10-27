import { create } from 'zustand';
import { content } from '../content';
import { applyAction, type Action } from '../sim/actions';
import { createRng } from '../sim/rng';
import { tick } from '../sim/tick';
import type { GameState } from '../sim/types';
import { toastsFor, type ToastTone } from './toasts';

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

export type Sheet =
  | null
  | { kind: 'fish'; fishId: number }
  | { kind: 'settings' }
  | { kind: 'debug' }
  | { kind: 'gallery' };

export interface Store {
  game: GameState;
  selectedTankId: number;
  sheet: Sheet;
  toasts: Toast[];
  autosaveEnabled: boolean;
  showFps: boolean;
  dispatch(action: Action): void;
  advance(steps: number): void;
  replaceGame(game: GameState): void;
  selectTank(id: number): void;
  openSheet(sheet: Sheet): void;
  toast(tone: ToastTone, text: string): void;
  dismissToast(id: number): void;
  setAutosave(on: boolean): void;
  setShowFps(on: boolean): void;
}

const MAX_TOASTS = 3;
let toastId = 1;

/** The rng is rebuilt from the saved state each call, so a reload continues the same sequence. */
const rngFor = (g: GameState) => createRng(g.seed, g.rngState);

export const createGameStore = (initial: GameState) =>
  create<Store>()((set, get) => {
    const withEvents = (game: GameState) => {
      const specs = toastsFor(game.events, game);
      const toasts =
        specs.length === 0
          ? get().toasts
          : [...get().toasts, ...specs.map((s) => ({ id: toastId++, ...s }))].slice(-MAX_TOASTS);
      set({ game, toasts });
    };
    return {
      game: initial,
      selectedTankId: initial.tanks[0]?.id ?? 0,
      sheet: null,
      toasts: [],
      autosaveEnabled: true,
      showFps: false,
      dispatch: (action) => withEvents(applyAction(get().game, action, rngFor(get().game))),
      advance: (steps) => {
        if (steps <= 0) return;
        const g = get().game;
        withEvents(tick(g, steps * content.balance.time.simStepH, rngFor(g)));
      },
      replaceGame: (game) =>
        set({ game, selectedTankId: game.tanks[0]?.id ?? 0, sheet: null, toasts: [] }),
      selectTank: (id) => set({ selectedTankId: id, sheet: null }),
      openSheet: (sheet) => set({ sheet }),
      toast: (tone, text) =>
        set({ toasts: [...get().toasts, { id: toastId++, tone, text }].slice(-MAX_TOASTS) }),
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      setAutosave: (on) => set({ autosaveEnabled: on }),
      setShowFps: (on) => set({ showFps: on }),
    };
  });

export type GameStore = ReturnType<typeof createGameStore>;
