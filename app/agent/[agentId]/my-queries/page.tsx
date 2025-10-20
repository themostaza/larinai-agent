'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, MessageSquare, ExternalLink } from 'lucide-react';

interface Query {
  id: string;
  title: string;
  query: string;
  createdAt: string;
  body: unknown;
  chartKpi: unknown;
  sessionId: string;
  sessionTitle: string;
  userId: string;
  userEmail: string;
}

interface Agent {
  id: string;
  name: string;
  system_prompt: string | null;
  settings: unknown;
  organization_id: string;
  created_at: string;
}

export default function MyQueriesPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [agentId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch agent info
      const agentResponse = await fetch(`/api/agents/${agentId}`);
      const agentData = await agentResponse.json();

      if (!agentData.success) {
        setError(agentData.error || 'Errore nel caricamento dell\'agent');
        setIsLoading(false);
        return;
      }

      setAgent(agentData.agent);

      // Fetch user queries
      const queriesResponse = await fetch(`/api/agents/${agentId}/my-queries?limit=100`);
      const queriesData = await queriesResponse.json();

      if (!queriesData.success) {
        setError(queriesData.error || 'Errore nel caricamento delle query');
        setIsLoading(false);
        return;
      }

      setQueries(queriesData.queries);
      // Seleziona automaticamente la prima query se presente
      if (queriesData.queries.length > 0) {
        setSelectedQueryId(queriesData.queries[0].id);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Errore di connessione');
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getQueryId = (body: unknown): string | null => {
    if (body && typeof body === 'object' && 'queryId' in body) {
      return (body as { queryId?: string }).queryId || null;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xl">Caricamento...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <button
                onClick={() => router.push('/back')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Torna indietro</span>
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-500">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  const selectedQuery = queries.find(q => q.id === selectedQueryId);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="w-full px-4">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => router.push('/back')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Torna indietro</span>
            </button>
            <h1 className="text-lg font-semibold truncate">
              Le Mie Query - {agent?.name || 'Agent'}
            </h1>
            <div className="w-32"></div> {/* Spacer per centrare il titolo */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      {queries.length === 0 ? (
        <main className="w-full px-4 py-8">
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
            <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg mb-2">
              Non hai ancora salvato query per questo agent.
            </p>
            <p className="text-gray-500 text-sm">
              Le query salvate appariranno qui
            </p>
          </div>
        </main>
      ) : (
        <div className="fixed inset-0 top-[57px] flex gap-4 px-4">
          {/* Queries List - Sidebar Left */}
          <div className="w-80 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex flex-col flex-shrink-0 my-4">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">
                Le Mie Query ({queries.length})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {queries.map((query) => (
                <button
                  key={query.id}
                  onClick={() => setSelectedQueryId(query.id)}
                  className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                    selectedQueryId === query.id ? 'bg-gray-800 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <h3 className="text-sm font-medium text-white mb-1 truncate">
                    {query.title}
                  </h3>
                  {query.sessionTitle && (
                    <p className="text-xs text-gray-500 mb-1 truncate">
                      📁 {query.sessionTitle}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {formatDate(query.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Query Content - Main Area */}
          <div className="flex-1 overflow-hidden my-4">
            {selectedQuery ? (
              <div className="h-full overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto w-full">
                  {/* Pulsante Apri Query */}
                  {(() => {
                    const queryId = getQueryId(selectedQuery.body);
                    if (selectedQuery.sessionId && queryId) {
                      return (
                        <div className="mb-4">
                          <button
                            onClick={() => {
                              const url = `/agent/${agentId}/${selectedQuery.sessionId}/query/${queryId}?tab=charts`;
                              window.open(url, '_blank');
                            }}
                            className="group flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:bg-gray-700 hover:text-white transition-colors"
                            title="Apri query in una nuova tab"
                          >
                            <ExternalLink size={16} />
                            <span className="text-sm font-medium">Apri Query</span>
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Query Info */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
                    <h2 className="text-2xl font-bold text-white mb-6">{selectedQuery.title}</h2>
                    
                    <div className="space-y-4">
                      {selectedQuery.sessionTitle && (
                        <div>
                          <p className="text-sm text-gray-400">Sessione</p>
                          <p className="text-base font-medium text-white">{selectedQuery.sessionTitle}</p>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-sm text-gray-400">Data Creazione</p>
                        <p className="text-base font-medium text-white">{formatDate(selectedQuery.createdAt)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400">ID Query</p>
                        <p className="text-xs font-mono text-gray-300">{selectedQuery.id}</p>
                      </div>
                    </div>
                  </div>

                  {/* SQL Query */}
                  {selectedQuery.query && (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Query</h3>
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
                        {String(selectedQuery.query)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">Seleziona una query per visualizzarne i dettagli</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

