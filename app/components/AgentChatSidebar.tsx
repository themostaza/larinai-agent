'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ChevronDown, Loader2, RotateCcw, Info } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { AVAILABLE_MODELS, DEFAULT_MODEL, getModelsByProvider } from '@/lib/ai/models';
import MarkdownMessage from './MarkdownMessage';

interface AgentChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
  queryContext?: {
    query: string;
    database: string;
    purpose: string;
    sessionId: string;
    queryId: string;
    chatMessageId?: string;
  };
  onChartsUpdated?: () => void; // Callback per ricaricare i grafici
}

export default function AgentChatSidebar({ isOpen, onWidthChange, queryContext, onChartsUpdated }: AgentChatSidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [includeContext, setIncludeContext] = useState(true); // Toggle contesto, default ON
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false); // Traccia se l'utente ha già inviato messaggi
  const [hasInitialized, setHasInitialized] = useState(false); // Traccia se abbiamo già inizializzato
  const [input, setInput] = useState(''); // Stato locale per input
  const [isLoading, setIsLoading] = useState(false); // Stato locale per loading
  const processedToolCallsRef = useRef<Set<string>>(new Set()); // Traccia tool calls già processati
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  
  // useChat hook - usa /api/chat standard con flag isChartAgent
  const { messages, setMessages, sendMessage: baseSendMessage } = useChat({
    onFinish: () => {
      console.log('✅ [CHART-AGENT] Message finished');
      setIsLoading(false);
      // onChartsUpdated viene chiamato IMMEDIATAMENTE quando il tool completa con successo (vedi useEffect sopra)
    }
  });

  // Carica il modello selezionato da localStorage al mount
  useEffect(() => {
    const savedModel = localStorage.getItem('selectedChartAIModel');
    if (savedModel && AVAILABLE_MODELS.some(m => m.id === savedModel)) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Salva il modello selezionato in localStorage quando cambia
  useEffect(() => {
    localStorage.setItem('selectedChartAIModel', selectedModel);
  }, [selectedModel]);

  // Chiudi dropdown quando clicchi fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Monitor messaggi per tool execution in tempo reale
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    
    // Controlla l'ultimo messaggio per tool di create_chart
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.parts) {
      // Cerca tool calls di create_chart non ancora processati
      lastMessage.parts.forEach((part) => {
        if (part.type?.startsWith('tool-') && part.type.includes('create_chart')) {
          // Usa toolCallId come identificatore univoco
          const toolCallId = (part as { toolCallId?: string }).toolCallId;
          
          // Verifica che il tool sia COMPLETATO con successo
          const result = (part as { result?: { success?: boolean } }).result;
          const output = (part as { output?: { success?: boolean } }).output;
          const toolResult = result || output;
          
          if (toolCallId && !processedToolCallsRef.current.has(toolCallId)) {
            // Se il tool ha un risultato (completato) E ha success: true
            if (toolResult && toolResult.success === true) {
              console.log('✅ [CHART-AGENT] Tool create_chart completed successfully (ID:', toolCallId, '), reloading charts NOW!');
              processedToolCallsRef.current.add(toolCallId);
              
              if (onChartsUpdated) {
                // Ricarica i grafici IMMEDIATAMENTE - il tool ha già salvato nel DB
                onChartsUpdated();
              }
            } else if (toolResult) {
              // Tool completato ma con errore
              console.warn('⚠️ [CHART-AGENT] Tool create_chart completed with error (ID:', toolCallId, ')');
              processedToolCallsRef.current.add(toolCallId);
            }
            // Se non c'è result/output, il tool non è ancora completato - aspettiamo il prossimo update
          }
        }
      });
    }
  }, [messages, onChartsUpdated]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const viewportWidth = window.innerWidth;
      const newWidth = ((viewportWidth - e.clientX) / viewportWidth) * 100;
      
      // Clamp between 10% and 60%
      const clampedWidth = Math.max(10, Math.min(60, newWidth));
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  // Initialize with context message when sidebar opens
  useEffect(() => {
    if (isOpen && queryContext && !hasInitialized && messages.length === 0) {
      // Aspetta un po' prima di inizializzare per evitare race conditions
      setTimeout(() => {
        const contextMessage = {
          id: 'context-' + Date.now(),
          role: 'assistant' as const,
          parts: [{
            type: 'text' as const,
            text: `👋 Sono il tuo assistente per l'analisi dati.

Come posso supportarti?`
          }]
        };
        setMessages([contextMessage]);
        setHasInitialized(true);
      }, 100);
    }
  }, [isOpen, queryContext, hasInitialized, messages.length, setMessages]);

  // Wrapper per baseSendMessage che blocca il toggle dopo il primo messaggio
  const sendMessage = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input || !input.trim() || isLoading) return;

    // Blocca il toggle contesto dopo il primo messaggio
    if (!hasUserSentMessage) {
      setHasUserSentMessage(true);
    }

    console.log('📤 [CHART-AGENT] Sending message');
    setIsLoading(true);
    baseSendMessage({ text: input }, {
      body: {
        isChartAgent: true, // Flag per identificare richieste dal Chart Agent
        queryContext: includeContext ? queryContext : undefined,
        modelId: selectedModel
      }
    });
    setInput('');
    
    // Reset altezza textarea dopo invio
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input, isLoading, hasUserSentMessage, baseSendMessage, includeContext, queryContext, selectedModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  const handleResetChat = useCallback(() => {
    // Reset ai messaggi iniziali se c'è un contesto, altrimenti array vuoto
    if (queryContext) {
      const contextMessage = {
        id: 'context-' + Date.now(),
        role: 'assistant' as const,
        parts: [{
          type: 'text' as const,
          text: `👋 Sono il tuo assistente per l'analisi dati.

Come posso supportarti?`
        }]
      };
      setMessages([contextMessage]);
    } else {
      setMessages([]);
    }
    
    // Reset anche il flag per sbloccare il toggle contesto
    setHasUserSentMessage(false);
    // Reset toggle contesto al default (ON)
    setIncludeContext(true);
    // Reset flag inizializzazione
    setHasInitialized(queryContext ? true : false);
    // Pulisci i tool calls processati
    processedToolCallsRef.current.clear();
  }, [queryContext, setMessages]);

  if (!isOpen) return null;

  return (
    <div className="h-full bg-black border-l border-gray-700 flex flex-col relative">
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: auto;
          scrollbar-color: #6B7280 #374151;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #6B7280;
          border-radius: 6px;
          border: 2px solid #374151;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
        }
        
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: #374151;
        }
      `}</style>
      
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:w-2 hover:bg-gray-600 transition-all duration-200 z-10"
        onMouseDown={handleResizeStart}
        title="Trascina per ridimensionare"
      />
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative">
        {/* Top controls - fixed top right, aligned with messages */}
        <div className="sticky top-0 float-right flex items-center gap-3 z-20 mb-2">
          {/* Toggle Contesto */}
          <div className="flex items-center gap-2">
            {/* Info icon con tooltip */}
            <div className="relative group">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute right-0 top-6 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64 border border-gray-700">
                {includeContext 
                  ? "Con il contesto attivo, l'AI riceverà la query del database e il suo scopo dalla chat principale per analisi più precise."
                  : "Senza contesto, l'AI conoscerà solo la struttura dei dati disponibili per l'analisi."}
              </div>
            </div>
            
            <span className="text-xs text-gray-400">Contesto</span>
            <button
              onClick={() => !hasUserSentMessage && setIncludeContext(!includeContext)}
              disabled={hasUserSentMessage}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                includeContext ? 'bg-gray-400' : 'bg-gray-800'
              } ${hasUserSentMessage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
              title={hasUserSentMessage ? 'Bloccato dopo il primo messaggio' : 'Attiva/Disattiva contesto query'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                  includeContext ? 'bg-white translate-x-5' : 'bg-gray-500 translate-x-0.5'
                }`}
              />
            </button>
          </div>
          
          {/* Reset button */}
          <button
            onClick={handleResetChat}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
            title="Ricomincia chat"
          >
            <RotateCcw size={16} />
          </button>
        </div>
        
        <div className="clear-both"></div>
        {messages.map((message, index) => {
          // Un messaggio sta streamando se è l'ultimo e isLoading è true
          const isStreaming = isLoading && index === messages.length - 1 && message.role === 'assistant';
          // Estrai il contenuto testuale dal messaggio (parts)
          const messageContent = message.parts
            ?.filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('') || '';
          
          return (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-white text-black'
                    : 'bg-gray-900 text-white border border-gray-700'
                }`}
              >
                <div className="leading-relaxed break-words">
                  <span className="text-sm font-medium opacity-60">
                    {message.role === 'user' ? 'Tu ' : 'AI '}
                  </span>
                  {message.role === 'assistant' ? (
                    isStreaming ? (
                      // Durante lo streaming mostra testo plain con loader
                      <span className="text-sm whitespace-pre-wrap">
                        {messageContent}
                        <span className="inline-flex items-center ml-2 align-middle">
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        </span>
                      </span>
                    ) : (
                      // Messaggio completato: mostra markdown
                      <div className="text-sm prose prose-invert prose-sm max-w-none">
                        <MarkdownMessage content={messageContent} />
                      </div>
                    )
                  ) : (
                    // Messaggi utente: sempre plain text
                    <span className="text-sm whitespace-pre-wrap">{messageContent}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium opacity-60">AI </span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        <form onSubmit={sendMessage} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input || ''}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio..."
            disabled={isLoading}
            rows={1}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50 resize-none overflow-y-auto"
            style={{ maxHeight: '150px', minHeight: '40px' }}
          />
          <button
            type="submit"
            disabled={!input || !input.trim() || isLoading}
            className="w-10 h-10 bg-white text-black rounded-lg hover:bg-gray-100 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
            title="Invia messaggio (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        
        {/* Model Selector - nascosto se c'è solo un modello disponibile */}
        {AVAILABLE_MODELS.length > 1 && (
          <div className="mt-2 relative w-full" ref={modelDropdownRef}>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="w-fit flex items-center justify-between px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-colors"
            >
              <span className="truncate">
                {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'Seleziona modello'}
              </span>
              <ChevronDown size={12} className={`ml-1 flex-shrink-0 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isModelDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50 w-full">
                {Object.entries(getModelsByProvider()).map(([provider, models]) => (
                  models.length > 0 && (
                    <div key={provider}>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-700">
                        {provider}
                      </div>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-700 transition-colors ${
                            selectedModel === model.id ? 'bg-gray-700 text-white' : 'text-gray-300'
                          }`}
                        >
                          <div className="font-medium">{model.name}</div>
                          <div className="text-gray-500 text-[10px] mt-0.5">{model.description}</div>
                        </button>
                      ))}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
