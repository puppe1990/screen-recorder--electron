import { useEffect, useState } from 'react';
import ControlPanel from './views/ControlPanel';
import CameraOverlay from './views/CameraOverlay';
import Teleprompter from './views/Teleprompter';

function App() {
  const [currentView, setCurrentView] = useState('control');

  useEffect(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash === 'camera') {
      setCurrentView('camera');
    } else if (hash === 'teleprompter') {
      setCurrentView('teleprompter');
    } else {
      setCurrentView('control');
    }
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      {currentView === 'control' && <ControlPanel />}
      {currentView === 'camera' && <CameraOverlay />}
      {currentView === 'teleprompter' && <Teleprompter />}
    </div>
  );
}

export default App;
