import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { Client as PgClient } from 'pg';
import { identify } from 'sql-query-identifier';
import { createClient } from '@/lib/supabase/server';


// Funzione per ottenere la configurazione database dall'agent
async function getAgentDbConfig(agentId: string) {
  const supabase = await createClient();
  const { data: agent, error } = await supabase
    .from('agents')
    .select('settings')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    throw new Error('Agent non trovato o errore nel recupero della configurazione');
  }

  const settings = agent.settings as { tools?: { 'sql-tool'?: { config?: { database?: unknown } } } } | null;
  const dbConfig = settings?.tools?.['sql-tool']?.config?.database;

  if (!dbConfig) {
    throw new Error('Configurazione database non trovata per questo agent');
  }

  return dbConfig as {
    type?: string;
    server?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    enableArithAbort?: boolean;
    requestTimeout?: number;
  };
}

// Funzione per ottenere la connessione al database con configurazione dinamica
async function getDbConnection(dbConfig: sql.config): Promise<sql.ConnectionPool> {
  // Per ora creiamo una nuova connessione ogni volta (potremmo implementare pooling per agent)
  const newPool = new sql.ConnectionPool(dbConfig);
  await newPool.connect();
  
  newPool.on('error', (error: Error) => {
    console.error('Database pool error:', error);
  });
  
  return newPool;
}



// Interfaccia per la richiesta
interface QueryRequest {
  agentId?: string;
  database?: string;
  query: string;
  purpose?: string;
  aiLimit?: number; // Limite per i dati passati all'AI (default: 50)
}

// Funzione per validare la query SQL
function validateSQLQuery(query: string): { isValid: boolean; error?: string; type?: string } {
  try {
    // Rimuovi commenti e spazi extra
    const cleanQuery = query.trim().replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
    
    if (!cleanQuery) {
      return { isValid: false, error: 'Query vuota' };
    }

    // Identifica il tipo di query
    const identified = identify(cleanQuery);
    
    if (!identified || identified.length === 0) {
      return { isValid: false, error: 'Query SQL non riconosciuta' };
    }

    const queryType = identified[0].type.toLowerCase();

    // Permetti solo query SELECT per sicurezza
    if (queryType !== 'select') {
      return { 
        isValid: false, 
        error: `Tipo di query non permesso: ${queryType}. Solo SELECT è consentito.` 
      };
    }

    // Controlla per parole chiave pericolose
    const dangerousKeywords = [
      'drop', 'delete', 'update', 'insert', 'create', 'alter', 
      'truncate', 'exec', 'execute', 'sp_', 'xp_'
    ];
    
    const lowerQuery = cleanQuery.toLowerCase();
    for (const keyword of dangerousKeywords) {
      if (lowerQuery.includes(keyword)) {
        return { 
          isValid: false, 
          error: `Parola chiave non permessa rilevata: ${keyword}` 
        };
      }
    }

    return { isValid: true, type: queryType };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Errore nella validazione SQL: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` 
    };
  }
}

// Funzione per eseguire query SQL Server
async function executeSQLServer(query: string, dbConfig: sql.config, database?: string): Promise<unknown[]> {
  try {
    const connection = await getDbConnection(dbConfig);
    
    // Se viene specificato un database diverso, usa USE
    if (database && database !== dbConfig.database) {
      await connection.request().query(`USE [${database}]`);
    }
    
    const result = await connection.request().query(query);
    
    // Chiudi la connessione
    await connection.close();
    
    return result.recordset || [];
  } catch (error) {
    console.error('SQL Server query error:', error);
    throw error;
  }
}

// Funzione per ottenere la configurazione PostgreSQL dall'agent config
function getPostgreSQLConfigFromAgent(agentDbConfig: ReturnType<typeof getAgentDbConfig> extends Promise<infer T> ? T : never, database?: string) {
  return {
    host: agentDbConfig.server,
    port: agentDbConfig.port || 5432,
    user: agentDbConfig.user,
    password: agentDbConfig.password,
    database: database || agentDbConfig.database,
    ssl: { rejectUnauthorized: false }
  };
}

// Funzione per eseguire query PostgreSQL
async function executePostgreSQL(query: string, agentDbConfig: Awaited<ReturnType<typeof getAgentDbConfig>>, database?: string): Promise<unknown[]> {
  const config = getPostgreSQLConfigFromAgent(agentDbConfig, database);
  const client = new PgClient(config);

  try {
    await client.connect();
    const result = await client.query(query);
    return result.rows;
  } finally {
    await client.end();
  }
}

// Handler principale
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: QueryRequest = await request.json();
    const { agentId, database, query, purpose, aiLimit } = body;
    
    // Default aiLimit = 50, usa -1 per nessun limite
    const appliedLimit = aiLimit !== undefined ? aiLimit : 50;

    // Validazione input
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Query SQL o PostgreSQL richiesta' 
        },
        { status: 400 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'agentId è richiesto' 
        },
        { status: 400 }
      );
    }

    // Recupera la configurazione del database dall'agent
    const agentDbConfig = await getAgentDbConfig(agentId);

    // Validazione della query
    const validation = validateSQLQuery(query);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: validation.error,
          query,
          database: database || agentDbConfig.database
        },
        { status: 400 }
      );
    }

    const executionStart = Date.now();

    // Determina il tipo di database dalla configurazione dell'agent
    const dbType = agentDbConfig.type || 'mssql';
    
    // Costruisci la configurazione SQL Server (se necessario)
    const sqlServerConfig: sql.config = {
      server: agentDbConfig.server!,
      port: agentDbConfig.port || 1433,
      database: database || agentDbConfig.database || 'DWH',
      user: agentDbConfig.user!,
      password: agentDbConfig.password!,
      options: {
        encrypt: agentDbConfig.encrypt !== false,
        trustServerCertificate: agentDbConfig.trustServerCertificate !== false,
        enableArithAbort: agentDbConfig.enableArithAbort !== false,
        requestTimeout: agentDbConfig.requestTimeout || 30000
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };

    // Approccio semplice: esegui query COMPLETA, poi limita i dati per l'AI
    let allResults;
    
    // Esegui la query originale SENZA modifiche
    if (dbType === 'postgresql') {
      allResults = await executePostgreSQL(query, agentDbConfig, database);
    } else {
      allResults = await executeSQLServer(query, sqlServerConfig, database);
    }

    // Calcola totalCount dai risultati completi
    const totalCount = Array.isArray(allResults) ? allResults.length : 0;
    
    // Limita i risultati per l'AI solo se aiLimit è specificato e > 0
    let results;
    if (appliedLimit > 0 && appliedLimit < totalCount) {
      // Prendi solo i primi aiLimit record per l'AI
      results = allResults.slice(0, appliedLimit);
    } else {
      // Passa tutti i risultati all'AI
      results = allResults;
    }
    
    const returnedCount = Array.isArray(results) ? results.length : 0;

    const executionTime = Date.now() - executionStart;
    const totalTime = Date.now() - startTime;

    // Genera automaticamente queryResultStructure (schema delle colonne)
    let queryResultStructure = null;
    if (Array.isArray(results) && results.length > 0) {
      const firstRow = results[0] as Record<string, unknown>;
      queryResultStructure = Object.keys(firstRow).map(columnName => ({
        name: columnName,
        type: typeof firstRow[columnName],
        // Aggiungi valori di esempio dai primi 3 record (se disponibili)
        sampleValues: results.slice(0, Math.min(3, results.length)).map(row => 
          (row as Record<string, unknown>)[columnName]
        )
      }));
    }

    const response = {
      success: true,
      data: {
        results,                // Dati limitati per l'AI
        totalCount,             // Conteggio TOTALE nel DB (automatico da window function)
        returnedCount,          // Quanti record effettivamente restituiti (automatico)
        queryResultStructure,   // Schema delle colonne con esempi (automatico)
        executionTime: `${executionTime}ms`,
        totalTime: `${totalTime}ms`,
        database: database || agentDbConfig.database,
        query,                  // Query originale SENZA LIMIT (per ri-esecuzione)
        purpose,
        queryType: validation.type,
        aiLimitApplied: appliedLimit > 0 && appliedLimit < totalCount // Flag se limitato
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('Database query error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto nell\'esecuzione della query',
        totalTime: `${totalTime}ms`
      },
      { status: 500 }
    );
  }
}

// Endpoint per testare la connessione (ora richiede agentId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'agentId è richiesto per testare la connessione' 
        },
        { status: 400 }
      );
    }

    // Recupera la configurazione del database dall'agent
    const agentDbConfig = await getAgentDbConfig(agentId);
    const dbType = agentDbConfig.type || 'mssql';
    
    if (dbType === 'postgresql') {
      const config = getPostgreSQLConfigFromAgent(agentDbConfig);
      const client = new PgClient(config);

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
    } else {
      // Test SQL Server connection
      const sqlServerConfig: sql.config = {
        server: agentDbConfig.server!,
        port: agentDbConfig.port || 1433,
        database: agentDbConfig.database || 'DWH',
        user: agentDbConfig.user!,
        password: agentDbConfig.password!,
        options: {
          encrypt: agentDbConfig.encrypt !== false,
          trustServerCertificate: agentDbConfig.trustServerCertificate !== false,
          enableArithAbort: agentDbConfig.enableArithAbort !== false,
          requestTimeout: agentDbConfig.requestTimeout || 30000
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        }
      };
      const connection = await getDbConnection(sqlServerConfig);
      await connection.request().query('SELECT 1 as test');
      await connection.close();
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Connessione al database riuscita',
      config: {
        type: dbType,
        server: agentDbConfig.server,
        database: agentDbConfig.database
      }
    });

  } catch (error) {
    console.error('Database connection test failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore di connessione al database'
      },
      { status: 500 }
    );
  }
}
