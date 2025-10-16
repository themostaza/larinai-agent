import { streamText, UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { readSqlDbTool } from './tools/sql-tool';
import { textSearchTool } from './tools/text-search-tool';
import { createChartTool } from '../data_agent/tools/create-chart-tool';
import { createClient } from '@/lib/supabase/server';
import { registry, DEFAULT_MODEL, isValidModel, AVAILABLE_MODELS } from '@/lib/ai/models';

// Allow streaming responses up to 30 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  
  // Se è una richiesta dal Chart Agent, delega a funzione separata
  if (body.isChartAgent) {
    console.log('📊 [CHAT] Chart Agent mode detected');
    return handleChartAgent(body);
  }
  
  // Altrimenti procedi con la logica normale della chat
  const { messages, sessionId, modelId }: { messages: UIMessage[]; sessionId: string; modelId?: string } = body;

  console.log('🔵 [CHAT] Request:', { sessionId, messagesCount: messages?.length, modelId });

  if (!sessionId) {
    console.error('❌ [CHAT] sessionId missing!');
    return new Response(
      JSON.stringify({ error: 'sessionId è obbligatorio' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = await createClient();
    
    // 1. Recupera la sessione con l'agent_id
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('agent_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session || !session.agent_id) {
      console.error('❌ [CHAT] Session non trovata o senza agent_id:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Sessione non trovata' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const agentId = session.agent_id;
    console.log('🟢 [CHAT] Agent ID recuperato dalla sessione:', agentId);

    // 2. Recupera le configurazioni dell'agent dal database
    const { data: agent, error } = await supabase
      .from('agents')
      .select('system_prompt, settings')
      .eq('id', agentId)
      .single();

    if (error || !agent) {
      console.error('❌ [CHAT] Agent non trovato:', error);
      return new Response(
        JSON.stringify({ error: 'Agent non trovato' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🟢 [CHAT] Agent caricato:', { agentId, hasSystemPrompt: !!agent.system_prompt, hasSettings: !!agent.settings });

    // Ottieni data e ora correnti in UTC
    const now = new Date();
    const currentDateTimeUTC = now.toISOString();
    const currentDateUTC = now.toISOString().split('T')[0];
    const currentTimeUTC = now.toISOString().split('T')[1].split('.')[0];

    // Usa il system prompt dal database, o un default se non presente
    let systemPrompt = agent.system_prompt || ``;

    // Aggiungi il contesto temporale se non già presente
    if (!systemPrompt.includes('CONTESTO TEMPORALE')) {
      systemPrompt += `

CONTESTO TEMPORALE CORRENTE:
- Data di oggi (UTC): ${currentDateUTC}
- Ora corrente (UTC): ${currentTimeUTC}
- Timestamp completo (UTC): ${currentDateTimeUTC}

    Usa Markdown nella risposta se valuti che possa aiutare meglio la comprensione e usa tutti i componenti grafici del markdown a disposizione (tabelle, liste, link, etc).
`;
    }

    // Log del system prompt per debugging
    console.log('📝 [CHAT] System Prompt completo:', systemPrompt);

    // 3. Costruisci dinamicamente la lista di tool abilitati
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enabledTools: Record<string, any> = {};
    const agentSettings = agent.settings as { tools?: Record<string, { enabled: boolean, config?: unknown }> } | null;
    
    if (agentSettings?.tools) {
      // Abilita solo i tool configurati e abilitati
      for (const [toolName, toolSettings] of Object.entries(agentSettings.tools)) {
        if (toolSettings.enabled) {
          // Crea il tool con la configurazione specifica
          if (toolName === 'sql-tool') {
            enabledTools['read_sql_db'] = readSqlDbTool(agentId, toolSettings.config);
          } else if (toolName === 'text-search') {
            enabledTools['search_document'] = textSearchTool(toolSettings.config);
          }
          // Aggiungi altri tool qui quando disponibili
        }
      }
      console.log('🟢 [CHAT] Tools abilitati:', Object.keys(enabledTools));
    } else {
      // Default: abilita sql-tool
      console.log('⚠️ [CHAT] Nessun tool configurato, uso default sql-tool');
      enabledTools['read_sql_db'] = readSqlDbTool(agentId, undefined);
    }

    // Seleziona il modello: usa quello richiesto se valido, altrimenti il default
    const selectedModel = (modelId && isValidModel(modelId) ? modelId : DEFAULT_MODEL) as Parameters<typeof registry.languageModel>[0];
    console.log('🤖 [CHAT] Using model:', selectedModel);

    const result = streamText({
      model: registry.languageModel(selectedModel),
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      stopWhen: stepCountIs(15),
      tools: enabledTools
    });

    return result.toUIMessageStreamResponse();

  } catch (error) {
    console.error('❌ [CHAT] Error in chat route:', error);
    return new Response(
      JSON.stringify({ error: 'Errore interno del server' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Funzione dedicata per gestire il Chart Agent
async function handleChartAgent(body: {
  messages: UIMessage[];
  queryContext?: {
    query: string;
    database: string;
    purpose: string;
    sessionId: string;
    queryId: string;
    chatMessageId?: string;
  };
  modelId?: string;
}) {
  const { messages, queryContext, modelId } = body;
  
  console.log('🤖 [CHART-AGENT] Received request:', { 
    messagesCount: messages?.length, 
    hasQueryContext: !!queryContext,
    chatMessageId: queryContext?.chatMessageId,
    modelId
  });

  // Validazione dei messaggi
  if (!messages || !Array.isArray(messages)) {
    console.error('🤖 [CHART-AGENT] Invalid messages:', messages);
    throw new Error('Messages array is required');
  }

  // Validazione chatMessageId se presente queryContext
  if (queryContext && !queryContext.chatMessageId) {
    console.error('🤖 [CHART-AGENT] chatMessageId missing in queryContext');
    throw new Error('chatMessageId is required in queryContext');
  }

  // Carica i dati completi della query se c'è queryContext
  let savedQuery = null;
  let queryBody = null;
  let output = null;
  let input = null;

  if (queryContext?.chatMessageId) {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('query_saved')
        .select('*')
        .eq('chat_message_id', queryContext.chatMessageId)
        .single();

      if (error) {
        console.error('❌ [CHART-AGENT] Error loading query:', error);
      } else if (data) {
        savedQuery = data;
        queryBody = (data.body || {}) as Record<string, unknown>;
        output = (queryBody.output || {}) as Record<string, unknown>;
        input = (queryBody.input || {}) as Record<string, unknown>;
        
        console.log('🟢 [CHART-AGENT] Query data loaded:', {
          hasBody: !!data.body,
          hasChartKpi: !!data.chart_kpi,
          totalCount: output.totalCount,
          returnedCount: output.returnedCount
        });
      }
    } catch (error) {
      console.error('❌ [CHART-AGENT] Exception loading query:', error);
    }
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

${queryContext && savedQuery ? `
CONTESTO QUERY CORRENTE:
- Query SQL: ${input?.query || output?.query || queryContext.query || 'N/A'}
- Database: ${output?.database || queryContext.database || 'N/A'}
- Scopo: ${input?.purpose || output?.purpose || queryContext.purpose || 'N/A'}
- Total Records nel DB: ${output?.totalCount || 0}
- Records Returned: ${output?.returnedCount || 0}
- Execution Time: ${output?.executionTime || 'N/A'}
- Session ID: ${queryContext.sessionId}
- Query ID: ${queryContext.queryId}
- Chat Message ID: ${queryContext.chatMessageId}

STRUTTURA DATI DELLA QUERY:
${output?.queryResultStructure ? JSON.stringify(output.queryResultStructure, null, 2) : 'Non disponibile'}

CONFIGURAZIONE CHART/KPI ATTUALE:
${savedQuery.chart_kpi ? JSON.stringify(savedQuery.chart_kpi, null, 2) : 'Nessuna configurazione presente - puoi creare la prima!'}

I dati di questa query sono già disponibili nel database e l'utente vuole creare visualizzazioni basate su di essi.
IMPORTANTE: Quando usi il tool create_chart, usa SEMPRE il Chat Message ID: ${queryContext.chatMessageId}
` : ''}

IL TUO RUOLO:
- Aiuta l'utente a creare dashboard efficaci con grafici e KPI
- Analizza la STRUTTURA DATI DELLA QUERY per suggerire le visualizzazioni migliori
- Crea configurazioni JSON valide usando il tool create_chart
- Spiega le scelte di visualizzazione e fornisci insights
- Se esiste già una configurazione, puoi modificarla o estenderla

DATI A TUA DISPOSIZIONE:
Hai accesso immediato alla struttura completa dei dati della query tramite "STRUTTURA DATI DELLA QUERY".
Usa ESATTAMENTE i nomi dei campi come appaiono nella struttura (case-sensitive).

IMPORTANTE SUL TOOL create_chart:
- Ogni volta che usi questo tool, SOVRASCRIVE COMPLETAMENTE la configurazione precedente
- Se l'utente chiede di modificare un grafico, includi TUTTI i grafici/KPI esistenti più le modifiche
- Non dimenticare mai il chatMessageId: ${queryContext?.chatMessageId || 'REQUIRED'}

LINEE GUIDA PER CREARE VISUALIZZAZIONI:

**KPI (Indicatori Chiave) - COME FUNZIONANO:**
- aggregation: 'count' → conta i valori NON-NULL del query_field (es. per contare record usa un campo sempre presente come uid/id)
- aggregation: 'count_where' → conta le righe che soddisfano il filter (usa filter: {campo: valore})
- aggregation: 'sum' → somma i valori numerici del query_field
- aggregation: 'avg' → calcola la media dei valori del query_field
- type: 'number' → formatta come numero (1.234)
- type: 'currency' → formatta come Euro (€1.234,00)
- type: 'percentage' → aggiunge % al numero (devi calcolare tu la percentuale!)
- icon: NON usare, il campo è ignorato (serve solo per documentazione)

ESEMPI KPI:
1. Contare tutti gli utenti: {"aggregation": "count", "query_field": "uid", "type": "number"}
2. Contare utenti attivi: {"aggregation": "count_where", "query_field": "uid", "filter": {"status": "active"}, "type": "number"}
3. Percentuale attivi: SBAGLIATO fare solo count_where! Devi calcolare (attivi/totali*100) manualmente

**GRAFICI - COME FUNZIONANO:**
- Pie/Doughnut: CONTA AUTOMATICAMENTE le occorrenze di x_field (non serve aggregate)
  Esempio: {"type": "pie", "data": {"x_field": "status", "y_field": "uid"}} → conta quanti record per ogni status
- Bar/Line con aggregate='count': conta le occorrenze di x_field
  Esempio: {"type": "bar", "data": {"x_field": "language", "y_field": "uid", "aggregate": "count"}}
- Bar/Line SENZA aggregate: ogni riga è un punto (usa per dati già aggregati o time series)
- Con group_by: crea serie multiple raggruppate per quel campo

**REGOLE AGGREGATE:**
- Pie/Doughnut → aggregate NON serve, conta automaticamente
- Bar/Line per contare → aggiungi "aggregate": "count"
- Bar/Line per sommare → aggiungi "aggregate": "sum"
- y_field serve sempre anche se con count (può essere qualsiasi campo)

**BEST PRACTICES:**
- Limita a 3-4 KPI principali
- Crea 2-4 grafici significativi
- Per percentuali KPI: calcola manualmente o usa due KPI separati
- Per grafici di conteggio: usa aggregate='count' o pie/doughnut
- Usa titoli chiari e descrittivi in italiano

**REGOLE CRITICHE:**
- NON inventare nomi di campi: usa SOLO quelli in "STRUTTURA DATI DELLA QUERY"
- Se modifichi, includi TUTTO (non solo le modifiche) perché il tool sovrascrive
- Spiega sempre all'utente cosa stai creando PRIMA di usare il tool

Rispondi sempre in italiano con tono professionale ma accessibile.
Usa Markdown per formattare le risposte.
Sii proattivo nel suggerire visualizzazioni utili!
`;

  // Converti i messaggi UIMessage in ModelMessage usando la funzione dell'SDK
  const modelMessages = convertToModelMessages(messages);

  console.log('🤖 [CHART-AGENT] Converted messages:', modelMessages);

  // Usa il modello richiesto o il default
  const selectedModel = (modelId && AVAILABLE_MODELS.some(m => m.id === modelId) ? modelId : DEFAULT_MODEL) as Parameters<typeof registry.languageModel>[0];
  console.log('🤖 [CHART-AGENT] Using model:', selectedModel);

  const result = streamText({
    model: registry.languageModel(selectedModel),
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(10),
    tools: {
      create_chart: createChartTool,
    },
  });

  return result.toUIMessageStreamResponse();
}
