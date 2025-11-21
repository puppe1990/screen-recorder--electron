import { useEffect, useState } from 'react';
import { Play, Type, XCircle, StickyNote, Wand2 } from 'lucide-react';

const TeleprompterControl = () => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'sync' | 'error'>('idle');

  useEffect(() => {
    let active = true;

    const loadText = async () => {
      if (!window.electronAPI?.getTeleprompterText) return;
      try {
        const saved = await window.electronAPI.getTeleprompterText();
        if (active && typeof saved === 'string') {
          setText(saved);
        }
      } catch (error) {
        console.error('Não foi possível carregar o texto do teleprompter:', error);
        setStatus('error');
      }
    };

    const cleanup = window.electronAPI?.onTeleprompterTextChange
      ? window.electronAPI.onTeleprompterTextChange((newText: string) => {
          if (!active) return;
          setText(newText);
        })
      : undefined;

    loadText();

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const handleTextChange = (value: string) => {
    setText(value);
    setStatus('sync');
    try {
      window.electronAPI?.setTeleprompterText(value);
      // brief visual feedback
      window.setTimeout(() => setStatus('idle'), 400);
    } catch (error) {
      console.error('Falha ao enviar texto do teleprompter:', error);
      setStatus('error');
    }
  };

  const openTeleprompterWindow = () => {
    window.electronAPI?.openTeleprompter();
  };

  const closeTeleprompterWindow = () => {
    window.electronAPI?.closeTeleprompter();
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-slate-900/70 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-600/20 border border-purple-500/30">
              <Type className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Centro de Controle do Teleprompter</h1>
              <p className="text-slate-400 text-sm">Edite o roteiro e controle a janela do teleprompter.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={openTeleprompterWindow}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Play className="w-4 h-4" />
              Abrir Teleprompter
            </button>
            <button
              onClick={closeTeleprompterWindow}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20"
            >
              <XCircle className="w-4 h-4" />
              Fechar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
              <StickyNote className="w-4 h-4 text-purple-300" />
              Texto do roteiro
            </label>
            <textarea
              className="w-full h-80 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-white text-sm leading-relaxed placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              placeholder="Cole ou digite seu texto para o teleprompter..."
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
            />
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span
                className={`px-2 py-1 rounded-lg border ${
                  status === 'error'
                    ? 'border-rose-500 text-rose-300'
                    : status === 'sync'
                      ? 'border-emerald-500 text-emerald-300'
                      : 'border-slate-600 text-slate-400'
                }`}
              >
                {status === 'error'
                  ? 'Erro ao sincronizar'
                  : status === 'sync'
                    ? 'Sincronizando...'
                    : 'Pronto'}
              </span>
              <span className="text-slate-500">Atualiza a janela do teleprompter em tempo real.</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-4 h-fit">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Wand2 className="w-4 h-4 text-purple-300" />
              Dicas rápidas
            </div>
            <ul className="space-y-2 text-sm text-slate-400 list-disc list-inside">
              <li>Use o botão Abrir para mostrar a janela do teleprompter flutuante.</li>
              <li>Edite o texto aqui e veja a atualização em tempo real.</li>
              <li>Feche quando terminar para tirar o overlay da frente.</li>
            </ul>
            <div className="text-xs text-slate-500 border-t border-slate-800 pt-3">
              A janela do teleprompter não aparece na gravação porque tem proteção de captura ativada.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeleprompterControl;
