import type { ReactNode } from 'react';
import type { Speed } from '../sim/types';
import { dayClock, rupees } from './format';
import { useGame } from './storeContext';

// Drawn as SVG: the ⏸ glyph is missing from many Android fonts.
const PauseIcon = () => (
  <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
    <rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="9" y="1" width="4" height="14" rx="1" fill="currentColor" />
  </svg>
);

const SPEEDS: { speed: Speed; label: ReactNode; aria: string }[] = [
  { speed: 0, label: <PauseIcon />, aria: 'Pause' },
  { speed: 1, label: '1×', aria: 'Normal speed' },
  { speed: 2, label: '2×', aria: 'Double speed' },
];

export function TopBar() {
  const money = useGame((s) => s.game.money);
  const gameHours = useGame((s) => s.game.gameHours);
  const speed = useGame((s) => s.game.speed);
  const dispatch = useGame((s) => s.dispatch);
  const openSheet = useGame((s) => s.openSheet);

  return (
    <header className="topbar">
      <div className="topbar-stats">
        <div className="money" aria-label="Money">
          {rupees(money)}
        </div>
        <div className="clock">{dayClock(gameHours)}</div>
      </div>
      <div className="speed" role="group" aria-label="Game speed">
        {SPEEDS.map((s) => (
          <button
            key={s.speed}
            type="button"
            className={speed === s.speed ? 'seg active' : 'seg'}
            aria-label={s.aria}
            aria-pressed={speed === s.speed}
            onClick={() => dispatch({ type: 'setSpeed', speed: s.speed })}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Settings"
        onClick={() => openSheet({ kind: 'settings' })}
      >
        ⚙
      </button>
    </header>
  );
}
