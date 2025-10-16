'use client';

import React from 'react';
import { Brain } from 'lucide-react';

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
  isStreaming?: boolean;
}

export default function ReasoningIndicator({ part, isStreaming = false }: ReasoningIndicatorProps) {
  const hasContent = part.text && part.text.trim().length > 0;
  
  // Durante lo streaming mostra "Sto pensando..."
  if (isStreaming || part.state === 'streaming' || part.state !== 'done') {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-purple-400 my-1 px-2 py-1 bg-purple-900/20 rounded border border-purple-500/30">
        <Brain className="w-3 h-3 animate-pulse" />
        <span>Sto pensando...</span>
      </div>
    );
  }

  // Dopo il completamento, mostra un indicatore compatto
  return (
    <div className="inline-flex items-center gap-2 text-xs text-purple-400 my-1 px-2 py-1 bg-purple-900/20 rounded border border-purple-500/30">
      <Brain className="w-3 h-3" />
      <span>Reasoning step</span>
      {hasContent && (
        <span className="text-purple-300">• {part.text?.substring(0, 25)}...</span>
      )}
    </div>
  );
}

