'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import DatabaseQueryButton from '../components/DatabaseQueryButton';

export default function SalesAgentPage() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { messages, sendMessage } = useChat();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await sendMessage({ text: input });
      setInput('');
      
      // Reset textarea height
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = 'auto';
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        /* Custom scrollbar styles for textarea - only show when scrolling is needed */
        textarea {
          scrollbar-width: none; /* Firefox - hide by default */
          scrollbar-color: transparent transparent;
        }
        
        textarea::-webkit-scrollbar {
          width: 0px; /* Hide by default */
        }
        
        /* Show scrollbar only when content overflows */
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
        
        /* Firefox - show scrollbar on hover/focus when needed */
        textarea:hover,
        textarea:focus {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
        }
      `}</style>
      <div className="min-h-screen bg-black text-white flex flex-col relative">
        {/* Messages Area - with bottom padding to avoid overlap with fixed input */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 pb-32 sm:pb-40">
          <div className="max-w-4xl mx-auto w-full">
            {messages.length === 0 && (
              <div className="text-center py-12 sm:py-20">
                <h3 className="text-xl font-semibold text-white mb-2">Inizia una conversazione</h3>
              </div>
            )}

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
                    {message.parts.map((part, i) => {
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
                          // Ignora questi tipi di part (sono interni all'AI)
                          return null;
                        default:
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

        {/* Fixed Input Area */}
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
    </>
  );
}