'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X, Plus, MessageCircle, Sparkles, ChevronDown, ExternalLink, Search, Pencil, Check } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Funzione per fetchare le sessioni
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('ChatSidebar: Fetching sessions for agentId:', agentId);
      
      // Costruisci URL con agentId come query param
      const url = agentId 
        ? `/api/chat/sessions?agentId=${agentId}` 
        : '/api/chat/sessions';
      
      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sessions');
      }

      const newSessions = result.sessions || [];
      setSessions(newSessions);
      
      // Notifica il parent component se fornito
      onSessionsUpdate?.(newSessions);
      
      console.log(`ChatSidebar: Successfully fetched ${newSessions.length} sessions`);
    } catch (err) {
      console.error('Error fetching chat sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat sessions');
    } finally {
      setIsLoading(false);
    }
  }, [agentId, onSessionsUpdate]);

  // Fetch chat sessions UNA SOLA VOLTA al mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Esponi la funzione di refresh globalmente per consentire aggiornamenti esterni
  useEffect(() => {
    const windowWithRefresh = window as Window & { refreshChatSidebar?: () => void };
    windowWithRefresh.refreshChatSidebar = () => {
      console.log('ChatSidebar: External refresh triggered');
      fetchSessions();
    };

    return () => {
      delete windowWithRefresh.refreshChatSidebar;
    };
  }, [fetchSessions]);

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

  // Filtra le sessioni in base alla ricerca
  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery.trim()) return true;
    return session.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Funzione per iniziare la modifica del titolo
  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation(); // Previeni il click sulla sessione
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
    // Focus sull'input dopo il render
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  // Funzione per salvare il nuovo titolo
  const saveTitle = async (sessionId: string) => {
    if (!editingTitle.trim()) {
      // Se il titolo è vuoto, annulla la modifica
      setEditingSessionId(null);
      return;
    }

    try {
      console.log(`💾 Saving new title for session ${sessionId}: "${editingTitle}"`);
      
      const response = await fetch('/api/chat/name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          title: editingTitle.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`💾 Title saved successfully`);
        
        // Aggiorna la sessione nella lista locale
        setSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === sessionId
              ? { ...session, title: editingTitle.trim() }
              : session
          )
        );
        
        setEditingSessionId(null);
      } else {
        console.error('❌ Error saving title:', result.error);
        alert('Errore nel salvare il titolo');
      }
    } catch (error) {
      console.error('❌ Error in saveTitle:', error);
      alert('Errore nel salvare il titolo');
    }
  };

  // Funzione per annullare la modifica
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // Gestisci il click fuori dall'input per salvare
  useEffect(() => {
    if (!editingSessionId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Se il click è sull'input o sui bottoni di conferma/annulla, non salvare
      if (editInputRef.current?.contains(target)) {
        return;
      }

      // Salva quando si clicca fuori
      if (editingTitle.trim()) {
        saveTitle(editingSessionId);
      } else {
        cancelEditing();
      }
    };

    // Aggiungi un piccolo delay per evitare che il click iniziale venga catturato
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingSessionId, editingTitle]);

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

      {/* Overlay - chiude sidebar al click */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-all duration-300"
          onClick={() => setIsOpen(false)}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-700 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        w-80 flex flex-col
      `}>
        {/* Header */}
         <div className="p-3 border-b border-gray-700">
           <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2">
               <h2 className="text-base font-semibold text-white">Chat</h2>
               {/* New Chat Button - Compatto */}
               <button
                 onClick={handleNewChat}
                 className="p-1.5 bg-gray-800 text-white border border-gray-700 rounded hover:bg-gray-700 transition-colors"
                 title="Nuova chat (nuova tab)"
               >
                 <ExternalLink size={14} />
               </button>
             </div>
             <button
               onClick={() => setIsOpen(false)}
               className="p-1 text-gray-400 hover:text-white transition-colors"
               aria-label="Close sidebar"
             >
               <X size={18} />
             </button>
           </div>
           
           {/* Search Input */}
           <div className="relative">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
             <input
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Cerca chat..."
               className="w-full pl-9 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600 focus:border-gray-600"
             />
             {searchQuery && (
               <button
                 onClick={() => setSearchQuery('')}
                 className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                 aria-label="Pulisci ricerca"
               >
                 <X size={16} />
               </button>
             )}
           </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <p className="text-gray-400 text-sm mt-1">Caricamento chat...</p>
            </div>
          ) : error ? (
            <div className="p-3 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-3 text-center">
              <MessageCircle size={28} className="mx-auto text-gray-500 mb-1.5" />
              <p className="text-gray-400 text-sm">Nessuna chat trovata</p>
              <p className="text-gray-500 text-sm mt-0.5">Crea la tua prima chat!</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-3 text-center">
              <MessageCircle size={28} className="mx-auto text-gray-500 mb-1.5" />
              <p className="text-gray-400 text-sm">Nessun risultato</p>
              <p className="text-gray-500 text-sm mt-0.5">Nessuna chat corrisponde alla ricerca</p>
            </div>
          ) : (
            <div className="p-1.5">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`
                    w-full text-left px-2.5 py-2 rounded-lg mb-1 transition-colors
                    ${session.id === currentSessionId 
                      ? 'bg-gray-700 border border-gray-600' 
                      : 'hover:bg-gray-800'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleSessionClick(session.id)}
                    >
                      {editingSessionId === session.id ? (
                        // Modalità editing
                        <div className="flex items-center gap-1">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveTitle(session.id);
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-gray-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveTitle(session.id);
                            }}
                            className="p-1 text-green-400 hover:text-green-300 transition-colors flex-shrink-0"
                            title="Salva"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditing();
                            }}
                            className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                            title="Annulla"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        // Modalità visualizzazione
                        <>
                          <p className={`
                            text-sm font-medium truncate
                            ${session.id === currentSessionId ? 'text-white' : 'text-gray-200'}
                          `}>
                            {session.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(session.updatedAt || session.createdAt)}
                          </p>
                        </>
                      )}
                    </div>
                    
                    {/* Icona Modifica - sempre visibile su mobile */}
                    {editingSessionId !== session.id && (
                      <button
                        onClick={(e) => startEditing(session, e)}
                        className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                        title="Modifica titolo"
                        aria-label="Modifica titolo"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </>
  );
}
