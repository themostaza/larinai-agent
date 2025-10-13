'use client';

import React from 'react';
import { X, Brain, Clock, AlertCircle } from 'lucide-react';

interface ReasoningSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  reasoningData: {
    text?: string;
    state?: string;
    timestamp?: string;
    providerMetadata?: {
      openai?: {
        itemId?: string;
        reasoningEncryptedContent?: string | null;
      };
    };
  };
  width?: number;
  onWidthChange?: (width: number) => void;
}

export default function ReasoningSidebar({
  isOpen,
  onClose,
  reasoningData,
  width = 30,
  onWidthChange
}: ReasoningSidebarProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !onWidthChange) return;
      
      const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      const clampedWidth = Math.min(Math.max(newWidth, 20), 60);
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onWidthChange]);

  if (!isOpen) return null;

  const { text, state, timestamp, providerMetadata } = reasoningData;
  const hasContent = text && text.trim().length > 0;
  const itemId = providerMetadata?.openai?.itemId;
  const isEncrypted = providerMetadata?.openai?.reasoningEncryptedContent !== undefined;

  return (
    <>
      {/* Resize handle - visible only on desktop */}
      <div
        className="hidden md:block fixed top-0 bottom-0 w-1 bg-transparent hover:bg-purple-500/50 cursor-col-resize z-50 transition-colors"
        style={{ right: `${width}vw` }}
        onMouseDown={handleMouseDown}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="fixed top-0 right-0 h-full bg-black border-l border-purple-700/50 z-40 flex flex-col overflow-hidden"
        style={{
          width: window.innerWidth >= 768 ? `${width}vw` : '100vw'
        }}
      >
        {/* Close button - floating */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white border border-gray-700"
          title="Chiudi"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-4 py-4 bg-purple-900/20 border-b border-purple-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-purple-300">Reasoning Step</h3>
          </div>
          {state && (
            <div className="flex items-center gap-2 text-sm text-purple-400/70">
              <span className="font-mono bg-purple-900/30 px-2 py-0.5 rounded">
                {state}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Timestamp */}
          {timestamp && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{new Date(timestamp).toLocaleString('it-IT')}</span>
            </div>
          )}

          {/* Main Content */}
          {hasContent ? (
            <div className="bg-gray-900 border border-purple-700/30 rounded-lg p-4">
              <h4 className="text-sm font-medium text-purple-300 mb-3">Contenuto del ragionamento:</h4>
              <div className="bg-gray-950 rounded border border-gray-800 p-3">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {text}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-300 mb-2">
                    Contenuto non disponibile
                  </h4>
                  <p className="text-sm text-yellow-400/70 leading-relaxed">
                    {isEncrypted 
                      ? "Il contenuto del ragionamento è criptato e non può essere visualizzato. Questo comportamento è normale per alcuni modelli AI che mantengono privato il processo di reasoning."
                      : "Il contenuto del ragionamento non è stato fornito dal modello AI. Lo step di reasoning è avvenuto ma il contenuto non è accessibile."
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Metadati:</h4>
            <div className="space-y-2 text-sm">
              {itemId && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 min-w-[100px]">Item ID:</span>
                  <span className="text-gray-400 font-mono text-xs break-all">{itemId}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[100px]">Stato:</span>
                <span className="text-gray-400">{state || 'N/A'}</span>
              </div>
              {providerMetadata?.openai?.reasoningEncryptedContent !== undefined && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 min-w-[100px]">Criptato:</span>
                  <span className="text-gray-400">
                    {providerMetadata.openai.reasoningEncryptedContent === null ? 'Sì' : 'No'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-300 mb-2">
                  Cos&apos;è un Reasoning Step?
                </h4>
                <p className="text-sm text-blue-400/70 leading-relaxed">
                  Un reasoning step rappresenta un momento in cui l&apos;intelligenza artificiale 
                  &quot;pensa&quot; prima di rispondere. Durante questo processo, il modello analizza 
                  la domanda, considera diverse opzioni e formula una strategia di risposta. 
                  Alcuni modelli AI mantengono questo processo interno privato.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-purple-700/50 bg-purple-900/10 text-center text-xs text-purple-400/70">
          Reasoning step visualizzato tramite AI SDK
        </div>
      </div>

      {/* Mobile backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/50 z-30"
        onClick={onClose}
      />
    </>
  );
}

