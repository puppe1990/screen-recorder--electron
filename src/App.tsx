import { useEffect, useState } from 'react';
import ControlPanel from './views/ControlPanel';
import CameraOverlay from './views/CameraOverlay';
import Teleprompter from './views/Teleprompter';
import RecordingTimer from './views/RecordingTimer';

function App() {
  const [currentView, setCurrentView] = useState('control');

  useEffect(() => {
    // Check if electronAPI is available
    console.log('=== App mounted ===');
    console.log('window.electronAPI:', window.electronAPI);
    console.log('typeof window.electronAPI:', typeof window.electronAPI);
    console.log('window:', window);
    
    // Test if we can access electronAPI methods
    if (window.electronAPI) {
      console.log('✅ electronAPI is available!');
      console.log('Available methods:', Object.keys(window.electronAPI));
    } else {
      console.error('❌ electronAPI is NOT available!');
      console.error('This might be a preload script issue.');
    }
    
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    console.log('Current hash:', hash);
    if (hash === 'camera') {
      setCurrentView('camera');
    } else if (hash === 'teleprompter') {
      setCurrentView('teleprompter');
    } else if (hash === 'timer') {
      setCurrentView('timer');
    } else {
      setCurrentView('control');
    }
  }, []);

  return (
    <div className="h-screen w-screen overflow-auto">
      {currentView === 'control' && <ControlPanel />}
      {currentView === 'camera' && <CameraOverlay />}
      {currentView === 'teleprompter' && <Teleprompter />}
      {currentView === 'timer' && <RecordingTimer />}
    </div>
  );
}

export default App;
