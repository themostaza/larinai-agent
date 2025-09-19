import { openai } from '@ai-sdk/openai';
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { readSqlDbTool } from './tools/sql-tool';
import { giveNameToCurrentChatTool } from './tools/name-chat-tool';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Ottieni data e ora correnti in UTC
  const now = new Date();
  const currentDateTimeUTC = now.toISOString();
  const currentDateUTC = now.toISOString().split('T')[0];
  const currentTimeUTC = now.toISOString().split('T')[1].split('.')[0];

  // System prompt per il sales agent con informazioni sui database
  const systemPrompt = `
  
  Sei l'Agent AI dell'utente in chat con te.

CONTESTO TEMPORALE CORRENTE:
- Data di oggi (UTC): ${currentDateUTC}
- Ora corrente (UTC): ${currentTimeUTC}
- Timestamp completo (UTC): ${currentDateTimeUTC}

Il tuo ruolo è:
- Assistere l'utente con analisi e insights basati sui dati
- Aiutare con strategie di follow-up usando dati storici
- Analizzare performance e trend
- Assegnare automaticamente nomi descrittivi alle conversazioni quando appropriato e solo all'inizio della conversazione (dopo i primi 3 o 4 messaggi diciamo ma vedi tu)

Quando ti viene chiesta un'analisi:
1. Identifica quali database e tabelle consultare
2. Esegui le query SQL necessarie (anche multiple se serve)
3. Analizza i risultati e fornisci insights actionable
4. Suggerisci prossimi passi basati sui dati
5. Usa il contesto temporale corrente per analisi storiche (es. "negli ultimi 30 giorni", "questo mese", "quest'anno")

NAMING DELLA CHAT:
- Quando la conversazione sviluppa un tema specifico o focus principale, usa il tool "give_name_to_current_chat"
- Assegna un nome breve, descrittivo e catchy (massimo 50 caratteri)
- Il nome deve riflettere l'argomento principale o l'obiettivo della conversazione
- Esempi: "Analisi Vendite Q3", "Performance Marketing Digitale", "Trend Clienti Premium"
- Non aspettare che l'utente chieda di nominare la chat - fallo proattivamente quando ha senso

Rispondi sempre in italiano e mantieni un tono professionale ma accessibile.`;

  const result = streamText({
    model: openai('gpt-5-mini-2025-08-07'),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5), // Permetti fino a 5 step per query multiple
    tools: {
      read_sql_db: readSqlDbTool,
      give_name_to_current_chat: giveNameToCurrentChatTool,
    },
  });

  return result.toUIMessageStreamResponse();
}

