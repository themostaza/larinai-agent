import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { Client as PgClient } from 'pg';
import { identify } from 'sql-query-identifier';

// Configurazione database dalle variabili d'ambiente
const DB_CONFIG: sql.config = {
  server: process.env.DB_SERVER!,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_DATABASE || 'DWH',
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Pool di connessioni SQL Server
let pool: sql.ConnectionPool | null = null;

// Funzione per ottenere la connessione al database
async function getDbConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = new sql.ConnectionPool(DB_CONFIG);
    await pool.connect();
    
    pool.on('error', (error: Error) => {
      console.error('Database pool error:', error);
      pool = null;
    });
  }
  
  return pool;
}

// Funzione per chiudere la connessione
async function closeDbConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

// Interfaccia per la richiesta
interface QueryRequest {
  database?: string;
  query: string;
  purpose?: string;
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
async function executeSQLServer(query: string, database?: string): Promise<unknown[]> {
  try {
    const connection = await getDbConnection();
    
    // Se viene specificato un database diverso, usa USE
    if (database && database !== DB_CONFIG.database) {
      await connection.request().query(`USE [${database}]`);
    }
    
    const result = await connection.request().query(query);
    return result.recordset || [];
  } catch (error) {
    console.error('SQL Server query error:', error);
    throw error;
  }
}

// Funzione per eseguire query PostgreSQL (mantenuta per compatibilità)
async function executePostgreSQL(query: string, database?: string): Promise<unknown[]> {
  const client = new PgClient({
    host: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: database || process.env.DB_DATABASE,
  });

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
    const { database, query, purpose } = body;

    // Validazione input
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Query SQL richiesta' 
        },
        { status: 400 }
      );
    }

    console.log('=== QUERY SQL REQUEST ===');
    console.log('Database:', database || DB_CONFIG.database);
    console.log('Purpose:', purpose);
    console.log('Query:', query);

    // Validazione della query
    const validation = validateSQLQuery(query);
    if (!validation.isValid) {
      console.log('Validation error:', validation.error);
      return NextResponse.json(
        { 
          success: false, 
          error: validation.error,
          query,
          database: database || DB_CONFIG.database
        },
        { status: 400 }
      );
    }

    // Esecuzione della query
    let results;
    const executionStart = Date.now();

    // Determina il tipo di database dalle variabili d'ambiente
    const dbType = process.env.DB_TYPE || 'mssql';
    
    if (dbType === 'postgresql') {
      results = await executePostgreSQL(query, database);
    } else {
      // Default a SQL Server
      results = await executeSQLServer(query, database);
    }

    const executionTime = Date.now() - executionStart;
    const totalTime = Date.now() - startTime;

    console.log(`Query executed successfully in ${executionTime}ms`);
    console.log(`Results count: ${Array.isArray(results) ? results.length : 'N/A'}`);

    // Limita i risultati per evitare risposte troppo grandi
    const maxResults = 1000;
    const limitedResults = Array.isArray(results) && results.length > maxResults 
      ? results.slice(0, maxResults)
      : results;

    const response = {
      success: true,
      data: {
        results: limitedResults,
        rowCount: Array.isArray(results) ? results.length : 0,
        executionTime: `${executionTime}ms`,
        totalTime: `${totalTime}ms`,
        database: database || DB_CONFIG.database,
        query,
        purpose,
        queryType: validation.type,
        truncated: Array.isArray(results) && results.length > maxResults
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

// Endpoint per testare la connessione
export async function GET() {
  try {
    console.log('Testing database connection...');
    console.log('DB Config:', {
      server: DB_CONFIG.server,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      database: DB_CONFIG.database,
      type: process.env.DB_TYPE || 'mssql'
    });

    const dbType = process.env.DB_TYPE || 'mssql';
    
    if (dbType === 'postgresql') {
      const client = new PgClient({
        host: process.env.DB_SERVER,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
    } else {
      // Test SQL Server connection
      const connection = await getDbConnection();
      await connection.request().query('SELECT 1 as test');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Connessione al database riuscita',
      config: {
        server: DB_CONFIG.server,
        port: DB_CONFIG.port,
        database: DB_CONFIG.database,
        type: dbType
      }
    });

  } catch (error) {
    console.error('Database connection test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore di connessione al database',
        config: {
          server: DB_CONFIG.server,
          port: DB_CONFIG.port,
          database: DB_CONFIG.database,
          type: process.env.DB_TYPE || 'mssql'
        }
      },
      { status: 500 }
    );
  }
}
