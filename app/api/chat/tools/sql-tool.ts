import { tool } from 'ai';
import { z } from 'zod';

interface SqlToolConfig {
  database?: {
    server?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    type?: string;
    [key: string]: unknown;
  };
  description?: string;
}

export const readSqlDbTool = (agentId: string, config?: unknown) => {
  const toolConfig = config as SqlToolConfig | undefined;
  
  // Ottieni il tipo di database dalla configurazione
  const dbType = toolConfig?.database?.type || 'mssql';
  const dbServer = toolConfig?.database?.server || 'non specificato';
  const dbName = toolConfig?.database?.database || 'non specificato';
  const dbPort = toolConfig?.database?.port || (dbType === 'postgresql' ? 5432 : 1433);

  // Costruisci la descrizione base con informazioni dinamiche del database
  const baseDescription = `
CONFIGURAZIONE DATABASE:
- Tipo: ${dbType}
- Server: ${dbServer}
- Database: ${dbName}
- Porta: ${dbPort}

Abbiamo introdotto un nuovo parametro 'aiLimit' per limitare il numero di record che puoi vedere dalla query anche se la query include molti più record.
Per evitare saturazione della finestra di contesto, limita sempre il numero di record che ricevi specificando il parametro 'aiLimit'.
parametro 'aiLimit' (opzionale, default 10 se non lo specifichi):
   - Definisce QUANTI record MASSIMO vuoi leggere dalla query
   - NON modifica la query SQL, ma limita i dati che ricevi e che puoi leggere
   - Valori raccomandati:
     • 10-20: Esplorazione rapida (default: 10)
     • 20-50: Analisi standard
     • -1: TUTTI i dati (⚠️ usa con cautela per evitare saturazione della finestra di contesto!)

 COSA RICEVI dall'esecuzione (TUTTO AUTOMATICO):
  {
    totalCount: 8500,                  // ← Totale record nel DB (calcolato automaticamente)
    returnedCount: 10,                 // ← Record che hai ricevuto (automatico)
    results: [...],                    // ← Array con i record che hai ricevuto
    queryResultStructure: [            // ← Schema colonne (generato automaticamente)
      { name: "id", type: "number", sampleValues: [1, 2, 3] },
      { name: "nome", type: "string", sampleValues: ["Mario", "Luigi", "Peach"] }
    ],
    aiLimitApplied: true               // ← Flag se è stato applicato un limite
  }
  
  IMPORTANTE: totalCount, returnedCount e queryResultStructure sono AUTOMATICI.
  Il sistema esegue la query completa, conta i risultati, e poi limita i dati che puoi vedere in funzione del parametro 'aiLimit'.
  Non serve fare COUNT separato o modificare la query - tutto gestito automaticamente!
  Sii efficiente nel numero di query da eseguire per rispondere all'utente.

  Esempio: se ti chiedono di restituire tutti i dati della tabella 'ordini', la query SQL da eseguire sarà: "SELECT * FROM ordini" perché il totale lo calcoliamo in automatico così come la struttura delle colonne.`;

  // Se c'è una descrizione personalizzata, la usiamo come intestazione, altrimenti usiamo quella di default
  const customDescription = toolConfig?.description || 'Esegui query SQL su database.';
  
  // Combina descrizione personalizzata + informazioni dinamiche
  const description = `${customDescription}\n${baseDescription}`;

  // Log della descrizione finale per debug
  console.log('📋 [SQL-TOOL] Descrizione finale per l\'AI:', description);

  return tool({
    description,
    inputSchema: z.object({
      query: z.string().describe(`La query da eseguire in base al type: ${dbType}`),
      purpose: z.string().describe('Breve descrizione dello scopo della query'),
      aiLimit: z.number().optional().describe('Quanti record MASSIMO vuoi ricevere per la tua lettura. sii conservativo pewr non bruciare contesto.')
    }),
    execute: async ({ query, purpose, aiLimit }) => {
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
        process.env.NEXTAUTH_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const apiUrl = `${baseUrl}/api/query_sql`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          // database non viene più passato dall'AI, verrà usato quello configurato nell'agent
          query,
          purpose,
          aiLimit: aiLimit || 10  // Default automatico: 10 se non specificato
        })
      });

      //console.log(`🔧 [SQL-TOOL] Response status: ${response.status}`);
      
      if (!response.ok) {
        //console.log(`🔧 [SQL-TOOL] Response not ok: ${response.status} ${response.statusText}`);
        return {
          query,
          purpose,
          error: `HTTP ${response.status}: ${response.statusText}`,
          success: false
        };
      }

      const result = await response.json();
      //console.log(`🔧 [SQL-TOOL] Parsed result:`, { success: result.success, hasData: !!result.data });

      if (!result.success) {
        //console.log(`🔧 [SQL-TOOL] Query failed:`, result.error);
        return {
          query,
          purpose,
          error: result.error,
          success: false
        };
      }

      //console.log(`🔧 [SQL-TOOL] Query successful, returning data`);
      return {
        database: result.data.database,
        query: result.data.query,
        purpose: result.data.purpose,
        results: result.data.results,                        // Dati limitati per l'AI
        totalCount: result.data.totalCount,                  // Conteggio TOTALE nel DB (automatico)
        returnedCount: result.data.returnedCount,            // Quanti record restituiti (automatico)
        queryResultStructure: result.data.queryResultStructure, // Schema colonne (automatico)
        executionTime: result.data.executionTime,
        queryType: result.data.queryType,
        aiLimitApplied: result.data.aiLimitApplied,          // Se è stato applicato un limite
        success: true
      };

    } catch (error) {
      //console.error('🔧 [SQL-TOOL] Error calling query API:', error);
      const errorResult = {
        query,
        purpose,
        error: `Errore nella chiamata API: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        success: false
      };
      //console.log(`🔧 [SQL-TOOL] Returning error result:`, errorResult);
      return errorResult;
    }
    },
  });
};
