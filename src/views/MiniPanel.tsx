import { useState, useEffect } from 'react';
import { Circle, Video, Eye, EyeOff, GripVertical, Monitor, Maximize2 } from 'lucide-react';

const MiniPanel = () => {
    const [cameraShape, setCameraShape] = useState<string>('circle');
    const [cameraSize, setCameraSize] = useState<string>('medium');
    const [cameraVisible, setCameraVisible] = useState<boolean>(true);

    const handleCameraShape = (shape: string) => {
        setCameraShape(shape);
        if (window.electronAPI) {
            window.electronAPI.setCameraShape(shape);
        }
    };

    const handleCameraSize = (size: string) => {
        setCameraSize(size);
        if (window.electronAPI) {
            window.electronAPI.setCameraSize(size);
        }
    };

    const handleCameraVisibility = () => {
        const newVisibility = !cameraVisible;
        setCameraVisible(newVisibility);
        if (window.electronAPI) {
            if (newVisibility) {
                window.electronAPI.showCameraWindow();
            } else {
                window.electronAPI.hideCameraWindow();
            }
        }
    };

    const handleOpenMainPanel = () => {
        if (window.electronAPI) {
            window.electronAPI.showMainPanel();
        }
    };

    return (
        <div 
            className="h-screen w-screen flex items-center justify-center overflow-hidden"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-2 border-slate-700 rounded-xl shadow-2xl flex items-center gap-3 px-4 py-3">
                {/* Drag Handle */}
                <div className="flex items-center text-slate-500 cursor-move">
                    <GripVertical className="w-4 h-4" />
                </div>

                {/* Open Main Panel Button */}
                <div 
                    className="flex items-center border-r border-slate-600 pr-4"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <button
                        onClick={handleOpenMainPanel}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                        title="Abrir Painel Principal"
                    >
                        <Monitor className="w-4 h-4 text-white" />
                        <Maximize2 className="w-3 h-3 text-white" />
                    </button>
                </div>

                {/* Camera Shape Buttons */}
                <div 
                    className="flex items-center gap-1 border-r border-slate-600 pr-4"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <span className="text-slate-400 text-xs mr-1 whitespace-nowrap">Formato:</span>
                    <button
                        onClick={() => handleCameraShape('circle')}
                        className={`p-2 rounded-lg transition-colors ${cameraShape === 'circle' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        title="Círculo"
                    >
                        <Circle className="w-4 h-4 text-white" />
                    </button>
                    <button
                        onClick={() => handleCameraShape('rounded')}
                        className={`p-2 rounded-lg transition-colors ${cameraShape === 'rounded' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        title="Arredondado"
                    >
                        <div className="w-4 h-4 border-2 border-white rounded-md"></div>
                    </button>
                    <button
                        onClick={() => handleCameraShape('square')}
                        className={`p-2 rounded-lg transition-colors ${cameraShape === 'square' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        title="Quadrado"
                    >
                        <div className="w-4 h-4 border-2 border-white"></div>
                    </button>
                </div>

                {/* Camera Size Buttons */}
                <div 
                    className="flex items-center gap-1 border-r border-slate-600 pr-4"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <span className="text-slate-400 text-xs mr-1 whitespace-nowrap">Tamanho:</span>
                    <button
                        onClick={() => handleCameraSize('small')}
                        className={`px-2 py-1 rounded-lg transition-colors text-xs font-medium ${cameraSize === 'small' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        title="Pequeno"
                    >
                        P
                    </button>
                    <button
                        onClick={() => handleCameraSize('medium')}
                        className={`px-2 py-1 rounded-lg transition-colors text-xs font-medium ${cameraSize === 'medium' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        title="Médio"
                    >
                        M
                    </button>
                    <button
                        onClick={() => handleCameraSize('large')}
                        className={`px-2 py-1 rounded-lg transition-colors text-xs font-medium ${cameraSize === 'large' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        title="Grande"
                    >
                        G
                    </button>
                </div>

                {/* Camera Visibility */}
                <div 
                    className="flex items-center gap-2"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <button
                        onClick={handleCameraVisibility}
                        className={`p-2 rounded-lg transition-colors ${cameraVisible ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        title={cameraVisible ? 'Ocultar Câmera' : 'Mostrar Câmera'}
                    >
                        {cameraVisible ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MiniPanel;

