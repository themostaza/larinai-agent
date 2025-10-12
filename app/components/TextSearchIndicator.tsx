'use client';

import React from 'react';
import { Search, ChevronRight } from 'lucide-react';

interface TextSearchIndicatorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any;
  onClick?: () => void;
}

export default function TextSearchIndicator({ part, onClick }: TextSearchIndicatorProps) {
  const input = part.input || part.args || {};
  const output = part.output || part.result || {};
  
  const searchQuery = input.searchQuery || '';
  const matchesFound = output.matchesFound || 0;
  const documentName = output.documentName || 'documento';
  const success = output.success !== false;

  const hasResults = success && matchesFound > 0;

  return (
    <div 
      onClick={onClick}
      className={`inline-flex items-center gap-2 text-xs text-gray-400 my-1 px-2 py-1 bg-gray-800/50 rounded border border-gray-700 ${
        hasResults && onClick ? 'cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-colors' : ''
      }`}
      title={hasResults && onClick ? 'Clicca per vedere i risultati' : undefined}
    >
      <Search className="w-3 h-3 text-blue-400" />
      <span>
        Ricerca in <span className="text-gray-300">{documentName}</span>: 
        <span className="text-blue-400 mx-1">&quot;{searchQuery}&quot;</span>
        {success ? (
          <span className="text-green-400">
            • {matchesFound} risultat{matchesFound !== 1 ? 'i' : 'o'}
          </span>
        ) : (
          <span className="text-red-400">• errore</span>
        )}
      </span>
      {hasResults && onClick && (
        <ChevronRight className="w-3 h-3 text-gray-500 ml-1" />
      )}
    </div>
  );
}


