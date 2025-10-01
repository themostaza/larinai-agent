'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, UserPlus, Loader2, Bot, Settings, X, AlertCircle } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface Agent {
  id: string;
  name: string | null;
  created_at: string;
  settings: unknown;
}

export default function BackOfficePage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [error, setError] = useState('');
  
  // Create Agent Modal State
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [createAgentError, setCreateAgentError] = useState('');

  // Carica le organizzazioni al mount
  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Carica gli agent quando cambia l'organizzazione selezionata
  useEffect(() => {
    if (selectedOrgId) {
      fetchAgents(selectedOrgId);
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      setIsLoadingOrgs(true);
      const response = await fetch('/api/organizations');
      const data = await response.json();

      if (!data.success) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        setError(data.error || 'Errore nel caricamento delle organizzazioni');
        return;
      }

      setOrganizations(data.organizations);
      
      // Seleziona automaticamente la prima organizzazione
      if (data.organizations.length > 0) {
        setSelectedOrgId(data.organizations[0].id);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const fetchAgents = async (organizationId: string) => {
    try {
      setIsLoadingAgents(true);
      const response = await fetch(`/api/agents?organizationId=${organizationId}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel caricamento degli agent');
        return;
      }

      setAgents(data.agents);
      setUserRole(data.userRole);
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleCreateAgent = () => {
    setShowCreateAgentModal(true);
    setNewAgentName('');
    setCreateAgentError('');
  };

  const handleConfirmCreateAgent = async () => {
    if (!newAgentName.trim()) {
      setCreateAgentError('Il nome è obbligatorio');
      return;
    }

    setIsCreatingAgent(true);
    setCreateAgentError('');

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          name: newAgentName,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setCreateAgentError(data.error || 'Errore nella creazione dell\'agent');
        setIsCreatingAgent(false);
        return;
      }

      // Chiudi modal e redirect alla pagina di edit
      setShowCreateAgentModal(false);
      router.push(`/agent/${data.agent.id}/edit`);
    } catch (err) {
      console.error('Error creating agent:', err);
      setCreateAgentError('Errore di connessione');
      setIsCreatingAgent(false);
    }
  };

  const isAdmin = userRole === 'admin';

  if (isLoadingOrgs) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xl">Caricamento...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Organization Select */}
            {organizations.length > 0 && (
              <div>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 min-w-[200px]"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name || 'Organizzazione senza nome'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Manage Users Button - Solo per admin */}
              {isAdmin && (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  onClick={() => router.push('/back/users')}
                >
                  <UserPlus size={16} />
                  <span>Manage Users</span>
                </button>
              )}

              {/* Logout Button - Solo icona */}
              <button
                onClick={handleLogout}
                className="p-1.5 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
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

        {/* No Organizations */}
        {organizations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">
              Non sei ancora associato a nessuna organizzazione.
            </p>
            <p className="text-gray-500 mt-2">
              Contatta un amministratore per essere aggiunto a un&apos;organizzazione.
            </p>
          </div>
        )}

        {/* Agents Section */}
        {selectedOrgId && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Agent</h2>
              {isAdmin && (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={handleCreateAgent}
                >
                  <Bot size={16} />
                  <span>Add Agent</span>
                </button>
              )}
            </div>

            {isLoadingAgents ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin" size={32} />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
                <Bot size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">
                  Nessun agent trovato per questa organizzazione.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-gray-800 rounded-lg">
                        <Bot size={24} className="text-white" />
                      </div>
                      <button
                        onClick={() => router.push(`/agent/${agent.id}/edit`)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Modifica agent"
                      >
                        <Settings size={18} />
                      </button>
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-2">
                      {agent.name || 'Agent senza nome'}
                    </h3>
                    
                    <p className="text-sm text-gray-400 mb-4">
                      Creato il {new Date(agent.created_at).toLocaleDateString('it-IT')}
                    </p>

                    <button
                      onClick={() => router.push(`/agent/${agent.id}/new`)}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Nuova Chat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Agent Modal */}
      {showCreateAgentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 max-w-md w-full relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowCreateAgentModal(false);
                setNewAgentName('');
                setCreateAgentError('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              disabled={isCreatingAgent}
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <div className="mb-6">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-center">Nuovo Agent</h2>
              <p className="text-gray-400 text-sm text-center">
                Crea un nuovo agent per la tua organizzazione
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Error */}
              {createAgentError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-red-500 text-sm">{createAgentError}</p>
                </div>
              )}

              {/* Agent Name */}
              <div>
                <label htmlFor="agentName" className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Agent
                </label>
                <input
                  id="agentName"
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmCreateAgent();
                    }
                  }}
                  required
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                  placeholder="es: Assistente Vendite"
                  disabled={isCreatingAgent}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateAgentModal(false);
                    setNewAgentName('');
                    setCreateAgentError('');
                  }}
                  disabled={isCreatingAgent}
                  className="flex-1 px-6 py-3 bg-gray-800 border border-gray-700 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmCreateAgent}
                  disabled={isCreatingAgent || !newAgentName.trim()}
                  className="flex-1 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingAgent ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Creazione...
                    </>
                  ) : (
                    <>
                      <Bot size={20} />
                      Crea Agent
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

