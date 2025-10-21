'use client';

import React, { useState } from 'react';
import { Database, Loader2, ChevronDown } from 'lucide-react';

interface TablePolicy {
  enabled: boolean;
  operations: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
  columns: string[]; // ['*'] for all, or specific columns
  rowFilter?: string; // Optional WHERE condition
}

interface PolicyConfig {
  mode: 'whitelist' | 'blacklist';
  tables: {
    [tableName: string]: TablePolicy;
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
  acl?: PolicyConfig;
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

interface PolicyConfigurationProps {
  config: SQLToolConfig;
  onConfigChange: (config: SQLToolConfig) => void;
  onTestConnection: () => void;
  isTestingConnection: boolean;
}

export default function PolicyConfiguration({ 
  config, 
  onConfigChange, 
  onTestConnection, 
  isTestingConnection 
}: PolicyConfigurationProps) {
  const [dbSchema, setDbSchema] = useState<DbSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [obsoletePolicies, setObsoletePolicies] = useState<{
    tables: string[];
    columns: { table: string; columns: string[] }[];
  }>({ tables: [], columns: [] });

  // Initialize Policy if not present - always use whitelist mode
  const policy = { 
    mode: 'whitelist' as const, 
    tables: config.acl?.tables || {} 
  };

  // Don't load schema automatically to improve performance
  // Schema will be loaded only when user clicks "Load Schema" button

  const loadSchema = async () => {
    setIsLoadingSchema(true);
    try {
      const agentId = window.location.pathname.split('/')[2];
      const response = await fetch(`/api/agents/${agentId}/tools/test-db`);
      const data = await response.json();

      if (data.success) {
        setDbSchema(data.schema);
        // Check for obsolete policies after loading schema
        checkObsoletePolicies(data.schema);
      } else {
        console.error('Failed to load schema:', data.error);
      }
    } catch (error) {
      console.error('Error loading schema:', error);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  // Check for obsolete policies when schema changes
  const checkObsoletePolicies = (schema: DbSchema) => {
    const obsoleteTables: string[] = [];
    const obsoleteColumns: { table: string; columns: string[] }[] = [];
    
    // Get all table names from current schema
    const currentTables = new Set(
      schema.tables.map(t => `${t.schema}.${t.name}`)
    );
    
    // Check each policy
    Object.keys(policy.tables).forEach(policyTableName => {
      if (!currentTables.has(policyTableName)) {
        // Table doesn't exist in current schema
        obsoleteTables.push(policyTableName);
      } else {
        // Table exists, check columns
        const tablePolicy = policy.tables[policyTableName];
        const schemaTable = schema.tables.find(
          t => `${t.schema}.${t.name}` === policyTableName
        );
        
        if (schemaTable && !tablePolicy.columns.includes('*')) {
          // Check if specific columns still exist
          const currentColumns = new Set(schemaTable.columns.map(c => c.name));
          const invalidColumns = tablePolicy.columns.filter(
            col => !currentColumns.has(col)
          );
          
          if (invalidColumns.length > 0) {
            obsoleteColumns.push({
              table: policyTableName,
              columns: invalidColumns
            });
          }
        }
      }
    });
    
    setObsoletePolicies({ tables: obsoleteTables, columns: obsoleteColumns });
  };

  // Clean obsolete policies
  const cleanObsoletePolicies = () => {
    const newTables = { ...policy.tables };
    
    // Remove obsolete tables
    obsoletePolicies.tables.forEach(tableName => {
      delete newTables[tableName];
    });
    
    // Remove obsolete columns
    obsoletePolicies.columns.forEach(({ table, columns }) => {
      if (newTables[table]) {
        const validColumns = newTables[table].columns.filter(
          col => !columns.includes(col)
        );
        newTables[table] = {
          ...newTables[table],
          columns: validColumns.length > 0 ? validColumns : ['*']
        };
      }
    });
    
    updatePolicy({ tables: newTables });
    setObsoletePolicies({ tables: [], columns: [] });
  };

  const updatePolicy = (updates: Partial<PolicyConfig>) => {
    onConfigChange({
      ...config,
      acl: {
        ...policy,
        ...updates
      }
    });
  };

  const updateTablePolicy = (tableName: string, updates: Partial<TablePolicy>) => {
    const currentTable = policy.tables[tableName] || {
      enabled: true,
      operations: ['SELECT'],
      columns: ['*']
    };

    updatePolicy({
      tables: {
        ...policy.tables,
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
    const tablePolicy = policy.tables[tableName];
    if (policy.mode === 'whitelist') {
      return tablePolicy?.enabled === true;
    } else {
      return tablePolicy?.enabled !== false;
    }
  };

  const toggleAllTables = (enabled: boolean) => {
    if (!dbSchema) return;
    
    const newTables: { [key: string]: TablePolicy } = {};
    dbSchema.tables.forEach(table => {
      const tableName = getTableFullName(table);
      newTables[tableName] = {
        enabled,
        operations: ['SELECT'],
        columns: ['*']
      };
    });
    
    updatePolicy({ tables: newTables });
  };

  const hasPolicies = Object.keys(policy.tables).length > 0;

  if (!dbSchema && !isLoadingSchema) {
    return (
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
          <p className="text-sm text-blue-300">
            ℹ️ Modalità <strong>Whitelist</strong>: solo le tabelle abilitate esplicitamente sono accessibili all&apos;agent.
          </p>
        </div>

        {/* Existing Policies Preview */}
        {hasPolicies && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              Policy Configurate ({Object.keys(policy.tables).length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(policy.tables).map(([tableName, tablePolicy]) => (
                <div key={tableName} className="bg-gray-900 rounded p-3 border border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-white break-all">{tableName}</div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {tablePolicy.enabled ? '✓ Abilitata' : '✗ Disabilitata'} • 
                        {' '}{tablePolicy.operations.join(', ')} • 
                        {' '}{tablePolicy.columns.includes('*') ? 'Tutte le colonne' : `${tablePolicy.columns.length} colonne`}
                      </div>
                      {tablePolicy.rowFilter && (
                        <div className="text-[10px] text-gray-500 mt-1 font-mono">
                          Filtro: {tablePolicy.rowFilter}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning to load schema */}
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-300 mb-2">
                ⚠️ Schema Database non caricato
              </h3>
              <p className="text-xs text-yellow-200">
                {hasPolicies 
                  ? 'Hai policy configurate ma lo schema del database non è caricato. Carica lo schema per verificare se le policy sono ancora valide e per configurarne di nuove.'
                  : 'Per configurare le policy di accesso, è necessario prima caricare lo schema del database.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Load Schema Button */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="text-center">
            <Database size={48} className="mx-auto text-gray-500 mb-4" />
            <button
              type="button"
              onClick={() => {
                onTestConnection();
                setTimeout(loadSchema, 1000);
              }}
              disabled={isTestingConnection}
              className="px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isTestingConnection ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Caricamento Schema...
                </span>
              ) : (
                'Carica Schema Database'
              )}
            </button>
          </div>
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

  const hasObsoletePolicies = obsoletePolicies.tables.length > 0 || obsoletePolicies.columns.length > 0;

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
        <p className="text-sm text-blue-300">
          ℹ️ Modalità <strong>Whitelist</strong>: solo le tabelle abilitate esplicitamente sono accessibili all&apos;agent.
        </p>
      </div>

      {/* Obsolete Policies Warning */}
      {hasObsoletePolicies && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-300 mb-2">
                ⚠️ Policy Obsolete Rilevate
              </h3>
              <div className="text-xs text-yellow-200 space-y-2">
                {obsoletePolicies.tables.length > 0 && (
                  <div>
                    <p className="font-medium">
                      • <strong>{obsoletePolicies.tables.length}</strong> {obsoletePolicies.tables.length === 1 ? 'tabella' : 'tabelle'} non {obsoletePolicies.tables.length === 1 ? 'esiste' : 'esistono'} più nello schema attuale:
                    </p>
                    <div className="font-mono text-yellow-300 ml-4 mt-1">
                      {obsoletePolicies.tables.map(t => (
                        <div key={t}>- {t}</div>
                      ))}
                    </div>
                  </div>
                )}
                {obsoletePolicies.columns.length > 0 && (
                  <div>
                    <p className="font-medium">
                      • <strong>{obsoletePolicies.columns.length}</strong> {obsoletePolicies.columns.length === 1 ? 'tabella ha colonne' : 'tabelle hanno colonne'} non più esistenti:
                    </p>
                    <div className="ml-4 mt-1 space-y-1">
                      {obsoletePolicies.columns.map(({ table, columns }) => (
                        <div key={table}>
                          <span className="font-mono text-yellow-300">{table}</span>
                          <span className="text-yellow-200">: {columns.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={cleanObsoletePolicies}
              className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-500 transition-colors flex-shrink-0 whitespace-nowrap"
            >
              Rimuovi Policy Obsolete
            </button>
          </div>
        </div>
      )}

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
            className="w-fit px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors"
          >
            Abilita Tutte
          </button>
          <button
            type="button"
            onClick={() => toggleAllTables(false)}
            className="w-fit px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors"
          >
            Disabilita Tutte
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
            const tablePolicy = policy.tables[tableName];
            const enabled = isTableEnabled(tableName);
            const isExpanded = expandedTables.has(tableName);
            const hasObsoleteColumns = obsoletePolicies.columns.find(oc => oc.table === tableName);

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
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-white font-mono">{tableName}</div>
                        {hasObsoleteColumns && (
                          <span className="px-2 py-0.5 bg-yellow-900/50 border border-yellow-700/50 text-yellow-300 text-[10px] font-medium rounded">
                            Colonne Obsolete
                          </span>
                        )}
                      </div>
                      {table.description && (
                        <div className="text-xs text-gray-400 mt-0.5">{table.description}</div>
                      )}
                      {hasObsoleteColumns && (
                        <div className="text-xs text-yellow-400 mt-1">
                          ⚠️ Colonne non più esistenti: {hasObsoleteColumns.columns.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateTablePolicy(tableName, { enabled: !enabled })}
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
                              checked={tablePolicy?.operations.includes(op) || false}
                              onChange={(e) => {
                                const currentOps = tablePolicy?.operations || ['SELECT'];
                                const newOps = e.target.checked
                                  ? [...currentOps, op]
                                  : currentOps.filter((o) => o !== op);
                                updateTablePolicy(tableName, { operations: newOps });
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
                            checked={tablePolicy?.columns.includes('*') || !tablePolicy}
                            onChange={(e) => {
                              updateTablePolicy(tableName, {
                                columns: e.target.checked ? ['*'] : []
                              });
                            }}
                            className="w-3 h-3"
                          />
                          <span className="text-gray-300 font-semibold">Tutte le colonne (*)</span>
                        </label>
                        {!(tablePolicy?.columns.includes('*') || !tablePolicy) && (
                          <div className="pl-5 space-y-1 max-h-32 overflow-y-auto">
                            {table.columns.map((col) => (
                              <label
                                key={col.name}
                                className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-800 rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={tablePolicy?.columns.includes(col.name) || false}
                                  onChange={(e) => {
                                    const currentCols = tablePolicy?.columns.filter(c => c !== '*') || [];
                                    const newCols = e.target.checked
                                      ? [...currentCols, col.name]
                                      : currentCols.filter((c) => c !== col.name);
                                    updateTablePolicy(tableName, { columns: newCols });
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
                        value={tablePolicy?.rowFilter || ''}
                        onChange={(e) => updateTablePolicy(tableName, { rowFilter: e.target.value })}
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

