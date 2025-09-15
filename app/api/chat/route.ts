import { openai } from '@ai-sdk/openai';
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// export async function POST(req: Request) {
//   try {
//     const body = await req.json();
//     console.log('Received body:', JSON.stringify(body, null, 2));
    
//     const { messages } = body;
//     console.log('Messages:', messages);

//     // Verifica che messages sia un array valido
//     if (!messages || !Array.isArray(messages)) {
//       console.log('Invalid messages:', messages);
//       return new Response('Invalid messages format', { status: 400 });
//     }

//     // Verifica che ogni messaggio abbia la struttura corretta
//     const validMessages = messages.filter(msg => 
//       msg && typeof msg === 'object' && msg.role && msg.content
//     );
    
//     console.log('Valid messages:', validMessages);

//     if (validMessages.length === 0) {
//       return new Response('No valid messages found', { status: 400 });
//     }

//     // Prompt personalizzato per il sales agent di Technowrapp
//     const systemPrompt = `Sei l'Agent Commerciale AI di Technowrapp, un'azienda innovativa nel settore tecnologico.

// Il tuo ruolo è:
// - Assistere il team commerciale con analisi e insights
// - Fornire informazioni sui clienti e prospect
// - Aiutare con strategie di vendita e follow-up
// - Analizzare performance commerciali
// - Suggerire approcci personalizzati per ogni cliente

// Caratteristiche della tua personalità:
// - Professionale ma amichevole
// - Orientato ai risultati
// - Proattivo nel suggerire azioni
// - Preciso nell'analisi dei dati
// - Sempre aggiornato sulle best practices di vendita

// Rispondi sempre in italiano e mantieni un tono professionale ma accessibile.`;

//     const result = await streamText({
//       model: openai('gpt-5-mini-2025-08-07'),
//       system: systemPrompt,
//       messages: validMessages,
//     });

//     return new Response(result.textStream, {
//       headers: {
//         'Content-Type': 'text/plain; charset=utf-8',
//         'Transfer-Encoding': 'chunked',
//       },
//     });
//   } catch (error) {
//     console.error('Error in chat API:', error);
//     return new Response('Internal Server Error', { status: 500 });
//   }
// }




//new version to use with tools
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // System prompt per il sales agent con informazioni sui database
  const systemPrompt = `Sei l'Agent Commerciale AI di Technowrapp, un'azienda innovativa nel settore tecnologico.

Hai accesso ai seguenti database per supportare le tue analisi commerciali:

1. **DATABASE CLIENTI (clients_db)**:
   - Tabella 'clients': id, company_name, contact_person, email, phone, industry, status, created_date, last_contact
   - Tabella 'opportunities': id, client_id, deal_value, stage, probability, expected_close_date, description
   - Tabella 'interactions': id, client_id, interaction_type, date, notes, outcome

2. **DATABASE VENDITE (sales_db)**:
   - Tabella 'sales': id, client_id, amount, sale_date, product_category, sales_person
   - Tabella 'products': id, name, category, price, description
   - Tabella 'sales_team': id, name, role, territory, performance_score

3. **DATABASE MARKETING (marketing_db)**:
   - Tabella 'campaigns': id, name, start_date, end_date, budget, channel, status
   - Tabella 'leads': id, source, company, contact_name, email, score, campaign_id
   - Tabella 'campaign_performance': campaign_id, impressions, clicks, conversions, cost

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
        description: 'Esegui query SQL sui database aziendali per ottenere dati commerciali, clienti, vendite e marketing',
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

