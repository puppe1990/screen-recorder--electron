import { useEffect, useState } from 'react';

const Teleprompter = () => {
  const [text, setText] = useState('This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!');

  useEffect(() => {
    if (window.electronAPI) {
      const handleTextChange = (newText: string) => {
        setText(newText);
      };
      
      // Register listener
      window.electronAPI.onTeleprompterTextChange(handleTextChange);
      
      // Note: In Electron with contextBridge, listeners are automatically cleaned up
      // but we can't manually remove them. The listener will persist for the window lifetime.
    }
  }, []);

  return (
    <div className="w-full h-full bg-black/50 text-white p-4 overflow-hidden drag-region">
      <div className="animate-scroll text-2xl font-bold leading-relaxed text-center whitespace-pre-wrap">
        {text}
      </div>
      <style>{`
        .drag-region {
          -webkit-app-region: drag;
        }
        @keyframes scroll {
          0% { transform: translateY(100%); }
          100% { transform: translateY(-100%); }
        }
        .animate-scroll {
          animation: scroll 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Teleprompter;
