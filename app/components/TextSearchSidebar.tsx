'use client';

import React from 'react';
import { X, Search, FileText, ChevronRight } from 'lucide-react';

interface SearchMatch {
  lineNumber: number;
  matchedLine: string;
  context: string;
}

interface TextSearchSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  searchData: {
    searchQuery: string;
    documentName: string;
    matchesFound: number;
    matchesReturned?: number;
    matches?: SearchMatch[];
    hasMore?: boolean;
    note?: string;
    success: boolean;
    error?: string;
  };
  width?: number;
  onWidthChange?: (width: number) => void;
}

export default function TextSearchSidebar({
  isOpen,
  onClose,
  searchData,
  width = 30,
  onWidthChange
}: TextSearchSidebarProps) {
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

  const { searchQuery, matchesFound, matches, hasMore, note, success, error } = searchData;

  return (
    <>
      {/* Resize handle - visible only on desktop */}
      <div
        className="hidden md:block fixed top-0 bottom-0 w-1 bg-transparent hover:bg-blue-500/50 cursor-col-resize z-50 transition-colors"
        style={{ right: `${width}vw` }}
        onMouseDown={handleMouseDown}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="fixed top-0 right-0 h-full bg-black border-l border-gray-700 z-40 flex flex-col overflow-hidden"
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

        {/* Search Query Display */}
        <div className="px-4 py-4 bg-gray-900/50 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm mb-2">
            <Search className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 font-mono bg-gray-800 px-2 py-1 rounded">
              &quot;{searchQuery}&quot;
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!success ? (
            <div className="p-6 text-center">
              <div className="text-red-400 text-lg mb-2">❌ Errore nella ricerca</div>
              <div className="text-gray-400 text-sm">{error || 'Errore sconosciuto'}</div>
            </div>
          ) : matchesFound === 0 ? (
            <div className="p-6 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <div className="text-gray-400 text-lg mb-2">Nessun risultato trovato</div>
              <div className="text-gray-500 text-sm">
                Prova con termini di ricerca diversi o più generici
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Note if results are limited */}
              {hasMore && note && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300">
                  ℹ️ {note}
                </div>
              )}

              {/* Results */}
              {matches && matches.map((match, index) => (
                <div
                  key={index}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  {/* Match header */}
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800">
                    <ChevronRight className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-300">
                      Risultato {index + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      • Riga {match.lineNumber}
                    </span>
                  </div>

                  {/* Context with matched line highlighted */}
                  <div className="bg-gray-950 rounded border border-gray-800 overflow-x-auto">
                    <pre className="text-xs font-mono p-3 text-gray-300 whitespace-pre-wrap">
                      {match.context}
                    </pre>
                  </div>

                  {/* Matched line (if different from context) */}
                  {match.matchedLine && (
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="text-gray-400">Riga trovata:</span> {match.matchedLine}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-900 text-center text-xs text-gray-500">
          {matchesFound > 0 && (
            <span>Mostrando {matches?.length || 0} di {matchesFound} risultati</span>
          )}
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

