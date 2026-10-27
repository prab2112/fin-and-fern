import { content } from '../content';
import { heaterMaxC, wq } from '../sim/water';
import type { Tank } from '../sim/types';

interface MeterProps {
  label: string;
  value: string;
  /** 0..1 fill. */
  fill: number;
  tone: 'good' | 'warn' | 'bad';
}

function Meter({ label, value, fill, tone }: MeterProps) {
  return (
    <div className={`meter ${tone}`}>
      <div className="meter-head">
        <span>{label}</span>
        <span className="meter-value">{value}</span>
      </div>
      <div className="meter-track">
        <div
          className="meter-fill"
          style={{ width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Hunger, WQ and Temp for the open tank (GDD §13; Algae arrives with plants in M6). */
export function Meters({ tank }: { tank: Tank }) {
  const { alerts, health } = content.balance;
  const n = tank.fish.length;
  const hunger = n === 0 ? 0 : tank.fish.reduce((s, f) => s + f.hunger, 0) / n;
  const quality = wq(tank.dirt);
  const heater = heaterMaxC(tank.heaterLevel);
  return (
    <div className="meters">
      <Meter
        label="Hunger"
        value={n === 0 ? '—' : `${Math.round(hunger)}`}
        fill={hunger / 100}
        tone={
          hunger > health.hungerProblemAbove ? 'bad' : hunger > alerts.hungerAbove ? 'warn' : 'good'
        }
      />
      <Meter
        label="Water"
        value={`${Math.round(quality)}`}
        fill={quality / 100}
        tone={
          quality < content.balance.health.wqSevereBelow
            ? 'bad'
            : quality < alerts.wqBelow
              ? 'warn'
              : 'good'
        }
      />
      <Meter
        label={heater === null ? 'Temp · no heater' : 'Temp'}
        value={`${tank.tempC.toFixed(1)}°`}
        fill={(tank.tempC - 15) / 20}
        tone="good"
      />
    </div>
  );
}
