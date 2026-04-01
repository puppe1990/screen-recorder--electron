import { useState } from 'react';
import CameraOverlay from './views/CameraOverlay';
import Teleprompter from './views/Teleprompter';
import MiniPanel from './views/MiniPanel';

const resolveViewFromHash = (hash: string) => {
  switch (hash.replace('#/', '').replace('#', '')) {
    case 'camera':
      return 'camera';
    case 'teleprompter':
      return 'teleprompter';
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
      {currentView === 'camera' && <CameraOverlay />}
      {currentView === 'teleprompter' && <Teleprompter />}
      {currentView === 'minipanel' && <MiniPanel />}
    </div>
  );
}

export default App;
