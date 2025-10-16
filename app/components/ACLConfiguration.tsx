'use client';

import React, { useState, useEffect } from 'react';
import { Database, Loader2, ChevronDown } from 'lucide-react';

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

interface ACLConfigurationProps {
  config: SQLToolConfig;
  onConfigChange: (config: SQLToolConfig) => void;
  onTestConnection: () => void;
  isTestingConnection: boolean;
}

export default function ACLConfiguration({ 
  config, 
  onConfigChange, 
  onTestConnection, 
  isTestingConnection 
}: ACLConfigurationProps) {
  const [dbSchema, setDbSchema] = useState<DbSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Initialize ACL if not present
  const acl = config.acl || { mode: 'whitelist', tables: {} };

  // Load schema on mount if connection is configured
  useEffect(() => {
    if (config.database.server && config.database.database) {
      loadSchema();
    }
  }, []);

  const loadSchema = async () => {
    setIsLoadingSchema(true);
    try {
      const agentId = window.location.pathname.split('/')[2];
      const response = await fetch(`/api/agents/${agentId}/tools/test-db`);
      const data = await response.json();

      if (data.success) {
        setDbSchema(data.schema);
      } else {
        console.error('Failed to load schema:', data.error);
      }
    } catch (error) {
      console.error('Error loading schema:', error);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const updateACL = (updates: Partial<ACLConfig>) => {
    onConfigChange({
      ...config,
      acl: {
        ...acl,
        ...updates
      }
    });
  };

  const updateTableACL = (tableName: string, updates: Partial<TableACL>) => {
    const currentTable = acl.tables[tableName] || {
      enabled: true,
      operations: ['SELECT'],
      columns: ['*']
    };

    updateACL({
      tables: {
        ...acl.tables,
        [tableName]: {
          ...currentTable,
          ...updates
        }
      }
    });
  };

  const toggleTable = (tableName: string) => {
    if (expandedTables.has(tableName)) {
      const newSet = new Set(expandedTables);
      newSet.delete(tableName);
      setExpandedTables(newSet);
    } else {
      setExpandedTables(new Set([...expandedTables, tableName]));
    }
  };

  const getTableFullName = (table: DbSchemaTable) => `${table.schema}.${table.name}`;

  const isTableEnabled = (tableName: string) => {
    const tableACL = acl.tables[tableName];
    if (acl.mode === 'whitelist') {
      return tableACL?.enabled === true;
    } else {
      return tableACL?.enabled !== false;
    }
  };

  const toggleAllTables = (enabled: boolean) => {
    if (!dbSchema) return;
    
    const newTables: { [key: string]: TableACL } = {};
    dbSchema.tables.forEach(table => {
      const tableName = getTableFullName(table);
      newTables[tableName] = {
        enabled,
        operations: ['SELECT'],
        columns: ['*']
      };
    });
    
    updateACL({ tables: newTables });
  };

  if (!dbSchema && !isLoadingSchema) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="text-center">
          <Database size={48} className="mx-auto text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Schema non caricato</h3>
          <p className="text-sm text-gray-400 mb-4">
            Prima di configurare l&apos;ACL, è necessario testare la connessione al database per ottenere lo schema.
          </p>
          <button
            type="button"
            onClick={() => {
              onTestConnection();
              setTimeout(loadSchema, 1000);
            }}
            disabled={isTestingConnection}
            className="px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {isTestingConnection ? 'Caricamento...' : 'Carica Schema Database'}
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingSchema) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-gray-400">Caricamento schema...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ACL Mode */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Modalità ACL
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-850 transition-colors">
            <input
              type="radio"
              checked={acl.mode === 'whitelist'}
              onChange={() => updateACL({ mode: 'whitelist' })}
              className="w-4 h-4"
            />
            <div>
              <div className="text-sm font-medium text-white">Whitelist (Consigliato)</div>
              <div className="text-xs text-gray-400">Solo le tabelle abilitate sono accessibili</div>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-850 transition-colors">
            <input
              type="radio"
              checked={acl.mode === 'blacklist'}
              onChange={() => updateACL({ mode: 'blacklist' })}
              className="w-4 h-4"
            />
            <div>
              <div className="text-sm font-medium text-white">Blacklist</div>
              <div className="text-xs text-gray-400">Tutte le tabelle sono accessibili tranne quelle disabilitate</div>
            </div>
          </label>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-300">
            Azioni Rapide
          </label>
          <button
            type="button"
            onClick={loadSchema}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            🔄 Ricarica Schema
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleAllTables(true)}
            className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500 transition-colors"
          >
            ✓ Abilita Tutte
          </button>
          <button
            type="button"
            onClick={() => toggleAllTables(false)}
            className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500 transition-colors"
          >
            ✗ Disabilita Tutte
          </button>
        </div>
      </div>

      {/* Tables List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-medium text-gray-300">
            Tabelle Database ({dbSchema?.tables.length || 0})
          </h3>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {dbSchema?.tables.map((table) => {
            const tableName = getTableFullName(table);
            const tableACL = acl.tables[tableName];
            const enabled = isTableEnabled(tableName);
            const isExpanded = expandedTables.has(tableName);

            return (
              <div key={tableName} className="border-b border-gray-700 last:border-b-0">
                {/* Table Header */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-750 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleTable(tableName)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <ChevronDown
                        size={16}
                        className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white font-mono">{tableName}</div>
                      {table.description && (
                        <div className="text-xs text-gray-400 mt-0.5">{table.description}</div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateTableACL(tableName, { enabled: !enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enabled ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Expanded Content */}
                {isExpanded && enabled && (
                  <div className="px-4 pb-4 space-y-4 bg-gray-850">
                    {/* Operations */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Operazioni Permesse
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const).map((op) => (
                          <label
                            key={op}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded text-xs cursor-pointer hover:bg-gray-800 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={tableACL?.operations.includes(op) || false}
                              onChange={(e) => {
                                const currentOps = tableACL?.operations || ['SELECT'];
                                const newOps = e.target.checked
                                  ? [...currentOps, op]
                                  : currentOps.filter((o) => o !== op);
                                updateTableACL(tableName, { operations: newOps });
                              }}
                              className="w-3 h-3"
                            />
                            <span className="text-gray-300">{op}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Columns */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Colonne Accessibili
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded text-xs cursor-pointer hover:bg-gray-800 transition-colors">
                          <input
                            type="checkbox"
                            checked={tableACL?.columns.includes('*') || !tableACL}
                            onChange={(e) => {
                              updateTableACL(tableName, {
                                columns: e.target.checked ? ['*'] : []
                              });
                            }}
                            className="w-3 h-3"
                          />
                          <span className="text-gray-300 font-semibold">Tutte le colonne (*)</span>
                        </label>
                        {!(tableACL?.columns.includes('*') || !tableACL) && (
                          <div className="pl-5 space-y-1 max-h-32 overflow-y-auto">
                            {table.columns.map((col) => (
                              <label
                                key={col.name}
                                className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-800 rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={tableACL?.columns.includes(col.name) || false}
                                  onChange={(e) => {
                                    const currentCols = tableACL?.columns.filter(c => c !== '*') || [];
                                    const newCols = e.target.checked
                                      ? [...currentCols, col.name]
                                      : currentCols.filter((c) => c !== col.name);
                                    updateTableACL(tableName, { columns: newCols });
                                  }}
                                  className="w-3 h-3"
                                />
                                <span className="text-gray-400 font-mono">{col.name}</span>
                                <span className="text-gray-500 text-[10px]">({col.type})</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Filtro Righe (WHERE clause)
                      </label>
                      <input
                        type="text"
                        value={tableACL?.rowFilter || ''}
                        onChange={(e) => updateTableACL(tableName, { rowFilter: e.target.value })}
                        placeholder="es: organization_id = '{user_org}' AND active = 1"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Lascia vuoto per nessun filtro. Usa placeholder come {'{user_org}'} per valori dinamici.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

