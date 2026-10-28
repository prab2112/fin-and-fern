import { useState } from 'react';
import { decodeExport, encodeExport } from '../save/exportCode';
import { DEBUG_TOOLS } from './devTools';
import { Sheet } from './Sheet';
import { useGame, useServices } from './storeContext';

/** GDD §13 Settings, M1 subset: export / import save. */
export function SettingsSheet() {
  const { store, saveNow, nowMs } = useServices();
  const close = useGame((s) => s.openSheet);
  const [code, setCode] = useState('');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const doExport = async () => {
    const c = encodeExport(store.getState().game, nowMs());
    setCode(c);
    try {
      await navigator.clipboard.writeText(c);
      setMessage('Save code copied.');
    } catch {
      setMessage('Save code ready below. Select and copy it.');
    }
  };

  const doImport = () => {
    try {
      const game = decodeExport(importText);
      store.getState().replaceGame(game);
      saveNow();
      store.getState().toast('info', 'Save imported.');
    } catch {
      setMessage('That code is not a valid Fin & Fern save.');
    }
  };

  return (
    <Sheet title="Settings" onClose={() => close(null)}>
      <section className="settings-block">
        <h3>Export save</h3>
        <button type="button" className="action" onClick={() => void doExport()}>
          <span className="action-label">Copy save code</span>
        </button>
        {code && (
          <textarea className="code" readOnly value={code} rows={3} aria-label="Save code" />
        )}
      </section>
      <section className="settings-block">
        <h3>Import save</h3>
        <textarea
          className="code"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste a save code"
          rows={3}
          aria-label="Save code to import"
        />
        <button
          type="button"
          className="action"
          onClick={doImport}
          disabled={importText.trim() === ''}
        >
          <span className="action-label">Import</span>
          <span className="action-sub">replaces the current game</span>
        </button>
      </section>
      {message && <p className="note">{message}</p>}
      {DEBUG_TOOLS && (
        <button type="button" className="action" onClick={() => close({ kind: 'debug' })}>
          <span className="action-label">Debug menu</span>
          <span className="action-sub">test builds only</span>
        </button>
      )}
    </Sheet>
  );
}
