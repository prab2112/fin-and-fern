import { DebugMenu } from './DebugMenu';
import { FishSheet } from './FishSheet';
import { SettingsSheet } from './SettingsSheet';
import { TankScreen } from './TankScreen';
import { TankSwitcher } from './TankSwitcher';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { useGame } from './storeContext';

export function App() {
  const sheet = useGame((s) => s.sheet);
  return (
    <div className="app">
      <TopBar />
      <TankSwitcher />
      <TankScreen />
      <Toasts />
      {sheet?.kind === 'fish' && <FishSheet fishId={sheet.fishId} />}
      {sheet?.kind === 'settings' && <SettingsSheet />}
      {sheet?.kind === 'debug' && import.meta.env.DEV && <DebugMenu />}
    </div>
  );
}
