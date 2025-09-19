import { openai } from '@ai-sdk/openai';
import { streamText, stepCountIs } from 'ai';
import { createChartTool } from './tools/create-chart-tool';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, queryContext } = body;
  
  // Debug log
  console.log('🤖 [DATA-AGENT] Received request:', { 
    messagesCount: messages?.length, 
    hasQueryContext: !!queryContext,
    messages: messages
  });

  // Validazione dei messaggi
  if (!messages || !Array.isArray(messages)) {
    console.error('🤖 [DATA-AGENT] Invalid messages:', messages);
    throw new Error('Messages array is required');
  }

  // Ottieni data e ora correnti in UTC
  const now = new Date();
  const currentDateTimeUTC = now.toISOString();
  const currentDateUTC = now.toISOString().split('T')[0];
  const currentTimeUTC = now.toISOString().split('T')[1].split('.')[0];

  // System prompt per il data agent specializzato in visualizzazioni
  const systemPrompt = `
Sei un Data Agent AI specializzato nella creazione di grafici, KPI e visualizzazioni dati.

CONTESTO TEMPORALE CORRENTE:
- Data di oggi (UTC): ${currentDateUTC}
- Ora corrente (UTC): ${currentTimeUTC}
- Timestamp completo (UTC): ${currentDateTimeUTC}

${queryContext ? `
CONTESTO QUERY CORRENTE:
- Query SQL: ${queryContext.query}
- Database: ${queryContext.database}
- Scopo: ${queryContext.purpose}
- Session ID: ${queryContext.sessionId}
- Query ID: ${queryContext.queryId}
- Chat Message ID: ${queryContext.chatMessageId}

I dati di questa query sono già disponibili e l'utente vuole creare visualizzazioni basate su di essi.
IMPORTANTE: Quando usi il tool create_chart, usa il Chat Message ID: ${queryContext.chatMessageId}
` : ''}

Il tuo ruolo è:
- Analizzare i dati disponibili e suggerire le migliori visualizzazioni
- Creare configurazioni JSON per grafici e KPI usando il tool create_chart
- Spiegare le scelte di visualizzazione e fornire insights
- Ottimizzare le visualizzazioni per la comprensione dei dati
- Suggerire KPI rilevanti basati sui dati disponibili

LINEE GUIDA PER LE VISUALIZZAZIONI:
1. **KPI**: Usa per metriche singole importanti (totali, medie, percentuali)
2. **Grafici a Barre**: Per confronti tra categorie
3. **Grafici a Linee**: Per trend temporali
4. **Grafici a Torta/Doughnut**: Per distribuzioni percentuali (max 6-8 categorie)
5. **Combinazioni**: Crea sia KPI che grafici quando appropriato

PROCESSO:
1. Analizza i dati disponibili e la loro struttura
2. Identifica le visualizzazioni più efficaci
3. Crea la configurazione JSON usando il tool create_chart
4. Spiega le scelte fatte e come interpretare i risultati

Rispondi sempre in italiano e mantieni un tono professionale ma accessibile.
Sii proattivo nel suggerire visualizzazioni anche quando l'utente non è specifico.
`;

  // Converti i messaggi nel formato corretto per l'AI SDK
  const modelMessages = messages.map((msg: { role: string; content: string }) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }));

  console.log('🤖 [DATA-AGENT] Converted messages:', modelMessages);

  const result = streamText({
    model: openai('gpt-5-mini-2025-08-07'),
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(3), // Permetti fino a 3 step per creazione grafici
    tools: {
      create_chart: createChartTool,
    },
    toolChoice: 'auto',
  });

  return result.toUIMessageStreamResponse();
}
