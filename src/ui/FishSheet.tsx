import { content } from '../content';
import { fishValue, isSick, morphLabel } from '../sim/fish';
import { stageOf } from '../sim/stage';
import { rupees } from './format';
import { Sheet } from './Sheet';
import { useGame } from './storeContext';

const STAGE_LABEL = { fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult' } as const;

/** GDD §13: species, morph, sex, stage, HP and value. Genotype comes with the Lab (M3). */
export function FishSheet({ fishId }: { fishId: number }) {
  const close = useGame((s) => s.openSheet);
  const fish = useGame((s) => {
    for (const t of s.game.tanks) {
      const f = t.fish.find((x) => x.id === fishId);
      if (f) return f;
    }
    return null;
  });
  const tankName = useGame(
    (s) => s.game.tanks.find((t) => t.fish.some((f) => f.id === fishId))?.name ?? '',
  );

  if (!fish)
    return (
      <Sheet title="Fish" onClose={() => close(null)}>
        <p>This fish is no longer here.</p>
      </Sheet>
    );

  const species = content.speciesById[fish.speciesId];
  const sick = isSick(fish);
  const value = fishValue(fish, species?.basePrice ?? 0);
  return (
    <Sheet title={species?.name ?? 'Fish'} onClose={() => close(null)}>
      <dl className="fish-facts">
        <dt>Morph</dt>
        <dd>{morphLabel(fish)}</dd>
        <dt>Sex</dt>
        <dd>{fish.sex === 'F' ? '♀ Female' : '♂ Male'}</dd>
        <dt>Stage</dt>
        <dd>{STAGE_LABEL[stageOf(fish.ageH)]}</dd>
        <dt>Tank</dt>
        <dd>{tankName}</dd>
        <dt>Value</dt>
        <dd>{value > 0 ? rupees(value) : 'not for sale yet'}</dd>
      </dl>
      <div className={sick ? 'hp sick' : 'hp'}>
        <div className="meter-head">
          <span>Health {sick && <span className="badge">sick</span>}</span>
          <span className="meter-value">{Math.ceil(fish.hp)} / 100</span>
        </div>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${Math.max(0, fish.hp)}%` }} />
        </div>
      </div>
      <div className="hp">
        <div className="meter-head">
          <span>Hunger</span>
          <span className="meter-value">{Math.round(fish.hunger)}</span>
        </div>
        <div className="meter-track">
          <div className="meter-fill hunger" style={{ width: `${fish.hunger}%` }} />
        </div>
      </div>
      {fish.pregnancy && <p className="note">Expecting fry.</p>}
    </Sheet>
  );
}
