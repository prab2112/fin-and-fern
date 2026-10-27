import { useShallow } from 'zustand/react/shallow';
import { useGame } from './storeContext';

export function TankSwitcher() {
  const tanks = useGame(
    useShallow((s) => s.game.tanks.map((t) => `${t.id}|${t.name}|${t.fish.length}`)),
  );
  const selected = useGame((s) => s.selectedTankId);
  const selectTank = useGame((s) => s.selectTank);

  return (
    <nav className="tank-switcher" aria-label="Tanks">
      {tanks.map((row) => {
        const [idStr, name, count] = row.split('|');
        const id = Number(idStr);
        const n = Number(count);
        return (
          <button
            key={id}
            type="button"
            className={id === selected ? 'tank-tab active' : 'tank-tab'}
            aria-pressed={id === selected}
            onClick={() => selectTank(id)}
          >
            <span className="tank-tab-name">{name}</span>
            <span className="tank-tab-sub">{n === 0 ? 'empty' : `${n} fish`}</span>
          </button>
        );
      })}
    </nav>
  );
}
