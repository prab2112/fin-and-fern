import { content } from '../content';
import { tankLoad } from '../sim/water';
import type { Tank } from '../sim/types';
import { useGame, useServices } from './storeContext';

/** Primary tank actions, in the bottom half (GDD §13). */
export function ActionBar({ tank, onFed }: { tank: Tank; onFed: () => void }) {
  const { store } = useServices();
  const food = useGame((s) => s.game.food);
  const gameHours = useGame((s) => s.game.gameHours);
  const dispatch = useGame((s) => s.dispatch);

  const units = Math.max(1, Math.ceil(tankLoad(tank.fish) / content.balance.food.loadPerFoodUnit));
  const cooldownH = Math.max(0, tank.waterChangeReadyAtH - gameHours);
  const cooling = cooldownH > 1e-6;
  const empty = tank.fish.length === 0;

  const feed = () => {
    dispatch({ type: 'feed', tankId: tank.id });
    if (!store.getState().game.events.some((e) => e.type === 'rejected')) onFed();
  };

  return (
    <div className="action-bar">
      <button
        type="button"
        className="action primary"
        onClick={feed}
        disabled={empty || food < units}
      >
        <span className="action-label">Feed</span>
        <span className="action-sub">
          food {food}
          {!empty && ` · uses ${units}`}
        </span>
      </button>
      <button
        type="button"
        className="action"
        onClick={() => dispatch({ type: 'waterChange', tankId: tank.id })}
        disabled={cooling}
      >
        <span className="action-label">Water change</span>
        <span className="action-sub">
          {cooling ? `ready in ${Math.ceil(cooldownH * 60)} game min` : 'halves the dirt'}
        </span>
      </button>
    </div>
  );
}
