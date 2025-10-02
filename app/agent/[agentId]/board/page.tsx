'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar, MessageSquare, Settings as SettingsIcon, Zap, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  system_prompt: string | null;
  settings: unknown;
  organization_id: string;
  created_at: string;
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
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAgentData();
  }, [agentId]);

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
      .filter(([_, config]) => config.enabled)
      .map(([toolName, _]) => toolName);
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}

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
                <p className="text-sm text-gray-400">Nome</p>
                <p className="text-base font-medium text-white">{agent.name || 'Non specificato'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Data Creazione</p>
                <p className="text-base font-medium text-white">{formatDate(agent.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">ID Agent</p>
                <p className="text-xs font-mono text-gray-300">{agent.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">ID Organizzazione</p>
                <p className="text-xs font-mono text-gray-300">{agent.organization_id}</p>
              </div>
            </div>
          </div>

          {/* Tools Configuration */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap size={20} className="text-purple-400" />
              Tool Abilitati
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

          {/* System Prompt */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare size={20} className="text-green-400" />
              System Prompt
            </h2>
            {agent.system_prompt ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {agent.system_prompt}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare size={48} className="mx-auto text-gray-700 mb-3" />
                <p className="text-gray-400 text-sm">
                  Nessun system prompt configurato
                </p>
                <button
                  onClick={() => router.push(`/agent/${agentId}/edit`)}
                  className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Aggiungi system prompt →
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

