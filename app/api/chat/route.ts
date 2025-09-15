import { openai } from '@ai-sdk/openai';
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // System prompt per il sales agent con informazioni sui database
  const systemPrompt = `Sei l'Agent Commerciale AI di Technowrapp, un'azienda innovativa che produce macchi e sistemi per l'imballaggio.

Il tuo ruolo è:
- Assistere il team commerciale con analisi e insights basati sui dati
- Fornire informazioni sui clienti e prospect tramite query SQL
- Aiutare con strategie di vendita e follow-up usando dati storici
- Analizzare performance commerciali e trend
- Suggerire approcci personalizzati per ogni cliente basati sui dati

Quando ti viene chiesta un'analisi:
1. Identifica quali database e tabelle consultare
2. Esegui le query SQL necessarie (anche multiple se serve)
3. Analizza i risultati e fornisci insights actionable
4. Suggerisci prossimi passi basati sui dati

Rispondi sempre in italiano e mantieni un tono professionale ma accessibile.`;

  const result = streamText({
    model: openai('gpt-5-mini-2025-08-07'),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5), // Permetti fino a 5 step per query multiple
    tools: {
      read_sql_db: tool({
        description: `
        Esegui query SQL sui database aziendali per ottenere dati per l'ufficio commerciale.
        {
      "database_name": "DWH",
      "schema_name": "ai",
      "table_name": "lk_clienti_RIC",
      "table_type": "VIEW"
    } con la seguente struttura:
Colonna	Tipo	Nullable	Lunghezza
tipo_conto_clifor_id	char	NO	1
codice_cliente_id	varchar	YES	15
descrizione_cliente_id	varchar	YES	60
provincia_id	char	YES	2
nazione_id	char	YES	3
nazione	varchar	YES	35
partita_iva_id	char	YES	12
categoria_contabile_id	varchar	YES	5
email	char	YES	254 
    {
      "database_name": "DWH",
      "schema_name": "ai",
      "table_name": "lk_commesse",
      "table_type": "BASE TABLE"
    } con la seguente struttura:
Colonna	Tipo	Nullable	Lunghezza
Colonna	Tipo	Nullable	Lunghezza
codice_commessa	varchar	YES	15
nome_commessa	nvarchar	YES	566
note_commessa	varchar	YES	-1
cliente_fatturazione_id	varchar	YES	100
data_inizio_dt	datetime	YES	-
data_consegna_iniziale_dt	datetime	YES	-
flag_attiva	int	NO	10
flag_RS	int	NO	10
cliente_destinazione_id	varchar	YES	100
tipo_commessa_id	varchar	YES	3
codice_commessa_padre_id	nvarchar	YES	300
data_consegna_attuale_dt	datetime	YES	-
data_spedizione_prevista_dt	datetime	YES	-
data_chiusura_prevista_MR_dt	datetime	YES	-
data_fatturazione_dt	datetime	YES	-
data_spedizione_dt	datetime	YES	-
data_chiusura_dt	datetime	YES	-
data_fine_collaudo_dt	date	YES	-
data_copia_odl_distinte_dt	datetime	YES	-
data_fine_lavori_dt	datetime	YES	-
data_installazione_completata_dt	datetime	YES	-
flag_collaudo_finale_completato	int	YES	10
flag_smontaggio_completato	int	YES	10
flag_spedita	int	YES	10
flag_fine_commessa_UTE	int	YES	10
flag_fine_commessa_UTM	int	YES	10
flag_installazione_completata	int	YES	10
flag_chiusa	int	NO	10
complessita_UTM	varchar	YES	15
complessita_UTE	varchar	YES	15
complessita_USW	varchar	YES	15
Processo_UT	varchar	YES	7
quota_all_ordine_flag	int	YES	10
quota_al_fat_flag	int	YES	10
impianto_macchina_desc	nvarchar	YES	419
report_category_type_name	nvarchar	YES	219
report_product_type_name	nvarchar	YES	219
    }`,
        inputSchema: z.object({
          database: z.string().optional().describe('Il nome del database su cui eseguire la query (opzionale, usa il default se non specificato)'),
          query: z.string().describe('La query SQL da eseguire (SELECT, JOIN, WHERE, GROUP BY, etc.)'),
          purpose: z.string().describe('Breve descrizione dello scopo della query per logging')
        }),
        execute: async ({ database, query, purpose }) => {
          console.log(`Executing SQL query on ${database}: ${purpose}`);
          console.log(`Query: ${query}`);
          
          try {
            // Chiamata all'API /query per eseguire la query reale
            const response = await fetch('http://localhost:3000/api/query', {
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

            const result = await response.json();

            if (!result.success) {
              return {
                database,
                query,
                purpose,
                error: result.error,
                success: false
              };
            }

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
            console.error('Error calling query API:', error);
            return {
              database,
              query,
              purpose,
              error: `Errore nella chiamata API: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
              success: false
            };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}

