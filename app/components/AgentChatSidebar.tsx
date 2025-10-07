'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown } from 'lucide-react';
import { AVAILABLE_MODELS, DEFAULT_MODEL, getModelsByProvider } from '@/lib/ai/models';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

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
    if (isOpen && queryContext && messages.length === 0) {
      const contextMessage: Message = {
        id: 'context-' + Date.now(),
        role: 'assistant',
        content: `Ciao! Ti supporto con l'analisi dei dati. Ho accesso al contesto:\n\nDatabase: ${queryContext.database}\nScopo: ${queryContext.purpose}\n\nCome posso aiutarti?`,
        timestamp: new Date()
      };
      setMessages([contextMessage]);
    }
  }, [isOpen, queryContext, messages.length]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Chiamata al data_agent API
      const response = await fetch('/api/data_agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.concat(userMessage).map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content
          })),
          queryContext,
          modelId: selectedModel
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const assistantMessage: Message = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let buffer = '';
      let toolExecuted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.trim() === '') continue;
          
          try {
            // Il formato è "X:JSON" dove X è il tipo di messaggio
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;
            
            const prefix = line.slice(0, colonIndex);
            const jsonStr = line.slice(colonIndex + 1);
            
            if (!jsonStr.trim()) continue;
            
            const data = JSON.parse(jsonStr);
            
            // Gestisci diversi tipi di messaggi
            if (prefix === '0' || prefix === '2') {
              // Text delta o text done
              if (data.type === 'text-delta' && data.textDelta) {
                assistantMessage.content += data.textDelta;
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: assistantMessage.content }
                    : msg
                ));
              } else if (data.content) {
                // Fallback per formato vecchio
                assistantMessage.content += data.content;
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: assistantMessage.content }
                    : msg
                ));
              }
            } else if (prefix === '9' || prefix === 'd') {
              // Tool result
              console.log('🔧 [CHAT] Tool event detected:', data);
              if ((data.toolName === 'create_chart' || data.toolCallId) && (data.result?.success || data.type === 'tool-result')) {
                console.log('✅ [CHAT] Tool create_chart executed successfully');
                toolExecuted = true;
              }
            }
          } catch (e) {
            // Ignora errori di parsing
            console.debug('Parse error:', e);
          }
        }
      }

      setIsLoading(false);
      
      // Se il tool è stato eseguito, ricarica i grafici
      if (toolExecuted) {
        console.log('🔄 [CHAT] Tool executed, reloading charts...');
        if (onChartsUpdated) {
          setTimeout(() => {
            console.log('🔄 [CHAT] Calling onChartsUpdated callback');
            onChartsUpdated();
          }, 1000); // 1 secondo di delay per dare tempo al DB
        } else {
          console.warn('⚠️ [CHAT] onChartsUpdated callback not provided');
        }
      } else {
        console.log('ℹ️ [CHAT] No tool executed, skipping chart reload');
      }
    } catch (error) {
      console.error('Error sending message to agent:', error);
      const errorMessage: Message = {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: 'Scusa, si è verificato un errore. Riprova più tardi.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
          >
            <div
              className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-white text-black'
                  : 'bg-gray-900 text-white border border-gray-700'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed break-words">
                <span className="text-sm font-medium opacity-60">
                  {message.role === 'user' ? 'Tu ' : 'AI '}
                </span>
                <span className="text-sm">{message.content}</span>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] px-4 py-2 rounded-2xl bg-gray-800 text-white border border-gray-700">
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
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scrivi un messaggio..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-100 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            title="Invia messaggio"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Model Selector */}
        <div className="mt-2 relative w-fit" ref={modelDropdownRef}>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="w-full flex items-center justify-between px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-colors"
          >
            <span className="truncate">
              {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'Seleziona modello'}
            </span>
            <ChevronDown size={12} className={`ml-1 flex-shrink-0 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isModelDropdownOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50">
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
      </div>
    </div>
  );
}
