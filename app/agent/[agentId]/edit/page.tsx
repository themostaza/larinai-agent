'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Database, FileText, X, ExternalLink } from 'lucide-react';
import ACLConfiguration from '@/app/components/ACLConfiguration';

interface Agent {
  id: string;
  name: string;
  system_prompt: string | null;
  settings: AgentSettings | null;
  organization_id: string;
}

interface AgentSettings {
  tools?: {
    [key: string]: ToolConfig;
  };
}

interface ToolConfig {
  enabled: boolean;
  config?: SQLToolConfig | TextSearchToolConfig | Record<string, unknown>;
}

interface TableACL {
  enabled: boolean;
  operations: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
  columns: string[]; // ['*'] for all, or specific columns
  rowFilter?: string; // Optional WHERE condition
}

interface ACLConfig {
  mode: 'whitelist' | 'blacklist';
  tables: {
    [tableName: string]: TableACL;
  };
}

interface SQLToolConfig {
  baseUrl?: string;
  description: string;
  database: {
    type: 'mssql' | 'postgresql';
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
    requestTimeout: number;
  };
  acl?: ACLConfig;
}

interface TextSearchToolConfig {
  description: string;
  documentContent: string;
  title: string;
}

interface DbSchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  description: string;
  isPrimaryKey: boolean;
}

interface DbSchemaForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

interface DbSchemaTable {
  schema: string;
  name: string;
  description: string;
  columns: DbSchemaColumn[];
  foreignKeys: DbSchemaForeignKey[];
}

interface DbSchema {
  database: string;
  type: string;
  tables: DbSchemaTable[];
}

interface AvailableTool {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const AVAILABLE_TOOLS: AvailableTool[] = [
  {
    id: 'sql-tool',
    name: 'DB Query',
    description: 'Esegui query sui database aziendali',
    icon: Database,
  },
  {
    id: 'text-search',
    name: 'Text Search',
    description: 'Ricerca informazioni testuali in documenti lunghi senza consumare contesto',
    icon: FileText,
  },
];

export default function AgentEditPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [toolsConfig, setToolsConfig] = useState<{ [key: string]: ToolConfig }>({});

  // Original values for change detection
  const [originalName, setOriginalName] = useState('');
  const [originalSystemPrompt, setOriginalSystemPrompt] = useState('');
  const [originalToolsConfig, setOriginalToolsConfig] = useState<{ [key: string]: ToolConfig }>({});

  // Sheet state
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [currentToolId, setCurrentToolId] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [toolToDisable, setToolToDisable] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/agents/${agentId}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel caricamento dell\'agent');
        return;
      }

      setAgent(data.agent);
      setName(data.agent.name || '');
      setSystemPrompt(data.agent.system_prompt || '');
      
      const tools = data.agent.settings?.tools || {};
      setToolsConfig(tools);
      
      setOriginalName(data.agent.name || '');
      setOriginalSystemPrompt(data.agent.system_prompt || '');
      setOriginalToolsConfig(tools);
    } catch (err) {
      console.error('Error fetching agent:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  // Check if there are unsaved changes
  const hasChanges = () => {
    return (
      name !== originalName ||
      systemPrompt !== originalSystemPrompt ||
      JSON.stringify(toolsConfig) !== JSON.stringify(originalToolsConfig)
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          system_prompt: systemPrompt,
          settings: {
            ...(agent?.settings || {}),
            tools: toolsConfig,
          },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel salvataggio');
        setIsSaving(false);
        return;
      }

      // Update original values after successful save
      setOriginalName(name);
      setOriginalSystemPrompt(systemPrompt);
      setOriginalToolsConfig(toolsConfig);
      
      setSaveSuccess(true);
      setIsSaving(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving agent:', err);
      setError('Errore di connessione');
      setIsSaving(false);
    }
  };

  const handleToggleTool = (toolId: string) => {
    const currentEnabled = toolsConfig[toolId]?.enabled || false;
    
    // Se sta per disattivare un tool, mostra dialog di conferma
    if (currentEnabled) {
      setToolToDisable(toolId);
      setShowConfirmDialog(true);
      return;
    }
    
    // Se sta attivando, procedi direttamente
    setToolsConfig(prev => ({
      ...prev,
      [toolId]: {
        enabled: true,
        config: prev[toolId]?.config || getDefaultConfig(toolId),
      },
    }));
  };

  const handleConfirmDisable = () => {
    if (toolToDisable) {
      setToolsConfig(prev => ({
        ...prev,
        [toolToDisable]: {
          enabled: false,
          config: prev[toolToDisable]?.config || {},
        },
      }));
    }
    setShowConfirmDialog(false);
    setToolToDisable(null);
  };

  const handleCancelDisable = () => {
    setShowConfirmDialog(false);
    setToolToDisable(null);
  };

  const getDefaultConfig = (toolId: string): SQLToolConfig | TextSearchToolConfig | Record<string, unknown> => {
    if (toolId === 'sql-tool') {
      return {
        description: 'Esegui query sui database aziendali per ottenere dati per l\'utente e aiutare nella comprensione.',
        database: {
          type: 'mssql',
          server: '',
          port: 1433,
          database: 'DWH',
          user: '',
          password: '',
          encrypt: false,
          trustServerCertificate: true,
          enableArithAbort: true,
          requestTimeout: 30000,
        },
        acl: {
          mode: 'whitelist',
          tables: {}
        }
      };
    }
    if (toolId === 'text-search') {
      return {
        description: 'Cerca informazioni specifiche all\'interno di documenti testuali lunghi senza dover caricare l\'intero documento nel contesto.',
        documentContent: '',
        title: ''
      };
    }
    return {};
  };

  const handleConfigureTool = (toolId: string) => {
    setCurrentToolId(toolId);
    setShowConfigSheet(true);
  };

  const handleSaveToolConfig = async (config: SQLToolConfig | TextSearchToolConfig | Record<string, unknown>) => {
    if (currentToolId) {
      const updatedToolsConfig = {
        ...toolsConfig,
        [currentToolId]: {
          ...toolsConfig[currentToolId],
          config,
        },
      };
      
      // Salva immediatamente sul database
      try {
        const response = await fetch(`/api/agents/${agentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            system_prompt: systemPrompt,
            settings: {
              ...(agent?.settings || {}),
              tools: updatedToolsConfig,
            },
          }),
        });

        const data = await response.json();

        if (data.success) {
          setToolsConfig(updatedToolsConfig);
          setOriginalToolsConfig(updatedToolsConfig);
          setShowConfigSheet(false);
        } else {
          alert(`Errore nel salvataggio: ${data.error}`);
        }
      } catch (err) {
        console.error('Error saving tool config:', err);
        alert('Errore di connessione durante il salvataggio');
      }
    }
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => router.push('/back')}
                className="p-1.5 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                title="Torna indietro"
              >
                <ArrowLeft size={20} />
              </button>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-gray-500 flex-1 min-w-0"
                placeholder="Nome dell'agent"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.open(`/agent/${agentId}/new`, '_blank')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0"
                title="Apri chat in nuova tab"
              >
                Chat
                <ExternalLink size={14} />
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving || saveSuccess || !hasChanges()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Salvataggio...
                  </>
                ) : saveSuccess ? (
                  <>
                    <span className="text-green-600">✓</span>
                    Salvato!
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Salva
                  </>
                )}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {/* Left Column - System Prompt */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 flex flex-col">
            <h2 className="text-lg font-semibold mb-4">System Prompt</h2>
            
            <textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="flex-1 w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white resize-y font-mono text-sm min-h-[500px]"
              placeholder="Definisci il comportamento e le capacità del tuo agent..."
            />
          </div>

          {/* Right Column - Tools */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-lg font-semibold mb-4">Tools</h2>

            <div className="space-y-3">
              {AVAILABLE_TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isEnabled = toolsConfig[tool.id]?.enabled || false;
                const hasConfig = tool.id === 'sql-tool' || tool.id === 'text-search';

                return (
                  <div
                    key={tool.id}
                    className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-gray-700 rounded-lg flex-shrink-0">
                          <Icon size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-white">{tool.name}</h3>
                          <p className="text-xs text-gray-400 mt-1">{tool.description}</p>
                          
                          {hasConfig && isEnabled && (
                            <button
                              onClick={() => handleConfigureTool(tool.id)}
                              className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              Configura parametri →
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Toggle Switch */}
                      <button
                        onClick={() => handleToggleTool(tool.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                          isEnabled ? 'bg-blue-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Configuration Sheet */}
      {showConfigSheet && currentToolId === 'sql-tool' && (
        <SQLToolConfigSheet
          config={(toolsConfig['sql-tool']?.config as SQLToolConfig) || getDefaultConfig('sql-tool') as SQLToolConfig}
          onSave={handleSaveToolConfig}
          onClose={() => setShowConfigSheet(false)}
        />
      )}

      {showConfigSheet && currentToolId === 'text-search' && (
        <TextSearchToolConfigSheet
          config={(toolsConfig['text-search']?.config as TextSearchToolConfig) || getDefaultConfig('text-search') as TextSearchToolConfig}
          onSave={handleSaveToolConfig}
          onClose={() => setShowConfigSheet(false)}
        />
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Disattivare il tool?</h3>
            <p className="text-gray-400 text-sm mb-6">
              Vuoi davvero disattivare questo tool? La configurazione verrà persa.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDisable}
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmDisable}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-medium"
              >
                Disattiva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SQL Tool Configuration Sheet Component
interface SQLToolConfigSheetProps {
  config: SQLToolConfig;
  onSave: (config: SQLToolConfig) => void;
  onClose: () => void;
}

function SQLToolConfigSheet({ config, onSave, onClose }: SQLToolConfigSheetProps) {
  const [formData, setFormData] = useState<SQLToolConfig>(config);
  const [originalFormData] = useState<SQLToolConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showSchemaDialog, setShowSchemaDialog] = useState(false);
  const [dbSchema, setDbSchema] = useState<DbSchema | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'database' | 'acl'>('database');

  // Check if there are unsaved changes
  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  };

  const handleSave = async () => {
    if (!hasChanges() || isSaving) return;
    
    setIsSaving(true);
    await onSave(formData);
    setSaveSuccess(true);
    setIsSaving(false);
    setTimeout(() => {
      setSaveSuccess(false);
      // Il componente si chiuderà dopo aver mostrato il successo
    }, 1500);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const agentId = window.location.pathname.split('/')[2]; // Estrai agentId dall'URL
      const response = await fetch(`/api/agents/${agentId}/tools/test-db`);
      const data = await response.json();

      if (data.success) {
        setDbSchema(data.schema);
        setShowSchemaDialog(true);
      } else {
        alert(`Errore: ${data.error}`);
      }
    } catch (error) {
      alert(`Errore nella connessione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const copySchemaJSON = () => {
    if (dbSchema) {
      navigator.clipboard.writeText(JSON.stringify(dbSchema, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full lg:w-5/6 bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-white">Configura DB Query Tool</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || saveSuccess || !hasChanges()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Salvataggio...
                </>
              ) : saveSuccess ? (
                <>
                  <span className="text-green-600">✓</span>
                  Salvato!
                </>
              ) : (
                <>
                  <Save size={16} />
                  Salva
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Description (Takes full height) */}
            <div className="space-y-6">
              {/* Description */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-full flex flex-col">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrizione Tool *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className="flex-1 w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm resize-none min-h-[600px]"
                  placeholder="Descrizione dettagliata di cosa fa il tool per l'AI...&#10;&#10;Esempio:&#10;Esegui query sui database aziendali per ottenere dati per l'utente e aiutare nella comprensione. Puoi esplorare lo schema del database per ottenere informazioni sui dati disponibili e sulla struttura delle tabelle."
                />
                <p className="text-xs text-gray-500 mt-2">
                  Questa descrizione viene fornita all&apos;AI per capire quando e come usare questo tool
                </p>
              </div>
            </div>

            {/* Right Column - Tabbed Configuration */}
            <div className="space-y-6">
              {/* Tabs Header */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'database'
                      ? 'bg-gray-700 text-white border border-gray-600'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300 border border-gray-700'
                  }`}
                >
                  Database
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('acl')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'acl'
                      ? 'bg-gray-700 text-white border border-gray-600'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300 border border-gray-700'
                  }`}
                >
                  ACL
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'database' && (
              <>
              {/* Base URL (Optional) */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Base URL (Opzionale)
                </label>
                <input
                  type="text"
                  value={formData.baseUrl || ''}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                  placeholder="Lascia vuoto per usare il default"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: process.env.NEXTAUTH_URL o process.env.VERCEL_URL o http://localhost:3000
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Configurazione Database</h3>

                {/* Database Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tipo Database *
                  </label>
                  <select
                    value={formData.database.type}
                    onChange={(e) => setFormData({
                      ...formData,
                      database: { ...formData.database, type: e.target.value as 'mssql' | 'postgresql' }
                    })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                  >
                    <option value="mssql">Microsoft SQL Server</option>
                    <option value="postgresql">PostgreSQL</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Server */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Server *
                    </label>
                    <input
                      type="text"
                      value={formData.database.server}
                      onChange={(e) => setFormData({
                        ...formData,
                        database: { ...formData.database, server: e.target.value }
                      })}
                      required
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                      placeholder="es: localhost o db.example.com"
                    />
                  </div>

                  {/* Port */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Porta *
                    </label>
                    <input
                      type="number"
                      value={formData.database.port}
                      onChange={(e) => setFormData({
                        ...formData,
                        database: { ...formData.database, port: parseInt(e.target.value) }
                      })}
                      required
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    />
                  </div>

                  {/* Database Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Database *
                    </label>
                    <input
                      type="text"
                      value={formData.database.database}
                      onChange={(e) => setFormData({
                        ...formData,
                        database: { ...formData.database, database: e.target.value }
                      })}
                      required
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    />
                  </div>

                  {/* User */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Utente *
                    </label>
                    <input
                      type="text"
                      value={formData.database.user}
                      onChange={(e) => setFormData({
                        ...formData,
                        database: { ...formData.database, user: e.target.value }
                      })}
                      required
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={formData.database.password}
                      onChange={(e) => setFormData({
                        ...formData,
                        database: { ...formData.database, password: e.target.value }
                      })}
                      required
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    />
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-medium text-gray-300">Opzioni Avanzate</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.database.encrypt}
                        onChange={(e) => setFormData({
                          ...formData,
                          database: { ...formData.database, encrypt: e.target.checked }
                        })}
                        className="w-4 h-4 rounded bg-gray-900 border-gray-600"
                      />
                      <span className="text-sm text-gray-300">Encrypt</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.database.trustServerCertificate}
                        onChange={(e) => setFormData({
                          ...formData,
                          database: { ...formData.database, trustServerCertificate: e.target.checked }
                        })}
                        className="w-4 h-4 rounded bg-gray-900 border-gray-600"
                      />
                      <span className="text-sm text-gray-300">Trust Server Certificate</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.database.enableArithAbort}
                        onChange={(e) => setFormData({
                          ...formData,
                          database: { ...formData.database, enableArithAbort: e.target.checked }
                        })}
                        className="w-4 h-4 rounded bg-gray-900 border-gray-600"
                      />
                      <span className="text-sm text-gray-300">Enable Arith Abort</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Request Timeout (ms)
                    </label>
                    <input
                      type="number"
                      value={formData.database.requestTimeout}
                      onChange={(e) => setFormData({
                        ...formData,
                        database: { ...formData.database, requestTimeout: parseInt(e.target.value) }
                      })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Test Database Connection Button */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mt-4">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Test connessione in corso...
                    </>
                  ) : (
                    <>
                      <Database size={20} />
                      Test Database Connection
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Testa la connessione ed estrai lo schema completo del database
                </p>
              </div>
              </>
              )}

              {/* ACL Tab */}
              {activeTab === 'acl' && (
                <ACLConfiguration
                  config={formData}
                  onConfigChange={setFormData}
                  onTestConnection={handleTestConnection}
                  isTestingConnection={isTestingConnection}
                />
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Schema Dialog */}
      {showSchemaDialog && dbSchema && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden" style={{ width: '70vw', height: '95vh' }}>
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Schema Database: {dbSchema.database}</h3>
                <p className="text-sm text-gray-400">{dbSchema.tables.length} tabelle trovate</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copySchemaJSON}
                  disabled={isCopied}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-100"
                >
                  {isCopied ? (
                    <>
                      <span className="text-green-600">✓</span>
                      Copiato!
                    </>
                  ) : (
                    <>
                      <FileText size={16} />
                      Copia Schema JSON
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowSchemaDialog(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-6" style={{ height: 'calc(95vh - 80px)' }}>
              <div className="prose prose-invert max-w-none">
                {dbSchema.tables.map((table, idx) => (
                  <div key={idx} className="mb-8 bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {table.schema}.{table.name}
                    </h3>
                    {table.description && (
                      <p className="text-sm text-gray-400 mb-4 italic">
                        📝 {table.description}
                      </p>
                    )}
                    
                    <h4 className="text-lg font-semibold text-white mt-4 mb-2">Colonne</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-600">
                            <th className="text-left py-2 px-3 text-gray-300">Nome</th>
                            <th className="text-left py-2 px-3 text-gray-300">Tipo</th>
                            <th className="text-left py-2 px-3 text-gray-300">Nullable</th>
                            <th className="text-left py-2 px-3 text-gray-300">Default</th>
                            <th className="text-left py-2 px-3 text-gray-300">Descrizione</th>
                            <th className="text-center py-2 px-3 text-gray-300">PK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {table.columns.map((col, colIdx) => (
                            <tr key={colIdx} className="border-b border-gray-700">
                              <td className="py-2 px-3 text-white font-mono">{col.name}</td>
                              <td className="py-2 px-3 text-gray-300 font-mono">{col.type}</td>
                              <td className="py-2 px-3 text-center">{col.nullable ? '✓' : '✗'}</td>
                              <td className="py-2 px-3 text-gray-400 font-mono text-xs">{col.default || '-'}</td>
                              <td className="py-2 px-3 text-gray-400 text-xs">{col.description || '-'}</td>
                              <td className="py-2 px-3 text-center">{col.isPrimaryKey && '🔑'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {table.foreignKeys && table.foreignKeys.length > 0 && (
                      <>
                        <h4 className="text-lg font-semibold text-white mt-4 mb-2">Foreign Keys</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-600">
                                <th className="text-left py-2 px-3 text-gray-300">Colonna</th>
                                <th className="text-left py-2 px-3 text-gray-300">Riferisce</th>
                              </tr>
                            </thead>
                            <tbody>
                              {table.foreignKeys.map((fk, fkIdx) => (
                                <tr key={fkIdx} className="border-b border-gray-700">
                                  <td className="py-2 px-3 text-white font-mono">{fk.column}</td>
                                  <td className="py-2 px-3 text-gray-300 font-mono">
                                    {fk.referencesTable}.{fk.referencesColumn}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Text Search Tool Configuration Sheet Component
interface TextSearchToolConfigSheetProps {
  config: TextSearchToolConfig;
  onSave: (config: TextSearchToolConfig) => void;
  onClose: () => void;
}

function TextSearchToolConfigSheet({ config, onSave, onClose }: TextSearchToolConfigSheetProps) {
  const [formData, setFormData] = useState<TextSearchToolConfig>(config);
  const [originalFormData] = useState<TextSearchToolConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Funzione per estrarre il titolo dal contenuto
  const extractTitle = (content: string): string => {
    const lines = content.split('\n');
    
    // Cerca nelle prime 10 righe una riga che contiene **testo**
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      const match = line.match(/\*\*(.+?)\*\*/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return '';
  };

  // Check if there are unsaved changes
  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  };

  const handleSave = async () => {
    if (!hasChanges() || isSaving) return;
    
    setIsSaving(true);
    
    // Estrai il titolo dal contenuto prima di salvare
    const title = extractTitle(formData.documentContent);
    const configToSave = {
      ...formData,
      title
    };
    
    await onSave(configToSave);
    setSaveSuccess(true);
    setIsSaving(false);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full lg:w-5/6 bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-white">Configura Text Search</h2>
            <p className="text-sm text-gray-400 mt-1">Carica un documento testuale per permettere all&apos;AI di cercarlo. Inizia il documento con **Titolo** per identificarlo.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || saveSuccess || !hasChanges()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Salvataggio...
                </>
              ) : saveSuccess ? (
                <>
                  <span className="text-green-600">✓</span>
                  Salvato!
                </>
              ) : (
                <>
                  <Save size={16} />
                  Salva
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: 'calc(100vh - 140px)' }}>
            {/* Left Column - Description */}
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-full flex flex-col">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrizione Tool *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className="flex-1 w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm resize-none min-h-[600px]"
                  placeholder="Descrivi cosa contiene il documento e quando l'AI dovrebbe cercarlo...&#10;&#10;Esempio:&#10;Cerca informazioni nel manuale utente del software aziendale quando l'utente ha domande su come utilizzare funzionalità specifiche."
                />
                <p className="text-xs text-gray-500 mt-2">
                  Questa descrizione viene fornita all&apos;AI per capire quando e come usare questo tool
                </p>
              </div>
            </div>

            {/* Right Column - Document Content */}
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-full flex flex-col">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contenuto Documento *
                </label>
                <textarea
                  value={formData.documentContent}
                  onChange={(e) => setFormData({ ...formData, documentContent: e.target.value })}
                  required
                  className="flex-1 w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm resize-none min-h-[600px] font-mono"
                  placeholder="**Titolo del Documento**&#10;&#10;Incolla qui il contenuto del documento testuale...&#10;&#10;Puoi incollare:&#10;- Manuali utente&#10;- Policy aziendali&#10;- FAQ&#10;- Documentazione tecnica&#10;- Guide operative&#10;- Qualsiasi testo lungo che vuoi rendere ricercabile dall'AI&#10;&#10;IMPORTANTE: Inizia il documento con **Titolo** per identificarlo automaticamente."
                />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    L&apos;AI potrà cercare informazioni specifiche in questo documento senza dover caricare tutto il testo nel contesto
                  </p>
                  {formData.documentContent && (
                    <>
                      <p className="text-xs text-blue-400">
                        Caratteri: {formData.documentContent.length.toLocaleString()} | Righe: {formData.documentContent.split('\n').length.toLocaleString()}
                      </p>
                      {(() => {
                        const detectedTitle = extractTitle(formData.documentContent);
                        return detectedTitle ? (
                          <p className="text-xs text-green-400">
                            📄 Titolo rilevato: &quot;{detectedTitle}&quot;
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-400">
                            ⚠️ Nessun titolo rilevato. Inizia il documento con **Titolo** per identificarlo.
                          </p>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
