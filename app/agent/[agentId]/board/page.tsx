'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar, MessageSquare, Zap, CheckCircle, XCircle, Clock, Activity, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import MarkdownMessage from '@/app/components/MarkdownMessage';
import DatabaseQueryButton from '@/app/components/DatabaseQueryButton';
import TextSearchIndicator from '@/app/components/TextSearchIndicator';
import ReasoningIndicator from '@/app/components/ReasoningIndicator';

interface Agent {
  id: string;
  name: string;
  system_prompt: string | null;
  settings: unknown;
  organization_id: string;
  created_at: string;
  organization?: {
    id: string;
    name: string;
    created_at: string;
  };
}

interface AgentStats {
  totalSessions: number;
  totalMessages: number;
  lastActivityAt: string | null;
  toolExecutions: {
    total: number;
    successful: number;
    failed: number;
  };
  averageMessagesPerSession: number;
}

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  iconColor?: string;
}

function StatCard({ icon: Icon, title, value, subtitle, trend, iconColor = 'text-blue-400' }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 bg-gray-800 rounded-lg ${iconColor}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

export default function AgentBoardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Leggi la tab dall'URL, default 'stats'
  const tabFromUrl = searchParams.get('tab') as 'stats' | 'sessions' | 'queries' | null;
  const [activeTab, setActiveTab] = useState<'stats' | 'sessions' | 'queries'>(tabFromUrl || 'stats');

  useEffect(() => {
    fetchAgentData();
  }, [agentId]);

  // Sincronizza la tab con l'URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as 'stats' | 'sessions' | 'queries' | null;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Funzione per cambiare tab e aggiornare URL
  const handleTabChange = (tab: 'stats' | 'sessions' | 'queries') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.push(url.pathname + url.search);
  };

  const fetchAgentData = async () => {
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

      // Fetch agent statistics
      const statsResponse = await fetch(`/api/agents/${agentId}/stats`);
      const statsData = await statsResponse.json();

      if (statsData.success) {
        setStats(statsData.stats);
      } else {
        // If stats endpoint doesn't exist yet, set default values
        setStats({
          totalSessions: 0,
          totalMessages: 0,
          lastActivityAt: null,
          toolExecutions: {
            total: 0,
            successful: 0,
            failed: 0,
          },
          averageMessagesPerSession: 0,
        });
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching agent data:', err);
      setError('Errore di connessione');
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Mai';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getToolNames = () => {
    if (!agent?.settings || typeof agent.settings !== 'object') return [];
    const settings = agent.settings as { tools?: Record<string, { enabled: boolean }> };
    if (!settings.tools) return [];
    return Object.entries(settings.tools)
      .filter(([, config]) => config.enabled)
      .map(([toolName,]) => toolName);
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

  if (!agent) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-400">Agent non trovato</p>
          <button
            onClick={() => router.push('/back')}
            className="mt-4 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
          >
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  const enabledTools = getToolNames();
  const successRate = stats && stats.toolExecutions.total > 0
    ? Math.round((stats.toolExecutions.successful / stats.toolExecutions.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/back')}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Torna indietro"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {(agent.name || 'A')[0].toUpperCase()}
                  </span>
                </div>
                <h1 className="text-lg font-semibold">{agent.name || 'Agent senza nome'}</h1>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => handleTabChange('stats')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'stats'
                    ? 'bg-gray-700 text-white border border-gray-600'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-300 border border-gray-700'
                }`}
              >
                Statistiche
              </button>
              <button
                onClick={() => handleTabChange('sessions')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'sessions'
                    ? 'bg-gray-700 text-white border border-gray-600'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-300 border border-gray-700'
                }`}
              >
                Sessioni
              </button>
              <button
                onClick={() => handleTabChange('queries')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'queries'
                    ? 'bg-gray-700 text-white border border-gray-600'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-300 border border-gray-700'
                }`}
              >
                DB Query
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'stats' ? (
        <>
        {/* Stats Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Statistiche</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={MessageSquare}
              title="Sessioni Totali"
              value={stats?.totalSessions || 0}
              subtitle="Chat create con questo agent"
              iconColor="text-blue-400"
            />
            <StatCard
              icon={Activity}
              title="Messaggi Totali"
              value={stats?.totalMessages || 0}
              subtitle={stats && stats.totalSessions > 0 
                ? `~${stats.averageMessagesPerSession.toFixed(1)} per sessione`
                : 'Nessuna attività'}
              iconColor="text-green-400"
            />
            <StatCard
              icon={Zap}
              title="Tool Executions"
              value={stats?.toolExecutions.total || 0}
              subtitle={stats && stats.toolExecutions.total > 0
                ? `${successRate}% successo`
                : 'Nessuna esecuzione'}
              iconColor="text-purple-400"
            />
            <StatCard
              icon={Clock}
              title="Ultima Attività"
              value={stats?.lastActivityAt ? 'Attivo' : 'Mai'}
              subtitle={formatDate(stats?.lastActivityAt || null)}
              iconColor="text-orange-400"
            />
          </div>
        </div>

        {/* Additional Stats */}
        {stats && stats.toolExecutions.total > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Dettaglio Tool</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                icon={CheckCircle}
                title="Esecuzioni Riuscite"
                value={stats.toolExecutions.successful}
                subtitle={`${Math.round((stats.toolExecutions.successful / stats.toolExecutions.total) * 100)}% del totale`}
                iconColor="text-green-500"
              />
              <StatCard
                icon={XCircle}
                title="Esecuzioni Fallite"
                value={stats.toolExecutions.failed}
                subtitle={`${Math.round((stats.toolExecutions.failed / stats.toolExecutions.total) * 100)}% del totale`}
                iconColor="text-red-500"
              />
              <StatCard
                icon={Zap}
                title="Totale Esecuzioni"
                value={stats.toolExecutions.total}
                subtitle="Tool chiamati dall'agent"
                iconColor="text-purple-400"
              />
            </div>
          </div>
        )}

        {/* Information Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-blue-400" />
              Informazioni Agent
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Nome Agent</p>
                <p className="text-base font-medium text-white">{agent.name || 'Non specificato'} <span className="font-mono text-gray-600">{agent.id}</span></p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Data Creazione Agent</p>
                <p className="text-base font-medium text-white">{formatDate(agent.created_at)}</p>
              </div>
              {agent.organization && (
                <>
                  <div className="">
                    <p className="text-sm text-gray-400">Organizzazione</p>
                    <p className="text-base font-medium text-white">{agent.organization.name || 'Non specificato'} <span className="font-mono text-gray-600">{agent.organization.id}</span></p>
              </div>
                </>
              )}
            </div>
          </div>

          {/* Tools Configuration */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap size={20} className="text-purple-400" />
              Tool
            </h2>
            {enabledTools.length > 0 ? (
              <div className="space-y-3">
                {enabledTools.map((toolName) => (
                  <div 
                    key={toolName}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm font-medium text-white">{toolName}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap size={48} className="mx-auto text-gray-700 mb-3" />
                <p className="text-gray-400 text-sm">
                  Nessun tool abilitato per questo agent
                </p>
                <button
                  onClick={() => router.push(`/agent/${agentId}/edit`)}
                  className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Configura tools →
                </button>
              </div>
            )}
          </div>
        </div>
        </>
        ) : activeTab === 'sessions' ? (
          <SessionsView agentId={agentId} />
        ) : (
          <QueriesView agentId={agentId} />
        )}
      </main>
    </div>
  );
}

// Sessions View Component
interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userEmail: string;
}

interface SessionsViewProps {
  agentId: string;
}

function SessionsView({ agentId }: SessionsViewProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSessions();
  }, [agentId]);

  const fetchSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const response = await fetch(`/api/agents/${agentId}/sessions?limit=100`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel caricamento delle sessioni');
        return;
      }

      setSessions(data.sessions);
      // Seleziona automaticamente la prima sessione se presente
      if (data.sessions.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data.sessions[0].id);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoadingSessions(false);
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

  if (isLoadingSessions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
        <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400 text-lg">
          Nessuna sessione trovata per questo agent.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-[57px] flex gap-4 px-4">
      {/* Sessions List - Sidebar Left */}
      <div className="w-80 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex flex-col flex-shrink-0 my-4">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            Sessioni ({sessions.length})
            </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
              className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                selectedSessionId === session.id ? 'bg-gray-800 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <p className="text-xs text-blue-400 mb-1 truncate">
                {session.userEmail}
              </p>
              <h3 className="text-sm font-medium text-white mb-1 truncate">
                {session.title}
              </h3>
              <p className="text-xs text-gray-400">
                {formatDate(session.updatedAt || session.createdAt)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Content - Main Area (no box) */}
      <div className="flex-1 overflow-hidden my-4">
        {selectedSessionId ? (
          <SessionChatView sessionId={selectedSessionId} agentId={agentId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Seleziona una sessione per visualizzare la chat</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Session Chat View Component
interface SessionChatViewProps {
  sessionId: string;
  agentId: string;
}

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
  output?: Record<string, unknown>;
  result?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: MessagePart[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  savedToDb?: boolean;
  thumb_up?: boolean | null;
  thumb_down?: boolean | null;
  [key: string]: unknown;
}

function SessionChatView({ sessionId }: SessionChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, [sessionId]);

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const getMessageText = (message: ChatMessage): string => {
    if (!message.parts) return '';
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text || '')
      .join('');
  };

  const handleFeedback = async (messageId: string, type: 'up' | 'down') => {
    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          type,
          sessionId
        }),
      });

      // Update local state
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                thumb_up: type === 'up' ? !msg.thumb_up : false,
                thumb_down: type === 'down' ? !msg.thumb_down : false
              }
            : msg
        )
      );
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Nessun messaggio in questa sessione</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="max-w-4xl mx-auto w-full">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
          >
            <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl`}>
              <div
                className={`px-3 py-1.5 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-white text-black'
                    : 'bg-gray-900 text-white border border-gray-700'
                }`}
              >
                <div className="leading-relaxed break-words">
                  {message.parts?.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <div key={`${message.id}-${i}`} className="prose prose-invert prose-sm max-w-none">
                            {message.role === 'assistant' ? (
                              <MarkdownMessage content={part.text || ''} />
                            ) : (
                              <p className="whitespace-pre-wrap">{part.text}</p>
                            )}
                          </div>
                        );
                      case 'tool-read_sql_db':
                        return (
                          <DatabaseQueryButton
                            key={`${message.id}-${i}`}
                            part={part}
                            messageId={message.id}
                            partIndex={i}
                          />
                        );
                      case 'tool-search_document':
                        return (
                          <TextSearchIndicator
                            key={`${message.id}-${i}`}
                            part={part}
                            onClick={() => {}}
                          />
                        );
                      case 'reasoning':
                        return (
                          <ReasoningIndicator
                            key={`${message.id}-${i}`}
                            part={part}
                            isStreaming={false}
                          />
                        );
                      case 'step-start':
                        return null;
                      default:
                        return null;
                    }
                  })}
                </div>
              </div>

              {/* Action buttons - solo per messaggi assistant */}
              {message.role === 'assistant' && (
                <div className="flex items-center gap-1 mt-1 px-2">
                  <button
                    onClick={() => handleCopyMessage(message.id, getMessageText(message))}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    title="Copia messaggio"
                  >
                    {copiedMessageId === message.id ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => handleFeedback(message.id, 'up')}
                    className={`p-1.5 rounded transition-colors ${
                      message.thumb_up
                        ? 'text-green-500 bg-gray-800'
                        : 'text-gray-500 hover:text-green-500 hover:bg-gray-800'
                    }`}
                    title="Feedback positivo"
                  >
                    <ThumbsUp size={14} />
                  </button>
                <button
                    onClick={() => handleFeedback(message.id, 'down')}
                    className={`p-1.5 rounded transition-colors ${
                      message.thumb_down
                        ? 'text-red-500 bg-gray-800'
                        : 'text-gray-500 hover:text-red-500 hover:bg-gray-800'
                    }`}
                    title="Feedback negativo"
                  >
                    <ThumbsDown size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}

// Queries View Component
interface Query {
  id: string;
  title: string;
  query: string | null;
  createdAt: string;
  body: Record<string, unknown> | null;
  chartKpi: Record<string, unknown> | null;
  chatMessageId: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  userId: string | null;
  userEmail: string;
}

interface QueriesViewProps {
  agentId: string;
}

function QueriesView({ agentId }: QueriesViewProps) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [isLoadingQueries, setIsLoadingQueries] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQueries();
  }, [agentId]);

  const fetchQueries = async () => {
    try {
      setIsLoadingQueries(true);
      const response = await fetch(`/api/agents/${agentId}/queries?limit=100`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel caricamento delle query');
        return;
      }

      setQueries(data.queries);
      // Seleziona automaticamente la prima query se presente
      if (data.queries.length > 0 && !selectedQueryId) {
        setSelectedQueryId(data.queries[0].id);
      }
    } catch (err) {
      console.error('Error fetching queries:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoadingQueries(false);
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

  if (isLoadingQueries) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
        <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400 text-lg">
          Nessuna query salvata per questo agent.
        </p>
      </div>
    );
  }

  const selectedQuery = queries.find(q => q.id === selectedQueryId);

  return (
    <div className="fixed inset-0 top-[57px] flex gap-4 px-4">
      {/* Queries List - Sidebar Left */}
      <div className="w-80 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex flex-col flex-shrink-0 my-4">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            Query Salvate ({queries.length})
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
              <p className="text-xs text-blue-400 mb-1 truncate">
                {query.userEmail}
              </p>
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
              {/* Query Info */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-6">{selectedQuery.title}</h2>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400">Utente</p>
                    <p className="text-base font-medium text-white">{selectedQuery.userEmail}</p>
                  </div>
                  
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
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Seleziona una query per visualizzarne i dettagli</p>
          </div>
        )}
      </div>
    </div>
  );
}

