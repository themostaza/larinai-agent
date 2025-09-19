'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Database, Download, Heart, Info, X, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface QueryData {
  queryId: string;
  messageId: string;
  partIndex: number;
  part: {
    type: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    args?: Record<string, unknown>;
    result?: Record<string, unknown>;
    [key: string]: unknown;
  };
  message: {
    id: string;
    role: string;
    createdAt?: string;
    dbId?: string; // ID della riga nella tabella chat_messages
  };
  session: {
    id: string;
    title: string;
    createdAt: string;
  } | null;
}

export default function QueryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;
  const queryId = params.queryId as string;
  
  const [queryData, setQueryData] = useState<QueryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQueryAccordionOpen, setIsQueryAccordionOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [queryTitle, setQueryTitle] = useState('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isQuerySaved, setIsQuerySaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'charts'>('data');

  // Funzione per controllare se la query è già salvata
  const checkIfQuerySaved = async (messageDbId: string) => {
    try {
      const response = await fetch(`/api/query/save?chatMessageId=${messageDbId}`);
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        setIsQuerySaved(true);
      } else {
        setIsQuerySaved(false);
      }
    } catch (error) {
      console.error('Error checking if query is saved:', error);
      setIsQuerySaved(false);
    }
  };

  useEffect(() => {
    const loadQueryData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/chat/query/${queryId}`);
        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'Failed to load query data');
          return;
        }

        setQueryData(result.data);
        
        // Controlla se la query è già salvata
        await checkIfQuerySaved(result.data.message.dbId || result.data.message.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    if (queryId) {
      loadQueryData();
    }
  }, [queryId]);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const formatTableData = () => {
    if (!queryData?.part) return null;
    
    const output = queryData.part.output || queryData.part.result || {};
    if (!output || !output.results) return null;
    
    try {
      const data = output.results;
      if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
        const headers = Object.keys(data[0] as Record<string, unknown>);
        return { headers, rows: data };
      }
    } catch (e) {
      console.error('Error formatting table data:', e);
    }
    return null;
  };

  if (isLoading) {
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

  if (error || !queryData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">❌ Errore</div>
          <div className="text-gray-300 mb-6">{error || 'Query non trovata'}</div>
          <button
            onClick={() => router.push(`/agent/${sessionId}`)}
            className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
          >
            Torna alla Chat
          </button>
        </div>
      </div>
    );
  }

  // Estrai i dati dalla query (stessa logica del DatabaseQueryButton)
  const input = queryData.part.input || queryData.part.args || {};
  const output = queryData.part.output || queryData.part.result || {};
  
  const query = input.query || output.query || '';
  const database = input.database || output.database || 'N/A';
  const purpose = input.purpose || output.purpose || '';
  const result = output;

  const tableData = formatTableData();

  // Funzione per aprire il dialog di salvataggio
  const openSaveDialog = () => {
    const purpose = queryData?.part?.input?.purpose || queryData?.part?.output?.purpose || queryData?.part?.args?.purpose || '';
    setQueryTitle(String(purpose));
    setIsSaveDialogOpen(true);
  };

  // Funzione per salvare la query
  const saveQuery = async () => {
    if (!queryData || !queryTitle.trim()) return;

    try {
      const input = queryData.part.input || queryData.part.args || {};
      const output = queryData.part.output || queryData.part.result || {};
      
      const response = await fetch('/api/query/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatMessageId: queryData.message.dbId || queryData.message.id,
          query: input.query || output.query || '',
          title: queryTitle.trim(),
          body: {
            input,
            output,
            queryId: queryData.queryId,
            partIndex: queryData.partIndex
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setIsSaveDialogOpen(false);
        setQueryTitle('');
        setIsQuerySaved(true); // Marca la query come salvata
        setNotification({
          type: 'success',
          message: 'Query salvata tra i preferiti!'
        });
      } else {
        setNotification({
          type: 'error',
          message: 'Errore nel salvataggio: ' + (result.error || 'Errore sconosciuto')
        });
      }
    } catch (error) {
      console.error('Error saving query:', error);
      setNotification({
        type: 'error',
        message: 'Errore nel salvataggio della query'
      });
    }
  };

  // Funzione per scaricare i dati come CSV
  const downloadCSV = () => {
    if (!tableData || !queryData) return;
    
    try {
      // Header CSV
      const csvContent = [
        tableData.headers.join(','),
        ...tableData.rows.map(row => 
          tableData.headers.map(header => {
            const value = String((row as Record<string, unknown>)[header] ?? '');
            // Escape virgolette e racchiudi in virgolette se contiene virgole o virgolette
            const escapedValue = value.replace(/"/g, '""');
            return value.includes(',') || value.includes('"') || value.includes('\n') 
              ? `"${escapedValue}"` 
              : escapedValue;
          }).join(',')
        )
      ].join('\n');
      
      // Crea e scarica il file
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF per BOM UTF-8
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      // Nome file con timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `query-${queryData.queryId}-${timestamp}.csv`;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      console.log(`CSV downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Errore durante il download del CSV');
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
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
      {/* Header con fisarmonica */}
      <div className="border-b border-gray-700">
        <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-900/30 transition-colors">
          <button
            onClick={() => setIsQueryAccordionOpen(!isQueryAccordionOpen)}
            className="flex items-center gap-3 flex-1"
          >
            <Database className="w-6 h-6 text-blue-400" />
            {purpose && (
              <span className="text-lg font-medium text-white">
                {String(purpose)}
              </span>
            )}
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={isQuerySaved ? undefined : openSaveDialog}
              disabled={isQuerySaved}
              className={`group flex items-center p-2 rounded-lg border text-sm transition-all duration-300 overflow-hidden ${
                isQuerySaved
                  ? 'bg-gray-800/50 border-gray-500/50 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white'
              }`}
              title={isQuerySaved ? "Query già salvata tra i preferiti" : "Salva query tra i preferiti"}
            >
              <Heart className={`w-4 h-4 flex-shrink-0 ${isQuerySaved ? 'text-red-400' : ''}`} />
              <span className="whitespace-nowrap font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
                {isQuerySaved ? 'Query salvata' : 'Salva query'}
              </span>
            </button>
            
            <div className="relative group">
              <Info className="w-5 h-5 text-gray-400 hover:text-gray-300 cursor-help" />
              <div className="absolute right-0 top-8 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64">
                Salvando la query tra le preferite sarà più facile ritrovarla in futuro per riutilizzarla
              </div>
            </div>
          </div>
        </div>
        {isQueryAccordionOpen && (
          <div className="px-6 pb-6">
            <h1 className="text-lg font-medium text-white mb-4">Query</h1>
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
              <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                {String(query)}
              </pre>
            </div>
            
            {/* Dati aggiuntivi visibili solo con fisarmonica aperta */}
            <div className="mt-4 pt-4 border-t border-gray-800 text-sm text-gray-500 space-y-1">
              <div>Database: <span className="text-gray-400">{String(database)}</span></div>
              {queryData.session?.title && (
                <div>Sessione: <span className="text-gray-400">{queryData.session.title}</span></div>
              )}
              <div>Query ID: <span className="text-gray-400">{queryData.queryId}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs Section */}
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('data')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  activeTab === 'data'
                    ? 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                Dati
              </button>
              <button
                onClick={() => setActiveTab('charts')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  activeTab === 'charts'
                    ? 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                Grafici e KPI
              </button>
            </div>
            
            {/* Info e controlli per tab Dati */}
            {activeTab === 'data' && result?.success !== false && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-400">
                  {String(result?.rowCount || 0)} record • {String(result?.executionTime || 'N/A')} • {
                    queryData.message?.createdAt 
                      ? new Date(queryData.message.createdAt).toLocaleString('it-IT', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : 'N/A'
                  }
                  {Boolean(result?.truncated) && (
                    <span className="text-yellow-400 ml-2">⚠️ Troncato</span>
                  )}
                </div>
                {tableData && (
                  <div className="flex gap-2">
                    <button
                      onClick={downloadCSV}
                      className="group flex items-center p-2 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:bg-gray-700 hover:text-white transition-all duration-300 overflow-hidden"
                      title="Scarica dati come CSV"
                    >
                      <Download size={16} className="flex-shrink-0" />
                      <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
                        Scarica CSV
                      </span>
                    </button>
                    
                    <button
                      onClick={() => {/* TODO: implementare logica aggiornamento */}}
                      className="group flex items-center p-2 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:bg-gray-700 hover:text-white transition-all duration-300 overflow-hidden"
                      title="Aggiorna dati"
                    >
                      <RefreshCw size={16} className="flex-shrink-0" />
                      <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
                        Aggiorna
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 px-6 flex flex-col overflow-hidden">
          {activeTab === 'data' && (
            <>
              {result?.success === false ? (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
              <div className="text-red-400 text-lg mb-2">❌ Errore nell&apos;esecuzione della query</div>
              <div className="text-red-300 text-sm">
                {String(result.error || 'Errore sconosciuto')}
              </div>
            </div>
           ) : tableData ? (
             <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden min-h-0">
               <div className="overflow-auto h-full custom-scrollbar">
                 <table className="w-full text-sm min-w-max">
                   <thead className="bg-gray-800 sticky top-0 z-10">
                     <tr>
                       {tableData.headers.map((header, index) => (
                         <th key={index} className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-600 whitespace-nowrap">
                           {header}
                         </th>
                       ))}
                     </tr>
                   </thead>
                   <tbody>
                     {tableData.rows.map((row, rowIndex) => (
                       <tr key={rowIndex} className="border-b border-gray-800 hover:bg-gray-800/50">
                         {tableData.headers.map((header, colIndex) => (
                           <td key={colIndex} className="px-4 py-3 text-gray-300 whitespace-nowrap">
                             {String((row as Record<string, unknown>)[header] ?? '')}
                           </td>
                         ))}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-center">
              <div className="text-gray-400">Nessun dato da visualizzare</div>
            </div>
          )}
            </>
          )}
          
          {activeTab === 'charts' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-medium text-white mb-2">Grafici e KPI</h3>
                <p className="text-gray-400">
                  Questa sezione conterrà visualizzazioni grafiche e indicatori KPI basati sui dati della query.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog per salvare query */}
      {isSaveDialogOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsSaveDialogOpen(false)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl min-w-[60vw] max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-medium text-white">Salva Query Preferita</h2>
              <button
                onClick={() => setIsSaveDialogOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label htmlFor="queryTitle" className="block text-sm font-medium text-gray-300 mb-2">
                  Titolo della query
                </label>
                <input
                  id="queryTitle"
                  type="text"
                  value={queryTitle}
                  onChange={(e) => setQueryTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Inserisci un titolo per la query..."
                  autoFocus
                />
              </div>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsSaveDialogOpen(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={saveQuery}
                  disabled={!queryTitle.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed border border-gray-600 hover:border-gray-500 disabled:border-gray-600 rounded-md text-sm text-gray-300 hover:text-white disabled:text-gray-500 transition-all duration-200"
                >
                  <Heart className="w-4 h-4" />
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            notification.type === 'success' 
              ? 'bg-green-900/90 border-green-500/50 text-green-100' 
              : 'bg-red-900/90 border-red-500/50 text-red-100'
          } backdrop-blur-sm`}>
            {notification.type === 'success' ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
