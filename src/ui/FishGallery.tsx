import { useEffect, useRef } from 'react';
import { content } from '../content';
import { drawFish } from '../render/fishDraw';
import { allPhenotypeFish, lookFor, SHAPES } from '../render/fishLook';
import { morphLabel } from '../sim/fish';
import type { Fish } from '../sim/types';
import { Sheet } from './Sheet';
import { useGame } from './storeContext';

const CELL_W = 156;
const CELL_H = 92;

/** Draws a ♂ (left) and ♀ (right) of one phenotype, static. */
function PairCanvas({ male, female }: { male: Fish; female: Fish }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CELL_W * dpr;
    canvas.height = CELL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1d6474';
    ctx.fillRect(0, 0, CELL_W, CELL_H);
    // Tall species (angel, discus) are drawn shorter so their fins fit the cell.
    const shape = SHAPES[male.speciesId];
    const tall = (shape?.hTop ?? 10) >= 20;
    const len = tall ? 34 : 46;
    drawFish(ctx, lookFor(male), CELL_W * 0.3, CELL_H * 0.5, 1, 0, len, 0.6);
    drawFish(ctx, lookFor(female), CELL_W * 0.78, CELL_H * 0.5, 1, 0, len, 2.2);
  }, [male, female]);
  return <canvas ref={ref} style={{ width: CELL_W, height: CELL_H, borderRadius: 10 }} />;
}

/** Dev-only: every species × phenotype, male and female. */
export function FishGallery() {
  const close = useGame((s) => s.openSheet);
  const all = allPhenotypeFish();
  return (
    <Sheet title="Fish gallery" onClose={() => close(null)}>
      {content.species.map((sp) => {
        const males = all.filter((f) => f.speciesId === sp.id && f.sex === 'M');
        return (
          <section key={sp.id} className="gallery-species">
            <h3>{sp.name}</h3>
            <div className="gallery-grid">
              {males.map((m) => {
                const f = all.find((x) => x.id === m.id + 1) as Fish;
                return (
                  <figure key={m.id} className="gallery-cell">
                    <PairCanvas male={m} female={f} />
                    <figcaption>{morphLabel(m)} · ♂ ♀</figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        );
      })}
    </Sheet>
  );
}
