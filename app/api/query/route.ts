import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { identify } from 'sql-query-identifier';

// Configurazione database dalle variabili d'ambiente
const DB_CONFIG = {
  host: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'DWH',
  // Tipo di database: 'mysql' o 'postgresql'
  type: process.env.DB_TYPE || 'mysql'
};

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

// Funzione per eseguire query MySQL
async function executeMySQL(query: string, database?: string): Promise<unknown[]> {
  let connection;
  try {
    const config = { ...DB_CONFIG };
    if (database) {
      config.database = database;
    }

    connection = await mysql.createConnection(config as mysql.ConnectionOptions);
    const [results] = await connection.execute(query);
    return Array.isArray(results) ? results : [];
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Funzione per eseguire query PostgreSQL
async function executePostgreSQL(query: string, database?: string): Promise<unknown[]> {
  const client = new PgClient({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: database || DB_CONFIG.database,
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

    if (DB_CONFIG.type === 'postgresql') {
      results = await executePostgreSQL(query, database);
    } else {
      results = await executeMySQL(query, database);
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
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      database: DB_CONFIG.database,
      type: DB_CONFIG.type
    });

    if (DB_CONFIG.type === 'postgresql') {
      const client = new PgClient({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
        database: DB_CONFIG.database,
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
    } else {
      const connection = await mysql.createConnection(DB_CONFIG);
      await connection.execute('SELECT 1');
      await connection.end();
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Connessione al database riuscita',
      config: {
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        database: DB_CONFIG.database,
        type: DB_CONFIG.type
      }
    });

  } catch (error) {
    console.error('Database connection test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore di connessione al database',
        config: {
          host: DB_CONFIG.host,
          port: DB_CONFIG.port,
          database: DB_CONFIG.database,
          type: DB_CONFIG.type
        }
      },
      { status: 500 }
    );
  }
}
