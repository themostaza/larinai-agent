import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { Client as PgClient } from 'pg';
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

// Funzione per estrarre lo schema PostgreSQL
async function extractPostgreSQLSchema(config: Awaited<ReturnType<typeof getAgentDbConfig>>) {
  const pgConfig = {
    host: config.server,
    port: config.port || 5432,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: { rejectUnauthorized: false }
  };

  const client = new PgClient(pgConfig);
  await client.connect();

  try {
    const structure: {
      database: string;
      type: string;
      tables: Array<{
        schema: string;
        name: string;
        description: string;
        columns: Array<{
          name: string;
          type: string;
          nullable: boolean;
          default: string | null;
          description: string;
          isPrimaryKey: boolean;
        }>;
        foreignKeys: Array<{
          column: string;
          referencesTable: string;
          referencesColumn: string;
        }>;
      }>;
    } = {
      database: config.database || '',
      type: 'postgresql',
      tables: []
    };

    // Ottieni tutte le tabelle
    const tablesResult = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name;
    `);

    for (const table of tablesResult.rows) {
      // Descrizione tabella
      const tableDescResult = await client.query(`
        SELECT obj_description(c.oid) as description
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND n.nspname = $2;
      `, [table.table_name, table.table_schema]);

      // Colonne
      const columnsResult = await client.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.ordinal_position,
          pgd.description as column_description
        FROM information_schema.columns c
        LEFT JOIN pg_catalog.pg_statio_all_tables st ON c.table_schema = st.schemaname AND c.table_name = st.relname
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position;
      `, [table.table_schema, table.table_name]);

      // Chiavi primarie
      const primaryKeysResult = await client.query(`
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary;
      `, [`${table.table_schema}.${table.table_name}`]);

      // Foreign keys
      const foreignKeysResult = await client.query(`
        SELECT
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2;
      `, [table.table_schema, table.table_name]);

      structure.tables.push({
        schema: table.table_schema,
        name: table.table_name,
        description: tableDescResult.rows[0]?.description || '',
        columns: columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default,
          description: col.column_description || '',
          isPrimaryKey: primaryKeysResult.rows.some(pk => pk.column_name === col.column_name)
        })),
        foreignKeys: foreignKeysResult.rows.map(fk => ({
          column: fk.column_name,
          referencesTable: `${fk.foreign_table_schema}.${fk.foreign_table_name}`,
          referencesColumn: fk.foreign_column_name
        }))
      });
    }

    await client.end();
    return structure;
  } catch (error) {
    await client.end();
    throw error;
  }
}

// Funzione per estrarre lo schema SQL Server
async function extractMSSQLSchema(config: Awaited<ReturnType<typeof getAgentDbConfig>>) {
  const sqlConfig: sql.config = {
    server: config.server!,
    port: config.port || 1433,
    database: config.database || '',
    user: config.user!,
    password: config.password!,
    options: {
      encrypt: config.encrypt !== false,
      trustServerCertificate: config.trustServerCertificate !== false,
      enableArithAbort: config.enableArithAbort !== false,
      requestTimeout: config.requestTimeout || 30000
    }
  };

  const pool = await sql.connect(sqlConfig);

  try {
    const structure: {
      database: string;
      type: string;
      tables: Array<{
        schema: string;
        name: string;
        description: string;
        columns: Array<{
          name: string;
          type: string;
          nullable: boolean;
          default: string | null;
          description: string;
          isPrimaryKey: boolean;
        }>;
        foreignKeys: Array<{
          column: string;
          referencesTable: string;
          referencesColumn: string;
        }>;
      }>;
    } = {
      database: config.database || '',
      type: 'mssql',
      tables: []
    };

    // Ottieni tutte le tabelle con descrizioni
    const tablesResult = await pool.request().query(`
      SELECT 
        s.name AS schema_name,
        t.name AS table_name,
        CAST(ep.value AS NVARCHAR(MAX)) AS table_description
      FROM sys.tables t
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id 
        AND ep.minor_id = 0 
        AND ep.name = 'MS_Description'
      ORDER BY s.name, t.name
    `);

    for (const table of tablesResult.recordset) {
      // Colonne con descrizioni
      const columnsResult = await pool.request()
        .input('schemaName', sql.NVarChar, table.schema_name)
        .input('tableName', sql.NVarChar, table.table_name)
        .query(`
          SELECT 
            c.name AS column_name,
            t.name AS data_type,
            c.is_nullable,
            dc.definition AS column_default,
            CAST(ep.value AS NVARCHAR(MAX)) AS column_description,
            CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
          FROM sys.columns c
          INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
          INNER JOIN sys.tables tb ON c.object_id = tb.object_id
          INNER JOIN sys.schemas s ON tb.schema_id = s.schema_id
          LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
          LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id 
            AND ep.minor_id = c.column_id 
            AND ep.name = 'MS_Description'
          LEFT JOIN (
            SELECT ic.object_id, ic.column_id
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            WHERE i.is_primary_key = 1
          ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
          WHERE s.name = @schemaName AND tb.name = @tableName
          ORDER BY c.column_id
        `);

      // Foreign keys
      const foreignKeysResult = await pool.request()
        .input('schemaName', sql.NVarChar, table.schema_name)
        .input('tableName', sql.NVarChar, table.table_name)
        .query(`
          SELECT 
            COL_NAME(fc.parent_object_id, fc.parent_column_id) AS column_name,
            OBJECT_SCHEMA_NAME(fc.referenced_object_id) + '.' + OBJECT_NAME(fc.referenced_object_id) AS references_table,
            COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS references_column
          FROM sys.foreign_key_columns fc
          INNER JOIN sys.tables t ON fc.parent_object_id = t.object_id
          INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
          WHERE s.name = @schemaName AND t.name = @tableName
        `);

      structure.tables.push({
        schema: table.schema_name,
        name: table.table_name,
        description: table.table_description || '',
        columns: columnsResult.recordset.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable,
          default: col.column_default,
          description: col.column_description || '',
          isPrimaryKey: col.is_primary_key === 1
        })),
        foreignKeys: foreignKeysResult.recordset.map(fk => ({
          column: fk.column_name,
          referencesTable: fk.references_table,
          referencesColumn: fk.references_column
        }))
      });
    }

    await pool.close();
    return structure;
  } catch (error) {
    await pool.close();
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    // Recupera la configurazione del database dall'agent
    const dbConfig = await getAgentDbConfig(agentId);
    const dbType = dbConfig.type || 'mssql';

    console.log(`🔍 [TEST-DB] Testing connection for agent ${agentId}, type: ${dbType}`);

    let schema;
    if (dbType === 'postgresql') {
      schema = await extractPostgreSQLSchema(dbConfig);
    } else {
      schema = await extractMSSQLSchema(dbConfig);
    }

    console.log(`✅ [TEST-DB] Schema extracted: ${schema.tables.length} tables`);

    return NextResponse.json({
      success: true,
      schema
    });

  } catch (error) {
    console.error('❌ [TEST-DB] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto nel test della connessione'
      },
      { status: 500 }
    );
  }
}

