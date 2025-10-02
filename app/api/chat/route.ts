import { streamText, UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { readSqlDbTool } from './tools/sql-tool';
import { createClient } from '@/lib/supabase/server';
import { registry, DEFAULT_MODEL, isValidModel } from '@/lib/ai/models';

// Allow streaming responses up to 30 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
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
    let systemPrompt = agent.system_prompt || `Sei l'Agent AI dell'utente in chat con te.

Rispondi sempre in markdown per migliorare la leggibilità.

CONTESTO TEMPORALE CORRENTE:
- Data di oggi (UTC): ${currentDateUTC}
- Ora corrente (UTC): ${currentTimeUTC}
- Timestamp completo (UTC): ${currentDateTimeUTC}

Il tuo ruolo è:
- Assistere l'utente con analisi e insights basati sui dati
- Aiutare con strategie di follow-up usando dati storici
- Analizzare performance e trend

Quando ti viene chiesta un'analisi:
1. Identifica quali database e tabelle consultare
2. Esegui le query SQL necessarie (anche multiple se serve)
3. Analizza i risultati e fornisci insights actionable
4. Suggerisci prossimi passi basati sui dati
5. Usa il contesto temporale corrente per analisi storiche (es. "negli ultimi 30 giorni", "questo mese", "quest'anno")

Rispondi sempre in italiano e mantieni un tono professionale ma accessibile.`;

    // Aggiungi il contesto temporale se non già presente
    if (!systemPrompt.includes('CONTESTO TEMPORALE')) {
      systemPrompt += `

CONTESTO TEMPORALE CORRENTE:
- Data di oggi (UTC): ${currentDateUTC}
- Ora corrente (UTC): ${currentTimeUTC}
- Timestamp completo (UTC): ${currentDateTimeUTC}

    Usa Markdown nella risposta se valuti che possa aiutare meglio la comprensione.
`;
    }

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
