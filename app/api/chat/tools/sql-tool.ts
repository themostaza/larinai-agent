import { tool } from 'ai';
import { z } from 'zod';

export const readSqlDbTool = tool({
  description: `
  Esegui query SQL sui database aziendali per ottenere dati per l'utente e aiutare nella comprensione.
  Puoi esplorare lo schema del database per ottenere informazioni sui dati disponibili e sulla struttura delle tabelle

  }`,
  inputSchema: z.object({
    database: z.string().optional().describe('Il nome del database su cui eseguire la query (opzionale, usa il default se non specificato)'),
    query: z.string().describe('La query SQL da eseguire (SELECT, JOIN, WHERE, GROUP BY, etc.)'),
    purpose: z.string().describe('Breve descrizione dello scopo della query per logging')
  }),
  execute: async ({ database, query, purpose }) => {
    // console.log(`🔧 [SQL-TOOL] ============ TOOL EXECUTION START ============`);
    // console.log(`🔧 [SQL-TOOL] Executing SQL query on ${database}: ${purpose}`);
    // console.log(`🔧 [SQL-TOOL] Query: ${query}`);
    // console.log(`🔧 [SQL-TOOL] Timestamp: ${new Date().toISOString()}`);
    
    try {
      //console.log(`🔧 [SQL-TOOL] Making fetch request to /api/query_sql`);
      // Chiamata all'API /query per eseguire la query reale
      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const apiUrl = `${baseUrl}/api/query_sql`;
      // console.log(`🔧 [SQL-TOOL] Using API URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          database,
          query,
          purpose
        })
      });

      console.log(`🔧 [SQL-TOOL] Response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`🔧 [SQL-TOOL] Response not ok: ${response.status} ${response.statusText}`);
        return {
          database,
          query,
          purpose,
          error: `HTTP ${response.status}: ${response.statusText}`,
          success: false
        };
      }

      const result = await response.json();
      console.log(`🔧 [SQL-TOOL] Parsed result:`, { success: result.success, hasData: !!result.data });

      if (!result.success) {
        console.log(`🔧 [SQL-TOOL] Query failed:`, result.error);
        return {
          database,
          query,
          purpose,
          error: result.error,
          success: false
        };
      }

      console.log(`🔧 [SQL-TOOL] Query successful, returning data`);
      return {
        database: result.data.database,
        query: result.data.query,
        purpose: result.data.purpose,
        results: result.data.results,
        rowCount: result.data.rowCount,
        executionTime: result.data.executionTime,
        queryType: result.data.queryType,
        truncated: result.data.truncated,
        success: true
      };

    } catch (error) {
      console.error('🔧 [SQL-TOOL] Error calling query API:', error);
      const errorResult = {
        database,
        query,
        purpose,
        error: `Errore nella chiamata API: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        success: false
      };
      console.log(`🔧 [SQL-TOOL] Returning error result:`, errorResult);
      return errorResult;
    }
  },
});
