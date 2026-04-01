import { useState } from 'react';
import ControlPanel from './views/ControlPanel';
import CameraOverlay from './views/CameraOverlay';
import Teleprompter from './views/Teleprompter';
import MiniPanel from './views/MiniPanel';
import TeleprompterControl from './views/TeleprompterControl';

const resolveViewFromHash = (hash: string) => {
  switch (hash.replace('#/', '').replace('#', '')) {
    case 'camera':
      return 'camera';
    case 'teleprompter':
      return 'teleprompter';
    case 'teleprompter-control':
      return 'teleprompter-control';
    case 'control':
      return 'control';
    case 'minipanel':
    case 'timer':
    default:
      return 'minipanel';
  }
};

function App() {
  const [currentView] = useState(() =>
    resolveViewFromHash(window.location.hash)
  );

  return (
    <div className="h-screen w-screen overflow-auto">
      {currentView === 'control' && <ControlPanel />}
      {currentView === 'camera' && <CameraOverlay />}
      {currentView === 'teleprompter' && <Teleprompter />}
      {currentView === 'teleprompter-control' && <TeleprompterControl />}
      {currentView === 'minipanel' && <MiniPanel />}
    </div>
  );
}

export default App;
