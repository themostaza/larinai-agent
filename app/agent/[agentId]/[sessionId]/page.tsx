'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { useParams, useRouter } from 'next/navigation';
import DatabaseQueryButton from '../../../components/DatabaseQueryButton';
import ChatSidebar from '../../../components/ChatSidebar';

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  [key: string]: unknown;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: MessagePart[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  savedToDb?: boolean;
  [key: string]: unknown;
}

export default function ChatSessionPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const sessionId = params.sessionId as string;
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [sessionExists, setSessionExists] = useState(false);
  
  console.log('🟢 [CLIENT] agentId:', agentId, 'sessionId:', sessionId);
  
  // useChat semplice - passeremo sessionId con ogni sendMessage
  const { messages, setMessages, sendMessage: baseSendMessage } = useChat();

  // Wrapper per sendMessage che include sessionId nel body
  const sendMessage = useCallback((message: { text: string }) => {
    baseSendMessage(message, {
      body: {
        sessionId: sessionId
      }
    });
  }, [baseSendMessage, sessionId]);

  // Funzione per salvare un messaggio tramite API
  const saveMessage = useCallback(async (message: ChatMessage) => {
    try {
      console.log('Saving message via API:', message.id);
      
      const wasSessionExisting = sessionExists;

      const response = await fetch('/api/chat/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message
        }),
      });

      const result = await response.json();

      if (!result.success) {
        if (result.shouldRetry) {
          console.log(`Message ${message.id} not ready yet, will retry later`);
          return false;
        } else {
          console.log(`Message ${message.id} skipped:`, result.error);
          return true;
        }
      }

      console.log(`Message ${message.id} saved successfully:`, result.message);
      
      if (!wasSessionExisting) {
        setSessionExists(true);
        console.log('New session created, refreshing sidebar...');
        
        try {
          const windowWithRefresh = window as Window & { refreshChatSidebar?: () => void };
          if (windowWithRefresh.refreshChatSidebar) {
            windowWithRefresh.refreshChatSidebar();
          }
        } catch (err) {
          console.log('Could not notify sidebar refresh:', err);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error saving message via API:', error);
      return false;
    }
  }, [sessionId, sessionExists]);

  const checkSession = async () => {
    try {
      // Crea o verifica la sessione usando il nuovo endpoint
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          agentId
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSessionExists(true);
        console.log(`Session ${result.action}:`, result.sessionId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking/creating session:', error);
      return false;
    }
  };

  const loadChatHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      
      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
      const result = await response.json();

      if (!result.success) {
        console.error('Error loading chat history:', result.error);
        setIsLoadingHistory(false);
        return;
      }

      if (!result.sessionExists) {
        console.log('Session does not exist, will be created on first message');
        setIsLoadingHistory(false);
        return;
      }

      setSessionExists(true);
      setMessages(result.messages);
      setLastMessageCount(result.messages.length);
      
      console.log(`Loaded ${result.messages.length} messages from session ${sessionId}`);
    } catch (error) {
      console.error('Error in loadChatHistory:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [sessionId, setMessages]);

  const [lastMessageCount, setLastMessageCount] = useState(0);

  useEffect(() => {
    if (sessionId && agentId) {
      loadChatHistory();
    } else {
      setIsLoadingHistory(false);
    }
  }, [sessionId, agentId, loadChatHistory]);

  useEffect(() => {
    if (messages.length > lastMessageCount && !isLoadingHistory && sessionExists) {
      const newMessages = messages.slice(lastMessageCount);
      
      newMessages.forEach(async (message) => {
        const chatMessage = message as ChatMessage;
        if (!chatMessage.savedToDb && !isMessageStreaming(chatMessage)) {
          console.log('Saving completed message:', message);
          await saveMessage(chatMessage);
        }
      });
      
      setLastMessageCount(messages.length);
    }
  }, [messages, lastMessageCount, isLoadingHistory, sessionExists, saveMessage]);

  const isMessageStreaming = (message: ChatMessage): boolean => {
    if (!message.parts || !Array.isArray(message.parts)) return false;
    
    return message.parts.some((part: MessagePart) => 
      part.state === 'streaming' || 
      (part.type === 'text' && part.text === '' && part.state === 'streaming')
    );
  };

  useEffect(() => {
    if (!sessionExists || isLoadingHistory) return;

    const interval = setInterval(async () => {
      for (const message of messages) {
        const chatMessage = message as ChatMessage;
        if (!chatMessage.savedToDb) {
          console.log('Attempting to save message from interval:', message.id);
          const saved = await saveMessage(chatMessage);
          
          if (saved) {
            chatMessage.savedToDb = true;
          }
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [messages, sessionExists, isLoadingHistory, saveMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!sessionExists) {
      const checked = await checkSession();
      if (!checked) {
        console.error('Failed to verify/create session');
      }
    }

    setIsLoading(true);
    try {
      sendMessage({ text: input });
      setInput('');
      
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = 'auto';
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingHistory) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-white rounded-full animate-bounce"></div>
          <div className="w-4 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-4 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        textarea {
          scrollbar-width: none;
          scrollbar-color: transparent transparent;
        }
        
        textarea::-webkit-scrollbar {
          width: 0px;
        }
        
        textarea:hover::-webkit-scrollbar,
        textarea:focus::-webkit-scrollbar {
          width: 8px;
        }
        
        textarea:hover::-webkit-scrollbar-track,
        textarea:focus::-webkit-scrollbar-track {
          background: transparent;
        }
        
        textarea:hover::-webkit-scrollbar-thumb,
        textarea:focus::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
        
        textarea:hover::-webkit-scrollbar-thumb:hover,
        textarea:focus::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
        
        textarea:hover::-webkit-scrollbar-button,
        textarea:focus::-webkit-scrollbar-button {
          display: none;
        }
        
        textarea:hover,
        textarea:focus {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
        }
      `}</style>
      <div className="min-h-screen bg-black text-white flex relative">
        <ChatSidebar 
          currentSessionId={sessionId}
          agentId={agentId}
          onSessionSelect={(sessionId) => {
            console.log('Selected session:', sessionId);
          }}
        />
        
        <div className="flex-1 flex flex-col min-h-screen">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 pb-32 sm:pb-40">
            <div className="max-w-4xl mx-auto w-full">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div
                  className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-2 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-white text-black'
                      : 'bg-gray-900 text-white border border-gray-700'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed break-words">
                    <span className="text-sm font-medium opacity-60">
                      {message.role === 'user' ? 'Tu ' : 'AI '}
                    </span>
                    {message.parts?.map((part, i) => {
                      switch (part.type) {
                        case 'text':
                          return <span key={`${message.id}-${i}`}>{part.text}</span>;
                        case 'tool-read_sql_db':
                          return (
                            <DatabaseQueryButton
                              key={`${message.id}-${i}`}
                              part={part}
                              messageId={message.id}
                              partIndex={i}
                            />
                          );
                        case 'step-start':
                        case 'reasoning':
                          return null;
                        default:
                          console.log('Unknown part type:', part.type, part);
                          return null;
                      }
                    })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-2 rounded-2xl bg-gray-800 text-white border border-gray-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium opacity-60">AI </span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-gray-400 text-sm">Sto pensando...</span>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-transparent sm:p-6 w-full">
          <div className="max-w-4xl mx-auto w-full">
            <form onSubmit={handleSubmit} className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={handleInputChange}
                placeholder="Scrivi il tuo messaggio..."
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent resize-none text-sm sm:text-base min-h-[48px] max-h-64 overflow-y-auto"
                disabled={isLoading}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-3 bg-white text-black rounded-xl hover:bg-gray-100 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center self-end h-12"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center bg-gray-900 w-fit mx-auto rounded-xl px-4 py-2 border border-gray-700">
              verifica sempre le informazioni che ricevi dall&apos;agent
            </p>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
