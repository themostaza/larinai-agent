'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Plus, MessageCircle, Sparkles, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { AVAILABLE_MODELS, getModelsByProvider } from '@/lib/ai/models';

interface ChatSession {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  metadata?: Record<string, unknown> | null;
  _justUpdated?: boolean; // Flag temporaneo per evidenziare aggiornamenti
}

interface ChatSidebarProps {
  currentSessionId: string;
  agentId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onSessionsUpdate?: (sessions: ChatSession[]) => void;
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
}

export default function ChatSidebar({ currentSessionId, agentId, onSessionSelect, onSessionsUpdate, selectedModel, onModelChange }: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Sidebar collassata di default su tutte le dimensioni
  useEffect(() => {
    setIsOpen(false);
  }, []);

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

  // Fetch chat sessions UNA SOLA VOLTA al mount - SEMPLIFICATO
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('ChatSidebar: Fetching sessions (ONCE)...');
        const response = await fetch('/api/chat/sessions');
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch sessions');
        }

        const newSessions = result.sessions || [];
        setSessions(newSessions);
        
        // Notifica il parent component se fornito
        onSessionsUpdate?.(newSessions);
        
        console.log(`ChatSidebar: Successfully fetched ${newSessions.length} sessions (ONCE)`);
      } catch (err) {
        console.error('Error fetching chat sessions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chat sessions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []); // NESSUNA DIPENDENZA - chiamata una sola volta

  const handleNewChat = () => {
    if (!agentId) {
      // Se non c'è agentId, torna alla home
      window.location.href = '/back';
      return;
    }
    const newSessionId = uuidv4();
    const newTab = window.open(`/agent/${agentId}/${newSessionId}`, '_blank');
    if (newTab) {
      newTab.focus();
    }
  };

  const handleSessionClick = (sessionId: string) => {
    if (sessionId !== currentSessionId && agentId) {
      const newTab = window.open(`/agent/${agentId}/${sessionId}`, '_blank');
      if (newTab) {
        newTab.focus();
      }
    }
    
    // Close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
    
    onSessionSelect?.(sessionId);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data sconosciuta';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Oggi';
    if (diffDays === 2) return 'Ieri';
    if (diffDays <= 7) return `${diffDays - 1} giorni fa`;
    
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <>
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgb(75 85 99) transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgb(75 85 99);
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgb(107 114 128);
        }
      `}</style>
      {/* Barra dei controlli quando sidebar è collassata */}
      {!isOpen && (
        <div className="fixed top-4 left-4 z-50 flex gap-2 flex-wrap">
          {/* Hamburger Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center p-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 transition-all duration-300 overflow-hidden"
            aria-label="Apri sidebar"
          >
            <Menu size={20} className="flex-shrink-0" />
            <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
              Menu
            </span>
          </button>
          
          {/* Nuova Chat Button */}
          <button
            onClick={handleNewChat}
            className="group flex items-center p-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 transition-all duration-300 overflow-hidden"
            aria-label="Nuova chat"
          >
            <Plus size={20} className="flex-shrink-0" />
            <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
              Nuova chat
            </span>
          </button>

          {/* Model Selector - Compatto */}
          {selectedModel && onModelChange && (
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 p-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 transition-all duration-300 h-[40px]"
                title="Seleziona modello AI"
              >
                <Sparkles size={16} className="flex-shrink-0 text-purple-400" />
                <span className="text-xs font-medium text-gray-200 max-w-[120px] truncate">
                  {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}
                </span>
                <ChevronDown size={14} className={`flex-shrink-0 text-gray-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto custom-scrollbar">
                  {Object.entries(getModelsByProvider()).map(([provider, models]) => (
                    <div key={provider} className="py-2">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {provider}
                      </div>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            onModelChange(model.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors ${
                            selectedModel === model.id ? 'bg-gray-700 border-l-2 border-purple-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">{model.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{model.description}</p>
                            </div>
                            {selectedModel === model.id && (
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-700 z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        w-80 flex flex-col
      `}>
        {/* Header */}
         <div className="p-4 border-b border-gray-700">
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-semibold text-white">Chat</h2>
             <button
               onClick={() => setIsOpen(false)}
               className="p-1 text-gray-400 hover:text-white transition-colors"
               aria-label="Close sidebar"
             >
               <X size={20} />
             </button>
           </div>
          
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors font-medium mb-3"
          >
            <Plus size={18} />
            Nuova chat
          </button>

          {/* Model Selector */}
          {selectedModel && onModelChange && (
            <div className="space-y-2 relative" ref={modelDropdownRef}>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
                <Sparkles size={14} className="text-purple-400" />
                Modello AI
              </label>
              
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:bg-gray-750 transition-colors flex items-center justify-between"
              >
                <span className="truncate">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}</span>
                <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <p className="text-xs text-gray-500">
                {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.description}
              </p>

              {/* Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute top-[70px] left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
                  {Object.entries(getModelsByProvider()).map(([provider, models]) => (
                    <div key={provider} className="py-2">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {provider}
                      </div>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            onModelChange(model.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors ${
                            selectedModel === model.id ? 'bg-gray-700 border-l-2 border-purple-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">{model.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{model.description}</p>
                            </div>
                            {selectedModel === model.id && (
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <p className="text-gray-400 text-sm mt-2">Caricamento chat...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center">
              <MessageCircle size={32} className="mx-auto text-gray-500 mb-2" />
              <p className="text-gray-400 text-sm">Nessuna chat trovata</p>
              <p className="text-gray-500 text-xs mt-1">Crea la tua prima chat!</p>
            </div>
          ) : (
            <div className="p-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSessionClick(session.id)}
                  className={`
                    w-full text-left p-3 rounded-lg mb-2 transition-colors
                    ${session.id === currentSessionId 
                      ? 'bg-gray-700 border border-gray-600' 
                      : 'hover:bg-gray-800'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`
                        text-sm font-medium truncate
                        ${session.id === currentSessionId ? 'text-white' : 'text-gray-200'}
                      `}>
                        {session.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(session.updatedAt || session.createdAt)}
                      </p>
                    </div>
                    {session.id === currentSessionId && (
                      <div className="w-2 h-2 bg-white rounded-full ml-2 mt-2 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </>
  );
}
