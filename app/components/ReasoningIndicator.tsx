'use client';

import React from 'react';
import { Brain, ChevronRight } from 'lucide-react';

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  providerMetadata?: {
    openai?: {
      itemId?: string;
      reasoningEncryptedContent?: string | null;
    };
  };
  [key: string]: unknown;
}

interface ReasoningIndicatorProps {
  part: MessagePart;
  onClick?: () => void;
  isStreaming?: boolean;
}

export default function ReasoningIndicator({ part, onClick, isStreaming = false }: ReasoningIndicatorProps) {
  const hasContent = part.text && part.text.trim().length > 0;
  const itemId = part.providerMetadata?.openai?.itemId;
  
  // Durante lo streaming mostra "Sto pensando..."
  if (isStreaming || part.state === 'streaming' || part.state !== 'done') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-300 text-sm my-1">
        <Brain className="w-4 h-4 animate-pulse" />
        <span>Sto pensando...</span>
      </div>
    );
  }

  // Dopo il completamento, mostra un indicatore cliccabile
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-300 text-sm my-1 hover:bg-purple-900/30 hover:border-purple-500/50 transition-all cursor-pointer group"
      title="Clicca per vedere i dettagli del ragionamento"
    >
      <Brain className="w-4 h-4" />
      <span className="font-medium">Reasoning step</span>
      {hasContent && (
        <span className="text-xs text-purple-400/70">• {part.text?.substring(0, 30)}...</span>
      )}
      {itemId && !hasContent && (
        <span className="text-xs text-purple-400/50">• ID: {itemId.substring(0, 12)}...</span>
      )}
      <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

