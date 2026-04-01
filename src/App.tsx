import { useEffect, useState } from 'react';
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
  const isCameraView = currentView === 'camera';

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const rootElement = document.getElementById('root');

    if (isCameraView) {
      root.style.background = 'transparent';
      body.style.background = 'transparent';
      if (rootElement) {
        rootElement.style.background = 'transparent';
      }
      return () => {
        root.style.background = '';
        body.style.background = '';
        if (rootElement) {
          rootElement.style.background = '';
        }
      };
    }

    return undefined;
  }, [isCameraView]);

  return (
    <div
      className={
        isCameraView
          ? 'h-screen w-screen overflow-hidden bg-transparent text-white'
          : 'h-screen w-screen overflow-auto bg-[radial-gradient(circle_at_top,rgba(110,231,249,0.08),transparent_24%),#07090d] text-white'
      }
    >
      {isCameraView && <CameraOverlay />}
      {currentView === 'teleprompter' && <Teleprompter />}
      {currentView === 'minipanel' && <MiniPanel />}
    </div>
  );
}

export default App;
