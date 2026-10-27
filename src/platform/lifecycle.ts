/** App lifecycle adapter: hidden/pagehide and visible. Capacitor's version arrives in M5. */
export interface Lifecycle {
  onHidden(cb: () => void): () => void;
  onVisible(cb: () => void): () => void;
  isHidden(): boolean;
}

export const webLifecycle: Lifecycle = {
  onHidden(cb) {
    const onVis = () => {
      if (document.visibilityState === 'hidden') cb();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', cb);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', cb);
    };
  },
  onVisible(cb) {
    const onVis = () => {
      if (document.visibilityState === 'visible') cb();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  },
  isHidden: () => document.visibilityState === 'hidden',
};
