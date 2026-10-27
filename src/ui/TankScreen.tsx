import { useEffect, useRef } from 'react';
import { createTankRenderer, renderFlags, type TankRenderer } from '../render/tankRenderer';
import { ActionBar } from './ActionBar';
import { Meters } from './Meters';
import { useGame, useServices } from './storeContext';

export function TankScreen() {
  const { store } = useServices();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TankRenderer | null>(null);
  const tank = useGame((s) => s.game.tanks.find((t) => t.id === s.selectedTankId) ?? null);
  const showFps = useGame((s) => s.showFps);
  const openSheet = useGame((s) => s.openSheet);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = createTankRenderer(canvas);
    rendererRef.current = r;
    // Dev builds expose the renderer and its layer switches to profiling tools.
    if (import.meta.env.DEV)
      Object.assign(window, { __finfernRenderer: r, __finfernFlags: renderFlags });
    const sync = () => {
      const s = store.getState();
      r.setTank(s.game.tanks.find((t) => t.id === s.selectedTankId) ?? null);
    };
    sync();
    const unsub = store.subscribe(sync);
    return () => {
      unsub();
      r.dispose();
      rendererRef.current = null;
    };
  }, [store]);

  useEffect(() => rendererRef.current?.setShowFps(showFps), [showFps]);

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = rendererRef.current?.hitTest(x, y) ?? null;
    if (id !== null) openSheet({ kind: 'fish', fishId: id });
    else rendererRef.current?.poke(x, y);
  };

  return (
    <section className="tank-screen">
      <div className="tank-view">
        <canvas
          ref={canvasRef}
          className="tank-canvas"
          onPointerUp={onTap}
          aria-label={
            tank ? `${tank.name}, ${tank.fish.length} fish. Tap a fish for details.` : 'Tank'
          }
          role="img"
        />
        {tank && tank.fish.length === 0 && <div className="tank-empty">This tank is empty.</div>}
      </div>
      {tank && <Meters tank={tank} />}
      {tank && <ActionBar tank={tank} onFed={() => rendererRef.current?.dropFood()} />}
    </section>
  );
}
