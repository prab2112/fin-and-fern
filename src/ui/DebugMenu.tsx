import { content } from '../content';
import { newGame } from '../sim/newGame';
import { Sheet } from './Sheet';
import { useGame, useServices } from './storeContext';

/** Dev builds only (import.meta.env.DEV). */
export function DebugMenu() {
  const { store, nowMs } = useServices();
  const close = useGame((s) => s.openSheet);
  const dispatch = useGame((s) => s.dispatch);
  const tankId = useGame((s) => s.selectedTankId);
  const tankName = useGame((s) => s.game.tanks.find((t) => t.id === s.selectedTankId)?.name ?? '');
  const autosave = useGame((s) => s.autosaveEnabled);
  const setAutosave = useGame((s) => s.setAutosave);
  const showFps = useGame((s) => s.showFps);
  const setShowFps = useGame((s) => s.setShowFps);

  return (
    <Sheet title="Debug" onClose={() => close(null)}>
      <div className="debug-grid">
        <button
          type="button"
          className="action"
          onClick={() => {
            dispatch({ type: 'debugSpawnFish', tankId, speciesId: 'guppy', count: 40 });
            setShowFps(true);
            close(null);
          }}
        >
          <span className="action-label">Spawn 40 fish</span>
          <span className="action-sub">guppies into {tankName}</span>
        </button>
        <button
          type="button"
          className="action"
          onClick={() => dispatch({ type: 'debugAdvanceHours', hours: 24 })}
        >
          <span className="action-label">+1 game day</span>
        </button>
        <button
          type="button"
          className="action"
          onClick={() => dispatch({ type: 'debugAddDirt', tankId, amount: 30 })}
        >
          <span className="action-label">Dirty water +30</span>
          <span className="action-sub">watch them gasp</span>
        </button>
        <button
          type="button"
          className="action"
          onClick={() => dispatch({ type: 'debugSickFish', tankId, hp: 30 })}
        >
          <span className="action-label">Make a fish sick</span>
          <span className="action-sub">HP 30 in {tankName}</span>
        </button>
        <button
          type="button"
          className="action"
          onClick={() => dispatch({ type: 'debugAddFood', units: 50 })}
        >
          <span className="action-label">+50 food</span>
        </button>
        <button
          type="button"
          className="action"
          aria-pressed={autosave}
          onClick={() => setAutosave(!autosave)}
        >
          <span className="action-label">Autosave: {autosave ? 'on' : 'off'}</span>
        </button>
        <button
          type="button"
          className="action"
          aria-pressed={showFps}
          onClick={() => setShowFps(!showFps)}
        >
          <span className="action-label">FPS overlay: {showFps ? 'on' : 'off'}</span>
        </button>
        <button
          type="button"
          className="action"
          onClick={() => {
            for (const sp of content.species)
              dispatch({ type: 'debugSpawnFish', tankId, speciesId: sp.id, count: 1 });
            close(null);
          }}
        >
          <span className="action-label">Spawn 1 of each</span>
          <span className="action-sub">12 species into {tankName}</span>
        </button>
        <button type="button" className="action" onClick={() => close({ kind: 'gallery' })}>
          <span className="action-label">Fish gallery</span>
          <span className="action-sub">every phenotype</span>
        </button>
        <button
          type="button"
          className="action danger"
          onClick={() => {
            if (window.confirm('Start a new game? The current one is lost unless exported.'))
              store.getState().replaceGame(newGame(nowMs() >>> 0));
          }}
        >
          <span className="action-label">New game</span>
        </button>
      </div>
    </Sheet>
  );
}
