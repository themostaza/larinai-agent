'use client';

import React, { useState, useEffect } from 'react';
import { Menu, X, Plus, MessageCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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
  onSessionSelect?: (sessionId: string) => void;
  onSessionsUpdate?: (sessions: ChatSession[]) => void;
}

export default function ChatSidebar({ currentSessionId, onSessionSelect, onSessionsUpdate }: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sidebar collassata di default su tutte le dimensioni
  useEffect(() => {
    setIsOpen(false);
  }, []);

  // Funzione per caricare le sessioni con aggiornamento intelligente
  const fetchSessions = async (forceRefresh = false) => {
    try {
      // Solo mostra loading se è il primo caricamento o refresh forzato
      if (sessions.length === 0 || forceRefresh) {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch('/api/chat/sessions');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sessions');
      }

      const newSessions = result.sessions || [];
      
      // Aggiornamento intelligente: confronta solo i titoli e updated_at
      if (sessions.length > 0 && !forceRefresh) {
        const updatedSessions = sessions.map(existingSession => {
          const updatedSession = newSessions.find((ns: ChatSession) => ns.id === existingSession.id);
          if (updatedSession && 
              (updatedSession.title !== existingSession.title || 
               updatedSession.updatedAt !== existingSession.updatedAt)) {
            // Aggiungi flag temporaneo per evidenziare l'aggiornamento
            return { ...updatedSession, _justUpdated: true };
          }
          return existingSession;
        });
        
        // Aggiungi nuove sessioni se ce ne sono
        const newSessionsToAdd = newSessions.filter((ns: ChatSession) => 
          !sessions.some(es => es.id === ns.id)
        );
        
        const finalSessions = [...updatedSessions, ...newSessionsToAdd];
        setSessions(finalSessions);
        
        // Rimuovi il flag _justUpdated dopo un breve delay
        setTimeout(() => {
          setSessions(prev => prev.map(s => ({ ...s, _justUpdated: false })));
        }, 2000);
        
      } else {
        // Primo caricamento o refresh completo
        setSessions(newSessions);
      }
      
      // Notifica il parent component se fornito
      onSessionsUpdate?.(newSessions);
      
      return newSessions;
    } catch (err) {
      console.error('Error fetching chat sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat sessions');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch chat sessions al mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Funzione pubblica per forzare il refresh
  const refreshSessions = () => {
    fetchSessions(true); // Force refresh completo
  };

  // Refresh automatico quando si apre la sidebar
  useEffect(() => {
    if (isOpen && sessions.length > 0) {
      // Refresh intelligente quando si apre la sidebar
      fetchSessions(false);
    }
  }, [isOpen, fetchSessions, sessions.length]);

  // Esponi la funzione di refresh al window per permettere chiamate dalla pagina di chat
  useEffect(() => {
    (window as Window & { refreshChatSidebar?: () => void }).refreshChatSidebar = refreshSessions;
    
    return () => {
      delete (window as Window & { refreshChatSidebar?: () => void }).refreshChatSidebar;
    };
  }, [refreshSessions]);

  const handleNewChat = () => {
    const newSessionId = uuidv4();
    const newTab = window.open(`/agent/${newSessionId}`, '_blank');
    if (newTab) {
      newTab.focus();
    }
  };

  const handleSessionClick = (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      const newTab = window.open(`/agent/${sessionId}`, '_blank');
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
      {/* Barra dei controlli quando sidebar è collassata */}
      {!isOpen && (
        <div className="fixed top-4 left-4 z-50 flex gap-2">
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            <Plus size={18} />
            Nuova chat
          </button>
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
