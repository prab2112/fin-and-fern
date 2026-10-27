import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { webClock } from './platform/clock';
import { webLifecycle } from './platform/lifecycle';
import { webStorage } from './platform/storage';
import { loadNewest } from './save/slots';
import { newGame } from './sim/newGame';
import { startAutosave } from './state/autosave';
import { startSimLoop } from './state/loop';
import { createGameStore } from './state/store';
import { App } from './ui/App';
import { ServicesContext } from './ui/storeContext';
import './ui/styles.css';

// Boot outside React so StrictMode can't create a second store or loop.
const initial = loadNewest(webStorage) ?? newGame(webClock.nowMs() >>> 0);
const store = createGameStore(initial);
startSimLoop(store, webClock, webLifecycle);
const autosave = startAutosave(store, webStorage, webClock, webLifecycle);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ServicesContext.Provider value={{ store, saveNow: autosave.saveNow, nowMs: webClock.nowMs }}>
        <App />
      </ServicesContext.Provider>
    </StrictMode>,
  );
}
